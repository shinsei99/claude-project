# -*- coding: utf-8 -*-
"""媒介契約書ジェネレーター

不動産謄本（登記事項証明書）PDF を最大5枚アップロードすると、
土地 / 建物 / マンションを自動判別して内容を読み取り、
媒介契約書（一般・専任・専属専任）の Excel を自動作成する業務支援アプリ。

- 謄本の読み取りはローカルの `claude` CLI を subprocess で呼び出す（APIキー不要）。
- 出力は国土交通省の標準媒介契約約款に基づくフォーマット（別表＋約款付き）。
"""

import streamlit as st

from services import company_store, registry_parser
from services.excel_builder import build_contract

st.set_page_config(page_title="媒介契約書ジェネレーター", page_icon="📄", layout="wide")

_OTSU_FIELDS = ["商号", "代表者", "所在地", "免許番号", "TEL"]


def _on_select_company():
    """登録済み自社プロファイルを選択したとき、入力欄に流し込む。"""
    sel = st.session_state.get("company_select", "（新規入力）")
    profs = company_store.load_all()
    p = profs.get(sel, {})
    for f in _OTSU_FIELDS:
        st.session_state[f"otsu_{f}"] = p.get(f, "")
    st.session_state["otsu_流通機構"] = p.get("流通機構", "公益社団法人　不動産流通機構")
    st.session_state["company_name_input"] = sel if sel != "（新規入力）" else ""


LOW_PRICE_LIMIT = 8_000_000       # 低廉な空家等の特例の対象上限（売買価格800万円以下）
LOW_PRICE_REWARD = 300_000        # 特例の報酬上限（30万円・税抜）→ 税込33万円


def _calc_reward(price: int):
    """売買価格（税抜本体）から媒介報酬（税抜）と消費税を計算する。

    - 800万円以下（低廉な空家等の特例）: 一律 30万円（税抜）＝ 33万円（税込）。
    - 800万円超: 通常の速算式 価格×3%＋6万円（上限額）。
    消費税10%。
    """
    if not price or price <= 0:
        return 0, 0
    if price <= LOW_PRICE_LIMIT:
        base = LOW_PRICE_REWARD
    else:
        base = int(round(price * 0.03 + 60_000))
    return base, int(round(base * 0.10))


