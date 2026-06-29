# -*- coding: utf-8 -*-
"""登記事項証明書（謄本）PDF を解析し、媒介契約書の別表に必要な情報を構造化する。

抽出は 3 段構え:
  1. pdfplumber で PDF からテキストを取り出す
  2. テキストがあれば `claude` CLI（APIキー不要）に渡して構造化 JSON を得る
  3. テキストが無い（スキャン画像PDF）場合は、各ページを画像化し、
     claude CLI のビジョン（Read ツール）で画像を読み取って構造化する
いずれも失敗した場合は正規表現フォールバックで主要項目だけ拾う。

完全自動ではなく「下書き生成」を目的とし、解析失敗時も例外を投げず空欄で返す。
"""

import json
import os
import re
import subprocess
import tempfile
from io import BytesIO

import pdfplumber

CLAUDE_BIN = os.path.expanduser("~/.local/bin/claude")
CLAUDE_TIMEOUT = 300        # テキスト解析のタイムアウト（秒）
PDF_READ_TIMEOUT = 900      # スキャン画像を読ませる場合のタイムアウト（秒・最大15分）
ORIENT_TIMEOUT = 120        # 向き判定（haiku）のタイムアウト（秒）
ORIENT_MODEL = "haiku"      # 向き判定は軽量モデルで高速に
RENDER_DPI = 170            # スキャンページを画像化するときの解像度
THUMB_MAX = 760             # 向き判定用サムネイルの最大辺
MAX_PAGES = 10              # 画像化するページ数の上限
TEXT_MIN_CHARS = 40         # これ未満ならスキャンPDFとみなし画像読み取りに回す

# 別表に流し込む空のデータ構造
EMPTY = {
    "物件種別": "",          # 土地 / 建物 / 土地建物 / マンション
    "物件所在地": "",
    "所有者住所": "",
    "所有者氏名": "",
    "登記名義人住所": "",
    "登記名義人氏名": "",
    "土地": {"所在": "", "地番": "", "地目": "", "地積": "", "権利": ""},
    "建物": {"所在": "", "家屋番号": "", "種類": "", "構造": "",
             "床面積": "", "延床面積": "", "新築年月日": ""},
    "マンション": {"名称": "", "構造": "", "階建": "", "階部分": "",
                 "専有面積": "", "室番号": "", "新築年月日": "", "敷地権割合": ""},
    "抵当権": "",
}


def extract_text(pdf_file) -> str:
    """アップロードされた PDF（file-like or path）からテキストを抽出する。"""
    if pdf_file is None:
        return ""
    try:
        if hasattr(pdf_file, "read"):
            raw = pdf_file.read()
            if hasattr(pdf_file, "seek"):
                pdf_file.seek(0)
            src = BytesIO(raw)
        else:
            src = pdf_file
        parts = []
        with pdfplumber.open(src) as pdf:
            for page in pdf.pages:
                parts.append(page.extract_text() or "")
        return "\n".join(parts)
    except Exception:
        return ""


def _deep_merge(base: dict, new: dict) -> dict:
    """new の空でない値で base を上書き（ネスト辞書対応）。"""
    for k, v in new.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _deep_merge(base[k], v)
        elif v not in ("", None):
            base[k] = v
    return base


def _strip_fence(text: str) -> str:
    """```json ... ``` などのコードフェンスを取り除く。"""
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if m:
        return m.group(1).strip()
    # 最初の { から最後の } までを抜く
    s, e = text.find("{"), text.rfind("}")
    if s != -1 and e != -1 and e > s:
        return text[s:e + 1]
    return text


_SCHEMA = """【出力ルール】
- 出力は JSON オブジェクトのみ。前置き・解説・コードフェンスは付けない。
- 読み取れない / 記載の無い項目は空文字 "" にする。値を創作しない。
- 「物件種別」は内容に応じて "土地" / "建物" / "土地建物" / "マンション"（敷地権付き区分建物）から選ぶ。
- 所有者は権利部（甲区）の最新（最後）の所有権登記名義人。住所と氏名（または商号）を必ず分けて記載する。
  区分建物（マンション）でも甲区の「所有者」欄から氏名を確実に読み取ること（氏名の取りこぼし注意）。
- 地積・床面積・専有面積は数値＋"㎡"（例: "123.45㎡"）。複数階の建物は床面積に各階を併記してよい。
- 新築年月日は「令和○年○月○日」等そのまま。構造は「木造かわらぶき2階建」等そのまま。

【JSON スキーマ】
{
  "物件種別": "",
  "物件所在地": "（登記上の所在。土地なら所在＋地番、建物なら所在＋家屋番号の住所部分）",
  "所有者住所": "",
  "所有者氏名": "",
  "登記名義人住所": "（所有者と同じなら同じ値）",
  "登記名義人氏名": "",
  "土地": {"所在": "", "地番": "", "地目": "", "地積": "", "権利": "（所有権/借地権 等）"},
  "建物": {"所在": "", "家屋番号": "", "種類": "", "構造": "", "床面積": "", "延床面積": "", "新築年月日": ""},
  "マンション": {"名称": "（一棟の建物の名称/建物の名称）", "構造": "", "階建": "", "階部分": "", "専有面積": "", "室番号": "（家屋番号の枝番/部屋番号）", "新築年月日": "", "敷地権割合": ""},
  "抵当権": "（乙区の抵当権・根抵当権があれば '有: 〇〇銀行' 等、なければ ''）"
}"""


