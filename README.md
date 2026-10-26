# OpenCode Usage Dashboard

A local-first **OpenCode v2 server plugin**: see exactly which logical context was
sent to a model, inspect ordered system/user/assistant/reasoning/tool parts, and
monitor tokens, cache usage, latency and costs by request, **hour** and **session**.

The plugin owns a **DuckDB 2.0** writer and a **127.0.0.1 Web UI/API inside the same
OpenCode process**. No proxy, external telemetry service, CDN, account, cloud
database or background collector is required. Capture failure never fails an
OpenCode request.

## Development: explicit local plugin directory

Requirements: OpenCode **v2**, Bun, and a platform supported by the native
`@duckdb/node-api` binding. Tested with OpenCode **2.1.4**, local Bun **1.4.2** and
Neo client **2.0.0-r.1** (runtime engine **v2.0.0**) on Windows x64.

```sh
bun install
```

The checked-in project-root `opencode.jsonc` explicitly loads the directory:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["./plugin"],
}
```

Open OpenCode in this project, then visit **http://127.0.0.1:7331**. The plugin
also prints its listening URL in local server logs. `plugin/index.ts` is the V2
Promise entrypoint; **no build or `dist/` step is needed for development**. Do not
point `plugins` to a single built file or install the development copy globally.

OpenCode watches configured plugin directories and local imports. Source/config
edits reload the plugin; use **`/reload`** to force a refresh. Restarting a healthy
background service is unnecessary. `opencode service restart` is only a recovery
command for an unhealthy service. Source evidence and limitations are recorded in
[`docs/opencode-integration.md`](docs/opencode-integration.md).

The public V2 event wire envelope uses **`event.data`** (verified against the
checked-in generated client types). The entrypoint adapts it to the collector's
internal payload shape; it does not expect V1-style `event.properties` on the wire.

### Configuration

Use the object form when overriding defaults:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "./plugin",
      "options": {
        "enabled": true,
        "host": "127.0.0.1",
        "port": 7331,
        "dataDir": "D:/private/opencode-inspector",
        "capture": {
          "messages": true,
          "toolResults": true,
          "reasoning": true,
          "images": "metadata",
          "rawProviderBodies": false,
        },
        "retention": { "days": 90 },
        "privacy": { "maxPayloadBytes": 2097152 },
      },
    },
  ],
}
```

`dataDir` is optional. Only loopback is supported; other hosts are rejected.
`port: 0` chooses an ephemeral port for testing. Raw provider bodies and binary
image persistence are intentionally unsupported; images/files retain metadata.
Known secret headers are always redacted, regardless of configuration. Payloads
and capture queues are bounded. If several project locations use the same
`dataDir` in one process, they share one writer/server; the first instance's
configuration owns that runtime until its final instance unloads. Separate
OpenCode **processes must use separate `dataDir` values**—embedded DuckDB is not
a multi-process writable store.

## Using the dashboard

- **Overview:** Today/month cost and tokens, request count, cache hit ratio,
  estimated cache savings and error rate; daily cost/token/request bars and
  provider/model cost share.
- **Time and filters:** Today, 7 days, 30 days, this month or custom UTC range;
  project, session, provider, model, kind, status and prompt/payload search.
  The end of a range is exclusive. Auxiliary requests are hidden by default.
- **Individual metrics:** uncached input, visible output, reasoning, cache read,
  cache write, gross input and non-cache total. Selecting a metric filters out
  requests with zero tokens in that bucket and changes the token charts.
- **Hourly / 시간당 단위:** hourly chart and table with all three token tiers,
  cost and expandable estimated role attribution.
- **Session / 세션 단위:** paginated aggregated sessions, timestamps, cost and
  role attribution. Click a session to filter the dashboard and open its detail.
- **Request inspector:** paginated requests and ordered role blocks. Tool
  definitions/results collapse; long payloads truncate with an expansion control.
  Copy a block or switch to structured JSON. Captured text is rendered as text,
  never executable HTML. `direction` separates historical input from new output.
- **Exports:** filtered JSON/JSONL includes request detail, parts and tool events;
  Parquet exports request-level analytical history through DuckDB. Downloads are
  local. JSON materializes the filtered selection; prefer Parquet for large
  histories. Temporary Parquet files are removed after streaming or cancellation.

### Three-tier token accounting · 3단 구조

OpenCode's finalized `input` means **uncached input**, and `output` excludes
separately reported reasoning. The dashboard does not double-count them:

