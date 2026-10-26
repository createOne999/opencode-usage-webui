import type { Repository } from "../db/repository.ts";
import type { Config } from "../shared/config.ts";
import type {
  ContextInput,
  MessagePart,
  PublicEvent,
  RequestKind,
  RequestRecord,
  Usage,
} from "../shared/types.ts";
import { sanitize } from "../shared/redact.ts";
import { normalizeUsage, attributeTokens } from "../shared/tokens.ts";
import { normalizeContext, normalizePart } from "./normalizer.ts";
import { Correlator } from "./correlator.ts";

export class Collector {
  private correlator: Correlator;
  private active = new Map<
    string,
    { request: RequestRecord; parts: MessagePart[]; order: Map<string, number> }
  >();
  private tail: Promise<void> = Promise.resolve();
  private queued = 0;
  private closed = false;
  private warned = false;
  constructor(
    private repository: Repository,
    private config: Config,
    private diagnostic: (message: string) => void = console.warn,
  ) {
    this.correlator = new Correlator((message) => this.warn(message));
  }
  private warn(message: string) {
    if (this.warned) return;
    this.warned = true;
    try {
      this.diagnostic(message);
    } catch {}
  }
  private enqueue(work: () => Promise<void>) {
    if (this.closed) return;
    if (this.queued >= this.config.queueLimit) {
      this.warn("Inspector queue full; capture dropped");
      return;
    }
    this.queued++;
    this.tail = this.tail
      .then(work)
      .catch(() => this.warn("Inspector capture failed; OpenCode continues"))
      .finally(() => {
        this.queued--;
      });
  }
  context(event: ContextInput, kind: RequestKind = "primary", projectID = "") {
    if (!this.config.enabled || this.closed) return;
    try {
      if (
        this.active.size >= this.config.queueLimit ||
        this.queued >= this.config.queueLimit
      ) {
        this.warn("Inspector active request limit reached; capture dropped");
        return;
      }
      const captured = normalizeContext(
        event,
        kind,
        projectID,
        this.config.privacy.maxPayloadBytes,
      );
      if (!this.config.capture.messages) {
        captured.parts = [];
        captured.request.request_payload = null;
      } else {
        captured.parts = captured.parts.filter(
          (p) =>
            (this.config.capture.reasoning || p.part_type !== "reasoning") &&
            (this.config.capture.toolResults || p.part_type !== "tool_result"),
        );
        // Keep disabled content out of the structured view too.
        captured.request.request_payload = captured.parts.map((p) => p.payload);
      }
      this.enqueue(async () => {
        this.active.set(captured.request.id, { ...captured, order: new Map() });
        this.correlator.add(
          captured.request.id,
          event.sessionID,
          kind,
          event.model.providerID,
          event.model.id,
        );
        await this.repository.saveRequest(captured.request, captured.parts);
      });
      return captured.request.id;
    } catch {
      this.warn("Inspector context capture failed; OpenCode continues");
    }
  }
  event(event: PublicEvent) {
    if (!this.config.enabled || this.closed) return;
    try {
      // Snapshot only relevant public events; never retain the mutable event draft.
      if (
        !/^session\.(step\.|text\.|reasoning\.|tool\.|usage\.recorded)/.test(
          event.type,
        ) ||
        event.type.endsWith(".delta")
      )
        return;
      const safe = sanitize(
        event,
        this.config.privacy.maxPayloadBytes,
      ) as PublicEvent;
      this.enqueue(() => this.consume(safe));
    } catch {
      this.warn("Inspector event capture failed; OpenCode continues");
    }
  }
  private async consume(event: PublicEvent) {
    const p = event.properties;
    if (!p || typeof p.sessionID !== "string") return;
    const session = p.sessionID;
    if (event.type === "session.step.started") {
      const model = p.model as { providerID: string; id: string } | undefined;
      const id = this.correlator.match(
        session,
        "primary",
        model?.providerID,
        model?.id,
      );
      const state = id ? this.active.get(id) : undefined;
      if (!state || !id || typeof p.assistantMessageID !== "string") return;
      this.correlator.bind(id, session, p.assistantMessageID);
      state.request.assistant_message_id = p.assistantMessageID;
      if (typeof p.started === "number" && Number.isFinite(p.started))
        state.request.started_at = new Date(p.started).toISOString();
      state.request.status = "running";
      await this.repository.saveRequest(state.request, state.parts);
      return;
    }
    const id =
      event.type === "session.usage.recorded"
        ? this.correlator.match(session, p.source as RequestKind)
        : this.correlator.assistant(session, String(p.assistantMessageID));
    const state = id ? this.active.get(id) : undefined;
    if (!state || !id) return;
    const outputIndex = state.parts
      .filter((part) => part.direction === "input")
      .reduce((max, part) => Math.max(max, part.message_index + 1), 0);
    const fragmentKey = event.type.includes(".tool.")
      ? `tool:${p.id}`
      : `${event.type.includes(".reasoning.") ? "reasoning" : "text"}:${p.ordinal}`;
    if (event.type.endsWith(".started") && !state.order.has(fragmentKey))
      state.order.set(fragmentKey, state.order.size);
    const addPart = (
      type: string,
      value: Record<string, unknown>,
      key = fragmentKey,
    ) => {
      if (
        !this.config.capture.messages ||
        (type === "reasoning" && !this.config.capture.reasoning) ||
        (type === "tool-result" && !this.config.capture.toolResults)
      )
        return;
      if (!state.order.has(key)) state.order.set(key, state.order.size);
      const index = state.order.get(key)!;
      const used = state.parts
        .filter((p) => p.direction === "output" && p.part_index !== index)
        .reduce(
          (sum, p) => sum + Buffer.byteLength(JSON.stringify(p.payload)),
          0,
        );
      if (used >= this.config.privacy.maxPayloadBytes) {
        this.warn(
          "Inspector response payload limit reached; remaining content omitted",
        );
        return;
      }
      const part = normalizePart(
        id,
        type === "tool-result" ? "tool" : "assistant",
        { ...value, type },
        outputIndex,
        index,
        "output",
        this.config.privacy.maxPayloadBytes - used,
      );
      const existing = state.parts.findIndex(
        (p) => p.direction === "output" && p.part_index === index,
      );
      if (existing >= 0) state.parts[existing] = part;
      else state.parts.push(part);
    };
    if (event.type === "session.text.ended") addPart("text", { text: p.text });
    if (event.type === "session.reasoning.ended")
      addPart("reasoning", { text: p.text });
    if (event.type === "session.tool.input.started") {
      await this.repository.upsertTool({
        request_id: id,
        session_id: session,
        tool_call_id: String(p.id),
        tool_name: String(p.name),
        started_at: new Date().toISOString(),
        status: "pending",
      });
      addPart("tool-call", { id: p.id, name: p.name });
    }
    if (event.type === "session.tool.called") {
      const name = state.parts.find(
        (part) => part.tool_call_id === p.id,
      )?.tool_name;
      addPart("tool-call", { id: p.id, name, input: p.input });
      await this.repository.upsertTool({
        request_id: id,
        session_id: session,
        tool_call_id: String(p.id),
        status: "running",
        input: this.config.capture.messages ? p.input : undefined,
      });
    }
    if (
      event.type === "session.tool.success" ||
      event.type === "session.tool.failed"
    ) {
      const name = state.parts.find(
        (part) => part.tool_call_id === p.id,
      )?.tool_name;
      addPart(
        "tool-result",
        { id: p.id, name, result: p.content ?? p.error },
        `${fragmentKey}:result`,
      );
      await this.repository.upsertTool({
        request_id: id,
        session_id: session,
        tool_call_id: String(p.id),
        completed_at: new Date().toISOString(),
        status: p.error ? "error" : "success",
        output:
          this.config.capture.toolResults && this.config.capture.messages
            ? p.content
            : undefined,
        error: p.error ? JSON.stringify(sanitize(p.error)) : null,
      });
    }
    if (
      [
        "session.step.ended",
        "session.step.failed",
        "session.usage.recorded",
      ].includes(event.type)
    ) {
      const usage = normalizeUsage(p.tokens as Usage | undefined);
      Object.assign(state.request, {
        completed_at: new Date().toISOString(),
        latency_ms: Math.max(
          0,
          Date.now() - Date.parse(state.request.started_at),
        ),
        status: event.type === "session.step.failed" ? "error" : "success",
        usage_available: p.tokens !== undefined,
        uncached_input_tokens: usage.input,
        output_tokens: usage.output,
        reasoning_tokens: usage.reasoning,
        cache_read_tokens: usage.cache.read,
        cache_write_tokens: usage.cache.write,
        reported_cost_usd:
          typeof p.cost === "number" && Number.isFinite(p.cost) ? p.cost : null,
        cost_source: typeof p.cost === "number" ? "opencode" : null,
        error_type:
          p.error && typeof p.error === "object"
            ? String((p.error as Record<string, unknown>).type)
            : null,
        error_message: p.error ? JSON.stringify(sanitize(p.error)) : null,
        response_payload: null,
      });
      if (p.tokens !== undefined)
        Object.assign(
          state.request,
          await this.repository.cost(state.request, usage),
        );
      attributeTokens(state.parts, p.tokens !== undefined ? usage : undefined);
      await this.repository.saveRequest(state.request, state.parts);
      this.active.delete(id);
      this.correlator.remove(id);
      return;
    }
    attributeTokens(state.parts);
    await this.repository.saveRequest(state.request, state.parts);
  }
  async flush() {
    await this.tail;
  }
  async deleteData(selection: {
    all?: boolean;
    session?: string;
    request?: string;
    olderThanDays?: number;
  }) {
    if (
      [
        Boolean(selection.all),
        Boolean(selection.session),
        Boolean(selection.request),
        selection.olderThanDays !== undefined,
      ].filter(Boolean).length !== 1 ||
      (selection.olderThanDays !== undefined &&
        (!Number.isInteger(selection.olderThanDays) ||
          selection.olderThanDays < 1))
    )
      throw new Error("Invalid deletion selection");
    // Serialize deletion with capture, including contexts already queued but not yet written.
    const result = this.tail.then(async () => {
      const cutoff =
        selection.olderThanDays === undefined
          ? null
          : Date.now() - selection.olderThanDays * 86400000;
      for (const [id, state] of this.active) {
        if (
          selection.all ||
          selection.request === id ||
          selection.session === state.request.session_id ||
          (cutoff !== null && Date.parse(state.request.started_at) < cutoff)
        ) {
          this.active.delete(id);
          this.correlator.remove(id);
        }
      }
      if (selection.all) await this.repository.deleteAll();
      else if (selection.request)
        await this.repository.deleteRequest(selection.request);
      else if (selection.session)
        await this.repository.deleteSession(selection.session);
      else if (selection.olderThanDays !== undefined)
        await this.repository.deleteOlderThanDays(selection.olderThanDays);
      else throw new Error("A deletion selection is required");
    });
    this.tail = result.catch(() => this.warn("Inspector deletion failed"));
    return result;
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.tail;
    for (const [id, state] of this.active) {
      state.request.status = "incomplete";
      try {
        await this.repository.saveRequest(state.request, state.parts);
      } catch {
        this.warn("Inspector cleanup persistence failed");
      }
      this.correlator.remove(id);
    }
    this.active.clear();
  }
}
