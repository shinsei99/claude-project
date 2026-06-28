"""調査結果の PDF 出力（reportlab・日本語対応）。

reportlab 同梱の CID フォント HeiseiKakuGo-W5 を用い、追加フォント無しで日本語出力する。
"""

import os
from typing import Dict

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from models.property_data import PROPERTY_FIELDS

FONT_NAME = "HeiseiKakuGo-W5"


def _register_font() -> None:
    try:
        pdfmetrics.registerFont(UnicodeCIDFont(FONT_NAME))
    except Exception:
        pass


def export_pdf(data: Dict[str, str], comment: str, output_path: str) -> str:
    """PropertyData と コメントを PDF 化して output_path に保存する。"""
    _register_font()
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "JTitle", parent=styles["Title"], fontName=FONT_NAME, fontSize=16
    )
    body_style = ParagraphStyle(
        "JBody", parent=styles["BodyText"], fontName=FONT_NAME, fontSize=9, leading=14
    )

    story = [Paragraph("重要事項説明書 下調べ報告（ドラフト）", title_style), Spacer(1, 8 * mm)]

    rows = [["項目", "内容"]]
    for field in PROPERTY_FIELDS:
        value = (data.get(field) or "").strip() or "（要確認）"
        rows.append([field, value])

    table = Table(rows, colWidths=[40 * mm, 130 * mm])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D9E1F2")),
                ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#F2F2F2")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 8 * mm))

    story.append(Paragraph("■ AIコメント（下書き）", body_style))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph((comment or "").replace("\n", "<br/>"), body_style))
    story.append(Spacer(1, 6 * mm))
    story.append(
        Paragraph(
            "※ 本書は無料公開データ・登記簿解析に基づく調査支援用の下書きであり、"
            "最終的な重要事項説明は宅地建物取引士による確認・補正が必要です。",
            body_style,
        )
    )

    doc.build(story)
    return output_path
