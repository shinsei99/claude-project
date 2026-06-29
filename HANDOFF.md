# 引き継ぎメモ（別PCで作業を続けるために）

最終更新：2026-06-30

このセッションで行った作業と、別PCで再開するための手順をまとめます。
リポジトリ：`https://github.com/shinsei99/project`（ホーム直下 `/Users/apple` がワークツリー、main ブランチ）。
※ `quote-generator` だけは別リポジトリ `https://github.com/shinsei99/quote-generator`。

---

## 今回の作業サマリ

### 1. 新規アプリ：baikai-generator（媒介契約書ジェネレーター）
- 謄本PDF最大5枚 → 土地/建物/マンション自動判別 → 媒介契約書（一般/専任/専属専任）Excel自動生成。Streamlit、port 8514。
- AIは claude CLI（APIキー不要）。約款は標準媒介契約約款を `services/contract_text.py` にデータ化。
- 自社（乙）情報を名称で登録（`data/companies.json`＝**個人情報なのでgit対象外**。別PCでは再入力）。
- スキャン謄本は「**先に向き補正→解析**」（後述の pdf_orient 内蔵版）。
- 起動：`cd baikai-generator && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && streamlit run app.py --server.port 8514`

### 2. PDF/画像を読む全アプリに「解析前の向き(縦横/回転)自動補正」を導入
- 共有モジュール `pdf_orient.py`（各アプリ直下にコピー）。`ensure_upright_pdf / ensure_upright_image / ensure_upright_bytes`。
- 仕組み：PyMuPDFで画像化→haikuで正立角(0/90/180/270)判定→正立補正→sonnetで読取り。横向きスキャンで速度4.4倍・精度向上を実測。
- 導入：baikai-generator（registry_parser.py に内蔵）/ quote-generator / restoration-calculator / settlement-creator / realestate-valuation（registry・case・rosenka）/ handwriting-ocr / maisoku-converter / building-manager（orient_cli.py を route から python 呼び出し）。
- 依存追加：各 requirements.txt に `pymupdf`,`pillow`。building-manager は `requirements-orient.txt`（`pip3 install -r` 必要）。
- 対象外（テキスト抽出のみ）：jyuusetsu-research, legal-crosscheck, rentroll_parser, digital-shosai。

### 3. realestate-calc（不動産・金融マスター電卓）の改修
- 仲介手数料：**低廉な空家等の特例トグル**（800万円以下→上限33万円税込）。
- 住宅ローン控除：**2024・2025年入居基準を明記**＋住宅性能セレクタ（認定4,500/ZEH3,500/省エネ3,000/一般0万円）＋下部に制度解説パネル。
- **App Store申請準備**（mom-counterと同じCapacitorフロー）：
  - アイコン生成（icon-1024/512/192.png, apple-touch-icon.png、原本 assets/icon.png）
  - privacy.html、アプリ内 全体免責、capacitor.config.json、package.json、www/、RELEASE.md
  - 残作業は `realestate-calc/RELEASE.md` 参照（npm install → cap add ios → assets generate → cap open ios → 申請）。
  - PWA配信(gh-pages)は未更新。Web公開を更新するなら gh-pages へ別途反映が必要。

---

## 別PCでのセットアップ

```bash
# 1) 取得
git clone https://github.com/shinsei99/project.git   # もしくは既存ワークツリーで git pull
git clone https://github.com/shinsei99/quote-generator.git   # quote-generatorは別repo

# 2) 前提ツール
#  - claude CLI（~/.local/bin/claude もしくは /opt/homebrew/bin/claude）… AI読取りに必須
#  - python3（pymupdf, pillow が入ること）

# 3) 各Streamlitアプリは個別に venv 構築
cd <app> && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

# 4) 秘匿情報は各PCでローカル再作成（git対象外）
#  - <app>/.streamlit/secrets.toml（APIキー等）
#  - baikai-generator/data/companies.json（自社情報。アプリ上で再登録）
#  - jyuusetsu-research/templates/*.xlsx（白紙版を配置）
```

## 注意
- claude CLI 未インストールだとAI読取り系は簡易抽出/no-opにフォールバック（向き補正も自動スキップ、安全）。
- スキャンPDFのAI読取りは1枚あたり数分かかることがある。
- 詳細は各アプリの README.md、realestate-calc/RELEASE.md を参照。
