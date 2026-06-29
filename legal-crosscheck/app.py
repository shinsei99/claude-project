"""売買契約・重説・謄本「法令制限・建築基準法特化型」4点連動クロスチェックシステム

  🌐行政正解(国交省API) / 📄謄本ファクト / 📝重説 / 🛒契約書 の4者を突合し、
  入力齟齬・宅建業法違反・建築基準法の矛盾を赤字で可視化、報告書Excelを出力する。

  起動: .venv/bin/streamlit run app.py --server.port 8510
"""

import pandas as pd
import streamlit as st

from models.legal_check_data import (
    STATUS_NG,
    STATUS_OK,
    LegalCrossCheckData,
)
from services import (
    admin_research_service,
    document_parser,
    excel_export_service,
    geo_service,
    law_validator,
    registry_parser,
    web_law_service,
)

st.set_page_config(page_title="4点クロスチェック", page_icon="⚖️", layout="wide")

# ---- セッション初期化 ----
if "lc" not in st.session_state:
    st.session_state.lc = LegalCrossCheckData()


def D() -> LegalCrossCheckData:
    return st.session_state.lc


st.title("⚖️ 売買契約・重説・謄本 4点連動クロスチェック")
st.caption("法令制限・建築基準法特化型 ── 行政の正解と公式ファクトを基準に書類の齟齬を検閲します")

# ============================================================
# STEP 1: 物件所在 → 行政正解の自動調査
# ============================================================
st.subheader("① 物件所在地 → 行政データ自動調査")
c1, c2 = st.columns([3, 1])
with c1:
    addr = st.text_input("物件所在地（住所）", value=D().address,
                         placeholder="例: 東京都新宿区西新宿2-8-1")
with c2:
    seller_pro = st.checkbox("売主が宅建業者", value=D().seller_is_pro,
                             help="チェック時、業法40条(契約不適合2年)・38条(違約金2割)を適用")

if st.button("🌐 行政調査（用途地域・建ぺい率・容積率）", type="primary"):
    D().address = addr
    D().seller_is_pro = seller_pro
    with st.spinner("国土地理院で住所を解決し、国交省データを照会中…"):
        geo = geo_service.resolve(addr)
        D().lat, D().lng = geo["lat"], geo["lng"]
        D().muni_code, D().pref_code = geo["muni_code"], geo["pref_code"]
        D().admin = admin_research_service.research(
            addr, geo["lat"], geo["lng"],
            api_key=admin_research_service.get_api_key() or None,
        )
    st.rerun()

adm = D().admin
if adm.resolved:
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("用途地域", adm.use_district or "—")
    m2.metric("指定建ぺい率", f"{adm.building_coverage:g}%" if adm.building_coverage else "—")
    m3.metric("指定容積率", f"{adm.floor_area_ratio:g}%" if adm.floor_area_ratio else "—")
    m4.metric("区域区分", adm.area_classification or "—")
    n1, n2, n3, n4 = st.columns(4)
    n1.metric("防火地域", adm.fire_zone or "—")
    n2.metric("高度地区", adm.height_district or "—")
    n3.metric("日影規制", adm.hikage_kisei or "—")
    n4.metric("自治体", adm.city or "—")
    o1, o2, o3 = st.columns([2, 1, 1])
    o1.metric("その他制限", adm.other_restrictions or "—")
    o2.metric("小学校区", adm.elementary_school or "—")
    o3.metric("中学校区", adm.junior_high_school or "—")
    st.caption(f"データ取得元：{adm.source}" + (f"／{adm.web_source}" if adm.web_source else ""))
    if adm.decision_info.strip():
        st.caption(f"都市計画決定：{adm.decision_info}")
    if "モック" in adm.source:
        st.warning("⚠️ 行政データはモック値です。実運用ではAPIキーを設定してください。")

    if st.button("🌐 AIで法令制限を詳しく調査（建ぺい/容積/防火/高度/日影 等をWeb補完）"):
        with st.spinner("自治体の都市計画情報（マップナビおおさか等）をWeb調査中…"):
            try:
                web = web_law_service.research_web(D().address, adm.use_district, adm.city)
                web_law_service.merge_into_admin(D().admin, web)
            except Exception as e:
                st.error(str(e))
        st.rerun()

