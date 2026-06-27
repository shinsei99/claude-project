"""業者見積Excelのスマート解析エンジン。

フォーマットが不統一な業者見積（.xlsx/.xls/.csv）から、
pandas を用いて「工事名列」「金額列」を賢く特定し、明細行を抽出する。
有料APIは一切使わず、キーワードマッチとヒューリスティクスのみで判定する。
"""

from __future__ import annotations

import io
import re

import pandas as pd

from models.restoration_data import LineItem


# 列特定のためのキーワード
NAME_KEYWORDS = ["工事", "品名", "項目", "内容", "名称", "摘要", "仕様", "明細"]
AMOUNT_KEYWORDS = ["金額", "価格", "御見積", "見積", "小計", "合計", "計", "円"]
QTY_KEYWORDS = ["数量", "数", "面積", "平米", "㎡", "m2", "m²", "平方"]
UNIT_KEYWORDS = ["単位", "unit"]

# 合計・小計など、明細ではない行を示す語
TOTAL_ROW_KEYWORDS = ["合計", "小計", "総計", "御見積額", "税込", "消費税", "値引", "計"]

# 部材種別の自動判別（工事名に含まれる語 → 種別）
# ※判定は上から順。複合語（例「クロス捲り壁補修（下地処理）」）を正しく分類するため、
#   下地処理・巾木・設備系をクロス等の汎用語より先に判定する。
MATERIAL_RULES = [
    (["諸経費", "諸費用", "現場経費", "一般管理費"], "諸経費"),
    (["下地", "捲り", "めくり", "パテ", "ﾊﾟﾃ", "ケレン"], "下地処理"),
    (["巾木", "幅木", "はばき", "ソフト巾木"], "ソフト巾木"),
    (["ドアクローザー", "クローザー", "ドアチェック"], "ドアクローザー"),
    (["換気扇", "レンジフード", "ﾚﾝｼﾞﾌｰﾄﾞ", "ベンチレーター"], "換気扇"),
    (["ペンキ", "ベンキ", "塗装", "塗替", "塗り替え", "ペイント"], "ペンキ・塗装"),
    (["天井"], "天井クロス"),
    (["クロス", "壁紙", "クロス張替"], "壁クロス"),
    (["クッションフロア", "ＣＦ", "cf", "ＣＦ張", "ｸｯｼｮﾝ", "ｸｯｼｮﾝﾌﾛｱ"], "CF"),
    (["カーペット", "絨毯", "じゅうたん"], "カーペット"),
    (["クリーニング", "清掃", "ハウスクリーニング", "ｸﾘｰﾆﾝｸﾞ"], "ハウスクリーニング"),
    (["畳", "たたみ"], "畳"),
    (["襖", "ふすま", "障子", "建具"], "襖"),
    (["フローリング", "床", "フロア"], "フローリング"),
]


def detect_material(name: str) -> str:
    """工事名から部材種別を自動判別する。判別不能は「その他」。"""
    low = str(name).lower()
    for keywords, material in MATERIAL_RULES:
        for kw in keywords:
            if kw.lower() in low:
                return material
    return "その他"


def _read_any(file, filename: str) -> pd.DataFrame:
    """xlsx/xls/csv をヘッダー無しの DataFrame として読み込む。"""
    name = (filename or "").lower()
    if name.endswith(".csv"):
        try:
            return pd.read_csv(file, header=None, dtype=str)
        except UnicodeDecodeError:
            file.seek(0)
            return pd.read_csv(file, header=None, dtype=str, encoding="cp932")
    # Excel
    return pd.read_excel(file, header=None, dtype=str, engine=None)


def _to_amount(value) -> int | None:
    """セル値を整数金額に変換する。数値でなければ None。"""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    # 全角・通貨記号・カンマ・円などを除去
    s = s.translate(str.maketrans("０１２３４５６７８９", "0123456789"))
    s = re.sub(r"[^\d.\-]", "", s)
    if s in ("", "-", "."):
        return None
    try:
        return int(round(float(s)))
    except ValueError:
        return None


