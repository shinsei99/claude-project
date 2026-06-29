"""路線価図（相続税路線価）のAI読み取り。謄本と同じ Claude CLI の仕組み。

国税庁の路線価図、または全国地価マップ（住居表示のピン＋路線価が同一画面に
写ったスクリーンショット）の画像・PDFを `claude` コマンドに直接読ませ、
対象地が接する道路の路線価（接道路線価）を抽出する。位置と路線価が一緒に
写った画像を読ませることで、正面路線の取り違えを防ぐ。

Anthropic APIキーは不要。Claude Pro/Max サブスクリプションのみで動作する。
"""

from __future__ import annotations

import re
import tempfile
from pathlib import Path

from services.registry_parser import (
    CLAUDE_BIN,
    CLAUDE_TIMEOUT_SEC,
    PdfExtractionError,
    _extract_json_obj,
    _run_claude,
)

_PROMPT = """\
日本の相続税路線価図、または全国地価マップ等のスクリーンショット画像です
（ファイル名: {filename}）。{hint}ピン／マーカー／囲みで示された対象地に
「接している道路すべて」の路線価を読み取り、JSONのみを返してください
（説明文不要）。スキャン画像でも読み取ってください。

路線価図の見方:
・道路上に「300D」「255C」のように記載される。数字は千円/㎡単位（300=300千円/㎡=300,000円/㎡）
・末尾のアルファベット(A〜G)は借地権割合（A=90%, B=80%, C=70%, D=60%, E=50%, F=40%, G=30%）
・路線価は接する道路ごとに異なる。前面道路（正面路線）がどれかで採用額が変わる
・「正面路線」は通常その土地が主に接する最も価格の高い道路。角地は複数道路に接する

出力形式（このJSONのみ）:
{{
  "接道候補": [
    {{"表記": "", "円per㎡": "", "方位や位置": ""}}
  ],
  "正面路線_円per㎡": "",
  "正面表記": ""
}}

注意事項:
・「接道候補」は対象地が接する各道路を1件ずつ。表記は図中そのまま（例 "300D"）、
  円per㎡は円/㎡に換算した数字のみ（300D→300000）、方位や位置は分かれば（例 "南側道路"）
・接道が1本だけならその1件のみ
・「正面路線」は最も価格の高い道路を既定で入れる（ユーザーが後で選び直せる）
・読み取れない項目は空文字にする
"""


def _to_int(s) -> int:
    if s is None:
        return 0
    m = re.search(r"\d+", str(s).replace(",", ""))
    return int(m.group()) if m else 0


def read(file_bytes: bytes, filename: str = "rosenka.png", address: str = "") -> dict:
    """路線価図/地価マップ画像から接道路線価を抽出する。

    返り値: {
      "unit_price": 正面路線価(円/㎡),
      "note": 正面の表記(例 "300D"),
      "candidates": [{"label": "300D（南側道路）", "unit": 300000, "note": "300D"}, ...],
    }
    前面道路で路線価が変わるため、接道候補を返してUIで選び直せるようにする。
    """
    try:
        from pdf_orient import ensure_upright_bytes
        file_bytes = ensure_upright_bytes(file_bytes, filename)
    except Exception:
        pass  # 向き補正に失敗しても元データで続行
    suffix = Path(filename).suffix.lower() or ".png"
    hint = f"対象地の住所は「{address}」です。" if address else ""
    with tempfile.TemporaryDirectory(prefix="rosenka_") as tmp_dir:
        tmp_path = Path(tmp_dir) / f"rosenka{suffix}"
        tmp_path.write_bytes(file_bytes)
        prompt = _PROMPT.format(filename=tmp_path.name, hint=hint)
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

    candidates = []
    for c in raw.get("接道候補", []) or []:
        note = str(c.get("表記", "")).strip()
        unit = _to_int(c.get("円per㎡"))
        pos = str(c.get("方位や位置", "")).strip()
        if unit == 0 and not note:
            continue
        label = note or f"{unit:,}円/㎡"
        if pos:
            label = f"{label}（{pos}）"
        candidates.append({"label": label, "unit": unit, "note": note})

    front_unit = _to_int(raw.get("正面路線_円per㎡"))
    front_note = str(raw.get("正面表記", "")).strip()
    # 正面が空なら候補の最高額を既定にする
    if front_unit == 0 and candidates:
        best = max(candidates, key=lambda c: c["unit"])
        front_unit, front_note = best["unit"], best["note"]

    if front_unit == 0 and not candidates:
        raise PdfExtractionError(
            "画像から路線価を読み取れませんでした。路線価の数字（例「300D」）が"
            "はっきり写った画像をアップロードするか、手入力してください。"
        )
    return {"unit_price": front_unit, "note": front_note, "candidates": candidates}
