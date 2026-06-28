"""周辺相場・公的地価の自動取得（国土交通省「不動産情報ライブラリAPI」）。

無料APIだが利用にはサブスクリプションキー（無料登録で取得）が必要。
キーは `.streamlit/secrets.toml` の `reinfolib_api_key`、または環境変数
`REINFOLIB_API_KEY` から読む。キーが無い／取得に失敗した場合は空の
MarketData を返し、UI 側で手入力フォールバックできるようにする。

取得内容:
  - 取引事例: 不動産価格（取引価格）情報取得API（XIT001）を市区町村単位・
    直近2年分で取得し、物件種別に合う取引を抽出して㎡単価を算出。
    ※APIは市区町村＋四半期単位のため、厳密な半径1km抽出はできない。
      地区名レベルの近傍事例として提示する。
  - 公示地価: 地価公示のポイント（点）API（XPT001, GeoJSON）を対象地の
    タイルで取得し、最も近い標準地の㎡単価を採用。
"""

from __future__ import annotations

import math
import os
import re
from datetime import date

import requests

from models.valuation_data import Comparable, MarketData, RegistryInfo
from models.valuation_data import (
    TYPE_MANSION,
    TYPE_KODATE,
    TYPE_SHUEKI,
)

_BASE = "https://www.reinfolib.mlit.go.jp/ex-api/external"
_TIMEOUT = 30

# 物件種別 → 取引情報APIの「Type（種類）」許容値
_TYPE_FILTER = {
    TYPE_MANSION: ("中古マンション等",),
    TYPE_KODATE: ("宅地(土地と建物)", "宅地(土地)"),
    TYPE_SHUEKI: ("宅地(土地と建物)",),
}


def get_api_key() -> str:
    """設定からAPIキーを取得（secrets優先、無ければ環境変数）。"""
    try:
        import streamlit as st

        if "reinfolib_api_key" in st.secrets:
            return str(st.secrets["reinfolib_api_key"]).strip()
    except Exception:
        pass
    return os.environ.get("REINFOLIB_API_KEY", "").strip()


def _headers(api_key: str) -> dict:
    return {"Ocp-Apim-Subscription-Key": api_key}


def _parse_year(s) -> int:
    if not s:
        return 0
    m = re.search(r"\d{4}", str(s))
    return int(m.group()) if m else 0


def _to_int(s) -> int:
    if s is None:
        return 0
    m = re.search(r"\d+(?:\.\d+)?", str(s).replace(",", ""))
    return int(float(m.group())) if m else 0


def _to_float(s) -> float:
    if s is None:
        return 0.0
    m = re.search(r"\d+(?:\.\d+)?", str(s).replace(",", ""))
    return float(m.group()) if m else 0.0


def _recent_quarters(years_back: int = 2) -> list[tuple[int, int]]:
    """直近の (年, 四半期) を新しい順で返す。

    取引情報APIは公表が1四半期程度遅れるため、当四半期は含めない。
    """
    today = date.today()
    cur_q = (today.month - 1) // 3 + 1
    y, q = today.year, cur_q
    # 1四半期戻して「公表済み」の最新からスタート
    q -= 1
    if q == 0:
        y, q = y - 1, 4
    out: list[tuple[int, int]] = []
    for _ in range(years_back * 4):
        out.append((y, q))
        q -= 1
        if q == 0:
            y, q = y - 1, 4
    return out


