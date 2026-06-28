"""周辺施設（学校・病院・スーパー・公園）を OpenStreetMap Overpass API で取得する。

無料・キー不要。失敗時は空リストを返しアプリは止めない。
"""

from typing import Dict, List

import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
TIMEOUT = 25

# 取得カテゴリ → Overpass のタグ条件
CATEGORIES = {
    "学校": '["amenity"~"school|kindergarten"]',
    "病院": '["amenity"~"hospital|clinic|doctors"]',
    "スーパー": '["shop"~"supermarket|convenience"]',
    "公園": '["leisure"="park"]',
}


def nearby_facilities(lat: float, lon: float, radius: int = 800) -> Dict[str, List[str]]:
    """半径 radius(m) 内の施設名をカテゴリ別に取得する。

    戻り値: {"学校": [...], "病院": [...], "スーパー": [...], "公園": [...]}
    """
    empty = {cat: [] for cat in CATEGORIES}
    if lat is None or lon is None:
        return empty

    # 1 クエリで全カテゴリをまとめて取得
    parts = []
    for cond in CATEGORIES.values():
        parts.append('node{}(around:{},{},{});'.format(cond, radius, lat, lon))
        parts.append('way{}(around:{},{},{});'.format(cond, radius, lat, lon))
    query = "[out:json][timeout:25];({});out center tags;".format("".join(parts))

    try:
        resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=TIMEOUT)
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
    except Exception:
        return empty

    result = {cat: [] for cat in CATEGORIES}
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name")
        if not name:
            continue
        for cat, _ in CATEGORIES.items():
            if _matches(cat, tags) and name not in result[cat]:
                result[cat].append(name)
    # 各カテゴリ最大 5 件に絞る（下調べ用途）
    for cat in result:
        result[cat] = result[cat][:5]
    return result


def _matches(category: str, tags: Dict[str, str]) -> bool:
    if category == "学校":
        return tags.get("amenity") in ("school", "kindergarten")
    if category == "病院":
        return tags.get("amenity") in ("hospital", "clinic", "doctors")
    if category == "スーパー":
        return tags.get("shop") in ("supermarket", "convenience")
    if category == "公園":
        return tags.get("leisure") == "park"
    return False
