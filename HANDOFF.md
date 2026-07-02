# 引き継ぎメモ（別PCで作業を続けるために）

最終更新：2026-07-02

---

## 2026-07-02 セッションの作業

### 新規アプリ：tsuikyaku-crm（顧客追客マネージャー）★今回コミット
- テナント需要客（飲食・医療・エステ・塾など「出店したい客」）への**追客（フォロー営業）を管理**する業務アプリ。**Streamlit + SQLite**（port 8515）。データは `data/customers.db`（**git対象外**＝顧客情報は非公開）。
- **種データ**：`~/Downloads/物件顧客管理.accdb` の顧客マスタ688件を `python import_accdb.py <accdbパス>` で取込（**mdbtools必須**：`brew install mdbtools`）。運用開始後の再取込は customers を入れ直すので、既存の編集を残すなら使わない（バックアップ復元を使う）。
- **画面（左バー）**：ダッシュボード（今日までに追客すべき先＝次回追客日≤今日を重要度順）／➕顧客追加／👥顧客一覧・検索（行ごとに「詳細」ボタン・50件ページング・上下ページャ＋番号ジャンプ／詳細は一覧内に表示＝独立メニューなし）／🔁重複チェック（FAX or メール一致をUnion-Findでグループ化、同一会社別ブランドは削除しない）／📠一括FAX追客／⚙️設定。
- **データ項目**：区分＝店舗/事務所/住居/駐車場/収益/その他。重要度＝低/中/高（既存は全て低）。種別＝大枠（店舗:飲食/物販/サービス/その他、住居:売買/賃貸）＋詳細種別（ラーメン・医院等、旧種別を退避し大枠は`db.classify_category`でNFKC正規化して自動分類）。希望坪数＝小規模(20坪以下)/中規模(50坪以下)/大規模＋希望坪数詳細（`db.classify_size`、範囲は数字平均で判定）。希望物件（特定物件希望）。社内担当（担当者マスタから割当）。status＝未接触→追客中→商談中→成約/見送り。移行は`migrate()`が settings フラグ（shubetsu_split/size_split）で一度だけ実行。
- **一括FAX**：`filter_ui`で区分/重要度/種別/詳細種別/希望坪数/担当/キーワードで絞込→`data_editor`で全選択/全解除＋1件ずつ個別選択→**区分別テンプレ**（住居/駐車場/収益は専用文言、店舗・事務所は共通。絞込区分で自動切替＋手動選択）→**実行押下で確認画面**（本文プレビュー・送信先アドレス一覧）→確定送信。送信先は自動で対応履歴「一括FAX」＋次回追客日更新。同一FAX番号は重複排除。
- **宛名/差出人**：会社名のみ（店名不使用）、宛名は既定「ご担当者様」・表で担当者名ONの先だけ「◯◯ 様」。差出人＝⚙️設定で自社情報（会社名/住所/TEL/FAX/メール）を保存、担当は担当者マスタから**都度選択**（`build_sender_info`）。文面末尾`{自社情報}`に差込。
- **eFAX送信**：`services/fax.py` が `{FAX番号}@{ゲートウェイドメイン}` 宛メール送信でFAX化。**国際形式必須**：先頭0を国番号(既定81)に置換（例 0663530280→`81663530280@efaxsend.com`）。ゲートウェイ/国番号/SMTPは⚙️設定。SMTP未設定でも「送付リストCSV書出し」でポータル一括送信に流せる。※「送信成功」はSMTP受理の意味で、実FAX到達は契約ドメイン/送信元登録次第。
- **バックアップ/復元**：⚙️設定で **エクスポート（.db、暗証番号4242）** と **インポート（.db復元、現データは`customers.db.bak`へ退避）**。`db.export_db_bytes`/`db.restore_db_bytes`。**別PCへのデータ移行はこのバックアップ.dbを持ち運んで復元**する（DBはgit非公開のため）。
- 起動：`cd tsuikyaku-crm && pip install -r requirements.txt`（初回のみ `python import_accdb.py <accdb>`）→ `python3 -m streamlit run app.py --server.port 8515`。社内共有は `TSUIKYAKU_DB` で共有フォルダ指定 or `--server.address 0.0.0.0`。テスト：`python smoke_test.py`（全ページ＋クレンジング）。
- **別PCへの引き継ぎ手順**：①`git pull` でコード取得 ②`pip install -r requirements.txt` ③このPCで **⚙️設定→エクスポート(4242)** した `tsuikyaku_backup_*.db` を別PCへ ④別PCで起動後 **⚙️設定→インポート** で復元（または `data/customers.db` に置く）。⑤設定（eFAXゲートウェイ/SMTP/自社情報/担当者マスタ）はDBに入るので復元すれば引き継がれる。
- **未対応/メモ**：Python 3.9系（`tuple|None`等は`from __future__ import annotations`で回避）。物件マスタ112件は未活用（将来「物件が出たら該当客へ一括FAX」の物件連動が拡張余地）。自動分類で拾えない詳細種別（おむすび→その他等）は個別修正 or `db.py`のキーワード追加。

