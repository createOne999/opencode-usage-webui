import { expect, test } from "bun:test";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../plugin/src/db/client.ts";
import { migrate } from "../plugin/src/db/migrations.ts";
import { Repository } from "../plugin/src/db/repository.ts";
import { Collector } from "../plugin/src/capture/collector.ts";
import { readConfig } from "../plugin/src/shared/config.ts";
import { startServer } from "../plugin/src/server/server.ts";
import { normalizeContext } from "../plugin/src/capture/normalizer.ts";
import { attributeTokens } from "../plugin/src/shared/tokens.ts";
import type { ContextInput } from "../plugin/src/shared/types.ts";

const tempRoot =
  process.platform === "win32"
    ? join(process.env.LOCALAPPDATA!, "Temp", "opencode")
    : tmpdir();
const context: ContextInput = {
  sessionID: "session-api",
  model: { providerID: "openai", id: "gpt-4o" },
  agent: "build",
  system: [{ type: "text", text: "system" }],
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: "<script>alert('xss')</script> hello" }],
    },
  ],
};
const usage = {
  input: 100,
  output: 20,
  reasoning: 5,
  cache: { read: 200, write: 50 },
};
async function fixture() {
  const dir = await mkdtemp(join(tempRoot, "inspector-api-")),
    config = readConfig({ dataDir: dir, port: 0 }),
    db = await openDatabase(":memory:");
  await migrate(db);
  const repository = new Repository(db),
    collector = new Collector(repository, config),
    server = startServer(repository, collector, config);
  const base = `http://127.0.0.1:${server.port}`;
  const request = (path: string, options?: RequestInit) =>
    fetch(base + path, options);
  const get = async (path: string) => {
    const response = await request(path);
    expect(response.status).toBe(200);
    return response.json();
  };
  const close = async () => {
    await server.stop(true);
    await collector.close();
    await db.close();
    await rm(dir, { recursive: true, force: true });
  };
  return {
    dir,
    config,
    db,
    repository,
    collector,
    server,
    request,
    get,
    close,
  };
}

test("HTTP serves offline UI, health, overview snapshots, hourly/session details and filters", async () => {
  const f = await fixture();
  try {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const data = normalizeContext(
        { ...context, sessionID: i === 2 ? "second" : "session-api" },
        i === 2 ? "title" : "primary",
        "project-api",
      );
      ids.push(data.request.id);
      Object.assign(data.request, {
        uncached_input_tokens: 100,
        cache_read_tokens: 200,
        cache_write_tokens: 50,
        output_tokens: 20,
        reasoning_tokens: 5,
        reported_cost_usd: 0.12,
        cost_source: "opencode",
        usage_available: true,
        status: "success",
      });
      attributeTokens(data.parts, usage);
      await f.repository.saveRequest(data.request, data.parts);
    }
    const page = await f.request("/");
    expect(page.status).toBe(200);
    expect(page.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    const html = await page.text();
    for (const label of [
      "3-Tier Token Usage",
      "Hourly Monitoring",
      "Session Monitoring",
      "Estimated part attribution",
      "Export JSON",
      "Cache read",
    ])
      expect(html).toContain(label);
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=/);
    expect(
      () => new Function(html.match(/<script>([\s\S]*)<\/script>/)![1]),
    ).not.toThrow();
    const health = await f.get("/api/health");
    expect(health.duckdb_version).toMatch(/^v2\.0\./);
    expect(health.dataDir).toBe(f.dir);
    expect(f.server.hostname).toBe("127.0.0.1");
    const overview = await f.get(
      "/api/overview?preset=today&hideAuxiliary=true",
    );
    expect(overview.totals.total_input_tokens).toBe(700);
    expect(overview.today.request_count).toBe(2);
    expect(overview.month.request_count).toBe(2);
    expect(overview.role_breakdown.length).toBeGreaterThan(0);
    const hours = await f.get("/api/hourly?hideAuxiliary=true");
    expect(hours[0].uncached_input_tokens).toBe(200);
    expect(hours[0].input_plus_cache_read_tokens).toBe(600);
    expect(hours[0].non_cache_tokens).toBe(250);
    expect(hours[0].role_breakdown.length).toBeGreaterThan(0);
    const sessions = await f.get("/api/sessions?limit=1&offset=0");
    expect(sessions.items).toHaveLength(1);
    expect(sessions.total).toBe(2);
    const session = await f.get("/api/sessions/session-api");
    expect(session.overview.request_count).toBe(2);
    expect(session.requests.total).toBe(2);
    expect(session.role_breakdown.length).toBeGreaterThan(0);
    const rows = await f.get(
      "/api/requests?project=project-api&session=session-api&provider=openai&model=gpt-4o&kind=primary&status=success&metric=cache_read&search=hello&limit=1&offset=1",
    );
    expect(rows.total).toBe(2);
    expect(rows.items).toHaveLength(1);
    const detail = await f.get("/api/requests/" + ids[0]);
    expect(detail.total_input_tokens).toBe(350);
    expect(detail.message_parts[0].part_type).toBe("system");
    expect(detail.message_parts[1].text).toContain("<script>");
    expect(
      (await f.request("/api/requests/00000000-0000-0000-0000-000000000000"))
        .status,
    ).toBe(404);
    expect((await f.request("/api/sessions/missing")).status).toBe(404);
  } finally {
    await f.close();
  }
});

