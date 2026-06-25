# にゃんこアイス 🍦 — AdMob 本番化セットアップ

落ち物系ソートパズル。ゲーム本体は `www/index.html`（単体で動作）。
広告は **Capacitor + Google AdMob** でネイティブアプリ化して収益化する。

- **ブラウザ**で `www/index.html` を開く → 広告は **DOMモック**（収益なし・動作確認用）
- **ネイティブアプリ**（下記手順）→ **本物のAdMob広告**（バナー／インタースティシャル／動画リワード）

---

## 広告の出しどころ（実装済み）

| 種類 | タイミング | コード |
|---|---|---|
| バナー | 画面下に常時 | `initAds()` → `AdMob.showBanner` |
| インタースティシャル | 3ステージクリアごと | `advanceStage()` → `showInterstitial()` |
| 動画リワード | ゲームオーバーの「動画を見てコンテニュー」 | `showRewarded(continueStage, ...)` |

現状は **Googleの公式テストID** を使用。実機で「Test Ad」と出れば成功。

---

## セットアップ手順

### 1. 依存インストール & プラットフォーム追加
```bash
cd ~/nyanko-ice
npm install
npx cap add ios       # iOS
npx cap add android   # Android（任意）
npx cap sync
```

### 2. AdMob アプリIDをネイティブに設定
`capacitor.config.json` の `plugins.AdMob.appId` は **テスト用**。本番は自分のAdMobアプリIDに変更し、`npx cap sync` で反映。

- **iOS**: `ios/App/App/Info.plist` に `GADApplicationIdentifier`（cap syncで入るが要確認）
  - ATT（トラッキング許可）を使う場合は `NSUserTrackingUsageDescription` も追記
- **Android**: `android/app/src/main/AndroidManifest.xml` の
  `com.google.android.gms.ads.APPLICATION_ID` を確認

### 3. 広告ユニットIDを本番に差し替え
`www/index.html` 内の以下を、AdMob管理画面で発行した本番IDに変更：
```js
const TESTING = true;   // ← 本番リリース時は false
const AD_IDS = {
  ios:     { banner:'...', interstitial:'...', reward:'...' },
  android: { banner:'...', interstitial:'...', reward:'...' },
};
```
変更後は `npx cap sync`。

### 4. ビルド・実行
```bash
npx cap open ios       # Xcodeで実機/シミュレータ実行
npx cap open android   # Android Studioで実行
```

---

## 注意・チェックリスト

- **プラグインのイベント名はバージョン依存**。`showInterstitial` / `showRewarded` 内の
  `addListener('interstitialAdDismissed' / 'onRewardedVideoAdReward' / 'onRewardedVideoAdDismissed', …)`
  は `@capacitor-community/admob` v6 準拠。導入版のドキュメントで名称を確認し、必要なら修正。
- リリース前に **`TESTING=false`** と **本番ID** に必ず切替（テスト中に本番IDを叩くとポリシー違反になり得る）。
- iOSは **App Tracking Transparency** の対応（`requestTrackingAuthorization`）を検討。
- 既存の `piyo-defense/ios` と同じCapacitorワークフローで運用可能。

## ブラウザでの動作確認
```bash
open www/index.html
```
（AdMob未接続のためモック広告。ゲーム挙動・広告の出るタイミング確認用）
