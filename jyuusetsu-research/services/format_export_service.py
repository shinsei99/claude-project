"""実書式テンプレートへの流し込みアダプタ。

各書式を FORMATS に登録し、PropertyData のフィールド → セル座標のマッピングで
既存 Excel テンプレートに書き込む。チェックボックス等の自動判定できない欄は
テンプレートの既定値を保持する（値が空のフィールドは上書きしない）。

新しい書式を追加するときは FORMATS に 1 エントリ足すだけでよい。
"""

import os
import re
from typing import Dict

from services import xlsx_patcher

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# カテゴリー（取引種別）の表示順
CATEGORY_ORDER = [
    "売買（土地・戸建て）",
    "売買（マンション）",
    "賃貸",
]


# 書式定義。map は { PropertyData キー: セル or セルのリスト }。
FORMATS = {
    "rental_building": {
        "category": "賃貸",
        "label": "賃貸重説（建物賃貸借用 A4）",
        "template": os.path.join(BASE_DIR, "templates", "rental_building_template.xlsx"),
        "sheet": "建物賃貸借用",
        "map": {
            # 所在地は「住居表示」と「登記記録」の両欄に下書きする（要確認で補正）
            "所在地": ["L90", "L92"],
            "床面積": "Y100",          # 登記記録面積（数値のみ／㎡はテンプレ側ラベル）
            "所有者": "L106",          # 甲区 名義人 氏名
        },
        # 数値だけを書き込むフィールド（単位記号などを除去）
        "numeric": ["床面積"],
    },
    "sale_landbuilding": {
        "category": "売買（土地・戸建て）",
        "label": "売買契約書（土地建物・公募用 一般売主）",
        "template": os.path.join(BASE_DIR, "templates", "sale_landbuilding_template.xlsx"),
        "sheet": "(8)土地建物公薄用売買契約書（一般売主）",
        "map": {
            # （A）売買の目的物の表示（登記簿の記録による）
            "所在地": ["D10", "H18"],   # 土地の所在・建物の所在
            "地番": "W10",
            "地目": "AF10",
            "地積": ["AL10", "AL15"],    # 地積・土地面積合計
            "家屋番号": "AN18",
            "種類": "H19",
            "構造": "X19",
            "床面積": "AN21",            # 延床面積
            "所有者": "D5",              # 売主（登記名義人を下書き）
        },
        "numeric": ["地積", "床面積"],
    },
    "sale_mansion_contract": {
        "category": "売買（マンション）",
        "label": "売買契約書（区分所有建物・敷地権 宅建業者売主）",
        "template": os.path.join(BASE_DIR, "templates", "sale_mansion_contract_template.xlsx"),
        "sheet": "(13)区分所有建物用（敷地権）売買契約書(宅建業者売主)",
        "map": {
            # （A）目的物の表示：一棟／専有部分／敷地権の土地（符号1）
            "所在地": ["I8", "H16"],     # 一棟の所在・敷地権土地①所在
            "地番": "Z16",
            "地目": "AK16",
            "地積": "AT16",               # 敷地権土地①地積
            "家屋番号": "I12",            # 専有部分
            "種類": "AT12",               # 専有部分の種類
            "構造": "I13",                # 専有部分の構造
            "床面積": "AT13",             # 専有部分の床面積
        },
        "numeric": ["地積", "床面積"],
    },
    "sale_mansion_jyuusetsu": {
        "category": "売買（マンション）",
        "label": "重要事項説明書（区分所有建物の売買・交換用）",
        "template": os.path.join(BASE_DIR, "templates", "sale_mansion_jyuusetsu_template.xlsx"),
        "sheet": "(2)重要事項説明書(区分所有建物の売買・交換用)",
        "map": {
            # (1)建物：一棟／専有部分、(2)土地（敷地権 符号①）
            "所在地": ["M58", "F77"],     # 一棟の所在・敷地権土地①所在
            "地番": "V77",
            "地目": "AD77",
            "地積": "AO77",               # 敷地権土地①地積
            "家屋番号": "M62",            # 専有部分
            "種類": "M63",                # 専有部分の種類
            "構造": "M64",                # 専有部分の構造
            "床面積": "AD66",             # 専有部分 床面積（登記簿）
        },
        "numeric": ["地積", "床面積"],
    },
}


def list_formats() -> Dict[str, str]:
    """{key: label} を返す（UI のセレクタ用）。"""
    return {k: v["label"] for k, v in FORMATS.items()}


def list_categories() -> list:
    """登録済みカテゴリー（取引種別）を表示順で返す。"""
    present = {v.get("category", "その他") for v in FORMATS.values()}
    ordered = [c for c in CATEGORY_ORDER if c in present]
    # CATEGORY_ORDER に無いカテゴリーは末尾に追加
    ordered += [c for c in present if c not in ordered]
    return ordered


def formats_in_category(category: str) -> Dict[str, str]:
    """指定カテゴリーに属する {key: label} を返す。"""
    return {
        k: v["label"]
        for k, v in FORMATS.items()
        if v.get("category", "その他") == category
    }


def _numeric_only(value: str) -> str:
    """数値と小数点・カンマだけを残す。"""
    m = re.findall(r"[0-9０-９.,，]+", value)
    return m[0].replace("，", ",") if m else value


def export_to_format(data: Dict[str, str], format_key: str, output_path: str) -> str:
    """指定書式テンプレートに PropertyData を流し込み output_path に保存する。

    空フィールドは書き込まない（テンプレートの既定値・チェックボックスを保持）。
    無損失パッチ(xlsx_patcher)で書き込むため、図形・画像・他シートは保持される。
    戻り値は出力パス。
    """
    if format_key not in FORMATS:
        raise ValueError("未知の書式: {}".format(format_key))
    fmt = FORMATS[format_key]
    template_path = fmt["template"]
    if not os.path.exists(template_path):
        raise FileNotFoundError("テンプレートが見つかりません: {}".format(template_path))

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    numeric_fields = set(fmt.get("numeric", []))
    cells = {}  # {セル参照: 値}
    for field, target in fmt["map"].items():
        value = (data.get(field) or "").strip()
        if not value:
            continue  # 空欄はテンプレ既定を保持
        if field in numeric_fields:
            value = _numeric_only(value)
        refs = target if isinstance(target, list) else [target]
        for ref in refs:
            cells[ref] = value

    xlsx_patcher.set_cells(template_path, output_path, fmt["sheet"], cells)
    return output_path
