"""業者見積PDFからの工事明細抽出（見積書自動作成ツールと同じ仕組み）。

PDFはClaude Code CLI（claude コマンド）に直接読ませてJSONで明細を取得する。
Anthropic APIキーは不要。Claude Pro/Max サブスクリプションのみで動作する。
抽出した「工事名・金額」を LineItem に変換し、部材種別を自動判別する。
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

from models.restoration_data import LineItem
from services.excel_parser import (
    detect_material, _to_amount, _is_total_row, _to_float,
)


CLAUDE_BIN = "claude"
CLAUDE_TIMEOUT_SEC = 1800  # 30分（API混雑時も対応できる範囲）

_PROMPT = """\
日本語のリフォーム工事（原状回復）見積書PDFです（ファイル名: {filename}）。
レイアウトはPDFごとに異なります。内容を読み取り、JSONのみを返してください。

出力形式（このJSONのみ・説明文不要）:
{{
  "items": [{{"工事名": "", "金額": "", "数量": "", "単位": ""}}]
}}

注意事項:
・各明細行の「工事・項目・品名」を 工事名 に、その行の「金額（税込）」を 金額 に入れる
・金額が「小計」や「単価×数量」の場合は、その行の合計金額を入れる
・数量・単位は明細行に記載があれば、見積書の表記のまま入れる
  （例: 数量"27"・単位"m"、数量"9"・単位"㎡"、数量"11"・単位"本"）。なければ空文字
・単位が "m" でも "㎡" に変換せず、見積書に書かれた単位をそのまま入れる
・小計・合計・総計・御見積額・消費税・値引きなどの集計行は items に含めない
・金額が空欄の行は含めない
・金額・数量は数字のみ（カンマ・円記号・「円」は不要）
"""


class PdfExtractionError(RuntimeError):
    pass


def _run_claude(cmd: list[str], timeout: int, cwd: str | None) -> dict:
    try:
        proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError as e:
        raise PdfExtractionError(
            "`claude` コマンドが見つかりません。Claude Code CLI がインストールされ、"
            "PATH が通っていることを確認してください。"
        ) from e
    except subprocess.TimeoutExpired as e:
        raise PdfExtractionError(
            f"PDF解析が{timeout}秒を超えたため中断しました。しばらく待って再試行してください。"
        ) from e

    if proc.returncode != 0:
        raise PdfExtractionError(
            f"Claude の呼び出しに失敗しました（終了コード {proc.returncode}）。\n"
            f"{proc.stderr.strip()[:500]}"
        )
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise PdfExtractionError("Claude の応答をJSONとして解釈できませんでした。") from e


def _extract_items(result: dict) -> list[dict]:
    """Claude の result dict から工事明細リストを取り出す。"""
    if result.get("is_error"):
        raise PdfExtractionError(f"Claude がエラーを返しました: {result.get('result')}")

    raw_text = result.get("result", "")
    # ```json ... ``` ブロックがあれば中身を取り出す
    m = re.search(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", raw_text, re.DOTALL)
    json_str = m.group(1) if m else raw_text.strip()
    if not (json_str.startswith("{") or json_str.startswith("[")):
        m2 = re.search(r"(\{.*\}|\[.*\])", json_str, re.DOTALL)
        if m2:
            json_str = m2.group(1)

    try:
        parsed = json.loads(json_str)
    except json.JSONDecodeError as e:
        raise PdfExtractionError(
            f"Claude の応答をJSONとして解釈できませんでした。\n応答先頭: {raw_text[:300]}"
        ) from e

    if isinstance(parsed, dict):
        return parsed.get("items", [])
    if isinstance(parsed, list):
        return parsed
    raise PdfExtractionError("Claude の応答が配列・オブジェクト形式ではありませんでした。")


def parse_pdf(file_bytes: bytes, filename: str = "estimate.pdf") -> list[LineItem]:
    """業者見積PDF（バイト列）から LineItem のリストを抽出する。"""
    with tempfile.TemporaryDirectory(prefix="restoration_pdf_") as tmp_dir:
        tmp_path = Path(tmp_dir) / "estimate.pdf"
        tmp_path.write_bytes(file_bytes)
        prompt = _PROMPT.format(filename=tmp_path.name)
        cmd = [
            CLAUDE_BIN, "-p", prompt,
            "--output-format", "json",
            "--tools", "Read",
            "--add-dir", tmp_dir,
            "--dangerously-skip-permissions",
            "--model", "sonnet",
        ]
        result = _run_claude(cmd, timeout=CLAUDE_TIMEOUT_SEC, cwd=tmp_dir)

    raw_items = _extract_items(result)

    items: list[LineItem] = []
    for raw in raw_items:
        name = str(raw.get("工事名", "")).strip()
        amount = _to_amount(raw.get("金額"))
        if not name or amount is None or amount <= 0:
            continue
        # 合計・小計などの集計行が混ざっていた場合の保険
        if _is_total_row(name):
            continue

        # 数量・単位を業者表記のまま取得（クロス=m、CF=㎡ など）
        total_qty = _to_float(raw.get("数量"))
        unit = str(raw.get("単位", "")).strip()

        items.append(
            LineItem(
                name=name,
                vendor_amount=amount,
                material_type=detect_material(name),
                total_qty=total_qty,
                unit=unit,
            )
        )
    return items
