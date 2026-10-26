import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Repository } from "../db/repository.ts";
import type { Collector } from "../capture/collector.ts";
import type { Config } from "../shared/config.ts";
import type { RequestFilters } from "../shared/types.ts";
import { presetRange } from "../db/repository.ts";

const csp =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
const uiFiles: Record<string, { name: string; type: string; csp?: string }> = {
  "/": { name: "index.html", type: "text/html; charset=utf-8", csp },
  "/index.html": { name: "index.html", type: "text/html; charset=utf-8", csp },
  "/styles.css": { name: "styles.css", type: "text/css; charset=utf-8" },
  "/app.js": {
    name: "app.js",
    type: "application/javascript; charset=utf-8",
  },
};

class BadRequest extends Error {}
export function parseFilters(query: URLSearchParams): RequestFilters {
  const filters: RequestFilters = {};
  const preset = query.get("preset");
  if (preset && preset !== "custom") {
    if (!["today", "7d", "30d", "month"].includes(preset))
      throw new BadRequest("Invalid preset");
    Object.assign(
      filters,
      presetRange(preset as "today" | "7d" | "30d" | "month"),
    );
  }
  for (const key of [
    "from",
    "to",
    "project",
    "session",
    "provider",
    "model",
    "kind",
    "status",
    "search",
    "metric",
  ] as const) {
    const value = query.get(key);
    if (value) filters[key] = value;
  }
  for (const key of ["from", "to"] as const)
    if (filters[key] && !Number.isFinite(Date.parse(filters[key]!)))
      throw new BadRequest("Invalid date");
  if (
    filters.from &&
    filters.to &&
    Date.parse(filters.from) >= Date.parse(filters.to)
  )
    throw new BadRequest("Invalid date range");
  for (const key of ["limit", "offset"] as const) {
    const value = query.get(key);
    if (value !== null) {
      if (
        !/^\d+$/.test(value) ||
        !Number.isSafeInteger(Number(value)) ||
        Number(value) > (key === "limit" ? 500 : 10000000) ||
        Number(value) < (key === "limit" ? 1 : 0)
      )
        throw new BadRequest("Invalid pagination");
      filters[key] = Number(value);
    }
  }
  const hide = query.get("hideAuxiliary");
  if (hide !== null && hide !== "true" && hide !== "false")
    throw new BadRequest("Invalid hideAuxiliary");
  if (hide !== null) filters.hideAuxiliary = hide === "true";
  if (
    filters.metric &&
    ![
      "input",
      "uncached_input",
      "output",
      "cache_read",
      "cache_write",
      "reasoning",
      "total_input",
      "non_cache_total",
    ].includes(filters.metric)
  )
    throw new BadRequest("Invalid metric");
  return filters;
}

