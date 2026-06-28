"""住所変換・位置情報サービス（すべて無料・APIキー不要）。

国土地理院の公開APIを利用する:
  - 住所 → 緯度経度: 地理院ジオコーディング（AddressSearch）
  - 緯度経度 → 市区町村コード: 逆ジオコーディング（LonLatToAddress）
さらに「全国地価マップ（路線価確認用）」への一発ジャンプURLを合成する。
"""

from __future__ import annotations

import urllib.parse

import requests

_GEOCODE_URL = "https://msearch.gsi.go.jp/address-search/AddressSearch"
_REVERSE_URL = "https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress"
_TIMEOUT = 15


class GeoError(RuntimeError):
    pass


def geocode(address: str) -> tuple[float, float] | None:
    """住所文字列を緯度経度に変換する。最も確度の高い結果を返す。

    返り値は (lat, lng)。該当なしは None。
    地番ベースの住所でも、地理院APIは町丁目レベルまで寄せて返すことが多い。
    """
    if not address.strip():
        return None
    try:
        resp = requests.get(_GEOCODE_URL, params={"q": address}, timeout=_TIMEOUT)
        resp.raise_for_status()
        results = resp.json()
    except Exception as e:
        raise GeoError(f"住所の緯度経度変換に失敗しました: {e}") from e

    if not results:
        return None
    # GeoJSON 形式: coordinates は [経度, 緯度]
    coords = results[0]["geometry"]["coordinates"]
    lng, lat = float(coords[0]), float(coords[1])
    return lat, lng


def reverse_muni_code(lat: float, lng: float) -> tuple[str, str]:
    """緯度経度から (市区町村コード5桁, 都道府県コード2桁) を求める。

    取得できなければ ("", "")。
    """
    try:
        resp = requests.get(
            _REVERSE_URL, params={"lat": lat, "lon": lng}, timeout=_TIMEOUT
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return "", ""

    muni = str(data.get("results", {}).get("muniCd", "")).strip()
    if not muni:
        return "", ""
    # muniCd は先頭ゼロが落ちることがあるため5桁にゼロ埋め
    muni = muni.zfill(5)
    return muni, muni[:2]


def chika_map_url(address: str) -> str:
    """全国地価マップ（路線価・公示地価確認用）の検索URLを合成する。

    住所をクエリに載せて検索画面を直接開けるようにする。
    """
    base = "https://www.chikamap.jp/chikamap/Map"
    q = urllib.parse.quote(address)
    # 住所検索パラメータ付きで地図を開く
    return f"{base}?mid=216&mpx=0&mpy=0&keyword={q}"


def resolve(address: str) -> dict:
    """住所から緯度経度・市区町村コード・地価マップURLをまとめて解決する。

    返り値: {lat, lng, muni_code, pref_code, chika_map_url}
    緯度経度が取れない場合は lat/lng が None。
    """
    out = {
        "lat": None,
        "lng": None,
        "muni_code": "",
        "pref_code": "",
        "chika_map_url": chika_map_url(address),
    }
    coords = geocode(address)
    if coords:
        out["lat"], out["lng"] = coords
        muni, pref = reverse_muni_code(*coords)
        out["muni_code"] = muni
        out["pref_code"] = pref
    return out
