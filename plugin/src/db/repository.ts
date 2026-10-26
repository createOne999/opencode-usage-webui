import type { DuckDBValue } from "@duckdb/node-api";
import type { Database } from "./client.ts";
import type {
  MessagePart,
  RequestFilters,
  RequestRecord,
  Usage,
} from "../shared/types.ts";
import { sanitize } from "../shared/redact.ts";
import { estimateCost, type Price } from "../pricing/pricing.ts";
import { writeFile } from "node:fs/promises";

const sums = `count(*)::DOUBLE AS request_count,
 coalesce(sum(uncached_input_tokens),0)::DOUBLE AS uncached_input_tokens,
 coalesce(sum(cache_read_tokens),0)::DOUBLE AS cache_read_tokens,
 coalesce(sum(cache_write_tokens),0)::DOUBLE AS cache_write_tokens,
 coalesce(sum(output_tokens),0)::DOUBLE AS output_tokens,
 coalesce(sum(reasoning_tokens),0)::DOUBLE AS reasoning_tokens,
 coalesce(sum(uncached_input_tokens+cache_read_tokens),0)::DOUBLE AS input_plus_cache_read_tokens,
 coalesce(sum(uncached_input_tokens+cache_read_tokens+cache_write_tokens),0)::DOUBLE AS total_input_tokens,
 coalesce(sum(uncached_input_tokens+output_tokens+reasoning_tokens),0)::DOUBLE AS non_cache_tokens,
 coalesce(sum(uncached_input_tokens+cache_read_tokens+cache_write_tokens+output_tokens+reasoning_tokens),0)::DOUBLE AS total_tokens,
 coalesce(sum(cache_read_tokens)::DOUBLE/nullif(sum(uncached_input_tokens+cache_read_tokens),0),0) AS cache_hit_ratio,
 sum(reported_cost_usd) AS reported_cost_usd, sum(estimated_cost_usd) AS estimated_cost_usd,
 coalesce(sum(coalesce(reported_cost_usd,estimated_cost_usd)),0) AS cost_usd,
 sum(estimated_cache_savings_usd) AS estimated_cache_savings_usd,
 count(*) FILTER(WHERE status='error')::DOUBLE/nullif(count(*),0) AS error_rate,
 count(*) FILTER(WHERE usage_available)::DOUBLE AS usage_request_count`;
const metrics: Record<string, string> = {
  input: "uncached_input_tokens",
  uncached_input: "uncached_input_tokens",
  output: "output_tokens",
  reasoning: "reasoning_tokens",
  cache_read: "cache_read_tokens",
  cache_write: "cache_write_tokens",
  total_input: "uncached_input_tokens+cache_read_tokens+cache_write_tokens",
  non_cache_total: "uncached_input_tokens+output_tokens+reasoning_tokens",
};
function where(filters: RequestFilters = {}) {
  const clauses: string[] = [],
    params: DuckDBValue[] = [];
  for (const [key, column, operator] of [
    ["from", "started_at", ">="],
    ["to", "started_at", "<"],
    ["project", "project_id", "="],
    ["session", "session_id", "="],
    ["provider", "provider", "="],
    ["model", "model", "="],
    ["kind", "kind", "="],
    ["status", "status", "="],
  ] as const) {
    const value = filters[key];
    if (value === undefined || value === "") continue;
    if ((key === "from" || key === "to") && !Number.isFinite(Date.parse(value)))
      throw new Error("Invalid date filter");
    clauses.push(`${column} ${operator} ?`);
    params.push(value);
  }
  if (filters.hideAuxiliary) clauses.push("kind='primary'");
  if (filters.search) {
    clauses.push(
      "id IN (SELECT request_id FROM message_parts WHERE contains(lower(coalesce(text,'')||coalesce(payload::JSON::VARCHAR,'')),lower(?)))",
    );
    params.push(filters.search);
  }
  if (filters.metric) {
    if (!metrics[filters.metric]) throw new Error("Invalid metric");
    clauses.push(`(${metrics[filters.metric]})>0`);
  }
  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}
