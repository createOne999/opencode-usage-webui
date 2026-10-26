# AGENTS.md

## Project Mission

Build a lightweight, local-first observability plugin for **OpenCode v2**.

The product should feel like:

- **llm.log** for dashboard, usage, and cost overview.
- **llm-meter** for request-level inspection and cache detail.
- **OpenRouter's request inspector** for clearly separated `system`, `user`, `assistant`, `tool call`, `tool result`, reasoning, and image parts.

The implementation must be native to OpenCode v2, persist data in **DuckDB 2.0.x**, and expose a **local Web UI**.

This is intentionally **not** a general observability platform. Do not introduce OpenTelemetry, Phoenix, Langfuse, ClickHouse, PostgreSQL, Redis, a MITM proxy, or a separate telemetry service.

---

## Non-Negotiable Product Constraints

1. **OpenCode v2 only.**
2. **DuckDB 2.0.x is the persistent store.**
3. Use the official **DuckDB Node.js (Neo) client** (`@duckdb/node-api`) if it works correctly in the actual OpenCode/Bun runtime.
4. No OTEL and no tracing backend.
5. No HTTP MITM proxy and no custom CA.
6. No cloud service is required to use the product.
7. No telemetry leaves the machine.
8. The Web UI binds to `127.0.0.1` by default.
9. Logging must never break or materially slow the OpenCode agent loop.
10. Secrets such as `Authorization`, API keys, cookies, bearer tokens, and provider credentials must never be persisted.
11. `reference/` is read-only reference material. Never modify it.
12. Do not depend on OpenCode's private SQLite schema as the primary integration surface. Prefer the v2 plugin API/hooks/events discovered in the checked-in OpenCode source.
13. This project is an **OpenCode v2 server plugin**, not an MCP server, CLI-only plugin, proxy, or standalone daemon.
14. During development, load the plugin **explicitly from the project-root `opencode.jsonc`** with a local directory entry such as `"./plugin"`.
15. The configured V2 local plugin path must be a **directory**, not a single built file.
16. Do not make `~/.config/opencode/plugins/` the primary development workflow. Reserve it for optional global/local installation after the plugin works.
17. The preferred release/distribution target is a normal installable plugin package (for example npm/Git package), not a manually copied single `dist.js`.
18. The plugin owns the DuckDB writer and the localhost Web UI/API in the **same OpenCode process**.

---

# Plugin Form, Loading, and Distribution

This section is authoritative for how the project should be developed and packaged.

## Plugin Type

Implement an **OpenCode v2 server plugin** using the V2 plugin API found in `reference/opencode/`.

The plugin is responsible for all of the following:

```text
OpenCode v2 process
├── request/context capture hooks
├── completion/usage/event capture
├── DuckDB 2.0.x connection + writer
└── localhost Web/API server
```

Do not create a separate always-on collector or observability daemon.

This is **not** an MCP server. MCP may be used by OpenCode for unrelated tools, but this observability project should integrate directly through the native V2 plugin system.

## Development Loading Strategy — REQUIRED

The repository root should contain an `opencode.jsonc` that explicitly loads the local plugin directory:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "./plugin"
  ]
}
```

Important V2 rules:

- Use the V2 key **`plugins`** (plural).
- `./plugin` is resolved relative to the config file containing the entry.
- A configured local path must be a **directory**.
- The plugin directory should expose the V2 plugin entry module expected by the checked-in OpenCode source, normally `index.ts` during development.
- Do not point `plugins` directly at `./dist/index.js`.
- Do not depend on project auto-discovery under `.opencode/plugins/` for the main development workflow.
- Do not install the development copy globally under `~/.config/opencode/plugins/`.

The desired development loop is:

```text
edit plugin TypeScript
        │
        ▼
project opencode.jsonc
  plugins: ["./plugin"]
        │
        ▼
OpenCode loads local plugin directory
        │
        ▼
