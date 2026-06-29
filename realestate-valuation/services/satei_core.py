# -*- coding: utf-8 -*-
"""査定アプリの共通コア：物件種別・自社情報・空データ・査定計算。

査定方式（評点方式）:
  戸建て（土地・建物）
    土地価格(A) = 土地事例単価(円/㎡) × 土地面積(㎡) × (100 ± 土地ポイント計) / 100
    建物価格(B) = 再調達単価(円/㎡) × 建物面積(㎡) × (100 ± 建物ポイント計) / 100
    査定価格   = A + B
  マンション
    査定価格 = 事例単価(円/㎡) × (100 ± 評点計) / 100 × 専有面積(㎡)

加点・減点ポイントは {factor, kubun(土地/建物/両方), point(正の数)} のリスト。
"""

from __future__ import annotations

import json
import os
from pathlib import Path

TYPE_KODATE = "土地・戸建て"
TYPE_MANSION = "マンション"
PROPERTY_TYPES = [TYPE_KODATE, TYPE_MANSION]

KUBUN_OPTIONS = ["土地", "建物", "両方"]

# 加点・減点の要因候補（プルダウン用）
PLUS_FACTORS = [
    "駅に近い（徒歩圏）", "角地", "整形地", "南向き・日当たり良好", "高台・眺望良好",
    "前面道路が広い", "閑静な住宅地", "商業施設・スーパーが近い", "学校区が良い",
    "公園・緑地が近い", "築浅・リフォーム済", "価格が割安", "開放感・採光良好",
    "駐車場あり（複数台可）", "地盤・擁壁が良好", "再開発・将来性", "その他（加点）",
]
MINUS_FACTORS = [
    "駅から遠い・バス便", "旗竿地・不整形地", "北向き・日当たり不良", "がけ地・高低差大",
    "前面道路が狭い（4m未満）", "接道不良・再建築困難", "車の出入りがしにくい",
    "騒音・嫌悪施設が近い", "老朽化・要修繕", "越境がある", "浸水・ハザード懸念",
    "高圧線・嫌悪要因", "私道負担あり", "低層階・階段のみ", "駐車場なし", "その他（減点）",
]
# ポイント候補（良識の範囲）と合計評点の安全上限
POINT_CHOICES = [3, 5, 8, 10, 13, 15, 20, 25, 30]
MAX_NET_POINT = 50  # 合計評点はこの範囲にクランプ（倍率50〜150%相当）


def clamp_net(p: int) -> int:
    return max(-MAX_NET_POINT, min(MAX_NET_POINT, int(p)))

_BASE = Path(__file__).resolve().parent.parent
_COMPANY_PATH = _BASE / "company_info.json"          # 旧：単一プロフィール（移行元）
_PROFILES_PATH = _BASE / "company_profiles.json"     # 新：会社名キーの複数プロフィール

_DEFAULT_COMPANY = {
    "company_name": "株式会社DAIKYO",
    "office": "",
    "staff": "",
    "tel": "",
    "address": "",
    "license_no": "",
    "logo_path": "assets/logo.jpeg",
}


# ── 自社情報（会社名ごとの複数プロフィール） ──────────────────────────────────
def _normalize(info: dict) -> dict:
    data = dict(_DEFAULT_COMPANY)
    data.update({k: v for k, v in (info or {}).items() if v is not None})
    return data


def _load_raw() -> dict:
    """{"current": 会社名, "profiles": {会社名: info}} を返す（無ければ移行/初期化）。"""
    try:
        if _PROFILES_PATH.exists():
            raw = json.loads(_PROFILES_PATH.read_text(encoding="utf-8"))
            if isinstance(raw, dict) and isinstance(raw.get("profiles"), dict) and raw["profiles"]:
                return raw
    except Exception:
        pass
    # 旧 company_info.json から移行、無ければ既定
    seed = _DEFAULT_COMPANY
    try:
        if _COMPANY_PATH.exists():
            seed = _normalize(json.loads(_COMPANY_PATH.read_text(encoding="utf-8")))
    except Exception:
        pass
    name = seed.get("company_name") or "会社名未設定"
    return {"current": name, "profiles": {name: _normalize(seed)}}


