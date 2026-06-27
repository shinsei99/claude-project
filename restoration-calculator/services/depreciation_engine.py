"""ガイドライン準拠・減価償却／按分エンジン。

国土交通省「原状回復をめぐるトラブルとガイドライン」の考え方に基づく。

基本原則:
  入居者の故意・過失が証明されない限り、通常損耗・経年劣化はすべてオーナー負担。
  したがって既定（経年劣化）は全項目 入居者負担0%。証明された項目のみ
  故意過失に切り替えて按分する。

部材種別ごとの負担方式（policy）:
  - depreciable: 耐用年数あり（クロス・CF・カーペット・下地処理＝6年）。
      故意過失時は「部分補修の原価（fault_target_amount）」× 残存価値率のみ負担。
      全面張替の全額を入居者に負担させない。
  - full_fault: 耐用年数の定めなし（畳・襖・クリーニング等）。
      故意過失（明らかな破損）時のみ全額（100%）負担、それ以外はオーナー。
      ※設備・通常損耗系（ソフト巾木・ドアクローザー・換気扇・ペンキ）は既定で
        経年劣化＝0%とし、破壊行為のエビデンスがある場合のみ故意過失に変更する。
  - apportion: 諸経費。工事費の入居者:オーナー負担比率に応じて按分する。
"""

from __future__ import annotations

import math

from models.restoration_data import (
    RestorationData,
    LineItem,
    FAULT_NATURAL,
    FAULT_TENANT,
)


DEPRECIABLE = "depreciable"
FULL_FAULT = "full_fault"
APPORTION = "apportion"

# 部材種別 → (耐用年数, 負担方式)
MATERIAL_POLICY: dict[str, tuple[int | None, str]] = {
    # 耐用年数6年・部分補修按分
    "壁クロス": (6, DEPRECIABLE),
    "天井クロス": (6, DEPRECIABLE),
    "CF": (6, DEPRECIABLE),
    "クッションフロア": (6, DEPRECIABLE),
    "カーペット": (6, DEPRECIABLE),
    "下地処理": (6, DEPRECIABLE),
    # 耐用年数の定めなし・故意過失時のみ全額
    "畳": (None, FULL_FAULT),
    "襖": (None, FULL_FAULT),
    "障子": (None, FULL_FAULT),
    "ハウスクリーニング": (None, FULL_FAULT),
    # 設備・通常損耗系（既定オーナー＝経年劣化、破壊時のみ故意過失）
    "ソフト巾木": (None, FULL_FAULT),
    "ドアクローザー": (None, FULL_FAULT),
    "換気扇": (None, FULL_FAULT),
    "ペンキ・塗装": (None, FULL_FAULT),
    "フローリング": (None, FULL_FAULT),
    "その他": (None, FULL_FAULT),
    # 諸経費（按分）
    "諸経費": (None, APPORTION),
}

MATERIAL_TYPES = list(MATERIAL_POLICY.keys())

# 後方互換: {種別: 耐用年数}
USEFUL_LIFE = {k: v[0] for k, v in MATERIAL_POLICY.items()}


def policy_of(material_type: str) -> str:
    return MATERIAL_POLICY.get(material_type, (None, FULL_FAULT))[1]


def life_of(material_type: str) -> int | None:
    return MATERIAL_POLICY.get(material_type, (None, FULL_FAULT))[0]


def residual_rate(life: int, residence_years: float) -> float:
    """直線償却の残存価値率（入居者負担率）。0.0〜1.0。"""
    remaining = (life - residence_years) / life
    return round(max(0.0, min(1.0, remaining)), 4)


def calculate(data: RestorationData) -> RestorationData:
    """全明細の入居者・オーナー負担額を計算する（諸経費は最後に按分）。"""
    years = data.residence_years

    work_items = [it for it in data.items if policy_of(it.material_type) != APPORTION]
    apportion_items = [it for it in data.items if policy_of(it.material_type) == APPORTION]

    # 1パス目: 工事費の各項目を計算
    for item in work_items:
        _calc_work_item(item, years)

    # 2パス目: 諸経費を工事費の負担比率で按分
    total_tenant_work = sum(it.tenant_amount for it in work_items)
    total_owner_work = sum(it.owner_amount for it in work_items)
    for item in apportion_items:
        _calc_apportioned(item, total_tenant_work, total_owner_work)

    return data


def _calc_work_item(item: LineItem, residence_years: float) -> None:
    life = life_of(item.material_type)
    policy = policy_of(item.material_type)
    item.useful_life = life

    # 経年劣化（通常損耗）→ 入居者負担0円（オーナー負担）
    if item.fault == FAULT_NATURAL:
        item.tenant_rate = 0.0
        item.tenant_amount = 0
        item.owner_amount = item.vendor_amount
        item.basis = "経年劣化（通常損耗）→ オーナー負担（入居者0円）"
        return

    # 以降は故意・過失（FAULT_TENANT）
    if policy == DEPRECIABLE and life:
        rate = residual_rate(life, residence_years)
        # 部分補修の対象原価を決める。優先順位:
        #   ① 過失数量 / 全体数量 の比率 × 業者見積総額
        #   ② 過失対象額（手入力の原価）
        #   ③ いずれもなければ全額
        if item.total_qty and item.fault_qty and item.total_qty > 0:
            ratio = min(1.0, item.fault_qty / item.total_qty)
            target = item.vendor_amount * ratio
            u = item.unit or ""
            target_note = (
                f"過失{item.fault_qty:g}{u}/全体{item.total_qty:g}{u}"
                f"＝比率{ratio * 100:.1f}%（対象¥{int(target):,}）"
            )
        elif item.fault_target_amount is not None:
            target = item.fault_target_amount
            target_note = f"部分補修原価¥{int(target):,}"
        else:
            target = item.vendor_amount
            target_note = "全額対象"
        tenant = int(math.floor(target * rate))
        item.tenant_rate = rate
        item.tenant_amount = tenant
        item.owner_amount = item.vendor_amount - tenant
        item.basis = (
            f"故意過失・耐用年数{life}年/経過{residence_years:.2f}年 → 残存{rate * 100:.1f}%"
            f"（{target_note}に適用）"
        )
        return

    # full_fault: 故意過失（明らかな破損）→ 全額入居者負担
    item.tenant_rate = 1.0
    item.tenant_amount = item.vendor_amount
    item.owner_amount = 0
    item.basis = "故意過失（明らかな破損）→ 入居者負担100%"


def _calc_apportioned(item: LineItem, total_tenant_work: int, total_owner_work: int) -> None:
    """諸経費を工事費の入居者:オーナー負担比率で按分する。"""
    item.useful_life = None
    denom = total_tenant_work + total_owner_work
    if denom <= 0:
        rate = 0.0
    else:
        rate = total_tenant_work / denom
    tenant = int(math.floor(item.vendor_amount * rate))
    item.tenant_rate = round(rate, 4)
    item.tenant_amount = tenant
    item.owner_amount = item.vendor_amount - tenant
    item.basis = (
        f"諸経費按分（入居者:オーナー＝¥{total_tenant_work:,}:¥{total_owner_work:,}）"
        f"→ 入居者{rate * 100:.1f}%"
    )
