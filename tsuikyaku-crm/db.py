# -*- coding: utf-8 -*-
"""SQLite スキーマとアクセスヘルパ。

DBファイルの場所は環境変数 TSUIKYAKU_DB で差し替え可能。
社内共有する場合は共有フォルダ(Dropbox/ネットワークドライブ)のパスを指定するか、
1台で `streamlit run app.py --server.address 0.0.0.0` して LAN 経由でアクセスする。
"""

import os
import sqlite3
from datetime import datetime

DB_PATH = os.environ.get(
    "TSUIKYAKU_DB",
    os.path.join(os.path.dirname(__file__), "data", "customers.db"),
)

# 顧客区分（トップレベル分類）
KUBUN = ["店舗", "事務所", "住居", "駐車場", "収益", "その他"]

# 重要度
IMPORTANCE = ["低", "中", "高"]

# 店舗の希望規模（小規模=20坪以下 / 中規模=50坪以下 / 大規模=それ以上）
SIZE = ["小規模", "中規模", "大規模"]


def classify_size(text: str) -> str:
    """希望坪数の文字列から規模（小規模/中規模/大規模）を推定する。数字が無ければ ''。

    小規模=20坪以下 / 中規模=50坪以下 / 大規模=それ超。
    範囲（例 20～50坪）は含まれる数字の平均で判定する。
    """
    import re
    nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", text or "")]
    if not nums:
        return ""
    avg = sum(nums) / len(nums)
    if avg <= 20:
        return "小規模"
    if avg <= 50:
        return "中規模"
    return "大規模"

# 住居区分のときの種別
JUKYO_SHUBETSU = ["売買", "賃貸"]

# 店舗区分の大枠種別
BIG_SHUBETSU = ["飲食", "物販", "サービス", "その他"]

# 大枠種別の自動分類キーワード（詳細種別の文字列から推定）
_SERVICE_KW = ["インターネットカフェ", "ネットカフェ", "漫画", "まんが", "コミック",
               "はり", "きゅう", "鍼", "灸", "医院", "クリニック", "歯科", "病院",
               "エステ", "サロン", "美容", "理容", "塾", "教室", "スクール",
               "カイロ", "整体", "マッサージ", "接骨", "整骨", "医療", "コンサル",
               "ジム", "フィットネス", "クリーニング", "不動産", "保育", "託児",
               "ネイル", "リラク", "占い"]
_FOOD_KW = ["ラーメン", "らーめん", "居酒屋", "飲食", "定食", "喫茶", "カフェ",
            "レストラン", "焼肉", "お好み", "たこ焼", "寿司", "すし", "鮨",
            "ハンバーガー", "テイクアウト", "菓子", "サンドイッチ", "弁当", "バー",
            "ダイニング", "食堂", "焼鳥", "やきとり", "焼き鳥", "そば", "うどん",
            "カレー", "ピザ", "ピッツ", "ドーナツ", "アイス", "パン", "ベーカリー",
            "スイーツ", "ケーキ", "牛丼", "丼", "串", "鍋", "うなぎ", "天ぷら",
            "中華", "韓国料理", "イタリアン", "フレンチ", "酒場"]
_RETAIL_KW = ["物販", "販売", "ショップ", "雑貨", "アパレル", "衣料", "ブティック",
              "ドラッグ", "薬局", "書店", "古本", "リサイクル", "携帯", "メガネ",
              "眼鏡", "時計", "宝石", "フラワー", "100円", "百円", "ストア",
              "スーパー", "コンビニ", "ペット", "家具", "家電", "カー用品",
              "自転車", "おもちゃ", "化粧品", "靴", "衣料品"]


def classify_category(detail: str) -> str:
    """詳細種別の文字列から大枠種別（飲食/物販/サービス/その他）を推定する。"""
    import unicodedata
    d = unicodedata.normalize("NFKC", detail or "")   # 半角カナ等を全角へ正規化
    if any(k in d for k in _SERVICE_KW):   # ネットカフェ等を飲食より先に判定
        return "サービス"
    if any(k in d for k in _FOOD_KW):
        return "飲食"
    if any(k in d for k in _RETAIL_KW):
        return "物販"
    return "その他"

# 追客ステータス
STATUS = ["未接触", "追客中", "商談中", "成約", "見送り"]

