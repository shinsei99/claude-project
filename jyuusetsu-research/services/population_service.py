"""人口・世帯数を e-Stat（政府統計）API で取得する。

e-Stat API は無料だが appId（無料登録）が必要。
- 環境変数 ESTAT_APP_ID があれば利用、なければ空欄で継続。

MVP では市区町村名での概況取得に留め、将来 統計表 ID 指定で精緻化できる構造とする。
緯度経度から市区町村を引くのは別途リバースジオコーディングが必要なため、
ここでは住所文字列から市区町村を簡易抽出して用いる。
"""

import os
import re
from typing import Dict

import requests

ESTAT_URL = "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData"
TIMEOUT = 15


def _extract_municipality(address: str) -> str:
    """住所文字列から「市区町村」までを簡易抽出する。"""
    if not address:
        return ""
    m = re.search(r"(.+?[都道府県])?(.+?[市区町村])", address)
    if m:
        return (m.group(1) or "") + m.group(2)
    return ""


def get_population(address: str) -> Dict[str, str]:
    """人口・世帯数を取得する。appId 未設定時は空文字で継続。

    注: e-Stat は統計表 ID 単位の取得のため、本 MVP では未設定時に空欄を返し、
    将来 国勢調査の統計表 ID と地域コードを指定して実装を差し替える。
    """
    result = {"人口": "", "世帯数": ""}
    app_id = os.environ.get("ESTAT_APP_ID", "").strip()
    if not app_id:
        return result

    # 将来拡張: statsDataId と cdArea（地域コード）を指定して取得する。
    # 地域コードの解決（住所→団体コード）が必要なため、ここでは導線のみ用意。
    _ = _extract_municipality(address)
    return result
