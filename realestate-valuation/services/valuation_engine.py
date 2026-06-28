"""3つの物件種別に応じた査定価格の算定エンジン。

すべて Python のロジック（テンプレート合成）で算出する。AIや有料APIは使わない。
  - 区分マンション: 取引事例比較法（近隣中古マンションの㎡単価 × 専有面積）
  - 土地・戸建: 土地=取引事例比較法、建物=原価法（再調達原価×残存率）
  - 収益物件: 積算価格（コスト法）と収益価格（収益還元法）の併用
"""

from __future__ import annotations

from models.valuation_data import (
    Valuation,
    ValuationPipelineData,
    TYPE_MANSION,
    TYPE_KODATE,
    TYPE_SHUEKI,
)

# 構造別の建物再調達単価（円/㎡）。原価法・積算価格で使用。
REBUILD_UNIT_PRICE = {
    "木造": 200_000,
    "ブロック造": 200_000,
    "れんが造": 200_000,
    "軽量鉄骨造": 150_000,
    "鉄骨造": 180_000,
    "鉄筋コンクリート造": 300_000,
    "鉄骨鉄筋コンクリート造": 300_000,
}
_DEFAULT_REBUILD = 200_000

# 構造別の法定耐用年数（年）。残存率計算で使用。
USEFUL_LIFE = {
    "木造": 22,
    "ブロック造": 38,
    "れんが造": 38,
    "軽量鉄骨造": 27,
    "鉄骨造": 34,
    "鉄筋コンクリート造": 47,
    "鉄骨鉄筋コンクリート造": 47,
}
_DEFAULT_LIFE = 22

DEFAULT_CAP_RATE = 5.5          # 期待利回り（%）
EXPENSE_RATIO = 0.20           # 運営経費率（年間総収入に対する割合）
MIN_BUILDING_PRICE = 0        # 築古で残存率0の場合の建物最低評価額（円）

# 角地・準角地の側方路線影響加算率（財産評価基本通達・地区区分別）。
# ※簡易対応：奥行価格補正・間口狭小・不整形地補正等は省略している。
SIDE_ADD_RATE = {
    "普通住宅地区": {"角地": 0.03, "準角地": 0.02},
    "中小工場地区": {"角地": 0.03, "準角地": 0.02},
    "普通商業・併用住宅地区": {"角地": 0.08, "準角地": 0.04},
    "高度商業・繁華街地区": {"角地": 0.10, "準角地": 0.05},
}
ROSENKA_TO_JISSEI = 0.8        # 路線価は公示地価の約8割 → ÷0.8で実勢補正

CURRENT_YEAR = __import__("datetime").date.today().year


def rebuild_unit_price(structure: str) -> int:
    for key, val in REBUILD_UNIT_PRICE.items():
        if key in structure:
            return val
    return _DEFAULT_REBUILD


def useful_life(structure: str) -> int:
    for key, val in USEFUL_LIFE.items():
        if key in structure:
            return val
    return _DEFAULT_LIFE


def residual_ratio(structure: str, build_year: int) -> float:
    """建物の残存価値割合 (耐用年数 - 築年数) / 耐用年数。0〜1にクリップ。"""
    if not build_year:
        return 0.0
    life = useful_life(structure)
    age = max(0, CURRENT_YEAR - build_year)
    return max(0.0, min(1.0, (life - age) / life))


def building_cost_value(structure: str, floor_area: float, build_year: int) -> int:
    """原価法による建物評価額（円）。残存率0以下なら最低評価額を適用。"""
    if floor_area <= 0:
        return 0
    val = floor_area * rebuild_unit_price(structure) * residual_ratio(structure, build_year)
    val = int(round(val))
    return val if val > 0 else MIN_BUILDING_PRICE


def _man(yen: int) -> int:
    return round(yen / 10000)


def corner_adjusted_unit(front: int, side: int, chiku: str, corner: str) -> tuple[int, float]:
    """角地・準角地の側方路線影響加算後の路線価単価と加算率を返す。

    加算後単価 = 正面路線価 + 側方路線価 × 側方路線影響加算率。
    （奥行価格補正等は簡易のため省略）
    """
    rate = SIDE_ADD_RATE.get(chiku, {}).get(corner, 0.0)
    if side > 0 and rate > 0:
        return int(round(front + side * rate)), rate
    return front, 0.0


def compute_rosenka(market, land_area: float) -> tuple[int, int, int, str] | None:
    """路線価ベースの土地評価を算出する。

    返り値: (採用単価, 相続税評価額, 実勢補正額, 内訳メモ)。算出不可なら None。
    """
    front = market.rosenka_unit_price
    if front <= 0 or land_area <= 0:
        return None
    eff, rate = corner_adjusted_unit(
        front, market.rosenka_side_unit_price, market.rosenka_chiku, market.rosenka_corner
    )
    souzoku = int(round(eff * land_area))
    jissei = int(round(souzoku / ROSENKA_TO_JISSEI))
    if rate > 0:
        detail = (
            f"正面{front:,}円/㎡ ＋ 側方{market.rosenka_side_unit_price:,}円/㎡ × "
            f"加算率{rate:.0%}（{market.rosenka_corner}・{market.rosenka_chiku}）"
            f" = 採用{eff:,}円/㎡"
        )
    else:
        detail = f"正面路線価 {front:,}円/㎡"
    return eff, souzoku, jissei, detail