# 対応履歴の種別
CONTACT_KINDS = ["TEL", "FAX", "一括FAX", "メール", "資料送付", "来店", "訪問", "その他"]


def connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")       # 複数人の軽い同時アクセスに強くする
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


SCHEMA = """
CREATE TABLE IF NOT EXISTS customers (
    id           INTEGER PRIMARY KEY,
    区分         TEXT DEFAULT '店舗',
    重要度       TEXT DEFAULT '低',
    希望物件     TEXT DEFAULT '',       -- 特定物件を希望している場合に記入
    種別         TEXT,                  -- 大枠（飲食/物販/サービス/その他、住居は売買/賃貸）
    詳細種別     TEXT DEFAULT '',       -- 業種の詳細（ラーメン・医院・エステ等）
    希望坪数詳細 TEXT DEFAULT '',       -- 希望坪数の詳細（元の自由記入 例 20～50坪）
    企業規模     TEXT,
    店名         TEXT,
    会社名       TEXT,
    部署名       TEXT,
    先方担当     TEXT,
    tel          TEXT,
    fax          TEXT,          -- 表示用(整形済み)
    fax_dial     TEXT,          -- 発信用(数字のみ)
    fax_raw      TEXT,          -- 元データ
    メール       TEXT,
    その他連絡先 TEXT,
    hp           TEXT,
    希望坪数     TEXT,
    希望エリア   TEXT,
    可否         TEXT DEFAULT '可',
    備考         TEXT,
    社内担当     TEXT,          -- 当社の担当営業
    status       TEXT DEFAULT '未接触',
    次回追客日   TEXT,          -- YYYY-MM-DD
    created_at   TEXT,
    updated_at   TEXT
);

CREATE TABLE IF NOT EXISTS contact_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    日付         TEXT,          -- YYYY-MM-DD
    種別         TEXT,
    担当         TEXT,
    結果         TEXT,
    次回追客日   TEXT,
    メモ         TEXT,
    broadcast_id INTEGER,       -- 一括FAX送信ロットのID(あれば)
    created_at   TEXT
);

CREATE TABLE IF NOT EXISTS staff (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    名前   TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS fax_broadcasts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    日時       TEXT,
    担当       TEXT,
    件名       TEXT,
    本文       TEXT,
    対象件数   INTEGER,
    成功件数   INTEGER,
    方式       TEXT,            -- 'eFAXメール送信' / 'エクスポート'
    メモ       TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE INDEX IF NOT EXISTS idx_hist_customer ON contact_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_kubun    ON customers(区分);
CREATE INDEX IF NOT EXISTS idx_cust_tantou   ON customers(社内担当);
CREATE INDEX IF NOT EXISTS idx_cust_next     ON customers(次回追客日);
"""


def _has_column(conn, table, col) -> bool:
    return col in [r["name"] for r in conn.execute(f"PRAGMA table_info({table})")]


