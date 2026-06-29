import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);
const CLAUDE_BIN = "/opt/homebrew/bin/claude";
const TIMEOUT_MS = 300_000;
// 解析前の向き（縦横・回転）自動補正スクリプト（pdf_orient.py を利用）
const ORIENT_CLI = join(process.cwd(), "orient_cli.py");
const ORIENT_TIMEOUT_MS = 150_000;

/** スキャン書類の向きを正立補正する（PDF/画像）。失敗しても無視して続行。 */
async function correctOrientation(filePath: string): Promise<void> {
  try {
    await execFileAsync("python3", [ORIENT_CLI, filePath], { timeout: ORIENT_TIMEOUT_MS });
  } catch {
    /* 向き補正に失敗しても元ファイルで解析を続行 */
  }
}

const PROMPT = `
以下のファイル群は、同一の賃貸物件に関する書類です（契約書・重要事項説明書・CHECK表・申込書・身分証・保証会社書類など）。
すべてのファイルを読み込み、物件管理システムへの登録に必要な情報を抽出してください。

必ず以下のJSON形式のみで返してください。説明文・コードブロック(\`\`\`json等)は一切不要です。JSONだけを返してください。

{
  "tenant": {
    "name": "入居者名（フルネーム）",
    "phone": "電話番号",
    "email": "メールアドレス（不明はnull）",
    "contractStart": "YYYY-MM-DD",
    "contractEnd": "YYYY-MM-DD",
    "moveInDate": "実際の入居日・鍵渡し日 YYYY-MM-DD（不明はnull）",
    "occupation": "職業・勤務先名（不明はnull）",
    "condoFee": 共益費の数字のみ（不明はnull）,
    "waterFee": 水道代の数字のみ（不明はnull）,
    "supportFee": 緊急サポート24費用の数字のみ（不明はnull）,
    "depositAmount": 敷金の数字のみ（不明はnull）,
    "keyMoney": 礼金の数字のみ（不明はnull）,
    "renewalFee": 更新料の数字のみ（不明はnull）,
    "contractPeriodMonths": 契約期間の月数（2年なら24、不明はnull）,
    "paymentMethod": "銀行振込 or 口座振替 or 保証会社送金 or その他（不明はnull）",
    "paymentAccountName": "振込名義人カナ（不明はnull）",
    "emergencyContactName": "緊急連絡先氏名（不明はnull）",
    "emergencyContactRelation": "続柄（不明はnull）",
    "emergencyContactPhone": "緊急連絡先電話番号（不明はnull）",
    "guarantorCompany": "保証会社名（不明はnull）",
    "guarantorPlan": "加入プラン（不明はnull）",
    "guarantorContractNumber": "保証契約番号（不明はnull）",
    "support24": true/false（不明はnull）,
    "earlyTermination": true/false（不明はnull）,
    "earlyTerminationDetail": "違約金の詳細説明（不明はnull）",
    "initialEquipment": "初期付帯設備のメモ（複数あれば改行区切り、不明はnull）"
  },
  "security": {
    "keyOriginalNumber": "鍵原本番号（不明はnull）",
    "electronicLockCode": "電子錠暗証番号（不明はnull）"
  },
  "repairs": [
    {
      "date": "YYYY-MM-DD",
      "category": "水回り or エアコン or 内装 or 電気 or 設備 or その他",
      "description": "修繕内容",
      "contractor": "対応業者名",
      "costIncludingTax": 費用の数字のみ（税込）,
      "notes": "備考（不明はnull）"
    }
  ],
  "extractionNotes": "抽出できなかった情報や特記事項（なければnull）"
}

注意事項:
- 情報が見つからない項目は必ずnull（空文字列ではなく）
- 金額は数字のみ（¥マーク・カンマ不要）
- 日付はYYYY-MM-DD形式
- repairs は修繕・工事関連書類がある場合のみ。なければ空配列 []
- 返答はJSONのみ。前後の説明・\`\`\`json等のマークダウン不要

対象ファイル: {filenames}
`.trim();

function extractJson(text: string): unknown | null {
  // ```json ... ``` ブロックを優先して探す
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch { /* fall through */ }
  }
  // { ... } を貪欲マッチで探す
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch { /* fall through */ }
  }
  return null;
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (!files.length) {
    return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
  }

  const tmpDir = mkdtempSync(join(tmpdir(), `building-ai-${id}-`));
  const savedNames: string[] = [];

  try {
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      const safeName = file.name
        .replace(/[^\w　-鿿゠-ヿ぀-ゟ\.\-]/g, "_")
        .replace(/_+/g, "_");
      const savedPath = join(tmpDir, safeName);
      writeFileSync(savedPath, buf);
      // 解析前に向きを自動補正（スキャン書類が横向き・逆さでも正しく読めるように）
      await correctOrientation(savedPath);
      savedNames.push(safeName);
    }

    const prompt = PROMPT.replace("{filenames}", savedNames.join("、"));

    const { stdout, stderr } = await execFileAsync(
      CLAUDE_BIN,
      ["-p", prompt, "--output-format", "json", "--tools", "Read", "--model", "sonnet", "--max-turns", "3"],
      { cwd: tmpDir, timeout: TIMEOUT_MS },
    );

    if (stderr) console.warn("[ai-extract] stderr:", stderr.slice(0, 500));

    let claudeOutput: { result?: string; [k: string]: unknown };
    try {
      claudeOutput = JSON.parse(stdout);
    } catch {
      return NextResponse.json({ error: "Claude の出力が不正なJSON形式でした", raw: stdout.slice(0, 300) }, { status: 500 });
    }

    const resultText = String(claudeOutput.result ?? stdout);
    const extracted = extractJson(resultText);

    if (!extracted) {
      console.error("[ai-extract] raw result:", resultText.slice(0, 1000));
      return NextResponse.json({
        error: "AIの応答からJSONを抽出できませんでした。ファイルが読み取れないか、AIが別形式で返答しました。",
        raw: resultText.slice(0, 500),
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: extracted, files: savedNames });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    try { rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
  }
}