| Tier / metric                             | Calculation                                                         |
| ----------------------------------------- | ------------------------------------------------------------------- |
| **1. Gross input / 총 입력**              | uncached input + cache read + cache write                           |
| Input + cache read                        | uncached input + cache read                                         |
| **2. Cache usage / 캐시 사용량**          | cache read and cache write, separately                              |
| Cache hit ratio                           | cache read / (uncached input + cache read); 0 for empty denominator |
| **3. Non-cache input / 캐시 미포함 입력** | uncached input only                                                 |
| Non-cache total / 순수 사용량             | uncached input + visible output + reasoning                         |
| All tokens                                | gross input + visible output + reasoning                            |

Request-level counts come from OpenCode/provider usage. **Part/role attribution
is always estimated**, using character weights scaled independently against gross
input, visible output and reasoning totals when available. Tool results generated
locally are not counted as model output; when replayed in a later context, they
belong to that request's input. An image's character weight is not a vision
tokenizer. No exact per-message cache hit/miss claim is made. `usage_available`
distinguishes absent finalized usage from a reported zero.

### Costs: accounted versus estimated

- **OpenCode-accounted** (`reported_cost_usd`, `cost_source: "opencode"`) uses
  finalized OpenCode costs, including an authoritative zero. OpenCode can itself
  fall back to its catalog, so these values are **not guaranteed provider-billed**.
- **Local estimated** (`estimated_cost_usd`) uses offline prices effective at
  request start, with separate input/output/cache-read/cache-write prices.
  Visible output and reasoning use the output price. Unknown prices stay unknown.
- Overview cost prefers OpenCode-accounted cost, then the local estimate; missing
  costs are excluded. Offline prices are reference estimates, **not live quotes**.
- Estimated cache savings compare cache-read price against ordinary input price.
  They exclude cache storage charges or provider-specific subscription economics.

Historical costs are stored on each request. Adding a new price period does not
reprice history. Review `model_prices` before relying on estimates for billing.

## Storage, privacy and deletion

Default generated-state location (never inside this repository):

- Windows: `%LOCALAPPDATA%/opencode-request-inspector`
- macOS/Linux: `$XDG_DATA_HOME/opencode-request-inspector`, or
  `~/.local/share/opencode-request-inspector` when unset

The directory contains `observability.duckdb`; DuckDB may create its WAL alongside
it. The plugin does not open OpenCode's private SQLite schema or modify upstream
source. Do not open the live DB from a second writer process. Use the local API or
exports while OpenCode is active; stop/unload the owning plugin before offline SQL.

**Prompts and responses can contain private code and personal information.**
Known authorization/API-key/cookie/provider-credential fields and common secret
patterns are redacted before persistence, but arbitrary secrets pasted into prose
cannot be guaranteed detectable. Protect the data directory and exports with your
OS permissions/encryption. No environment-variable snapshot or arbitrary
filesystem crawl is captured, and the plugin sends no telemetry.

Use **Delete selected request**, **Delete filtered session**, or **Delete all local
data** in the UI. Confirmation is required. Deletion is serialized with queued
writes and removes matching active correlation state so later completion events
cannot resurrect deleted requests; genuinely new requests can still be recorded.
The default retention period is **90 days**, applied at startup and daily. The UI
can also run retention immediately with a chosen day count. Exports you downloaded
are separate copies and are not deleted by retention. To remove the DB file itself,
disable/unload the plugin first, then remove its data directory.

The local server intentionally has no login. It rejects foreign Host/Origin
requests and cross-site browser requests; it does not enable CORS. It is not
designed for remote binding, reverse proxies or untrusted local users.

## Small JSON API

| Method | Path                                      | Purpose                                                                       |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------------- |
| GET    | `/api/health`                             | status, DuckDB version, data directory                                        |
| GET    | `/api/overview`                           | filtered totals, daily/hourly/provider/role data, fixed today/month snapshots |
| GET    | `/api/hourly`                             | hourly three-tier metrics and role estimates                                  |
| GET    | `/api/sessions`, `/api/sessions/:id`      | paginated sessions and session detail                                         |
| GET    | `/api/requests`, `/api/requests/:id`      | paginated requests and ordered detail                                         |
| GET    | `/api/export?format=json\|jsonl\|parquet` | filtered local download                                                       |
| POST   | `/api/retention`                          | JSON body `{ "days": 90 }`                                                    |
| DELETE | `/api/data?all=true`                      | all captured data                                                             |
| DELETE | `/api/data?session=...` or `?request=...` | selected session/request                                                      |

Read routes accept `preset=today|7d|30d|month` or `from`/`to`, plus `project`,
`session`, `provider`, `model`, `kind`, `status`, `hideAuxiliary`, `search`, `metric`,
`limit` (1–500) and `offset`. A metric selects requests with nonzero usage, rather
than replacing their stored usage totals. Example:

