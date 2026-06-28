"""退去時確認書兼原状回復費用負担誓約書（Excel）出力サービス。

退去立会い時に損耗が発見された場合、入居者に署名させる誓約書を生成する。
元フォーマット「退去確認書兼誓約書.xls」のレイアウトを参考に再構築し、
入居期間（入居日〜退去日・○年○ヶ月）と入居者負担の修繕箇所を自動転記する。
宛先は管理会社（発行元）、末尾の住所・氏名欄は入居者が署名する。
"""

from __future__ import annotations

import io

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.properties import PageSetupProperties

from models.restoration_data import RestorationData


THIN = Side(style="thin", color="000000")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
HEADER_FILL = PatternFill("solid", fgColor="D9D9D9")
CENTER = Alignment(horizontal="center", vertical="center")
LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)
LEFT_TOP = Alignment(horizontal="left", vertical="top", wrap_text=True)

# A4縦・6列レイアウト（修繕箇所=A:B / 仕様=C:D / 詳細等=E:F）
WIDTHS = {"A": 13, "B": 13, "C": 12, "D": 12, "E": 14, "F": 14}

PLEDGE_LINES = [
    "　私は上記物件の契約解除に際し、貴社立会いの下、私が原状回復にあたって負担する"
    "上記修繕箇所の内容について確認いたしました。",
    "　なお、修繕後に請求される工事代金の負担額については、責任をもって速やかにお支払い"
    "する事を誓約いたします。",
    "　請求期日までに支払いが実行されなかった場合は、保証会社への移管又は連帯保証人に"
    "請求されても異議申し立ていたしません。",
]


def _merge_set(ws, cell_range, value=None, font=None, align=None, fill=None, border=False):
    ws.merge_cells(cell_range)
    top_left = cell_range.split(":")[0]
    cell = ws[top_left]
    if value is not None:
        cell.value = value
    if font:
        cell.font = font
    if align:
        cell.alignment = align
    if fill:
        cell.fill = fill
    if border:
        from openpyxl.utils import range_boundaries
        c1, r1, c2, r2 = range_boundaries(cell_range)
        for r in range(r1, r2 + 1):
            for c in range(c1, c2 + 1):
                ws.cell(row=r, column=c).border = BORDER
    return cell


