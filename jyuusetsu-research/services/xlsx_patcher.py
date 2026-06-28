"""xlsx を無損失でセル編集するパッチャ。

openpyxl は再保存時に図形(drawing)・画像・一部書式を欠落させるため、
公式書式の流し込みでは使わない。本モジュールは編集対象シートの XML だけを
書き換え、その他の zip エントリは元ファイルからバイト単位でコピーする。

値はインライン文字列(t="inlineStr")で書き込むため sharedStrings を触らない。
対象セルが存在しない場合は行・セルを順序を保って挿入する。
"""

import re
import zipfile
from typing import Dict

from openpyxl.utils import column_index_from_string, coordinate_to_tuple


def _escape(value: str) -> str:
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _resolve_sheet_path(zf: zipfile.ZipFile, sheet_name: str) -> str:
    """シート名 → xl/worksheets/sheetN.xml を解決する。"""
    wb = zf.read("xl/workbook.xml").decode("utf-8")
    rels = zf.read("xl/_rels/workbook.xml.rels").decode("utf-8")

    rid = None
    for m in re.finditer(r'<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"', wb):
        if m.group(1) == sheet_name:
            rid = m.group(2)
            break
    if rid is None:
        raise ValueError("シートが見つかりません: {}".format(sheet_name))

    for m in re.finditer(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels):
        if m.group(1) == rid:
            target = m.group(2).lstrip("/")
            return target if target.startswith("xl/") else "xl/" + target
    raise ValueError("シートのrelsが解決できません: {}".format(sheet_name))


def _cell_xml(ref: str, value: str, style_attr: str = "") -> str:
    return (
        '<c r="{ref}"{style} t="inlineStr"><is>'
        '<t xml:space="preserve">{val}</t></is></c>'
    ).format(ref=ref, style=style_attr, val=_escape(value))


def _set_one(sheet_xml: str, ref: str, value: str) -> str:
    """sheet XML 文字列に対しセル ref を value に設定する。"""
    row_num, col_num = coordinate_to_tuple(ref)

    # 1) 既存セルを置換（style 属性 s="..." は保持、t/中身は差し替え）
    existing = re.search(
        r'<c r="' + re.escape(ref) + r'"([^>]*?)(/>|>.*?</c>)', sheet_xml, re.DOTALL
    )
    if existing:
        attrs = existing.group(1)
        s_match = re.search(r'\s+s="\d+"', attrs)
        style_attr = s_match.group(0) if s_match else ""
        return sheet_xml[: existing.start()] + _cell_xml(ref, value, style_attr) + sheet_xml[existing.end():]

    new_cell = _cell_xml(ref, value)

    # 2) 行が存在する場合（自己終了 <row .../> と通常 <row>..</row> の両対応）
    row_pat = re.compile(r'<row r="' + str(row_num) + r'"([^>]*?)(/>|>(.*?)</row>)', re.DOTALL)
    rm = row_pat.search(sheet_xml)
    if rm:
        row_attrs = rm.group(1)
        inner = rm.group(3) if rm.group(2) != "/>" else ""
        insert_at = len(inner)
        for cm in re.finditer(r'<c r="([A-Z]+)\d+"', inner):
            if column_index_from_string(cm.group(1)) > col_num:
                insert_at = cm.start()
                break
        new_inner = inner[:insert_at] + new_cell + inner[insert_at:]
        new_row = '<row r="{}"{}>{}</row>'.format(row_num, row_attrs, new_inner)
        return sheet_xml[: rm.start()] + new_row + sheet_xml[rm.end():]

    # 3) 行も無ければ sheetData に行ごと順序挿入
    new_row = '<row r="{}">{}</row>'.format(row_num, new_cell)
    sd = re.search(r'(<sheetData[^>]*>)(.*?)(</sheetData>)', sheet_xml, re.DOTALL)
    if not sd:
        return sheet_xml  # 想定外の構造は触らない
    body = sd.group(2)
    insert_at = len(body)
    for rmatch in re.finditer(r'<row r="(\d+)"', body):
        if int(rmatch.group(1)) > row_num:
            insert_at = rmatch.start()
            break
    new_body = body[:insert_at] + new_row + body[insert_at:]
    return sheet_xml[: sd.start()] + sd.group(1) + new_body + sd.group(3) + sheet_xml[sd.end():]


def set_cells(src_path: str, dst_path: str, sheet_name: str, cells: Dict[str, str]) -> str:
    """src の指定シートに cells({ref: value}) を書き込み dst に保存（無損失）。"""
    with zipfile.ZipFile(src_path, "r") as zin:
        sheet_path = _resolve_sheet_path(zin, sheet_name)
        sheet_xml = zin.read(sheet_path).decode("utf-8")
        for ref, value in cells.items():
            sheet_xml = _set_one(sheet_xml, ref, value)
        names = zin.namelist()
        data = {n: zin.read(n) for n in names}

    data[sheet_path] = sheet_xml.encode("utf-8")
    with zipfile.ZipFile(dst_path, "w", zipfile.ZIP_DEFLATED) as zout:
        for n in names:
            zout.writestr(n, data[n])
    return dst_path
