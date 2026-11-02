# OpenCode 使用量仪表板

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

一款轻量的 OpenCode V2 本地网页仪表板，可在浏览器中查看令牌用量、模型成本、工具性能以及每个请求的会话上下文。

在 OpenCode Mini 或完整 TUI 中运行 **`/usage-dashboard`**，即可随时打开仪表板。它运行在 OpenCode 插件进程中，无需额外的数据库或后台守护进程。

![OpenCode Usage Dashboard](screenshot.png)

## 可查看的内容

- **概览（`/stats`）：** 令牌总数、记录的 USD 成本、会话数、模型 Steps、每日活动、令牌明细，以及按需加载的每日令牌趋势。
- **模型（`/models`）：** 按供应商、模型和 variant 查看令牌与成本图表和表格，并可按令牌数、成本、Steps 或模型名称排序。
- **工具（`/tools`）：** 查看调用量、成功 / 失败 / 未完成次数，以及各工具的中位执行时间（`P50`）。
- **会话与请求上下文（`/sessions`）：** 按标题搜索会话，在父会话与子会话之间切换，查看每个请求的令牌和成本时间线，并查看所选步骤之前保存的历史记录。

## 快速开始

将插件添加到 `opencode.json`：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:createOne999/opencode-usage-webui#release"]
}
```

然后在 OpenCode 中运行 **`/usage-dashboard`**，即可在默认浏览器中打开仪表板；也可以直接访问 <http://127.0.0.1:7331/stats>（`http://localhost:7331/stats` 和 `http://[::1]:7331/stats` 也可使用）。

### 自定义端口

默认端口为 `7331`。如果同时运行多个项目或希望使用其他端口，请设置 `options.port`（设为 `0` 可自动选择任意可用端口）：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:createOne999/opencode-usage-webui#release", "options": { "port": 7332 } }
  ]
}
```

## 使用仪表板

- **日期与项目筛选：** 默认选择浏览器时区中的当月和当前项目（包含结束日期）。你可随时切换到 **所有项目** 或任意特定项目。
- **多语言界面：** 使用顶部选择器切换语言。所选语言（`?lang=...`）、日期范围、项目筛选和当前请求链接都会保留在 URL 中，方便收藏或刷新视图。
- **每日令牌明细：** 在概览页面点击 **加载每日令牌**，即可查看所选时间段内按日统计的输入、输出、推理及缓存读取 / 写入令牌图表。
- **检查请求上下文：**
  1. 打开 **会话 / 请求** 并选择一个会话（使用 **子会话** 标记或区域，在相关子代理会话间跳转）。
  2. 点击请求图表上的数据点，或请求表中的时间戳。
  3. 浏览 **请求前保存的历史记录**（包括用户提示、先前响应、工具调用、技能和压缩摘要），以及 **所选请求的响应**。
  4. 在长会话中，可随时点击 **再加载 100 条历史记录**，查看更早的消息。

### 指标说明

- **令牌数：** 使用紧凑的 `K`、`M`、`B` 和 `T` 单位显示（最多两位小数），排序和总计则使用精确数值。令牌总数等于 `input + output + reasoning + cache.read + cache.write`。
- **成本估算：** 根据供应商报告的用量和模型目录费率，以 USD 显示成本，供参考。
- **保存的上下文视图：** 请求检查器会根据保存的会话历史和已完成的压缩边界，重建所选步骤之前的上下文。

## 本地运行，隐私优先

- **仅限回环地址：** 严格绑定本地回环地址（`127.0.0.1` 和 `::1`），并验证同源请求标头，确保用量数据仅能在你的设备上访问。
- **不产生额外存储或遥测：** 按需读取正在运行的本地 OpenCode V2 共享服务。所有界面资源和翻译均在本地打包，不使用外部 CDN、分析服务或额外数据文件。卸载时，只需从 `opencode.json` 中移除插件条目。

## 从源码运行

适用于 OpenCode **2.2.0** 和 Bun **1.4.2**。在仓库根目录运行：

```powershell
bun run setup
opencode mini
# 在 OpenCode 中运行：/usage-dashboard
```

如果你在远程、WSL 或无头环境中工作，浏览器无法自动打开，可在终端检查当前仪表板 URL 和就绪状态：

```powershell
bun run status
```

### 开发检查

```powershell
bun run build
bun run typecheck
bun run test
```

## 许可证

采用 MIT 许可证。详情请参阅 [LICENSE](LICENSE)。
