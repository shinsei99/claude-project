# -*- coding: utf-8 -*-
"""チャット報告（テキスト＋スクリーンショット）を claude CLI で解析し、
構造化データ（Analysis）に変換する。

既存アプリ（見積書自動生成ツール / 媒介契約書ジェネレーター等）と同じく
`claude` CLI をサブプロセスで呼ぶ方式。APIキーは不要。
  - テキストのみ:  claude -p <prompt> --output-format json --dangerously-skip-permissions --model sonnet
  - 画像あり:      上記に --tools Read --add-dir <tmpdir> を足し、cwd=<tmpdir> で実行。
                  プロンプトから画像ファイル名を参照し Read ツールで開かせる。
CLI が使えない/失敗した場合はキーワード照合のフォールバックで最低限の分類を返す。
"""

import json
import os
import re
import shutil
import subprocess
import tempfile

import config
from core.models import Analysis, KINDS, PRIORITIES
from data.apps import APP_NAMES, OTHER, guess_app, normalize_app


# ── claude CLI 呼び出し（canonical パターン） ─────────────────────────
def _invoke_claude(prompt: str, extra_args=None, cwd=None, timeout=None, model=None):
    """claude CLI を実行し、モデルの応答テキスト（result）を返す。失敗時 None。"""
    claude_bin = config.CLAUDE_BIN
    if not os.path.exists(claude_bin):
        found = shutil.which("claude")
        if not found:
            print(f"[claude] CLI が見つかりません: {claude_bin}")
            return None
        claude_bin = found

    cmd = [
        claude_bin, "-p", prompt,
        "--output-format", "json",
        "--dangerously-skip-permissions",
        "--model", model or config.CLAUDE_MODEL,
    ] + (extra_args or [])

    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True,
            timeout=timeout or config.CLAUDE_TIMEOUT, cwd=cwd,
        )
    except FileNotFoundError:
        print(f"[claude] 実行できません: {claude_bin}")
        return None
    except subprocess.TimeoutExpired:
        print(f"[claude] {timeout or config.CLAUDE_TIMEOUT}秒でタイムアウト")
        return None

    if proc.returncode != 0:
        print(f"[claude] エラー終了 code={proc.returncode}: {(proc.stderr or '')[:200]}")
        return None
    try:
        outer = json.loads(proc.stdout)
    except json.JSONDecodeError:
        print("[claude] 出力を JSON として解釈できませんでした")
        return None
    if outer.get("is_error"):
        print(f"[claude] AIがエラーを返しました: {str(outer.get('result'))[:200]}")
        return None
    return outer.get("result", "")


def _strip_fence(text: str) -> str:
    """```json ... ``` や前後の文章を取り除いて JSON 本体を抜き出す。"""
    text = (text or "").strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if m:
        return m.group(1).strip()
    s, e = text.find("{"), text.rfind("}")
    if s != -1 and e != -1 and e > s:
        return text[s:e + 1]
    return text


# ── プロンプト ───────────────────────────────────────────────────────
# 粗い要件区分 → (確定kind or None, 許容kind集合 or None, プロンプト指示)
def _kind_constraint(forced_kind: str):
    if forced_kind == "改善要望":
        return "機能要望", None, "報告者はこれを『改善要望』として投稿しています。kind は必ず「機能要望」にすること。"
    if forced_kind == "新アプリ希望":
        return "新アプリ希望", None, "報告者はこれを『新アプリ希望（新規開発の要望）』として投稿しています。kind は必ず「新アプリ希望」にすること。target_app は既存アプリではなく「その他・不明」で構わない。"
    if forced_kind == "その他":
        return "質問・その他", None, "報告者はこれを『その他（質問など）』として投稿しています。kind は必ず「質問・その他」にすること。"
    if forced_kind == "不具合報告":
        return None, {"致命的な不具合", "軽微な不具合"}, \
            "報告者はこれを『不具合報告』として投稿しています。kind は深刻度に応じて「致命的な不具合」か「軽微な不具合」から選ぶこと。"
    return None, None, ""


