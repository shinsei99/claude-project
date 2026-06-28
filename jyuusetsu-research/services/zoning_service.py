"""用途地域・建ぺい率・容積率・防火地域・高度地区を取得する。

無料でキー不要のリアルタイム用途地域 API は存在しないため、
国土交通省「不動産情報ライブラリ」API（無料・要登録キー）を任意で利用する。

- 環境変数 REINFOLIB_API_KEY があれば自動取得を試みる
- なければ空欄で継続（重説ドラフトでは「要手動確認」として扱う）

ポリゴン内外判定は pure-Python のレイキャスティングで行う（追加依存なし）。
"""

import math
import os
from typing import Dict, List, Optional, Tuple

import requests

REINFOLIB_URL = "https://www.reinfolib.mlit.go.jp/ex-api/external/XKT001"
TIMEOUT = 15
ZOOM = 13  # 用途地域 API が対応するズーム（11〜15）


def _deg2tile(lat: float, lon: float, zoom: int) -> Tuple[int, int]:
    """緯度経度 → スリッピーマップのタイル座標 (x, y)。"""
    lat_rad = math.radians(lat)
    n = 2.0 ** zoom
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return x, y


def _point_in_ring(lon: float, lat: float, ring: List[List[float]]) -> bool:
    """レイキャスティングによる多角形内外判定。ring は [[lon,lat],...]。"""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi
        ):
            inside = not inside
        j = i
    return inside


def _feature_contains(feature: Dict, lon: float, lat: float) -> bool:
    geom = feature.get("geometry", {})
    gtype = geom.get("type")
    coords = geom.get("coordinates", [])
    try:
        if gtype == "Polygon":
            return _point_in_ring(lon, lat, coords[0])
        if gtype == "MultiPolygon":
            for poly in coords:
                if _point_in_ring(lon, lat, poly[0]):
                    return True
    except Exception:
        return False
    return False


def get_zoning(lat: float, lon: float) -> Dict[str, str]:
    """用途地域等を取得する。取得できなければ空文字。"""
    result = {
        "用途地域": "",
        "建ぺい率": "",
        "容積率": "",
        "防火地域": "",
        "高度地区": "",
    }
    api_key = os.environ.get("REINFOLIB_API_KEY", "").strip()
    if not api_key or lat is None or lon is None:
        return result

    x, y = _deg2tile(lat, lon, ZOOM)
    try:
        resp = requests.get(
            REINFOLIB_URL,
            params={"response_format": "geojson", "z": ZOOM, "x": x, "y": y},
            headers={"Ocp-Apim-Subscription-Key": api_key},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        features = resp.json().get("features", [])
    except Exception:
        return result

    for feat in features:
        if _feature_contains(feat, lon, lat):
            props = feat.get("properties", {})
            result["用途地域"] = str(props.get("youto_chiki", "") or "")
            kenpei = props.get("kenpei", "")
            yoseki = props.get("yoseki", "")
            result["建ぺい率"] = "{}%".format(kenpei) if kenpei not in ("", None) else ""
            result["容積率"] = "{}%".format(yoseki) if yoseki not in ("", None) else ""
            result["防火地域"] = str(props.get("bouka", "") or "")
            result["高度地区"] = str(props.get("kodo", "") or "")
            break
    return result