def _apply_rosenka(data: ValuationPipelineData, v: Valuation) -> None:
    """路線価ベースの土地評価（相続税評価額・実勢補正）を Valuation に設定する。"""
    result = compute_rosenka(data.market, data.registry.land_area)
    if not result:
        return
    eff, souzoku, jissei, detail = result
    v.rosenka_unit_price = eff
    v.rosenka_souzoku = souzoku
    v.rosenka_jissei = jissei
    v.rosenka_detail = detail


# ---- 種別ごとの査定 ----

def _value_mansion(data: ValuationPipelineData) -> Valuation:
    v = Valuation()
    reg = data.registry
    market = data.market
    area = reg.exclusive_area or reg.floor_area

    # 近隣中古マンションの平均㎡単価を採用（無ければ公示地価で代替）
    unit = market.avg_unit_price or market.koji_unit_price
    price = int(round(unit * area)) if (unit and area) else 0

    v.mansion_price = price
    v.final_price = price
    src = (
        f"近隣中古マンション事例 {market.comp_count}件の平均㎡単価"
        if market.avg_unit_price
        else "公示地価㎡単価（事例なしのため代替）"
    )
    v.basis = (
        f"{src} {unit:,}円/㎡ × 補正100/100 × 専有面積 {area:g}㎡ = {_man(price):,}万円"
        if price
        else "比較事例・公示地価が取得できないため、㎡単価を手入力してください。"
    )
    return v


def _value_kodate(data: ValuationPipelineData) -> Valuation:
    v = Valuation()
    reg = data.registry
    market = data.market

    # 土地: 周辺土地取引の平均㎡単価 × 地積（無ければ公示地価）
    land_unit = market.avg_unit_price or market.koji_unit_price
    v.land_price = int(round(land_unit * reg.land_area)) if (land_unit and reg.land_area) else 0

    # 建物: 原価法
    v.building_price = building_cost_value(reg.structure, reg.floor_area, reg.build_year)

    v.final_price = v.land_price + v.building_price
    v.cap_rate = DEFAULT_CAP_RATE
    rr = residual_ratio(reg.structure, reg.build_year)
    v.basis = (
        f"土地: {land_unit:,}円/㎡ × {reg.land_area:g}㎡ = {_man(v.land_price):,}万円 ／ "
        f"建物(原価法): 延床{reg.floor_area:g}㎡ × 再調達{rebuild_unit_price(reg.structure):,}円 × "
        f"残存率{rr:.0%} = {_man(v.building_price):,}万円 ／ "
        f"合計 {_man(v.final_price):,}万円"
    )
    return v


def _value_shueki(data: ValuationPipelineData) -> Valuation:
    v = Valuation()
    reg = data.registry
    market = data.market

    # 積算価格（コスト法）
    land_unit = market.koji_unit_price or market.avg_unit_price
    v.cost_land = int(round(land_unit * reg.land_area)) if (land_unit and reg.land_area) else 0
    v.cost_building = building_cost_value(reg.structure, reg.floor_area, reg.build_year)
    v.cost_total = v.cost_land + v.cost_building

    # 収益価格（収益還元法・直接還元）
    v.income_gross = data.rentroll.annual_income
    v.income_expense = int(round(v.income_gross * EXPENSE_RATIO))
    v.income_noi = v.income_gross - v.income_expense
    v.cap_rate = DEFAULT_CAP_RATE
    v.income_price = int(round(v.income_noi / (v.cap_rate / 100))) if v.income_noi > 0 else 0

    # 最終: 積算と収益の平均（双方が有効な場合）。一方のみなら有効値を採用。
    vals = [x for x in (v.cost_total, v.income_price) if x > 0]
    v.final_price = int(round(sum(vals) / len(vals))) if vals else 0

    v.basis = (
        f"積算価格: 土地{_man(v.cost_land):,}万円＋建物{_man(v.cost_building):,}万円="
        f"{_man(v.cost_total):,}万円 ／ "
        f"収益価格: NOI {_man(v.income_noi):,}万円 ÷ 利回り{v.cap_rate}% = "
        f"{_man(v.income_price):,}万円 ／ "
        f"最終(平均) {_man(v.final_price):,}万円"
    )
    return v


def evaluate(data: ValuationPipelineData) -> Valuation:
    """物件種別に応じた査定を実行し Valuation を返す。"""
    if data.property_type == TYPE_MANSION:
        v = _value_mansion(data)
    elif data.property_type == TYPE_KODATE:
        v = _value_kodate(data)
    elif data.property_type == TYPE_SHUEKI:
        v = _value_shueki(data)
    else:
        return Valuation()

    # 路線価ベースの土地評価は土地を持つ種別（戸建・収益）で参考表示する。
    # 区分マンションは敷地権の持分按分が必要なため路線価ベースは算出しない。
    if data.property_type in (TYPE_KODATE, TYPE_SHUEKI):
        _apply_rosenka(data, v)
    return v
