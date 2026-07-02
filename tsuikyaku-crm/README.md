# 顧客追客マネージャー（tsuikyaku-crm）

テナント需要客（飲食・医療・エステ・塾など）への**追客（フォローアップ営業）を管理する**業務アプリ。
Access の `物件顧客管理.accdb`（顧客マスタ688件）を種データとして取り込み、SQLite で運用します。

## できること

- **顧客一覧・検索** … 区分／種別／ステータス／社内担当／キーワードで絞り込み
- **対応履歴** … 「いつ・誰が・どう営業したか」を記録（空だった Access の対応履歴をやっと活用）
- **次回追客日リマインド** … ダッシュボードに「今日までに追客すべき先」を自動表示、放置防止
- **一括FAX追客** … 対象を絞ってeFAXで一括送信 or 送付リストCSV出力。送った先は自動で履歴＋次回追客日を更新
- **社内担当の割当** … 各顧客に担当営業を割当て、担当別に表示。誰がどの客を対応中か分かる
- **顧客区分** … 店舗系／駐車場希望／住居希望。既存にない客もここで追加登録

## セットアップ

```bash
cd tsuikyaku-crm
pip install -r requirements.txt

# 初回：Access から顧客688件を取り込む（mdbtools が必要: brew install mdbtools）
python import_accdb.py /path/to/物件顧客管理.accdb

# 起動（streamlit が PATH に無ければ python3 -m streamlit run ... でも可）
streamlit run app.py --server.port 8515
```

ブラウザで http://localhost:8515 を開きます。

## 社内で複数人共有する

データは SQLite（`data/customers.db`）に入ります。共有方法は2通り：

1. **共有フォルダ運用**：環境変数でDBを共有フォルダに置く
   ```bash
   TSUIKYAKU_DB="/共有/customers.db" streamlit run app.py --server.port 8515
   ```
2. **LAN運用**：1台で起動し、他PCはブラウザからアクセス
   ```bash
   streamlit run app.py --server.port 8515 --server.address 0.0.0.0
   # 他PCから http://<起動PCのIP>:8515
   ```

## eFAX（一括FAX）の設定

eFAX は「`FAX番号@ゲートウェイドメイン` 宛のメール送信」でFAXを送れます。
⚙️設定 で **ゲートウェイドメイン**（例 `efaxsend.com`。契約により異なる）と
**SMTP情報**（Gmailならアプリパスワード）を登録すると自動送信できます。

設定が分からない場合でも、**送付リストCSV書き出し**方式で eFAX のポータル一括送信に流し込めます。

## データ再取込

`import_accdb.py` は既定で customers を入れ直します（対応履歴・一括FAXログは保持）。
運用開始後に追記だけしたい場合は `--append` を付けてください。

## ポート

`8515`（既存アプリと重複しない番号）
