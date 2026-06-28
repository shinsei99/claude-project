"""賃貸退去時「原状回復費用」自動精算＆見積システム。

業者見積Excelをアップロード → スマート解析で明細抽出 →
ガイドライン準拠の償却・按分計算 → 退去精算書(Excel)を出力。
"""

from __future__ import annotations

import pandas as pd
import streamlit as st

from models.restoration_data import (
    RestorationData,
    LineItem,
    FAULT_TENANT,
    FAULT_NATURAL,
)
from services import (
    excel_parser, document_export_service, issuer_store, pledge_export_service,
    property_store, tenant_store,
)
from services.pdf_parser import parse_pdf, PdfExtractionError
from services.depreciation_engine import calculate, MATERIAL_TYPES, policy_of, DEPRECIABLE
from services.excel_export_service import build as build_excel


MATERIAL_OPTIONS = MATERIAL_TYPES
FAULT_OPTIONS = [FAULT_TENANT, FAULT_NATURAL]

st.set_page_config(page_title="原状回復費用 自動精算", page_icon="🏠", layout="wide")

st.title("🏠 退去時 原状回復費用 自動精算システム")
st.caption(
    "業者見積Excelをアップロードするだけで、国交省ガイドラインに基づく"
    "入居者・オーナーの負担按分を自動計算し、精算書(Excel)を生成します。"
)


# ---- セッション初期化 ----
if "items" not in st.session_state:
    st.session_state["items"] = []  # list[LineItem]


# ---- サイドバー：発行元（自社）情報（プロフィール保存・切替） ----
NEW_ISSUER_LABEL = "＋ 新規入力"

if "issuer_form_version" not in st.session_state:
    st.session_state.issuer_form_version = 0
if "issuer_prefill" not in st.session_state:
    st.session_state.issuer_prefill = dict(issuer_store.EMPTY_ISSUER)

with st.sidebar:
    st.header("🏢 発行元（自社）情報")
    st.caption("見積書・請求書に印字されます。会社名で保存・切り替えできます。")

    issuers_df = issuer_store.load_issuers()
    options = [NEW_ISSUER_LABEL] + issuers_df["name"].tolist()
    selected = st.selectbox("保存済みの発行元から呼び出し", options, key="issuer_select")

    # 選択が変わったらフォームのプリフィルを更新（key を変えて再描画）
    if selected != NEW_ISSUER_LABEL:
        row = issuers_df[issuers_df["name"] == selected].iloc[0]
        candidate = {f: str(row.get(f, "")) for f in issuer_store.ISSUER_FIELDS}
    else:
        candidate = dict(issuer_store.EMPTY_ISSUER)
    if candidate != st.session_state.issuer_prefill:
        st.session_state.issuer_prefill = candidate
        st.session_state.issuer_form_version += 1

    v = st.session_state.issuer_form_version
    p = st.session_state.issuer_prefill
    issuer = {
        "name": st.text_input("会社名", value=p["name"], key=f"iss_name_{v}"),
        "address": st.text_area("住所", value=p["address"], height=60, key=f"iss_addr_{v}"),
        "tel": st.text_input("TEL", value=p["tel"], key=f"iss_tel_{v}"),
        "fax": st.text_input("FAX", value=p["fax"], key=f"iss_fax_{v}"),
        "registration_no": st.text_input("インボイス登録番号", value=p["registration_no"], key=f"iss_reg_{v}"),
        "bank": st.text_area("振込先（請求書用）", value=p["bank"], height=60, key=f"iss_bank_{v}"),
        "issue_date": "",
    }

    col_s, col_d = st.columns(2)
    with col_s:
        if st.button("💾 保存", use_container_width=True):
            if issuer["name"].strip():
                issuer_store.save_issuer(issuer)
                st.success(f"「{issuer['name']}」を保存しました。")
                st.rerun()
            else:
                st.warning("会社名を入力してください。")
    with col_d:
        if st.button("🗑 削除", use_container_width=True, disabled=selected == NEW_ISSUER_LABEL):
            issuer_store.delete_issuer(selected)
            st.session_state.issuer_prefill = dict(issuer_store.EMPTY_ISSUER)
            st.success(f"「{selected}」を削除しました。")
            st.rerun()