def _invoke_claude(prompt: str, note, extra_args=None, cwd=None,
                   timeout: int = CLAUDE_TIMEOUT, model: str = "sonnet"):
    """claude CLI を実行し、result テキスト（文字列）を返す。失敗時 None。"""
    if not os.path.exists(CLAUDE_BIN):
        note(f"claude CLI が見つかりません（{CLAUDE_BIN}）")
        return None
    cmd = [
        CLAUDE_BIN, "-p", prompt,
        "--output-format", "json",
        "--dangerously-skip-permissions",
        "--model", model,
    ] + (extra_args or [])
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=cwd)
    except FileNotFoundError:
        note(f"claude CLI を実行できません（{CLAUDE_BIN}）")
        return None
    except subprocess.TimeoutExpired:
        note(f"AI読み取りが{timeout}秒でタイムアウトしました")
        return None
    if proc.returncode != 0:
        note(f"claude CLI がエラー終了（code {proc.returncode}）: {(proc.stderr or '')[:200]}")
        return None
    try:
        outer = json.loads(proc.stdout)
    except json.JSONDecodeError:
        note("claude CLI の出力を解釈できませんでした")
        return None
    if outer.get("is_error"):
        note(f"AIがエラーを返しました: {str(outer.get('result'))[:200]}")
        return None
    return outer.get("result", "")


def _run_claude(prompt: str, diag: dict, note, extra_args=None, cwd=None,
                timeout: int = CLAUDE_TIMEOUT, model: str = "sonnet") -> dict:
    """claude CLI を呼び出して結果テキストを JSON として返す。失敗時 None。"""
    text = _invoke_claude(prompt, note, extra_args=extra_args, cwd=cwd,
                          timeout=timeout, model=model)
    if text is None:
        return None
    try:
        return json.loads(_strip_fence(text))
    except (json.JSONDecodeError, TypeError) as e:
        note(f"AI出力をJSONとして解釈できませんでした: {type(e).__name__}")
        return None


def _note_fn(diag):
    def note(msg):
        if diag is not None:
            diag.setdefault("reasons", []).append(msg)
    return note


def _parse_with_claude(text: str, diag: dict = None) -> dict:
    """謄本テキストを claude CLI に渡して構造化 JSON を得る。失敗時 None。"""
    note = _note_fn(diag)
    if not text.strip():
        note("PDFからテキストを抽出できませんでした（スキャン画像のみのPDFの可能性）")
        return None
    prompt = (
        "あなたは不動産登記の専門家です。次の「登記事項証明書（不動産謄本）」のテキストを読み取り、"
        "媒介契約書の別表に転記するための情報を JSON で抽出してください。\n\n"
        + _SCHEMA
        + f"\n\n【謄本テキスト】\n{text[:12000]}\n\nJSON のみを出力してください:"
    )
    return _run_claude(prompt, diag, note)


def _read_pdf_bytes(pdf_file):
    """アップロード（file-like or path）から PDF バイト列を取り出す。"""
    if hasattr(pdf_file, "read"):
        raw = pdf_file.read()
        if hasattr(pdf_file, "seek"):
            pdf_file.seek(0)
        return raw
    with open(pdf_file, "rb") as f:
        return f.read()


def _detect_angle(thumb_name: str, cwd: str, note) -> int:
    """サムネイル画像の文字が正立する時計回り回転角（0/90/180/270）を haiku で判定。"""
    prompt = (
        "この画像は日本語の文書（不動産の登記事項証明書）をスキャンしたものです。"
        "文字が正しく正立して読める向きにするために、画像を時計回りに何度回転させればよいですか。"
        f"0・90・180・270 のいずれかの数字のみを答えてください。画像ファイル: {thumb_name}"
    )
    text = _invoke_claude(
        prompt, note,
        extra_args=["--tools", "Read", "--add-dir", cwd],
        cwd=cwd, timeout=ORIENT_TIMEOUT, model=ORIENT_MODEL,
    )
    if not text:
        return 0
    for a in ("270", "180", "90", "0"):
        if a in text:
            return int(a)
    return 0


