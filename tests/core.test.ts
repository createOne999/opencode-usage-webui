import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readConfig } from "../plugin/src/shared/config.ts";
import { sanitize } from "../plugin/src/shared/redact.ts";
import {
  attributeTokens,
  normalizeUsage,
  tokenMetrics,
} from "../plugin/src/shared/tokens.ts";
import { estimateCost } from "../plugin/src/pricing/pricing.ts";
import { normalizeContext } from "../plugin/src/capture/normalizer.ts";
import { Correlator } from "../plugin/src/capture/correlator.ts";
import { Collector } from "../plugin/src/capture/collector.ts";
import { openDatabase } from "../plugin/src/db/client.ts";
import { migrate } from "../plugin/src/db/migrations.ts";
import { Repository, presetRange } from "../plugin/src/db/repository.ts";
import type { ContextInput } from "../plugin/src/shared/types.ts";

const context: ContextInput = {
  sessionID: "session-1",
  model: { providerID: "openai", id: "gpt-4o" },
  agent: "build",
  system: [
    { type: "text", text: "system instruction" },
    { type: "text", text: "project instruction" },
  ],
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "hello query" },
        {
          type: "media",
          media: {
            kind: "image",
            mediaType: "image/png",
            source: { type: "base64", data: "SECRET_BINARY" },
          },
        },
        {
          type: "media",
          media: { kind: "document", mediaType: "application/pdf" },
        },
      ],
    },
    {
      role: "assistant",
      content: [
        { type: "text", text: "past reply" },
        { type: "reasoning", text: "thinking" },
        {
          type: "tool-call",
          id: "call-1",
          name: "read",
          input: { file: "a.ts" },
        },
      ],
    },
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          id: "call-1",
          name: "read",
          result: { type: "text", value: "file result" },
        },
        {
          type: "future",
          something: { new: "shape" },
          data: { extension: "preserved" },
        },
      ],
    },
  ],
  tools: { read: { description: "read a file", input: { type: "object" } } },
};
const usage = {
  input: 100,
  output: 20,
  reasoning: 5,
  cache: { read: 200, write: 50 },
};
const tempRoot =
  process.platform === "win32"
    ? join(process.env.LOCALAPPDATA!, "Temp", "opencode")
    : tmpdir();
async function memory() {
  const db = await openDatabase(":memory:");
  await migrate(db);
  return { db, repo: new Repository(db) };
}

