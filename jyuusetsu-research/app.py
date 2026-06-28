"""AI重説調査〜Excel自動入力システム（Streamlit）。

入力（住所・登記簿PDF）→ 調査（無料データ）→ 整理（PropertyData）→ 出力（Excel/PDF）
の一方向パイプライン。完全自動ではなく「調査支援・下書き生成」を目的とする。
"""

import os

import streamlit as st

from models.property_data import create_property_data, merge
from services import (
    address_service,
    comment_service,
    excel_export_service,
    format_export_service,
    facility_service,
    hazard_service,
    pdf_export_service,
    population_service,
    registry_service,
    zoning_service,
)
from utils import formatter

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PATH = os.path.join(BASE_DIR, "templates", "jyuusetsu_template.xlsx")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")

st.set_page_config(page_title="AI重説調査システム", page_icon="🏠", layout="wide")


def run_pipeline(address, land_pdf, building_pdf):
    """入力 → 調査 → 整理 を実行し PropertyData と付随情報を返す。"""
    data = create_property_data()
    facilities = {}
    hazard_url = hazard_service.hazard_link(None, None)

    # ① 住所からの自動調査
    if address:
        with st.spinner("住所を調査中（国土地理院・最寄駅）..."):
            addr_result = address_service.investigate(address)
            merge(data, addr_result["data"])
            coords = addr_result["coords"]

        if coords:
            lat, lon = coords
            hazard_url = hazard_service.hazard_link(lat, lon)
            with st.spinner("都市計画・災害・周辺施設を調査中..."):
                merge(data, zoning_service.get_zoning(lat, lon))
                merge(data, hazard_service.get_hazard(lat, lon))
                facilities = facility_service.nearby_facilities(lat, lon)
            merge(data, population_service.get_population(address))
        else:
            st.warning("住所から位置を特定できませんでした。住所表記をご確認ください。")

    # ② 登記簿 PDF 解析
    if land_pdf is not None or building_pdf is not None:
        with st.spinner("登記簿PDFを解析中..."):
            merge(data, registry_service.parse_registry(land_pdf, building_pdf))

    return data, facilities, hazard_url


def render_section(title, fields):
    st.subheader(title)
    cols = st.columns(2)
    items = list(fields.items())
    for i, (key, value) in enumerate(items):
        with cols[i % 2]:
            st.markdown("**{}**：{}".format(key, formatter.safe(value)))


def main():
    st.title("🏠 AI重説調査 〜 Excel自動入力システム")
    st.caption(
        "住所と登記簿PDFから重要事項説明書のドラフトを生成する調査支援ツール。"
        "無料公開データのみ使用。最終確認は宅地建物取引士が行ってください。"
    )

    with st.sidebar:
        st.header("① 取引種別を選ぶ")
        categories = format_export_service.list_categories()
        category = st.selectbox("取引種別（カテゴリー）", options=categories)
        formats = format_export_service.formats_in_category(category)
        fmt_key = st.selectbox(
            "書式",
            options=list(formats.keys()),
            format_func=lambda k: formats[k],
        )

        st.divider()
        st.header("② 物件情報を入力")
        address = st.text_input("住所（必須）", placeholder="例：東京都千代田区丸の内1-1-1")
        land_pdf = st.file_uploader("登記事項証明書（土地PDF）", type=["pdf"])
        building_pdf = st.file_uploader("登記事項証明書（建物PDF）", type=["pdf"])
        st.file_uploader("物件概要書PDF（任意・将来対応）", type=["pdf"], disabled=True)
        run = st.button("調査を実行", type="primary", use_container_width=True)

        st.divider()
        st.caption("任意の環境変数（設定すると取得項目が増えます）")
        st.code("REINFOLIB_API_KEY  # 用途地域\nESTAT_APP_ID       # 人口・世帯", language="text")

    if not run:
        st.info("左の入力欄に住所を入れ、必要に応じてPDFを添付して「調査を実行」を押してください。")
        return

    if not address and land_pdf is None and building_pdf is None:
        st.error("住所、または登記簿PDFのいずれかを入力してください。")
        return

    data, facilities, hazard_url = run_pipeline(address, land_pdf, building_pdf)
    comment = comment_service.generate_comment(data)

    # ===== 結果画面 =====
    render_section("📌 基本情報", formatter.section_basic(data))
    st.divider()

    render_section("🏛 都市計画 / 法令制限", formatter.section_city_planning(data))
    if not data.get("用途地域"):
        st.caption("※ 用途地域はREINFOLIB_API_KEY未設定のため未取得。自治体都市計画図でご確認ください。")
    st.divider()

    render_section("🌊 災害情報", formatter.section_hazard(data))
    st.markdown("[🔗 重ねるハザードマップで該当地点を確認]({})".format(hazard_url))
    st.divider()

    render_section("🚉 周辺環境", formatter.section_environment(data))
    if facilities:
        fcols = st.columns(4)
        for i, (cat, names) in enumerate(facilities.items()):
            with fcols[i % 4]:
                st.markdown("**{}**".format(cat))
                if names:
                    for n in names:
                        st.markdown("- {}".format(n))
                else:
                    st.markdown("- （周辺に該当なし/未取得）")
    st.divider()

    render_section("📄 登記情報", formatter.section_registry(data))
    st.divider()

    st.subheader("📝 AIコメント（下書き）")
    st.write(comment)
    st.divider()

    # ===== 実書式への流し込み =====
    st.subheader("📥 実書式テンプレートへ流し込み")
    st.markdown("選択中の書式：**{}**（{}）".format(formats[fmt_key], category))
    st.caption(
        "書式は左サイドバー①で変更できます。登記記録に基づき「所在地・地番・地目・地積・家屋番号・種類・"
        "構造・床面積（書式により所有者）」を該当欄へ下書きします。"
        "法令制限・災害・ライフライン等のチェック欄は判定値を持たないため既定のまま残します。"
    )
    try:
        filled = format_export_service.export_to_format(
            data, fmt_key, os.path.join(REPORTS_DIR, "{}_filled.xlsx".format(fmt_key))
        )
        with open(filled, "rb") as f:
            st.download_button(
                "実書式（{}）をダウンロード".format(formats[fmt_key]),
                f.read(),
                file_name="{}_filled.xlsx".format(fmt_key),
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
            )
    except Exception as e:
        st.error("実書式への流し込みに失敗しました: {}".format(e))
    st.divider()

    # ===== ダウンロード（汎用ドラフト） =====
    st.subheader("⬇️ 汎用ドラフトのダウンロード")
    col1, col2 = st.columns(2)
    try:
        excel_path = excel_export_service.export_excel(
            data, comment, TEMPLATE_PATH, os.path.join(REPORTS_DIR, "jyuusetsu_draft.xlsx")
        )
        with open(excel_path, "rb") as f:
            col1.download_button(
                "Excel（汎用ドラフト）をダウンロード",
                f.read(),
                file_name="jyuusetsu_draft.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
            )
    except Exception as e:
        col1.error("Excel生成に失敗しました: {}".format(e))

    try:
        pdf_path = pdf_export_service.export_pdf(
            data, comment, os.path.join(REPORTS_DIR, "jyuusetsu_draft.pdf")
        )
        with open(pdf_path, "rb") as f:
            col2.download_button(
                "PDF（調査報告）をダウンロード",
                f.read(),
                file_name="jyuusetsu_draft.pdf",
                mime="application/pdf",
                use_container_width=True,
            )
    except Exception as e:
        col2.error("PDF生成に失敗しました: {}".format(e))


if __name__ == "__main__":
    main()