const json = (value: unknown) => JSON.stringify(sanitize(value)) ?? "null";
function decodePayload(row: Record<string, unknown>) {
  for (const key of [
    "payload",
    "request_payload",
    "response_payload",
    "input",
    "output",
  ])
    if (typeof row[key] === "string") {
      try {
        row[key] = JSON.parse(row[key]);
      } catch {
        /* Non-JSON scalar stays visible. */
      }
    }
  return row;
}
export function presetRange(
  preset: "today" | "7d" | "30d" | "month",
  now = new Date(),
): RequestFilters {
  const from = new Date(now);
  from.setUTCHours(0, 0, 0, 0);
  if (preset === "7d") from.setUTCDate(from.getUTCDate() - 6);
  if (preset === "30d") from.setUTCDate(from.getUTCDate() - 29);
  if (preset === "month") from.setUTCDate(1);
  return { from: from.toISOString(), to: now.toISOString() };
}
export class Repository {
  constructor(public readonly db: Database) {}
  async saveRequest(request: RequestRecord, parts: MessagePart[]) {
    await this.db.transaction(async (tx) => {
      const columns = Object.keys(request);
      const payloads = new Set(["request_payload", "response_payload"]);
      const values = columns.map((key) =>
        payloads.has(key)
          ? json(request[key as keyof RequestRecord])
          : request[key as keyof RequestRecord],
      ) as DuckDBValue[];
      await tx.run(
        `INSERT INTO requests (${columns.join(",")}) VALUES (${columns.map((key) => (payloads.has(key) ? "CAST(? AS JSON)::VARIANT" : "?")).join(",")}) ON CONFLICT(id) DO UPDATE SET ${columns
          .filter((k) => k !== "id")
          .map((k) => `${k}=excluded.${k}`)
          .join(",")}`,
        values,
      );
      await tx.run("DELETE FROM message_parts WHERE request_id=?", [
        request.id,
      ]);
      for (const part of parts) {
        const keys = Object.keys(part);
        await tx.run(
          `INSERT INTO message_parts (${keys.join(",")}) VALUES (${keys.map((k) => (k === "payload" ? "CAST(? AS JSON)::VARIANT" : "?")).join(",")})`,
          keys.map((k) =>
            k === "payload" ? json(part.payload) : part[k as keyof MessagePart],
          ) as DuckDBValue[],
        );
      }
    });
  }
  async upsertTool(event: {
    request_id: string;
    session_id: string;
    tool_call_id: string;
    tool_name?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    status?: string;
    input?: unknown;
    output?: unknown;
    error?: string | null;
  }) {
    await this.db.run(
      `INSERT INTO tool_events VALUES (?,?,?,?,?,?,?,CAST(? AS JSON)::VARIANT,CAST(? AS JSON)::VARIANT,?)
      ON CONFLICT(request_id,tool_call_id) DO UPDATE SET tool_name=coalesce(excluded.tool_name,tool_events.tool_name),
      started_at=coalesce(tool_events.started_at,excluded.started_at), completed_at=coalesce(excluded.completed_at,tool_events.completed_at),
      status=coalesce(excluded.status,tool_events.status),input=CASE WHEN ? THEN excluded.input ELSE tool_events.input END,
      output=CASE WHEN ? THEN excluded.output ELSE tool_events.output END,error=coalesce(excluded.error,tool_events.error)`,
      [
        event.request_id,
        event.session_id,
        event.tool_call_id,
        event.tool_name ?? null,
        event.started_at ?? null,
        event.completed_at ?? null,
        event.status ?? null,
        json(event.input),
        json(event.output),
        event.error ?? null,
        event.input !== undefined,
        event.output !== undefined,
      ],
    );
  }
  async upsertBlob(blob: {
    blob_id: string;
    sha256: string;
    mime_type: string;
    byte_size: number;
    relative_path: string;
  }) {
    if (
      !/^[a-f0-9]{64}$/.test(blob.sha256) ||
      blob.relative_path.includes("..") ||
      /^[\\/]|:/.test(blob.relative_path) ||
      blob.byte_size < 0
    )
      throw new Error("Invalid blob metadata");
    await this.db.run(
      "INSERT INTO blobs(blob_id,sha256,mime_type,byte_size,relative_path) VALUES (?,?,?,?,?) ON CONFLICT(blob_id) DO UPDATE SET mime_type=excluded.mime_type",
      [
        blob.blob_id,
        blob.sha256,
        blob.mime_type,
        blob.byte_size,
        blob.relative_path,
      ],
    );
  }
  async price(
    provider: string,
    model: string,
    at: string,
  ): Promise<Price | null> {
    return (
      ((
        await this.db.query(
          "SELECT * FROM model_prices WHERE provider=? AND model=? AND effective_from<=? AND (effective_to IS NULL OR effective_to>?) ORDER BY effective_from DESC LIMIT 1",
          [provider, model, at, at],
        )
      )[0] as unknown as Price) ?? null
    );
  }
  async cost(request: RequestRecord, usage: Usage) {
    return estimateCost(
      usage,
      await this.price(request.provider, request.model, request.started_at),
    );
  }
  async roleBreakdown(filters: RequestFilters = {}) {
    const f = where(filters);
    return this.db.query(
      `SELECT role,part_type,direction,sum(estimated_tokens)::DOUBLE AS estimated_tokens,sum(char_count)::DOUBLE AS char_count,true AS estimated FROM message_parts WHERE request_id IN (SELECT id FROM requests ${f.sql}) GROUP BY role,part_type,direction ORDER BY direction,role,part_type`,
      f.params,
    );
  }
  async overview(filters: RequestFilters = {}): Promise<
    Record<string, unknown> & {
      daily: Record<string, unknown>[];
      hourly: Record<string, unknown>[];
      provider_model_share: Record<string, unknown>[];
      role_breakdown: Record<string, unknown>[];
    }
  > {
    const f = where(filters);
    const [totals, daily, hourly, share, roles] = await Promise.all([
      this.db.query(`SELECT ${sums} FROM requests ${f.sql}`, f.params),
      this.series("day", filters),
      this.hourly(filters),
      this.db.query(
        `SELECT provider,model,${sums} FROM requests ${f.sql} GROUP BY provider,model ORDER BY cost_usd DESC`,
        f.params,
      ),
      this.roleBreakdown(filters),
    ]);
    return {
      ...totals[0],
      daily,
      hourly,
      provider_model_share: share,
      role_breakdown: roles,
    };
  }
  private async series(
    unit: "day" | "hour",
    filters: RequestFilters = {},
  ): Promise<
    (Record<string, unknown> & { role_breakdown: Record<string, unknown>[] })[]
  > {
    const f = where(filters);
    const [rows, roles] = await Promise.all([
      this.db.query(
        `SELECT date_trunc('${unit}',started_at) AS bucket,${sums} FROM requests ${f.sql} GROUP BY bucket ORDER BY bucket`,
        f.params,
      ),
      this.db.query(
        `SELECT date_trunc('${unit}',r.started_at) AS bucket,p.role,p.part_type,p.direction,sum(p.estimated_tokens)::DOUBLE AS estimated_tokens,true AS estimated FROM message_parts p JOIN (SELECT * FROM requests ${f.sql}) r ON r.id=p.request_id GROUP BY bucket,p.role,p.part_type,p.direction ORDER BY bucket`,
        f.params,
      ),
    ]);
    return rows.map((row) => ({
      ...row,
      role_breakdown: roles.filter((role) => role.bucket === row.bucket),
    }));
  }
  hourly(filters: RequestFilters = {}) {
    return this.series("hour", filters);
  }
  async sessions(filters: RequestFilters = {}) {
    const f = where(filters);
    const limit = Math.min(500, Math.max(1, Math.trunc(filters.limit ?? 50))),
      offset = Math.max(0, Math.trunc(filters.offset ?? 0));
    const [rows, count, roles] = await Promise.all([
      this.db.query(
        `SELECT session_id,min(started_at) AS started_at,max(coalesce(completed_at,started_at)) AS completed_at,${sums} FROM requests ${f.sql} GROUP BY session_id ORDER BY started_at DESC LIMIT ? OFFSET ?`,
        [...f.params, limit, offset],
      ),
      this.db.query(
        `SELECT count(DISTINCT session_id)::DOUBLE AS total FROM requests ${f.sql}`,
        f.params,
      ),
      this.db.query(
        `SELECT r.session_id,p.role,p.part_type,p.direction,sum(p.estimated_tokens)::DOUBLE AS estimated_tokens,true AS estimated FROM message_parts p JOIN (SELECT * FROM requests ${f.sql}) r ON p.request_id=r.id GROUP BY r.session_id,p.role,p.part_type,p.direction`,
        f.params,
      ),
    ]);
    return {
      items: rows.map((r) => ({
        ...r,
        role_breakdown: roles.filter((p) => p.session_id === r.session_id),
      })),
      total: count[0].total,
      limit,
      offset,
    };
  }
  async session(
    id: string,
    filters: RequestFilters = {},
  ): Promise<Record<string, unknown>> {
    return {
      session_id: id,
      ...(await this.overview({ ...filters, session: id })),
      requests: await this.listRequests({ ...filters, session: id }),
    };
  }
  async listRequests(filters: RequestFilters = {}) {
    const f = where(filters),
      limit = Math.min(500, Math.max(1, Math.trunc(filters.limit ?? 50))),
      offset = Math.max(0, Math.trunc(filters.offset ?? 0));
    if (!Number.isFinite(limit) || !Number.isFinite(offset))
      throw new Error("Invalid pagination");
    const [items, count] = await Promise.all([
      this.db.query(
        `SELECT * EXCLUDE(request_payload,response_payload),uncached_input_tokens+cache_read_tokens AS input_plus_cache_read_tokens,uncached_input_tokens+cache_read_tokens+cache_write_tokens AS total_input_tokens,uncached_input_tokens+output_tokens+reasoning_tokens AS non_cache_tokens,coalesce(cache_read_tokens::DOUBLE/nullif(uncached_input_tokens+cache_read_tokens,0),0) AS cache_hit_ratio FROM requests ${f.sql} ORDER BY started_at DESC,id LIMIT ? OFFSET ?`,
        [...f.params, limit, offset],
      ),
      this.db.query(
        `SELECT count(*)::DOUBLE AS total FROM requests ${f.sql}`,
        f.params,
      ),
    ]);
    return { items, total: count[0].total, limit, offset };
  }
  async request(id: string): Promise<
    | (Record<string, unknown> & {
        message_parts: Record<string, unknown>[];
        tool_events: Record<string, unknown>[];
        role_breakdown: Record<string, unknown>[];
      })
    | null
  > {
    const request = await this.db.query(
      "SELECT * EXCLUDE(request_payload,response_payload),request_payload::JSON AS request_payload,response_payload::JSON AS response_payload,uncached_input_tokens+cache_read_tokens AS input_plus_cache_read_tokens,uncached_input_tokens+cache_read_tokens+cache_write_tokens AS total_input_tokens,uncached_input_tokens+output_tokens+reasoning_tokens AS non_cache_tokens,coalesce(cache_read_tokens::DOUBLE/nullif(uncached_input_tokens+cache_read_tokens,0),0) AS cache_hit_ratio FROM requests WHERE id=?",
      [id],
    );
    if (!request.length) return null;
    const [parts, tools, roles] = await Promise.all([
      this.db.query(
        "SELECT * EXCLUDE(payload),payload::JSON AS payload FROM message_parts WHERE request_id=? ORDER BY message_index,part_index",
        [id],
      ),
      this.db.query(
        "SELECT * EXCLUDE(input,output),input::JSON AS input,output::JSON AS output FROM tool_events WHERE request_id=? ORDER BY started_at,tool_call_id",
        [id],
      ),
      this.db.query(
        "SELECT role,part_type,direction,sum(estimated_tokens)::DOUBLE AS estimated_tokens,true AS estimated FROM message_parts WHERE request_id=? GROUP BY role,part_type,direction",
        [id],
      ),
    ]);
    return {
      ...decodePayload(request[0]),
      message_parts: parts.map(decodePayload),
      tool_events: tools.map(decodePayload),
      role_breakdown: roles,
    };
  }
  private async deleteWhere(filters: RequestFilters) {
    const f = where(filters);
    await this.db.transaction(async (tx) => {
      for (const table of ["message_parts", "tool_events"])
        await tx.run(
          `DELETE FROM ${table} WHERE request_id IN (SELECT id FROM requests ${f.sql})`,
          f.params,
        );
      await tx.run(`DELETE FROM requests ${f.sql}`, f.params);
      await tx.run(
        "DELETE FROM blobs WHERE blob_id NOT IN (SELECT blob_id FROM message_parts WHERE blob_id IS NOT NULL)",
      );
    });
  }
  async deleteRequest(id: string) {
    await this.db.transaction(async (tx) => {
      await tx.run("DELETE FROM message_parts WHERE request_id=?", [id]);
      await tx.run("DELETE FROM tool_events WHERE request_id=?", [id]);
      await tx.run("DELETE FROM requests WHERE id=?", [id]);
    });
  }
  deleteSession(id: string) {
    return this.deleteWhere({ session: id });
  }
  deleteAll() {
    return this.deleteWhere({});
  }
  deleteOlderThanDays(days: number) {
    if (!Number.isInteger(days) || days < 1)
      throw new Error("Invalid retention");
    return this.deleteWhere({
      to: new Date(Date.now() - days * 86400000).toISOString(),
    });
  }
  async exportJSON(
    filters: RequestFilters = {},
    format: "json" | "jsonl" = "json",
  ) {
    // shortcut: JSON exports materialize the selection; use Parquet for large histories until streaming export is needed.
    const f = where(filters),
      records = await this.db.query(
        `SELECT id FROM requests ${f.sql} ORDER BY started_at,id`,
        f.params,
      );
    const details = [];
    for (const row of records) details.push(await this.request(String(row.id)));
    return format === "jsonl"
      ? details.map((r) => JSON.stringify(r)).join("\n") +
          (details.length ? "\n" : "")
      : JSON.stringify(details);
  }
  async exportParquet(path: string, filters: RequestFilters = {}) {
    const f = where(filters);
    // COPY parameterizes both selection and destination; destination is caller-owned, never raw SQL.
    await this.db.run(
      `COPY (SELECT * EXCLUDE(request_payload,response_payload),request_payload::JSON AS request_payload,response_payload::JSON AS response_payload FROM requests ${f.sql}) TO ? (FORMAT PARQUET)`,
      [...f.params, path],
    );
  }
  async exportToFile(
    path: string,
    format: "json" | "jsonl" | "parquet",
    filters: RequestFilters = {},
  ) {
    if (format === "parquet") return this.exportParquet(path, filters);
    await writeFile(path, await this.exportJSON(filters, format), {
      flag: "wx",
    });
  }
}
