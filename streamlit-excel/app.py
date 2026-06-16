import streamlit as st
import openpyxl
from openpyxl.utils import column_index_from_string, get_column_letter
import pandas as pd
import io
import re

st.set_page_config(
    page_title="Excel セル編集ツール",
    page_icon="📊",
    layout="wide",
)

# ── ユーティリティ ──────────────────────────────────────────────────────────

def parse_cell(ref: str):
    """'B3' → (row=3, col=2)  失敗時は (None, None)"""
    m = re.match(r"^([A-Z]+)(\d+)$", ref.strip().upper())
    if not m:
        return None, None
    try:
        return int(m.group(2)), column_index_from_string(m.group(1))
    except Exception:
        return None, None


def coerce_value(s: str):
    """文字列を適切な型に変換する（先頭ゼロは文字列として保持）"""
    s = s.strip()
    if not s:
        return None
    if re.match(r"^0\d", s):   # "007" などは文字列
        return s
    try:
        if "." not in s and "e" not in s.lower():
            return int(s)
    except ValueError:
        pass
    try:
        return float(s)
    except ValueError:
        pass
    return s


def ws_to_df(ws) -> pd.DataFrame:
    """ワークシート → DataFrame（列ラベル=A/B/C…、インデックス=1/2/3…）"""
    max_r, max_c = ws.max_row, ws.max_column
    if not max_r or not max_c:
        return pd.DataFrame()
    cols  = [get_column_letter(c) for c in range(1, max_c + 1)]
    index = list(range(1, max_r + 1))
    data  = [
        [ws.cell(row=r, column=c).value for c in range(1, max_c + 1)]
        for r in range(1, max_r + 1)
    ]
    return pd.DataFrame(data, columns=cols, index=index)


def build_output(file_bytes: bytes, edits: list) -> bytes:
    """編集リストを適用して .xlsx のバイト列を返す（書式は保持）"""
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes))
    for e in edits:
        if e["sheet"] in wb.sheetnames:
            wb[e["sheet"]][e["cell"]] = e["value"]
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── セッション初期化 ────────────────────────────────────────────────────────

for key, default in [("edits", []), ("file_bytes", None), ("fname", None)]:
    if key not in st.session_state:
        st.session_state[key] = default

# ── ヘッダー ────────────────────────────────────────────────────────────────

st.title("📊 Excel セル編集ツール")
st.caption("Excelファイルをアップロードし、セルを指定して値を変更・ダウンロードできます")

# ── ファイルアップロード ─────────────────────────────────────────────────────

uploaded = st.file_uploader(
    "Excelファイルをアップロード（.xlsx / .xlsm）",
    type=["xlsx", "xlsm"],
)

if not uploaded:
    st.info("👆 Excelファイル（.xlsx / .xlsm）をアップロードしてください")
    st.stop()

# 新しいファイルがアップロードされたらリセット
if st.session_state.fname != uploaded.name:
    st.session_state.file_bytes = uploaded.read()
    st.session_state.fname      = uploaded.name
    st.session_state.edits      = []

# ── メインレイアウト ─────────────────────────────────────────────────────────

left, right = st.columns([3, 2], gap="large")

wb = openpyxl.load_workbook(io.BytesIO(st.session_state.file_bytes), data_only=True)

# ── 左ペイン: プレビュー ──────────────────────────────────────────────────

with left:
    sheet = st.selectbox("シートを選択", wb.sheetnames)
    ws    = wb[sheet]
    df    = ws_to_df(ws)

    # 編集リストをプレビューに反映
    display_df   = df.copy() if not df.empty else pd.DataFrame()
    changed_keys: set = set()

    for e in st.session_state.edits:
        if e["sheet"] == sheet:
            r, c = parse_cell(e["cell"])
            if r and c:
                col_lbl = get_column_letter(c)
                if not display_df.empty and r in display_df.index and col_lbl in display_df.columns:
                    display_df.at[r, col_lbl] = e["value"]
                    changed_keys.add((r, col_lbl))

    n_edits = len([e for e in st.session_state.edits if e["sheet"] == sheet])
    label   = f"📄 {sheet}" + (f"　（{n_edits} 件編集中）" if n_edits else "")
    st.subheader(label)

    if display_df.empty:
        st.info("このシートにデータがありません")
    else:
        def highlight_edits(df_):
            styles = pd.DataFrame("", index=df_.index, columns=df_.columns)
            for (r, c) in changed_keys:
                if r in styles.index and c in styles.columns:
                    styles.at[r, c] = "background-color:#fff3cd; font-weight:bold; color:#856404"
            return styles

        st.dataframe(
            display_df.style.apply(highlight_edits, axis=None),
            use_container_width=True,
            height=440,
        )

# ── 右ペイン: 編集 ────────────────────────────────────────────────────────

with right:
    st.subheader("✏️ セルを編集")

    with st.form("cell_form", clear_on_submit=True):
        cell_input = st.text_input(
            "セル番地",
            placeholder="例: A1、B3、C10",
            help="Excelのセル番地（列A-Z＋行番号）を入力",
        )
        value_input = st.text_input(
            "新しい値",
            placeholder="例: 100、テキスト、2024-01-01",
        )
        submitted = st.form_submit_button("＋ 追加", type="primary", use_container_width=True)

    if submitted:
        ref_clean = cell_input.strip().upper()
        row, col  = parse_cell(ref_clean)

        if not ref_clean:
            st.error("セル番地を入力してください")
        elif not row:
            st.error(f"セル番地が無効です: **{cell_input}**　（例: A1、B3）")
        elif value_input.strip() == "":
            st.error("値を入力してください")
        else:
            coerced  = coerce_value(value_input)
            existing = next(
                (e for e in st.session_state.edits
                 if e["sheet"] == sheet and e["cell"] == ref_clean),
                None,
            )
            if existing:
                existing["value"] = coerced
                st.toast(f"{sheet}!{ref_clean} を更新しました ✓")
            else:
                st.session_state.edits.append(
                    {"sheet": sheet, "cell": ref_clean, "value": coerced}
                )
                st.toast(f"{sheet}!{ref_clean} を追加しました ✓")
            st.rerun()

    # ── 編集リスト ────────────────────────────────────────────────────────

    st.divider()

    if not st.session_state.edits:
        st.info("セルを追加すると、ここに編集リストが表示されます")
    else:
        st.subheader(f"📝 編集リスト（{len(st.session_state.edits)} 件）")

        for i, e in enumerate(st.session_state.edits):
            c1, c2 = st.columns([5, 1])
            with c1:
                st.markdown(f"`{e['sheet']}!{e['cell']}`　→　**{e['value']}**")
            with c2:
                if st.button("✕", key=f"del_{i}", help="この編集を削除"):
                    st.session_state.edits.pop(i)
                    st.rerun()

        if st.button("すべてクリア", use_container_width=True):
            st.session_state.edits = []
            st.rerun()

        st.divider()

        # ── ダウンロード ──────────────────────────────────────────────────

        out_bytes = build_output(st.session_state.file_bytes, st.session_state.edits)
        stem      = st.session_state.fname.rsplit(".", 1)[0]
        out_name  = f"{stem}_edited.xlsx"

        st.download_button(
            "⬇️ 編集済みファイルをダウンロード",
            data=out_bytes,
            file_name=out_name,
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True,
            type="primary",
        )