def build(data: RestorationData, issuer: dict, options: dict | None = None) -> bytes:
    """誓約書 xlsx をバイト列で返す。

    options: {keys_count, smoking, leftover, witness_date}
    """
    options = options or {}
    wb = Workbook()
    ws = wb.active
    ws.title = "誓約書"

    for col, w in WIDTHS.items():
        ws.column_dimensions[col].width = w

    base = Font(size=11)
    bold = Font(size=11, bold=True)

    # 宛先・日付
    _merge_set(ws, "A1:D1", f"{issuer.get('name', '') or '（管理会社名）'}　御中", font=bold, align=LEFT)
    _merge_set(ws, "E1:F1", options.get("witness_date", ""), font=base,
               align=Alignment(horizontal="right", vertical="center"))

    # タイトル
    _merge_set(ws, "A3:F3", "【 退去時確認書兼原状回復費用負担誓約書 】",
               font=Font(size=14, bold=True), align=CENTER)

    # 物件の表示
    _merge_set(ws, "A5:A6", "＜物件の表示＞", font=bold, align=Alignment(horizontal="left", vertical="center", wrap_text=True))
    _merge_set(ws, "B5:F5", data.property_address, font=base, align=LEFT)
    room = f"{data.property_name}　{data.room_number}".strip()
    _merge_set(ws, "B6:F6", room, font=base, align=LEFT)

    # 入居期間（いつ〜いつ・○年○ヶ月）
    def _d(d):
        return d.strftime("%Y年%m月%d日") if d else "―"
    y, m = data.residence_period
    period = f"{_d(data.move_in_date)}　〜　{_d(data.move_out_date)}　（入居期間：{y}年{m}ヶ月）"
    _merge_set(ws, "A7:A7", "◎入居期間", font=bold, align=LEFT)
    _merge_set(ws, "B7:F7", period, font=base, align=LEFT)

    # 確認項目
    _merge_set(ws, "A8:A8", "◎鍵の返却", font=bold, align=LEFT)
    _merge_set(ws, "B8:F8", f"{options.get('keys_count', '')}　本", font=base, align=LEFT)
    _merge_set(ws, "A9:A9", "◎喫煙の有無", font=bold, align=LEFT)
    _merge_set(ws, "B9:F9", options.get("smoking", "有　　・　　無"), font=base, align=LEFT)
    _merge_set(ws, "A10:A10", "◎残置物の有無", font=bold, align=LEFT)
    _merge_set(ws, "B10:F10", options.get("leftover", "有　　・　　無"), font=base, align=LEFT)

    # 修繕箇所テーブル ヘッダー
    header_row = 12
    _merge_set(ws, f"A{header_row}:B{header_row}", "修繕箇所", font=bold, align=CENTER, fill=HEADER_FILL, border=True)
    _merge_set(ws, f"C{header_row}:D{header_row}", "仕　様", font=bold, align=CENTER, fill=HEADER_FILL, border=True)
    _merge_set(ws, f"E{header_row}:F{header_row}", "詳　細　等", font=bold, align=CENTER, fill=HEADER_FILL, border=True)

    # 入居者負担のある項目を転記（無ければ空欄行）
    billable = [it for it in data.items if it.tenant_amount > 0]
    rows_needed = max(len(billable), 8)
    r = header_row + 1
    for i in range(rows_needed):
        if i < len(billable):
            it = billable[i]
            spec = it.material_type
            if it.total_qty:
                spec += f"（{it.total_qty:g}{it.unit}）"
            detail = f"入居者負担 ¥{it.tenant_amount:,}"
            _merge_set(ws, f"A{r}:B{r}", it.name, font=base, align=LEFT, border=True)
            _merge_set(ws, f"C{r}:D{r}", spec, font=base, align=LEFT, border=True)
            _merge_set(ws, f"E{r}:F{r}", detail, font=base, align=LEFT, border=True)
        else:
            _merge_set(ws, f"A{r}:B{r}", None, border=True)
            _merge_set(ws, f"C{r}:D{r}", None, border=True)
            _merge_set(ws, f"E{r}:F{r}", None, border=True)
        ws.row_dimensions[r].height = 22
        r += 1

    # 入居者負担合計
    if billable:
        _merge_set(ws, f"A{r}:D{r}", "入居者負担合計（税込・概算）", font=bold, align=Alignment(horizontal="right", vertical="center"), border=True)
        _merge_set(ws, f"E{r}:F{r}", f"¥{data.total_tenant:,}", font=bold, align=Alignment(horizontal="right", vertical="center"), border=True)
        r += 1

    # 誓約文
    r += 1
    for line in PLEDGE_LINES:
        _merge_set(ws, f"A{r}:F{r}", line, font=base, align=LEFT_TOP)
        ws.row_dimensions[r].height = 34
        r += 1

    # 日付（署名日）
    r += 1
    _merge_set(ws, f"A{r}:F{r}", "令和　　　　年　　　　　月　　　　　日",
               font=base, align=Alignment(horizontal="right", vertical="center"))
    r += 2

    # 署名欄（入居者）
    _merge_set(ws, f"A{r}:A{r}", "住　所", font=bold, align=LEFT)
    _merge_set(ws, f"B{r}:F{r}", None, align=LEFT, border=True)
    r += 2
    _merge_set(ws, f"A{r}:A{r}", "氏　名", font=bold, align=LEFT)
    _merge_set(ws, f"B{r}:E{r}", None, align=LEFT, border=True)
    _merge_set(ws, f"F{r}:F{r}", "印", font=base, align=CENTER)

    # A4縦・1ページ幅フィット
    ws.page_setup.paperSize = 9
    ws.page_setup.orientation = "portrait"
    if ws.sheet_properties.pageSetUpPr is None:
        ws.sheet_properties.pageSetUpPr = PageSetupProperties()
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    for side in ("left", "right"):
        setattr(ws.page_margins, side, 0.59)
    for side in ("top", "bottom"):
        setattr(ws.page_margins, side, 0.59)

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()