# ============ 1. 基本情報 ============
st.header("1. 基本情報の入力")

# ---- 登録物件の呼び出し（物件名→住所を自動入力）----
NEW_PROP_LABEL = "＋ 新規入力"
if "prop_form_version" not in st.session_state:
    st.session_state.prop_form_version = 0
if "prop_prefill" not in st.session_state:
    st.session_state.prop_prefill = {"name": "", "address": ""}

props_df = property_store.load_properties()
selected_prop = st.selectbox(
    "登録物件から呼び出し（選ぶと物件名・住所が自動入力）",
    [NEW_PROP_LABEL] + props_df["name"].tolist(), key="prop_select",
)
if selected_prop != NEW_PROP_LABEL:
    prow = props_df[props_df["name"] == selected_prop].iloc[0]
    prop_cand = {"name": selected_prop, "address": str(prow.get("address", ""))}
else:
    prop_cand = {"name": "", "address": ""}
if prop_cand != st.session_state.prop_prefill:
    st.session_state.prop_prefill = prop_cand
    st.session_state.prop_form_version += 1
pv = st.session_state.prop_form_version
pp = st.session_state.prop_prefill

# ---- 登録入居者の呼び出し（物件とは独立。氏名→連絡先を自動入力）----
NEW_TENANT_LABEL = "＋ 新規入力"
if "tenant_form_version" not in st.session_state:
    st.session_state.tenant_form_version = 0
if "tenant_prefill" not in st.session_state:
    st.session_state.tenant_prefill = {"name": "", "contact": ""}

tenants_df = tenant_store.load_tenants()
selected_tenant = st.selectbox(
    "登録入居者から呼び出し（選ぶと氏名・連絡先が自動入力）",
    [NEW_TENANT_LABEL] + tenants_df["name"].tolist(), key="tenant_select",
)
if selected_tenant != NEW_TENANT_LABEL:
    trow = tenants_df[tenants_df["name"] == selected_tenant].iloc[0]
    tenant_cand = {"name": selected_tenant, "contact": str(trow.get("contact", ""))}
else:
    tenant_cand = {"name": "", "contact": ""}
if tenant_cand != st.session_state.tenant_prefill:
    st.session_state.tenant_prefill = tenant_cand
    st.session_state.tenant_form_version += 1
tv = st.session_state.tenant_form_version
tp = st.session_state.tenant_prefill

col1, col2, col3 = st.columns(3)
with col1:
    tenant_name = st.text_input("賃借人氏名", value=tp["name"], key=f"tenantname_{tv}")
    property_name = st.text_input("物件名", value=pp["name"], key=f"propname_{pv}")
with col2:
    room_number = st.text_input("部屋番号", value="")
    deposit = st.number_input("預かり敷金（円）", min_value=0, value=0, step=1000)
with col3:
    move_in = st.date_input("入居日（契約開始日）", value=None, format="YYYY/MM/DD")
    move_out = st.date_input("退去日（明渡し日）", value=None, format="YYYY/MM/DD")
addr_col, tcontact_col = st.columns(2)
with addr_col:
    property_address = st.text_input(
        "物件住所（任意・誓約書の物件名に併記）", value=pp["address"], key=f"propaddr_{pv}",
    )
with tcontact_col:
    tenant_contact = st.text_input("入居者連絡先（任意・登録用）", value=tp["contact"], key=f"tenantcontact_{tv}")

# 物件の登録・削除
ps_col, pd_col, ts_col, td_col = st.columns(4)
with ts_col:
    if st.button("💾 入居者を登録", use_container_width=True):
        if tenant_name.strip():
            tenant_store.save_tenant({"name": tenant_name, "contact": tenant_contact})
            st.success(f"入居者「{tenant_name}」を登録しました。")
            st.rerun()
        else:
            st.warning("賃借人氏名を入力してください。")
with td_col:
    if st.button("🗑 入居者を削除", use_container_width=True, disabled=selected_tenant == NEW_TENANT_LABEL):
        tenant_store.delete_tenant(selected_tenant)
        st.session_state.tenant_prefill = {"name": "", "contact": ""}
        st.success(f"入居者「{selected_tenant}」を削除しました。")
        st.rerun()
