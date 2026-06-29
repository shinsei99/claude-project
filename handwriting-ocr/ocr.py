"""手書きPDF/画像からの検針値抽出ロジック。

Claude Code CLI（claude コマンド）を subprocess で呼び出す。
Anthropic APIキーは不要。Claude Pro/Max サブスクリプションのみで動作する。
"""
from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

CLAUDE_BIN = "claude"
CLAUDE_TIMEOUT_SEC = 600

# ── 検針記録専用プロンプト ────────────────────────────────────────────

_METER_PROMPT = """\
電気・水道メーターの検針記録作業です。

【Excelの行構造（Row番号 / 識別子）】
{compact_text}

【依頼】
PDFファイル（ファイル名: {filename}）の「{target_date}」列に手書きされた
指示数（検針値）を読み取り、上記の行構造と照合してJSONで返してください。

出力形式（このJSONのみ・説明文不要）:
{{
  "updates": [
    {{"row": 行番号, "col": {target_col}, "value": 検針値の整数}},
    ...
  ]
}}

ルール:
・rowは上記 Row番号（1始まり）
・colは必ず {target_col} で固定
・valueは指示数（累積メーター値）の整数のみ
・差引・合計・小計行は含めない
・読み取れない値はスキップ
"""

# ── 汎用（自由OCR）プロンプト ────────────────────────────────────────

_AUTO_PROMPT = """\
手書きの{filetype}です（ファイル名: {filename}）。
画像内のテキストや表を読み取り、JSONのみを返してください。

出力形式（このJSONのみ・説明文不要）:
{{
  "columns": ["列名1", "列名2", ...],
  "rows": [
    ["値1", "値2", ...],
    ...
  ]
}}

注意事項:
・表形式なら "columns" にヘッダー行、"rows" にデータ行
・合計・小計行は含めない
・数字はカンマや通貨記号なしで入れる
・手書き文字は読み取れる範囲で正確に認識する
"""


class OcrError(RuntimeError):
    pass


def _safe_name(filename: str) -> str:
    name = Path(filename).name or "input"
    ext = Path(name).suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"):
        return "input.jpg"
    return name


def _run_claude(file_bytes: bytes, filename: str, prompt: str) -> str:
    save_name = _safe_name(filename)

    try:
        from pdf_orient import ensure_upright_bytes
        file_bytes = ensure_upright_bytes(file_bytes, save_name)
    except Exception:
        pass  # 向き補正に失敗しても元データで続行

    with tempfile.TemporaryDirectory(prefix="ocr_") as tmp_dir:
        tmp_path = Path(tmp_dir) / save_name
        tmp_path.write_bytes(file_bytes)

        cmd = [
            CLAUDE_BIN, "-p", prompt,
            "--output-format", "json",
            "--tools", "Read",
            "--add-dir", tmp_dir,
            "--dangerously-skip-permissions",
            "--model", "claude-sonnet-4-6",
            "--effort", "low",
        ]

        try:
            proc = subprocess.run(
                cmd, cwd=tmp_dir, capture_output=True, text=True, timeout=CLAUDE_TIMEOUT_SEC
            )
        except FileNotFoundError as e:
            raise OcrError(
                "`claude` コマンドが見つかりません。Claude Code CLI がインストールされ PATH が通っていることを確認してください。"
            ) from e
        except subprocess.TimeoutExpired as e:
            raise OcrError(f"解析が {CLAUDE_TIMEOUT_SEC} 秒を超えたため中断しました。再試行してください。") from e

        if proc.returncode != 0:
            raise OcrError(
                f"Claude の呼び出しに失敗しました（終了コード {proc.returncode}）。\n{proc.stderr.strip()[:500]}"
            )

        try:
            result = json.loads(proc.stdout)
        except json.JSONDecodeError as e:
            raise OcrError("Claude の応答を JSON として解釈できませんでした。") from e

    if result.get("is_error"):
        raise OcrError(f"Claude がエラーを返しました: {result.get('result')}")

    return result.get("result", "")


def _parse_json_from_text(raw_text: str) -> dict:
    m = re.search(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", raw_text, re.DOTALL)
    json_str = m.group(1) if m else raw_text.strip()

    if not (json_str.startswith("{") or json_str.startswith("[")):
        m2 = re.search(r"(\{.*\}|\[.*\])", json_str, re.DOTALL)
        if m2:
            json_str = m2.group(1)

    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        raise OcrError(
            f"Claude の応答を JSON として解釈できませんでした。\n応答先頭: {raw_text[:400]}"
        ) from e


def extract_meter_readings(
    pdf_bytes: bytes,
    filename: str,
    compact_text: str,
    target_date: str,
    target_col: int,
) -> list[dict]:
    """コンパクトなExcel行構造を参照しながらPDFから検針値を抽出する。

    Returns:
        [{"row": int, "col": int, "value": int}, ...]
    """
    prompt = _METER_PROMPT.format(
        compact_text=compact_text,
        filename=_safe_name(filename),
        target_date=target_date,
        target_col=target_col,
    )
    raw_text = _run_claude(pdf_bytes, filename, prompt)
    parsed = _parse_json_from_text(raw_text)

    if not isinstance(parsed, dict) or "updates" not in parsed:
        raise OcrError("Claude の応答が期待した形式ではありませんでした。")

    updates = []
    for u in parsed["updates"]:
        try:
            updates.append({
                "row": int(u["row"]),
                "col": int(u["col"]),
                "value": u["value"],
            })
        except (KeyError, ValueError, TypeError):
            continue
    return updates


def extract_auto(
    file_bytes: bytes,
    filename: str,
) -> tuple[list[str], list[list[str]]]:
    """列名も自動検出してPDF/画像からデータを抽出する（汎用モード）。"""
    filetype = "PDF" if Path(filename).suffix.lower() == ".pdf" else "画像"
    prompt = _AUTO_PROMPT.format(filetype=filetype, filename=_safe_name(filename))
    raw_text = _run_claude(file_bytes, filename, prompt)
    parsed = _parse_json_from_text(raw_text)

    if not isinstance(parsed, dict):
        raise OcrError("Claude の応答が期待した形式ではありませんでした。")

    columns = [str(c) for c in parsed.get("columns", [])]
    n = len(columns)
    rows = []
    for row in parsed.get("rows", []):
        if isinstance(row, list):
            padded = [str(v) for v in row] + [""] * max(0, n - len(row))
            rows.append(padded[:n])
    return columns, rows