```sh
curl 'http://127.0.0.1:7331/api/requests?preset=7d&hideAuxiliary=true&metric=cache_read&limit=25'
```

## Tests and real OpenCode smoke

```sh
bun test
bun run typecheck
bun run format
```

`bunfig.toml` confines tests to this project, not `reference/`. The normal suite
tests real DuckDB open/migrate/rollback/reopen, part order and unknown variants,
token/cache math, costs, redaction/size caps, SQL filters and aggregates, HTTP API,
exports, coordinated deletion, localhost security, lifecycle cleanup and failure
isolation. The opt-in smoke starts a **private** CLI `serve --stdio` process with
temporary XDG directories, validates the real project `plugins: ["./plugin"]`
entry, waits for an active plugin and checks its DuckDB health endpoint. It does
not restart or replace your managed service and makes no model request:

```sh
OPENCODE_SMOKE=1 OPENCODE_BIN=/path/to/opencode bun test ./tests/opencode-smoke.test.ts
```

PowerShell:

```powershell
$env:OPENCODE_SMOKE = '1'
$env:OPENCODE_BIN = 'C:/path/to/opencode.exe'
bun test ./tests/opencode-smoke.test.ts
Remove-Item Env:OPENCODE_SMOKE, Env:OPENCODE_BIN
```

On Windows, point `OPENCODE_BIN` to the actual executable, not the PowerShell npm
shim. The smoke requires port **7331** to be free and deletes its own temporary
data after graceful stdin-close shutdown. Verified on OpenCode **2.1.4** with
engine **v2.0.0**. A real Chromium check also verified initial cards, literal
rendering of a script-shaped prompt (no execution), ordered inspector blocks,
session drill-down and token-metric controls.

## Installation / release status

This is an **unpublished development plugin**; there is no published npm install
command yet. The intended release is a normal installable npm/Git plugin package,
configured through `plugins: ["<published-package>"]`, not a loose `dist.js`.
The release must include its entrypoint, `@duckdb/node-api` native dependency,
offline prices/migrations and self-contained UI. A release build may compile TS
to JS, but must preserve migration asset resolution and leave native DuckDB
binaries external to the JS bundle. Users should not need to clone the repo once
a release package exists. Test the packaged artifact in OpenCode before publishing.

Optional manual global installation is secondary. Preserve the source layout in
a package directory, for example:

```text
~/.config/opencode/plugins/opencode-usage-dashboard/
├── index.ts                 # export { default } from "./plugin/index.ts"
├── plugin/                  # this repo's plugin/ plus installed dependencies
└── migrations/              # this repo's migrations/
```

Run `bun install` in that copied `plugin/` directory. Keep the wrapper and
migrations: copying only `plugin/index.ts` or a single `dist.js` cannot work.
Avoid loading both the explicit project copy and a global development copy.
Project `.opencode/plugins/` auto-discovery is supported by OpenCode, but is not
this repository's canonical development workflow.

## Troubleshooting and known limits

- **No UI:** inspect local server logs; a busy port disables only the HTTP UI,
  not capture. Choose another port and `/reload`.
- **No capture:** verify OpenCode v2 and the directory config entry. A DB/native
  load/migration failure emits one concise diagnostic and leaves OpenCode running.
  Check writable storage and native platform support; never silently downgrade
  DuckDB. Invalid options disable this plugin rather than the agent.
- **DuckDB file locked:** another process may own the same `dataDir`; use separate
  directories or stop that owner. Do not delete its active WAL.
- **Incomplete requests:** shutdown, queue/payload limits, ambiguous correlation
  or lack of a finalized public event can leave a request incomplete. Partial
  data is not a fabricated successful response or zero usage.
- **Auxiliary coverage:** title/compaction usage can be correlated only when a
  unique pending session/kind exists. Transient generate has no guaranteed public
  finalized usage event. Compaction appends a summary prompt after its hook.
  Hook snapshots are logical contexts, not byte-exact lowered provider requests.
- **WebSockets:** native context and durable usage capture work independently of
  HTTP transport. Raw HTTP coverage is not claimed for WebSocket providers.
- **Migrations:** an explicit schema ledger and transaction protect failed schema
  updates. Back up the closed DB before future destructive upgrades. DuckDB 2.0
  VARIANT/storage may not be readable by older engines; export JSON/Parquet before
  changing major versions. No downgrade or private OpenCode DB integration exists.

Non-goals include tracing backends, OTEL, proxies, remote ingestion, multi-user
accounts, cloud sync, provider routing and replay. This is a small local inspector.