with ps_col:
    if st.button("💾 物件を登録", use_container_width=True):
        if property_name.strip():
            property_store.save_property({"name": property_name, "address": property_address})
            st.success(f"物件「{property_name}」を登録しました。")
            st.rerun()
        else:
            st.warning("物件名を入力してください。")
with pd_col:
    if st.button("🗑 物件を削除", use_container_width=True, disabled=selected_prop == NEW_PROP_LABEL):
        property_store.delete_property(selected_prop)
        st.session_state.prop_prefill = {"name": "", "address": ""}
        st.success(f"物件「{selected_prop}」を削除しました。")
        st.rerun()

if move_in and move_out:
    tmp = RestorationData(move_in_date=move_in, move_out_date=move_out)
    st.info(f"📅 入居期間: **{tmp.residence_label}**（{tmp.residence_days}日 / {tmp.residence_years}年）")


# ---- 誓約書（基本情報のみで出力可。立会い時に入居者へ署名させる）----
with st.expander("📝 退去時確認書兼誓約書を出力（基本情報のみでOK・立会い時の署名用）", expanded=False):
    st.caption(
        "退去立会いで損耗・残置物等が確認された場合に、入居者へ署名してもらう誓約書です。"
        "修繕箇所は手書き用に空欄で出力し、計算済みの場合は入居者負担項目を自動転記します。"
    )
    pc1, pc2, pc3 = st.columns(3)
    with pc1:
        pledge_keys = st.text_input("鍵の返却本数", value="", key="pledge_keys")
        pledge_key_cost = st.number_input("カギ交換代（返却不足時・円）", min_value=0, value=0, step=1000, key="pledge_keycost")
    with pc2:
        pledge_smoke = st.radio("喫煙の有無", ["有　　・　　無", "有", "無"], horizontal=True, key="pledge_smoke")
        pledge_pet = st.radio("ペット飼育の有無", ["有　　・　　無", "有", "無"], horizontal=True, key="pledge_pet")
        pledge_left = st.radio("残置物の有無", ["有　　・　　無", "有", "無"], horizontal=True, key="pledge_left")
    with pc3:
        pledge_date = st.date_input("立会日", value=move_out, format="YYYY/MM/DD", key="pledge_date")
        pledge_staff = st.text_input("立会担当者", value="", key="pledge_staff")

    pledge_data = RestorationData(
        tenant_name=tenant_name, property_name=property_name, room_number=room_number,
        property_address=property_address, move_in_date=move_in, move_out_date=move_out,
        deposit=int(deposit),
        items=st.session_state["result"].items if "result" in st.session_state else [],
    )
    pledge_opts = {
        "keys_count": pledge_keys,
        "key_replacement_cost": int(pledge_key_cost),
        "smoking": pledge_smoke,
        "pet": pledge_pet,
        "leftover": pledge_left,
        "staff": pledge_staff,
        "witness_date": (
            f"令和{pledge_date.year - 2018}年{pledge_date.month}月{pledge_date.day}日"
            if pledge_date else ""
        ),
    }
    try:
        pledge_bytes = pledge_export_service.build(pledge_data, issuer, pledge_opts)
        pbase = f"{property_name or '物件'}_{room_number or ''}"
        st.download_button(
            "📝 誓約書(.xlsx)をダウンロード",
            data=pledge_bytes,
            file_name=f"退去時確認書兼誓約書_{pbase}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            type="primary",
        )
    except Exception as e:  # noqa: BLE001
        st.error(f"誓約書の生成に失敗しました: {e}")


# ============ 2. 業者見積Excelアップロード ============
st.header("2. 業者見積書（Excel / PDF）のアップロード")
uploaded = st.file_uploader(
    "リフォーム業者等の見積書をドラッグ＆ドロップ",
    type=["xlsx", "xls", "csv", "pdf"],
    help=(
        "Excel/CSVは列を自動判定して抽出。PDFはAI（Claude）が直接読み取り、"
        "フォーマットが不統一でも工事名・金額を抽出します。"
    ),
)

