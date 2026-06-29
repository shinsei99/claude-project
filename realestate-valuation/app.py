# -*- coding: utf-8 -*-
"""不動産査定書 作成システム（DAIKYO）。

物件種別（土地・戸建て / マンション）を選び、取引事例・売出物件のPDFをAIで読み込み、
評点方式で査定価格を自動算出（手修正可）→ 3枚セットの査定書(Excel)を出力する。
不動産情報ライブラリAPIは「参考相場」として補助的に利用する。
"""

from __future__ import annotations

from datetime import date

import pandas as pd
import streamlit as st

from services import satei_core as sc
from services import case_extractor, satei_report, explanation_service, ryutsu_service
from services import geo_service, market_research_service

st.set_page_config(page_title="不動産査定書 作成システム", page_icon="🏠", layout="wide")


# ── ヘルパ ────────────────────────────────────────────────────────────────────
def wareki(d: date) -> str:
    if d.year >= 2019:
        n = d.year - 2018
        y = "元" if n == 1 else str(n)
        return f"令和{y}年{d.month}月{d.day}日"
    return d.strftime("%Y年%m月%d日")


def add_months(d: date, months: int) -> date:
    import calendar
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    day = min(d.day, calendar.monthrange(y, m)[1])
    return date(y, m, day)


def colspec(ptype):
    if ptype == sc.TYPE_MANSION:
        return [
            ("address", "所在地"), ("mansion_name", "マンション名・号室"),
            ("price_man", "価格(万円)"), ("exclusive_area", "専有面積㎡"),
            ("balcony_area", "ﾊﾞﾙｺﾆｰ㎡"), ("unit_price", "単価(円/㎡)"),
            ("direction", "向"), ("floor_no", "階/階建"), ("build_ym", "築年月"),
            ("station", "最寄駅"), ("access", "アクセス"), ("trade_ym", "取引年月"),
        ]
    return [
        ("address", "所在地"), ("price_man", "価格(万円)"),
        ("land_price_man", "うち土地(万円)"), ("land_area", "土地面積㎡"),
        ("building_area", "建物面積㎡"), ("unit_price", "土地単価(円/㎡)"),
        ("structure", "構造"), ("build_ym", "築年月"), ("madori", "間取り"),
        ("station", "最寄駅"), ("access", "アクセス"), ("trade_ym", "取引年月"),
    ]


def cases_to_df(cases, spec):
    if not cases:
        return pd.DataFrame([{label: "" for _, label in spec}])
    return pd.DataFrame([{label: c.get(key, "") for key, label in spec} for c in cases])


def df_to_cases(df, spec):
    out = []
    for _, row in df.iterrows():
        c = sc.empty_case()
        nonempty = False
        for key, label in spec:
            v = row.get(label, "")
            if pd.isna(v):
                v = ""
            c[key] = v
            if str(v).strip() not in ("", "0", "0.0", "nan"):
                nonempty = True
        if nonempty:
            out.append(c)
    return out


def avg_unit(cases):
    vals = [float(c.get("unit_price") or 0) for c in cases if float(c.get("unit_price") or 0) > 0]
    return round(sum(vals) / len(vals)) if vals else 0


def num(v, default=0.0):
    try:
        return float(v)
    except Exception:
        return default


# ── セッション初期化 ──────────────────────────────────────────────────────────
ss = st.session_state
ss.setdefault("trades", [])
ss.setdefault("sales", [])
ss.setdefault("plus", [sc.empty_point() for _ in range(2)])
ss.setdefault("minus", [sc.empty_point() for _ in range(2)])
ss.setdefault("explanation", "")
ss.setdefault("ryutsu", 100)
ss.setdefault("ryutsu_reason", "")
ss.setdefault("ryutsu_trades", None)   # {ratio, reason, basis}
ss.setdefault("ryutsu_ai", None)       # {ratio, reason}
ss.setdefault("ryutsu_choice_prev", None)
# 会社セレクトの保留適用（ウィジェット生成前に行う）
if "_pending_company_sel" in ss:
    ss["company_sel"] = ss.pop("_pending_company_sel")
company = sc.load_company()