### 新規アプリ：ai-ticket-counter（AI受付＆起票カウンター）★今回コミット
- 社内18アプリへの**不具合報告・改善要望・新アプリ希望**をチャットで受け付け、`claude` CLI が**対話でヒアリング**→**自動起票**→**報告書メール作成**する受付システム。**Python + FastAPI**（port 8600）。
- AI解析は既存アプリと同じ **claude CLI 方式**（`claude -p ... --output-format json --dangerously-skip-permissions --model sonnet`、画像は `--tools Read --add-dir <tmp>`）。APIキー不要。
- **対話フロー**：ブラウザ(`/`)で 報告者/要件/対象アプリ をプルダウン選択→「相談を開始」→ `services/intake.py` が業務口調で最大4問ヒアリング（`/chat` に会話履歴を毎回渡す）→十分集まったら確定。**「ここまでの内容でメール送信」**ボタンで途中打ち切り確定も可。
- **要件**＝不具合報告/改善要望/新アプリ希望/その他（`REQUEST_TYPES`）。不具合報告のみ深刻度(致命的/軽微)をAI判定。指定は `forced_kind`/`forced_app` でAI推測を上書き。
- **報告書メール**：既定は `MAIL_BACKEND=applescript`＝`osascript` で **Apple Mail に下書きを表示**（`services/mail_draft.applescript`）。宛先は `.env` の `MAIL_TO=shin@daikyocorp.co.jp`。**初回のみ macOS のオートメーション許可(Mail)が必要**。SMTP自動送信は `MAIL_BACKEND=smtp`。
- **起票先**：`TICKET_BACKEND`＝github/notion/backlog/excel を切替（`services/ticketing.py`）。現状 `.env` は検証用に `excel`（`data/tickets.csv`）。本番は `github`（gh CLI 認証済みならトークン不要、`GITHUB_REPO`）。
- 起動：`cd ai-ticket-counter && pip install -r requirements.txt && cp .env.example .env`（.envは各PCで作成）→ `python app.py`。単発テスト：`TICKET_BACKEND=excel python run_pipeline.py --text "..." --reporter 大鹿`。
- **未対応**：Slack実接続は未（アダプタ実装済み・トークン未設定）。GitHub Pages対象外（サーバアプリ）。当初「グローグー人格」で作ったがユーザー指示で業務口調に変更済み。

---

## 2026-07-01 セッションの作業

### 新規アプリ：neko-escape（にゃんこ大脱出）★未コミット/未公開
- 猫🐱がお掃除ロボット🤖から逃げてキャットタワー🏰を目指す**ターン制グラフ脱出パズル**。`neko-escape/index.html` の**一枚完結**（HTML/CSS/JS内包・外部依存なし）。ペープサート風UI。
- ルール：猫が隣接1マス移動→ロボットがBFS最短経路で追尾。同マス＝ゲームオーバー、タワー到達＝クリア。
- ギミック：🛋️ソファ(ロボ進入不可＝安全地帯)／🧶毛糸玉(ロボ1ターン停止)／🐟おさかな(猫もう1マス)／🕳️落とし穴(ロボ退場・永続穴)。
- **全20ステージ**（1-10基礎、11-20難化：ロボ最大3台・18-20は1台前方で挟撃・落とし穴多用）。
- **クリア可能性の検証必須**：`/tmp/solver3.py`（=JSの逐次ロボット移動・落とし穴永続・複数体を厳密再現する総当たりソルバー）。HTMLからSTAGES配列をパースし全戦略探索。**全20ステージOK確認済み**。ステージを触ったら必ず再検証すること。**単一ゲート前をロボットで封鎖できる構造は詰む**（旧ステージ6がそれで作り直した実績あり）。
- **未対応**：git未コミット（`.gitignore` に `!neko-escape/` 許可行は追加済み）／GitHub Pages 未公開。公開する場合は gh-pages ブランチに `neko-escape/` を配置し `https://shinsei99.github.io/project/neko-escape/`。

