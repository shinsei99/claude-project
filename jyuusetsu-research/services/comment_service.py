"""AI コメント生成（テンプレート方式・LLM 不使用）。

法令制限・災害リスク・周辺環境を統合し、約 200 文字の説明文を
Python のテンプレートで組み立てる。OpenAI API は使用しない。
将来 LLM を導入する場合もこの関数の差し替えで対応できる構造とする。
"""

from typing import Dict


def generate_comment(data: Dict[str, str]) -> str:
    """PropertyData から重説下調べ用の説明文（約 200 文字）を生成する。"""
    parts = []

    # 法令制限
    youto = data.get("用途地域", "").strip()
    kenpei = data.get("建ぺい率", "").strip()
    yoseki = data.get("容積率", "").strip()
    bouka = data.get("防火地域", "").strip()
    if youto:
        seg = "本物件は用途地域「{}」に所在し".format(youto)
        if kenpei or yoseki:
            seg += "、建ぺい率{}・容積率{}".format(kenpei or "（要確認）", yoseki or "（要確認）")
        if bouka:
            seg += "、{}".format(bouka)
        seg += "の制限を受けます。"
        parts.append(seg)
    else:
        parts.append("用途地域等の法令制限は自治体都市計画図での確認が必要です。")

    # 災害リスク
    flood = data.get("洪水浸水想定", "").strip()
    dosha = data.get("土砂災害", "").strip()
    tsunami = data.get("津波", "").strip()
    risks = [r for r in [flood, dosha, tsunami] if r]
    if risks:
        parts.append("災害リスクとして{}が確認されています。".format("、".join(risks)))
    else:
        parts.append("洪水・土砂・津波の各リスクはハザードマップでの確認を要します。")

    # 周辺環境
    station = data.get("最寄駅", "").strip()
    dist = data.get("駅距離", "").strip()
    if station:
        if dist:
            parts.append("交通は最寄りの{}まで{}です。".format(station, dist))
        else:
            parts.append("最寄駅は{}です。".format(station))

    text = "".join(parts)
    text += "（本文は調査支援用の下書きであり、宅建士による確認・補正が必要です。）"
    return text
