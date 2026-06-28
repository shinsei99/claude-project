"""不動産価格査定の単一データ構造。

パイプライン全体（入力 → 登記簿/レントロール解析 → 住所変換・API調査 →
価格算定 → Excel出力）で、この `ValuationPipelineData` を一方向に受け渡す。
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict


# 物件種別（ラジオボタンの選択肢と一致させる）
TYPE_MANSION = "区分マンション"
TYPE_KODATE = "土地・戸建"
TYPE_SHUEKI = "収益物件（一棟）"

PROPERTY_TYPES = [TYPE_MANSION, TYPE_KODATE, TYPE_SHUEKI]


@dataclass
class RegistryInfo:
    """登記簿（謄本）から抽出した物件情報。

    地番・家屋番号は登記上の表記、`address` は住居表示への変換結果を保持する。
    """

    # 登記簿の記載（土地）
    location: str = ""        # 所在
    chiban: str = ""          # 地番
    chimoku: str = ""         # 地目
    land_area: float = 0.0    # 地積（㎡）

    # 登記簿の記載（建物）
    kaoku_no: str = ""        # 家屋番号
    floor_area: float = 0.0   # 床面積 / 延床面積（㎡）
    structure: str = ""       # 構造（木造・鉄筋コンクリート造 等）
    build_year: int = 0       # 建築年（西暦）
    build_ym: str = ""        # 建築年月（表示用「YYYY年MM月」）

    # マンション固有
    mansion_name: str = ""    # マンション名（建物の名称）
    exclusive_area: float = 0.0   # 専有面積（㎡）
    floor_no: int = 0         # 所在階
    total_floors: int = 0     # 総階数
    total_units: int = 0      # 総戸数（不明時は0）

    # 立地（手入力または相場APIで補完）
    nearest_station: str = ""
    station_minutes: int = 0  # 駅徒歩（分）


@dataclass
class Comparable:
    """周辺の売買取引事例（不動産情報ライブラリAPI由来）。"""

    name: str = ""            # 物件名・地区名
    address: str = ""         # 所在地
    trade_price: int = 0      # 取引価格（円）
    unit_price: int = 0       # ㎡単価（円/㎡）
    area: float = 0.0         # 面積（㎡）
    trade_period: str = ""    # 取引時期（例「2024年第2四半期」）
    structure: str = ""       # 構造
    build_year: int = 0       # 建築年
    distance_m: int = 0       # 対象地からの概算距離（m、算出できれば）

    @property
    def trade_price_man(self) -> int:
        """取引価格（万円・表示用）。"""
        return round(self.trade_price / 10000)


@dataclass
class MarketData:
    """周辺相場・公的地価の調査結果。"""

    koji_unit_price: int = 0          # 最寄り公示地価（円/㎡）
    koji_point_name: str = ""         # 公示地価の標準地名・所在
    koji_distance_m: int = 0          # 対象地からの距離（m）

    # 相続税路線価（路線価図のAI読取または手入力）
    rosenka_unit_price: int = 0       # 正面路線価（円/㎡）
    rosenka_note: str = ""            # 路線価図の表記（例「300D」＝300千円/㎡・借地権割合D）
    # 角地（側方路線影響加算）用
    rosenka_side_unit_price: int = 0  # 側方路線価（円/㎡）
    rosenka_chiku: str = "普通住宅地区"  # 地区区分（側方加算率の決定に使用）
    rosenka_corner: str = "なし"      # なし / 角地 / 準角地

    comparables: list[Comparable] = field(default_factory=list)  # 取引事例

    @property
    def comp_count(self) -> int:
        return len(self.comparables)

    @property
    def avg_unit_price(self) -> int:
        """取引事例の平均㎡単価（円/㎡）。事例が無ければ0。"""
        vals = [c.unit_price for c in self.comparables if c.unit_price > 0]
        return round(sum(vals) / len(vals)) if vals else 0

    @property
    def max_unit_price(self) -> int:
        vals = [c.unit_price for c in self.comparables if c.unit_price > 0]
        return max(vals) if vals else 0

    @property
    def min_unit_price(self) -> int:
        vals = [c.unit_price for c in self.comparables if c.unit_price > 0]
        return min(vals) if vals else 0


@dataclass
class RentRoll:
    """レントロール解析結果（収益物件のみ）。"""

    monthly_total: int = 0            # 月額総収入（賃料＋共益費の合計、円）
    annual_income: int = 0            # 年間想定総収入（円）
    room_count: int = 0               # 部屋数

    @property
    def annual_income_man(self) -> int:
        return round(self.annual_income / 10000)


@dataclass
class Valuation:
    """査定価格の算定結果（種別ごとに使う項目が異なる）。"""

    # 共通
    final_price: int = 0              # 最終査定価格（円）
    basis: str = ""                   # 算出根拠テキスト

    # マンション
    mansion_price: int = 0

    # 戸建（原価法）
    land_price: int = 0               # 土地評価額
    building_price: int = 0           # 建物評価額（原価法）

    # 路線価ベースの土地評価（参考・両方表示）
    rosenka_unit_price: int = 0       # 採用した路線価単価（角地加算後・円/㎡）
    rosenka_souzoku: int = 0          # 路線価×地積＝相続税評価額
    rosenka_jissei: int = 0           # 路線価÷0.8×地積＝実勢補正額
    rosenka_detail: str = ""          # 内訳メモ（正面・側方加算など）

    # 収益
    cost_land: int = 0                # 積算：土地
    cost_building: int = 0            # 積算：建物
    cost_total: int = 0              # 積算合計
    income_gross: int = 0            # 年間想定総収入
    income_expense: int = 0          # 運営経費（年間収入の20%）
    income_noi: int = 0              # 経費控除後NOI
    cap_rate: float = 5.5            # 期待利回り（%）
    income_price: int = 0           # 収益還元価格

    @staticmethod
    def to_man(yen: int) -> int:
        """円 → 万円（表示・Excel用）。"""
        return round(yen / 10000)


@dataclass
class ValuationPipelineData:
    """査定処理の全データを集約する単一構造。"""

    property_type: str = TYPE_MANSION

    registry: RegistryInfo = field(default_factory=RegistryInfo)
    rentroll: RentRoll = field(default_factory=RentRoll)
    market: MarketData = field(default_factory=MarketData)
    valuation: Valuation = field(default_factory=Valuation)

    # 住所変換・位置情報
    address: str = ""                 # 住居表示（一般的な住所）
    lat: float | None = None
    lng: float | None = None
    muni_code: str = ""               # 市区町村コード（5桁）
    pref_code: str = ""               # 都道府県コード（2桁）

    # 外部リンク
    chika_map_url: str = ""           # 全国地価マップ（路線価確認）への一発ジャンプURL

    def as_dict(self) -> dict:
        return asdict(self)
