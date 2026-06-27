# 退去時 原状回復費用 自動精算システム

賃貸退去時の「原状回復費用精算」を効率化・透明化する Streamlit アプリ。
リフォーム業者等の **業者見積書（Excel/CSV）** をアップロードすると、工事明細と金額を
自動で読み込み、国土交通省「原状回復をめぐるトラブルとガイドライン」に基づいて
**入居者負担額 / オーナー負担額** を1円単位で按分計算し、契約者提示用の
**退去精算書（Excel）** を自動生成します。

## 特徴

- **スマートExcel/CSV解析**: フォーマットが不統一な業者見積でも、「工事名列」「金額列」を
  キーワード＋数値ヒューリスティクスで自動判定。合計行・空欄行は自動除外。
- **PDF解析（AI）**: PDFは Claude Code CLI に直接読ませて工事名・金額を抽出
  （見積書自動作成ツールと同じ仕組み）。Anthropic APIキー不要、Claude Pro/Maxサブスクのみで動作。
- **部材自動判別**: クロス／CF／クリーニング／畳などを工事名から自動マッピング。
- **ガイドライン準拠の償却計算**: クロス・CF等は6年で直線償却、畳・襖・クリーニングは
  経過年数を考慮しない。経年劣化（通常損耗）は入居者負担0円。
- **3種の帳票出力**:
  - **退去精算書**（内部用）… 入居者/オーナーの負担按分内訳
  - **見積書 / 請求書**（賃借人提示用）… 入居者負担額を提示・請求。請求書は敷金相殺＋振込先付き。
    見積書自動作成ツールのレイアウトを参考に、見積書・請求書を1冊にまとめて出力。
- **Excel解析・帳票出力は完全ローカル**（pandas / openpyxl）。PDF解析のみ Claude CLI を使用。

## セットアップ

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
# 精算書テンプレートを生成（初回のみ）
.venv/bin/python templates/generate_template.py
```

## 起動

```bash
.venv/bin/streamlit run app.py --server.port 8508
```

→ http://localhost:8508

## 使い方

1. 基本情報（賃借人・物件・入居日・退去日・敷金）を入力
2. 業者見積Excelをアップロード →「解析」で明細を自動展開
3. 部材種別・過失の有無（故意過失／経年劣化）を必要に応じて微調整
4. 「按分を計算」→ 負担額・円グラフを確認
5. 「退去精算書(.xlsx)」をダウンロード

## 構成

```
restoration-calculator/
├── app.py                          # Streamlit UI
├── services/
│   ├── excel_parser.py             # 業者見積Excel/CSVの自動解析（品名・金額抽出）
│   ├── pdf_parser.py               # 業者見積PDFのAI解析（Claude CLI）
│   ├── depreciation_engine.py      # 減価償却・按分計算
│   ├── excel_export_service.py     # 退去精算書(Excel)出力
│   └── document_export_service.py  # 見積書・請求書(Excel)出力
├── models/
│   └── restoration_data.py         # RestorationData / LineItem データ構造
└── templates/
    ├── generate_template.py        # テンプレート生成スクリプト
    └── seisan_template.xlsx        # 退去精算書テンプレート
```

## 注意

本ツールの計算はガイドラインの一般的な考え方に基づく目安です。実際の精算は
個別の契約条件・特約・物件状況により異なります。最終判断は専門家にご確認ください。
