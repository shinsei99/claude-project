# -*- coding: utf-8 -*-
"""AppTest で各ページを実際に実行し、例外が出ないか確認する簡易スモークテスト。

    python smoke_test.py
"""
import sys
from streamlit.testing.v1 import AppTest

import db
from services import cleaning, fax


def check_cleaning():
    cases = {
        "6882-0614　6882-0646立地開発/芦田": "0668820614",
        "0422-36-9188": "0422369188",
        "Fax：072-631-2271　6242-8782": "0726312271",
        "6309-4631　Fax.03-3971-4143": "0663094631",
    }
    for raw, want in cases.items():
        got = cleaning.normalize_dial(raw)
        assert got == want, f"cleaning失敗: {raw!r} → {got} (期待 {want})"
    print("✅ FAXクレンジング OK")


def check_pages():
    pages = ["🏠 ダッシュボード", "👥 顧客一覧・検索",
             "➕ 顧客追加", "🔁 重複チェック", "📠 一括FAX追客", "⚙️ 設定"]
    for p in pages:
        at = AppTest.from_file("app.py", default_timeout=30).run()
        assert not at.exception, f"初期描画で例外: {p}: {at.exception}"
        at.session_state["nav"] = p
        at.run()
        assert not at.exception, f"ページ描画で例外: {p}: {at.exception}"
        print(f"✅ ページOK: {p}")


def check_broadcast_export():
    rows = db.connect().execute(
        "SELECT * FROM customers WHERE fax_dial<>'' LIMIT 3").fetchall()
    rows = [dict(r) for r in rows]
    data = fax.export_csv(rows, "{会社名} {店名} 御中")
    assert data and b"," in data, "CSVエクスポート失敗"
    print(f"✅ 送付リストCSV書き出し OK（{len(rows)}件）")


if __name__ == "__main__":
    db.init_db()
    check_cleaning()
    check_broadcast_export()
    check_pages()
    print("\n🎉 スモークテスト全て通過")