real OpenCode smoke test
```

If the checked-in OpenCode source shows that a restart or service reload is required for changes outside watched config directories, document the exact command in the README.

## Recommended Repository Shape

The repository should prefer this shape:

```text
.
├── AGENTS.md
├── opencode.jsonc             # Explicitly loads "./plugin" during development
├── reference/
│   └── opencode/              # OpenCode v2 source; READ ONLY
├── plugin/
│   ├── index.ts               # V2 plugin entrypoint during development
│   ├── package.json           # Plugin/runtime dependencies as needed
│   └── src/
│       ├── capture/
│       ├── db/
│       ├── pricing/
│       ├── server/
│       ├── ui/
│       └── shared/
├── migrations/
├── tests/
└── README.md
```

The agent may adjust internal directories after source reconnaissance, but **`opencode.jsonc -> "./plugin"` should remain the development loading model unless the checked-in V2 source proves it invalid**.

## Release / Distribution Strategy

Treat development loading and end-user installation as separate concerns.

### Preferred final distribution: package plugin

The preferred end state is an installable OpenCode plugin package.

Conceptually:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "@scope/opencode-request-inspector"
  ]
}
```

The exact package name is not decided yet.

The release package should contain everything required for:

- the V2 plugin entrypoint;
- DuckDB runtime dependency;
- local Web UI assets;
- migrations;
- pricing data needed offline.

Do not require users to clone the source repository.

If OpenCode's current V2 package installation supports npm/Git plugin packages as documented in the checked-in source, prefer that mechanism for release.

### Secondary distribution: global local-plugin directory

For local/manual installation, the plugin may also support placement under the OpenCode global plugin discovery directory, conceptually:

```text
~/.config/opencode/plugins/
└── request-inspector/
    ├── index.js
    ├── package.json
    └── ui/
```

This is a **secondary installation method**, useful for unpublished builds or local testing across many repositories.

Do not design the package around copying only one loose `dist.js` file into the global plugin directory. DuckDB native dependencies and UI assets make a package-directory installation more robust.

### Project-local auto-discovery

OpenCode V2 may auto-discover plugins under project `.opencode/plugins/`.

That mode is valid, but it is **not the canonical development setup for this repository**. The canonical setup is the explicit project `opencode.jsonc` entry so that:

- loading is visible in source control;
- the plugin source can live in a normal top-level `plugin/` package;
- the development shape resembles eventual package distribution;
- the project does not conflate product source with user configuration files.

## Build / `dist` Policy

During development:

- Prefer loading `plugin/index.ts` directly if the actual OpenCode runtime supports it.
- Do not require a build step merely to test each change.
- Keep the local-development path close to the source.

For release:

- A `dist/` directory is allowed and likely desirable.
- The package may compile/bundle TypeScript and frontend assets.
- The final package entry may point to `dist/index.js`.
- However, OpenCode should load the **package/directory**, not a manually configured single-file path.
- Verify that DuckDB's native module is packaged/resolved correctly; do not blindly bundle native binaries into JavaScript.

The build system should optimize for reliable plugin installation, not for producing one giant bundled file.

---

## Repository Layout

Use the **Recommended Repository Shape** above as the default.

Architectural boundaries remain important even if the agent changes internal folders:

- plugin entrypoint / OpenCode integration
- capture + normalization
- DuckDB persistence/migrations
- pricing/cost logic
- localhost server/API
- Web UI
- shared types/utilities

Keep OpenCode reference source isolated under `reference/opencode/` and read-only.

---

# FIRST TASK: Inspect OpenCode Before Writing Product Code

Do **not** begin implementation by guessing OpenCode APIs from memory.

Before adding dependencies or product code:

