"""登記簿（謄本）PDFの解析と地番処理。

pdfplumber でテキストを抽出し、正規表現で登記事項
（所在・地番・地目・地積・家屋番号・床面積・構造・建築年）を読み取る。
謄本のレイアウトは法務局の様式でほぼ共通だが、表記ゆれに備えて
複数パターンでマッチングし、取れなかった項目は空のまま返す
（UI 側でユーザーが補正できる前提）。
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

import pdfplumber

from models.valuation_data import RegistryInfo


class RegistryParseError(RuntimeError):
    pass


class PdfExtractionError(RuntimeError):
    """Claude CLI によるAI解析（スキャン画像対応）の失敗。"""


# 全角数字 → 半角
_Z2H = str.maketrans("０１２３４５６７８９．，－", "0123456789.,-")

# 和暦 → 西暦の元年（建築年の換算用）
_ERA_BASE = {"令和": 2018, "平成": 1988, "昭和": 1925, "大正": 1911, "明治": 1867}


def _normalize(text: str) -> str:
    """全角数字を半角化し、余分な空白を整理する。"""
    text = text.translate(_Z2H)
    # 数字の間に入りがちな空白を詰める（例: "1 23 . 45" → "123.45"）
    return text


def _to_float(s: str | None) -> float:
    if not s:
        return 0.0
    s = s.translate(_Z2H).replace(",", "").replace("，", "")
    m = re.search(r"\d+(?:\.\d+)?", s)
    return float(m.group()) if m else 0.0


def _to_int(s: str | None) -> int:
    return int(_to_float(s))


def _wareki_to_seireki(era: str, year_str: str) -> int:
    """和暦（令和3 等）を西暦に変換。'元' は 1 年扱い。"""
    base = _ERA_BASE.get(era)
    if base is None:
        return 0
    y = 1 if "元" in year_str else _to_int(year_str)
    return base + y if y else 0


def extract_text(pdf_bytes: bytes) -> str:
    """謄本PDFから全ページのテキストを連結して返す。"""
    try:
        import io

        parts: list[str] = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                parts.append(page.extract_text() or "")
        text = "\n".join(parts)
    except Exception as e:  # pdfplumber が開けない等
        raise RegistryParseError(
            "PDFの読み取りに失敗しました。テキスト埋め込みのある謄本PDFか確認してください。"
            "（スキャン画像のみのPDFは文字を抽出できません）"
        ) from e
    if not text.strip():
        raise RegistryParseError(
            "PDFから文字を抽出できませんでした。スキャン画像のみのPDFの可能性があります。"
            "登記情報提供サービス等のテキスト付きPDFをご利用ください。"
        )
    return _normalize(text)


def parse(pdf_bytes: bytes) -> RegistryInfo:
    """謄本PDFを解析して RegistryInfo を返す。"""
    text = extract_text(pdf_bytes)
    info = RegistryInfo()

    # ---- 所在 ----
    # 「所在  ○○市○○町一丁目」「所　在  …」表記に対応
    m = re.search(r"所\s*在\s+([^\n]+)", text)
    if m:
        info.location = m.group(1).strip()

    # ---- 地番 ----
    m = re.search(r"地\s*番\s+([0-9０-９\-番地の]+)", text)
    if m:
        info.chiban = m.group(1).strip()

    # ---- 地目 ----
    m = re.search(r"地\s*目\s+([^\s\n]+)", text)
    if m:
        info.chimoku = m.group(1).strip()

    # ---- 地積（㎡）----
    m = re.search(r"地\s*積[^\d]*([\d,\.]+)\s*(?:㎡|平方メートル|m2)", text)
    if m:
        info.land_area = _to_float(m.group(1))

    # ---- 家屋番号 ----
    m = re.search(r"家屋番号\s+([0-9０-９\-番のイロハ]+)", text)
    if m:
        info.kaoku_no = m.group(1).strip()

    # ---- 床面積（延床）----
    # 「床面積 ○○．○○㎡」または「1階 ○○㎡ 2階 ○○㎡」の合算
    floor_vals = re.findall(r"(?:[0-9]+階)?\s*([\d,]+\.\d+)\s*㎡", text)
    m = re.search(r"床\s*面\s*積[^\d]*([\d,\.]+)", text)
    if m:
        info.floor_area = _to_float(m.group(1))
    elif floor_vals:
        info.floor_area = round(sum(_to_float(v) for v in floor_vals), 2)

    # ---- 専有面積（マンション・区分建物）----
    m = re.search(r"(?:専有部分の床面積|床面積)[^\d]*([\d,\.]+)\s*㎡", text)
    if m:
        info.exclusive_area = _to_float(m.group(1))

    # ---- 構造 ----
    m = re.search(
        r"(鉄骨鉄筋コンクリート造|鉄筋コンクリート造|軽量鉄骨造|鉄骨造|木造|れんが造|ブロック造)",
        text,
    )
    if m:
        info.structure = m.group(1)

    # ---- 建築年（新築年月日 / 原因 ○年○月○日新築）----
    m = re.search(r"(令和|平成|昭和|大正|明治)\s*([0-9０-９元]+)\s*年\s*([0-9０-９]+)\s*月[^\n]*新築", text)
    if not m:
        m = re.search(r"(令和|平成|昭和|大正|明治)\s*([0-9０-９元]+)\s*年\s*([0-9０-９]+)\s*月", text)
    if m:
        info.build_year = _wareki_to_seireki(m.group(1), m.group(2))
        if info.build_year:
            info.build_ym = f"{info.build_year}年{_to_int(m.group(3))}月"

    # ---- マンション名（一棟の建物の名称・建物の名称）----
    m = re.search(r"(?:建物の名称|一棟の建物の名称)\s+([^\n]+)", text)
    if m:
        info.mansion_name = m.group(1).strip()

    return info


# ===========================================================================
# スキャン画像PDF対応：Claude Code CLI による AI 解析
# （見積書自動作成ツールと同じ仕組み。claude コマンドにPDFを直接読ませる。
#   画像のみのPDFでもOCRして読み取れる。Anthropic APIキーは不要で
#   Claude Pro/Max サブスクリプションのみで動作する。）
# ===========================================================================

CLAUDE_BIN = "claude"
CLAUDE_TIMEOUT_SEC = 1800  # 30分（混雑時も対応できる範囲）

_CLAUDE_PROMPT = """\
日本語の不動産登記簿（登記事項証明書・謄本）PDFです（ファイル名: {filename}）。
土地・建物の登記事項を読み取り、JSONのみを返してください（説明文不要）。
スキャン画像の場合も文字を読み取ってください。

