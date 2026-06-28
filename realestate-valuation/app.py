"""AI不動産価格査定＆相場リサーチシステム。

登記簿（謄本）PDF・レントロールをアップロード → 自動解析 →
国土地理院・国交省の無料データで住所変換＆周辺相場を調査 →
3種別（マンション／戸建／収益）に応じた査定報告書(Excel)を自動生成する。

処理は ValuationPipelineData を「入力 → 解析 → 住所変換・調査 →
価格算定 → Excel出力」と一方向に流す。
"""

from __future__ import annotations

import streamlit as st

from models.valuation_data import (
    ValuationPipelineData,
    Comparable,
    PROPERTY_TYPES,
    TYPE_MANSION,
    TYPE_KODATE,
    TYPE_SHUEKI,
)
from services import (
    registry_parser,
    rentroll_parser,
    geo_service,
    market_research_service,
    valuation_engine,
    excel_export_service,
    rosenka_reader,
)

st.set_page_config(page_title="AI不動産価格査定", page_icon="🏢", layout="wide")

st.title("🏢 AI不動産価格査定＆相場リサーチシステム")
st.caption(
    "登記簿PDF（＋収益物件はレントロール）をアップロードすると、国土地理院・国交省の"
    "無料データで周辺相場を調べ、査定報告書(Excel)を自動生成します。"
)


# ---- セッション初期化 ----
if "pd" not in st.session_state:
    st.session_state.pd = ValuationPipelineData()


def D() -> ValuationPipelineData:
    return st.session_state.pd


# ============================================================
# サイドバー：APIキー設定
# ============================================================
with st.sidebar:
    st.header("⚙️ 設定")
    configured = market_research_service.get_api_key()
    if configured:
        st.success("不動産情報ライブラリAPI：設定済み")
    else:
        st.warning("APIキー未設定（相場の自動取得には必要）")
    st.caption(
        "国交省「不動産情報ライブラリ」の無料APIキーで、取引事例・公示地価を"
        "自動取得します。未設定でも各値は手入力で査定できます。"
    )
    api_key_input = st.text_input(
        "APIキー（このセッションのみ）",
        type="password",
        help="https://www.reinfolib.mlit.go.jp/ で無料登録 → APIキーを発行",
    )
    st.session_state.api_key = api_key_input or configured

    with st.expander("APIキーの常設方法"):
        st.code(
            '# .streamlit/secrets.toml\nreinfolib_api_key = "あなたのキー"',
            language="toml",
        )
    st.divider()
    st.markdown(
        "**国土地理院ジオコーディング**（住所→緯度経度）はキー不要で常に利用できます。"
    )


# ============================================================
# STEP 1：物件種別とファイルアップロード → 解析
# ============================================================
st.header("STEP 1　物件種別とファイル")

ptype = st.radio("物件種別", PROPERTY_TYPES, horizontal=True, key="ptype_radio")
D().property_type = ptype

col_a, col_b = st.columns(2)
with col_a:
    registry_files = st.file_uploader(
        "登記簿（謄本）PDF　※土地・建物（複数可）",
        type=["pdf"],
        accept_multiple_files=True,
    )
    read_mode_label = st.radio(
        "PDF読み取り方式",
        ["自動（推奨）", "AI解析（スキャン画像対応）", "テキストのみ"],
        horizontal=True,
        help=(
            "自動：通常PDFはテキスト抽出、スキャン画像PDFは自動でAI解析に切替。\n"
            "AI解析：見積書自動作成と同じ仕組みで claude コマンドにPDFを直接読ませOCR（時間がかかります）。\n"
            "テキストのみ：高速だがスキャン画像は読めません。"
        ),
    )
    READ_MODE = {
        "自動（推奨）": "auto",
        "AI解析（スキャン画像対応）": "ai",
        "テキストのみ": "text",
    }[read_mode_label]
with col_b:
    rentroll_file = None
    if ptype == TYPE_SHUEKI:
        rentroll_file = st.file_uploader(
            "レントロール（Excel または PDF）※収益物件は必須",
            type=["xlsx", "xls", "pdf"],
        )
    else:
        st.info("レントロールは収益物件選択時のみアップロードします。")