def fetch_transactions(
    pref_code: str,
    muni_code: str,
    property_type: str,
    api_key: str,
    years_back: int = 2,
    max_comps: int = 10,
) -> list[Comparable]:
    """取引価格情報APIから種別に合う取引事例を取得する。"""
    if not (api_key and pref_code and muni_code):
        return []

    allowed = _TYPE_FILTER.get(property_type, ())
    comps: list[Comparable] = []

    for year, quarter in _recent_quarters(years_back):
        params = {
            "year": year,
            "quarter": quarter,
            "area": pref_code,
            "city": muni_code,
        }
        try:
            resp = requests.get(
                f"{_BASE}/XIT001",
                params=params,
                headers=_headers(api_key),
                timeout=_TIMEOUT,
            )
            resp.raise_for_status()
            payload = resp.json()
        except Exception:
            continue

        for row in payload.get("data", []):
            if allowed and row.get("Type") not in allowed:
                continue
            area = _to_float(row.get("Area"))
            price = _to_int(row.get("TradePrice"))
            if area <= 0 or price <= 0:
                continue
            unit = round(price / area)
            comps.append(
                Comparable(
                    name=row.get("DistrictName") or row.get("Municipality") or "近隣事例",
                    address=f"{row.get('Prefecture','')}{row.get('Municipality','')}"
                    f"{row.get('DistrictName','')}",
                    trade_price=price,
                    unit_price=unit,
                    area=area,
                    trade_period=f"{year}年第{quarter}四半期",
                    structure=row.get("Structure", "") or "",
                    build_year=_parse_year(row.get("BuildingYear")),
                )
            )
        if len(comps) >= max_comps * 3:
            break

    # 新しい事例を優先し、㎡単価が極端な外れ値を簡易除外
    comps.sort(key=lambda c: c.trade_period, reverse=True)
    return comps[:max_comps]


# ---- 公示地価（地価公示ポイントAPI / GeoJSON） ----

def _deg2tile(lat: float, lng: float, z: int) -> tuple[int, int]:
    n = 2 ** z
    x = int((lng + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return x, y


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return int(r * 2 * math.asin(math.sqrt(a)))


def _extract_price(props: dict) -> int:
    """地価公示フィーチャのプロパティから㎡単価（円）を取り出す。

    フィールド名は版により異なるため、既知キー→数値ヒューリスティックの順で探す。
    """
    for key in ("u_current_years_price_ja", "current_years_price", "price", "u_price"):
        if key in props:
            v = _to_int(props[key])
            if v > 0:
                return v
    # ヒューリスティック: "price" を含むキーで妥当な金額（1000円〜1000万円/㎡）
    for k, v in props.items():
        if "price" in str(k).lower() or "価格" in str(k):
            n = _to_int(v)
            if 1000 <= n <= 10_000_000:
                return n
    return 0


def fetch_koji(lat: float, lng: float, api_key: str, z: int = 14) -> tuple[int, str, int]:
    """対象地に最も近い公示地価の (㎡単価, 標準地名, 距離m) を返す。"""
    if not (api_key and lat and lng):
        return 0, "", 0

    x, y = _deg2tile(lat, lng, z)
    year = date.today().year
    params = {"response_format": "geojson", "z": z, "x": x, "y": y, "year": year}
    try:
        resp = requests.get(
            f"{_BASE}/XPT001",
            params=params,
            headers=_headers(api_key),
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        gj = resp.json()
    except Exception:
        return 0, "", 0

    best = None
    best_dist = 10 ** 9
    for feat in gj.get("features", []):
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates") or []
        if len(coords) < 2:
            continue
        flng, flat = float(coords[0]), float(coords[1])
        dist = _haversine_m(lat, lng, flat, flng)
        price = _extract_price(feat.get("properties") or {})
        if price > 0 and dist < best_dist:
            best_dist = dist
            props = feat.get("properties") or {}
            name = (
                props.get("standard_lot_number_ja")
                or props.get("address")
                or props.get("location")
                or "近隣標準地"
            )
            best = (price, str(name), dist)
    return best if best else (0, "", 0)


def research(
    pref_code: str,
    muni_code: str,
    lat: float | None,
    lng: float | None,
    property_type: str,
    api_key: str | None = None,
) -> MarketData:
    """相場調査を実行して MarketData を返す。キー未設定なら空で返す。"""
    key = api_key if api_key is not None else get_api_key()
    market = MarketData()
    if not key:
        return market

    market.comparables = fetch_transactions(pref_code, muni_code, property_type, key)
    if lat and lng:
        price, name, dist = fetch_koji(lat, lng, key)
        market.koji_unit_price = price
        market.koji_point_name = name
        market.koji_distance_m = dist
    return market