def _build_prompt(text: str, reporter: str, image_files, forced_app: str = "", forced_kind: str = "") -> str:
    app_list = "\n".join(f"- {n}" for n in APP_NAMES)
    kinds = " / ".join(KINDS)
    prios = " / ".join(PRIORITIES)

    fixed_block = ""
    if forced_app:
        fixed_block += (
            f"\n【対象アプリは確定済み】\n報告者が対象アプリを「{forced_app}」と明示しています。"
            f"target_app には必ず「{forced_app}」を入れ、その前提で概要・原因推測・アドバイスを書いてください。\n"
        )
    _, _, kind_hint = _kind_constraint(forced_kind)
    if kind_hint:
        fixed_block += f"\n【要件区分の指定】\n{kind_hint}\n"

    img_block = ""
    if image_files:
        listed = "\n".join(f"- {f}" for f in image_files)
        img_block = (
            "\n【添付スクリーンショット】\n"
            "次の画像ファイルを必ず Read ツールで開いて内容（エラー表示・画面状態・"
            "文言など）を読み取り、判定材料にしてください。\n"
            f"{listed}\n"
        )

    return f"""あなたは社内Webアプリのサポート受付AIです。社員からのチャット報告を読み、
開発チームが即座に対応できるよう内容を構造化してください。

【対象アプリ一覧（この中から最も合致するものを1つだけ選ぶ。該当なしは「{OTHER}」）】
{app_list}

【報告者】{reporter or "不明"}
{fixed_block}
【報告本文】
{text or "(本文なし)"}
{img_block}
【判定項目】
1. target_app : 上記一覧のいずれか1つの正式名称（該当なしは「{OTHER}」）
2. kind       : 投稿種類 = {kinds}
   - 致命的な不具合: 画面が真っ白/動かない/業務が停止する
   - 軽微な不具合  : 表示崩れ/文言ミス/代替手段がある動作不良
   - 機能要望      : 既存アプリへの新機能追加・ボタン配置変更など
   - 新アプリ希望  : 既存アプリの改修ではなく、新しいアプリの新規開発を希望
   - 質問・その他  : 使い方が分からない等
3. priority   : 優先度 = {prios}
   - 高: 業務が完全に停止する致命的な不具合
   - 中: エラーは出るが代替手段がある、または重要な要望
   - 低: 急ぎでない表示崩れや要望
4. title      : タスクのタイトル（簡潔に。40字程度）
5. summary    : 現象の詳細概要（Markdownで整理。箇条書き可。ユーザーの訴えを明確に）
6. cause_guess: 開発者が初動を早められるよう、AI視点での初期原因の推測
7. advice     : 暫定的な対応アドバイス（開発者向け）

【出力ルール】
- 出力は JSON オブジェクトのみ。前置き・解説・コードフェンスは付けない。
- 値を創作しすぎない。不明な点は推測である旨を summary/cause_guess 内で明示する。

【JSONスキーマ】
{{
  "target_app": "",
  "kind": "",
  "priority": "",
  "title": "",
  "summary": "",
  "cause_guess": "",
  "advice": ""
}}

JSON のみを出力してください:"""