if st.button("① 解析する", type="primary", disabled=not registry_files):
    data = ValuationPipelineData(property_type=ptype)
    errors = []
    methods = []
    # 登記簿（複数PDFをマージ：後勝ちで空欄を埋める）
    with st.spinner("登記簿を解析中...（AI解析の場合は数分かかることがあります）"):
        for f in registry_files:
            try:
                info, method = registry_parser.parse_auto(
                    f.getvalue(), f.name, mode=READ_MODE
                )
                methods.append(f"{f.name}: {'AI-OCR解析' if method == 'ai' else 'テキスト抽出'}")
                for field_name, val in info.__dict__.items():
                    if val and not getattr(data.registry, field_name):
                        setattr(data.registry, field_name, val)
            except (registry_parser.RegistryParseError, registry_parser.PdfExtractionError) as e:
                errors.append(f"{f.name}: {e}")
    # 住所の初期値は所在（町名・丁目）まで。地番は住居表示と異なるため付けず、
    # 番地・号はユーザーが手入力する（住居表示は登記簿に記載がないため）。
    if data.registry.location:
        data.address = data.registry.location
    # レントロール
    if ptype == TYPE_SHUEKI and rentroll_file is not None:
        try:
            data.rentroll = rentroll_parser.parse(
                rentroll_file.name, rentroll_file.getvalue()
            )
        except rentroll_parser.RentRollParseError as e:
            errors.append(f"レントロール: {e}")

    st.session_state.pd = data
    for e in errors:
        st.warning(e)
    if methods:
        st.caption("　／　".join(methods))
    st.success("解析しました。STEP 2 で内容を確認・補正してください。")


# ============================================================
# STEP 2：抽出内容の確認・補正
# ============================================================
st.header("STEP 2　物件情報の確認・補正")
reg = D().registry

c1, c2, c3 = st.columns(3)
with c1:
    if ptype == TYPE_MANSION:
        reg.mansion_name = st.text_input("マンション名", reg.mansion_name)
    reg.location = st.text_input("所在（登記）", reg.location)
    reg.chiban = st.text_input("地番", reg.chiban)
    reg.structure = st.text_input("構造", reg.structure)
with c2:
    reg.land_area = st.number_input("土地地積(㎡)", value=float(reg.land_area), step=1.0)
    reg.floor_area = st.number_input("延床面積(㎡)", value=float(reg.floor_area), step=1.0)
    if ptype == TYPE_MANSION:
        reg.exclusive_area = st.number_input(
            "専有面積(㎡)", value=float(reg.exclusive_area), step=1.0
        )
    reg.build_year = int(
        st.number_input("建築年(西暦)", value=int(reg.build_year), step=1)
    )
    reg.build_ym = st.text_input("築年月(表示用)", reg.build_ym or (f"{reg.build_year}年" if reg.build_year else ""))
with c3:
    if ptype == TYPE_MANSION:
        reg.floor_no = int(st.number_input("所在階", value=int(reg.floor_no), step=1))
        reg.total_floors = int(
            st.number_input("総階数", value=int(reg.total_floors), step=1)
        )
        reg.total_units = int(
            st.number_input("総戸数(不明は0)", value=int(reg.total_units), step=1)
        )
        reg.nearest_station = st.text_input("最寄駅", reg.nearest_station)
        reg.station_minutes = int(
            st.number_input("駅徒歩(分)", value=int(reg.station_minutes), step=1)
        )

D().address = st.text_input(
    "住所（住居表示を手入力）",
    D().address,
    help=(
        "謄本からは町名・丁目までを自動入力します。番地・号はご自身で入力してください"
        "（例: 大阪市城東区中央1-10-22）。登記簿の地番と住居表示は異なるため手入力が必要です。"
    ),
)

if ptype == TYPE_SHUEKI:
    st.subheader("レントロール（収益）")
    rc1, rc2 = st.columns(2)
    with rc1:
        D().rentroll.monthly_total = int(
            st.number_input(
                "月額総収入(円)", value=int(D().rentroll.monthly_total), step=1000
            )
        )
    with rc2:
        D().rentroll.room_count = int(
            st.number_input("部屋数", value=int(D().rentroll.room_count), step=1)
        )
    D().rentroll.annual_income = D().rentroll.monthly_total * 12
    st.metric("年間想定総収入", f"{D().rentroll.annual_income_man:,} 万円")


# ============================================================
# STEP 3：住所変換・相場調査
# ============================================================
st.header("STEP 3　住所変換・周辺相場調査")

if st.button("② 住所変換＆相場を調べる", disabled=not D().address):
    with st.spinner("国土地理院・国交省データを照会中..."):
        try:
            geo = geo_service.resolve(D().address)
            D().lat, D().lng = geo["lat"], geo["lng"]
            D().muni_code, D().pref_code = geo["muni_code"], geo["pref_code"]
            D().chika_map_url = geo["chika_map_url"]
        except geo_service.GeoError as e:
            st.error(str(e))
        D().market = market_research_service.research(
            D().pref_code,
            D().muni_code,
            D().lat,
            D().lng,
            D().property_type,
            api_key=st.session_state.get("api_key") or None,
        )
    if D().lat:
        st.success(
            f"緯度経度: {D().lat:.5f}, {D().lng:.5f}　／　市区町村コード: {D().muni_code or '不明'}"
        )
    else:
        st.warning("住所から緯度経度を特定できませんでした。住所表記を見直してください。")

