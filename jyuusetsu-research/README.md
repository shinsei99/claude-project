# AI重説調査 〜 Excel自動入力システム

不動産業務の「物件調査 → 登記簿解析 → 重説下調べ → Excelテンプレート自動入力」を
一気通貫で行う**調査支援・下書き生成**システム（Streamlit）。最終ゴールは宅建士が
確認できる「重要事項説明書ドラフト（Excel）」の自動生成。完全自動ではありません。

## 設計方針

- すべての情報は `models/property_data.py` の **PropertyData**（単一辞書）に集約。
- **入力 → 調査 → 整理 → 出力（Excel / PDF）** の一方向パイプライン。
- 有料API / Google Maps API / OpenAI API は不使用。AI文章はテンプレート生成。
- API失敗時もアプリは停止せず、空欄（「要確認」）で継続。

## 入力

1. 住所（必須）
2. 登記事項証明書（土地PDF）
3. 登記事項証明書（建物PDF）
4. 物件概要書PDF（任意・将来対応）

## 使用データ / API（すべて無料）

| 用途 | データ源 | キー |
|------|----------|------|
| ジオコーディング | 国土地理院 住所検索API | 不要 |
| 最寄駅・距離 | HeartRails Express API | 不要 |
| 周辺施設（学校/病院/スーパー/公園） | OpenStreetMap Overpass API | 不要 |
| 災害（ハザード確認導線） | 国土地理院 重ねるハザードマップ | 不要 |
| 用途地域/建ぺい率/容積率 | 国交省 不動産情報ライブラリ | 任意 `REINFOLIB_API_KEY` |
| 人口・世帯数 | e-Stat（政府統計） | 任意 `ESTAT_APP_ID` |

> 用途地域・人口は無料でもキー登録が必要なため、未設定時は空欄で継続します。

## セットアップ / 起動

```bash
cd jyuusetsu-research
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# （任意）取得項目を増やす場合
export REINFOLIB_API_KEY=...   # 用途地域
export ESTAT_APP_ID=...        # 人口・世帯数

streamlit run app.py --server.port 8512
```

## 出力

- 画面表示（基本情報 / 都市計画 / 災害 / 周辺環境 / 登記 / AIコメント）
- Excel: `reports/jyuusetsu_draft.xlsx`（重説テンプレートにセルマッピング書き込み）
- PDF: `reports/jyuusetsu_draft.pdf`（reportlab・日本語対応）

## 実書式テンプレートへの流し込み（重要）

実際の重説書式（Excel）へ `PropertyData` を流し込めます。書式は
`services/format_export_service.py` の `FORMATS` に登録し、`{項目: セル}` の
マッピングで書き込みます。**新しい書式は FORMATS に 1 エントリ足すだけ**。

対応済み書式:

| キー | 書式 | テンプレート | 流し込み項目 |
|------|------|--------------|--------------|
| `rental_building` | 賃貸重説（建物賃貸借用 A4） | `templates/rental_building_template.xlsx` | 所在地→L90/L92、床面積→Y100、所有者→L106 |
| `sale_landbuilding` | 売買契約書（土地建物・公募用 一般売主） | `templates/sale_landbuilding_template.xlsx` | 所在地→D10/H18、地番→W10、地目→AF10、地積→AL10/AL15、家屋番号→AN18、種類→H19、構造→X19、床面積(延床)→AN21、所有者(売主)→D5 |
| `sale_mansion_contract` | 売買契約書（区分所有建物・敷地権 宅建業者売主） | `templates/sale_mansion_contract_template.xlsx` | 所在地→I8/H16、地番→Z16、地目→AK16、地積→AT16、家屋番号→I12、種類→AT12、構造→I13、床面積(専有)→AT13 |
| `sale_mansion_jyuusetsu` | 重要事項説明書（区分所有建物の売買・交換用） | `templates/sale_mansion_jyuusetsu_template.xlsx` | 所在地→M58/F77、地番→V77、地目→AD77、地積→AO77、家屋番号→M62、種類→M63、構造→M64、床面積(登記簿)→AD66 |

- 賃貸（建物賃貸借）は登記記録に基づく **所在地・床面積・所有者** を下書き。
  法令制限・災害・ライフライン等のチェック欄は自動判定値を持たないため既定のまま。
- 売買（土地建物）は「（A）売買の目的物の表示」へ **所在地・地番・地目・地積・家屋番号・
  種類・構造・床面積・所有者(売主)** を下書き。代金・期日・数式セルは変更しない。
- **無損失書き込み**: `services/xlsx_patcher.py` が編集対象シートの XML だけを
  書き換え、図形・画像・他シート（表紙等）は元ファイルからバイト単位でコピーします。
  openpyxl の再保存と異なり図形が欠落しません。空の項目はテンプレ既定値を保持します。

### 汎用ドラフトテンプレート

書式を指定しない汎用ドラフトは `templates/jyuusetsu_template.xlsx`（無ければ自動生成）。
セル位置は `services/excel_export_service.py` の `CELL_MAP`（項目→行番号）で調整します。

## フォルダ構成

```
jyuusetsu-research/
  app.py
  services/  address / zoning / hazard / facility / population / registry / comment / excel_export / pdf_export
  models/    property_data.py
  utils/     parser.py / formatter.py
  templates/ jyuusetsu_template.xlsx（自動生成）
  reports/   出力先
  data/
```

## 将来拡張（設計上の差し込み口）

接道情報 / 上下水道・ガス / 景観条例 / 35条書面生成 / 契約書ドラフト / LLM文章生成。
いずれも PropertyData にフィールドを足し、対応サービスを追加するだけで拡張できます。