def migrate():
    """既存DBへ新カラムを追加し、旧区分の呼称を新方式へ移行する（何度実行しても安全）。"""
    conn = connect()
    if not _has_column(conn, "customers", "重要度"):
        conn.execute("ALTER TABLE customers ADD COLUMN 重要度 TEXT DEFAULT '低'")
    if not _has_column(conn, "customers", "希望物件"):
        conn.execute("ALTER TABLE customers ADD COLUMN 希望物件 TEXT DEFAULT ''")
    if not _has_column(conn, "customers", "詳細種別"):
        conn.execute("ALTER TABLE customers ADD COLUMN 詳細種別 TEXT DEFAULT ''")
    if not _has_column(conn, "customers", "希望坪数詳細"):
        conn.execute("ALTER TABLE customers ADD COLUMN 希望坪数詳細 TEXT DEFAULT ''")
    # 希望坪数を「詳細へ退避＋大枠へ分類」（一度だけ）
    sflag = conn.execute(
        "SELECT value FROM settings WHERE key='size_split'").fetchone()
    if not (sflag and sflag["value"] == "1"):
        for r in conn.execute("SELECT id, 希望坪数 FROM customers").fetchall():
            raw = r["希望坪数"] or ""
            conn.execute("UPDATE customers SET 希望坪数詳細=?, 希望坪数=? WHERE id=?",
                         (raw, classify_size(raw), r["id"]))
        conn.execute("INSERT INTO settings(key,value) VALUES('size_split','1') "
                     "ON CONFLICT(key) DO UPDATE SET value='1'")
    # 旧「種別（詳細）」→「詳細種別」へ退避し、種別は大枠へ分類（一度だけ）
    flag = conn.execute(
        "SELECT value FROM settings WHERE key='shubetsu_split'").fetchone()
    if not (flag and flag["value"] == "1"):
        for r in conn.execute("SELECT id, 種別, 区分 FROM customers").fetchall():
            gran = r["種別"] or ""
            if r["区分"] == "住居":
                big = gran if gran in JUKYO_SHUBETSU else ""
            else:
                big = classify_category(gran)
            conn.execute("UPDATE customers SET 詳細種別=?, 種別=? WHERE id=?",
                         (gran, big, r["id"]))
        conn.execute("INSERT INTO settings(key,value) VALUES('shubetsu_split','1') "
                     "ON CONFLICT(key) DO UPDATE SET value='1'")
    # 旧区分 → 新区分
    conn.execute("UPDATE customers SET 区分='店舗'   WHERE 区分='店舗系'")
    conn.execute("UPDATE customers SET 区分='駐車場' WHERE 区分='駐車場希望'")
    conn.execute("UPDATE customers SET 区分='住居'   WHERE 区分='住居希望'")
    # 重要度の空欄は「低」で埋める
    conn.execute("UPDATE customers SET 重要度='低' WHERE 重要度 IS NULL OR 重要度=''")
    # 重要度カラムが揃ってからインデックス作成
    conn.execute("CREATE INDEX IF NOT EXISTS idx_cust_juyodo ON customers(重要度)")
    conn.commit()
    conn.close()


def init_db():
    conn = connect()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
    migrate()


# ---- バックアップ / 復元 ----
def export_db_bytes() -> bytes:
    """現在のDBを1ファイルのバイト列で返す（WALを反映してから読む）。"""
    conn = connect()
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    conn.close()
    with open(DB_PATH, "rb") as f:
        return f.read()


def restore_db_bytes(data: bytes):
    """アップロードされたDBファイルで現在のDBを置き換える（復元）。

    - このアプリのDBか検証（customers テーブルの有無）。
    - 現在のDBは customers.db.bak に退避してから差し替える。
    """
    tmp = DB_PATH + ".uploaded"
    with open(tmp, "wb") as f:
        f.write(data)
    # 検証：SQLiteとして開けて、customers テーブルがあるか
    try:
        c = sqlite3.connect(tmp)
        names = {r[0] for r in c.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")}
        c.close()
    except Exception as e:
        os.remove(tmp)
        raise ValueError(f"SQLiteファイルとして読み込めません: {e}")
    if "customers" not in names:
        os.remove(tmp)
        raise ValueError("このアプリのバックアップではありません（customers が見つかりません）")

    # 現在のDBを退避し、WAL/SHM を掃除してから差し替え
    if os.path.exists(DB_PATH):
        os.replace(DB_PATH, DB_PATH + ".bak")
    for ext in ("-wal", "-shm"):
        p = DB_PATH + ext
        if os.path.exists(p):
            os.remove(p)
    os.replace(tmp, DB_PATH)
    init_db()          # 取り込んだDBのスキーマを最新へ整える


# ---- settings 簡易 KV ----
def get_setting(key: str, default: str = "") -> str:
    conn = connect()
    row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else default


def set_setting(key: str, value: str):
    conn = connect()
    conn.execute(
        "INSERT INTO settings(key,value) VALUES(?,?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )
    conn.commit()
    conn.close()


# ---- staff ----
def list_staff() -> list[str]:
    conn = connect()
    rows = conn.execute("SELECT 名前 FROM staff ORDER BY id").fetchall()
    conn.close()
    return [r["名前"] for r in rows]


def add_staff(name: str):
    name = (name or "").strip()
    if not name:
        return
    conn = connect()
    conn.execute("INSERT OR IGNORE INTO staff(名前) VALUES(?)", (name,))
    conn.commit()
    conn.close()


def remove_staff(name: str):
    conn = connect()
    conn.execute("DELETE FROM staff WHERE 名前=?", (name,))
    conn.commit()
    conn.close()
