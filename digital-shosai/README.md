# デジタル書斎 — 自分専用ナレッジベース（完全オンデバイス版）

OCR済みPDFを取り込み、ページごとに **テキスト抽出＋画像化** して **端末内（IndexedDB）** に保存。
高速な部分一致検索で、ヒットページの **テキスト** と **元PDF画像** を左右に並べて閲覧できるパーソナル書斎アプリ。

> 🔒 **データはダウンロードした本人の端末内にのみ保存され、外部サーバーには一切送信されません。**
> クラウド不要・サーバー不要・ログイン不要で動作します。

将来は **Capacitor** で iOS アプリ化して App Store 配布する想定（静的書き出し `out/` をそのまま利用）。
収益化用に3種の広告枠（バナー／インタースティシャル／動画リワード）と冊数制限ロジックを実装済み。

## 技術スタック

- Next.js (App Router, `output: "export"` 静的書き出し) + Tailwind CSS + lucide-react
- **PDF処理: pdf.js (pdfjs-dist)** — ブラウザ内でテキスト抽出＆ページ画像化（サーバー処理なし）
- **保存: IndexedDB (`idb`)** — 本・ページ・画像Blobをすべて端末内に格納

## セットアップ・起動

```bash
cd digital-shosai
npm install
npm run dev        # http://localhost:3000
```

環境変数もSupabaseもデータベースサーバーも不要。`npm run dev` だけで動きます。
（`predev`/`prebuild` で pdf.js のワーカーを `public/` に自動コピーします）

## 画面 / 機能

| 画面 | パス | 内容 |
|------|------|------|
| 取り込み | `/` | D&D取込 → pdf.jsでページ毎にテキスト＋画像化 → IndexedDB保存。本棚メーター、処理中インタースティシャル広告、枠追加リワード広告 |
| 検索 | `/search` | IndexedDB上の全ページを部分一致検索、ハイライト付きプレビュー、左右2カラム詳細ビューア |

## データ構造（IndexedDB: `digital-shosai`）

- `books` … 本のメタdata（id, title, uploadedAt, pageCount）
- `pages` … ページ（id, bookId, pageNumber, content, image=PNG Blob）／`byBook` インデックス
- `profile` … 本棚スロット数（`{ id: "me", maxBookSlots }`）

## マネタイズ仕様

- **バナー広告**: 取り込み・検索画面の最上部に常時表示
- **インタースティシャル広告**: 取り込み処理中（ページ解析・画像化の待ち時間）に全画面表示、ページ進捗を表示、最低5秒＋処理完了で自動クローズ
- **動画リワード広告**: 上限到達時の追加取込で表示、15〜30秒視聴で `maxBookSlots` を端末内で +1

## App Store（Capacitor）化の流れ（将来）

```bash
npm run build                       # out/ に静的書き出し
npm i -D @capacitor/cli @capacitor/core @capacitor/ios
npx cap init digital-shosai com.example.shosai --web-dir=out
npx cap add ios
npx cap copy && npx cap open ios    # Xcode でビルド・申請
```

IndexedDB は iOS WebView 内に永続化されるため、各ユーザーのデータはその端末内に保持されます。

## 補足・本番化メモ

- 広告はすべてダミー枠。実配信時は AdMob 等の SDK に差し替える。
- 端末容量は有限。`src/lib/db.ts` に `listBooks()` / `deleteBook()` を用意済み（蔵書一覧・削除画面の追加は今後の拡張ポイント）。
- 画像解像度は `src/lib/constants.ts` の `RENDER_SCALE`（既定1.5）で調整可能。大きいほど高精細だが端末の保存サイズが増える。
- スキャンしただけ（OCR未処理）のPDFはテキストが空になり検索に乗りません。**OCR済み（テキスト層あり）PDF前提**です。
  - 取り込み時に文字データがほぼ無いPDFを検知すると警告し、「画像として保存だけするか」を確認します（無言で空保存しない）。
  - 未OCRのPDFは Acrobat / ScanSnap / Googleドライブ等で先にOCRしてから取り込んでください。

## 日本語PDFのテキスト抽出について

pdf.js で日本語（CIDフォント）のテキストを正しく抽出するには **cMap** と **標準フォント** データが必要です。
本プロジェクトは `scripts/copy-pdf-worker.js` でこれらを `public/cmaps` `public/standard_fonts` に同梱し、
`processPdf()` 内で `cMapUrl` / `cMapPacked` / `standardFontDataUrl` を指定しています（オフライン動作）。
これが無いと日本語が文字化け・欠落します。