# ============================================================
# サイドバー：自社情報
# ============================================================
with st.sidebar:
    st.header("🏢 自社情報")
    st.caption("会社名ごとに登録・選択できます")

    names = sc.list_companies()
    options = names + ["＋ 新規登録"]
    cur = sc.current_name()
    default_idx = names.index(cur) if cur in names else 0
    sel = st.selectbox("登録会社", options, index=default_idx, key="company_sel")
    is_new = sel == "＋ 新規登録"
    prof = sc.get_profile(sel) if not is_new else dict(
        company_name="", office="", staff="", tel="", address="",
        license_no="", logo_path="")
    if not is_new and sel != cur:
        sc.set_current(sel)

    kp = "new" if is_new else sel
    with st.form("company_form"):
        company_name = st.text_input("会社名", value=prof.get("company_name", ""), key=f"cn_{kp}")
        office = st.text_input("営業所", value=prof.get("office", ""), key=f"of_{kp}")
        staff = st.text_input("担当者名", value=prof.get("staff", ""), key=f"st_{kp}")
        tel = st.text_input("電話番号", value=prof.get("tel", ""), key=f"tl_{kp}")
        addr = st.text_input("所在地", value=prof.get("address", ""), key=f"ad_{kp}")
        lic = st.text_input("免許番号", value=prof.get("license_no", ""), key=f"lc_{kp}")
        logo_up = st.file_uploader("ロゴ画像（任意）", type=["png", "jpg", "jpeg"], key=f"lg_{kp}")
        submitted = st.form_submit_button("💾 保存", use_container_width=True)
    if submitted:
        if not company_name.strip():
            st.error("会社名を入力してください")
        else:
            info = {
                "company_name": company_name, "office": office, "staff": staff,
                "tel": tel, "address": addr, "license_no": lic,
                "logo_path": prof.get("logo_path", "") or "assets/logo.jpeg",
            }
            if logo_up is not None:
                import os, hashlib
                os.makedirs("assets", exist_ok=True)
                ext = logo_up.name.split(".")[-1].lower()
                tag = hashlib.md5(company_name.encode("utf-8")).hexdigest()[:8]
                p = f"assets/logo_{tag}.{ext}"
                with open(p, "wb") as f:
                    f.write(logo_up.getvalue())
                info["logo_path"] = p
            sc.save_profile(info)
            st.session_state["_pending_company_sel"] = company_name
            st.success("保存しました")
            st.rerun()

    if not is_new and len(names) > 1:
        if st.button("🗑 この会社を削除", use_container_width=True):
            sc.delete_profile(sel)
            st.session_state["_pending_company_sel"] = sc.current_name()
            st.rerun()

    st.divider()
    with st.expander("参考：不動産情報ライブラリAPI"):
        if market_research_service.get_api_key():
            st.success("API：設定済み（参考相場に利用）")
        else:
            st.info("APIキー未設定。参考相場は利用できません。")
        st.caption("査定は事例・売出のPDF入力が主、API相場は参考扱いです。")


# ============================================================
# メイン
# ============================================================
st.title("🏠 不動産査定書 作成システム")
st.caption("取引事例・売出物件PDFをAIで読み込み → 評点方式で査定 → 3枚セットの査定書(Excel)を出力")

ptype = st.radio("物件種別", sc.PROPERTY_TYPES, horizontal=True)
is_mansion = ptype == sc.TYPE_MANSION
spec = colspec(ptype)

c1, c2, c3 = st.columns(3)
customer = c1.text_input("お客様氏名", placeholder="例：上田")
satei_d = c2.date_input("査定年月日", value=date.today())
expiry_d = c3.date_input("有効期限", value=add_months(date.today(), 3))

st.divider()

# ── 1. 査定対象物件 ──
st.subheader("① 査定対象物件")
subj = sc.empty_case()
s1, s2, s3 = st.columns([2, 1, 1])
subj["address"] = s1.text_input("物件所在地")
subj["rights"] = s2.selectbox("権利", ["所有権", "地上権", "賃借権", "定期借地権"])
subj["build_ym"] = s3.text_input("築年月", placeholder="例 平成10年3月")
s4, s5, s6, s7 = st.columns(4)
subj["station"] = s4.text_input("最寄駅・路線")
subj["access"] = s5.text_input("アクセス", placeholder="徒歩8分")
subj["structure"] = s6.text_input("建物構造", placeholder="木造2F")
subj["madori"] = s7.text_input("間取り", placeholder="3LDK")
if is_mansion:
    m1, m2, m3, m4 = st.columns(4)
    subj["mansion_name"] = m1.text_input("マンション名・号室")
    subj["exclusive_area"] = m2.number_input("専有面積(㎡)", min_value=0.0, step=0.01, format="%.2f")
    subj["balcony_area"] = m3.number_input("バルコニー(㎡)", min_value=0.0, step=0.01, format="%.2f")
    subj["floor_no"] = m4.text_input("階／階建", placeholder="6/11")
    subj["direction"] = st.text_input("向き", placeholder="南")