test("API rejects malformed filters, cross-origin requests, DNS rebinding and ambiguous deletion", async () => {
  const f = await fixture();
  try {
    for (const query of [
      "preset=invalid",
      "from=bad",
      "from=2026-11-01&to=2026-10-01",
      "limit=0",
      "limit=501",
      "offset=-1",
      "metric=sql",
      "hideAuxiliary=yes",
    ])
      expect((await f.request("/api/requests?" + query)).status).toBe(400);
    expect(
      (
        await f.request("/api/health", {
          headers: { Origin: "https://evil.example" },
        })
      ).status,
    ).toBe(403);
    expect(
      (await f.request("/api/health", { headers: { Host: "evil.example" } }))
        .status,
    ).toBe(403);
    expect(
      (
        await f.request("/api/health", {
          headers: { "Sec-Fetch-Site": "cross-site" },
        })
      ).status,
    ).toBe(403);
    expect((await f.request("/api/data", { method: "DELETE" })).status).toBe(
      400,
    );
    expect(
      (await f.request("/api/data?all=true&session=a", { method: "DELETE" }))
        .status,
    ).toBe(400);
    expect(
      (
        await f.request("/api/retention", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"days":0}',
        })
      ).status,
    ).toBe(400);
    expect(
      (await f.request("/api/retention", { method: "POST", body: "days=1" }))
        .status,
    ).toBe(400);
    expect(
      (
        await f.request("/api/retention", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "broken",
        })
      ).status,
    ).toBe(400);
    expect((await f.request("/api/export?format=sql")).status).toBe(400);
    expect((await f.request("/missing")).status).toBe(404);
    expect((await f.request("/api/health", { method: "PUT" })).status).toBe(
      405,
    );
  } finally {
    await f.close();
  }
});

test("JSON, JSONL and Parquet downloads honor filters and clean temporary exports", async () => {
  const f = await fixture();
  try {
    const data = normalizeContext(context);
    await f.repository.saveRequest(data.request, data.parts);
    const json = await f.request("/api/export?format=json&session=session-api");
    expect(json.headers.get("content-disposition")).toContain("requests.json");
    expect(await json.json()).toHaveLength(1);
    const jsonl = await f.request("/api/export?format=jsonl");
    expect(JSON.parse((await jsonl.text()).trim()).id).toBe(data.request.id);
    const parquet = await f.request("/api/export?format=parquet");
    expect(parquet.status).toBe(200);
    const bytes = await parquet.arrayBuffer();
    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("PAR1");
    const downloaded = join(f.dir, "download.parquet");
    await writeFile(downloaded, new Uint8Array(bytes));
    expect(
      (
        await f.db.query("SELECT count(*)::DOUBLE AS n FROM read_parquet(?)", [
          downloaded,
        ])
      )[0].n,
    ).toBe(1);
    // Reading to EOF closes the native file before asynchronous directory removal completes.
    await Bun.sleep(30);
    expect(
      (await readdir(f.dir)).filter((p) => p.startsWith("export-")),
    ).toEqual([]);
  } finally {
    await f.close();
  }
});

test("all/session/request API deletion clears active capture and cannot resurrect on completion or cleanup", async () => {
  const f = await fixture();
  try {
    for (const mode of ["request", "session", "all"] as const) {
      const id = f.collector.context(context)!;
      f.collector.event({
        type: "session.step.started",
        properties: {
          sessionID: context.sessionID,
          assistantMessageID: "assistant-" + mode,
          model: context.model,
          started: Date.now(),
        },
      });
      const selection =
        mode === "request"
          ? "request=" + id
          : mode === "session"
            ? "session=session-api"
            : "all=true";
      expect(
        (await f.request("/api/data?" + selection, { method: "DELETE" }))
          .status,
      ).toBe(200);
      f.collector.event({
        type: "session.step.ended",
        properties: {
          sessionID: context.sessionID,
          assistantMessageID: "assistant-" + mode,
          tokens: usage,
          cost: 1,
        },
      });
      await f.collector.flush();
      expect(await f.repository.request(id)).toBeNull();
    }
    await f.collector.close();
    expect((await f.repository.listRequests()).total).toBe(0);
  } finally {
    await f.close();
  }
});

test("retention cleanup removes matching rows but keeps recent active capture", async () => {
  const f = await fixture();
  try {
    const old = normalizeContext(context);
    old.request.started_at = "2020-01-01T00:00:00Z";
    await f.repository.saveRequest(old.request, old.parts);
    const recent = f.collector.context({ ...context, sessionID: "recent" })!;
    await f.collector.flush();
    expect(
      (
        await f.request("/api/retention", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days: 90 }),
        })
      ).status,
    ).toBe(200);
    expect(await f.repository.request(old.request.id)).toBeNull();
    expect(await f.repository.request(recent)).not.toBeNull();
    await expect(
      f.collector.deleteData({ olderThanDays: -1 }),
    ).rejects.toThrow();
  } finally {
    await f.close();
  }
});
