# -*- coding: utf-8 -*-
"""査定価格の説明書「査定の根拠」を claude CLI で生成する。"""

from __future__ import annotations

import json
import re
import subprocess

CLAUDE_BIN = "claude"
TIMEOUT = 420


class ExplainError(RuntimeError):
    pass


def _strip_sources(text: str) -> str:
    """末尾に付きがちな出典リスト（Sources:/出典/参考）を除去する。"""
    for marker in ("\nSources:", "\nSource:", "\n出典", "\n参考：", "\n参考:", "\n【出典"):
        idx = text.find(marker)
        if idx != -1:
            text = text[:idx]
    # 行頭の "- [..](..)" 形式のリンク行も削除
    lines = [ln for ln in text.splitlines() if not re.match(r"\s*[-・*]\s*\[.*\]\(http", ln)]
    return "\n".join(lines).strip()


def generate_explanation(*, property_type, subject, trades, calc, ryutsu_ratio=None, note="") -> str:
    """査定の根拠の文章を生成する。"""
    area = subject.get("exclusive_area") or subject.get("land_area") or 0
    trade_lines = []
    for i, t in enumerate(trades[:3], 1):
        if not t.get("address"):
            continue
        trade_lines.append(
            f"事例{['①','②','③'][i-1]}：{t.get('address','')} "
            f"価格{t.get('price_man','')}万円 単価{int(t.get('unit_price') or 0):,}円/㎡ "
            f"築{t.get('build_ym','')} {t.get('trade_ym','')}"
        )
    trades_block = "\n".join(trade_lines) if trade_lines else "（事例情報なし）"
    ratio_line = f"\n流通性比率：{ryutsu_ratio}" if ryutsu_ratio else ""

    station = (subject.get("station") or "").strip()
    prompt = f"""あなたは不動産仲介のベテラン担当者です。お客様にお渡しする「査定価格についての説明書」の
『査定の根拠』にあたる本文を、丁寧な敬体（です・ます調）で作成してください。

まず **WebSearch ツールで周辺環境を実際に調べてから** 執筆してください。
調べる対象（査定物件の所在地・最寄駅を手がかりに）：
- 最寄駅・路線、都心方面へのアクセス
- 周辺の商業施設・スーパー、学校区、公園・医療施設などの生活利便
- 住宅地としての評判・人気度、その地域の不動産需要や相場の傾向
ネットで確認できた事実のみを根拠に反映し、確認できない事項は一般的表現にとどめてください。

■ 物件種別：{property_type}
■ 査定物件（所在地）：{subject.get('address','')}
■ 最寄駅・路線：{station or "（記載なし）"}
■ 面積：{area:g}㎡
■ 査定価格：{calc.get('total',0):,}円
■ 採用した取引事例：
{trades_block}{ratio_line}
■ 担当者メモ（反映してよい）：{note or "（特になし）"}

【作成ルール】
- 出力は本文のみ。宛名・日付・署名・「査定の根拠」という見出し・出典/参考リンクは一切含めない。
- 4〜6文程度、250〜400字。①地域の住環境・利便・需要（Web調査の事実を反映）②対象物件固有の特徴（立地・日当たり・間取り・流通性等）③採用事例と流通性比率の妥当性、に触れる。
- 事実を創作しない。具体的な施設名・地名はWeb調査やメモで確認できた範囲で書く。
- 最後は売却サポートへの前向きな一文で締める。

査定の根拠の本文のみを出力してください（出典は不要）："""

    cmd = [CLAUDE_BIN, "-p", prompt, "--output-format", "json",
           "--tools", "WebSearch WebFetch",
           "--dangerously-skip-permissions", "--model", "sonnet"]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT)
    except FileNotFoundError as e:
        raise ExplainError("`claude` コマンドが見つかりません。") from e
    except subprocess.TimeoutExpired as e:
        raise ExplainError("生成がタイムアウトしました。") from e
    if proc.returncode != 0:
        raise ExplainError(f"Claude呼び出し失敗（{proc.returncode}）\n{proc.stderr.strip()[:300]}")
    try:
        result = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise ExplainError("応答をJSONとして解釈できませんでした。") from e
    if result.get("is_error"):
        raise ExplainError(f"Claudeがエラーを返しました: {result.get('result')}")
    return _strip_sources(result.get("result", "").strip())
