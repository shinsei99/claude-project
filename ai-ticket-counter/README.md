# AI受付＆起票カウンター 🎫

社内Webアプリ（18本）への **不具合報告・改善要望・新アプリ希望** をチャットで受け付け、
AI（`claude` CLI）が **対話でヒアリング** して内容を判断し、
**タスク自動起票** と **開発チーム宛の報告書メール** を作成する自動受付システム。

チャット応対は丁寧な **業務口調**。要件を選ぶと AI 受付が「どんな不具合でしょう？」から
対話を始め、必要事項が集まったら（または途中打ち切りでも）報告書にまとめます。

---

## 処理フロー

```
① 受付        ブラウザ or Slack で要件を選び、AI受付と対話
        ↓
② 対話ヒアリング  claude CLI が業務口調で症状/要望を聞き出す（最大4問／途中終了も可）
        ↓
③ 構造化      対象アプリ/種類/優先度/件名/概要/原因推測/対策を JSON 化
        ↓
④ タスク自動起票  GitHub Issues / Notion / Backlog / Excel(CSV) に起票 → チケットURL取得
        ↓
⑤ 報告書メール   対話を基にした報告書を作成。既定は Mac のメールアプリに下書き表示（確認して送信）
```

AI解析は既存アプリ（見積書自動生成ツール等）と同じ **`claude` CLI 方式**。APIキー不要
（`~/.local/bin/claude` を呼ぶ。画像は一時フォルダに置き `Read` ツールで読ませる）。

---

## フォルダ構成

```
ai-ticket-counter/
├── app.py                    # FastAPI：対話ブラウザUI(/) + /chat + Slack Webhook(/slack/events)
├── run_pipeline.py           # 単発報告のローカルテスト（Webhook不要）
├── config.py                 # .env 読み込み・全設定
├── requirements.txt
├── .env.example              # 環境変数テンプレート（.env は Git 管理外）
├── core/
│   ├── models.py             # Report / Analysis / Ticket、KINDS・REQUEST_TYPES
│   └── pipeline.py           # ③〜⑤の連結（単発 process_report / 対話 finalize_conversation）
├── services/
│   ├── claude_analyzer.py    # 単発解析＋共通ヘルパ（_invoke_claude / _validate / _kind_constraint）
│   ├── intake.py             # 対話ヒアリング（next_turn＝次の質問 or 確定、finalize＝途中打ち切り）
│   ├── ticketing.py          # 起票アダプタ（github/notion/backlog/excel）
│   ├── mailer.py             # 報告書メール（applescript＝メールアプリ下書き / smtp）
│   ├── mail_draft.applescript# Apple Mail に下書きを作る AppleScript
│   ├── reply.py              # 業務口調の返信文・メール用の対話履歴
│   └── chat/                 # チャットアダプタ（base / slack / manual）
└── data/
    └── apps.py               # 社内18アプリのカタログ＋報告者一覧(REPORTERS)
```

---

## セットアップ

```bash
cd ai-ticket-counter
pip install -r requirements.txt        # claude CLI は別途インストール済みのこと
cp .env.example .env                    # → .env を編集（宛先・起票先など）
```

`.env` の主な項目:

```
TICKET_BACKEND=excel                    # github / notion / backlog / excel
MAIL_BACKEND=applescript                # applescript(メールアプリ下書き) / smtp
MAIL_TO=shin@daikyocorp.co.jp           # 報告書メールの宛先
```

---

## 使い方

### ブラウザ（対話UI）
```bash
python app.py            # → http://localhost:8600
```
1. 報告者・要件（不具合報告／改善要望／新アプリ希望／その他）・対象アプリを選ぶ
2. 「相談を開始」→ AI受付とチャット
3. 必要事項が集まると自動で起票＋報告書メール下書き作成
4. 途中で終えたいときは **「ここまでの内容でメール送信」** ボタンで打ち切り確定

### 単発テスト（Webhook不要）
```bash
TICKET_BACKEND=excel python run_pipeline.py --text "間取り図トレーサーで線がずれる" --reporter 大鹿
```

### Slack 連携
`python app.py` で起動し、Slack App の Event Subscriptions の Request URL を
`https://<公開URL>/slack/events` に設定（scopes: `chat:write`, `files:read`, `users:read`）。
Bot Token / Signing Secret を `.env` に設定する。

---

## 要件（REQUEST_TYPES）と分類

| 要件（選択） | 分類(kind) | 報告書タイトル | 優先度 |
|---|---|---|---|
| 不具合報告 | 致命的な不具合 / 軽微な不具合（AIが深刻度判定） | 障害受付報告書 | AI判定 |
| 改善要望 | 機能要望 | 改善要望 受付報告書 | 低 |
| 新アプリ希望 | 新アプリ希望（対象アプリは「その他・不明」） | 新アプリ企画 受付報告書 | 低 |
| その他 | 質問・その他 | 受付報告書 | 中 |

要件・対象アプリはプルダウン指定で AI の推測を上書き（`forced_kind` / `forced_app`）。

---

## 起票先の切り替え（`TICKET_BACKEND`）

| 値 | 起票先 | 必要な設定 |
|----|--------|-----------|
| `github` | GitHub Issues | `gh` CLI 認証済み、または `GITHUB_TOKEN`。`GITHUB_REPO` |
| `notion` | Notion DB | `NOTION_TOKEN`, `NOTION_DATABASE_ID` |
| `backlog` | Backlog | `BACKLOG_*` 一式 |
| `excel` | ローカルCSV | 不要（`data/tickets.csv` に追記・オフライン検証用） |

---

## 報告書メール（`MAIL_BACKEND`）

- `applescript`（既定）: `osascript` で Apple Mail に下書きを作成・表示。宛先/件名/本文（報告書）入り。
  内容を確認して「送信」ボタンで送る。**初回のみ macOS のオートメーション許可が必要。**
- `smtp`: `smtplib` で自動送信（`SMTP_*` 設定が必要）。

件名は `【AI起票】[優先度] [アプリ名] AIが生成したタイトル`。本文は「1.概要・現象／2.AI考察／参考:対話全文」構成。

---

## セキュリティ

SMTPパスワード・APIキー・トークン等の機密は **すべて `.env`**（環境変数）から読み込み、
コードにハードコードしていません。`.env` はルート `.gitignore` の `**/.env` で除外済みです。