1. Confirm that `reference/opencode/` exists.
2. Identify the exact OpenCode version/commit from the source.
3. Read the v2 plugin implementation, loader, package/discovery logic, and type definitions.
4. Confirm from source:
   - the project `opencode.jsonc` V2 config key for plugins;
   - how configured local plugin directories are resolved;
   - expected local directory entry module (`server`, `index`, or other);
   - whether TypeScript is loaded directly in development;
   - package-plugin installation/cache behavior;
   - project and global plugin discovery directories;
   - reload/restart behavior for local plugin source changes.
5. Locate and document the exact types and lifecycle for:
   - plugin `setup`
   - `ctx.session.hook("context", ...)`
   - `ctx.session.hook("model.request", ...)`
   - `ctx.session.hook("http.request", ...)`
   - `ctx.session.hook("http.response", ...)`
   - session/event subscriptions
   - assistant message completion
   - token usage
   - cache read/write token accounting
   - model/provider identity
   - tool calls/results
   - reasoning parts
   - image/file parts
   - compaction/title/generate request kinds
6. Determine whether any providers in the current OpenCode source use WebSockets in a way that bypasses HTTP request/response hooks.
7. Determine the stable correlation identifiers available between:
   - context assembly
   - provider request
   - assistant output
   - usage
   - tool calls
   - session
8. Write the findings to `docs/opencode-integration.md`.
9. Only then implement the integration.

Treat the checked-in source under `reference/opencode/` as the primary authority for OpenCode behavior.

Do not modify anything under `reference/`.

---

# Architecture

Target architecture:

```text
                         OpenCode v2
                              │
                    native plugin hooks/events
                              │
                 ┌────────────┴────────────┐
                 │                         │
          request/context              completion
             capture                  usage/events
                 │                         │
                 └────────────┬────────────┘
                              │
                         Normalizer
                              │
                              ▼
                  ┌─────────────────────┐
                  │   DuckDB 2.0.x      │
                  │                     │
                  │ requests            │
                  │ message_parts       │
                  │ tool_events         │
                  │ usage               │
                  │ pricing             │
                  │ blobs metadata      │
                  └──────────┬──────────┘
                             │
                 SAME PROCESS ONLY
                             │
                  ┌──────────▼──────────┐
                  │ localhost Web/API   │
                  │   127.0.0.1 only   │
                  └──────────┬──────────┘
                             │
                             ▼
                         Browser UI
```

## Important DuckDB Concurrency Rule

DuckDB's embedded read-write mode should have a **single owning process**.

Therefore:

- The OpenCode plugin process owns the writable DuckDB instance.
- The local Web/API server should run **inside the same process** and query the same DuckDB instance.
- Do **not** build a second UI process that directly opens the active DuckDB file while OpenCode is writing.
- If a future standalone UI is desired, it should query the plugin over HTTP or use an explicitly designed DuckDB 2.0 Quack/server mode. That is out of scope for v1.

The product should require no separate always-on daemon beyond OpenCode itself.

---

# Runtime and Dependency Strategy

OpenCode v2 runs plugins in its JavaScript/TypeScript runtime. Verify the exact runtime behavior from `reference/opencode/`.

During development, the plugin must be loadable through:

```text
project opencode.jsonc
        ↓
plugins: ["./plugin"]
        ↓
plugin/index.ts
```

Preferred stack:

- TypeScript
- Bun-compatible runtime
- `@duckdb/node-api` 2.0.x
- DuckDB engine 2.0.x
- Small embedded HTTP server
- Minimal frontend dependencies

Before committing to the DuckDB binding, create a tiny compatibility spike that proves all of the following **inside the same runtime family used by OpenCode**:

1. create/open a DuckDB file;
2. create a table;
3. insert parameterized values;
4. query aggregated rows;
5. close cleanly;
6. reopen successfully;
7. use DuckDB 2.0.x at runtime;
8. package/load alongside an OpenCode local plugin.

If the official Node.js client is incompatible with the actual OpenCode/Bun runtime, document the failure and choose the smallest maintainable alternative that still runs DuckDB **2.0.x**. Do not silently downgrade DuckDB.

