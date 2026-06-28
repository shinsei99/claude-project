"""レントロール（賃貸借一覧）の解析。収益物件選択時のみ使用。

Excel（.xlsx/.xls）または PDF を受け取り、表内の「月額賃料」「共益費」
などの列を探索して各部屋の合計を合算する。月額総収入を 12 倍して
「年間想定総収入」を算出し、RentRoll に格納する。
列名や様式は会社ごとに異なるため、列名のキーワード一致で柔軟に拾う。
"""

from __future__ import annotations

import io
import re

import pandas as pd

from models.valuation_data import RentRoll


class RentRollParseError(RuntimeError):
    pass


# 賃料・共益費とみなす列名キーワード（部分一致・大文字小文字無視）
_RENT_KEYS = ("賃料", "家賃", "月額", "月額賃料")
_KYOEKI_KEYS = ("共益費", "管理費")
# 集計対象から除外したい列（保証金・敷金など一時金）
_EXCLUDE_KEYS = ("敷金", "保証金", "礼金", "合計", "計")


def _to_amount(val) -> int:
    """セル値を金額（円）に変換。数値でなければ0。"""
    if val is None:
        return 0
    if isinstance(val, (int, float)) and not pd.isna(val):
        return int(val)
    s = str(val)
    s = s.replace(",", "").replace("，", "").replace("円", "").strip()
    m = re.search(r"\d+(?:\.\d+)?", s)
    return int(float(m.group())) if m else 0


def _col_matches(col_name: str, keys: tuple[str, ...]) -> bool:
    name = str(col_name)
    if any(x in name for x in _EXCLUDE_KEYS):
        return False
    return any(k in name for k in keys)


def _sum_from_dataframe(df: pd.DataFrame) -> tuple[int, int]:
    """DataFrame から (月額総収入, 部屋数) を算出する。

    賃料・共益費に該当する列を合算。1行=1部屋とみなし、
    賃料が入っている行数を部屋数とする。
    """
    rent_cols = [c for c in df.columns if _col_matches(c, _RENT_KEYS)]
    kyoeki_cols = [c for c in df.columns if _col_matches(c, _KYOEKI_KEYS)]

    if not rent_cols:
        # 列名で見つからない場合：合計金額が最大の数値列を賃料列とみなす
        numeric = df.apply(lambda s: s.map(_to_amount))
        sums = numeric.sum(numeric_only=False)
        rent_cols = [sums.idxmax()] if len(sums) and sums.max() > 0 else []

    monthly_total = 0
    room_count = 0
    for _, row in df.iterrows():
        rent = sum(_to_amount(row[c]) for c in rent_cols)
        kyoeki = sum(_to_amount(row[c]) for c in kyoeki_cols)
        if rent > 0:
            room_count += 1
            monthly_total += rent + kyoeki
    return monthly_total, room_count


def _parse_excel(data: bytes) -> tuple[int, int]:
    # ヘッダー行の位置が不定なので、複数候補を試す
    for header in (0, 1, 2):
        try:
            df = pd.read_excel(io.BytesIO(data), header=header)
        except Exception:
            continue
        df = df.dropna(how="all").dropna(axis=1, how="all")
        if df.empty:
            continue
        monthly, rooms = _sum_from_dataframe(df)
        if monthly > 0:
            return monthly, rooms
    raise RentRollParseError(
        "レントロールから賃料を読み取れませんでした。"
        "「賃料」「共益費」などの列見出しがあるExcelか確認してください。"
    )


def _parse_pdf(data: bytes) -> tuple[int, int]:
    import pdfplumber

    monthly_total = 0
    room_count = 0
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                if not table or len(table) < 2:
                    continue
                df = pd.DataFrame(table[1:], columns=table[0])
                df = df.dropna(how="all")
                try:
                    m, r = _sum_from_dataframe(df)
                except Exception:
                    continue
                monthly_total += m
                room_count += r
    if monthly_total == 0:
        raise RentRollParseError(
            "PDFレントロールから賃料表を読み取れませんでした。"
            "Excel版のアップロード、または手入力をご利用ください。"
        )
    return monthly_total, room_count


def parse(filename: str, data: bytes) -> RentRoll:
    """ファイル名の拡張子で形式を判定して解析する。"""
    name = filename.lower()
    if name.endswith((".xlsx", ".xls")):
        monthly, rooms = _parse_excel(data)
    elif name.endswith(".pdf"):
        monthly, rooms = _parse_pdf(data)
    else:
        raise RentRollParseError("対応形式は Excel(.xlsx/.xls) または PDF です。")

    return RentRoll(
        monthly_total=monthly,
        annual_income=monthly * 12,
        room_count=rooms,
    )