def main():
    st.title("📄 媒介契約書ジェネレーター")
    st.caption("謄本（登記事項証明書）をアップ → 土地/建物/マンションを自動判別 → "
               "媒介契約書（一般・専任・専属専任）の Excel を自動作成")

    # ── サイドバー：自社（乙）情報 ───────────────────────────────────────────
    with st.sidebar:
        st.header("🏢 自社（宅地建物取引業者・乙）")

        # 流通機構名の初期値（未設定時のみ）
        if "otsu_流通機構" not in st.session_state:
            st.session_state["otsu_流通機構"] = "公益社団法人　不動産流通機構"

        # 保存／削除後に選択状態を切り替えるための保留適用（ウィジェット生成前に行う）
        if "_pending_company_select" in st.session_state:
            sel = st.session_state.pop("_pending_company_select")
            st.session_state["company_select"] = sel
            p = company_store.load_all().get(sel, {})
            for f in _OTSU_FIELDS:
                st.session_state[f"otsu_{f}"] = p.get(f, "")
            st.session_state["otsu_流通機構"] = p.get("流通機構", "公益社団法人　不動産流通機構")
            st.session_state["company_name_input"] = sel if sel != "（新規入力）" else ""

        # 登録済みプロファイルの選択
        saved = company_store.names()
        options = ["（新規入力）"] + saved
        if st.session_state.get("company_select") not in options:
            st.session_state["company_select"] = "（新規入力）"
        st.selectbox("登録済みの自社情報", options, key="company_select",
                     on_change=_on_select_company,
                     help="名称で登録した自社情報を呼び出せます。")

        otsu = {
            "商号": st.text_input("商号（名称）", key="otsu_商号"),
            "代表者": st.text_input("代表者氏名", key="otsu_代表者"),
            "所在地": st.text_input("主たる事務所の所在地", key="otsu_所在地"),
            "免許番号": st.text_input("免許番号", key="otsu_免許番号"),
            "TEL": st.text_input("TEL", key="otsu_TEL"),
        }
        ryutsu_name = st.text_input("指定流通機構の名称", key="otsu_流通機構")

        # 名称をつけて保存 / 削除
        st.markdown("**この内容を登録**")
        reg_name = st.text_input("登録名（例：本店／梅田支店）", key="company_name_input")
        bc = st.columns(2)
        flash = st.session_state.pop("_flash", None)
        if flash:
            st.success(flash)
        if bc[0].button("💾 保存", use_container_width=True):
            try:
                company_store.save(reg_name, {**otsu, "流通機構": ryutsu_name})
                st.session_state["_pending_company_select"] = reg_name
                st.session_state["_flash"] = f"「{reg_name}」を登録しました。"
                st.rerun()
            except ValueError as e:
                st.error(str(e))
        sel_now = st.session_state.get("company_select", "（新規入力）")
        if bc[1].button("🗑 削除", use_container_width=True,
                        disabled=(sel_now == "（新規入力）")):
            company_store.delete(sel_now)
            st.session_state["_pending_company_select"] = "（新規入力）"
            st.session_state["_flash"] = f"「{sel_now}」を削除しました。"
            st.rerun()

    # ── ① 謄本アップロード ──────────────────────────────────────────────────
    st.subheader("① 謄本アップロード（最大5枚）")
    st.caption("土地・建物・区分建物（マンション）の謄本を混在させてOK。種別は自動判別します。")
    files = st.file_uploader(
        "登記事項証明書 PDF", type=["pdf"], accept_multiple_files=True,
        help="最大5枚まで。土地謄本＋建物謄本などをまとめて入れられます。",
    )
    if files and len(files) > registry_parser.MAX_PDFS:
        st.warning(f"{registry_parser.MAX_PDFS}枚まで対応です。先頭{registry_parser.MAX_PDFS}枚を使用します。")
        files = files[:registry_parser.MAX_PDFS]

    st.caption("📷 文字データの無いスキャン謄本PDFも、ClaudeにPDFを直接読み取らせて解析します"
               "（スキャンPDFは1枚あたり数分かかる場合があります）。")
    if st.button("🔍 謄本を解析して読み取る", type="primary", disabled=not files):
        with st.spinner(f"謄本{len(files)}枚をAIで解析中… スキャンPDFは時間がかかります"
                        "（1枚あたり数分）。完了までこのタブを開いたままお待ちください。"):
            st.session_state["parsed"] = registry_parser.parse_registry(files)

    data = st.session_state.get("parsed")
    if not data:
        st.info("謄本をアップロードして「解析して読み取る」を押してください。"
                "（謄本なしでも、下の項目を手入力して作成できます）")
        if st.button("謄本なしで手入力する"):
            st.session_state["parsed"] = registry_parser.json.loads(
                registry_parser.json.dumps(registry_parser.EMPTY))
            st.rerun()
        return

    diag = data.get("_diag", {})
    if data.get("_ai") is False and data.get("_count"):
        st.warning("AI読み取りが使えなかったため、簡易抽出（不完全）で埋めています。内容を必ずご確認ください。")
        reasons = diag.get("reasons", [])
        if reasons:
            with st.expander("⚠️ うまく読めなかった理由を見る", expanded=True):
                for r in reasons:
                    st.write("・" + r)

    shubetsu = data.get("物件種別") or "（未判別）"
    method_note = ""
    files_info = diag.get("files", [])
    n_scan = sum(1 for f in files_info if f.get("method") == "scan-orient")
    if n_scan:
        angles = diag.get("angles", [])
        rotated = [a for a in angles if a]
        rot_note = f"（{len(rotated)}ページ向き補正）" if rotated else ""
        method_note = f"　／　スキャン謄本を向き補正してAI読み取り: {n_scan}枚{rot_note}"
    st.success(f"判別した物件種別：**{shubetsu}**　／　解析した謄本：{data.get('_count', 0)}枚{method_note}")

    # ── ② 読み取り結果の確認・補正 ─────────────────────────────────────────
    st.subheader("② 読み取り結果の確認・補正")
    edited = _edit_property_form(data)

    # ── ③ 契約条件の入力 ────────────────────────────────────────────────────
    st.subheader("③ 契約条件")
    meta = _contract_terms_form(otsu, ryutsu_name)

    # ── ④ 生成 ──────────────────────────────────────────────────────────────
    st.subheader("④ 媒介契約書を生成")
    ctype = st.radio("契約の種類", ["専任", "専属専任", "一般"], horizontal=True,
                     help="専任=3ヶ月以内・2週に1回報告／専属専任=自己発見取引不可・1週に1回報告／一般=重複依頼可")
    if st.button("📄 Excelを生成", type="primary"):
        xlsx = build_contract(ctype, edited, meta)
        st.success(f"{ctype}媒介契約書を生成しました。")
        fname = f"{ctype}媒介契約書_{(edited.get('所有者氏名') or '物件').strip()}.xlsx"
        st.download_button("⬇️ ダウンロード", data=xlsx, file_name=fname,
                           mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


def _edit_property_form(data: dict) -> dict:
    """別表の自動入力値を編集できるフォーム。編集後の dict を返す。"""
    out = registry_parser.json.loads(registry_parser.json.dumps(data))
    shubetsu_opts = ["土地", "建物", "土地建物", "マンション"]
    cur = data.get("物件種別", "")
    idx = shubetsu_opts.index(cur) if cur in shubetsu_opts else 2

    c1, c2 = st.columns(2)
    with c1:
        out["物件種別"] = st.selectbox("物件種別", shubetsu_opts, index=idx)
        out["所有者住所"] = st.text_input("所有者 住所", data.get("所有者住所", ""))
        out["所有者氏名"] = st.text_input("所有者 氏名", data.get("所有者氏名", ""))
        out["登記名義人住所"] = st.text_input("登記名義人 住所", data.get("登記名義人住所", ""))
        out["登記名義人氏名"] = st.text_input("登記名義人 氏名", data.get("登記名義人氏名", ""))
    with c2:
        out["物件所在地"] = st.text_area("物件所在地", data.get("物件所在地", ""), height=80)
        out["抵当権"] = st.text_input("抵当権等（参考）", data.get("抵当権", ""))

    sel = out["物件種別"]
    if "マンション" in sel:
        m = data.get("マンション", {}) or {}
        st.markdown("**区分建物（マンション）の表示**")
        mc = st.columns(3)
        out["マンション"]["名称"] = mc[0].text_input("名称", m.get("名称", ""))
        out["マンション"]["構造"] = mc[1].text_input("構造", m.get("構造", ""))
        out["マンション"]["階建"] = mc[2].text_input("階建", m.get("階建", ""))
        out["マンション"]["階部分"] = mc[0].text_input("階部分", m.get("階部分", ""))
        out["マンション"]["専有面積"] = mc[1].text_input("専有面積", m.get("専有面積", ""))
        out["マンション"]["室番号"] = mc[2].text_input("室番号", m.get("室番号", ""))
        out["マンション"]["新築年月日"] = mc[0].text_input("新築年月日", m.get("新築年月日", ""))
        out["マンション"]["敷地権割合"] = mc[1].text_input("敷地権割合", m.get("敷地権割合", ""))
    else:
        t = data.get("土地", {}) or {}
        b = data.get("建物", {}) or {}
        if "土地" in sel:
            st.markdown("**土地の表示**")
            tc = st.columns(4)
            out["土地"]["地番"] = tc[0].text_input("地番", t.get("地番", ""))
            out["土地"]["地目"] = tc[1].text_input("地目", t.get("地目", ""))
            out["土地"]["地積"] = tc[2].text_input("地積", t.get("地積", ""))
            out["土地"]["権利"] = tc[3].text_input("権利", t.get("権利", "所有権"))
        if "建物" in sel:
            st.markdown("**建物の表示**")
            bc = st.columns(3)
            out["建物"]["家屋番号"] = bc[0].text_input("家屋番号", b.get("家屋番号", ""))
            out["建物"]["種類"] = bc[1].text_input("種類", b.get("種類", ""))
            out["建物"]["新築年月日"] = bc[2].text_input("新築年月日 ", b.get("新築年月日", ""))
            out["建物"]["構造"] = bc[0].text_input("構造", b.get("構造", ""))
            out["建物"]["床面積"] = bc[1].text_input("床面積", b.get("床面積", ""))
            out["建物"]["延床面積"] = bc[2].text_input("延床面積", b.get("延床面積", ""))
    return out


def _contract_terms_form(otsu: dict, ryutsu_name: str) -> dict:
    """契約条件（甲・日付・有効期間・媒介価格・特約 等）の入力フォーム。"""
    st.markdown("**依頼者（甲）**")
    kc = st.columns(4)
    kou = {
        "氏名": kc[0].text_input("甲 氏名", ""),
        "住所": kc[1].text_input("甲 住所", ""),
        "郵便": kc[2].text_input("甲 〒", ""),
        "TEL": kc[3].text_input("甲 TEL", ""),
    }

    st.markdown("**契約・期間・報酬**")
    cc = st.columns(4)
    irai = cc[0].selectbox("依頼の内容", ["売却", "購入", "交換"])
    date = cc[1].text_input("契約日", "令和　年　月　日")
    term_months = cc[2].text_input("有効期間（ヶ月）", "3")
    term_until = cc[3].text_input("満了日", "")

    pc = st.columns(3)
    price = pc[0].number_input("媒介価格 総額（円）", min_value=0, step=100_000, value=0)
    honbody = pc[1].number_input("うち本体価格（税抜・円）", min_value=0, step=100_000, value=int(price))
    tax = pc[2].number_input("うち消費税等（円）", min_value=0, step=10_000, value=max(0, int(price) - int(honbody)))

    base_price = int(honbody or price)
    reward, reward_tax = _calc_reward(base_price)
    rc = st.columns(3)
    reward = rc[0].number_input(
        "約定報酬（税抜・円）", min_value=0, step=1_000, value=reward,
        help="800万円以下は低廉な空家等の特例で一律30万円（税込33万円）。"
             "800万円超は速算式（価格×3%＋6万円）で自動計算。手修正可。")
    reward_tax = rc[1].number_input("報酬の消費税等（円）", min_value=0, step=1_000, value=reward_tax)
    rc[2].metric("報酬総額（税込）", f"{reward + reward_tax:,} 円")
    if 0 < base_price <= LOW_PRICE_LIMIT:
        rc[2].caption("※低廉な空家等の特例（800万円以下→上限33万円税込）を適用")

    oc = st.columns(2)
    inspection = oc[0].selectbox("建物状況調査のあっせん", ["無", "有"])
    ryutsu_register = True
    if oc[1].checkbox("（一般媒介）指定流通機構に登録する", value=True):
        ryutsu_register = True
    else:
        ryutsu_register = False

    special = st.text_area("特約事項（1行＝1項。固定資産税台帳の閲覧委任は自動で1項目めに入ります）",
                           "", height=90)
    biko = st.text_input("別表 備考", "")

    return {
        "irai_naiyo": irai, "date": date,
        "kou": kou, "otsu": otsu, "ryutsu_name": ryutsu_name,
        "term_months": term_months, "term_until": term_until,
        "baikai_price": int(price), "baikai_honbody": int(honbody), "baikai_tax": int(tax),
        "reward": int(reward), "reward_tax": int(reward_tax),
        "inspection": inspection, "ryutsu_register": ryutsu_register,
        "special_terms": special, "biko": biko,
    }


if __name__ == "__main__":
    main()
