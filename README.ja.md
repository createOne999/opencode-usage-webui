# OpenCode 使用状況ダッシュボード

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

OpenCode V2 向けの軽量なローカルWebダッシュボードです。ブラウザーでトークン使用量、モデルのコスト、ツールのパフォーマンス、リクエストごとのセッションコンテキストを確認できます。

OpenCode Mini またはフルTUIで **`/usage-dashboard`** を実行すると、いつでもダッシュボードを開けます。OpenCodeプラグインプロセス内で動作し、追加のデータベースやバックグラウンドデーモンは不要です。

## 確認できる内容

- **概要（`/stats`）：** 合計トークン、記録されたUSDコスト、セッション数、モデルSteps、日別アクティビティ、トークン内訳、必要に応じて取得できる日別トークン推移。
- **モデル（`/models`）：** プロバイダー、モデル、variantごとのトークン数とコストをグラフや表で表示し、トークン数、コスト、Steps、モデル名で並べ替えできます。
- **ツール（`/tools`）：** ツールごとの呼び出し数、成功・失敗・未完了の件数、実行時間の中央値（`P50`）。
- **セッションとリクエストコンテキスト（`/sessions`）：** タイトルでセッションを検索し、親セッションと子セッション間を移動できます。リクエストごとのトークン数・コストの推移や、選択したStepまでの保存済み履歴も確認できます。

## クイックスタート

`opencode.json` にプラグインを追加します。

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:createOne999/opencode-usage-webui#release"]
}
```

OpenCode内で **`/usage-dashboard`** を実行して既定のブラウザーで開くか、<http://127.0.0.1:7331/stats> に直接アクセスしてください（`http://localhost:7331/stats` と `http://[::1]:7331/stats` も利用できます）。

### ポートの変更

既定のポートは `7331` です。複数のプロジェクトを同時に実行する場合や、別のポートを使う場合は `options.port` を設定してください（`0` を指定すると使用可能なポートが自動的に選ばれます）。

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:createOne999/opencode-usage-webui#release", "options": { "port": 7332 } }
  ]
}
```

## ダッシュボードの使い方

- **日付とプロジェクトのフィルター：** 既定では、ブラウザーのタイムゾーンにおける当月と現在のプロジェクトが選択されます（終了日を含みます）。いつでも **すべてのプロジェクト** または任意のプロジェクトに切り替えられます。
- **多言語UI：** 上部のセレクターで言語を切り替えます。選択した言語（`?lang=...`）、期間、プロジェクトフィルター、アクティブなリクエストへのリンクはURLに保持されるため、どの表示も簡単にブックマークしたり再読み込みしたりできます。
- **日別トークン内訳：** 概要ページで **日別トークンを読み込む** をクリックすると、選択期間の入力、出力、推論、キャッシュ読み取り・書き込みのトークンを日ごとのグラフで確認できます。
- **リクエストコンテキストの確認：**
  1. **セッション / リクエスト** を開いてセッションを選択します（**子セッション**のバッジまたはセクションから、関連するサブエージェントのセッションに移動できます）。
  2. リクエストのグラフ上の点、またはリクエスト表のタイムスタンプをクリックします。
  3. **リクエスト直前の保存済み履歴**（ユーザープロンプト、以前の応答、ツール呼び出し、スキル、圧縮の要約を含む）と **選択したリクエストへの応答** を並べて確認します。
  4. 長いセッションでは、**履歴をさらに100件読み込む** を使って以前のメッセージを確認できます。

### 指標について

- **トークン数：** `K`、`M`、`B`、`T` の簡潔な単位（小数点以下2桁まで）で表示されますが、並べ替えと合計には正確な数値が使われます。合計トークン数は `input + output + reasoning + cache.read + cache.write` です。
- **コストの推定：** 参考情報として、プロバイダーが報告した使用量とモデルカタログの料金に基づくUSDコストを表示します。
- **保存済みコンテキスト表示：** リクエストインスペクターは、選択したStepまでの保存済みセッション履歴と完了した圧縮境界からコンテキストを再構成します。

## ローカルでプライバシーを保護

- **ループバック限定：** ローカルループバック（`127.0.0.1` と `::1`）のみにバインドし、同一オリジンのヘッダーを検証することで、使用量データを自分の端末だけで利用できるようにします。
- **追加の保存領域やテレメトリーなし：** 実行中のローカルOpenCode V2共有サービスから必要に応じて読み込みます。UIアセットと翻訳はすべてローカルに同梱され、外部CDN、分析機能、追加データファイルはありません。アンインストールするには、`opencode.json` からプラグインの項目を削除するだけです。

## ソースから実行

OpenCode **2.2.0** と Bun **1.4.2** 向けです。リポジトリのルートで次を実行してください。

```powershell
bun run setup
opencode mini
# OpenCode 内で: /usage-dashboard
```

ブラウザーを自動で開けないリモート、WSL、ヘッドレス環境では、ターミナルから現在のダッシュボードURLと起動状態を確認できます。

```powershell
bun run status
```

### 開発時のチェック

```powershell
bun run build
bun run typecheck
bun run test
```

## ライセンス

MITライセンスです。詳細は [LICENSE](LICENSE) をご覧ください。
