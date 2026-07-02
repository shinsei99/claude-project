# -*- coding: utf-8 -*-
"""電話・FAX番号のクレンジング。

元データ（Access 顧客マスタ）のFAX欄は
  "6882-0614　6882-0646立地開発/芦田"
のように「番号＋メモ」や複数番号が混在している。
一括FAX送信で使えるよう、先頭の有効番号を抽出し、
大阪中心のデータなので市外局番0落ち（例 6882-0614 → 06-6882-0614）を補正する。
"""

import re

# 全角→半角（数字・ハイフン・空白）。全角スペースは半角スペースにして番号の区切りとして残す
_Z2H = str.maketrans("０１２３４５６７８９－―ー−　", "0123456789---- ")

# 番号らしき最初のかたまり。空白は区切りとして扱う（連結された複数番号を1本目だけ拾う）
_NUM_RE = re.compile(r"\d[\d\-]{5,}\d")


def _z2h(s: str) -> str:
    return (s or "").translate(_Z2H)


def extract_first(raw: str) -> str:
    """メモ混じりの文字列から先頭の番号(ハイフン付き表示)を1つ取り出す。無ければ ''。

    空白・全角空白は番号の区切り。'Fax：072-...' のような接頭ラベルは無視して
    最初に現れる番号のかたまりを返す。
    """
    s = _z2h(raw)
    m = _NUM_RE.search(s)
    return m.group(0) if m else ""


def digits(raw: str) -> str:
    """数字のみを返す。"""
    return re.sub(r"\D", "", _z2h(raw))


def normalize_dial(raw: str) -> str:
    """発信に使える数字のみの番号を返す。大阪の市外局番0落ちを補正。

    - 10〜11桁で先頭0 … そのまま
    - 9桁で先頭0でない … 先頭に0を付与
    - 8桁 … 大阪市内(06)とみなし '06' を付与
    - それ以外 … そのまま（UIで手直し前提）
    """
    d = digits(extract_first(raw))
    if not d:
        return ""
    if d.startswith("0") and len(d) in (10, 11):
        return d
    if len(d) == 9 and not d.startswith("0"):
        return "0" + d
    if len(d) == 8:
        return "06" + d
    return d


def pretty(raw: str) -> str:
    """表示用にハイフン付きへ。補正後の数字を 0X-XXXX-XXXX 風に整形。"""
    d = normalize_dial(raw)
    if len(d) == 10 and d.startswith("06"):          # 06-XXXX-XXXX
        return f"{d[:2]}-{d[2:6]}-{d[6:]}"
    if len(d) == 10 and d.startswith("0"):           # 0X-XXXX-XXXX / 0XX-XXX-XXXX
        return f"{d[:3]}-{d[3:6]}-{d[6:]}"
    if len(d) == 11:                                  # 携帯 0X0-XXXX-XXXX
        return f"{d[:3]}-{d[3:7]}-{d[7:]}"
    return extract_first(raw) or raw or ""
