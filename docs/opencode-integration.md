# OpenCode integration evidence

## Source and runtime

Read-only `reference/opencode` is OpenCode **2.1.4**, commit
`51f93eef7d3e17f8910b001b1976bc80e7ddd596`. Its package manager is Bun 1.4.4;
the available worker runtime is Bun 1.4.2. `git describe --always` locally yields
`latest-10816-g51f93eef7d` (the coordinator supplied another tag description;
the commit, not a movable tag, identifies the inspected source).

## Loading and lifecycle

- `packages/core/src/config/plugin/source.ts`: native config reads `plugins`,
  resolves relative paths against the containing config document, accepts file
  URLs and absolute directories, and rejects explicitly configured files.
- `packages/plugin/src/host.ts`: directory entry resolution tries `server`, then
  the default `index`; TS is resolved by the Bun runtime without a release build.
- `packages/core/src/plugin/module.ts`: local sources use `createPluginSources`,
  package targets use `Npm.add` / `Npm.resolve` and `Host.load`. The npm utility
  owns package installation/cache revisions; do not copy a single bundle manually.
  `packages/util/src/npm.ts` installs under `<global.cache>/npm/<target-key>`,
  uses an install lock and staged immutable generations, resolves npm or Git
  targets, and retains manifest/Git revisions for activation and update detection.
- `packages/core/src/plugin/source-directory.ts`: discovery accepts `plugin` and
  `plugins` beneath config directories (project `.opencode`, global config root).
  This repository deliberately uses root `opencode.jsonc -> ./plugin` instead.
- `packages/core/src/plugin/module.ts` validates a default `{id, setup}` Promise
  definition (or Effect `{id, effect}`); `plugin/promise.ts` adapts setup and cleanup.
  Setup may return a synchronous or asynchronous cleanup function. Dispose hooks,
  abort event subscription, drain writes, then close the owning DB at cleanup.
- Configured local directories and imported local dependencies are watched by
  `config/plugin/source.ts` and `plugin/module.ts`. Source/config changes reload
  the plugin; no normal restart or build is needed. `/reload` forces reload.
  `opencode service restart` is reserved for an unhealthy background service.
- Release packaging must ship entrypoint, native DuckDB dependencies, migrations,
  UI assets and offline prices; configure the package/directory, never a loose file.

## Hook map

Exact Promise interfaces: `packages/plugin/src/promise/session.ts` and
`registration.ts`. `ctx.session.hook(name, callback, {providerID?})` returns a
registration with `dispose()`. These drafts are mutable: observation must never
change them, return replacement prompts or throw logging errors into them.

| Hook          | Available observation                                                              |
| ------------- | ---------------------------------------------------------------------------------- |
| prompt        | sessionID, messageID, admitted prompt/metadata/delivery; not each model call       |
| context       | sessionID, model `{providerID,id}`, agent, ordered system/messages, tools, options |
| compaction    | context shape and optional result; summary prompt is appended **after** hook       |
| generate      | context shape; transient session generation, not necessarily a durable step        |
| title         | sessionID/model/system/messages/options/result; no tools or agent                  |
| model.request | sessionID/agent/model/kind and transport settings; no stable request ID            |
| http.request  | same identity, native one-shot Request                                             |
| http.response | same identity, Request and Response                                                |
| retry         | sessionID/agent/model/error/attempt/decision; never mutate decision                |

Kinds are `primary`, `compaction`, `title`, `generate`. A context hook creates one
logical request, not one row for every HTTP retry. Raw transport bodies are off
by default; if enabled later, clone bodies, redact headers and impose byte caps.
Headers/baseURL credentials are intentionally not captured by this implementation.

## Public completion and content events

`ctx.event.subscribe({signal})` is an async iterable, not a callback registration.
Abort it on cleanup. Source: `packages/plugin/src/promise` and
`packages/schema/src/session-event.ts`. Public events have `type` and `properties`;
durable events add metadata. Filter to the plugin's location/session ownership.

- `session.step.started`: sessionID, assistantMessageID, model, agent, started.
- `session.text.started/ended`, `session.reasoning.started/ended`: assistant ID,
  ordinal, full final text. Deltas are ephemeral; ended is the durable boundary.
- `session.tool.input.started/ended`, `session.tool.called/success/failed`:
  assistant ID, tool call `id`, name on input-start, structured input and output.
  Order starts as received; ordinals are per category, not a universal ordering.