export function startServer(
  repository: Repository,
  collector: Collector,
  config: Config,
) {
  if (config.host !== "127.0.0.1")
    throw new Error("Only loopback binding is supported");
  const server = Bun.serve({
    hostname: config.host,
    port: config.port,
    maxRequestBodySize: 4096,
    async fetch(request) {
      const url = new URL(request.url);
      // Reject DNS rebinding and cross-site reads/writes; loopback has no authentication.
      const hosts = new Set([
        `127.0.0.1:${server.port}`,
        `localhost:${server.port}`,
        `[::1]:${server.port}`,
      ]);
      const host = request.headers.get("host");
      if (!host || !hosts.has(host))
        return new Response("Invalid host", { status: 403 });
      const origins = new Set([
        `http://127.0.0.1:${server.port}`,
        `http://localhost:${server.port}`,
        `http://[::1]:${server.port}`,
      ]);
      const origin = request.headers.get("origin");
      if (
        (origin && !origins.has(origin)) ||
        request.headers.get("sec-fetch-site") === "cross-site"
      )
        return new Response("Cross-origin access denied", { status: 403 });
      const headers = {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      };
      const respond = (data: unknown, status = 200) =>
        Response.json(data, { status, headers });
      try {
        const asset =
          request.method === "GET" ? uiFiles[url.pathname] : undefined;
        if (asset) {
          const body = await readFile(
            join(import.meta.dir, "../ui", asset.name),
          );
          return new Response(body, {
            headers: {
              ...headers,
              "Content-Type": asset.type,
              ...(asset.csp ? { "Content-Security-Policy": asset.csp } : {}),
            },
          });
        }
        if (request.method === "GET" && url.pathname === "/api/health")
          return respond({
            status: "ok",
            duckdb_version: (
              await repository.db.query("SELECT version() AS version")
            )[0].version,
            dataDir: config.dataDir,
          });
        if (request.method === "DELETE" && url.pathname === "/api/data") {
          const all = url.searchParams.get("all"),
            session = url.searchParams.get("session"),
            id = url.searchParams.get("request");
          if (
            [all === "true", Boolean(session), Boolean(id)].filter(Boolean)
              .length !== 1 ||
            (id && !/^[0-9a-f-]{36}$/i.test(id))
          )
            throw new BadRequest(
              "Select exactly one of all=true, session or request",
            );
          await collector.deleteData({
            all: all === "true",
            session: session ?? undefined,
            request: id ?? undefined,
          });
          return respond({ deleted: true });
        }
        if (request.method === "POST" && url.pathname === "/api/retention") {
          if (
            !request.headers.get("content-type")?.startsWith("application/json")
          )
            throw new BadRequest("JSON body required");
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            throw new BadRequest("Invalid JSON");
          }
          const days =
            body && typeof body === "object"
              ? (body as Record<string, unknown>).days
              : undefined;
          if (
            !Number.isInteger(days) ||
            Number(days) < 1 ||
            Number(days) > 36500
          )
            throw new BadRequest("Invalid retention days");
          await collector.deleteData({ olderThanDays: Number(days) });
          return respond({ deleted: true, days });
        }
        if (request.method !== "GET")
          return respond({ error: "Method not allowed" }, 405);
        const filters = parseFilters(url.searchParams);
        if (url.pathname === "/api/overview") {
          const [active, today, month] = await Promise.all([
            repository.overview(filters),
            repository.overview({ ...filters, ...presetRange("today") }),
            repository.overview({ ...filters, ...presetRange("month") }),
          ]);
          const {
            daily,
            hourly,
            provider_model_share,
            role_breakdown,
            ...totals
          } = active;
          return respond({
            totals,
            today,
            month,
            daily,
            hourly,
            provider_model_share,
            role_breakdown,
          });
        }
        if (url.pathname === "/api/hourly")
          return respond(await repository.hourly(filters));
        if (url.pathname === "/api/sessions")
          return respond(await repository.sessions(filters));
        if (url.pathname === "/api/requests")
          return respond(await repository.listRequests(filters));
        const session = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
        if (session) {
          const detail = await repository.session(
            decodeURIComponent(session[1]),
            filters,
          );
          return Number(detail.request_count)
            ? respond({
                session_id: detail.session_id,
                overview: detail,
                requests: detail.requests,
                role_breakdown: detail.role_breakdown,
              })
            : respond({ error: "Session not found" }, 404);
        }
        const detail = url.pathname.match(
          /^\/api\/requests\/([0-9a-f-]{36})$/i,
        );
        if (detail) {
          const row = await repository.request(detail[1]);
          return row
            ? respond(row)
            : respond({ error: "Request not found" }, 404);
        }
        if (url.pathname === "/api/export") {
          const format = url.searchParams.get("format") ?? "json";
          if (!["json", "jsonl", "parquet"].includes(format))
            throw new BadRequest("Invalid export format");
          if (format !== "parquet")
            return new Response(
              await repository.exportJSON(filters, format as "json" | "jsonl"),
              {
                headers: {
                  ...headers,
                  "Content-Type":
                    format === "json"
                      ? "application/json"
                      : "application/x-ndjson",
                  "Content-Disposition": `attachment; filename="requests.${format}"`,
                },
              },
            );
          await mkdir(config.dataDir, { recursive: true });
          const temp = await mkdtemp(join(config.dataDir, "export-"));
          try {
            const path = join(temp, "requests.parquet");
            await repository.exportParquet(path, filters);
            const reader = Bun.file(path).stream().getReader();
            const clean = () => rm(temp, { recursive: true, force: true });
            const stream = new ReadableStream<Uint8Array>({
              async pull(controller) {
                try {
                  const result = await reader.read();
                  if (result.done) {
                    controller.close();
                    await clean();
                  } else controller.enqueue(result.value);
                } catch (error) {
                  controller.error(error);
                  await reader.cancel().catch(() => {});
                  await clean();
                }
              },
              async cancel() {
                await reader.cancel();
                await clean();
              },
            });
            return new Response(stream, {
              headers: {
                ...headers,
                "Content-Type": "application/vnd.apache.parquet",
                "Content-Disposition":
                  'attachment; filename="requests.parquet"',
              },
            });
          } catch (error) {
            await rm(temp, { recursive: true, force: true });
            throw error;
          }
        }
        return respond({ error: "Not found" }, 404);
      } catch (error) {
        return respond(
          {
            error:
              error instanceof BadRequest
                ? error.message
                : "Inspector operation failed",
          },
          error instanceof BadRequest ? 400 : 500,
        );
      }
    },
  });
  return server;
}
