# OpenCode Usage Dashboard

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

A lightweight local web dashboard for **OpenCode V2** that helps you explore your token usage, model costs, tool performance, and per-request session context right in your browser.

Run **`/usage-dashboard`** in OpenCode Mini or the full TUI whenever you want to open the dashboard. It runs inside the OpenCode plugin process with no extra database or background daemon required.

## What You Can Explore

- **Overview (`/stats`):** Total tokens, recorded USD cost, sessions, model steps, daily activity, token breakdown, and on-demand daily token trends.
- **Models (`/models`):** Token and cost charts and tables by provider, model, and variant—sortable by tokens, cost, steps, or model name.
- **Tools (`/tools`):** Call volume, success/failure/incomplete counts, and median (`P50`) execution time per tool.
- **Sessions & Request Context (`/sessions`):** Search sessions by title, navigate between parent and child sessions, inspect per-request token and cost timelines, and view the saved history leading up to any selected step.

## Quick Start

Add the plugin to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:createOne999/oud#release"]
}
```

Then run **`/usage-dashboard`** inside OpenCode to open the dashboard in your default browser, or visit <http://127.0.0.1:7331/stats> directly (`http://localhost:7331/stats` and `http://[::1]:7331/stats` also work).

### Customizing the Port

The default port is `7331`. If you run multiple projects simultaneously or want to use a different port, set `options.port` (use `0` to pick any available port automatically):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:createOne999/oud#release", "options": { "port": 7332 } }
  ]
}
```

## Using the Dashboard

- **Date & Project Filters:** Defaults to the current month and current project in your browser's time zone (with the end date included). You can switch to **All projects** or any specific project at any time.
- **Multi-language UI:** Switch languages from the top selector. Your selected language (`?lang=...`), date range, project filter, and active request link stay in the URL so you can easily bookmark or refresh any view.
- **Daily Token Breakdown:** On the Overview page, click **Load daily tokens** to view day-by-day input, output, reasoning, and cache read/write token charts for the selected period.
- **Inspecting Request Context:**
  1. Open **Sessions / requests** and select a session (use the **Child sessions** badge or section to jump between related subagent sessions).
  2. Click a point on the request chart or a timestamp in the request table.
  3. Browse **Saved history before request** (including user prompts, earlier responses, tool calls, skills, and compaction summaries) alongside **Response to selected request**.
  4. Use **Load 100 more history entries** whenever you want to inspect earlier messages in a long session.

### Helpful Notes on Metrics

- **Token Counts:** Displayed in compact `K`, `M`, `B`, and `T` units (up to two decimal places) while sorting and totals use exact numbers. Total tokens equal `input + output + reasoning + cache.read + cache.write`.
- **Cost Estimates:** Costs are shown in USD based on provider-reported usage and model catalog rates for convenient reference.
- **Saved Context View:** The request inspector reconstructs context from your saved session history and completed compaction boundaries up to the selected step.

## Local & Private by Design

- **Loopback Only:** Binds strictly to local loopback (`127.0.0.1` and `::1`) and validates same-origin headers so your usage data stays accessible only on your machine.
- **Zero Extra Storage or Telemetry:** Reads from your running local OpenCode V2 shared service on demand. All UI assets and translations are bundled locally with no external CDNs, analytics, or extra data files. To uninstall, simply remove the plugin entry from `opencode.json`.

## Run from Source

Built for OpenCode **2.2.0** and Bun **1.4.2**. From the repository root:

```powershell
bun run setup
opencode mini
# Inside OpenCode: /usage-dashboard
```

If you are working in a remote, WSL, or headless environment where a browser cannot open automatically, check the active dashboard URL and readiness from your terminal:

```powershell
bun run status
```

### Development Checks

```powershell
bun run build
bun run typecheck
bun run test
```

## License

MIT licensed. See [LICENSE](LICENSE) for details.
