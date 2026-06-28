"""原状回復精算の単一データ構造。

パイプライン全体（入力 → Excel解析 → 償却計算 → 按分 → 精算書出力）で
この `RestorationData` を受け渡しする。
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import date


# 過失区分
FAULT_TENANT = "故意過失"      # 善管注意義務違反 → 入居者負担あり
FAULT_NATURAL = "経年劣化"     # 通常損耗 → 入居者負担0円（オーナー負担）


@dataclass
class LineItem:
    """精算明細の1行。

    業者見積Excelから抽出した「工事名・金額」を起点に、
    部材種別の自動判別と按分計算結果を保持する。
    """

    name: str                       # 工事・部材名（業者見積から抽出）
    vendor_amount: int              # 業者見積総額（税込・原価）
    material_type: str = "その他"   # 自動判別された部材種別
    # 既定は経年劣化（通常損耗）＝オーナー負担。故意・過失が証明された項目のみ
    # 故意過失に切り替える（ガイドラインの原則：証明されない限りオーナー負担）。
    fault: str = FAULT_NATURAL      # 過失の有無（故意過失 / 経年劣化）
    # 故意・過失による「部分補修」の原価（円）。クロス・CF等の償却対象で、
    # 部屋全体の全面張替ではなく汚損箇所のみを入居者負担とするために使う。
    # None の場合は業者見積総額（全額）を対象とみなす。
    fault_target_amount: int | None = None
    # 業者見積から読み取った全体数量と単位（クロス=m、CF=㎡ など業者により異なる）。
    total_qty: float | None = None
    unit: str = ""
    # 入居者の故意・過失による汚損箇所の数量（同じ単位、ユーザー入力）。
    # total_qty と併用すると「過失数量 / 全体数量」の比率で部分補修原価を自動算出する。
    fault_qty: float | None = None

    # 計算結果（depreciation_engine が埋める）
    useful_life: int | None = None  # 耐用年数（年）。None=償却なし
    tenant_rate: float = 0.0        # 入居者負担率（0.0〜1.0）
    tenant_amount: int = 0          # 入居者負担額（円）
    owner_amount: int = 0           # オーナー負担額（円）
    basis: str = ""                 # 算出根拠メモ

    @property
    def tenant_rate_pct(self) -> float:
        """入居者負担率（%表示用）。"""
        return round(self.tenant_rate * 100, 1)


@dataclass
class RestorationData:
    """退去精算の全データ。"""

    # 基本情報
    tenant_name: str = ""
    property_name: str = ""
    room_number: str = ""
    property_address: str = ""

    # 期間情報
    move_in_date: date | None = None     # 入居日（契約開始日）
    move_out_date: date | None = None    # 退去日（明渡し日）

    # 敷金
    deposit: int = 0

    # 明細
    items: list[LineItem] = field(default_factory=list)

    # ---- 期間の自動計算 ----
    @property
    def residence_days(self) -> int:
        """入居日数。"""
        if not self.move_in_date or not self.move_out_date:
            return 0
        return max(0, (self.move_out_date - self.move_in_date).days)

    @property
    def residence_years(self) -> float:
        """入居年数（小数）。償却計算に用いる。"""
        return round(self.residence_days / 365.0, 2)

    @property
    def residence_period(self) -> tuple[int, int]:
        """入居期間を暦ベースの (年, 月) で返す。"""
        if not self.move_in_date or not self.move_out_date:
            return (0, 0)
        y = self.move_out_date.year - self.move_in_date.year
        m = self.move_out_date.month - self.move_in_date.month
        if self.move_out_date.day < self.move_in_date.day:
            m -= 1
        if m < 0:
            y -= 1
            m += 12
        return (max(0, y), max(0, m))

    @property
    def residence_label(self) -> str:
        """「○年○ヶ月」表記（暦ベース）。"""
        y, m = self.residence_period
        return f"{y}年{m}ヶ月"

    # ---- サマリー ----
    @property
    def total_vendor(self) -> int:
        return sum(i.vendor_amount for i in self.items)

    @property
    def total_tenant(self) -> int:
        return sum(i.tenant_amount for i in self.items)

    @property
    def total_owner(self) -> int:
        return sum(i.owner_amount for i in self.items)

    @property
    def settlement(self) -> int:
        """差引精算額。正=敷金返還額、負=追加請求額。"""
        return self.deposit - self.total_tenant

    def as_dict(self) -> dict:
        return asdict(self)
