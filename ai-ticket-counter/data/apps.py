# -*- coding: utf-8 -*-
"""社内18アプリの一覧。AI が「対象アプリの特定」に使うマスタ。

キーワードは AI 補助・フォールバックの照合に使う（AI が確実に選べるよう
プロンプトにも一覧を渡す）。新アプリ追加時はここに1行足すだけでよい。
"""

# 正式名称（AIはこの名称のいずれか、または「その他・不明」を返す）と別名キーワード
APPS = [
    ("見積書自動生成ツール",                ["見積", "見積書", "quote"]),
    ("物件管理 案内文ジェネレーター",       ["案内文", "物件管理", "notice", "property-notice"]),
    ("間取り図トレーサー",                  ["間取り", "madori", "トレース", "図面"]),
    ("THETAビューワー",                     ["theta", "パノラマ", "360", "ビューワ"]),
    ("入金突合（消込）システム",            ["入金", "突合", "消込", "reconcil"]),
    ("物件写真一括リサイズ",                ["リサイズ", "resize", "画像圧縮", "軽量化"]),
    ("退去時 原状回復費用 自動精算",        ["原状回復", "退去", "精算", "restoration"]),
    ("決済案内書 自動作成＆清算監査",       ["決済案内", "清算監査", "settlement", "決済"]),
    ("マイソクコンバーター",                ["マイソク", "maisoku", "コンバータ"]),
    ("不動産・金融マスター電卓",            ["電卓", "計算機", "calc", "利回り", "ローン"]),
    ("AI不動産価格査定＆相場リサーチ",      ["査定", "相場", "valuation", "価格"]),
    ("媒介契約書ジェネレーター",            ["媒介", "baikai", "媒介契約"]),
    ("特約条項ジェネレーター",              ["特約", "tokuyaku", "条項"]),
    ("マンション・ビル管理",                ["マンション管理", "ビル管理", "building", "kanri"]),
    ("手書き検針記録 → Excel転記",          ["検針", "手書き", "ocr", "メーター"]),
    ("不動産写真AI（電柱・電線・通行人消去）", ["電柱", "電線", "通行人", "inpaint", "写真ai", "消去"]),
    ("売買契約・重説・謄本 4点クロスチェック", ["クロスチェック", "重説", "謄本", "売買契約", "crosscheck"]),
    ("AI重説調査 〜 Excel自動入力",         ["重説調査", "jyuusetsu", "重要事項"]),
]

OTHER = "その他・不明"

# 報告者（社員）一覧。プルダウン表示用。50音順で並べる。
#   大鹿(おお) → 杉田(すぎ) → 塚本(つか) → 松本(まつ) → 吉浦(よし)
REPORTERS = ["大鹿", "杉田", "塚本", "松本", "吉浦"]

# AI に渡す・照合に使う名称リスト
APP_NAMES = [name for name, _ in APPS] + [OTHER]


def guess_app(text: str) -> str:
    """テキストからキーワード一致で対象アプリを推測（AI失敗時のフォールバック）。"""
    if not text:
        return OTHER
    low = text.lower()
    best, best_hits = OTHER, 0
    for name, keywords in APPS:
        hits = sum(1 for k in keywords if k.lower() in low)
        if name in text:
            hits += 3
        if hits > best_hits:
            best, best_hits = name, hits
    return best


def normalize_app(name: str) -> str:
    """AI が返したアプリ名を正式名称に丸める。未知なら『その他・不明』。"""
    if not name:
        return OTHER
    name = name.strip()
    if name in APP_NAMES:
        return name
    # 部分一致で救済
    for canonical in APP_NAMES:
        if canonical != OTHER and (name in canonical or canonical in name):
            return canonical
    return OTHER