else:
    k1, k2 = st.columns(2)
    subj["land_area"] = k1.number_input("土地面積(㎡)", min_value=0.0, step=0.01, format="%.2f")
    subj["building_area"] = k2.number_input("建物面積(㎡)", min_value=0.0, step=0.01, format="%.2f")

st.divider()

# ── 2. 取引事例・売出物件（PDF→AI抽出） ──
st.subheader("② 取引事例・売出物件")
st.caption("PDFをアップして「AIで抽出」→ 下の表に反映され、手修正できます。")

up1, up2 = st.columns(2)
with up1:
    st.markdown("**取引事例 PDF**")
    trade_pdfs = st.file_uploader("取引事例", type=["pdf"], accept_multiple_files=True,
                                  key="trade_up", label_visibility="collapsed")
    if st.button("🤖 取引事例をAI抽出", use_container_width=True, disabled=not trade_pdfs):
        got = 0
        with st.spinner("PDFを解析中..."):
            for f in trade_pdfs:
                try:
                    cs = case_extractor.extract_cases(f.getvalue(), f.name, "取引事例", ptype)
                    ss.trades.extend(cs); got += len(cs)
                except Exception as e:
                    st.error(f"{f.name}: {e}")
        st.success(f"{got}件の取引事例を抽出しました"); st.rerun()
with up2:
    st.markdown("**売出物件 PDF**")
    sale_pdfs = st.file_uploader("売出物件", type=["pdf"], accept_multiple_files=True,
                                 key="sale_up", label_visibility="collapsed")
    if st.button("🤖 売出物件をAI抽出", use_container_width=True, disabled=not sale_pdfs):
        got = 0
        with st.spinner("PDFを解析中..."):
            for f in sale_pdfs:
                try:
                    cs = case_extractor.extract_cases(f.getvalue(), f.name, "売出物件", ptype)
                    ss.sales.extend(cs); got += len(cs)
                except Exception as e:
                    st.error(f"{f.name}: {e}")
        st.success(f"{got}件の売出物件を抽出しました"); st.rerun()

st.markdown("**取引事例（編集可）**")
ed_t = st.data_editor(cases_to_df(ss.trades, spec), num_rows="dynamic",
                      use_container_width=True, key="ed_trades")
ss.trades = df_to_cases(ed_t, spec)

st.markdown("**売出物件（編集可）**")
ed_s = st.data_editor(cases_to_df(ss.sales, spec), num_rows="dynamic",
                      use_container_width=True, key="ed_sales")
ss.sales = df_to_cases(ed_s, spec)

with st.expander("参考：周辺相場を取得（不動産情報ライブラリ）"):
    ref_addr = st.text_input("住所", value=subj["address"], key="ref_addr")
    if st.button("📡 参考相場を取得"):
        try:
            with st.spinner("照会中..."):
                geo = geo_service.resolve(ref_addr)
                mtype = "区分マンション" if is_mansion else "土地・戸建"
                md = market_research_service.research(
                    geo.get("pref_code", ""), geo.get("muni_code", ""),
                    geo.get("lat"), geo.get("lng"), mtype)
            if md.koji_unit_price:
                st.info(f"最寄公示地価：{md.koji_unit_price:,}円/㎡（{md.koji_point_name} 約{md.koji_distance_m}m）")
            if md.comparables:
                st.dataframe(pd.DataFrame([
                    {"所在": c.address, "取引価格(万円)": c.trade_price_man,
                     "単価(円/㎡)": c.unit_price, "面積㎡": c.area, "時期": c.trade_period}
                    for c in md.comparables]), use_container_width=True)
            else:
                st.caption("参考データを取得できませんでした（住所精度・APIキーをご確認ください）。")
        except Exception as e:
            st.warning(f"参考相場の取得に失敗しました: {e}")

st.divider()

