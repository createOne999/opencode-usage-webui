# OpenCode 使用量儀表板

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

輕量的 OpenCode V2 本機網頁儀表板，可讓你直接在瀏覽器中查看權杖用量、模型成本、工具效能，以及各請求的工作階段脈絡。

在 OpenCode Mini 或完整 TUI 中執行 **`/usage-dashboard`**，即可開啟儀表板。儀表板會在 OpenCode 外掛程序中執行，不需要額外的資料庫或背景常駐程式。

## 可查看的內容

- **總覽（`/stats`）：** 權杖總數、記錄的 USD 成本、工作階段數、模型 Steps、每日活動、權杖組成，以及依需求載入的每日權杖趨勢。
- **模型（`/models`）：** 依供應商、模型和 variant 檢視權杖及成本圖表與表格，並可依權杖數、成本、Steps 或模型名稱排序。
- **工具（`/tools`）：** 呼叫量、成功／失敗／未完成次數，以及各工具的中位數（`P50`）執行時間。
- **工作階段與請求脈絡（`/sessions`）：** 依標題搜尋工作階段、瀏覽父工作階段與子工作階段、檢視各請求的權杖與成本時間軸，並查看所選步驟之前儲存的歷史記錄。

## 快速開始

將外掛加入 `opencode.json`：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:createOne999/oud#release"]
}
```

接著在 OpenCode 中執行 **`/usage-dashboard`**，即可在預設瀏覽器開啟儀表板；或直接前往 <http://127.0.0.1:7331/stats>（`http://localhost:7331/stats` 和 `http://[::1]:7331/stats` 也可使用）。

### 自訂連接埠

預設連接埠為 `7331`。若同時執行多個專案，或想使用不同連接埠，請設定 `options.port`（設為 `0` 可自動選擇任何可用連接埠）：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:createOne999/oud#release", "options": { "port": 7332 } }
  ]
}
```

## 使用儀表板

- **日期與專案篩選：** 預設為瀏覽器時區的當月及目前專案（包含結束日期）。可隨時切換至 **所有專案** 或任一特定專案。
- **多語言介面：** 使用頂端選單切換語言。所選語言（`?lang=...`）、日期範圍、專案篩選和目前請求連結都會保留在 URL，方便加入書籤或重新整理任何檢視畫面。
- **每日權杖明細：** 在總覽頁面按一下 **載入每日權杖**，即可檢視所選期間每日輸入、輸出、推理和快取讀取／寫入權杖圖表。
- **檢視請求脈絡：**
  1. 開啟 **工作階段 / 請求** 並選取工作階段（使用 **子工作階段** 標記或區塊，在相關子代理工作階段間切換）。
  2. 按一下請求圖表上的資料點，或請求表格中的時間戳記。
  3. 並排瀏覽 **請求前儲存的歷史記錄**（包括使用者提示、較早的回應、工具呼叫、技能和壓縮摘要）與 **所選請求的回應**。
  4. 長工作階段中若要查看較早的訊息，可隨時使用 **再載入 100 筆歷史記錄**。

### 指標說明

- **權杖數：** 以精簡的 `K`、`M`、`B` 和 `T` 單位顯示（最多兩位小數），排序和總計則使用精確數值。權杖總數等於 `input + output + reasoning + cache.read + cache.write`。
- **成本估算：** 成本以 USD 顯示，根據供應商回報的用量和模型目錄費率計算，供參考使用。
- **儲存脈絡檢視：** 請求檢視器會根據儲存的工作階段歷史記錄，以及已完成的壓縮邊界，重建截至所選步驟的脈絡。

## 本機執行，隱私優先

- **僅限迴路位址：** 嚴格繫結至本機迴路位址（`127.0.0.1` 和 `::1`），並驗證相同來源標頭，確保用量資料只能在你的裝置上存取。
- **不額外儲存或遙測：** 依需求讀取正在執行的本機 OpenCode V2 共用服務。所有介面資源和翻譯皆隨附於本機，不使用外部 CDN、分析服務或額外資料檔案。若要解除安裝，只需從 `opencode.json` 移除外掛項目。

## 從原始碼執行

適用於 OpenCode **2.2.0** 和 Bun **1.4.2**。請在儲存庫根目錄執行：

```powershell
bun run setup
opencode mini
# 在 OpenCode 中執行：/usage-dashboard
```

若你在遠端、WSL 或無頭環境中工作，無法自動開啟瀏覽器，可在終端機查看目前的儀表板 URL 和就緒狀態：

```powershell
bun run status
```

### 開發檢查

```powershell
bun run build
bun run typecheck
bun run test
```

## 授權條款

採用 MIT 授權。詳情請參閱 [LICENSE](LICENSE)。