---

# Capture Model

The logger should record **logical model requests**, not a generic distributed trace.

A request must be inspectable in a form similar to OpenRouter:

```text
REQUEST

Model / Provider / Session / Timestamp
Input / Output / Reasoning / Cache Read / Cache Write
Latency / Cost / Status

SYSTEM
  ...

SYSTEM · PROJECT INSTRUCTIONS
  ...

USER
  ...

ASSISTANT
  ...

TOOL CALL · read
  {...}

TOOL RESULT
  ...

IMAGE
  metadata / preview if locally available

REASONING
  ...
```

## Required content types

Normalize at least:

- system
- user
- assistant
- reasoning
- tool call
- tool result
- image
- file/attachment metadata
- unknown/future part type

Never throw away an unknown OpenCode part type. Store it as a typed raw/variant payload so future UI versions can render it.

---

# Capture Sources

Prefer stable OpenCode v2 integration points discovered in the local source.

### `context` hook

Use it to capture the **assembled logical request immediately before model dispatch**, including whatever the current source exposes for:

- system instructions
- conversation/messages
- tools/tool definitions
- model
- provider
- request kind
- agent
- session

This is the preferred source for the normalized request inspector.

### OpenCode events / finalized messages

Use OpenCode's finalized session/message/usage events where available for:

- assistant output
- reasoning output
- tool calls/results
- model usage
- cache usage
- request/session status
- errors/retries

Prefer finalized OpenCode accounting over reverse-engineering provider responses.

### `http.request` / `http.response`

Raw provider HTTP capture is **optional and OFF by default**.

Only use it when needed to expose fields unavailable from normalized OpenCode events.

If raw capture is implemented:

- clone one-shot bodies before reading;
- never alter provider behavior;
- strip secret headers before any persistence;
- never persist authorization headers;
- gate raw body persistence behind explicit config;
- set a payload-size limit.

### WebSocket providers

If the checked-in OpenCode source uses WebSocket provider transport, do not pretend HTTP hooks provide complete raw coverage.

Normalized request/message/usage capture must still work independently of raw HTTP logging.

---

# Correlation

Every logical model request needs a stable internal `request_id`.

Correlate as much as possible using real OpenCode identifiers discovered in the source.

Do not correlate solely by timestamp if a stronger identifier exists.

At minimum retain:

- `request_id`
- `session_id`
- OpenCode message/step IDs when available
- project identity/path hash
- provider
- model
- request kind
- agent
- start/end timestamps

Request kinds should distinguish at least:

- primary agent loop
- compaction
- title generation
- transient/generate requests

The UI should allow hiding auxiliary requests by default while still making them discoverable.

---

# DuckDB Data Model

Use migrations from day one.

Prefer normalized columns for frequently queried analytics and DuckDB `VARIANT` for flexible/raw structured payloads.

The exact schema may evolve after inspecting OpenCode types, but the conceptual model should include the following.

## `requests`

One row per logical model request.

Suggested fields:

```text
id                  UUID
session_id          VARCHAR
project_id          VARCHAR
agent               VARCHAR
kind                VARCHAR

provider            VARCHAR
model               VARCHAR

started_at          TIMESTAMPTZ
completed_at        TIMESTAMPTZ
latency_ms          BIGINT

status              VARCHAR
error_type          VARCHAR
error_message       VARCHAR

input_tokens        BIGINT
output_tokens       BIGINT
reasoning_tokens    BIGINT
cache_read_tokens   BIGINT
cache_write_tokens  BIGINT

reported_cost_usd   DOUBLE
estimated_cost_usd  DOUBLE
cost_source         VARCHAR

request_payload     VARIANT
response_payload    VARIANT

created_at          TIMESTAMPTZ
```

Do not force raw payloads into a rigid schema if doing so loses provider/OpenCode information.

## `message_parts`

Store request-visible parts in order.

Suggested fields:

```text
request_id
message_index
part_index
role
part_type
text
tool_name
tool_call_id
blob_id
payload VARIANT
```

Preserve ordering exactly.

## `tool_events`

Store normalized tool invocation/result metadata when useful for filtering.

Suggested fields:

```text
request_id
session_id
tool_call_id
tool_name
started_at
completed_at
status
input VARIANT
output VARIANT
error
```

Avoid duplicating large payloads unnecessarily if `message_parts` already stores them.

## `model_prices`

Pricing is time-sensitive.

Store prices with effective periods rather than one mutable row:

```text
provider
model
input_per_million
output_per_million
cache_read_per_million
cache_write_per_million
effective_from
effective_to
source
```

Past costs must not change merely because current model prices change.

## `blobs`

Large binary content should not live directly in the main analytical tables by default.

Store blobs content-addressed on disk, for example:

```text
~/.local/share/<project-name>/blobs/<sha256>
```

DuckDB stores only metadata:

```text
blob_id
sha256
mime_type
byte_size
relative_path
created_at
```

Image persistence should be configurable.

---

# Usage and Cost Rules

The dashboard must distinguish **reported** and **estimated** values.

Preferred source order:

1. finalized usage/cost reported by OpenCode, if the current OpenCode source provides it;
2. provider-reported usage exposed through OpenCode;
3. locally estimated cost using the versioned pricing table.

Never label an estimated cost as provider-reported.

Support at least:

- input tokens
- output tokens
- reasoning tokens
- cache-read tokens
- cache-write tokens
- total tokens
- actual/reported cost when available
- estimated cost
- cache hit ratio
- estimated cache savings when the pricing model supports it

Cache attribution at the **message level** must be labeled as an estimate unless the provider explicitly reports exact part-level cache attribution.

Provider-level cache token counts are authoritative only to the extent exposed by OpenCode/provider usage.

---

# Dashboard Requirements

The first screen should be useful in under 5 seconds.

## Overview

Show:

- Today cost
- This month cost
- Today tokens
- This month tokens
- Requests today
- Cache hit ratio
- Estimated cache savings
- Error rate

Include compact charts for:

- daily cost
- daily tokens
- request count
- cache-read vs uncached input
- provider/model cost share

Provide time presets:

- Today
- 7 days
- 30 days
- This month
- Custom range

## Requests List

Each row should expose at least:

- timestamp
- project/session
- request kind
- provider/model
- input tokens
- cache-read tokens
- output tokens
- cost
- latency
- status

Filters:

- time range
- project
- session
- provider
- model
- request kind
- status

Search should cover visible prompt/message text without requiring an external search service.

## Request Detail

This is a core feature, not an afterthought.

Display content as clearly separated visual blocks:

- SYSTEM
- USER
- ASSISTANT
- REASONING
- TOOL CALL
- TOOL RESULT
- IMAGE
- FILE/ATTACHMENT
- UNKNOWN

Also show:

```text
Input tokens
Output tokens
Reasoning tokens
Cache read
Cache write
Uncached input, when derivable
Cache hit ratio

Reported cost
Estimated cost
Latency
Provider
Model
Session
Request kind
```

Provide:

- normalized view
- raw/structured view when raw data exists
- collapsible tool definitions
- collapsible long tool results
- safe JSON pretty-printing
- copy buttons
- truncation controls for very large payloads

The UI should visually distinguish **cached token totals** from any **message-level cache estimate**.

---

# Local Web Server

The local HTTP server is part of the OpenCode plugin process.

Default behavior:

```text
host: 127.0.0.1
port: configurable
```

Requirements:

- Never bind `0.0.0.0` by default.
- Do not require authentication for loopback-only default use.
- If non-loopback binding is later supported, require explicit opt-in and authentication.
- Serve both the frontend and the JSON API.
- Keep API surface small.
- Use pagination for request lists.
- Do filtering/aggregation in DuckDB rather than loading all rows into JavaScript.
- Avoid an ORM unless it clearly reduces complexity.
- Use parameterized SQL.