# ── 3. 加点・減点ポイント ──
st.subheader("③ 加点・減点ポイント（評点）")
st.caption("要因とポイントはプルダウンから選択。土地/建物/両方の区分も選べます。"
           "合計評点は安全のため±50点（倍率50〜150%）の範囲に制限されます。")


def points_df(lst):
    if not lst:
        rows = [{"要因": None, "区分": "両方", "点": None}]
    else:
        rows = [{"要因": p.get("factor") or None, "区分": p.get("kubun", "両方"),
                 "点": (p.get("point") or None)} for p in lst]
    return pd.DataFrame(rows)


def points_cfg(factor_options):
    return {
        "要因": st.column_config.SelectboxColumn("要因", options=factor_options, required=False, width="large"),
        "区分": st.column_config.SelectboxColumn("区分", options=sc.KUBUN_OPTIONS, required=False),
        "点": st.column_config.SelectboxColumn("点", options=sc.POINT_CHOICES, required=False),
    }


pp, mm = st.columns(2)
with pp:
    st.markdown("**加点ポイント**")
    ed_p = st.data_editor(points_df(ss.plus), num_rows="dynamic", use_container_width=True,
                          key="ed_plus", column_config=points_cfg(sc.PLUS_FACTORS))
with mm:
    st.markdown("**減点ポイント**")
    ed_m = st.data_editor(points_df(ss.minus), num_rows="dynamic", use_container_width=True,
                          key="ed_minus", column_config=points_cfg(sc.MINUS_FACTORS))


def df_to_points(df):
    out = []
    for _, r in df.iterrows():
        f = r.get("要因")
        if pd.isna(f) or not str(f).strip():
            continue
        pt = r.get("点")
        pt = 0 if pd.isna(pt) else int(num(pt, 0))
        out.append({"factor": str(f).strip(), "kubun": (r.get("区分") or "両方"), "point": pt})
    return out


ss.plus = df_to_points(ed_p)
ss.minus = df_to_points(ed_m)
_net = sc.total_point(ss.plus, ss.minus)
if abs(_net) > sc.MAX_NET_POINT:
    st.warning(f"合計評点 {_net:+d} 点は範囲外のため ±{sc.MAX_NET_POINT}点に制限して計算します。")

st.divider()

# ── 4. 単価・査定計算 ──
st.subheader("④ 単価と査定計算")
st.markdown("**流通性比率（％）** — 売れ易さによる最終調整（原則±7%＝93〜107%）。"
            "2通りの算出を見比べて採用できます。")
rb1, rb2 = st.columns(2)
if rb1.button("🧮 取引事例から算出", use_container_width=True):
    ss.ryutsu_trades = ryutsu_service.from_trades(ss.trades, ss.sales)
    st.rerun()
if rb2.button("🌐 AIで総合判断（Web相場調査）", use_container_width=True):
    with st.spinner("相場を調査中..."):
        try:
            ss.ryutsu_ai = ryutsu_service.suggest_ryutsu(
                property_type=ptype, subject=subj, trades=ss.trades, sales=ss.sales)
        except Exception as e:
            st.error(str(e))
    st.rerun()

# 2案を並べて表示
ca, cb = st.columns(2)
with ca:
    st.markdown("**🧮 取引事例ベース**")
    if ss.ryutsu_trades:
        st.metric("提案比率", f"{ss.ryutsu_trades['ratio']} %", help=ss.ryutsu_trades.get("basis", ""))
        st.caption(ss.ryutsu_trades["reason"])
    else:
        st.caption("「取引事例から算出」を押すと、成約事例の単価推移から算出します。")
with cb:
    st.markdown("**🌐 AI総合判断**")
    if ss.ryutsu_ai:
        st.metric("提案比率", f"{ss.ryutsu_ai['ratio']} %")
        st.caption(ss.ryutsu_ai["reason"])
    else:
        st.caption("「AIで総合判断」を押すと、Web相場調査＋事例から提案します。")

# 採用方法を選択
opts = []
if ss.ryutsu_trades:
    opts.append("取引事例ベース")
if ss.ryutsu_ai:
    opts.append("AI総合判断")
opts.append("手動")
choice = st.radio("採用する流通性比率", opts, horizontal=True, key="ryutsu_choice")
if choice != ss.ryutsu_choice_prev:
    if choice == "取引事例ベース" and ss.ryutsu_trades:
        ss.ryutsu = ss.ryutsu_trades["ratio"]
    elif choice == "AI総合判断" and ss.ryutsu_ai:
        ss.ryutsu = ss.ryutsu_ai["ratio"]
    ss.ryutsu_choice_prev = choice
