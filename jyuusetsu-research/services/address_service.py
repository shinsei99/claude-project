"""住所 → 緯度経度・最寄駅 を無料データで取得する。

- ジオコーディング: 国土地理院 住所検索 API（無料・キー不要）
- 最寄駅: HeartRails Express API（無料・キー不要）

API 失敗時はアプリを止めず、空の結果を返す（呼び出し側で空欄継続）。
有料 API / Google Maps API は使用しない。
"""

from typing import Dict, Optional, Tuple

import requests

GSI_GEOCODE_URL = "https://msearch.gsi.go.jp/address-search/AddressSearch"
HEARTRAILS_URL = "http://express.heartrails.com/api/json"
TIMEOUT = 10


def geocode(address: str) -> Optional[Tuple[float, float]]:
    """住所を緯度経度 (lat, lon) に変換する。失敗時は None。"""
    address = (address or "").strip()
    if not address:
        return None
    try:
        resp = requests.get(GSI_GEOCODE_URL, params={"q": address}, timeout=TIMEOUT)
        resp.raise_for_status()
        results = resp.json()
        if not results:
            return None
        # GeoJSON: coordinates = [lon, lat]
        lon, lat = results[0]["geometry"]["coordinates"]
        return float(lat), float(lon)
    except Exception:
        return None


def nearest_station(lat: float, lon: float) -> Dict[str, str]:
    """緯度経度から最寄駅と距離を取得する（HeartRails Express）。

    戻り値: {"最寄駅": "...駅（...線）", "駅距離": "約 ... m"}
    失敗時は空文字。
    """
    result = {"最寄駅": "", "駅距離": ""}
    if lat is None or lon is None:
        return result
    try:
        resp = requests.get(
            HEARTRAILS_URL,
            params={"method": "getStations", "x": lon, "y": lat},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        stations = resp.json().get("response", {}).get("station", [])
        if not stations:
            return result
        st = stations[0]  # 距離順で先頭が最寄り
        name = st.get("name", "")
        line = st.get("line", "")
        distance = st.get("distance", "")  # 例 "350m"
        if name:
            result["最寄駅"] = "{}駅（{}）".format(name, line) if line else "{}駅".format(name)
        if distance:
            result["駅距離"] = "約 {}".format(distance)
    except Exception:
        return result
    return result


def investigate(address: str) -> Dict:
    """住所からの自動調査の入口。

    戻り値:
      {
        "coords": (lat, lon) or None,
        "data": { PropertyData にマージするキー群 },
      }
    """
    coords = geocode(address)
    data = {"所在地": address.strip()} if address else {}
    if coords:
        lat, lon = coords
        data.update(nearest_station(lat, lon))
    return {"coords": coords, "data": data}