st.divider()

# ============================================================
# STEP 2: 3点アップロード（謄本／重説／契約書）
# ============================================================
st.subheader("② 書類アップロード（3点）")
u1, u2, u3 = st.columns(3)
with u1:
    f_reg = st.file_uploader("📄 登記簿謄本 PDF", type=["pdf"], key="f_reg")
with u2:
    f_exp = st.file_uploader("📝 重要事項説明書 PDF", type=["pdf"], key="f_exp")
with u3:
    f_con = st.file_uploader("🛒 売買契約書 PDF", type=["pdf"], key="f_con")

if st.button("🔍 4点クロスチェックを実行", type="primary",
             disabled=not (f_reg and f_exp and f_con)):
    try:
        with st.spinner("謄本・重説・契約書を解析し、4者照合中…"):
            if f_reg:
                D().registry = registry_parser.parse(f_reg.getvalue())
            if f_exp:
                D().explanation = document_parser.parse_explanation(f_exp.getvalue())
            if f_con:
                D().contract = document_parser.parse_contract(f_con.getvalue())
            D().seller_is_pro = seller_pro
            law_validator.validate(D())
        st.success("✅ 検閲完了")
    except Exception as e:
        st.error(f"解析に失敗しました: {e}")

if not (f_reg and f_exp and f_con):
    st.caption("※ 謄本・重説・契約書の3点すべてをアップロードすると実行できます。")

st.divider()

# ============================================================
# STEP 3: 検閲結果（赤字アラート）
# ============================================================
data = D()
if data.has_run:
    st.subheader("③ 検閲結果")

    s1, s2, s3 = st.columns(3)
    s1.metric("🔴 齟齬・リスク", f"{data.ng_count} 件")
    s2.metric("🟢 一致", f"{data.ok_count} 件")
    s3.metric("検査項目", f"{len(data.results)} 件")

    if data.ng_count:
        st.error(f"🚨 {data.ng_count} 件の齟齬・リスクを検出しました。下記の赤字項目を修正してください。")
    else:
        st.success("重大な齟齬は検出されませんでした。")

    # NG項目を最優先で赤字表示
    ng_items = [r for r in data.results if r.status == STATUS_NG]
    if ng_items:
        st.markdown("#### 🔴 要修正項目")
        for r in ng_items:
            with st.container(border=True):
                st.markdown(f"**[{r.category}] {r.item}**")
                a, b, c = st.columns(3)
                a.markdown(f"🌐📄 **基準**\n\n{r.admin_value or '—'}")
                b.markdown(f"📝 **重説**\n\n{r.explanation_value or '—'}")
                c.markdown(f"🛒 **契約書**\n\n{r.contract_value or '—'}")
                st.markdown(f":red[**修正指示:** {r.advice}]")

    # 全結果テーブル
    st.markdown("#### 📋 全チェック項目")
    df = pd.DataFrame([
        {
            "カテゴリ": r.category,
            "チェック項目": r.item,
            "🌐📄基準": r.admin_value,
            "📝重説": r.explanation_value,
            "🛒契約書": r.contract_value,
            "判定": f"{r.icon} {r.status}",
            "修正指示": r.advice,
        }
        for r in data.results
    ])

    def _row_style(row):
        if "🔴" in row["判定"]:
            return ["background-color: #FCE4E4; color: #C00000"] * len(row)
        if "🟢" in row["判定"]:
            return ["background-color: #E8F5E9"] * len(row)
        return [""] * len(row)

    st.dataframe(df.style.apply(_row_style, axis=1),
                 use_container_width=True, hide_index=True)

    # 報告書Excel出力
    st.markdown("#### 📥 報告書出力")
    try:
        xlsx = excel_export_service.build(data)
        fname = "リーガルチェック報告書.xlsx"
        st.download_button(
            "📄 リーガルチェック報告書（Excel）をダウンロード",
            data=xlsx, file_name=fname,
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            type="primary",
        )
    except FileNotFoundError:
        st.warning("テンプレート未生成です。`python templates/generate_template.py` を実行してください。")
else:
    st.info("①で行政調査、②で3点アップロード → 「4点クロスチェックを実行」を押してください。")