market = D().market
mc1, mc2 = st.columns([1, 2])
with mc1:
    st.subheader("公示地価（㎡単価）")
    market.koji_unit_price = int(
        st.number_input(
            "公示地価 円/㎡（手入力で上書き可）",
            value=int(market.koji_unit_price),
            step=1000,
        )
    )
    if market.koji_point_name:
        st.caption(f"最寄標準地: {market.koji_point_name}（{market.koji_distance_m}m）")
    if D().chika_map_url:
        st.link_button("🗺️ 全国地価マップで路線価を確認", D().chika_map_url)
with mc2:
    st.subheader(f"取引事例（{market.comp_count}件）")
    if market.comparables:
        st.dataframe(
            [
                {
                    "名称/地区": c.name,
                    "所在地": c.address,
                    "取引価格(万円)": c.trade_price_man,
                    "㎡単価(円)": c.unit_price,
                    "面積(㎡)": c.area,
                    "時期": c.trade_period,
                }
                for c in market.comparables
            ],
            hide_index=True,
            use_container_width=True,
        )
        st.caption(
            f"平均㎡単価: {market.avg_unit_price:,}円 ／ 最高 {market.max_unit_price:,} ／ "
            f"最低 {market.min_unit_price:,}　"
            "※APIは市区町村・四半期単位のため、地区レベルの近傍事例です。"
        )
    else:
        st.info(
            "取引事例が未取得です。APIキー設定後に再調査するか、"
            "下の『手動で事例を追加』から入力してください。"
        )

    with st.expander("✍️ 手動で取引事例を追加"):
        hc1, hc2, hc3, hc4 = st.columns(4)
        h_addr = hc1.text_input("所在地", key="h_addr")
        h_price = hc2.number_input("取引価格(万円)", value=0, step=100, key="h_price")
        h_area = hc3.number_input("面積(㎡)", value=0.0, step=1.0, key="h_area")
        h_period = hc4.text_input("時期", key="h_period")
        if st.button("事例を追加") and h_price and h_area:
            yen = int(h_price) * 10000
            market.comparables.append(
                Comparable(
                    name="手入力事例",
                    address=h_addr,
                    trade_price=yen,
                    unit_price=round(yen / h_area),
                    area=float(h_area),
                    trade_period=h_period,
                )
            )
            st.rerun()


# ---- 相続税路線価（土地を持つ種別のみ） ----
if ptype in (TYPE_KODATE, TYPE_SHUEKI):
    st.subheader("相続税路線価　※前面道路（正面路線）で価格が変わります")
    lc1, lc2 = st.columns(2)
    with lc1:
        st.link_button(
            "🗺️ 全国地価マップで確認（住所検索＋路線価表示）",
            geo_service.chika_map_url(D().address or ""),
        )
    with lc2:
        st.link_button("📄 国税庁 路線価図", "https://www.rosenka.nta.go.jp/")

    up = st.file_uploader(
        "路線価図／全国地価マップのスクショ（PNG/JPG/PDF）をアップ → AIが接道路線価を読取",
        type=["png", "jpg", "jpeg", "pdf"],
        key="rosenka_img",
    )
    if st.button("路線価図をAI読取", disabled=up is None):
        with st.spinner("路線価図をAI解析中...（数分かかることがあります）"):
            try:
                res = rosenka_reader.read(up.getvalue(), up.name, address=D().address)
                st.session_state.rosenka_candidates = res["candidates"]
                market.rosenka_unit_price = res["unit_price"]
                market.rosenka_note = res["note"]
                st.success(
                    f"読取成功：正面路線 {res['note'] or ''}（{res['unit_price']:,}円/㎡）"
                    f"／接道候補 {len(res['candidates'])}件"
                )
            except rosenka_reader.PdfExtractionError as e:
                st.warning(str(e))

    cands = st.session_state.get("rosenka_candidates", [])
    if len(cands) > 1:
        labels = [c["label"] for c in cands]
        idx = st.radio(
            "前面道路（正面路線）を選択",
            range(len(labels)),
            format_func=lambda i: labels[i],
            horizontal=True,
        )
        market.rosenka_unit_price = cands[idx]["unit"]
        market.rosenka_note = cands[idx]["note"]

    rk1, rk2 = st.columns(2)
    with rk1:
        market.rosenka_unit_price = int(
            st.number_input(
                "正面路線価（円/㎡・手入力で上書き可）",
                value=int(market.rosenka_unit_price),
                step=1000,
            )
        )
    with rk2:
        chiku_opts = list(valuation_engine.SIDE_ADD_RATE.keys())
        chiku_idx = (
            chiku_opts.index(market.rosenka_chiku)
            if market.rosenka_chiku in chiku_opts
            else 0
        )
        market.rosenka_chiku = st.selectbox("地区区分（側方加算率）", chiku_opts, index=chiku_idx)

    with st.expander("角地・準角地の側方路線影響加算"):
        corner_opts = ["なし", "角地", "準角地"]
        market.rosenka_corner = st.radio(
            "角地区分",
            corner_opts,
            index=corner_opts.index(market.rosenka_corner)
            if market.rosenka_corner in corner_opts
            else 0,
            horizontal=True,
        )
        if market.rosenka_corner != "なし":
            market.rosenka_side_unit_price = int(
                st.number_input(
                    "側方路線価（円/㎡）",
                    value=int(market.rosenka_side_unit_price),
                    step=1000,
                )
            )
            rate = valuation_engine.SIDE_ADD_RATE.get(market.rosenka_chiku, {}).get(
                market.rosenka_corner, 0.0
            )
            st.caption(
                f"側方路線影響加算率 {rate:.0%}（{market.rosenka_corner}・{market.rosenka_chiku}）。"
                "※奥行価格補正・不整形地補正等は簡易のため省略しています。"
            )

    prev = valuation_engine.compute_rosenka(market, reg.land_area)
    if prev:
        eff, souzoku, jissei, detail = prev
        st.caption(f"採用路線価：{detail}")
        pc1, pc2 = st.columns(2)
        pc1.metric("相続税評価額（路線価×地積）", f"{valuation_engine._man(souzoku):,} 万円")
        pc2.metric("実勢補正（÷0.8）", f"{valuation_engine._man(jissei):,} 万円")
    elif market.rosenka_unit_price:
        st.info("土地地積（STEP 2）を入力すると路線価ベースの土地評価額を表示します。")


