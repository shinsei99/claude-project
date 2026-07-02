# -*- coding: utf-8 -*-
"""Access(.accdb) の顧客マスタを SQLite に取り込む（初回セットアップ用）。

    python import_accdb.py /path/to/物件顧客管理.accdb

- mdbtools の `mdb-export` を使って 顧客マスタ を読み出す。
- FAX 欄をクレンジングして発信用番号を作る。
- 既存の customers を全消しして入れ直す（--append で追記に変更可）。
"""

import csv
import io
import subprocess
import sys

import db
from services import cleaning


def export_table(accdb: str, table: str) -> list[dict]:
    out = subprocess.run(
        ["mdb-export", accdb, table],
        capture_output=True, text=True, check=True,
    ).stdout
    return list(csv.DictReader(io.StringIO(out)))


def main():
    if len(sys.argv) < 2:
        print("使い方: python import_accdb.py <accdbファイル> [--append]")
        sys.exit(1)
    accdb = sys.argv[1]
    append = "--append" in sys.argv

    db.init_db()
    rows = export_table(accdb, "顧客マスタ")
    print(f"顧客マスタ 読み込み: {len(rows)} 件")

    conn = db.connect()
    if not append:
        conn.execute("DELETE FROM customers")
        # 対応履歴/一括FAXは触らない（既に運用中なら --append を使うこと）
        # 分割済みフラグを立てておく（取込時点で大枠/詳細を投入するため）
        for k in ("shubetsu_split", "size_split"):
            conn.execute("INSERT INTO settings(key,value) VALUES(?, '1') "
                         "ON CONFLICT(key) DO UPDATE SET value='1'", (k,))

    ts = db.now()
    inserted = 0
    for r in rows:
        fax_raw = (r.get("FAX") or "").strip()
        gran = (r.get("種別") or "").strip()               # accdbの種別＝詳細
        tsubo = (r.get("店舗坪数") or "").strip()          # accdbの店舗坪数＝希望坪数詳細
        conn.execute(
            """INSERT INTO customers
               (id, 区分, 種別, 詳細種別, 企業規模, 店名, 会社名, 部署名, 先方担当,
                tel, fax, fax_dial, fax_raw, メール, その他連絡先, hp,
                希望坪数, 希望坪数詳細, 希望エリア, 可否, 備考, 社内担当,
                status, 次回追客日, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?)""",
            (
                int(r["ID"]) if r.get("ID") else None,
                "店舗",                                     # 既存はすべて店舗テナント需要
                db.classify_category(gran),                 # 大枠種別を自動分類
                gran,                                       # 詳細種別
                (r.get("企業規模") or "").strip(),
                (r.get("店名") or "").strip(),
                (r.get("会社名") or "").strip(),
                (r.get("部署名") or "").strip(),
                (r.get("担当者") or "").strip(),            # 先方の担当者
                cleaning.pretty(r.get("TEL") or ""),
                cleaning.pretty(fax_raw),
                cleaning.normalize_dial(fax_raw),
                fax_raw,
                (r.get("メール") or "").strip(),
                (r.get("その他連絡先") or "").strip(),
                (r.get("HPアドレス") or "").strip(),
                db.classify_size(tsubo),                    # 希望坪数（大枠）を自動分類
                tsubo,                                      # 希望坪数詳細
                (r.get("出店エリア") or "").strip(),
                (r.get("可否") or "可").strip(),
                (r.get("備考") or "").strip(),
                "",                                          # 社内担当は未割当で開始
                "未接触",
                "",
                ts, ts,
            ),
        )
        inserted += 1
    conn.commit()

    n = conn.execute("SELECT COUNT(*) c FROM customers").fetchone()["c"]
    fax_ok = conn.execute(
        "SELECT COUNT(*) c FROM customers WHERE fax_dial<>''"
    ).fetchone()["c"]
    conn.close()
    print(f"投入完了: {inserted} 件 / customers 合計 {n} 件")
    print(f"発信可能なFAX番号を抽出できた顧客: {fax_ok} 件")


if __name__ == "__main__":
    main()