if uploaded is not None:
    is_pdf = uploaded.name.lower().endswith(".pdf")
    label = "🤖 PDFをAI解析して明細を展開" if is_pdf else "📥 Excelを解析して明細を展開"
    if st.button(label, type="primary"):
        try:
            if is_pdf:
                with st.spinner("AIがPDFを読み取っています…（混雑時は数分かかることがあります）"):
                    items = parse_pdf(uploaded.getvalue(), uploaded.name)
            else:
                items = excel_parser.parse(uploaded, uploaded.name)

            if not items:
                st.warning("明細を抽出できませんでした。工事名・金額が読み取れるか確認してください。")
            else:
                st.session_state["items"] = items
                st.success(f"✅ {len(items)} 件の明細を抽出しました。下の表で確認・微調整してください。")
        except PdfExtractionError as e:
            st.error(f"PDF解析に失敗しました: {e}")
        except Exception as e:  # noqa: BLE001
            st.error(f"解析中にエラーが発生しました: {e}")


# ============ 3. 明細の確認・微調整 ============
st.header("3. 抽出明細の確認・微調整")

items: list[LineItem] = st.session_state["items"]

st.info(
    "**ガイドライン原則**：故意・過失が証明されない限り、すべて経年劣化＝**オーナー負担(0%)** が既定です。"
    "入居者の故意・過失が認められる項目だけ「過失の有無」を**故意過失**に変更してください。\n\n"
    "・クロス／CF等は見積から読み取った「**全体数量**（単位はm/㎡など）」に対し、汚損箇所の「**過失数量**」を"
    "同じ単位で入力すると、その比率ぶんの原価にのみ残存価値率を適用します"
    "（数量が無い場合は「過失対象額(円)」で代替、空欄なら全額対象）。\n"
    "・「諸経費」は工事費の入居者:オーナー比率で自動按分されます。"
)

if not items:
    st.write("まだ明細がありません。業者見積をアップロードして解析するか、下から手動追加してください。")
else:
    edit_df = pd.DataFrame(
        [
            {
                "工事・部材名": it.name,
                "業者見積総額(円)": it.vendor_amount,
                "部材種別": it.material_type,
                "過失の有無": it.fault,
                "全体数量": it.total_qty,
                "単位": it.unit,
                "過失数量": it.fault_qty,
                "過失対象額(円)": it.fault_target_amount,
            }
            for it in items
        ]
    )
    edited = st.data_editor(
        edit_df,
        num_rows="dynamic",
        use_container_width=True,
        column_config={
            "業者見積総額(円)": st.column_config.NumberColumn(min_value=0, step=100),
            "部材種別": st.column_config.SelectboxColumn(options=MATERIAL_OPTIONS),
            "過失の有無": st.column_config.SelectboxColumn(options=FAULT_OPTIONS),
            "全体数量": st.column_config.NumberColumn(
                min_value=0.0, step=0.1, format="%g",
                help="業者見積から読み取った数量（クロス=m、CF=㎡ など）。",
            ),
            "単位": st.column_config.TextColumn(
                help="業者見積の単位表記（m / ㎡ / 本 / 式 など）。",
            ),
            "過失数量": st.column_config.NumberColumn(
                min_value=0.0, step=0.1, format="%g",
                help="入居者の故意・過失による汚損箇所の数量（単位は『全体数量』と同じ）。全体数量との比率で部分補修原価を自動算出。",
            ),
            "過失対象額(円)": st.column_config.NumberColumn(
                min_value=0, step=100,
                help="数量が不明な場合の代替。部分補修の原価を直接入力（過失数量があればそちらを優先）。",
            ),
        },
        key="item_editor",
    )

    def _num(val, cast):
        if val is None or (isinstance(val, float) and pd.isna(val)) or str(val).strip() == "":
            return None
        try:
            return cast(val)
        except (ValueError, TypeError):
            return None

    # 編集結果を LineItem に反映
    st.session_state["items"] = [
        LineItem(
            name=str(r["工事・部材名"]),
            vendor_amount=int(r["業者見積総額(円)"] or 0),
            material_type=str(r["部材種別"]),
            fault=str(r["過失の有無"]),
            total_qty=_num(r.get("全体数量"), float),
            unit=str(r.get("単位") or ""),
            fault_qty=_num(r.get("過失数量"), float),
            fault_target_amount=_num(r.get("過失対象額(円)"), int),
        )
        for _, r in edited.iterrows()
        if str(r["工事・部材名"]).strip()
    ]