def _save_raw(raw: dict) -> None:
    _PROFILES_PATH.write_text(
        json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")


def list_companies() -> list[str]:
    raw = _load_raw()
    return list(raw["profiles"].keys())


def current_name() -> str:
    raw = _load_raw()
    cur = raw.get("current")
    if cur in raw["profiles"]:
        return cur
    return next(iter(raw["profiles"]), "")


def get_profile(name: str) -> dict:
    raw = _load_raw()
    return _normalize(raw["profiles"].get(name, _DEFAULT_COMPANY))


def load_company() -> dict:
    """現在選択中のプロフィールを返す（後方互換）。"""
    return get_profile(current_name())


def set_current(name: str) -> None:
    raw = _load_raw()
    if name in raw["profiles"]:
        raw["current"] = name
        _save_raw(raw)


def save_profile(info: dict, make_current: bool = True) -> None:
    """会社名をキーに登録（既存は上書き）。"""
    raw = _load_raw()
    data = _normalize(info)
    name = data.get("company_name") or "会社名未設定"
    raw["profiles"][name] = data
    if make_current:
        raw["current"] = name
    _save_raw(raw)


def delete_profile(name: str) -> None:
    raw = _load_raw()
    if name in raw["profiles"] and len(raw["profiles"]) > 1:
        del raw["profiles"][name]
        if raw.get("current") == name:
            raw["current"] = next(iter(raw["profiles"]))
        _save_raw(raw)


# 後方互換のエイリアス
def save_company(info: dict) -> None:
    save_profile(info, make_current=True)


def logo_abspath(info: dict) -> str | None:
    p = info.get("logo_path") or ""
    if not p:
        return None
    ap = _BASE / p if not os.path.isabs(p) else Path(p)
    return str(ap) if ap.exists() else None


# ── 空データ ──────────────────────────────────────────────────────────────────
def empty_case() -> dict:
    """取引事例・売出物件・査定対象 共通の1物件レコード。"""
    return {
        "address": "",          # 物件所在地
        "price_man": 0.0,        # 取引/売出/査定 価格（万円）
        "land_price_man": 0.0,   # うち土地価格（万円）
        "land_area": 0.0,        # 土地面積（㎡）
        "building_area": 0.0,    # 建物面積（㎡）
        "floors": "",            # 階建
        "madori": "",            # 間取り
        "structure": "",         # 建物構造
        "build_ym": "",          # 築年月
        "station": "",           # 最寄駅・路線
        "access": "",            # 徒歩/バス ○分
        "trade_ym": "",          # 取引年月（事例のみ）
        # マンション固有
        "mansion_name": "",      # マンション名・号室
        "exclusive_area": 0.0,   # 専有面積（壁芯, ㎡）
        "balcony_area": 0.0,     # バルコニー面積（㎡）
        "direction": "",         # 向き
        "floor_no": "",          # 階／階建
        "unit_price": 0.0,       # 単価（円/㎡）※事例で使用
        "rights": "所有権",      # 権利（所有権/地上権/賃借権/定期借地権）
    }


def empty_point() -> dict:
    return {"factor": "", "kubun": "両方", "point": 0}


# ── ポイント集計 ──────────────────────────────────────────────────────────────
def _sum_points(plus: list, minus: list, kubun_set: set | None) -> int:
    def match(p):
        return kubun_set is None or p.get("kubun", "両方") in kubun_set

    add = sum(int(p.get("point", 0) or 0) for p in plus if match(p))
    sub = sum(int(p.get("point", 0) or 0) for p in minus if match(p))
    return add - sub


def land_point_total(plus: list, minus: list) -> int:
    return _sum_points(plus, minus, {"土地", "両方"})


def building_point_total(plus: list, minus: list) -> int:
    return _sum_points(plus, minus, {"建物", "両方"})


def total_point(plus: list, minus: list) -> int:
    return _sum_points(plus, minus, None)


# ── 査定計算 ──────────────────────────────────────────────────────────────────
def calc_kodate(
    land_unit: float, land_area: float,
    building_unit: float, building_area: float,
    plus: list, minus: list, ryutsu: float = 100.0,
) -> dict:
    lp = clamp_net(land_point_total(plus, minus))
    bp = clamp_net(building_point_total(plus, minus))
    land_value = round((land_unit or 0) * (land_area or 0) * (100 + lp) / 100)
    building_value = round((building_unit or 0) * (building_area or 0) * (100 + bp) / 100)
    base = land_value + building_value  # 市場調整前査定価格（A+B）
    total = round(base * (ryutsu or 100) / 100)
    return {
        "type": TYPE_KODATE,
        "land_unit": land_unit, "land_area": land_area, "land_point": lp,
        "building_unit": building_unit, "building_area": building_area, "building_point": bp,
        "land_value": land_value, "building_value": building_value,
        "base": base, "ryutsu": ryutsu, "total": total,
    }


def calc_mansion(
    case_unit: float, exclusive_area: float, plus: list, minus: list, ryutsu: float = 100.0,
) -> dict:
    pt = clamp_net(total_point(plus, minus))
    base = round((case_unit or 0) * (100 + pt) / 100 * (exclusive_area or 0))  # 試算価格
    total = round(base * (ryutsu or 100) / 100)
    return {
        "type": TYPE_MANSION,
        "case_unit": case_unit, "exclusive_area": exclusive_area, "point": pt,
        "base": base, "ryutsu": ryutsu, "total": total,
    }


def yen_to_man(yen: int) -> float:
    return round(yen / 10000, 1)
