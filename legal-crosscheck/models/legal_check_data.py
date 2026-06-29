"""売買契約・重説・謄本「法令制限・建築基準法特化型」4点連動クロスチェック
のデータ構造。

パイプライン全体は単一の `LegalCrossCheckData` 辞書（dataclass）に集約し、
一方向に処理する。

  4者間クロスチェックの「4者」:
    🌐 行政正解値（国交省API）  … AdminMaster
    📄 謄本ファクト値           … RegistryFact
    📝 重説記載値               … explanation（PDFから正規表現抽出）
    🛒 契約書記載値             … contract（PDFから正規表現抽出）

各チェック項目の結果は CheckResult として results に積み上げる。
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict

# ---- 判定ステータス ----
STATUS_OK = "一致"          # 🟢
STATUS_NG = "齟齬・リスクあり"  # 🔴
STATUS_NA = "確認不可"       # ⚪（書類から値が取れず照合できない）

# ---- チェックのカテゴリ（3レイヤー） ----
CAT_INPUT = "入力齟齬"        # ① 書類間・謄本間の文字/数値ミスマッチ
CAT_LAW = "宅建業法"          # ② 宅建業法違反・リスク特約
CAT_BUILDING = "建築基準法"    # ③ 行政データ不一致・敷地計算の矛盾


@dataclass
class RegistryFact:
    """謄本（登記簿）から抽出した公式ファクト値。"""
    # 土地
    location: str = ""        # 所在
    chiban: str = ""          # 地番
    land_area: float = 0.0    # 地積（㎡）
    # 建物
    kaoku_number: str = ""    # 家屋番号
    floor_area: float = 0.0   # 床面積／専有面積（㎡）
    structure: str = ""       # 構造
    # 甲区（所有権）
    owner_name: str = ""      # 最新所有者 氏名
    owner_address: str = ""   # 最新所有者 住所

    @property
    def has_land(self) -> bool:
        return bool(self.chiban or self.land_area)

    @property
    def has_building(self) -> bool:
        return bool(self.kaoku_number or self.floor_area)


@dataclass
class AdminMaster:
    """国交省API等から取得した行政の「正解」マスター。"""
    use_district: str = ""          # 用途地域名（例: 第一種住居地域）
    building_coverage: float = 0.0  # 指定建ぺい率（%）
    floor_area_ratio: float = 0.0   # 指定容積率（%）
    fire_zone: str = ""             # 防火地域区分（防火/準防火/指定なし 等）
    height_district: str = ""       # 高度地区
    area_classification: str = ""   # 区域区分（市街化区域/市街化調整区域/都市計画区域 等）
    city: str = ""                  # 自治体（都道府県＋市区町村）
    elementary_school: str = ""     # 小学校区
    junior_high_school: str = ""    # 中学校区
    decision_info: str = ""         # 都市計画決定（告示番号・決定日 等）
    hikage_kisei: str = ""          # 日影規制
    other_restrictions: str = ""    # その他地域地区・制限（地区計画/高度利用/景観/都市計画道路 等）
    web_source: str = ""            # Web法令調査の出典・備考
    source: str = ""                # データ取得元（API / モック 等）

    @property
    def resolved(self) -> bool:
        return bool(self.use_district or self.building_coverage or self.area_classification)


@dataclass
class CheckResult:
    """1チェック項目の4者間照合結果。Excel報告書の1行に対応。"""
    category: str               # CAT_*
    item: str                   # チェック項目名（例: 専有面積）
    admin_value: str = ""       # 🌐行政正解 / 📄謄本ファクト
    explanation_value: str = "" # 📝重説記載値
    contract_value: str = ""    # 🛒契約書記載値
    status: str = STATUS_NA     # STATUS_*
    advice: str = ""            # 修正指示・アドバイス

    @property
    def is_ng(self) -> bool:
        return self.status == STATUS_NG

    @property
    def icon(self) -> str:
        return {STATUS_OK: "🟢", STATUS_NG: "🔴", STATUS_NA: "⚪"}.get(self.status, "⚪")


@dataclass
class LegalCrossCheckData:
    """パイプライン全体を貫く単一データ構造。"""
    # 物件所在
    address: str = ""
    lat: float | None = None
    lng: float | None = None
    pref_code: str = ""
    muni_code: str = ""

    # 4者
    admin: AdminMaster = field(default_factory=AdminMaster)
    registry: RegistryFact = field(default_factory=RegistryFact)
    explanation: dict = field(default_factory=dict)  # 重説 抽出値
    contract: dict = field(default_factory=dict)     # 契約書 抽出値

    # 売主が宅建業者か（業法40条/38条の適用判定に使う）
    seller_is_pro: bool = False

    # 検閲結果
    results: list[CheckResult] = field(default_factory=list)

    @property
    def ng_count(self) -> int:
        return sum(1 for r in self.results if r.is_ng)

    @property
    def ok_count(self) -> int:
        return sum(1 for r in self.results if r.status == STATUS_OK)

    @property
    def has_run(self) -> bool:
        return bool(self.results)

    def as_dict(self) -> dict:
        return asdict(self)
