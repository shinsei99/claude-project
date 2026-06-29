"""重要事項説明書・固定資産税評価証明書PDFからの自動パース。

PDFはClaude Code CLI（claude コマンド）に直接読ませてJSONで取得する。
Anthropic APIキーは不要。Claude Pro/Max サブスクリプションのみで動作する
（＝外部有料APIを使わない）。レイアウトが多様な両書類でも誤抽出に強い。
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path


CLAUDE_BIN = "claude"
CLAUDE_TIMEOUT_SEC = 1800  # 30分（API混雑時も対応できる範囲）


_PROMPT_EXPLANATION = """\
日本語の不動産「重要事項説明書」または「売買契約書」PDFです（ファイル名: {filename}）。
レイアウトはPDFごとに異なります。内容を読み取り、JSONのみを返してください。

出力形式（このJSONのみ・説明文不要）:
{{
  "売買代金": "",
  "手付金": "",
  "管理費月額": "",
  "修繕積立金月額": "",
  "売主氏名": "",
  "買主氏名": "",
  "物件所在": ""
}}

注意事項:
・金額は数字のみ（カンマ・円記号・「円」「金」は不要）。記載がなければ空文字
・「売買代金」は物件の総額。「手付金」は契約時授受の手付金額
・管理費・修繕積立金は1ヶ月あたりの月額（年額しかなければ12で割らずそのまま書かず空文字）
・売主・買主が複数いる場合は代表者1名でよい。法人名でも可
・物件所在は登記上の所在地（マンション名・部屋番号があれば含める）
"""

_PROMPT_TAX = """\
日本語の「固定資産税 評価証明書」「公租公課証明書」「納税通知書」または
「課税明細書」PDFです（ファイル名: {filename}）。内容を読み取りJSONのみを返してください。

出力形式（このJSONのみ・説明文不要）:
{{
  "固定資産税相当額": "",
  "都市計画税相当額": "",
  "年度": ""
}}

注意事項:
・金額は数字のみ（カンマ・円記号・「円」は不要）。年額（1年分）の相当額を入れる
・「固定資産税相当額」「都市計画税相当額」が明記されていればその額。
  税額が「相当額」でなく課税標準額しか無い場合でも、税額欄（税相当額）を優先して拾う
・複数筆・複数区分がある場合は合計額を入れる
・「年度」は課税年度の表記（例: 令和6年度）。なければ空文字
"""


_PROMPT_RENTAL = """\
日本語の「賃貸借契約書」または「賃貸 重要事項説明書」PDFです（ファイル名: {filename}）。
レイアウトはPDFごとに異なります。内容を読み取り、JSONのみを返してください。

出力形式（このJSONのみ・説明文不要）:
{{
  "家賃": "", "共益費": "", "駐車場": "", "火災保険": "",
  "敷金": "", "礼金": "", "保証料": "", "鍵交換代": "",
  "駐車場礼金": "", "仲介手数料": "",
  "貸主氏名": "", "借主氏名": "", "物件所在": "", "入居日": ""
}}

注意事項:
・金額は数字のみ（カンマ・円記号・「円」「ヶ月」は不要）。記載がなければ空文字
・家賃・共益費・駐車場・火災保険は1ヶ月あたりの月額。火災保険が年額なら12で割らず空文字
・敷金・礼金・保証料が「家賃の○ヶ月」と書かれている場合は金額に換算して入れる
・貸主＝オーナー（管理会社でなく所有者）、借主＝入居者。法人名でも可
・入居日は契約開始日・賃料発生日。YYYY-MM-DD 形式。なければ空文字
・物件所在は部屋番号も含める
"""


class PdfExtractionError(RuntimeError):
    pass


def _run_claude(prompt: str, tmp_dir: str) -> dict:
    cmd = [
        CLAUDE_BIN, "-p", prompt,
        "--output-format", "json",
        "--tools", "Read",
        "--add-dir", tmp_dir,
        "--dangerously-skip-permissions",
        "--model", "sonnet",
    ]
    try:
        proc = subprocess.run(
            cmd, cwd=tmp_dir, capture_output=True, text=True, timeout=CLAUDE_TIMEOUT_SEC
        )
    except FileNotFoundError as e:
        raise PdfExtractionError(
            "`claude` コマンドが見つかりません。Claude Code CLI がインストールされ、"
            "PATH が通っていることを確認してください。"
        ) from e
    except subprocess.TimeoutExpired as e:
        raise PdfExtractionError(
            f"PDF解析が{CLAUDE_TIMEOUT_SEC}秒を超えたため中断しました。"
            "しばらく待って再試行してください。"
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


def _extract_json(result: dict) -> dict:
    """Claude の result dict から本体JSON（オブジェクト）を取り出す。"""
    if result.get("is_error"):
        raise PdfExtractionError(f"Claude がエラーを返しました: {result.get('result')}")

    raw_text = result.get("result", "")
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
    json_str = m.group(1) if m else raw_text.strip()
    if not json_str.startswith("{"):
        m2 = re.search(r"(\{.*\})", json_str, re.DOTALL)
        if m2:
            json_str = m2.group(1)
    try:
        parsed = json.loads(json_str)
    except json.JSONDecodeError as e:
        raise PdfExtractionError(
            f"Claude の応答をJSONとして解釈できませんでした。\n応答先頭: {raw_text[:300]}"
        ) from e
    if not isinstance(parsed, dict):
        raise PdfExtractionError("Claude の応答がオブジェクト形式ではありませんでした。")
    return parsed


def _parse_pdf(file_bytes: bytes, prompt_template: str) -> dict:
    try:
        from pdf_orient import ensure_upright_pdf
        file_bytes = ensure_upright_pdf(file_bytes)
    except Exception:
        pass  # 向き補正に失敗しても元PDFで続行
    with tempfile.TemporaryDirectory(prefix="settlement_pdf_") as tmp_dir:
        tmp_path = Path(tmp_dir) / "document.pdf"
        tmp_path.write_bytes(file_bytes)
        prompt = prompt_template.format(filename=tmp_path.name)
        result = _run_claude(prompt, tmp_dir)
    return _extract_json(result)


def parse_explanation(file_bytes: bytes) -> dict:
    """重要事項説明書PDFから売買条件・宛名をパースする。"""
    return _parse_pdf(file_bytes, _PROMPT_EXPLANATION)


def parse_tax_certificate(file_bytes: bytes) -> dict:
    """固定資産税評価証明書PDFから税額をパースする。"""
    return _parse_pdf(file_bytes, _PROMPT_TAX)


def parse_rental_explanation(file_bytes: bytes) -> dict:
    """賃貸借契約書・賃貸重説PDFから賃料・一時金・宛名をパースする。"""
    return _parse_pdf(file_bytes, _PROMPT_RENTAL)


def to_amount(value) -> int:
    """「1,200,000」「¥1,200,000」などを int に変換。失敗時は0。"""
    if value is None:
        return 0
    s = re.sub(r"[^\d.\-]", "", str(value))
    if not s or s in ("-", ".", "-."):
        return 0
    try:
        return int(round(float(s)))
    except ValueError:
        return 0
