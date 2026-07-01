# -*- coding: utf-8 -*-
"""対話型ヒアリング。要件を選ぶと AI（受付）が業務口調で症状を聞き出し、
十分な情報が集まったら構造化データ（Analysis）に確定する。

claude CLI はステートレス（-p 呼び出し）なので、毎ターン会話履歴を丸ごと渡し、
AI には次のどちらかを JSON で返させる:
  - まだ情報不足        → {"done": false, "question": "次の質問（業務口調・1問）"}
  - 起票に十分そろった  → {"done": true, "analysis": {...スキーマ...}}
"""

import json

from core.models import Analysis
from data.apps import APP_NAMES, OTHER
# claude CLI 呼び出しと検証は解析モジュールの実装を再利用
from services.claude_analyzer import (
    _invoke_claude, _strip_fence, _validate, _fallback,
    _kind_constraint,
)

# 質問はこの回数まで。超えたら手持ちの情報で必ず確定させる（堂々巡り防止）。
MAX_QUESTIONS = 4


def opening(forced_kind: str, forced_app: str = "") -> str:
    """会話の第一声（決め打ち・AI呼び出し不要）。要件に応じて聞き方を変える。"""
    app = f"「{forced_app}」について、" if forced_app else ""
    if forced_kind == "不具合報告":
        return f"承知しました。{app}どのような不具合でしょうか？発生している症状を具体的にお聞かせください。"
    if forced_kind == "改善要望":
        return f"承知しました。{app}どのような改善をご希望でしょうか？ご要望の内容をお聞かせください。"
    if forced_kind == "新アプリ希望":
        return "承知しました。どのようなアプリをご希望でしょうか？解決したい業務や欲しい機能をお聞かせください。"
    if forced_kind == "その他":
        return f"承知しました。{app}ご用件をお聞かせください。"
    return f"ご報告ありがとうございます。{app}どのような内容かお聞かせください。"


def _render_convo(messages) -> str:
    lines = []
    for m in messages:
        who = "AI受付" if m.get("role") == "assistant" else "報告者"
        lines.append(f"{who}: {m.get('text', '')}")
    return "\n".join(lines)


def _user_text(messages) -> str:
    return "\n".join(m.get("text", "") for m in messages if m.get("role") == "user")


def _build_intake_prompt(messages, reporter, forced_app, forced_kind, asked) -> str:
    app_list = "\n".join(f"- {n}" for n in APP_NAMES)
    convo = _render_convo(messages)

    constraints = []
    if forced_app:
        constraints.append(f"対象アプリは「{forced_app}」で確定（target_app は必ずこれ）。")
    fixed_kind, allowed, kind_hint = _kind_constraint(forced_kind)
    if kind_hint:
        constraints.append(kind_hint)
    cons_block = ("\n【前提条件】\n" + "\n".join(f"- {c}" for c in constraints)) if constraints else ""

    finalize_push = ""
    if asked >= MAX_QUESTIONS:
        finalize_push = (
            f"\n【重要】すでに質問を{asked}回しています。これ以上は質問せず、"
            "必ず done:true にして、今ある情報だけで analysis を作成してください。"
        )

    return f"""あなたは社内Webアプリのサポート受付AIです。報告者と対話しながら、
開発チームが起票できるだけの情報を丁寧な業務口調で聞き出してください。

【対象アプリ一覧】
{app_list}
{cons_block}

【これまでの対話】
{convo}

【あなたのタスク】
起票に十分な情報（症状/現象、対象アプリ、発生タイミング・再現条件、エラー表示の有無など）が
そろったか判断してください。
- まだ不足 → 最も重要な確認を「1問だけ」、簡潔な業務口調で質問する。
- 十分そろった、または報告者がこれ以上答えられない → 確定して構造化する。
既に分かっていることは聞き返さないこと。質問は多くても{MAX_QUESTIONS}問まで。{finalize_push}

【出力ルール】
- 出力は JSON オブジェクトのみ。前置き・解説・コードフェンスは付けない。
- まだ不足の場合:
  {{"done": false, "question": "次の質問（業務口調・1文）"}}
- 十分な場合:
  {{"done": true, "analysis": {{
    "target_app": "（一覧の正式名称、該当なしは「{OTHER}」）",
    "kind": "致命的な不具合 / 軽微な不具合 / 機能要望 / 新アプリ希望 / 質問・その他",
    "priority": "高 / 中 / 低",
    "title": "簡潔な件名（40字程度）",
    "summary": "対話で分かった現象の詳細をMarkdownで整理",
    "cause_guess": "AI視点の初期原因の推測",
    "advice": "開発者への暫定対応アドバイス"
  }}}}

JSON のみを出力してください:"""