def _parse_scanned(pdf_file, diag: dict = None) -> dict:
    """スキャンPDFを「①向き補正 → ②AI読み取り」の順で構造化する。

    各ページを画像化し、haiku で正立する回転角を判定して正立画像に直してから、
    sonnet に Read で読ませて JSON 抽出する。横向き・逆さスキャンでも精度が出る。
    PyMuPDF/Pillow が無い場合は PDF を直接 Claude に読ませる方式にフォールバック。
    """
    note = _note_fn(diag)
    try:
        raw = _read_pdf_bytes(pdf_file)
    except Exception as e:
        note(f"PDFを読み込めませんでした: {type(e).__name__}")
        return None

    try:
        import fitz  # PyMuPDF
        from PIL import Image
    except ImportError:
        note("PyMuPDF/Pillow が無いため向き補正をスキップしPDFを直接読み取ります。")
        return _parse_pdf_direct(raw, diag, note)

    with tempfile.TemporaryDirectory(prefix="baikai_") as td:
        try:
            doc = fitz.open(stream=raw, filetype="pdf")
        except Exception as e:
            note(f"PDFを画像化できませんでした: {type(e).__name__}")
            return _parse_pdf_direct(raw, diag, note)

        page_files = []
        angles = []
        for i, page in enumerate(doc):
            if i >= MAX_PAGES:
                break
            pix = page.get_pixmap(dpi=RENDER_DPI)
            from io import BytesIO as _B
            im = Image.open(_B(pix.tobytes("png"))).convert("RGB")
            # ① 向き判定（サムネイルで高速に）
            th = im.copy()
            th.thumbnail((THUMB_MAX, THUMB_MAX))
            thumb_name = f"thumb_{i + 1}.png"
            th.save(os.path.join(td, thumb_name))
            ang = _detect_angle(thumb_name, td, note)
            angles.append(ang)
            # ② 正立画像を保存（時計回り ang 度 → PIL は反時計回りなので -ang）
            up = im.rotate(-ang, expand=True) if ang else im
            fn = f"page_{i + 1}.png"
            up.save(os.path.join(td, fn))
            page_files.append(fn)
        doc.close()

        if diag is not None:
            diag["angles"] = angles
        if not page_files:
            return _parse_pdf_direct(raw, diag, note)

        # ③ 正立画像を AI 読み取り
        files_block = "\n".join(f"- {f}" for f in page_files)
        prompt = (
            "あなたは不動産登記の専門家です。次の画像ファイルは「登記事項証明書（不動産謄本）」の"
            "スキャン画像です（向きは正立済み）。各画像を Read ツールで開いて内容を丁寧に読み取り、"
            "媒介契約書の別表に転記するための情報を JSON で抽出してください。\n\n"
            f"【画像ファイル（順番に全て開いて読むこと）】\n{files_block}\n\n"
            + _SCHEMA
            + "\n\n必ず全ての画像を Read ツールで開いてから、JSON のみを出力してください:"
        )
        return _run_claude(
            prompt, diag, note,
            extra_args=["--tools", "Read", "--add-dir", td],
            cwd=td, timeout=PDF_READ_TIMEOUT,
        )


def _parse_pdf_direct(raw: bytes, diag: dict, note) -> dict:
    """フォールバック: PDF をそのまま Claude の Read ツールに読ませて構造化する。"""
    with tempfile.TemporaryDirectory(prefix="baikai_") as td:
        fname = "toupon.pdf"
        with open(os.path.join(td, fname), "wb") as f:
            f.write(raw)
        prompt = (
            f"ファイル {fname} は「登記事項証明書（不動産謄本）」のPDFです（スキャン画像の場合があります）。"
            "Read ツールでこのPDFを開いて内容を丁寧に読み取り、"
            "媒介契約書の別表に転記するための情報を JSON で抽出してください。\n\n"
            + _SCHEMA
            + f"\n\n必ず {fname} を Read ツールで開いてから、JSON のみを出力してください:"
        )
        return _run_claude(
            prompt, diag, note,
            extra_args=["--tools", "Read", "--add-dir", td],
            cwd=td, timeout=PDF_READ_TIMEOUT,
        )


