"""登記事項証明書 PDF（土地・建物）を解析し PropertyData 形式に整える。

抽出ロジックは utils.parser に委譲し、本サービスは
「土地 / 建物 PDF → PropertyData マージ用辞書」への変換に責任を持つ。
解析失敗時も例外を投げず空欄で返す。
"""

from typing import Dict, Optional

from utils import parser


def parse_registry(land_pdf=None, building_pdf=None) -> Dict[str, str]:
    """土地・建物の登記簿 PDF を解析して 1 つの辞書にまとめる。

    建物側の所有者・抵当権が取れればそれを優先（売買対象が建物のケースを想定）。
    取れない項目は空文字。
    """
    merged = {
        "所在地": "",
        "地番": "",
        "地目": "",
        "地積": "",
        "家屋番号": "",
        "種類": "",
        "構造": "",
        "床面積": "",
        "所有者": "",
        "抵当権": "",
    }

    if land_pdf is not None:
        land_text = parser.extract_text(land_pdf)
        land = parser.parse_land(land_text)
        for k, v in land.items():
            if v:
                merged[k] = v

    if building_pdf is not None:
        building_text = parser.extract_text(building_pdf)
        building = parser.parse_building(building_text)
        for k, v in building.items():
            if v:
                merged[k] = v  # 建物側を優先上書き

    return merged
