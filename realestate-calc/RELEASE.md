# App Store リリース手順（不動産・金融マスター電卓）

ママカウンターと同じ Capacitor フローで iOS アプリ化して申請します。

## 構成
- `index.html` … アプリ本体（単一ファイル）
- `privacy.html` … プライバシーポリシー（審査必須）
- `manifest.json` / `sw.js` … Web/PWA 用（GitHub Pages 公開用。Capacitor では未使用でも可）
- `icon-1024.png` ほか … アプリアイコン
- `assets/icon.png` … 1024×1024 アイコン原本（iOSアイコン自動生成用）
- `capacitor.config.json` … `appId: com.shinsei99.fudosancalc` / `webDir: www`
- `www/` … Capacitor が読み込む Web アセット（index.html 等のコピー）

## 申請までの手順

```bash
cd /Users/apple/realestate-calc

# 1) 依存インストール
npm install

# 2) iOS プロジェクト生成（初回のみ）
npx cap add ios

# 3) アプリアイコンを assets/icon.png から自動生成
npx @capacitor/assets generate --ios

# 4) Web アセットを www/ に同期して Capacitor へ反映
npm run sync          # = cp index.html privacy.html www/ && npx cap sync

# 5) Xcode を開く
npx cap open ios
```

Xcode 側で行うこと（ママカウンターと同じ）:
- Signing & Capabilities でチーム（Apple Developer アカウント）を選択
- General で Display Name / Version / Build を設定
- 実機またはアーカイブでビルド → App Store Connect へアップロード
- App Store Connect: スクリーンショット、説明文、サポートURL、**プライバシーポリシーURL**（`privacy.html` を GitHub Pages 等で公開した URL）、年齢区分、データ収集＝「収集しない」を入力 → 審査提出

## 内容を更新したとき
`index.html` を編集したら `npm run sync` で `www/` に反映してから再ビルド。
（`www/` は配布用コピー。原本は直下の `index.html`）

## 審査で効いてくるポイント（対応済み）
- アプリ内に全体免責（概算・助言ではない旨）を常時表示
- プライバシーポリシー（収集なし・トラッキングなし）
- 税制は年度・性能別に明記（住宅ローン控除＝2024・2025年入居基準 ほか）