ryutsu = st.slider("流通性比率（％・微調整可）", min_value=70, max_value=120, value=int(ss.ryutsu), step=1)
ss.ryutsu = ryutsu
if choice == "取引事例ベース" and ss.ryutsu_trades:
    ss.ryutsu_reason = f"【取引事例】{ss.ryutsu_trades['reason']}"
elif choice == "AI総合判断" and ss.ryutsu_ai:
    ss.ryutsu_reason = f"【AI総合判断】{ss.ryutsu_ai['reason']}"
else:
    ss.ryutsu_reason = "手動設定"
if is_mansion:
    u1, u2 = st.columns(2)
    sugg = avg_unit(ss.trades) or avg_unit(ss.sales)
    case_unit = u1.number_input("事例単価(円/㎡)", min_value=0, step=1000, value=int(sugg),
                                help="採用取引事例の単価。空欄時は事例平均を提案。")
    calc = sc.calc_mansion(case_unit, num(subj["exclusive_area"]), ss.plus, ss.minus, ryutsu)
    u2.metric("評点計", f"{calc['point']:+d} 点")
    st.caption(f"試算価格 {calc['base']:,}円 × 流通性比率 {ryutsu}% = {calc['total']:,}円")
else:
    u1, u2, u3 = st.columns(3)
    sugg = avg_unit(ss.trades) or avg_unit(ss.sales)
    land_unit = u1.number_input("土地事例単価(円/㎡)", min_value=0, step=1000, value=int(sugg))
    building_unit = u2.number_input("再調達単価(円/㎡)", min_value=0, step=1000, value=150000,
                                    help="建物の再調達単価。木造15万円/㎡等を目安に。")
    calc = sc.calc_kodate(land_unit, num(subj["land_area"]), building_unit,
                          num(subj["building_area"]), ss.plus, ss.minus, ryutsu)
    u3.metric("土地/建物 評点", f"{calc['land_point']:+d} / {calc['building_point']:+d}")
    cc1, cc2, cc3 = st.columns(3)
    cc1.metric("土地価格(A)", f"{calc['land_value']:,} 円")
    cc2.metric("建物価格(B)", f"{calc['building_value']:,} 円")
    cc3.metric(f"×流通性比率{ryutsu}%", f"{calc['total']:,} 円")

st.markdown(f"### 自動算出の査定価格： **{calc['total']:,} 円**")
final = st.number_input("最終査定価格（手修正可・円）", min_value=0, step=10000, value=int(calc["total"]))
calc["total"] = int(final)

st.divider()

# ── 5. 査定の根拠（説明書） ──
st.subheader("⑤ 査定価格の説明書（査定の根拠）")
note = st.text_input("担当者メモ（AI生成に反映・任意）", placeholder="例：高台で日当たり・眺望良好。流通性高く105%。")
if st.button("🤖 査定の根拠をAI生成"):
    with st.spinner("生成中..."):
        try:
            ss.explanation = explanation_service.generate_explanation(
                property_type=ptype, subject=subj, trades=ss.trades, calc=calc,
                ryutsu_ratio=f"{ryutsu}%", note=note)
        except Exception as e:
            st.error(str(e))
    st.rerun()
ss.explanation = st.text_area("査定の根拠（編集可）", value=ss.explanation, height=160)

st.divider()

# ── 6. 出力 ──
st.subheader("⑥ 査定書を出力")
if not customer:
    st.info("お客様氏名を入力すると出力できます。")
else:
    company = sc.load_company()
    data = satei_report.build_report(
        property_type=ptype, subject=subj, trades=ss.trades, sales=ss.sales,
        plus=ss.plus, minus=ss.minus, units={}, calc=calc, company=company,
        customer=customer, satei_date=wareki(satei_d), expiry=wareki(expiry_d),
        explanation=ss.explanation)
    label = "戸建" if not is_mansion else "マンション"
    st.download_button(
        f"📊 査定書3枚セット（{label}）をExcelでダウンロード",
        data=data,
        file_name=f"査定書_{label}_{customer}_{satei_d.strftime('%Y%m%d')}.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        use_container_width=True)
    st.caption("① 市場価格分析表 ② 価格査定書 ③ 査定価格の説明書 の3シート構成（A4縦）です。")
