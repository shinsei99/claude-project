"""登記事項証明書 PDF のテキスト抽出・正規表現パース（pdfplumber 使用）。

完全自動を目指さず「下調べ・下書き」のための簡易抽出に徹する。
抽出失敗時は例外を投げず空文字で返す（呼び出し側で空欄継続）。
"""

import re
from typing import Dict, Optional

try:
    import pdfplumber
except Exception:  # pragma: no cover - 依存未インストール時も import を壊さない
    pdfplumber = None


def extract_text(pdf_file) -> str:
    """PDF（ファイルパス or file-like）から全文テキストを抽出する。

    失敗しても例外を投げず空文字を返す。
    """
    if pdfplumber is None or pdf_file is None:
        return ""
    try:
        text_parts = []
        with pdfplumber.open(pdf_file) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                text_parts.append(page_text)
        return "\n".join(text_parts)
    except Exception:
        return ""


def _search(pattern: str, text: str, group: int = 1) -> str:
    """正規表現で最初の一致を取り出す。なければ空文字。"""
    if not text:
        return ""
    m = re.search(pattern, text)
    if not m:
        return ""
    try:
        return m.group(group).strip()
    except Exception:
        return ""


def parse_land(text: str) -> Dict[str, str]:
    """土地の登記事項証明書から主要項目を抽出する。

    表題部（所在・地番・地目・地積）と権利部（所有者・抵当権）を簡易抽出。
    様式の揺れに備え複数パターンを試す。
    """
    result = {
        "所在地": "",
        "地番": "",
        "地目": "",
        "地積": "",
        "所有者": "",
        "抵当権": "",
    }
    if not text:
        return result

    # 所在（土地の所在は「所在」行、建物と区別するため市区町村〜丁目を拾う）
    result["所在地"] = _search(r"所\s*在[\s　]*([^\n]+)", text)
    # 地番
    result["地番"] = _search(r"地\s*番[\s　]*([0-9０-９\-－番地の]+)", text)
    # 地目
    result["地目"] = _search(r"地\s*目[\s　]*([^\s　\n0-9０-９]+)", text)
    # 地積（㎡）
    result["地積"] = _search(r"地\s*積[^0-9０-９]*([0-9０-９,，\.]+)\s*(?:㎡|平方メートル|m²)", text)

    result["所有者"] = _extract_owner(text)
    result["抵当権"] = _extract_mortgage(text)
    return result


def parse_building(text: str) -> Dict[str, str]:
    """建物の登記事項証明書から主要項目を抽出する。"""
    result = {
        "家屋番号": "",
        "種類": "",
        "構造": "",
        "床面積": "",
        "所有者": "",
        "抵当権": "",
    }
    if not text:
        return result

    result["家屋番号"] = _search(r"家\s*屋\s*番\s*号[\s　]*([0-9０-９\-－番のの]+)", text)
    result["種類"] = _search(r"種\s*類[\s　]*([^\s　\n]+)", text)
    # 構造（「鉄筋コンクリート造…」など、行末まで）
    result["構造"] = _search(r"構\s*造[\s　]*([^\n]+)", text)
    # 床面積（最初の数値）
    result["床面積"] = _search(r"床\s*面\s*積[^0-9０-９]*([0-9０-９,，\.]+)\s*(?:㎡|平方メートル|m²)", text)

    result["所有者"] = _extract_owner(text)
    result["抵当権"] = _extract_mortgage(text)
    return result


def _extract_owner(text: str) -> str:
    """権利部（甲区）の所有者を簡易抽出する。"""
    # 「所有者 ○○」または「所有権移転 … 所有者 ○○」
    owner = _search(r"所\s*有\s*者[\s　]*([^\n　 ]+)", text)
    if owner:
        return owner
    return ""


def _extract_mortgage(text: str) -> str:
    """権利部（乙区）の抵当権の有無を簡易判定する。"""
    if not text:
        return ""
    if re.search(r"抵\s*当\s*権", text):
        # 抹消されている場合の簡易考慮
        if re.search(r"抵\s*当\s*権.*抹\s*消", text):
            return "抵当権設定の記載あり（抹消の記載も有り・要確認）"
        return "抵当権設定の記載あり（乙区を要確認）"
    return "記載なし（乙区）"