A separate permanent server process is out of scope for v1.

---

# Storage Location

Do not write generated state into the source repository.

Choose a platform-appropriate user data directory, preferably consistent with OpenCode conventions discovered in `reference/opencode/`.

Conceptually:

```text
<user-data-dir>/<project-name>/
├── observability.duckdb
├── blobs/
└── logs/
```

Support an explicit path override in configuration.

Do not store the database inside `reference/`.

---

# Configuration

Keep configuration intentionally small.

Example shape; adapt to actual OpenCode plugin conventions after inspecting source:

```jsonc
{
  "enabled": true,
  "host": "127.0.0.1",
  "port": 7331,

  "capture": {
    "messages": true,
    "toolResults": true,
    "reasoning": true,
    "images": "metadata",
    "rawProviderBodies": false
  },

  "retention": {
    "days": 90
  },

  "privacy": {
    "redactHeaders": true,
    "maxPayloadBytes": 2097152
  }
}
```

Avoid a large configuration surface until there is a demonstrated need.

---

# Privacy and Security

This application intentionally stores prompts and model responses, which may contain source code and sensitive data.

Mandatory behavior:

- Never persist `Authorization`.
- Never persist API keys.
- Never persist cookies.
- Never persist provider credentials.
- Redact known secret-bearing headers before logging.
- Default to local-only networking.
- Do not send analytics or crash telemetry.
- Avoid storing environment variables.
- Do not recursively capture arbitrary filesystem content.
- Make raw provider body capture opt-in.
- Make image/blob persistence configurable.
- Add a clear "Delete data" path.
- Add retention cleanup.

When in doubt, store less.

---

# Performance Requirements

Observability must be best-effort and non-blocking from the agent's perspective.

The plugin must:

- never fail an OpenCode request because logging failed;
- avoid synchronous heavy analytics during model execution;
- keep hook work minimal;
- batch or queue writes when useful;
- bound queues and payload sizes;
- recover from malformed/unknown payloads;
- log internal errors locally without recursive capture;
- gracefully close DuckDB on plugin cleanup.

Prefer append-oriented writes.

Do dashboard aggregation only when the UI requests it.

---

# Failure Semantics

Logging is secondary to the coding agent.

If DuckDB cannot open, migrations fail, disk fills, or an event cannot be normalized:

1. do not break the OpenCode model request;
2. emit one concise local diagnostic;
3. disable or degrade the affected logging feature;
4. continue OpenCode operation.

No observability failure may change the model prompt, tool set, model selection, or provider request.

Hooks used for observation should not mutate OpenCode request behavior.

---

# Database Migrations

Maintain an explicit schema version.

Requirements:

- migrations are deterministic;
- migrations are tested against an empty DB;
- migrations are tested against at least the previous schema version once one exists;
- failed migrations do not corrupt the only copy of user data;
- DuckDB 2.0 storage compatibility implications are documented.

Do not build the project around ad-hoc `CREATE TABLE IF NOT EXISTS` statements scattered through runtime code.

---

# Retention and Export

Minimum v1 retention features:

- configurable retention in days;
- delete all local data;
- delete a selected session/request if feasible without excessive complexity.

Minimum v1 export:

- JSON/JSONL for selected requests;
- Parquet export for analytical history.

Use DuckDB's native analytical/export capabilities where appropriate.

---

# Explicit Non-Goals for v1

Do not implement these unless required to satisfy a core acceptance criterion:

- OpenTelemetry
- distributed tracing
- remote SaaS ingestion
- team accounts
- multi-user auth
- cloud sync
- PostgreSQL
- ClickHouse
- Redis
- external vector DB
- prompt management
- model gateway/proxy
- provider routing
- rate limiting
- agent evaluation framework
- full replay engine
- modifying OpenCode's own database
- reading OpenCode's private database as the primary capture mechanism
- multi-process direct access to the writable DuckDB file