出力形式（このJSONのみ）:
{{
  "所在": "",
  "地番": "",
  "地目": "",
  "地積": "",
  "家屋番号": "",
  "床面積": "",
  "構造": "",
  "建築年": "",
  "建築年月": "",
  "建物の名称": "",
  "専有面積": "",
  "所在階": "",
  "総階数": ""
}}

注意事項:
・「所在」は土地・建物の所在地（例「○○市○○町一丁目」）
・「地積」「床面積」「専有面積」は数字のみ（㎡・平方メートルは付けない。複数階の建物は合計床面積）
・「構造」は登記の表記（例「木造」「鉄筋コンクリート造」「鉄骨造」）
・「建築年」は新築年月日を西暦4桁の数字のみ（和暦は西暦に換算。例 令和3年→2021）
・「建築年月」は表示用に「2021年4月」の形式
・区分建物（マンション）は「建物の名称」「専有面積」「所在階」「総階数」を埋める。戸建・土地で該当なしは空文字
・読み取れない項目は空文字にする
"""


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
            f"AI解析が{timeout}秒を超えたため中断しました。しばらく待って再試行してください。"
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


def _extract_json_obj(result: dict) -> dict:
    """Claude の result dict から登記情報の JSON オブジェクトを取り出す。"""
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


def parse_with_claude(pdf_bytes: bytes, filename: str = "registry.pdf") -> RegistryInfo:
    """登記簿PDFを Claude CLI に直接読ませて RegistryInfo を返す（スキャン画像対応）。"""
    with tempfile.TemporaryDirectory(prefix="registry_pdf_") as tmp_dir:
        tmp_path = Path(tmp_dir) / "registry.pdf"
        tmp_path.write_bytes(pdf_bytes)
        prompt = _CLAUDE_PROMPT.format(filename=tmp_path.name)
        cmd = [
            CLAUDE_BIN, "-p", prompt,
            "--output-format", "json",
            "--tools", "Read",
            "--add-dir", tmp_dir,
            "--dangerously-skip-permissions",
            "--model", "sonnet",
        ]
        result = _run_claude(cmd, timeout=CLAUDE_TIMEOUT_SEC, cwd=tmp_dir)

    raw = _extract_json_obj(result)
    info = RegistryInfo()
    info.location = str(raw.get("所在", "")).strip()
    info.chiban = str(raw.get("地番", "")).strip()
    info.chimoku = str(raw.get("地目", "")).strip()
    info.land_area = _to_float(raw.get("地積"))
    info.kaoku_no = str(raw.get("家屋番号", "")).strip()
    info.floor_area = _to_float(raw.get("床面積"))
    info.structure = str(raw.get("構造", "")).strip()
    info.build_year = _to_int(raw.get("建築年"))
    info.build_ym = str(raw.get("建築年月", "")).strip()
    info.mansion_name = str(raw.get("建物の名称", "")).strip()
    info.exclusive_area = _to_float(raw.get("専有面積"))
    info.floor_no = _to_int(raw.get("所在階"))
    info.total_floors = _to_int(raw.get("総階数"))
    return info


def parse_auto(
    pdf_bytes: bytes, filename: str = "registry.pdf", mode: str = "auto"
) -> tuple[RegistryInfo, str]:
    """登記簿PDFを解析し (RegistryInfo, 使用した方式) を返す。

    mode:
      "auto" … まず pdfplumber でテキスト抽出を試し、スキャン画像等で
               失敗したら Claude CLI による AI 解析に自動フォールバック。
      "ai"   … 常に Claude CLI で解析（スキャン画像・複雑レイアウト向け）。
      "text" … pdfplumber のテキスト抽出のみ（高速・claude不要）。
    返り値の方式は "text" または "ai"。
    """
    if mode == "ai":
        return parse_with_claude(pdf_bytes, filename), "ai"
    if mode == "text":
        return parse(pdf_bytes), "text"
    # auto
    try:
        return parse(pdf_bytes), "text"
    except RegistryParseError:
        return parse_with_claude(pdf_bytes, filename), "ai"
