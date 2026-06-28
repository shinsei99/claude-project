# AI不動産価格査定＆相場リサーチシステム

登記簿（謄本）PDF・レントロールをアップロードするだけで、周辺の公的データ・
取引事例を無料APIから自動取得し、物件種別に応じた **査定報告書（Excel）** を
自動生成する Streamlit アプリです。

対応する物件種別：

| 種別 | 査定手法 |
|---|---|
| 区分マンション | 取引事例比較法（近隣中古マンションの㎡単価 × 専有面積） |
| 土地・戸建 | 土地＝取引事例比較法／建物＝原価法（再調達原価 × 残存率） |
| 収益物件（一棟） | 積算価格（コスト法）＋ 収益価格（収益還元法）の併用 |

## 処理の流れ

```
入力（種別・謄本PDF・レントロール）
  → 登記簿/レントロール解析（pdfplumber + 正規表現 / pandas）
  → 住所変換・API調査（国土地理院ジオコーディング ＋ 国交省 不動産情報ライブラリ）
  → 価格算定（Pythonロジック）
  → 査定報告書（Excel）出力
```

すべてのデータは `models/valuation_data.py` の `ValuationPipelineData` に集約し、
一方向に受け渡します。**有料API（Google Maps / OpenAI 等）は一切使いません。**

## セットアップ

```bash
cd realestate-valuation
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 査定報告書テンプレート（3種別）を生成
.venv/bin/python templates/generate_template.py
```

## 起動

```bash
.venv/bin/streamlit run app.py --server.port 8509
```

ブラウザで **http://localhost:8509** を開きます。

## APIキー（不動産情報ライブラリ）

取引事例・公示地価の **自動取得** には、国土交通省「不動産情報ライブラリ」の
無料APIキーが必要です（[reinfolib.mlit.go.jp](https://www.reinfolib.mlit.go.jp/) で
無料登録 → APIキー発行）。

- キー未設定でも、公示地価㎡単価・取引事例は **画面で手入力** して査定できます。
- 住所→緯度経度変換（国土地理院ジオコーディング）は **キー不要** で常に動作します。

キーを常設するには `.streamlit/secrets.toml` に記載します（gitignore 済み）：

```toml
reinfolib_api_key = "あなたのキー"
```

環境変数 `REINFOLIB_API_KEY` でも可。

## ディレクトリ構成

```text
realestate-valuation/
├── app.py                          # メイン画面（UI・パイプライン）
├── models/
│   └── valuation_data.py           # ValuationPipelineData 構造定義
├── services/
│   ├── registry_parser.py          # 登記簿パース（pdfplumber＋正規表現）
│   ├── rentroll_parser.py          # レントロール解析（Excel/PDF）
│   ├── geo_service.py              # 住所変換・地価マップURL合成（国土地理院）
│   ├── market_research_service.py  # 国交省 不動産情報ライブラリAPI連携
│   ├── valuation_engine.py         # 3種別の査定価格計算
│   └── excel_export_service.py     # テンプレートへのExcel出力
└── templates/
    ├── generate_template.py        # テンプレート生成スクリプト
    ├── satei_mansion.xlsx          # マンション用
    ├── satei_kodate.xlsx           # 土地・戸建用
    └── satei_shueki.xlsx           # 収益物件用（積算＋収益 併記）
```

## 留意事項

- 登記簿PDFは **テキスト埋め込みPDF・スキャン画像PDFの両方** に対応します。
  「自動（推奨）」では通常PDFはpdfplumberでテキスト抽出し、スキャン画像PDFは
  自動で **AI解析**（見積書自動作成ツールと同じく `claude` コマンドにPDFを直接
  読ませてOCR）に切り替わります。AI解析は数分かかることがあり、Claude Code CLI
  （`claude` がPATHに通っていること）が必要です。Anthropic APIキーは不要です。
- 取引事例APIは市区町村・四半期単位で提供されるため、厳密な半径1km抽出はできず、
  **地区レベルの近傍事例** として提示します。
- 査定結果はあくまで機械的な参考値です。最終的な査定額は専門家の判断で補正してください。
- 残存率・再調達単価・期待利回り等のパラメータは `services/valuation_engine.py` の
  定数で調整できます。