Keep v1 small.

---

# Implementation Plan

## Phase 0 — Source Reconnaissance

Deliver:

- `docs/opencode-integration.md`
- exact OpenCode version/commit
- hook/event map
- message/part type map
- usage/cost source map
- correlation-ID strategy
- WebSocket/raw-HTTP coverage notes

No product code before this investigation is complete.

## Phase 1 — Runtime Spike

Prove:

- Project-root `opencode.jsonc` explicitly loads `./plugin`.
- OpenCode v2 loads the local plugin **directory** using the checked-in V2 loader semantics.
- Development can run from `plugin/index.ts` without a release build if supported by the checked-in runtime.
- DuckDB 2.0.x loads in the same runtime.
- Plugin opens a persistent DB.
- Plugin inserts and queries a test record.
- Same-process localhost HTTP handler can query the same DuckDB instance.
- Cleanup closes resources correctly.

Keep this spike tiny.

## Phase 2 — Capture + Persistence

Implement:

- migrations
- request lifecycle
- context normalization
- message parts
- usage/cache/cost fields
- error handling
- privacy redaction
- request/session correlation

At the end of this phase, SQL inspection of the DB should already be useful.

## Phase 3 — Local Web UI

Implement:

1. Overview dashboard
2. Requests list
3. Request detail inspector
4. Usage/cost analytics
5. Cache visualization
6. Filters/search

Prioritize clarity and density over decoration.

## Phase 4 — Retention / Export / Hardening

Implement:

- retention cleanup
- JSON/JSONL export
- Parquet export
- payload limits
- DB migration tests
- failure-mode tests
- large-session performance tests
- unknown content type test
- provider variation tests

## Phase 5 — Documentation

README must include:

- what the plugin does
- **development loading** via project `opencode.jsonc -> "./plugin"`
- **release installation** via package plugin when available
- optional global local-plugin-directory installation
- when a build/`dist` step is required vs not required
- OpenCode v2 compatibility
- DuckDB version
- storage location
- how to open the UI
- privacy implications
- how cost is calculated
- reported vs estimated values
- cache semantics
- data deletion
- troubleshooting

---

# Acceptance Criteria

The project is not complete until all of the following are demonstrably true.

### Integration

- [ ] Implemented as an OpenCode v2 **server plugin**.
- [ ] Project-root `opencode.jsonc` loads the development plugin via `plugins: ["./plugin"]` or the exact equivalent verified from the checked-in V2 source.
- [ ] The configured development plugin target is a directory, not a loose `dist.js` file.
- [ ] Development loading does not require installation under `~/.config/opencode/plugins/`.
- [ ] Uses plugin hooks/events confirmed against `reference/opencode/`.
- [ ] Does not modify OpenCode source.
- [ ] Does not depend on OpenCode's private DB schema for primary capture.
- [ ] Release packaging has a documented path to an installable package plugin.
- [ ] Optional global local installation, if supported, uses a plugin package directory rather than making single-file copying the canonical install.

### DuckDB

- [ ] Runtime engine is DuckDB 2.0.x.
- [ ] Persistent local DuckDB file is used.
- [ ] Schema migrations exist.
- [ ] OpenCode/plugin process is the single embedded DB owner while active.
- [ ] Dashboard queries run through the same owning process.

### Request Inspector

- [ ] System messages are visible separately.
- [ ] User messages are visible separately.
- [ ] Assistant messages are visible separately.
- [ ] Tool calls are visible separately.
- [ ] Tool results are visible separately.
- [ ] Reasoning is displayed when OpenCode exposes it.
- [ ] Images/files have a distinct representation.
- [ ] Unknown part types are preserved.
- [ ] Request kind is visible.
- [ ] Normalized request ordering matches what OpenCode sent.

### Usage