# ── 正規表現フォールバック ─────────────────────────────────────────────────────
def _parse_with_regex(text: str) -> dict:
    """CLI が使えない場合の最低限の抽出。土地・建物の主要項目のみ。"""
    data = json.loads(json.dumps(EMPTY))  # deep copy
    if not text:
        return data

    def grab(pattern):
        m = re.search(pattern, text)
        return m.group(1).strip() if m else ""

    # 所在（建物/土地の表題部）
    data["物件所在地"] = grab(r"所\s*在\s*([^\n地番家屋]+)")
    data["土地"]["地番"] = grab(r"地\s*番\s*([０-９0-9－\-一二三四五六七八九十番地の]+)")
    data["土地"]["地目"] = grab(r"地\s*目\s*([^\n0-9０-９]+)")
    data["土地"]["地積"] = grab(r"地\s*積[^\n]*?([0-9０-９,，\.．]+)\s*㎡")
    if data["土地"]["地積"]:
        data["土地"]["地積"] += "㎡"
    data["建物"]["家屋番号"] = grab(r"家\s*屋\s*番\s*号\s*([０-９0-9－\-一二三四五六七八九十番の]+)")
    data["建物"]["種類"] = grab(r"種\s*類\s*([^\n0-9０-９]+)")
    data["建物"]["構造"] = grab(r"構\s*造\s*([^\n]+)")
    data["建物"]["床面積"] = grab(r"床\s*面\s*積[^\n]*?([0-9０-９,，\.．]+)\s*㎡")
    if data["建物"]["床面積"]:
        data["建物"]["床面積"] += "㎡"
    # 所有者
    owner = grab(r"所\s*有\s*者\s*([^\n]+)")
    data["所有者氏名"] = owner
    data["登記名義人氏名"] = owner

    if data["建物"]["種類"] or data["建物"]["家屋番号"]:
        data["物件種別"] = "土地建物" if data["土地"]["地番"] else "建物"
    elif data["土地"]["地番"]:
        data["物件種別"] = "土地"
    return data


MAX_PDFS = 5


def _combine_shubetsu(types) -> str:
    """複数謄本から拾った物件種別を統合する。

    マンション（敷地権付き区分建物）が1枚でもあれば最優先。
    土地と建物が別々の謄本で入っていれば「土地建物」にまとめる。
    """
    types = {t for t in types if t}
    if any("マンション" in t for t in types):
        return "マンション"
    has_land = any("土地" in t for t in types)
    has_building = any(("建物" in t) and ("土地建物" not in t) for t in types) or any("土地建物" in t for t in types)
    if any("土地建物" in t for t in types):
        return "土地建物"
    if has_land and has_building:
        return "土地建物"
    if types:
        return sorted(types, key=len, reverse=True)[0]
    return ""


def parse_registry(pdf_files) -> dict:
    """謄本 PDF（最大 MAX_PDFS 枚）を解析して別表用の構造化辞書を返す。

    土地謄本・建物謄本・区分建物（マンション）謄本を混在させて渡してよい。
    各 PDF を個別に解析し、物件種別を自動判別したうえで 1 件にマージする。
    """
    if pdf_files is None:
        return json.loads(json.dumps(EMPTY))
    if not isinstance(pdf_files, (list, tuple)):
        pdf_files = [pdf_files]
    pdf_files = [pf for pf in pdf_files if pf is not None][:MAX_PDFS]

    merged = json.loads(json.dumps(EMPTY))
    used_ai = False
    detected_types = []
    diag = {"reasons": [], "files": []}
    for i, pf in enumerate(pdf_files):
        text = extract_text(pf)
        fname = getattr(pf, "name", f"PDF{i + 1}")
        nchars = len(text.strip())
        result = None

        if nchars >= TEXT_MIN_CHARS:
            # テキスト層あり → そのまま AI 解析
            diag["files"].append({"name": fname, "chars": nchars, "method": "text"})
            result = _parse_with_claude(text, diag)
            if result:
                used_ai = True
            else:
                result = _parse_with_regex(text)
        else:
            # テキストが無い/少ない（スキャンPDF）→ 向きを補正してから AI 読み取り
            diag["files"].append({"name": fname, "chars": nchars, "method": "scan-orient"})
            result = _parse_scanned(pf, diag)
            if result:
                used_ai = True
            else:
                # それも不可なら、わずかなテキストで正規表現フォールバック
                result = _parse_with_regex(text)

        if result is None:
            continue
        detected_types.append(result.get("物件種別", ""))
        # 物件種別は個別に統合するのでマージ対象から外す
        result_no_type = {k: v for k, v in result.items() if k != "物件種別"}
        _deep_merge(merged, result_no_type)

    merged["物件種別"] = _combine_shubetsu(detected_types)

    # 登記名義人が空なら所有者で補完
    if not merged["登記名義人氏名"] and merged["所有者氏名"]:
        merged["登記名義人氏名"] = merged["所有者氏名"]
        merged["登記名義人住所"] = merged["所有者住所"]

    merged["_ai"] = used_ai
    merged["_count"] = len(pdf_files)
    merged["_diag"] = diag
    return merged