# ============ 4. 計算・結果表示 ============
st.header("4. 精算計算")

can_calc = bool(st.session_state["items"]) and move_in and move_out
if not can_calc:
    st.write("基本情報（入居日・退去日）と明細が揃うと計算できます。")

if st.button("🧮 按分を計算する", disabled=not can_calc, type="primary"):
    data = RestorationData(
        tenant_name=tenant_name,
        property_name=property_name,
        room_number=room_number,
        property_address=property_address,
        move_in_date=move_in,
        move_out_date=move_out,
        deposit=int(deposit),
        items=st.session_state["items"],
    )
    calculate(data)
    st.session_state["result"] = data


if "result" in st.session_state:
    data: RestorationData = st.session_state["result"]

    # サマリー指標
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("業者見積総額", f"¥{data.total_vendor:,}")
    m2.metric("入居者負担合計", f"¥{data.total_tenant:,}")
    m3.metric("オーナー負担合計", f"¥{data.total_owner:,}")
    settlement = data.settlement
    if settlement >= 0:
        m4.metric("敷金返還額", f"¥{settlement:,}")
    else:
        m4.metric("追加請求額", f"¥{abs(settlement):,}", delta="不足", delta_color="inverse")

    # 円グラフ（入居者 / オーナー）
    if data.total_vendor > 0:
        chart_df = pd.DataFrame(
            {"区分": ["入居者負担", "オーナー負担"], "金額": [data.total_tenant, data.total_owner]}
        ).set_index("区分")
        st.bar_chart(chart_df)

    # 明細結果テーブル
    result_df = pd.DataFrame(
        [
            {
                "工事・部材名": it.name,
                "業者見積総額": it.vendor_amount,
                "入居者負担率": f"{it.tenant_rate_pct}%",
                "入居者負担額": it.tenant_amount,
                "オーナー負担額": it.owner_amount,
                "算出根拠": it.basis,
            }
            for it in data.items
        ]
    )
    st.dataframe(result_df, use_container_width=True)

    # ---- 帳票ダウンロード ----
    st.subheader("5. 帳票のダウンロード")
    MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    base = f"{data.property_name or '物件'}_{data.room_number or ''}"

    tab_seisan, tab_doc = st.tabs(
        ["📄 退去精算書（按分内訳）", "🧾 見積書・請求書（賃借人提示用）"]
    )

    with tab_seisan:
        st.caption("入居者・オーナーの負担按分を一覧化した内部精算書です。")
        try:
            xlsx_bytes = build_excel(data)
            st.download_button(
                "📄 退去精算書(.xlsx)をダウンロード",
                data=xlsx_bytes,
                file_name=f"退去精算書_{base}.xlsx",
                mime=MIME,
                type="primary",
            )
        except Exception as e:  # noqa: BLE001
            st.error(f"精算書の生成に失敗しました: {e}")

    with tab_doc:
        st.caption("入居者負担額を賃借人へ提示・請求するための見積書／請求書です（負担0円の項目は除外）。本書は誓約書に基づく旨が明記されます。")
        issue_date = st.date_input("発行日", value=data.move_out_date, format="YYYY/MM/DD", key="issue_date")
        docs = st.multiselect(
            "出力する帳票", options=[document_export_service.QUOTE, document_export_service.INVOICE],
            default=[document_export_service.QUOTE, document_export_service.INVOICE],
        )
        if not issuer.get("name"):
            st.info("左サイドバーに発行元（自社）情報を入力すると、より体裁の整った帳票になります。")
        try:
            issuer_filled = dict(issuer)
            issuer_filled["issue_date"] = issue_date.strftime("%Y年%m月%d日") if issue_date else ""
            doc_bytes = document_export_service.build(data, issuer_filled, docs or [document_export_service.QUOTE])
            suffix = "見積請求書" if len(docs) != 1 else docs[0]
            st.download_button(
                "🧾 見積書・請求書(.xlsx)をダウンロード",
                data=doc_bytes,
                file_name=f"{suffix}_{base}.xlsx",
                mime=MIME,
                type="primary",
                disabled=not docs,
            )
        except Exception as e:  # noqa: BLE001
            st.error(f"帳票の生成に失敗しました: {e}")
