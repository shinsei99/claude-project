# -*- coding: utf-8 -*-
"""取引事例・売出物件のPDFを claude CLI で読み、物件レコードの配列を抽出する。

レインズ・ポータルの印刷PDFや手元資料を想定。1つのPDFに複数物件が
含まれる場合は全件を配列で返す。スキャン画像PDFにも対応（Readツール）。
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

from services.satei_core import empty_case, TYPE_MANSION

CLAUDE_BIN = "claude"
CLAUDE_TIMEOUT_SEC = 900


class ExtractError(RuntimeError):
    pass


_PROMPT = """添付の不動産PDF「{filename}」を読み、掲載されている{kind}（{ptype}）を**すべて**抽出してください。

出力は次のキーを持つオブジェクトのJSON配列のみ。説明文やコードフェンス外の文字は出力しないでください。
各物件について分かる範囲で記入し、不明な項目は空文字 "" または 0 にしてください。創作はしないこと。

[
  {{
    "所在地": "物件所在地（市区町村・丁目まで）",
    "価格万円": 数値（{price_label}。万円単位。例 5800),
    "うち土地価格万円": 数値（分かれば。なければ0),
    "土地面積": 数値（㎡）,
    "建物面積": 数値（㎡。マンションは専有面積でも可),
    "専有面積": 数値（マンションの壁芯専有面積㎡。戸建ては0),
    "バルコニー面積": 数値（㎡。なければ0),
    "間取り": "例 3LDK",
    "建物構造": "木造/鉄骨造/RC造/木・RC混構造 等",
    "築年月": "例 平成10年3月 または 2008年3月",
    "階数": "階／階建（マンション）または 2F 等",
    "向き": "南/南東 等（マンション）",
    "マンション名号室": "マンション名・号室（マンションのみ）",
    "最寄駅": "路線名・駅名",
    "アクセス": "徒歩○分 / バス○分",
    "取引年月": "事例の取引年月（売出物件は空でよい）",
    "権利": "所有権/地上権/賃借権/定期借地権（分かれば）"
  }}
]

物件が1件も読み取れない場合は空配列 [] を返してください。"""


def _run_claude(cmd: list[str], cwd: str) -> dict:
    try:
        proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=CLAUDE_TIMEOUT_SEC)
    except FileNotFoundError as e:
        raise ExtractError("`claude` コマンドが見つかりません。Claude Code CLI を確認してください。") from e
    except subprocess.TimeoutExpired as e:
        raise ExtractError(f"AI解析が{CLAUDE_TIMEOUT_SEC}秒を超えました。再試行してください。") from e
    if proc.returncode != 0:
        raise ExtractError(f"Claude呼び出し失敗（終了コード {proc.returncode}）\n{proc.stderr.strip()[:400]}")
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise ExtractError("Claudeの応答をJSONとして解釈できませんでした。") from e


def _extract_array(result: dict) -> list:
    if result.get("is_error"):
        raise ExtractError(f"Claudeがエラーを返しました: {result.get('result')}")
    raw = result.get("result", "")
    m = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", raw, re.DOTALL)
    s = m.group(1) if m else raw.strip()
    if not s.startswith("["):
        m2 = re.search(r"(\[.*\])", s, re.DOTALL)
        if m2:
            s = m2.group(1)
    try:
        arr = json.loads(s)
    except json.JSONDecodeError as e:
        raise ExtractError(f"配列として解釈できませんでした。応答先頭: {raw[:200]}") from e
    return arr if isinstance(arr, list) else []


def _to_float(v) -> float:
    try:
        return float(re.sub(r"[^0-9.\-]", "", str(v)) or 0)
    except Exception:
        return 0.0


def _map(rec: dict) -> dict:
    c = empty_case()
    c["address"] = str(rec.get("所在地", "")).strip()
    c["price_man"] = _to_float(rec.get("価格万円"))
    c["land_price_man"] = _to_float(rec.get("うち土地価格万円"))
    c["land_area"] = _to_float(rec.get("土地面積"))
    c["building_area"] = _to_float(rec.get("建物面積"))
    c["exclusive_area"] = _to_float(rec.get("専有面積"))
    c["balcony_area"] = _to_float(rec.get("バルコニー面積"))
    c["madori"] = str(rec.get("間取り", "")).strip()
    c["structure"] = str(rec.get("建物構造", "")).strip()
    c["build_ym"] = str(rec.get("築年月", "")).strip()
    c["floor_no"] = str(rec.get("階数", "")).strip()
    c["floors"] = str(rec.get("階数", "")).strip()
    c["direction"] = str(rec.get("向き", "")).strip()
    c["mansion_name"] = str(rec.get("マンション名号室", "")).strip()
    c["station"] = str(rec.get("最寄駅", "")).strip()
    c["access"] = str(rec.get("アクセス", "")).strip()
    c["trade_ym"] = str(rec.get("取引年月", "")).strip()
    c["rights"] = str(rec.get("権利", "") or "所有権").strip()
    # 単価（円/㎡）の自動計算：価格(万円)÷面積
    area = c["exclusive_area"] or c["land_area"] or c["building_area"]
    if c["price_man"] and area:
        c["unit_price"] = round(c["price_man"] * 10000 / area)
    return c


def extract_cases(pdf_bytes: bytes, filename: str, kind: str, property_type: str) -> list[dict]:
    """1つのPDFから {kind} の物件配列を抽出して返す。

    kind: "取引事例" または "売出物件"
    """
    price_label = "取引価格" if kind == "取引事例" else "売出価格"
    ptype = "中古マンション" if property_type == TYPE_MANSION else "土地・戸建て"
    try:
        from pdf_orient import ensure_upright_pdf
        pdf_bytes = ensure_upright_pdf(pdf_bytes)
    except Exception:
        pass  # 向き補正に失敗しても元データで続行
    with tempfile.TemporaryDirectory(prefix="case_pdf_") as tmp:
        path = Path(tmp) / "case.pdf"
        path.write_bytes(pdf_bytes)
        prompt = _PROMPT.format(
            filename=path.name, kind=kind, ptype=ptype, price_label=price_label
        )
        cmd = [
            CLAUDE_BIN, "-p", prompt,
            "--output-format", "json",
            "--tools", "Read",
            "--add-dir", tmp,
            "--dangerously-skip-permissions",
            "--model", "sonnet",
        ]
        result = _run_claude(cmd, cwd=tmp)
    arr = _extract_array(result)
    return [_map(r) for r in arr if isinstance(r, dict)]
