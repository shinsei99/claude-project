"""PropertyData — 本システムの中核データ構造。

すべての調査・解析結果はこの 1 つの辞書に集約し、
「入力 → 調査 → 整理 → 出力（Excel / PDF）」の一方向パイプラインで扱う。
UI やデザインより、このデータ構造と出力精度を最優先する。
"""

from typing import Dict


# PropertyData が必ず持つキー（順序＝重説の並びに準拠）
PROPERTY_FIELDS = [
    # --- 基本情報 ---
    "所在地",
    "地番",
    "家屋番号",
    "地目",
    "地積",
    "種類",
    "構造",
    "床面積",
    "所有者",
    "抵当権",
    # --- 都市計画 / 法令制限 ---
    "用途地域",
    "建ぺい率",
    "容積率",
    "防火地域",
    "高度地区",
    # --- 災害リスク ---
    "洪水浸水想定",
    "土砂災害",
    "津波",
    # --- 周辺環境 ---
    "最寄駅",
    "駅距離",
    "人口",
    "世帯数",
    # --- 価格指標 ---
    "路線価",
    "公示地価",
]


def create_property_data() -> Dict[str, str]:
    """空の PropertyData を生成する。全フィールドを空文字で初期化。"""
    return {field: "" for field in PROPERTY_FIELDS}


def merge(base: Dict[str, str], updates: Dict[str, str]) -> Dict[str, str]:
    """調査サービスの戻り値を PropertyData にマージする。

    - None / 空文字は上書きしない（既存値を保護）
    - PROPERTY_FIELDS 以外のキーは無視する（構造を汚さない）
    """
    if not updates:
        return base
    for key, value in updates.items():
        if key not in PROPERTY_FIELDS:
            continue
        if value is None:
            continue
        value = str(value).strip()
        if value == "":
            continue
        base[key] = value
    return base