def next_turn(messages, reporter="不明", forced_app="", forced_kind="") -> dict:
    """会話履歴から「次の質問」または「確定(analysis)」を返す。

    戻り値:
      {"done": False, "question": str}
      {"done": True,  "analysis": Analysis}
    """
    asked = sum(1 for m in messages if m.get("role") == "assistant")
    prompt = _build_intake_prompt(messages, reporter, forced_app, forced_kind, asked)
    text = _invoke_claude(prompt)

    data = None
    if text:
        try:
            data = json.loads(_strip_fence(text))
        except (json.JSONDecodeError, TypeError):
            data = None

    # CLI 失敗時は、手持ちの発話でフォールバック確定
    if not isinstance(data, dict):
        analysis = _fallback(_user_text(messages), forced_app, forced_kind)
        return {"done": True, "analysis": analysis}

    if data.get("done"):
        analysis = _validate(data.get("analysis", {}) or {}, _user_text(messages),
                             forced_app, forced_kind)
        return {"done": True, "analysis": analysis}

    # 質問回数の上限を超えていたら、AIが誤って質問を返しても確定に倒す
    if asked >= MAX_QUESTIONS:
        analysis = _fallback(_user_text(messages), forced_app, forced_kind)
        return {"done": True, "analysis": analysis}

    q = str(data.get("question", "")).strip() or "もう少し詳しくお聞かせいただけますか？"
    return {"done": False, "question": q}


def _build_finalize_prompt(messages, reporter, forced_app, forced_kind) -> str:
    """途中終了用：これ以上質問せず、今ある対話だけで構造化させるプロンプト。"""
    app_list = "\n".join(f"- {n}" for n in APP_NAMES)
    convo = _render_convo(messages)

    constraints = []
    if forced_app:
        constraints.append(f"対象アプリは「{forced_app}」で確定（target_app は必ずこれ）。")
    _, _, kind_hint = _kind_constraint(forced_kind)
    if kind_hint:
        constraints.append(kind_hint)
    cons_block = ("\n【前提条件】\n" + "\n".join(f"- {c}" for c in constraints)) if constraints else ""

    return f"""あなたは社内Webアプリのサポート受付AIです。
報告者が対話を途中で切り上げました。追加の質問はせず、ここまでの対話内容だけで
開発チーム向けの報告書用データを作成してください。情報が不足していても、
分かっている範囲でまとめ、不明点は summary 内に「未確認」と明記してください。

【対象アプリ一覧】
{app_list}
{cons_block}

【これまでの対話】
{convo}

【出力ルール】
- 出力は JSON オブジェクトのみ。前置き・解説・コードフェンスは付けない。
- スキーマ:
{{
  "target_app": "（一覧の正式名称、該当なしは「{OTHER}」）",
  "kind": "致命的な不具合 / 軽微な不具合 / 機能要望 / 新アプリ希望 / 質問・その他",
  "priority": "高 / 中 / 低",
  "title": "簡潔な件名（40字程度）",
  "summary": "対話で分かった内容をMarkdownで整理（不明点は『未確認』と明記）",
  "cause_guess": "AI視点の初期原因の推測（分かる範囲で）",
  "advice": "開発者への暫定対応アドバイス（分かる範囲で）"
}}

JSON のみを出力してください:"""


def finalize(messages, reporter="不明", forced_app="", forced_kind="") -> Analysis:
    """途中終了時：ここまでの対話から報告書用の Analysis を確定して返す。"""
    user_text = _user_text(messages)
    prompt = _build_finalize_prompt(messages, reporter, forced_app, forced_kind)
    text = _invoke_claude(prompt)

    data = None
    if text:
        try:
            data = json.loads(_strip_fence(text))
        except (json.JSONDecodeError, TypeError):
            data = None

    if isinstance(data, dict) and data:
        return _validate(data, user_text, forced_app, forced_kind)
    return _fallback(user_text, forced_app, forced_kind)
