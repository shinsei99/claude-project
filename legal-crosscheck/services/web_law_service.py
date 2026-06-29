# -*- coding: utf-8 -*-
"""自治体の都市計画情報（マップナビおおさか等）をWeb調査して法令制限を補完する。

国交省APIで取れない 建ぺい率・容積率・防火地域・高度地区・日影規制 等を、
claude CLI の WebSearch/WebFetch で自治体公式の都市計画情報から取得する。
"""

from __future__ import annotations

import json
import re
import subprocess

CLAUDE_BIN = "claude"
TIMEOUT = 300


class WebLawError(RuntimeError):
    pass


def research_web(address: str, use_district: str = "", city: str = "") -> dict:
    """住所の法令制限をWeb調査して dict で返す。不明項目は空。"""
    hint = []
    if city:
        hint.append(f"自治体: {city}")
    if use_district:
        hint.append(f"用途地域(API判定): {use_district}")
    hint_block = "\n".join(hint) if hint else "（手がかりなし）"

    prompt = f"""不動産の重要事項説明のため、次の物件所在地の「法令上の制限」を **WebSearchツールで自治体の都市計画情報から** 調べてください。

■ 物件所在地：{address}
{hint_block}

調べる情報源は、その自治体の公式都市計画情報を最優先してください。例：
- 大阪府/大阪市域 → 「マップナビおおさか」
- 各市区町村の「都市計画情報」「用途地域 検索」GIS や都市計画図
できる限り番地レベルで特定し、次の各項目を埋めてください。

効率重視：WebSearchは2〜3回程度に絞り、手早く判断してください（深追いしすぎない）。
出力は次のJSONのみ（コードフェンス可、他の文章・出典リンクは付けない）。
不明な項目は空文字 "" にし、創作はしないこと。数値は単位なしの数だけ。
{{
  "用途地域": "",
  "建ぺい率": 数値または""（％）,
  "容積率": 数値または""（％）,
  "防火地域": "防火地域/準防火地域/法22条区域/指定なし のいずれか",
  "高度地区": "例: 第2種高度地区 / なし",
  "日影規制": "例: 4h-2.5h/4m / 規制なし",
  "その他制限": "地区計画・高度利用地区・景観地区・都市計画道路・風致地区など該当事項を簡潔に",
  "備考": "確認に用いた自治体情報源の名称（例: マップナビおおさか）と注意点を一言"
}}"""

    cmd = [CLAUDE_BIN, "-p", prompt, "--output-format", "json",
           "--tools", "WebSearch WebFetch",
           "--dangerously-skip-permissions", "--model", "sonnet"]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT)
    except FileNotFoundError as e:
        raise WebLawError("`claude` コマンドが見つかりません。") from e
    except subprocess.TimeoutExpired as e:
        raise WebLawError("Web法令調査がタイムアウトしました。") from e
    if proc.returncode != 0:
        raise WebLawError(f"Claude呼び出し失敗（{proc.returncode}）\n{proc.stderr.strip()[:300]}")
    try:
        result = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise WebLawError("応答をJSONとして解釈できませんでした。") from e
    if result.get("is_error"):
        raise WebLawError(f"Claudeがエラーを返しました: {result.get('result')}")

    raw = result.get("result", "")
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        raise WebLawError(f"法令情報を解釈できませんでした。応答: {raw[:200]}")
    return json.loads(m.group(0))


def _to_float(v) -> float:
    try:
        return float(re.sub(r"[^0-9.]", "", str(v)) or 0)
    except Exception:
        return 0.0


def merge_into_admin(adm, web: dict):
    """Web調査結果を AdminMaster に統合（APIで空の項目を補完）。"""
    if not adm.use_district and web.get("用途地域"):
        adm.use_district = str(web["用途地域"]).strip()
    if not adm.building_coverage:
        adm.building_coverage = _to_float(web.get("建ぺい率"))
    if not adm.floor_area_ratio:
        adm.floor_area_ratio = _to_float(web.get("容積率"))
    if not adm.fire_zone and web.get("防火地域"):
        adm.fire_zone = str(web["防火地域"]).strip()
    if not adm.height_district and web.get("高度地区"):
        adm.height_district = str(web["高度地区"]).strip()
    if web.get("日影規制"):
        adm.hikage_kisei = str(web["日影規制"]).strip()
    if web.get("その他制限"):
        adm.other_restrictions = str(web["その他制限"]).strip()
    if web.get("備考"):
        adm.web_source = str(web["備考"]).strip()
    return adm
