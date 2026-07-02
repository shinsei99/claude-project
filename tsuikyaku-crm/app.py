# -*- coding: utf-8 -*-
"""顧客追客マネージャー

飲食・医療・エステ・塾など「出店したいテナント需要客」688件を種に、
- いつ・誰に・どう営業したか（対応履歴）を記録し
- 次に追客すべき先を一覧化、
- eFAXで一括FAX追客、
- 社内の担当割当と担当別ビュー
を行う業務支援アプリ。データは SQLite に永続化（共有フォルダ/LAN運用可）。
"""

from datetime import date, datetime

import pandas as pd
import streamlit as st

import db
from services import fax

st.set_page_config(page_title="顧客追客マネージャー", page_icon="📇", layout="wide")
db.init_db()


# ============================================================ データアクセス
def fetch_customers(where="", params=()):
    conn = db.connect()
    rows = conn.execute(
        f"SELECT * FROM customers {where} ", params
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_customer(cid):
    conn = db.connect()
    r = conn.execute("SELECT * FROM customers WHERE id=?", (cid,)).fetchone()
    conn.close()
    return dict(r) if r else None


def update_customer(cid, fields: dict):
    if not fields:
        return
    fields["updated_at"] = db.now()
    cols = ", ".join(f"{k}=?" for k in fields)
    conn = db.connect()
    conn.execute(f"UPDATE customers SET {cols} WHERE id=?",
                 (*fields.values(), cid))
    conn.commit()
    conn.close()


def insert_customer(fields: dict) -> int:
    fields.setdefault("created_at", db.now())
    fields.setdefault("updated_at", db.now())
    cols = ", ".join(fields)
    ph = ", ".join("?" for _ in fields)
    conn = db.connect()
    cur = conn.execute(f"INSERT INTO customers ({cols}) VALUES ({ph})",
                       tuple(fields.values()))
    conn.commit()
    cid = cur.lastrowid
    conn.close()
    return cid


def add_history(customer_id, 種別, 担当, 結果="", 次回="", メモ="", broadcast_id=None):
    conn = db.connect()
    conn.execute(
        """INSERT INTO contact_history
           (customer_id,日付,種別,担当,結果,次回追客日,メモ,broadcast_id,created_at)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (customer_id, date.today().isoformat(), 種別, 担当, 結果, 次回, メモ,
         broadcast_id, db.now()),
    )
    conn.commit()
    conn.close()


def delete_customer(cid):
    conn = db.connect()
    conn.execute("DELETE FROM customers WHERE id=?", (cid,))
    conn.commit()
    conn.close()


def duplicate_groups():
    """FAX または メール が一致する顧客を連結して重複グループを返す。

    戻り値: [{"members":[顧客dict,...], "faxes":[被ったFAX], "emails":[被ったメール]}, ...]
    同じ会社がFAX/メール違いで繋がる場合も1グループにまとめる（Union-Find）。
    """
    conn = db.connect()
    rows = [dict(r) for r in conn.execute(
        "SELECT id,重要度,区分,種別,会社名,店名,社内担当,status,fax,fax_dial,メール "
        "FROM customers ORDER BY id")]
    conn.close()

    parent = {r["id"]: r["id"] for r in rows}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        parent[find(a)] = find(b)

    # 同じキー(FAX発信番号 / 正規化メール)を持つ者同士を連結
    for key_field, norm in (("fax_dial", lambda v: v.strip()),
                            ("メール", lambda v: v.strip().lower())):
        buckets = {}
        for r in rows:
            v = norm(r.get(key_field) or "")
            if v:
                buckets.setdefault(v, []).append(r["id"])
        for ids in buckets.values():
            for other in ids[1:]:
                union(ids[0], other)

    by_id = {r["id"]: r for r in rows}
    comps = {}
    for rid in parent:
        comps.setdefault(find(rid), []).append(rid)

    groups = []
    for member_ids in comps.values():
        if len(member_ids) < 2:
            continue
        members = [by_id[i] for i in sorted(member_ids)]
        # このグループ内で複数人が共有しているFAX/メールを抽出
        from collections import Counter
        fax_c = Counter(m["fax_dial"] for m in members if m["fax_dial"])
        mail_c = Counter((m["メール"] or "").strip().lower()
                         for m in members if (m["メール"] or "").strip())
        groups.append({
            "members": members,
            "faxes": [f for f, n in fax_c.items() if n > 1],
            "emails": [e for e, n in mail_c.items() if n > 1],
        })
    groups.sort(key=lambda g: -len(g["members"]))
    return groups


def duplicate_id_set():
    """重複に含まれる顧客IDの集合。"""
    ids = set()
    for g in duplicate_groups():
        ids.update(m["id"] for m in g["members"])
    return ids


def get_history(customer_id):
    conn = db.connect()
    rows = conn.execute(
        "SELECT * FROM contact_history WHERE customer_id=? ORDER BY 日付 DESC, id DESC",
        (customer_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _log_broadcast(subject, body, total, ok, method, me, sent_rows,
                   also_next, next_days):
    """一括FAXのロット記録＋各社の対応履歴＋次回追客日更新。"""
    from datetime import timedelta
    conn = db.connect()
    cur = conn.execute(
        """INSERT INTO fax_broadcasts
           (日時,担当,件名,本文,対象件数,成功件数,方式,メモ)
           VALUES (?,?,?,?,?,?,?,?)""",
        (db.now(), me, subject, body, total, ok, method, ""))
    bid = cur.lastrowid
    conn.commit()
    conn.close()
    nxt = (date.today() + timedelta(days=int(next_days))).isoformat() if also_next else ""
    for r in sent_rows:
        add_history(r["id"], "一括FAX", me, f"件名:{subject}", nxt, "", broadcast_id=bid)
        upd = {}
        if also_next:
            upd["次回追客日"] = nxt
        if (r.get("status") or "未接触") == "未接触":
            upd["status"] = "追客中"
        if upd:
            update_customer(r["id"], upd)


def distinct_values(col):
    conn = db.connect()
    rows = conn.execute(
        f"SELECT DISTINCT {col} v FROM customers WHERE {col}<>'' ORDER BY {col}"
    ).fetchall()
    conn.close()
    return [r["v"] for r in rows]


def size_selectbox(label, current, key=None):
    """希望坪数の選択肢（小/中/大規模）。既存の自由記入値があれば保持して選べるようにする。"""
    opts = ["（未設定）"] + db.SIZE
    if current and current not in db.SIZE:
        opts = ["（未設定）", current] + db.SIZE      # 旧データ（例 20～50坪）も残す
    idx = opts.index(current) if current in opts else 0
    val = st.selectbox(label, opts, index=idx, key=key,
                       help="小規模=20坪以下 / 中規模=50坪以下 / 大規模=それ以上")
    return "" if val == "（未設定）" else val


# ============================================================ 共通フィルタUI
def filter_ui(key_prefix, default_mine=False):
    """絞り込みUIを描画し、条件に合う顧客リストを返す。"""
    me = st.session_state.get("me", "")
    c1, c2, c3 = st.columns(3)
    with c1:
        kubun = st.multiselect("区分", db.KUBUN, key=f"{key_prefix}_kubun")
        juyodo = st.multiselect("重要度", db.IMPORTANCE, key=f"{key_prefix}_juyodo")
        status = st.multiselect("ステータス", db.STATUS, key=f"{key_prefix}_status")
    with c2:
        shubetsu = st.multiselect("種別（大枠）", distinct_values("種別"),
                                  key=f"{key_prefix}_shubetsu")
        detail = st.multiselect("詳細種別（ラーメン・医院 等）",
                                distinct_values("詳細種別"),
                                key=f"{key_prefix}_detail")
        staff_opts = ["（全員）", "（未割当）"] + db.list_staff()
        default_idx = staff_opts.index(me) if (default_mine and me in staff_opts) else 0
        tantou = st.selectbox("社内担当", staff_opts, index=default_idx,
                              key=f"{key_prefix}_tantou")
    with c3:
        size = st.multiselect("希望坪数（規模）", db.SIZE,
                              key=f"{key_prefix}_size")
        kw = st.text_input("キーワード（会社名・店名・種別・備考）",
                           key=f"{key_prefix}_kw")
        fax_only = st.checkbox("FAX番号がある先だけ", key=f"{key_prefix}_faxonly")

    where, params = ["1=1"], []
    if kubun:
        where.append(f"区分 IN ({','.join('?'*len(kubun))})"); params += kubun
    if juyodo:
        where.append(f"重要度 IN ({','.join('?'*len(juyodo))})"); params += juyodo
    if status:
        where.append(f"status IN ({','.join('?'*len(status))})"); params += status
    if shubetsu:
        where.append(f"種別 IN ({','.join('?'*len(shubetsu))})"); params += shubetsu
    if detail:
        where.append(f"詳細種別 IN ({','.join('?'*len(detail))})"); params += detail
    if size:
        where.append(f"希望坪数 IN ({','.join('?'*len(size))})"); params += size
    if tantou == "（未割当）":
        where.append("(社内担当 IS NULL OR 社内担当='')")
    elif tantou != "（全員）":
        where.append("社内担当=?"); params.append(tantou)
    if kw:
        where.append("(会社名 LIKE ? OR 店名 LIKE ? OR 種別 LIKE ? "
                     "OR 詳細種別 LIKE ? OR 備考 LIKE ?)")
        params += [f"%{kw}%"] * 5
    if fax_only:
        where.append("fax_dial<>''")
    rows = fetch_customers("WHERE " + " AND ".join(where), tuple(params))
    return rows


def customer_table(rows):
    df = pd.DataFrame(rows)
    if df.empty:
        st.info("該当する顧客がいません。")
        return df
    view = df[["id", "重要度", "区分", "種別", "詳細種別", "会社名", "店名",
               "社内担当", "status", "次回追客日", "tel", "fax",
               "希望エリア", "希望坪数", "希望坪数詳細", "希望物件"]]
    st.dataframe(view, use_container_width=True, hide_index=True, height=380)
    return df


def render_pager(npages, page, suffix, with_jump=False):
    """ページ移動UI。<< >> と先頭/末尾、上部のみ番号入力での直接移動。"""
    def goto(p):
        st.session_state["list_page_num"] = max(1, min(int(p), npages))
        st.rerun()

    cols = st.columns([1, 1, 2.2, 1, 1], vertical_alignment="center")
    if cols[0].button("|< 先頭", key=f"first_{suffix}", disabled=page <= 1,
                      use_container_width=True):
        goto(1)
    if cols[1].button("<< 前", key=f"prev_{suffix}", disabled=page <= 1,
                      use_container_width=True):
        goto(page - 1)
    if with_jump:
        newp = cols[2].number_input(
            f"ページ（1〜{npages}）を入力", 1, npages, page,
            label_visibility="collapsed")
        if int(newp) != page:
            goto(newp)
    else:
        cols[2].markdown(
            f"<div style='text-align:center;font-weight:600'>{page} / {npages} ページ</div>",
            unsafe_allow_html=True)
    if cols[3].button("次 >>", key=f"next_{suffix}", disabled=page >= npages,
                      use_container_width=True):
        goto(page + 1)
    if cols[4].button("末尾 >|", key=f"last_{suffix}", disabled=page >= npages,
                      use_container_width=True):
        goto(npages)


def open_detail(cid):
    # 顧客詳細は独立メニューにせず、顧客一覧の中で表示する。
    # 一覧ページへ遷移し（_goto）、詳細表示フラグ show_detail を立てる。
    # nav は radio のキーなのでウィジェット生成前(_goto)にしか書き換えられない。
    st.session_state["detail_id"] = int(cid)
    st.session_state["show_detail"] = True
    st.session_state["_goto"] = "👥 顧客一覧・検索"


def build_sender_info(person=""):
    """設定済みの自社情報＋選択した担当者名で差出人ブロック（文面末尾）を組み立てる。

    person: 差出人に入れる担当者名（空なら担当行を入れない）。担当者マスタから選ぶ。
    """
    g = db.get_setting
    lines = []
    if g("sender_company", ""):
        lines.append(g("sender_company", ""))
    if g("sender_addr", ""):
        lines.append(g("sender_addr", ""))
    if person:
        lines.append(f"担当：{person}")
    tel, fax_ = g("sender_tel", ""), g("sender_fax", "")
    tf = " / ".join(x for x in [f"TEL {tel}" if tel else "",
                                f"FAX {fax_}" if fax_ else ""] if x)
    if tf:
        lines.append(tf)
    if g("sender_mail", ""):
        lines.append(g("sender_mail", ""))
    return "\n".join(lines)


def render_detail():
    """顧客詳細・追客記録。顧客一覧から「開く」で呼ばれる（独立メニューは持たない）。"""
    if st.button("← 顧客一覧に戻る"):
        st.session_state["show_detail"] = False
        st.rerun()
    st.header("📇 顧客詳細・追客記録")

    all_cust = fetch_customers("ORDER BY 会社名, 店名")
    if not all_cust:
        st.info("顧客がいません。「顧客追加」から追加してください。"); return

    ids = [r["id"] for r in all_cust]
    name_map = {r["id"]: f"[{r['id']}] {r['会社名']}"
                         f"{'（'+r['店名']+'）' if r['店名'] else ''}"
                         f"　{r['種別'] or ''}"
                for r in all_cust}
    cur = st.session_state.get("detail_id")
    if cur not in ids:
        cur = ids[0]
    cid = st.selectbox("顧客を選ぶ（会社名・店名で検索できます）", ids,
                       index=ids.index(cur),
                       format_func=lambda i: name_map.get(i, str(i)))
    st.session_state["detail_id"] = cid

    c = get_customer(cid)
    if not c:
        st.error("顧客が見つかりません。"); return

    st.subheader(f"[{c['id']}] {c['会社名']}　{c['店名'] or ''}")
    tags = " / ".join(x for x in [c["区分"], c["種別"], c["企業規模"]] if x)
    st.caption(tags)

    colL, colR = st.columns([1, 1])

    # ---- 基本情報の編集 ----
    with colL:
        st.markdown("##### 基本情報 / 追客ステータス")
        with st.form("edit_basic"):
            区分 = st.selectbox("区分", db.KUBUN,
                               index=db.KUBUN.index(c["区分"]) if c["区分"] in db.KUBUN else 0)
            重要度 = st.selectbox("重要度", db.IMPORTANCE,
                                 index=db.IMPORTANCE.index(c["重要度"]) if c["重要度"] in db.IMPORTANCE else 0)
            if c["区分"] == "住居":
                _sh = c["種別"] if c["種別"] in db.JUKYO_SHUBETSU else db.JUKYO_SHUBETSU[0]
                種別 = st.selectbox("種別（住居：売買/賃貸）", db.JUKYO_SHUBETSU,
                                   index=db.JUKYO_SHUBETSU.index(_sh))
            elif c["区分"] == "店舗":
                _sh = c["種別"] if c["種別"] in db.BIG_SHUBETSU else db.BIG_SHUBETSU[-1]
                種別 = st.selectbox("種別（大枠：飲食/物販/サービス/その他）",
                                   db.BIG_SHUBETSU, index=db.BIG_SHUBETSU.index(_sh))
            else:
                種別 = st.text_input("種別", c["種別"] or "")
            詳細種別 = st.text_input("詳細種別（業種の詳細）", c["詳細種別"] or "")
            status = st.selectbox("ステータス", db.STATUS,
                                  index=db.STATUS.index(c["status"]) if c["status"] in db.STATUS else 0)
            staff_opts = ["（未割当）"] + db.list_staff()
            cur_t = c["社内担当"] if c["社内担当"] in staff_opts else "（未割当）"
            社内担当 = st.selectbox("社内担当", staff_opts,
                                  index=staff_opts.index(cur_t))
            has_next = bool(c["次回追客日"])
            set_next = st.checkbox("次回追客日を設定", value=has_next)
            次回 = st.date_input("次回追客日",
                                value=date.fromisoformat(c["次回追客日"]) if has_next else date.today(),
                                disabled=not set_next)
            tel = st.text_input("TEL", c["tel"] or "")
            fax_disp = st.text_input("FAX（表示）", c["fax"] or "")
            fax_dial = st.text_input("FAX発信番号（数字のみ）", c["fax_dial"] or "",
                                     help="一括FAXはこの番号を使います")
            希望エリア = st.text_input("希望エリア", c["希望エリア"] or "")
            希望坪数 = size_selectbox("希望坪数（規模）", c["希望坪数"] or "")
            希望坪数詳細 = st.text_input("希望坪数詳細（例 20～50坪）",
                                       c["希望坪数詳細"] or "")
            希望物件 = st.text_input("希望物件（特定の物件を希望している場合）",
                                    c["希望物件"] or "")
            先方担当 = st.text_input("先方担当者", c["先方担当"] or "")
            備考 = st.text_area("備考", c["備考"] or "", height=80)
            if st.form_submit_button("💾 保存", use_container_width=True):
                update_customer(cid, {
                    "区分": 区分, "重要度": 重要度, "種別": 種別,
                    "詳細種別": 詳細種別, "status": status,
                    "社内担当": "" if 社内担当 == "（未割当）" else 社内担当,
                    "次回追客日": 次回.isoformat() if set_next else "",
                    "tel": tel, "fax": fax_disp, "fax_dial": fax_dial,
                    "希望エリア": 希望エリア, "希望坪数": 希望坪数,
                    "希望坪数詳細": 希望坪数詳細, "希望物件": 希望物件,
                    "先方担当": 先方担当, "備考": 備考,
                })
                st.success("保存しました。"); st.rerun()

    # ---- 追客記録＋履歴 ----
    with colR:
        st.markdown("##### ✍ 追客を記録する")
        me = st.session_state.get("me", "")
        with st.form("add_hist"):
            種別 = st.selectbox("対応種別", db.CONTACT_KINDS)
            結果 = st.text_input("結果（例：不在／資料送付／前向き／見送り）")
            メモ = st.text_area("メモ", height=70)
            set_n = st.checkbox("次回追客日を更新する", value=True)
            n_date = st.date_input("次回追客日", value=date.today())
            new_status = st.selectbox("ステータスを更新（任意）",
                                      ["（変更しない）"] + db.STATUS)
            rec_by = st.text_input("記録者", me)
            if st.form_submit_button("＋ 記録する", use_container_width=True):
                nxt = n_date.isoformat() if set_n else ""
                add_history(cid, 種別, rec_by, 結果, nxt, メモ)
                upd = {}
                if set_n:
                    upd["次回追客日"] = nxt
                if new_status != "（変更しない）":
                    upd["status"] = new_status
                elif c["status"] == "未接触":
                    upd["status"] = "追客中"          # 初回接触で自動的に追客中へ
                update_customer(cid, upd)
                st.success("記録しました。"); st.rerun()

        st.markdown("##### 🕘 対応履歴")
        hist = get_history(cid)
        if not hist:
            st.caption("まだ履歴がありません。")
        for h in hist:
            icon = "📠" if "FAX" in (h["種別"] or "") else "📝"
            line = f"**{h['日付']}** {icon} {h['種別']}"
            if h["担当"]:
                line += f'（{h["担当"]}）'
            st.markdown(line)
            detail = " ".join(x for x in [h["結果"], h["メモ"]] if x)
            if detail:
                st.caption(detail)


# ============================================================ サイドバー
st.sidebar.title("📇 顧客追客マネージャー")

staff = db.list_staff()
if staff:
    me = st.sidebar.selectbox("👤 あなたは？（記録者）", ["（未選択）"] + staff,
                              key="me_select")
    st.session_state["me"] = "" if me == "（未選択）" else me
else:
    st.sidebar.info("設定で担当者を登録してください。")
    st.session_state["me"] = ""

PAGES = ["🏠 ダッシュボード", "➕ 顧客追加", "👥 顧客一覧・検索",
         "🔁 重複チェック", "📠 一括FAX追客", "⚙️ 設定"]
# 「開く」ボタン等からの遷移指示を、radio 生成前にここで反映する
if "_goto" in st.session_state:
    st.session_state["nav"] = st.session_state.pop("_goto")


def _on_nav_change():
    # サイドバーで手動でメニューを選んだら詳細表示を解除して一覧に戻す
    st.session_state["show_detail"] = False


nav = st.sidebar.radio("メニュー", PAGES, key="nav", on_change=_on_nav_change)

conn = db.connect()
total = conn.execute("SELECT COUNT(*) c FROM customers").fetchone()["c"]
conn.close()
st.sidebar.caption(f"登録顧客 {total} 件")


# ============================================================ ダッシュボード
if nav == "🏠 ダッシュボード":
    st.header("🏠 ダッシュボード")
    today = date.today().isoformat()
    me = st.session_state.get("me", "")

    conn = db.connect()

    def scalar(q, p=()):
        return conn.execute(q, p).fetchone()[0]

    active = "status NOT IN ('成約','見送り')"
    m = st.columns(5)
    m[0].metric("総顧客数", total)
    m[1].metric("未接触", scalar("SELECT COUNT(*) FROM customers WHERE status='未接触'"))
    m[2].metric("追客中", scalar("SELECT COUNT(*) FROM customers WHERE status='追客中'"))
    m[3].metric("商談中", scalar("SELECT COUNT(*) FROM customers WHERE status='商談中'"))
    overdue = scalar(
        f"SELECT COUNT(*) FROM customers WHERE 次回追客日<>'' AND 次回追客日<=? AND {active}",
        (today,))
    m[4].metric("⏰ 要追客（期限到来）", overdue)
    conn.close()

    st.divider()
    only_mine = st.checkbox("自分の担当分だけ表示", value=bool(me),
                            disabled=not me)
    where = [f"次回追客日<>'' AND 次回追客日<=? AND {active}"]
    params = [today]
    if only_mine and me:
        where.append("社内担当=?"); params.append(me)
    order = ("ORDER BY CASE 重要度 WHEN '高' THEN 0 WHEN '中' THEN 1 ELSE 2 END,"
             " 次回追客日")
    todo = fetch_customers("WHERE " + " AND ".join(where) + " " + order,
                           tuple(params))
    st.subheader(f"⏰ 今日までに追客すべき先（{len(todo)}件）")
    if todo:
        df = pd.DataFrame(todo)[["id", "重要度", "次回追客日", "会社名", "店名",
                                 "種別", "社内担当", "status", "tel", "fax"]]
        st.dataframe(df, use_container_width=True, hide_index=True)
        cid = st.selectbox("開く顧客", [t["id"] for t in todo],
                           format_func=lambda i: next(f"{t['会社名']} {t['店名']}"
                                                      for t in todo if t["id"] == i))
        if st.button("▶ この顧客の詳細を開く"):
            open_detail(cid); st.rerun()
    else:
        st.success("追客期限が来ている先はありません。")

    st.divider()
    st.subheader("最近の対応履歴")
    conn = db.connect()
    recent = conn.execute(
        """SELECT h.日付,h.種別,h.担当,h.結果,c.会社名,c.店名
           FROM contact_history h JOIN customers c ON c.id=h.customer_id
           ORDER BY h.id DESC LIMIT 15""").fetchall()
    conn.close()
    if recent:
        st.dataframe(pd.DataFrame([dict(r) for r in recent]),
                     use_container_width=True, hide_index=True)
    else:
        st.caption("まだ対応履歴がありません。顧客詳細から記録できます。")


# ============================================================ 顧客一覧・検索
elif nav == "👥 顧客一覧・検索":
    if st.session_state.get("show_detail") and st.session_state.get("detail_id"):
        render_detail()                         # 一覧から開いた顧客の詳細を表示
    else:
        st.header("👥 顧客一覧・検索")
        rows = filter_ui("list")
        dup_only = st.checkbox("🔁 重複（FAX・メール被り）だけ表示")
        if dup_only:
            dup_ids = duplicate_id_set()
            rows = [r for r in rows if r["id"] in dup_ids]
        st.caption(f"{len(rows)} 件ヒット")
        if not rows:
            st.info("該当する顧客がいません。")
        else:
            # ページング（1ページ50件）
            PAGE = 50
            npages = (len(rows) + PAGE - 1) // PAGE
            page = max(1, min(st.session_state.get("list_page_num", 1), npages))
            st.session_state["list_page_num"] = page
            if npages > 1:
                render_pager(npages, page, "top", with_jump=True)
            page_rows = rows[(page - 1) * PAGE: page * PAGE]

            widths = [0.6, 1.1, 0.7, 2.2, 3.0, 1.2, 1.3, 1.7]
            head = st.columns(widths, vertical_alignment="center")
            for col, txt in zip(head, ["ID", "詳細", "重要", "区分/種別",
                                       "会社名・店名", "状態", "次回追客", "FAX"]):
                col.markdown(f"**{txt}**")
            for r in page_rows:
                c = st.columns(widths, vertical_alignment="center")
                c[0].write(f"[{r['id']}]")
                if c[1].button("詳細", key=f"open_{r['id']}",
                               use_container_width=True):
                    open_detail(r["id"]); st.rerun()
                c[2].write(r["重要度"] or "")
                c[3].write(f"{r['区分']}/{r['種別'] or ''}")
                c[4].write(f"{r['会社名']} {r['店名'] or ''}".strip())
                c[5].write(r["status"] or "")
                c[6].write(r["次回追客日"] or "")
                c[7].write(r["fax"] or "")

            if npages > 1:
                st.write("")
                render_pager(npages, page, "bottom")

            with st.expander("▼ 全項目をテーブル表示 / CSV書き出し"):
                df = customer_table(rows)
                if not df.empty:
                    st.download_button(
                        "⬇ この一覧をCSVで書き出し",
                        df.to_csv(index=False).encode("utf-8-sig"),
                        "customers.csv", "text/csv")


# ============================================================ 重複チェック
elif nav == "🔁 重複チェック":
    st.header("🔁 重複チェック（FAX・メール被り）")
    st.caption("FAX発信番号 または メールアドレスが一致する顧客を重複候補として表示します。"
               "※同じ会社の別ブランド（本社FAX共通）が混じることがあるので、"
               "中身を見て不要な行だけ削除してください。")

    groups = duplicate_groups()
    total_dup = sum(len(g["members"]) for g in groups)
    c1, c2 = st.columns(2)
    c1.metric("重複グループ", f"{len(groups)} 組")
    c2.metric("重複に含まれる顧客", f"{total_dup} 件")

    if not groups:
        st.success("FAX・メールが被る顧客はありません。")
    for gi, g in enumerate(groups):
        keys = []
        if g["faxes"]:
            keys.append("FAX " + " / ".join(g["faxes"]))
        if g["emails"]:
            keys.append("メール " + " / ".join(g["emails"]))
        with st.expander(f"重複{gi+1}: {'／'.join(keys)}　"
                         f"（{len(g['members'])}件）", expanded=gi < 5):
            for m in g["members"]:
                cols = st.columns([5, 1, 1])
                label = (f"[{m['id']}] **{m['会社名']}**"
                         f"{'（'+m['店名']+'）' if m['店名'] else ''}"
                         f"　{m['種別'] or ''}　FAX:{m['fax'] or '―'}"
                         f"　{('メール:'+m['メール']) if m['メール'] else ''}"
                         f"　[{m['status']}]")
                cols[0].markdown(label)
                if cols[1].button("開く", key=f"dup_open_{m['id']}"):
                    open_detail(m["id"]); st.rerun()
                if cols[2].button("🗑 削除", key=f"dup_del_{m['id']}"):
                    delete_customer(m["id"])
                    st.warning(f"[{m['id']}] {m['会社名']} を削除しました。")
                    st.rerun()


# ============================================================ 一括FAX追客
elif nav == "📠 一括FAX追客":
    st.header("📠 一括FAX追客")
    st.caption("対象を絞り込み → 文面を作成 → eFAX送信 or 送付リスト出力。"
               "送った先は自動で対応履歴に『一括FAX』として記録されます。")

    st.markdown("#### 1. 送付対象を絞り込む")
    rows = filter_ui("fax")
    has_fax = [r for r in rows if r["fax_dial"]]
    no_fax = len(rows) - len(has_fax)
    # 同一FAX番号は1回だけ送る（重複排除）
    with_fax, seen = [], set()
    for r in has_fax:
        if r["fax_dial"] not in seen:
            seen.add(r["fax_dial"]); with_fax.append(r)
    merged = len(has_fax) - len(with_fax)
    st.info(f"ヒット {len(rows)} 件中、FAX番号あり **{len(with_fax)} 件**"
            + (f"（FAX番号なし {no_fax} 件は除外）" if no_fax else "")
            + (f"／同一FAX番号 {merged} 件を重複排除" if merged else ""))

    # 差出人の担当者（都度、担当者マスタから選択。空なら担当行なし）
    _p = st.session_state.get("fax_sender_person_sel", "（担当者を入れない）")
    person_name = "" if _p == "（担当者を入れない）" else _p
    sender_info = build_sender_info(person_name)

    selected = with_fax
    if with_fax:
        st.markdown("##### 送信先を選択（全選択／全解除・チェックで個別選択）")
        # 絞り込み結果が変わったら選択状態をリセット
        sig = tuple(r["id"] for r in with_fax)
        if st.session_state.get("fax_sig") != sig:
            st.session_state["fax_sig"] = sig
            st.session_state.pop("fax_editor", None)
            st.session_state.pop("fax_default", None)

        b1, b2, b3 = st.columns([1, 1, 4])
        if b1.button("✅ 全選択", use_container_width=True):
            st.session_state["fax_default"] = True
            st.session_state.pop("fax_editor", None); st.rerun()
        if b2.button("⬜ 全解除", use_container_width=True):
            st.session_state["fax_default"] = False
            st.session_state.pop("fax_editor", None); st.rerun()

        default_sel = st.session_state.get("fax_default", True)
        base_df = pd.DataFrame([{
            "送信": default_sel, "担当者名": False, "id": r["id"],
            "重要度": r["重要度"], "区分": r["区分"], "種別": r["種別"],
            "詳細種別": r["詳細種別"], "会社名": r["会社名"],
            "先方担当": r["先方担当"], "希望物件": r["希望物件"],
            "FAX番号": r["fax_dial"],
        } for r in with_fax])
        locked = [c for c in base_df.columns if c not in ("送信", "担当者名")]
        edited = st.data_editor(
            base_df, key="fax_editor", hide_index=True,
            use_container_width=True, height=320,
            column_config={
                "送信": st.column_config.CheckboxColumn("送信", default=True),
                "担当者名": st.column_config.CheckboxColumn(
                    "担当者名", default=False,
                    help="ONにすると宛名にその先の担当者名を入れます（既定は『ご担当者様』）"),
            },
            disabled=locked)
        sel_ids = set(edited[edited["送信"]]["id"].tolist())
        usename = dict(zip(edited["id"], edited["担当者名"]))
        selected = []
        for r in with_fax:
            if r["id"] in sel_ids:
                name = (r["先方担当"] or "").strip()
                atena = f"{name} 様" if (usename.get(r["id"]) and name) else "ご担当者様"
                selected.append({**r, "宛名": atena, "自社情報": sender_info})
        b3.markdown(f"### 選択中: {len(selected)} / {len(with_fax)} 件")

    st.markdown("#### 2. 文面を作成")
    # 区分別の文面テンプレート（店舗・事務所は共通、住居/駐車場/収益は専用）
    FAX_TEMPLATES = {
        "店舗・事務所": {
            "subject": "テナント物件のご案内",
            "body": (
                "{会社名}\n"
                "{宛名}\n\n"
                "いつもお世話になっております。\n"
                "貴社のご出店条件に合致しそうなテナント物件が出ましたのでご案内いたします。\n"
                "ご興味ございましたらお気軽にご連絡ください。\n\n"
                "――――――――――――――――\n"
                "{自社情報}\n"),
        },
        "住居": {
            "subject": "住居物件のご案内",
            "body": (
                "{会社名}\n"
                "{宛名}\n\n"
                "いつもお世話になっております。\n"
                "ご希望の条件に合いそうな住居物件（{種別}）のご紹介です。\n"
                "ご検討いただけますようご案内申し上げます。\n"
                "ご興味がございましたらお気軽にご連絡ください。\n\n"
                "――――――――――――――――\n"
                "{自社情報}\n"),
        },
        "駐車場": {
            "subject": "駐車場のご案内",
            "body": (
                "{会社名}\n"
                "{宛名}\n\n"
                "いつもお世話になっております。\n"
                "ご希望エリア（{希望エリア}）で駐車場の空きが出ましたのでご案内いたします。\n"
                "ご興味がございましたらお気軽にご連絡ください。\n\n"
                "――――――――――――――――\n"
                "{自社情報}\n"),
        },
        "収益": {
            "subject": "収益物件のご案内",
            "body": (
                "{会社名}\n"
                "{宛名}\n\n"
                "いつもお世話になっております。\n"
                "ご投資条件に合致しそうな収益物件が出ましたのでご案内いたします。\n"
                "利回り・価格等の詳細資料をご用意しております。\n"
                "ご興味がございましたらお気軽にご連絡ください。\n\n"
                "――――――――――――――――\n"
                "{自社情報}\n"),
        },
    }
    tmpl_names = list(FAX_TEMPLATES.keys())

    # 絞り込んだ区分から既定テンプレートを推定（区分が変わったら自動で切替＆本文リセット）
    kubun_sel = st.session_state.get("fax_kubun", [])
    if kubun_sel == ["住居"]:
        guess = "住居"
    elif kubun_sel == ["駐車場"]:
        guess = "駐車場"
    elif kubun_sel == ["収益"]:
        guess = "収益"
    else:
        guess = "店舗・事務所"
    if st.session_state.get("fax_kubun_sig") != tuple(kubun_sel):
        st.session_state["fax_kubun_sig"] = tuple(kubun_sel)
        st.session_state["fax_tmpl_select"] = guess
        st.session_state["fax_subject"] = FAX_TEMPLATES[guess]["subject"]
        st.session_state["fax_body"] = FAX_TEMPLATES[guess]["body"]

    tmpl = st.selectbox("文面テンプレート（区分別）", tmpl_names, key="fax_tmpl_select")
    # テンプレートを手動で切り替えたら件名・本文を差し替え
    if st.session_state.get("fax_applied_tmpl") != tmpl:
        st.session_state["fax_applied_tmpl"] = tmpl
        st.session_state["fax_subject"] = FAX_TEMPLATES[tmpl]["subject"]
        st.session_state["fax_body"] = FAX_TEMPLATES[tmpl]["body"]

    st.caption("差し込みタグ: {会社名} {宛名}（既定『ご担当者様』／表で担当者名ONの先はその名前）"
               " {種別} {希望エリア} {希望坪数}")
    subject = st.text_input("件名", key="fax_subject")
    body = st.text_area("本文", key="fax_body", height=240)
    if selected:
        with st.expander("▶ 選択先の先頭1件でプレビュー"):
            st.text(fax._fill(body, selected[0]))

    up = st.file_uploader("添付する物件資料（PDF・任意）", type=["pdf"])
    attachment = None
    if up is not None:
        attachment = (up.name, up.read(), "pdf")

    st.markdown("#### 3. 送信")
    _staff = db.list_staff()
    _opts = ["（担当者を入れない）"] + _staff
    if st.session_state.get("fax_sender_person_sel") not in _opts:
        st.session_state["fax_sender_person_sel"] = "（担当者を入れない）"
    st.selectbox("差出人の担当者（都度選択）", _opts, key="fax_sender_person_sel",
                 help="⚙️設定の担当者マスタから選べます。空にすると差出人に担当者名を入れません。")
    if not _staff:
        st.caption("※担当者は「⚙️ 設定 → 担当者マスタ」で登録できます。")
    ready = fax.smtp_ready()
    method = st.radio(
        "送信方法",
        ["eFAXメール送信（自動送信）", "送付リストCSVを書き出す（ポータル用）"],
        index=0 if ready else 1)
    if method.startswith("eFAX") and not ready:
        st.warning("SMTP/eFAXの設定が未登録です。⚙️設定で登録するか、CSV書き出しをご利用ください。")

    also_next = st.checkbox("送付先の次回追客日を設定する", value=True)
    next_days = st.number_input("何日後に設定するか", 1, 90, 14)

    st.caption(f"送信対象: 選択した {len(selected)} 件")

    # 実行 → 確認画面 → 確定送信 の2段階
    if not st.session_state.get("fax_confirm"):
        if st.button(f"🚀 選択した {len(selected)} 件に実行", type="primary",
                     disabled=not selected):
            st.session_state["fax_confirm"] = True
            st.rerun()
    else:
        st.markdown("### 📋 送信内容の確認")
        st.warning("以下の内容で送信します。よろしければ「この内容で送信する」を押してください。")
        is_efax = not method.startswith("送付リスト")
        with st.container(border=True):
            st.markdown(f"- **送信方法**: {method}")
            st.markdown(f"- **送信件数**: {len(selected)} 件")
            st.markdown(f"- **件名**: {subject}")
            st.markdown(f"- **差出人担当**: {person_name or '（なし）'}")
            if also_next:
                st.markdown(f"- **次回追客日**: 送付先に {next_days} 日後を設定")
            if attachment:
                st.markdown(f"- **添付**: {attachment[0]}")
            if selected:
                st.markdown("**本文プレビュー（先頭1件に差し込み後）**")
                st.text(fax._fill(body, selected[0]))
                st.markdown("**送信先一覧**")
                pv = pd.DataFrame(selected)[["id", "会社名", "fax_dial"]].copy()
                if is_efax:
                    pv["送信先アドレス"] = pv["fax_dial"].map(fax.gateway_address)
                st.dataframe(pv, use_container_width=True, hide_index=True, height=220)

        cc1, cc2 = st.columns(2)
        do_send = cc1.button("✅ この内容で送信する", type="primary",
                             use_container_width=True, disabled=not selected)
        if cc2.button("✖ キャンセル（戻る）", use_container_width=True):
            st.session_state["fax_confirm"] = False
            st.rerun()

        if do_send:
            st.session_state["fax_confirm"] = False
            me = st.session_state.get("me", "")
            if method.startswith("送付リスト"):
                data = fax.export_csv(selected, body)
                _log_broadcast(subject, body, len(selected), len(selected),
                               "エクスポート", me, selected, also_next, next_days)
                st.success(f"{len(selected)}件の送付リストを作成し、履歴に記録しました。")
                st.download_button("⬇ 送付リストCSVをダウンロード", data,
                                   "fax_broadcast.csv", "text/csv")
            else:
                with st.spinner("eFAXメール送信中…"):
                    results = fax.send_broadcast(selected, subject, body, attachment)
                ok = [r for r in results if r["ok"]]
                ng = [r for r in results if not r["ok"]]
                sent_rows = [r for r in selected if r["id"] in {x["id"] for x in ok}]
                _log_broadcast(subject, body, len(selected), len(ok),
                               "eFAXメール送信", me, sent_rows, also_next, next_days)
                st.success(f"送信成功 {len(ok)}件 / 失敗 {len(ng)}件。成功分を履歴に記録しました。")
                if ng:
                    st.error("失敗した先:")
                    st.dataframe(pd.DataFrame(ng)[["会社名", "fax_dial", "error"]],
                                 use_container_width=True, hide_index=True)

    st.divider()
    st.markdown("#### 差出人（自社情報）の設定")
    st.caption("項目ごとに入力して保存すると、文面末尾の {自社情報} に差し込まれます（次回以降も使用）。")
    st.caption("担当者は上の「差出人の担当者」で都度選びます（担当者マスタは⚙️設定で登録）。")
    with st.form("sender_info_form"):
        sc1, sc2 = st.columns(2)
        with sc1:
            v_company = st.text_input("会社名", db.get_setting("sender_company", ""))
            v_addr = st.text_input("住所", db.get_setting("sender_addr", ""))
            v_mail = st.text_input("メール", db.get_setting("sender_mail", ""))
        with sc2:
            v_tel = st.text_input("TEL", db.get_setting("sender_tel", ""))
            v_fax = st.text_input("FAX", db.get_setting("sender_fax", ""))
        if st.form_submit_button("💾 自社情報を保存"):
            db.set_setting("sender_company", v_company)
            db.set_setting("sender_addr", v_addr)
            db.set_setting("sender_tel", v_tel)
            db.set_setting("sender_fax", v_fax)
            db.set_setting("sender_mail", v_mail)
            st.success("自社情報を保存しました。")
            st.rerun()

    if db.get_setting("sender_company", "") or db.get_setting("sender_tel", ""):
        st.caption(f"差出人プレビュー（担当者: {person_name or 'なし'}）:")
        st.text(build_sender_info(person_name) or "（未設定）")
    else:
        st.warning("自社情報が未設定です。文面末尾が空欄になります。上で設定・保存してください。")


# ============================================================ 顧客追加
elif nav == "➕ 顧客追加":
    st.header("➕ 顧客追加")
    st.caption("駐車場希望・住居希望など、既存データに無い新しい客もここで追加できます。")
    # 区分はフォーム外に置き、住居のとき種別を売買/賃貸に切り替えられるようにする
    区分 = st.selectbox("区分", db.KUBUN, key="reg_kubun")
    with st.form("new_cust"):
        c1, c2 = st.columns(2)
        with c1:
            重要度 = st.selectbox("重要度", db.IMPORTANCE)
            会社名 = st.text_input("会社名 / 氏名 *")
            店名 = st.text_input("店名・屋号")
            if 区分 == "住居":
                種別 = st.selectbox("種別（住居：売買/賃貸）", db.JUKYO_SHUBETSU)
            elif 区分 == "店舗":
                種別 = st.selectbox("種別（大枠：飲食/物販/サービス/その他）",
                                   db.BIG_SHUBETSU)
            else:
                種別 = st.text_input("種別")
            詳細種別 = st.text_input("詳細種別（業種の詳細）")
            先方担当 = st.text_input("先方担当者")
            企業規模 = st.selectbox("企業規模", ["", "大手", "中小", "個人"])
        with c2:
            tel = st.text_input("TEL")
            fax_in = st.text_input("FAX")
            メール = st.text_input("メール")
            希望エリア = st.text_input("希望エリア")
            希望坪数 = size_selectbox("希望坪数（規模）", "")
            希望坪数詳細 = st.text_input("希望坪数詳細（例 20～50坪）")
            希望物件 = st.text_input("希望物件（特定物件を希望している場合）")
            staff_opts = ["（未割当）"] + db.list_staff()
            社内担当 = st.selectbox("社内担当", staff_opts)
        備考 = st.text_area("備考", height=80)
        if st.form_submit_button("＋ 登録", use_container_width=True):
            if not 会社名.strip():
                st.error("会社名/氏名は必須です。")
            else:
                from services import cleaning
                cid = insert_customer({
                    "区分": 区分, "重要度": 重要度, "種別": 種別,
                    "詳細種別": 詳細種別, "企業規模": 企業規模,
                    "店名": 店名, "会社名": 会社名, "先方担当": 先方担当,
                    "tel": cleaning.pretty(tel) if tel else "",
                    "fax": cleaning.pretty(fax_in) if fax_in else "",
                    "fax_dial": cleaning.normalize_dial(fax_in) if fax_in else "",
                    "fax_raw": fax_in, "メール": メール,
                    "希望エリア": 希望エリア, "希望坪数": 希望坪数,
                    "希望坪数詳細": 希望坪数詳細, "希望物件": 希望物件,
                    "可否": "可", "備考": 備考,
                    "社内担当": "" if 社内担当 == "（未割当）" else 社内担当,
                    "status": "未接触",
                })
                st.success(f"登録しました（ID {cid}）。")


# ============================================================ 設定
elif nav == "⚙️ 設定":
    st.header("⚙️ 設定")

    st.subheader("👤 担当者マスタ")
    st.caption("社内の営業担当を登録します。顧客への割当・記録者の選択に使います。")
    new_staff = st.text_input("担当者を追加")
    if st.button("追加") and new_staff.strip():
        db.add_staff(new_staff); st.rerun()
    for s in db.list_staff():
        col1, col2 = st.columns([4, 1])
        col1.write("・ " + s)
        if col2.button("削除", key=f"del_{s}"):
            db.remove_staff(s); st.rerun()

    st.divider()
    st.subheader("📠 eFAX / SMTP 設定")
    st.caption("eFAXは『FAX番号@ゲートウェイ』宛のメール送信でFAXを送ります。"
               "ご契約のeFAXの送信用ドメインとSMTP情報を登録してください。"
               "（分からない場合はCSV書き出し方式が使えます）")
    with st.form("smtp"):
        gw = st.text_input("eFAX ゲートウェイドメイン",
                           db.get_setting("efax_gateway", "efaxsend.com"),
                           help="例: efaxsend.com（ご契約により異なります）")
        cc = st.text_input("国番号（先頭0を置換）",
                           db.get_setting("efax_country_code", "81"),
                           help="eFAXは国際形式が必要。例: 81 → 0663530280 は 81663530280@… で送信。"
                                "国番号変換が不要なら空欄に")
        host = st.text_input("SMTPホスト", db.get_setting("smtp_host", ""),
                             help="例: smtp.gmail.com")
        port = st.text_input("SMTPポート", db.get_setting("smtp_port", "587"))
        user = st.text_input("SMTPユーザー", db.get_setting("smtp_user", ""))
        pw = st.text_input("SMTPパスワード", db.get_setting("smtp_password", ""),
                           type="password",
                           help="Gmailの場合はアプリパスワード")
        frm = st.text_input("送信元メールアドレス", db.get_setting("smtp_from", ""))
        tls = st.checkbox("TLSを使う", db.get_setting("smtp_tls", "1") == "1")
        if st.form_submit_button("💾 保存"):
            db.set_setting("efax_gateway", gw)
            db.set_setting("efax_country_code", cc)
            db.set_setting("smtp_host", host)
            db.set_setting("smtp_port", port)
            db.set_setting("smtp_user", user)
            db.set_setting("smtp_password", pw)
            db.set_setting("smtp_from", frm)
            db.set_setting("smtp_tls", "1" if tls else "0")
            st.success("保存しました。")
    st.caption("状態: " + ("✅ 送信可能" if fax.smtp_ready() else "⚠ 未設定（CSV書き出しは利用可）"))

    st.divider()
    st.subheader("💾 バックアップ / 復元")

    st.markdown("**エクスポート（バックアップ）**")
    st.caption("今のデータを1ファイル(.db)で書き出します。これを復元すればそのまま元に戻せます。"
               "書き出しには暗証番号が必要です。")
    EXPORT_PIN = "4242"
    pin = st.text_input("暗証番号（エクスポート用）", type="password", key="export_pin")
    if pin == EXPORT_PIN:
        conn = db.connect()
        _n = conn.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
        _h = conn.execute("SELECT COUNT(*) FROM contact_history").fetchone()[0]
        conn.close()
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        st.download_button(
            f"⬇ データベースをエクスポート（顧客{_n}件・履歴{_h}件）",
            data=db.export_db_bytes(),
            file_name=f"tsuikyaku_backup_{ts}.db",
            mime="application/octet-stream", use_container_width=True)
    elif pin:
        st.error("暗証番号が違います。")
    else:
        st.caption("暗証番号を入力するとエクスポートボタンが表示されます。")

    st.markdown("**インポート（復元）**")
    st.caption("エクスポートした .db を選んで復元します。現在のデータは上書きされます"
               "（直前の状態は customers.db.bak に自動退避）。")
    up_db = st.file_uploader("復元するバックアップ(.db)", type=["db"], key="restore_db")
    if up_db is not None:
        agree = st.checkbox("現在のデータを上書きすることを理解しました", key="restore_ok")
        if st.button("♻ このファイルで復元する", type="primary", disabled=not agree):
            try:
                db.restore_db_bytes(up_db.read())
                st.success("復元しました。左メニューを開き直す（ページ再読み込み）と反映されます。")
            except Exception as e:
                st.error(f"復元に失敗しました: {e}")

    st.divider()
    st.subheader("🗄 データ")
    st.write(f"DBファイル: `{db.DB_PATH}`")
    st.caption("社内共有するには、環境変数 `TSUIKYAKU_DB` で共有フォルダ上のパスを指定するか、"
               "1台で `--server.address 0.0.0.0` 起動してLANからアクセスしてください。")
