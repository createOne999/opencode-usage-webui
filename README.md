# OpenCode Usage Dashboard

**English** | [한국어](README_ko.md)

A React + Bun web UI provided by the OpenCode V2 server plugin **in the same process**. It reads only the public API, with no separate database, collector, or always-on daemon.

Run **`/usage-dashboard` in OpenCode Mini or the full TUI** to open the dashboard. The command appears in `/` autocomplete and does not call a model. It opens a browser only when requested, not when the plugin loads.

- **Overview:** summary, Steps and tokens by date, token breakdown
- **Models:** token/cost charts and table by model and variant
- **Tools:** call status chart and execution-time table
- **Sessions:** title search, parent/child sessions, per-request context

## Install from GitHub Packages

After the first GitHub Packages release, configure npm access, then add the plugin to `opencode.json`:

GitHub Packages requires a **personal access token (classic)** with `read:packages`, even for public packages; fine-grained tokens are not supported. Create or update your user-level `.npmrc` (`%USERPROFILE%\.npmrc` on Windows), not the project's `.npmrc`, with the scoped registry and an environment-variable token reference:

```ini
@createone999:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Set `NODE_AUTH_TOKEN` in the environment of the OpenCode server process as well as any shell that needs npm access. Do not put a real token in this file or override npm's default registry: other packages, including `@opencode` packages, must continue to resolve from npmjs. See [GitHub's npm registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["@createone999/oud@0.1.0"]
}
```

This uses OpenCode 2.2.0's local shared service. Run `/usage-dashboard` in OpenCode; the actual URL is also logged. The default port is 7331. For multiple projects or a global configuration, set a distinct port (or use `0` to select an available port) to avoid conflicts:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "@createone999/oud@0.1.0", "options": { "port": 7332 } }
  ]
}
```

Use either the npm package or the local source plugin below, not both: they share the plugin ID `local.usage-dashboard`. No global npm install or user build/postinstall step is needed; the package includes prebuilt assets. Until the first GitHub Packages release, use the source setup below.

## Run from source

Implemented for OpenCode **2.2.0** and Bun **1.4.2**. From the repository root:

```powershell
bun run setup
opencode mini
# In OpenCode: /usage-dashboard
```

The repository's root `opencode.json` loads the repository root (`./`) as a plugin for source use; it is intentionally left local and does not change global configuration. Configuration changes are applied automatically, so an already-running OpenCode does not need a service restart. If they do not take effect, use `/reload` or run Mini again from the project root.

To print the actual URL and readiness in your terminal, including when the browser cannot be opened:

```powershell
bun run status
```

For an installed package, run its status script directly (it is not a CLI bin): `bun /path/to/node_modules/@createone999/oud/status.ts /path/to/project`.

This command discovers an already-running shared service and uses OpenCode's authenticated plugin RPC; it never starts or restarts the service. Run Mini from the project directory first. Readiness checks the listener and build; data-query errors are still reported by the dashboard. Build, port, and service failures include a suggested next action. Browser opening happens on the server's PC and may be unavailable in headless, remote, or WSL environments; use the printed URL instead.

For manual access, the default is <http://127.0.0.1:7331/stats>. `http://localhost:7331/stats` and, when IPv6 is available, `http://[::1]:7331/stats` also work. The same base URL has `/models`, `/tools`, and `/sessions` pages. Use `status` rather than assuming port 7331 after changing the plugin option; `port: 0` selects an available port.

After changing the frontend, run `build` again; changes take effect on the next browser refresh. After changing plugin server code, reload the plugin with `/reload`. The listener is closed when the plugin is unloaded or reloaded.