- [ ] Input tokens visible.
- [ ] Output tokens visible.
- [ ] Reasoning tokens visible when available.
- [ ] Cache-read tokens visible when available.
- [ ] Cache-write tokens visible when available.
- [ ] Cost visible and clearly marked reported vs estimated.
- [ ] Daily totals work.
- [ ] Monthly totals work.
- [ ] Provider/model breakdown works.
- [ ] Cache ratio works without presenting estimates as facts.

### UI

- [ ] Opens locally in a browser.
- [ ] Binds to loopback by default.
- [ ] Dashboard loads without an external service.
- [ ] Request list is paginated.
- [ ] Request detail is usable for very large coding-agent contexts.
- [ ] Long tool results are collapsible/truncated safely.
- [ ] No external CDN is required at runtime.

### Safety / Reliability

- [ ] Authorization/API key/cookie headers are never stored.
- [ ] Logging failure does not fail an OpenCode request.
- [ ] Raw provider body logging is off by default.
- [ ] Data can be deleted locally.
- [ ] Retention policy works.
- [ ] The plugin shuts down cleanly.

---

# Testing Priorities

Prioritize behavior tests over snapshot-heavy UI tests.

Must cover:

1. request normalization;
2. part ordering;
3. tool-call/result pairing;
4. unknown part preservation;
5. usage normalization;
6. cache accounting;
7. reported vs estimated cost;
8. secret redaction;
9. oversized payload handling;
10. DuckDB migration;
11. DuckDB restart/reopen;
12. API filtering/pagination;
13. daily/monthly aggregation;
14. logging failure does not alter the agent request;
15. localhost binding defaults;
16. plugin cleanup.

Use realistic fixtures derived from the **types/shapes** found in the local OpenCode source, but do not copy unnecessary upstream implementation code.

---

# UI Direction

The UI should be dense, fast, and developer-oriented.

Visual references:

- llm.log: overview and analytics density
- llm-meter: request detail and cache inspection
- OpenRouter: message-role separation and request readability

Prefer:

- neutral/dark-friendly palette;
- strong typographic hierarchy;
- compact tables;
- monospace for payloads/code;
- clear role badges;
- expandable structured JSON;
- sticky request metadata;
- minimal animation.

Avoid:

- marketing landing-page styling;
- large decorative cards;
- excessive charts;
- hiding raw data behind abstractions.

The primary job is answering:

> What exactly did OpenCode send to the model, what came back, how many tokens were consumed/cached, how long did it take, and how much did it cost?

---

# Engineering Rules

- Read existing code before changing it.
- Keep modules small and explicit.
- Prefer plain SQL over ORM abstractions.
- Prefer stable OpenCode APIs over internal imports.
- Keep the canonical development plugin at top-level `plugin/` and load it explicitly from project `opencode.jsonc`; do not relocate it into `.opencode/plugins/` merely for auto-discovery.
- Treat `~/.config/opencode/plugins/` as an installation target, not as the development source tree.
- Never silently swallow schema/correlation errors during development; surface them in local diagnostics while preserving OpenCode execution.
- Keep runtime dependencies minimal.
- Do not add infrastructure "for later."
- Avoid premature generalized abstractions for other agents/editors.
- Do not add provider-specific branches unless required by observed protocol differences.
- Normalize provider differences at the boundary.
- Preserve raw structured data when normalization would lose information.
- Write tests with every non-trivial normalizer or migration.
- Run formatting, typecheck, tests, and a real local OpenCode smoke test before declaring a phase complete.

---

# Decision Rule

When the implementation differs from assumptions in this file:

1. trust the checked-in OpenCode v2 source;
2. trust actual DuckDB 2.0 runtime behavior;
3. document the mismatch;
4. choose the smallest architecture that preserves the product goals;
5. do not add a heavyweight subsystem to work around a small integration issue.

The target is a **small, native OpenCode request inspector**, not an observability platform.