def _is_total_row(name: str) -> bool:
    n = str(name)
    return any(kw in n for kw in TOTAL_ROW_KEYWORDS)


def _to_float(value) -> float | None:
    """セル値を小数に変換する（面積㎡の取得用）。"""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    s = s.translate(str.maketrans("０１２３４５６７８９．", "0123456789."))
    s = re.sub(r"[^\d.\-]", "", s)
    if s in ("", "-", "."):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _find_qty_unit_cols(df) -> tuple:
    """ヘッダー行を探して (数量列, 単位列) を返す。"""
    cols = list(df.columns)
    for i in range(min(15, len(df))):
        row = df.iloc[i]
        qcol = ucol = None
        for c in cols:
            v = row[c]
            s = str(v).strip() if v is not None else ""
            if not s:
                continue
            if qcol is None and any(k in s for k in QTY_KEYWORDS):
                qcol = c
            if ucol is None and any(k in s for k in UNIT_KEYWORDS):
                ucol = c
        if qcol is not None:
            return qcol, ucol
    return None, None


def _score_column_as_name(series: pd.Series) -> int:
    """その列が『工事名列』らしいスコア。"""
    score = 0
    for v in series:
        if v is None:
            continue
        s = str(v)
        if any(kw in s for kw in NAME_KEYWORDS):
            score += 3
        # 文字（非数値）が多い列は名前列の可能性が高い
        if s.strip() and _to_amount(v) is None and len(s.strip()) >= 2:
            score += 1
    return score


def _score_column_as_amount(series: pd.Series) -> int:
    """その列が『金額列』らしいスコア。"""
    score = 0
    numeric_count = 0
    for v in series:
        if v is None:
            continue
        s = str(v)
        if any(kw in s for kw in AMOUNT_KEYWORDS):
            score += 3
        if _to_amount(v) is not None:
            numeric_count += 1
    # 数値セルが多いほど金額列らしい
    score += numeric_count
    return score


def parse(file, filename: str = "") -> list[LineItem]:
    """業者見積ファイルから LineItem のリストを抽出する。

    file: file-like（Streamlit の UploadedFile 等）またはバイト列。
    """
    if isinstance(file, (bytes, bytearray)):
        file = io.BytesIO(file)

    df = _read_any(file, filename)
    if df is None or df.empty:
        return []

    df = df.dropna(how="all").reset_index(drop=True)
    if df.empty:
        return []

    # 列ごとにスコアリングして名前列・金額列を特定
    name_scores = {c: _score_column_as_name(df[c]) for c in df.columns}
    amount_scores = {c: _score_column_as_amount(df[c]) for c in df.columns}

    name_col = max(name_scores, key=name_scores.get)

    # 数量・単位列をヘッダーから特定（数量と単位を明細に表示する）
    qty_col, unit_col = _find_qty_unit_cols(df)

    # 金額列は名前列・数量列と別の列から選ぶ
    amount_candidates = {
        c: s for c, s in amount_scores.items() if c not in (name_col, qty_col)
    }
    if not amount_candidates:
        return []
    amount_col = max(amount_candidates, key=amount_candidates.get)

    items: list[LineItem] = []
    for _, row in df.iterrows():
        name = row[name_col]
        amount = _to_amount(row[amount_col])

        if name is None or str(name).strip() == "":
            continue
        # 金額が空欄の行・合計行・ヘッダー行は除外
        if amount is None or amount <= 0:
            continue
        if _is_total_row(name):
            continue
        # ヘッダー語そのものの行（「品名」「金額」など）を除外
        if str(name).strip() in NAME_KEYWORDS + AMOUNT_KEYWORDS:
            continue

        # 数量・単位を取得（m / ㎡ / 本 / 式 など業者表記のまま保持）
        total_qty = _to_float(row[qty_col]) if qty_col is not None else None
        unit = ""
        if unit_col is not None and unit_col < len(row):
            uv = row[unit_col]
            unit = str(uv).strip() if uv is not None else ""

        items.append(
            LineItem(
                name=str(name).strip(),
                vendor_amount=amount,
                material_type=detect_material(name),
                total_qty=total_qty,
                unit=unit,
            )
        )

    return items