If port 7331 is already in use, change only the plugin option:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "./", "options": { "port": 7332 } }
  ]
}
```

## Usage

- **Period and project filters:** The defaults are this month and the current project. The selected end date is inclusive, and the browser's time zone is used.
- Switch between Korean and English using the language selector at the top. Korean is the default and the fallback for missing translations. `?lang=ko|en` is preserved across navigation, refreshes, and shared links. Changing the language preserves existing filters, request, cursor, and hash.
- Only UI, charts, accessibility guidance, and date display are translated. Original session titles, conversations, tool results, model names, and paths are retained, as are token `K/M/B/T` units, USD costs, and the aggregation time zone. Text inside the date picker follows the browser language. Translations in `web/locales/ko.json` and `en.json` are bundled locally; no external translation service, automatic language detection, or browser storage is used.
- Sessions, child sessions, prompts, model Steps, active days, and the longest streak of consecutive active days.
- Input, output, reasoning, cache read/write, total tokens, and USD cost by provider, model, and variant. Sort by tokens, cost, Steps, or name.
- Calls, successes, failures, and incomplete calls by tool; execution time P50 (ms); Steps by date.
- Total tokens are the sum of the five token categories. Input means uncached input; output means visible output excluding reasoning.
- Token values are abbreviated in base-1,000 units as `K`, `M`, `B`, and `T`, with up to two decimal places. Aggregation and sorting use the original numbers; Steps, counts, time, and cost retain their displayed units.
- Costs may mix provider-reported amounts and catalog estimates, and the API does not distinguish their sources. Missing rates may also result in zero, so do not treat the values as actual billed amounts or conclude that usage was free.
- In the current API, compaction is included only in the overall total, so it may differ from the sum of model rows. Title usage is excluded. Steps are not HTTP request counts.
- Steps by date are shown only for dates with activity. Select **Load daily tokens** to split the selected period into one-day intervals in the browser's time zone and display input, output, reasoning, cache read/write charts and a data table. Choose the query period using the existing start and end dates.
- Daily tokens are queried sequentially, once per day, through the public `session.stats` API; tool aggregation is excluded. On failure, missing values are not filled with zeros, and incomplete results are not presented as complete. All dates are queried to include compaction usage on days without Steps. No full-session or conversation-body collection or additional storage is performed. Since query times differ, usage from in-progress requests may not match the summary total above.
- Model and tool charts show the first 10 items; their tables show all items. The model chart uses the same sort order as its table.
- Period and project are preserved in the URL. The session list is queried by project and title, ordered by last modified; the period filter applies to requests loaded in session details. Cumulative session tokens and cost are not period totals.

## Context at request time

1. Select a session in **Sessions / requests**. Find child sessions using **Child sessions** in the details or the **Child sessions** indicator in the list.
2. Select a point on the request chart or a request time in the table. Keyboard users can use the link for the same request time.
3. The view moves to the selected point and shows **Saved history before request** and **Response to selected request** separately. The URL preserves both `request` and the page `cursor`, so the link can be reopened or refreshed.
4. Use **Load 100 more history entries** to read earlier entries. The view can include compaction summaries, saved instruction changes, skills, user messages, earlier responses, and tool results. Binary attachments show only their name and type; external files and URLs are not opened automatically.

### Accuracy and query scope

- **This is a reconstruction based on saved history, not the exact content actually sent.** The current `session.context()` is not reused for past requests. The complete system instructions at the time, tool definitions, plugin transformations, and provider's final input are not reconstructed.
- Only entries before the selected Step in saved-message order are used; input recorded after dispatch is also excluded. The response is shown separately, and later messages are not mixed into input history. Earlier responses, tools, and shell results not confirmed as completed before the request are excluded. The source is the current projection, so these checks do not guarantee a complete reconstruction of the historical state.
- Completed compactions define boundaries between original records. Retained text or `keepID` references are shown, and retained history that has not yet been loaded or is missing is marked incomplete. The provider compaction window is used as a boundary only for the same provider and model; raw replay data is not exposed.
- Sessions are read 20 at a time and messages 100 at a time using public API cursors. The request chart shows **only Steps within the period from the currently loaded message page**; it does not claim to show the full session timeline. You can move to the next page even when the current page has no requests.
- Input-context tokens in the request chart are `input + cache.read + cache.write`; generated tokens are `output + reasoning`. Input tokens are not the model's maximum context size or its utilization. Missing measurements remain **Unavailable**, distinct from zero.
- A request unit is a recorded model Step, not an independent list of every HTTP request and retry. When default event retention is disabled, `session.log()` may return only `log.synced` without historical events, so it is not used as required data for this feature.
- If history changes and the request no longer matches the cursor, the UI asks you to select again. It does not automatically scan the full session to find the old position.

## Connections, security, and limitations

- Finds an **already-running local shared service** using the official `Service.discover()`. It does not start, stop, or replace the service. `--standalone` and remote `--server` connections are not supported by this version.
- The browser accesses only Bun's restricted query API. OpenCode authentication headers and passwords remain in server memory and are not sent to the browser or stored in files.
- Binds only to loopback (`127.0.0.1` and, when available, `::1`). Only the actual port's loopback authorities, including `localhost`, are accepted, and a supplied Origin must match the request's own authority exactly. Host/Origin/Fetch Metadata and custom request headers are validated; CORS and all write requests remain blocked. LAN/machine IP access, isolation between local OS users, and login for a publicly exposed service are not provided.
- The slash command and status RPC use OpenCode's existing command/authentication path. The separate dashboard listener does **not** inherit `opencode serve` authentication and remains local-only. No password is copied into URLs or browser settings, and no extra CORS origins are enabled.
- React, CSS, and charts are served from local build output; no CDN, external fonts, or telemetry are used. Only saved conversation and tool results needed for display are queried when a request is selected. Bodies are not sent in lists, and queried content is not additionally stored in logs, files, or a browser database.
- The usage API is experimental. The dashboard does not read the database directly or import OpenCode internals.
- This is a minimal setup for one instance in one project. To enable the plugin simultaneously in other projects, specify different ports.
- The API is called only on query/refresh, not through automatic polling. The UI reports when data is unavailable or the connection fails.
- To remove the plugin, delete its entry from the OpenCode config where you added it. This plugin does not store usage data.
- `reference/opencode/` is for read-only analysis; OpenCode's database, schema, configuration, and storage are not changed. No additional storage or capture is performed, including via `ctx.storage`.

## Design

- Retains Tailwind CSS v4, shadcn/ui (Radix-based), and Lucide React, with pages separated by top navigation. It uses ordinary links and URL filters rather than adding React Router or a state-management library.
- `web/components/ui/` contains shadcn/ui source. Add only needed components through `components.json`; date and project selection retain native input behavior.
- Reuses Recharts 3.10.1 for bar/line charts, tooltips, and basic arrow-key navigation. `react-is` is kept at 19.3.1 to match the installed React version. Tables retain the existing shadcn Table and simple sorting; TanStack Table is not added.
- `build.ts` builds HTML, JS, and CSS with Bun's Tailwind plugin. Assets are served from root-absolute paths so they load after refreshing a session detail URL. CSS is served as a separate local file to preserve the existing CSP.
- Chart animations are disabled; only short CSS transitions are used, respecting `prefers-reduced-motion`. Motion, React Aria, and reactbits are not added. Aggregation charts have collapsible data tables, and request charts provide links to the corresponding request time.

## Release

CI runs typecheck, build, then tests on pull requests and pushes to `main`, using the frozen Bun lockfile. Publishing runs only when a regular GitHub Release is published (drafts and prereleases are skipped); its tag must exactly match `v<package.json version>`. Versions are never bumped automatically. The workflows use Bun 1.4.2 and Node 24.

Push the publishing workflow to `main`, then publish a regular GitHub Release tagged `v<package.json version>` (currently `v0.1.0`) at that commit. The workflow runs checks and publishes to GitHub Packages using its automatic `GITHUB_TOKEN` with `packages: write`; no npm account, npm token, or custom publishing PAT is needed. The first package is private by default. To distribute it publicly, go to the package's **Settings → Change visibility → Public**; this change cannot be reversed.

For later releases, bump the version in `package.json`, commit and push the change, then publish a regular GitHub Release with the matching `v<version>` tag at the version-bump commit. See [GitHub's npm registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

## Validation

MIT licensed; see [LICENSE](LICENSE).

```powershell
bun run build
bun run typecheck
bun run test
```

Tests use mocked API responses and do not modify real accounts or sessions. They cover API filters, security boundaries, error handling and listener cleanup; asset loading at nested URLs; token aggregation; page separation; URL preservation; HTML escaping; excluding messages after selection; response separation; cursor pagination; compatible compaction boundaries; missing retained history; and excluding late-completing output. The limits feature was removed; `/limits` and `/api/limits` return 404.

Entrypoint tests also cover command/RPC registration, actual-port reporting, build/port failures, cleanup after registration failure, and browser-open failure reporting without launching a real browser. Loopback tests exercise localhost/IPv6 access, exact-origin rejection across aliases, and cleanup of both listeners.

With Chromium and a mocked API, five screens at 390/768/1440px were checked, along with clicking the request chart and moving to the selected point, loading more earlier history, response separation and excluding future messages, restoring a request link with a cursor after refresh, arrow-key tooltips, empty model/tool/session states, and recovery by retry after query errors. Charts work without relaxing the CSP. Normal responses from the session, request, and history read proxies were also confirmed against a running OpenCode 2.2.0. No service start/restart or direct database access was performed.
