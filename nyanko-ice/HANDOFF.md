# にゃんこアイス — 引き継ぎメモ（明日 別PCでXcode作業）

## 現状サマリー（このコミット時点）
- ゲーム本体: `www/index.html`（単体で動作。ブラウザで開くと広告はDOMモック）
- **Web公開済み**: https://shinsei99.github.io/project/nyanko-ice/ （gh-pagesブランチ）
- Capacitor + AdMob 構成ずみ（`package.json` / `capacitor.config.json`）
- **iOSのAdMob広告IDは3種とも本番設定ずみ**：
  - アプリID: `ca-app-pub-7896238888737384~2734537173`（`capacitor.config.json`）
  - バナー: `ca-app-pub-7896238888737384/4100011194`
  - インタースティシャル: `ca-app-pub-7896238888737384/9096765542`
  - リワード: `ca-app-pub-7896238888737384/4965948848`
  - 上記は `www/index.html` の `AD_IDS.ios` にも記載
- **`TESTING = true`**（`www/index.html`内）。開発中はテスト広告が出る。**リリース直前に `false`** に変更。
- Android用IDは未取得（テストIDのまま。Androidも出すなら別途AdMobで取得）。

## 別PCでの始め方
```bash
# 1) 最新を取得
git pull            # このリポジトリ(main)に nyanko-ice/ が入っている

cd nyanko-ice

# 2) 依存インストール＆iOSプロジェクト生成
npm install
npx cap add ios
npx cap sync

# 3) Xcodeで開く
npx cap open ios
```

## Xcodeでやること
1. Signing & Capabilities → **自分のApple Developerチーム**を選択（自動署名）
2. 実機 or シミュレータでビルド＆実行
3. 起動後に **バナー / 3ステージごとの全画面 / ゲームオーバーのコンテニュー動画** が
   「Test Ad」表示で出ればOK（`TESTING=true`のため）
4. 問題なければ `www/index.html` の `TESTING=false` に変更 → `npx cap sync` → 再ビルド → App Store提出

## 注意点
- **イベント名の確認**: `www/index.html` の `showInterstitial` / `showRewarded` 内
  `addListener('interstitialAdDismissed' / 'onRewardedVideoAdReward' / 'onRewardedVideoAdDismissed', …)`
  は `@capacitor-community/admob` v6 準拠。`npm install` 後、導入版のドキュメントで名称を確認し、違えば修正。
- **Info.plist**（`npx cap add ios` 後に確認）:
  - `GADApplicationIdentifier` = 上記アプリID（cap syncで入るはず）
  - 必要なら `NSUserTrackingUsageDescription`（ATT文言）を追加
- `ios/` と `node_modules/` は `.gitignore` 済み（別PCで生成するため）。

## Web版を更新したいとき（gh-pages公開）
`www/index.html` を編集後、gh-pagesブランチの `nyanko-ice/index.html` に反映してpush。
（前回はworktreeで `origin/gh-pages` に `nyanko-ice/index.html` を追加して公開した）
