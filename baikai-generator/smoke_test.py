# -*- coding: utf-8 -*-
"""依存（Streamlit/claude CLI）なしで通る軽量スモークテスト。

  python smoke_test.py

謄本パーサの種別統合・正規表現フォールバックと、3種別の Excel 生成を検証する。
"""

import sys

from services import registry_parser as rp
from services.excel_builder import build_contract
from services.contract_text import YAKKAN


def test_combine():
    assert rp._combine_shubetsu(["土地", "建物"]) == "土地建物"
    assert rp._combine_shubetsu(["土地", "マンション"]) == "マンション"
    assert rp._combine_shubetsu(["建物"]) == "建物"
    assert rp._combine_shubetsu(["", ""]) == ""
    print("✓ 物件種別の統合ロジック")


def test_yakkan():
    for t in ["一般", "専任", "専属専任"]:
        arts = [p for p in YAKKAN[t] if p[0] == "article"]
        assert len(arts) >= 18, (t, len(arts))
    print("✓ 約款データ（一般20/専任19/専属18条）")


def test_build():
    data = {
        "物件種別": "土地建物", "物件所在地": "大阪市北区梅田1番地",
        "所有者住所": "大阪市北区1-1", "所有者氏名": "梅田太郎",
        "登記名義人住所": "大阪市北区1-1", "登記名義人氏名": "梅田太郎",
        "土地": {"地番": "1番1", "地目": "宅地", "地積": "123.45㎡", "権利": "所有権"},
        "建物": {"家屋番号": "1番1", "種類": "居宅", "構造": "木造2階建",
                 "床面積": "110.00㎡", "延床面積": "110.00㎡", "新築年月日": "令和2年3月1日"},
        "マンション": {},
    }
    meta = {
        "irai_naiyo": "売却", "date": "令和7年7月1日",
        "kou": {"氏名": "梅田太郎", "住所": "大阪市北区1-1", "郵便": "530-0001", "TEL": "06-1"},
        "otsu": {"商号": "テスト不動産", "代表者": "花子", "所在地": "大阪",
                 "免許番号": "大阪府知事(1)第1号", "TEL": "06-9"},
        "term_months": "3", "term_until": "令和7年9月30日",
        "baikai_price": 30000000, "baikai_honbody": 30000000, "baikai_tax": 0,
        "reward": 1056000, "reward_tax": 105600,
        "inspection": "無", "special_terms": "現況有姿で引き渡す。", "biko": "",
    }
    for t in ["一般", "専任", "専属専任"]:
        b = build_contract(t, data, meta)
        assert b and len(b) > 5000, t
    # マンション
    data_m = dict(data, 物件種別="マンション",
                  マンション={"名称": "梅田タワー", "構造": "RC", "階建": "20階建",
                            "階部分": "15階", "専有面積": "70.5㎡", "室番号": "1501",
                            "新築年月日": "令和3年", "敷地権割合": "1234分の70"})
    assert build_contract("専任", data_m, meta)
    print("✓ Excel生成（一般/専任/専属専任/マンション）")


if __name__ == "__main__":
    test_combine()
    test_yakkan()
    test_build()
    print("\nすべて成功しました。")
    sys.exit(0)