# ── 公開関数 ─────────────────────────────────────────────────────────
def analyze(text: str, reporter: str = "不明", image_paths=None,
            forced_app: str = "", forced_kind: str = "") -> Analysis:
    """報告を解析して Analysis を返す（例外は投げない。失敗時フォールバック）。

    forced_app を渡すと対象アプリはそれで確定、forced_kind を渡すと要件区分を尊重
    （不具合報告は深刻度のみ AI 判定）。いずれも AI の推測を上書きする。
    """
    image_paths = image_paths or []
    # 空なら AI 自動判定、指定があれば正式名称に丸めて確定
    forced_app = normalize_app(forced_app) if forced_app else ""

    result_text = None
    if image_paths:
        # 画像は一時ディレクトリに集約し、Read ツールで開かせる
        with tempfile.TemporaryDirectory(prefix="aitc_") as td:
            names = []
            for i, p in enumerate(image_paths):
                if not p or not os.path.exists(p):
                    continue
                ext = os.path.splitext(p)[1].lower() or ".png"
                name = f"shot_{i + 1}{ext}"
                shutil.copy(p, os.path.join(td, name))
                names.append(name)
            prompt = _build_prompt(text, reporter, names, forced_app, forced_kind)
            result_text = _invoke_claude(
                prompt,
                extra_args=["--tools", "Read", "--add-dir", td],
                cwd=td,
                timeout=max(config.CLAUDE_TIMEOUT, 600),
            )
    else:
        result_text = _invoke_claude(_build_prompt(text, reporter, [], forced_app, forced_kind))

    data = None
    if result_text:
        try:
            data = json.loads(_strip_fence(result_text))
        except (json.JSONDecodeError, TypeError):
            data = None

    if not isinstance(data, dict):
        return _fallback(text, forced_app, forced_kind)

    return _validate(data, text, forced_app, forced_kind)


def _validate(data: dict, text: str, forced_app: str = "", forced_kind: str = "") -> Analysis:
    """AI出力を許容値に丸めて Analysis を作る。"""
    if forced_app:
        # プルダウンで指定されていれば AI の推測より優先
        app = forced_app
    else:
        app = normalize_app(str(data.get("target_app", "")))
        if app == OTHER:
            # AIが不明でもキーワードで救済を試みる
            guessed = guess_app(text)
            if guessed != OTHER:
                app = guessed

    fixed_kind, allowed, _ = _kind_constraint(forced_kind)
    kind = str(data.get("kind", "")).strip()
    if fixed_kind:                       # 改善要望 / その他 は確定
        kind = fixed_kind
    elif allowed:                        # 不具合報告 は深刻度のみ AI 判定
        kind = kind if kind in allowed else "軽微な不具合"
    elif kind not in KINDS:              # 自動判定
        kind = "質問・その他"

    priority = str(data.get("priority", "")).strip()
    if priority not in PRIORITIES:
        priority = "中"

    title = str(data.get("title", "")).strip() or (text[:40] if text else "無題の報告")
    summary = str(data.get("summary", "")).strip() or (text or "")

    return Analysis(
        target_app=app,
        kind=kind,
        priority=priority,
        title=title,
        summary=summary,
        cause_guess=str(data.get("cause_guess", "")).strip(),
        advice=str(data.get("advice", "")).strip(),
    )


def _fallback(text: str, forced_app: str = "", forced_kind: str = "") -> Analysis:
    """CLI 不通時の最低限の分類（キーワードベース）。"""
    low = (text or "").lower()
    critical = any(k in text for k in ["真っ白", "落ちる", "動かない", "止まる", "エラーで進めない", "起動しない"])
    request = any(k in text for k in ["ほしい", "追加して", "できるように", "要望", "改善"])
    fixed_kind, allowed, _ = _kind_constraint(forced_kind)
    if fixed_kind:                       # 改善要望 / 新アプリ希望 / その他
        kind = fixed_kind
        priority = "低" if fixed_kind in ("機能要望", "新アプリ希望") else "中"
    elif allowed:                        # 不具合報告（深刻度のみ推定）
        kind = "致命的な不具合" if critical else "軽微な不具合"
        priority = "高" if critical else "中"
    elif critical:
        kind, priority = "致命的な不具合", "高"
    elif request:
        kind, priority = "機能要望", "低"
    elif "エラー" in text or "崩れ" in low:
        kind, priority = "軽微な不具合", "中"
    else:
        kind, priority = "質問・その他", "中"
    return Analysis(
        target_app=forced_app or guess_app(text),
        kind=kind,
        priority=priority,
        title=(text[:40] if text else "無題の報告"),
        summary=(text or "") + "\n\n（※AI解析に失敗したためキーワード分類で暫定起票）",
        cause_guess="AI解析に失敗したため未判定。",
        advice="claude CLI の稼働状況を確認してください。",
    )