describe("normalization, privacy and accounting", () => {
  test("source-shaped parts preserve exact order, tools, media and unknown variants", () => {
    const before = JSON.stringify(context);
    const { request, parts } = normalizeContext(context);
    expect(parts.map((p) => p.part_type)).toEqual([
      "system",
      "system",
      "user",
      "image",
      "file",
      "assistant",
      "reasoning",
      "tool_call",
      "tool_result",
      "unknown",
      "tool_def",
    ]);
    expect(
      parts.filter((p) => p.tool_call_id === "call-1").map((p) => p.tool_name),
    ).toEqual(["read", "read"]);
    expect(parts[9].payload).toEqual({
      type: "future",
      something: { new: "shape" },
      data: { extension: "preserved" },
    });
    expect(parts[2].message_index).toBe(2);
    expect(parts[3].part_index).toBe(1);
    expect(JSON.stringify(request)).not.toContain("SECRET_BINARY");
    expect(JSON.stringify(context)).toBe(before);
  });
  test("three tiers count reasoning once and separate cache write from hit ratio", () => {
    expect(tokenMetrics(usage)).toEqual({
      uncached_input_tokens: 100,
      input_plus_cache_read_tokens: 300,
      total_input_tokens: 350,
      cache_read_tokens: 200,
      cache_write_tokens: 50,
      output_tokens: 20,
      reasoning_tokens: 5,
      non_cache_tokens: 125,
      total_tokens: 375,
      cache_hit_ratio: 2 / 3,
    });
    expect(tokenMetrics(normalizeUsage()).cache_hit_ratio).toBe(0);
    expect(normalizeUsage({ input: NaN, output: -3 })).toEqual({
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    });
  });
  test("role estimates scale independently to authoritative input/output/reasoning totals", () => {
    const { parts } = normalizeContext(context);
    parts.push({
      ...parts[5],
      direction: "output",
      message_index: 10,
      part_index: 0,
    });
    parts.push({
      ...parts[6],
      direction: "output",
      message_index: 10,
      part_index: 1,
    });
    attributeTokens(parts, usage);
    expect(
      parts
        .filter((p) => p.direction === "input")
        .reduce((s, p) => s + p.estimated_tokens, 0),
    ).toBe(350);
    expect(
      parts
        .filter((p) => p.direction === "output" && p.part_type === "reasoning")
        .reduce((s, p) => s + p.estimated_tokens, 0),
    ).toBe(5);
    expect(
      parts
        .filter((p) => p.direction === "output" && p.part_type !== "reasoning")
        .reduce((s, p) => s + p.estimated_tokens, 0),
    ).toBe(20);
  });
  test("redacts nested credentials, headers, bearer text and bounded UTF8 payloads", () => {
    const text = JSON.stringify(
      sanitize({
        Authorization: "secret",
        headers: new Headers({ "x-api-key": "secret2", cookie: "secret3" }),
        nested: { apiKey: "secret4", prompt: "Bearer abc.def.ghi" },
      }),
    );
    for (const secret of [
      "secret",
      "secret2",
      "secret3",
      "secret4",
      "abc.def.ghi",
    ])
      expect(text).not.toContain(secret);
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(JSON.stringify(sanitize(cycle))).toContain("CIRCULAR");
    expect(
      Buffer.byteLength(
        JSON.stringify(sanitize({ text: "한".repeat(50000) }, 1024)),
      ),
    ).toBeLessThan(1100);
    expect(
      JSON.stringify(sanitize({ text: "x".repeat(10000) }, 128)),
    ).toContain("TRUNCATED");
  });
  test("cost uses all separate buckets and unknown prices remain unknown", () => {
    expect(
      estimateCost(usage, {
        input_per_million: 2,
        output_per_million: 10,
        cache_read_per_million: 0.5,
        cache_write_per_million: 3,
        source: "test",
      }),
    ).toEqual({
      estimated_cost_usd: 0.0007,
      estimated_cache_savings_usd: 0.0003,
    });
    expect(estimateCost(usage).estimated_cost_usd).toBeNull();
  });
  test("configuration validates loopback and unsafe options", () => {
    expect(readConfig().host).toBe("127.0.0.1");
    expect(() => readConfig({ host: "0.0.0.0" })).toThrow();
    expect(() => readConfig({ port: -1 })).toThrow();
    expect(() =>
      readConfig({ capture: { rawProviderBodies: true } }),
    ).toThrow();
    expect(() => readConfig({ enabled: "yes" })).toThrow();
  });
  test("strong assistant identity and ambiguity refusal", () => {
    const warnings: string[] = [];
    const c = new Correlator((m) => warnings.push(m));
    c.add("1", "s", "primary", "p", "m");
    expect(c.match("s", "primary", "p", "m")).toBe("1");
    c.bind("1", "s", "a");
    expect(c.assistant("s", "a")).toBe("1");
    c.add("2", "s", "title", "p", "m");
    c.add("3", "s", "title", "p", "m");
    expect(c.match("s", "title")).toBeUndefined();
    expect(warnings).toHaveLength(1);
    c.remove("1");
    expect(c.assistant("s", "a")).toBeUndefined();
  });
  test("UTC presets cover today, seven days, thirty days and month boundaries", () => {
    const now = new Date("2026-10-27T12:00:00Z");
    expect(presetRange("today", now).from).toBe("2026-10-27T00:00:00.000Z");
    expect(presetRange("7d", now).from).toBe("2026-10-21T00:00:00.000Z");
    expect(presetRange("30d", now).from).toBe("2026-09-28T00:00:00.000Z");
    expect(presetRange("month", now).from).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("DuckDB 2.0 persistent core", () => {
  test("live engine, parameterized writes, migration idempotence, transaction rollback and reopen", async () => {
    const dir = await mkdtemp(join(tempRoot, "inspector-test-"));
    const path = join(dir, "state.duckdb");
    try {
      const db = await openDatabase(path);
      await migrate(db);
      await migrate(db);
      expect(String((await db.query("SELECT version() AS v"))[0].v)).toMatch(
        /^v2\.0\./,
      );
      const repo = new Repository(db),
        data = normalizeContext(context);
      await repo.saveRequest(data.request, data.parts);
      await expect(
        db.transaction(async (tx) => {
          await tx.run("DELETE FROM requests");
          throw new Error("rollback");
        }),
      ).rejects.toThrow("rollback");
      expect((await repo.listRequests()).total).toBe(1);
      await db.close();
      await db.close();
      const reopened = await openDatabase(path);
      await migrate(reopened);
      expect(
        (await new Repository(reopened).request(data.request.id))
          ?.message_parts,
      ).toHaveLength(data.parts.length);
      expect(
        (
          await reopened.query(
            "SELECT count(*)::DOUBLE AS n FROM schema_migrations",
          )
        )[0].n,
      ).toBe(1);
      await reopened.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  test("capture lifecycle, source event shapes, tool pairing, zero OpenCode cost and analytics", async () => {
    const { db, repo } = await memory();
    try {
      const collector = new Collector(repo, readConfig());
      const frozen = JSON.stringify(context);
      const id = collector.context(context, "primary", "project-1")!;
      const emit = (type: string, properties: Record<string, unknown> = {}) =>
        collector.event({
          type,
          properties: {
            sessionID: "session-1",
            assistantMessageID: "assistant-1",
            ...properties,
          },
        });
      emit("session.step.started", {
        model: context.model,
        agent: "build",
        started: Date.parse("2026-10-27T11:00:00Z"),
      });
      emit("session.reasoning.started", { ordinal: 0 });
      emit("session.reasoning.ended", {
        ordinal: 0,
        text: "reasoning response",
      });
      emit("session.text.started", { ordinal: 0 });
      emit("session.text.ended", { ordinal: 0, text: "assistant response" });
      emit("session.tool.input.started", { id: "new-call", name: "read" });
      emit("session.tool.called", {
        id: "new-call",
        input: { file: "safe.ts", apiKey: "should-not-store" },
      });
      emit("session.tool.success", {
        id: "new-call",
        content: [{ type: "text", text: "tool content" }],
      });
      emit("session.step.ended", { tokens: usage, cost: 0 });
      await collector.flush();
      const detail = await repo.request(id);
      expect(detail?.status).toBe("success");
      expect(detail?.reported_cost_usd).toBe(0);
      expect(detail?.cost_source).toBe("opencode");
      expect(detail?.estimated_cost_usd).toBeGreaterThan(0);
      expect(JSON.stringify(detail)).not.toContain("should-not-store");
      expect(JSON.stringify(context)).toBe(frozen);
      const output = (
        detail?.message_parts as Record<string, unknown>[]
      ).filter((p) => p.direction === "output");
      expect(output.map((p) => p.part_type)).toEqual([
        "reasoning",
        "assistant",
        "tool_call",
        "tool_result",
      ]);
      expect(detail?.tool_events).toHaveLength(1);
      expect((detail?.tool_events as Record<string, unknown>[])[0].status).toBe(
        "success",
      );
      const summary = await repo.overview();
      expect(summary.total_input_tokens).toBe(350);
      expect(summary.non_cache_tokens).toBe(125);
      expect(summary.cost_usd).toBe(0);
      expect(summary.cache_hit_ratio).toBeCloseTo(2 / 3);
      expect(summary.hourly).toHaveLength(1);
      expect(summary.daily).toHaveLength(1);
      expect(summary.provider_model_share).toHaveLength(1);
      expect(summary.role_breakdown.length).toBeGreaterThan(0);
      const session = await repo.session("session-1");
      expect(session.request_count).toBe(1);
      expect((await repo.sessions()).total).toBe(1);
      await collector.close();
    } finally {
      await db.close();
    }
  });
  test("filters, SQL-injection resistant search, pagination, export and deletion", async () => {
    const { db, repo } = await memory();
    const dir = await mkdtemp(join(tempRoot, "inspector-export-"));
    try {
      for (let i = 0; i < 3; i++) {
        const data = normalizeContext(
          { ...context, sessionID: `session-${i}` },
          i === 2 ? "title" : "primary",
          "project",
        );
        data.request.started_at = `2026-10-${20 + i}T${10 + i}:00:00Z`;
        data.request.uncached_input_tokens = 10;
        data.request.output_tokens = i;
        data.request.status = i === 1 ? "error" : "success";
        await repo.saveRequest(data.request, data.parts);
      }
      expect(
        (await repo.listRequests({ limit: 1, offset: 1 })).items,
      ).toHaveLength(1);
      expect((await repo.listRequests({ hideAuxiliary: true })).total).toBe(2);
      expect(
        (
          await repo.listRequests({
            session: "session-1",
            provider: "openai",
            model: "gpt-4o",
            status: "error",
            project: "project",
            kind: "primary",
            metric: "output",
          })
        ).total,
      ).toBe(1);
      expect((await repo.listRequests({ search: "hello query" })).total).toBe(
        3,
      );
      expect((await repo.listRequests({ search: "' OR 1=1 --" })).total).toBe(
        0,
      );
      expect(
        (await repo.listRequests({ from: "2026-10-21", to: "2026-10-22" }))
          .total,
      ).toBe(1);
      await expect(
        repo.listRequests({ metric: "1);drop table requests" }),
      ).rejects.toThrow();
      expect(
        JSON.parse(await repo.exportJSON({ session: "session-1" })),
      ).toHaveLength(1);
      expect(
        (await repo.exportJSON({}, "jsonl")).trim().split("\n"),
      ).toHaveLength(3);
      const parquet = join(dir, "history.parquet");
      await repo.exportParquet(parquet, { session: "session-1" });
      expect(
        (
          await db.query("SELECT count(*)::DOUBLE AS n FROM read_parquet(?)", [
            parquet,
          ])
        )[0].n,
      ).toBe(1);
      await repo.deleteSession("session-1");
      expect((await repo.listRequests()).total).toBe(2);
      const id = String((await repo.listRequests()).items[0].id);
      await repo.deleteRequest(id);
      expect((await repo.listRequests()).total).toBe(1);
      await repo.deleteOlderThanDays(1);
      expect((await repo.listRequests()).total).toBe(0);
      expect(
        (await db.query("SELECT count(*)::DOUBLE AS n FROM message_parts"))[0]
          .n,
      ).toBe(0);
      await repo.deleteAll();
    } finally {
      await db.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
  test("best-effort failure isolation, bounded queue and incomplete cleanup", async () => {
    const { db, repo } = await memory();
    const warnings: string[] = [];
    const c = new Collector(repo, readConfig(), (m) => warnings.push(m));
    const id = c.context(context)!;
    await c.flush();
    await c.close();
    expect((await repo.request(id))?.status).toBe("incomplete");
    await db.close();
    const broken = new Collector(repo, readConfig({ queueLimit: 1 }), (m) =>
      warnings.push(m),
    );
    expect(() => broken.context(context)).not.toThrow();
    expect(() =>
      broken.event({
        type: "session.step.ended",
        properties: { sessionID: "s" },
      }),
    ).not.toThrow();
    await broken.flush();
    await broken.close();
    expect(warnings.length).toBeGreaterThan(0);
  });
  test("auxiliary usage is separate and disabled capture cannot leak via payload", async () => {
    const { db, repo } = await memory();
    try {
      const c = new Collector(
        repo,
        readConfig({ capture: { messages: false } }),
      );
      const id = c.context(context, "title")!;
      c.event({
        type: "session.usage.recorded",
        properties: {
          sessionID: "session-1",
          source: "title",
          tokens: usage,
          cost: 0.5,
        },
      });
      c.event({
        type: "session.usage.updated",
        properties: { sessionID: "session-1", tokens: usage, cost: 100 },
      });
      await c.flush();
      const detail = await repo.request(id);
      expect(detail?.reported_cost_usd).toBe(0.5);
      expect(detail?.request_payload).toBeNull();
      expect(detail?.message_parts).toEqual([]);
      await c.close();
    } finally {
      await db.close();
    }
  });
  test("migration failure rolls back its ledger and preserves preexisting data", async () => {
    const db = await openDatabase(":memory:");
    try {
      await db.run(
        "CREATE TABLE requests(important VARCHAR);INSERT INTO requests VALUES ('keep me')",
      );
      await expect(migrate(db)).rejects.toThrow();
      expect(
        (await db.query("SELECT important FROM requests"))[0].important,
      ).toBe("keep me");
      expect(
        await db.query(
          "SELECT table_name FROM information_schema.tables WHERE table_name='schema_migrations'",
        ),
      ).toEqual([]);
    } finally {
      await db.close();
    }
  });
  test("future schema is refused without destroying its ledger", async () => {
    const { db } = await memory();
    try {
      await db.run("INSERT INTO schema_migrations(version) VALUES (2)");
      await expect(migrate(db)).rejects.toThrow("Unsupported schema");
      expect(
        (
          await db.query("SELECT count(*)::DOUBLE AS n FROM schema_migrations")
        )[0].n,
      ).toBe(2);
    } finally {
      await db.close();
    }
  });
  test("same-process loopback HTTP queries the writer's DuckDB connection", async () => {
    const { db, repo } = await memory();
    const data = normalizeContext(context);
    const server = Bun.serve({
      hostname: readConfig().host,
      port: 0,
      fetch: async () => Response.json(await repo.overview()),
    });
    try {
      await repo.saveRequest(data.request, data.parts);
      const response = await fetch(`http://127.0.0.1:${server.port}/`);
      expect(response.status).toBe(200);
      expect((await response.json()).request_count).toBe(1);
    } finally {
      await server.stop(true);
      await db.close();
    }
  });
  test("queued consecutive steps keep their context identity without waiting for disk", async () => {
    const { db, repo } = await memory();
    const c = new Collector(repo, readConfig());
    try {
      const ids: string[] = [];
      for (let i = 0; i < 4; i++) {
        ids.push(c.context(context)!);
        c.event({
          type: "session.step.started",
          properties: {
            sessionID: context.sessionID,
            assistantMessageID: `a-${i}`,
            model: context.model,
            started: Date.now(),
          },
        });
        c.event({
          type: "session.text.ended",
          properties: {
            sessionID: context.sessionID,
            assistantMessageID: `a-${i}`,
            ordinal: 0,
            text: `output ${i}`,
          },
        });
        c.event({
          type: "session.step.ended",
          properties: {
            sessionID: context.sessionID,
            assistantMessageID: `a-${i}`,
            tokens: { ...usage, input: i },
            cost: i,
          },
        });
      }
      await c.flush();
      for (let i = 0; i < ids.length; i++) {
        const detail = await repo.request(ids[i]);
        expect(detail?.assistant_message_id).toBe(`a-${i}`);
        expect(detail?.uncached_input_tokens).toBe(i);
      }
    } finally {
      await c.close();
      await db.close();
    }
  });
  test("disabled reasoning/results do not reappear in raw request data", async () => {
    const { db, repo } = await memory();
    const c = new Collector(
      repo,
      readConfig({ capture: { reasoning: false, toolResults: false } }),
    );
    try {
      const id = c.context(context)!;
      await c.flush();
      const detail = await repo.request(id);
      expect(JSON.stringify(detail)).not.toContain("thinking");
      expect(JSON.stringify(detail)).not.toContain("file result");
    } finally {
      await c.close();
      await db.close();
    }
  });
  test("blob metadata validates traversal and upserts without binary payloads", async () => {
    const { db, repo } = await memory();
    try {
      const blob = {
        blob_id: "blob-1",
        sha256: "a".repeat(64),
        mime_type: "image/png",
        byte_size: 12,
        relative_path: "a".repeat(64),
      };
      await repo.upsertBlob(blob);
      await repo.upsertBlob({ ...blob, mime_type: "image/jpeg" });
      expect((await db.query("SELECT mime_type FROM blobs"))[0].mime_type).toBe(
        "image/jpeg",
      );
      await expect(
        repo.upsertBlob({ ...blob, relative_path: "../secret" }),
      ).rejects.toThrow();
      await repo.deleteAll();
      expect(await db.query("SELECT * FROM blobs")).toEqual([]);
    } finally {
      await db.close();
    }
  });
  test("hourly/session/role totals and effective prices keep historical cost unchanged", async () => {
    const { db, repo } = await memory();
    try {
      for (const [hour, session] of [
        [10, "a"],
        [10, "a"],
        [11, "b"],
      ] as const) {
        const data = normalizeContext({ ...context, sessionID: session });
        Object.assign(data.request, {
          started_at: `2026-10-27T${hour}:00:00Z`,
          uncached_input_tokens: 100,
          cache_read_tokens: 200,
          cache_write_tokens: 50,
          output_tokens: 20,
          reasoning_tokens: 5,
          usage_available: true,
        });
        Object.assign(data.request, await repo.cost(data.request, usage));
        attributeTokens(data.parts, usage);
        await repo.saveRequest(data.request, data.parts);
      }
      const hours = await repo.hourly();
      expect(hours.map((h) => h.total_input_tokens)).toEqual([700, 350]);
      expect(hours.map((h) => h.non_cache_tokens)).toEqual([250, 125]);
      expect(
        (hours[0].role_breakdown as Record<string, unknown>[]).reduce(
          (n, p) => n + Number(p.estimated_tokens),
          0,
        ),
      ).toBe(700);
      expect((await repo.session("a")).total_tokens).toBe(750);
      expect(
        (await repo.overview({ from: "2026-10-01", to: "2026-11-01" }))
          .request_count,
      ).toBe(3);
      const oldCost = (await repo.overview()).estimated_cost_usd;
      await db.run(
        "UPDATE model_prices SET effective_to='2026-11-01' WHERE provider='openai' AND model='gpt-4o'",
      );
      await db.run(
        "INSERT INTO model_prices VALUES ('openai','gpt-4o',99,99,99,99,'2026-11-01',NULL,'test future price')",
      );
      expect(
        (await repo.price("openai", "gpt-4o", "2026-10-27"))?.input_per_million,
      ).toBe(2.5);
      expect(
        (await repo.price("openai", "gpt-4o", "2026-11-02"))?.input_per_million,
      ).toBe(99);
      expect((await repo.overview()).estimated_cost_usd).toBe(oldCost);
      expect(await repo.price("missing", "unknown", "2026-10-27")).toBeNull();
    } finally {
      await db.close();
    }
  });
});