### 単発ファイル：送付書（大京）.xlsx
- `~/Downloads/送付書（大京）.doc/.pdf` を openpyxl で Excel レイアウト再現（`~/Downloads/送付書（大京）.xlsx`）。アプリではなく単発生成物。ビルドスクリプトはセッションのscratchpadのみ（永続化なし）。

---

## （以下、2026-06-30セッションの作業）

このセッションで行った作業と、別PCで再開するための手順をまとめます。
リポジトリ：`https://github.com/shinsei99/project`（ホーム直下 `/Users/apple` がワークツリー、main ブランチ）。
※ `quote-generator` だけは別リポジトリ `https://github.com/shinsei99/quote-generator`。

---

## 今回の作業サマリ

### 1. 新規アプリ：baikai-generator（媒介契約書ジェネレーター）
- 謄本PDF最大5枚 → 土地/建物/マンション自動判別 → 媒介契約書（一般/専任/専属専任）Excel自動生成。Streamlit、port 8514。
- AIは claude CLI（APIキー不要）。約款は標準媒介契約約款を `services/contract_text.py` にデータ化。
- 自社（乙）情報を名称で登録（`data/companies.json`＝**個人情報なのでgit対象外**。別PCでは再入力）。
- スキャン謄本は「**先に向き補正→解析**」（後述の pdf_orient 内蔵版）。
- 起動：`cd baikai-generator && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && streamlit run app.py --server.port 8514`

### 2. PDF/画像を読む全アプリに「解析前の向き(縦横/回転)自動補正」を導入
- 共有モジュール `pdf_orient.py`（各アプリ直下にコピー）。`ensure_upright_pdf / ensure_upright_image / ensure_upright_bytes`。
- 仕組み：PyMuPDFで画像化→haikuで正立角(0/90/180/270)判定→正立補正→sonnetで読取り。横向きスキャンで速度4.4倍・精度向上を実測。
- 導入：baikai-generator（registry_parser.py に内蔵）/ quote-generator / restoration-calculator / settlement-creator / realestate-valuation（registry・case・rosenka）/ handwriting-ocr / maisoku-converter / building-manager（orient_cli.py を route から python 呼び出し）。
- 依存追加：各 requirements.txt に `pymupdf`,`pillow`。building-manager は `requirements-orient.txt`（`pip3 install -r` 必要）。
- 対象外（テキスト抽出のみ）：jyuusetsu-research, legal-crosscheck, rentroll_parser, digital-shosai。

### 3. realestate-calc（不動産・金融マスター電卓）の改修
- 仲介手数料：**低廉な空家等の特例トグル**（800万円以下→上限33万円税込）。
- 住宅ローン控除：**2024・2025年入居基準を明記**＋住宅性能セレクタ（認定4,500/ZEH3,500/省エネ3,000/一般0万円）＋下部に制度解説パネル。
- **App Store申請準備**（mom-counterと同じCapacitorフロー）：
  - アイコン生成（icon-1024/512/192.png, apple-touch-icon.png、原本 assets/icon.png）
  - privacy.html、アプリ内 全体免責、capacitor.config.json、package.json、www/、RELEASE.md
  - 残作業は `realestate-calc/RELEASE.md` 参照（npm install → cap add ios → assets generate → cap open ios → 申請）。
  - PWA配信(gh-pages)は未更新。Web公開を更新するなら gh-pages へ別途反映が必要。

---

## 別PCでのセットアップ

```bash
# 1) 取得
git clone https://github.com/shinsei99/project.git   # もしくは既存ワークツリーで git pull
git clone https://github.com/shinsei99/quote-generator.git   # quote-generatorは別repo

# 2) 前提ツール
#  - claude CLI（~/.local/bin/claude もしくは /opt/homebrew/bin/claude）… AI読取りに必須
#  - python3（pymupdf, pillow が入ること）

# 3) 各Streamlitアプリは個別に venv 構築
cd <app> && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

# 4) 秘匿情報は各PCでローカル再作成（git対象外）
#  - <app>/.streamlit/secrets.toml（APIキー等）
#  - baikai-generator/data/companies.json（自社情報。アプリ上で再登録）
#  - jyuusetsu-research/templates/*.xlsx（白紙版を配置）
```

## 注意
- claude CLI 未インストールだとAI読取り系は簡易抽出/no-opにフォールバック（向き補正も自動スキップ、安全）。
- スキャンPDFのAI読取りは1枚あたり数分かかることがある。
- 詳細は各アプリの README.md、realestate-calc/RELEASE.md を参照。
