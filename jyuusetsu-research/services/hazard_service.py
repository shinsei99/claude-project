"""災害リスク（洪水浸水想定・土砂災害・津波）を取得する。

国土地理院ハザードマップのタイルは点クエリ API を提供していないため、
MVP では「ハザードマップポータルへの確認導線」を提示しつつ、
将来 タイル画素判定 / 不動産情報ライブラリ災害 API に差し替えられる構造とする。

リンク生成のみ確実に行い、判定値は空欄（要確認）で継続する。
"""

from typing import Dict, Optional, Tuple

# 国土地理院 ハザードマップポータル（重ねるハザードマップ）
HAZARD_PORTAL = "https://disaportal.gsi.go.jp/maps/index.html?ll={lat},{lon}&z=16"


def get_hazard(lat: float, lon: float) -> Dict[str, str]:
    """災害リスクを取得する。

    現状は自動判定値を持たないため空文字（重説では「要確認」）。
    確認用 URL は別途 hazard_link() で取得する。
    """
    return {
        "洪水浸水想定": "",
        "土砂災害": "",
        "津波": "",
    }


def hazard_link(lat: Optional[float], lon: Optional[float]) -> str:
    """重ねるハザードマップの該当地点 URL を返す（UI の確認導線用）。"""
    if lat is None or lon is None:
        return "https://disaportal.gsi.go.jp/"
    return HAZARD_PORTAL.format(lat=lat, lon=lon)
