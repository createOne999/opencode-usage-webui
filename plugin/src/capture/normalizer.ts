import type {
  ContextInput,
  MessagePart,
  RequestKind,
  RequestRecord,
} from "../shared/types.ts";
import { sanitize } from "../shared/redact.ts";
import { attributeTokens } from "../shared/tokens.ts";
export function normalizePart(
  requestID: string,
  role: string,
  value: unknown,
  messageIndex: number,
  partIndex: number,
  direction: "input" | "output" = "input",
  maxBytes?: number,
): MessagePart {
  const payload = sanitize(value, maxBytes);
  const raw =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : { type: "text", text: String(payload ?? "") };
  const type = String(raw.type ?? "unknown");
  const media =
    raw.media && typeof raw.media === "object"
      ? (raw.media as Record<string, unknown>)
      : {};
  const partType =
    type === "media"
      ? media.kind === "image" || String(media.mediaType).startsWith("image/")
        ? "image"
        : "file"
      : type === "text"
        ? ["system", "user", "assistant"].includes(role)
          ? role
          : "unknown"
        : ((
            {
              "tool-call": "tool_call",
              "tool-result": "tool_result",
              tool_call: "tool_call",
              tool_result: "tool_result",
              reasoning: "reasoning",
              image: "image",
              file: "file",
              tool_def: "tool_def",
            } as Record<string, string>
          )[type] ?? "unknown");
  const text = typeof raw.text === "string" ? raw.text : null;
  return {
    request_id: requestID,
    message_index: messageIndex,
    part_index: partIndex,
    role,
    part_type: partType as MessagePart["part_type"],
    direction,
    text,
    estimated_tokens: 0,
    char_count: (text ?? JSON.stringify(payload) ?? "").length,
    tool_name:
      typeof raw.name === "string"
        ? raw.name
        : typeof raw.toolName === "string"
          ? raw.toolName
          : null,
    tool_call_id:
      typeof raw.id === "string"
        ? raw.id
        : typeof raw.toolCallId === "string"
          ? raw.toolCallId
          : null,
    blob_id: null,
    payload,
  };
}
export function normalizeContext(
  event: ContextInput,
  kind: RequestKind = "primary",
  projectID = "",
  maxBytes = 2097152,
) {
  if (!event.sessionID || !event.model?.providerID || !event.model.id)
    throw new Error("Invalid context identity");
  const id = crypto.randomUUID();
  const safe = sanitize(
    {
      system: event.system ?? [],
      messages: event.messages ?? [],
      tools: event.tools ?? {},
    },
    maxBytes,
  ) as Record<string, unknown>;
  const parts: MessagePart[] = [];
  let index = 0;
  for (const value of Array.isArray(safe.system) ? safe.system : [])
    parts.push(normalizePart(id, "system", value, index++, 0));
  for (const msg of Array.isArray(safe.messages) ? safe.messages : []) {
    if (!msg || typeof msg !== "object") continue;
    const message = msg as Record<string, unknown>;
    (Array.isArray(message.content)
      ? message.content
      : [message.content]
    ).forEach((p, i) =>
      parts.push(
        normalizePart(id, String(message.role ?? "unknown"), p, index, i),
      ),
    );
    index++;
  }
  if (safe.tools && typeof safe.tools === "object")
    for (const [name, tool] of Object.entries(safe.tools))
      parts.push(
        normalizePart(
          id,
          "system",
          { type: "tool_def", name, definition: tool },
          index++,
          0,
        ),
      );
  attributeTokens(parts);
  const request: RequestRecord = {
    id,
    session_id: event.sessionID,
    project_id: projectID,
    agent: event.agent ?? null,
    kind,
    provider: event.model.providerID,
    model: event.model.id,
    assistant_message_id: null,
    started_at: new Date().toISOString(),
    completed_at: null,
    latency_ms: null,
    status: "pending",
    error_type: null,
    error_message: null,
    uncached_input_tokens: 0,
    output_tokens: 0,
    reasoning_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    usage_available: false,
    reported_cost_usd: null,
    estimated_cost_usd: null,
    estimated_cache_savings_usd: null,
    cost_source: null,
    request_payload: safe,
    response_payload: null,
  };
  return { request, parts };
}