- `session.step.ended/failed`: assistant ID, tokens, cost, finish/error/native.
- `session.usage.recorded`: auxiliary `source` title/compaction and usage/cost.
  `session.usage.updated` is cumulative: **never add it as another request**.
- `session.execution.*`: execution status, not necessarily a single model call.

Emission authority: `packages/core/src/session/runner/publish-llm-event.ts`.
AI messages contain ordered parts: text, reasoning, tool-call/tool-result, image,
file and provider-specific/native variants. System is a separate ordered array;
tools are a named dictionary. Keep unknown variants with original type/payload,
and image/file metadata without base64 binary content by default.

## Usage and costs

`packages/schema/src/token-usage.ts` and `packages/core/src/session/usage.ts`:

- `input` = **uncached** input, not gross prompt tokens.
- `output` = visible output; reasoning is separate.
- `cache.read` and `cache.write` are distinct input buckets.
- Gross input = input + cache.read + cache.write.
- Input-plus-read = input + cache.read; cache hit = read / input-plus-read.
- Non-cache total = input + output + reasoning.
- All tokens = gross input + output + reasoning.

Finalized OpenCode cost is authoritative as **OpenCode-accounted**, including a
reported zero, but is NOT necessarily provider-billed: `usage.ts` falls back to
catalog pricing without exposing that provenance on step events. Store it as
`opencode` cost source, never claim it is provider-billed. Independent local cost
is estimated using prices effective at request start. Unknown prices stay null.
Historical costs are stored on the request. Part/role token counts are always
estimated: character weights scaled separately to gross input, visible output and
reasoning where those totals exist; no exact message-level cache attribution.

## Correlation and limitations

Allocate an internal UUID at each context/auxiliary hook. Use session + kind +
provider/model for pending correlation; bind primary requests to the stronger
assistantMessageID when step.started arrives. All later primary events use that
assistant ID; tool pairing uses assistant ID + tool call ID. Retain project ID,
session ID, request kind, timestamps and assistant ID. Never join solely on time.
No stable ID bridges context to step.started in the public hook, so overlapping
same-session/same-kind requests are ambiguous: refuse ambiguous matches and emit
a diagnostic rather than silently attach usage to the wrong prompt.

Title/compaction usage events lack a request ID and model; match only a unique
pending session/kind. Transient generate has no guaranteed public finalized usage
event; retain incomplete requests as such rather than invent usage. A hook may
short-circuit title/compaction and yield no model call. Compaction's appended
summary instruction is not fully visible at the hook boundary. Captured logical
context is a hook snapshot, not guaranteed byte-identical lowered wire JSON.

## WebSockets

The inspected hook interfaces include `experimental.ws.handshake/send/receive`.
OpenAI Responses WebSocket transport may reuse a session socket and bypass HTTP
hooks; fallback HTTP is observed by HTTP hooks. Context and durable step usage
remain transport-independent. No claim of complete raw HTTP coverage is made.

## Storage compatibility

DuckDB must report v2.0.x at runtime; fail closed for logging on another engine.
One OpenCode process owns the writable DB and same-process UI/API. Migrations run
transactionally with a schema ledger; retain a backup before a future destructive
upgrade. DuckDB 2.0 storage/VARIANT may not be readable by older DuckDB engines:
do not silently downgrade, and export Parquet/JSON before changing major versions.

## Core verification (worker runtime)

`@duckdb/node-api` is pinned to **2.0.0-r.1**, whose engine reports **v2.0.0**
under Bun **1.4.2** on Windows. `bun test` exercises the real native binding,
transactional migrations, restart/reopen, VARIANT persistence, parameterized
filtering, hourly/session aggregates, Parquet export and a loopback Bun HTTP
handler querying the same owning connection. `bunfig.toml` limits discovery to
this project's tests, avoiding execution of the read-only upstream test tree.

The plugin entrypoint and production server are owned by a separate integration
task; a real OpenCode-loaded plugin smoke remains required there. The runtime
spike proves Bun/native compatibility, not that final entrypoint lifecycle wiring.
Time presets and aggregates use UTC. Offline seed prices are reference estimates,
not live quotes; absent prices remain unknown. JSON/JSONL export materializes its
filtered selection; use native Parquet export for a large analytical history.