# ============================================================
# STEP 4：査定計算 ＆ Excel出力
# ============================================================
st.header("STEP 4　査定価格の算定とExcel出力")

if st.button("③ 査定計算する", type="primary"):
    D().valuation = valuation_engine.evaluate(D())

v = D().valuation
if v.final_price or v.basis:
    st.metric("最終査定価格", f"{valuation_engine._man(v.final_price):,} 万円")

    if ptype == TYPE_MANSION:
        st.write(f"**算出根拠**：{v.basis}")
    elif ptype == TYPE_KODATE:
        kc1, kc2, kc3 = st.columns(3)
        kc1.metric("土地評価額", f"{valuation_engine._man(v.land_price):,} 万円")
        kc2.metric("建物評価額(原価法)", f"{valuation_engine._man(v.building_price):,} 万円")
        kc3.metric("合計", f"{valuation_engine._man(v.final_price):,} 万円")
        st.caption(v.basis)
    elif ptype == TYPE_SHUEKI:
        sc1, sc2 = st.columns(2)
        with sc1:
            st.markdown("**積算価格（コスト法）**")
            st.write(f"土地: {valuation_engine._man(v.cost_land):,} 万円")
            st.write(f"建物: {valuation_engine._man(v.cost_building):,} 万円")
            st.write(f"合計: **{valuation_engine._man(v.cost_total):,} 万円**")
        with sc2:
            st.markdown("**収益価格（収益還元法）**")
            st.write(f"年間総収入: {valuation_engine._man(v.income_gross):,} 万円")
            st.write(f"運営経費(20%): -{valuation_engine._man(v.income_expense):,} 万円")
            st.write(f"NOI: {valuation_engine._man(v.income_noi):,} 万円 ÷ {v.cap_rate}%")
            st.write(f"収益還元価格: **{valuation_engine._man(v.income_price):,} 万円**")

    # 路線価ベースの土地評価（参考・両方表示）
    if v.rosenka_souzoku:
        st.markdown("**［参考］相続税路線価ベースの土地評価**")
        st.caption(v.rosenka_detail)
        rc1, rc2 = st.columns(2)
        rc1.metric("相続税評価額（路線価×地積）", f"{valuation_engine._man(v.rosenka_souzoku):,} 万円")
        rc2.metric("実勢補正（÷0.8）", f"{valuation_engine._man(v.rosenka_jissei):,} 万円")

    # Excel出力
    try:
        xlsx = excel_export_service.build(D())
        fname = {
            TYPE_MANSION: "査定報告書_マンション.xlsx",
            TYPE_KODATE: "査定報告書_戸建.xlsx",
            TYPE_SHUEKI: "査定報告書_収益.xlsx",
        }[ptype]
        st.download_button(
            "④ 査定報告書(Excel)をダウンロード",
            data=xlsx,
            file_name=fname,
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            type="primary",
        )
    except Exception as e:
        st.error(f"Excel生成に失敗しました: {e}")
else:
    st.info("「③ 査定計算する」を押すと査定価格を算定します。")
