"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { BannerAd } from "@/components/BannerAd";
import { ShelfMeter } from "@/components/ShelfMeter";
import { UploadArea } from "@/components/UploadArea";
import { InterstitialAd } from "@/components/InterstitialAd";
import { RewardedAd } from "@/components/RewardedAd";
import { processPdf, titleFromFileName } from "@/lib/pdfClient";
import { getStatus, saveBook, addSlot } from "@/lib/db";
import type { ShelfStatus } from "@/lib/types";

type Notice = { type: "success" | "error"; text: string } | null;

export default function HomePage() {
  const [status, setStatus] = useState<ShelfStatus | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [showRewarded, setShowRewarded] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await getStatus());
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // 端末内での取り込み処理（pdf.js → IndexedDB）
  const runImport = useCallback(
    async (file: File) => {
      setNotice(null);
      setProcessing(true);
      setProgress({ done: 0, total: 0 });
      setShowInterstitial(true); // 処理中の待ち時間にインタースティシャル広告

      try {
        const pages = await processPdf(file, (done, total) =>
          setProgress({ done, total })
        );

        // 文字層チェック：スキャンしただけ（OCR未処理）のPDFを検知して警告する
        const totalChars = pages.reduce(
          (sum, p) => sum + (p.content ? p.content.replace(/\s/g, "").length : 0),
          0
        );
        const looksUnsearchable = totalChars < pages.length * 3;
        if (looksUnsearchable) {
          setShowInterstitial(false);
          const proceed = window.confirm(
            "このPDFには文字データがほとんど見つかりませんでした。\n" +
              "スキャンしただけ（OCR未処理）の画像PDFの可能性があります。\n\n" +
              "このまま取り込んでも【検索はできません】。画像として保存だけしますか？"
          );
          if (!proceed) {
            setNotice({
              type: "error",
              text: "文字層の無いPDFのようです。Acrobat等でOCRしてから取り込んでください。",
            });
            return;
          }
        }

        const book = await saveBook(titleFromFileName(file.name), pages);
        setNotice({
          type: looksUnsearchable ? "error" : "success",
          text: looksUnsearchable
            ? `「${book.title}」を画像として保存しました（${book.pageCount}ページ・検索不可）`
            : `「${book.title}」を端末内に保存しました（${book.pageCount}ページ）`,
        });
        setPendingFile(null);
        await refreshStatus();
      } catch (e: any) {
        if (e?.message === "LIMIT_REACHED") {
          setPendingFile(file);
          setShowRewarded(true);
        } else {
          setNotice({
            type: "error",
            text: e?.message ?? "取り込みに失敗しました",
          });
        }
      } finally {
        setProcessing(false);
        setProgress(null);
      }
    },
    [refreshStatus]
  );

  // ファイル選択時：枠が満杯なら先にリワード広告へ誘導
  const handleFile = useCallback(
    (file: File) => {
      if (status && status.bookCount >= status.maxBookSlots) {
        setPendingFile(file);
        setShowRewarded(true);
        return;
      }
      runImport(file);
    },
    [status, runImport]
  );

  // 動画リワード視聴完了 → 端末内でスロット+1 → 保留ファイルを自動取り込み
  const handleRewardComplete = useCallback(async () => {
    try {
      await addSlot();
      await refreshStatus();
    } finally {
      setShowRewarded(false);
      const file = pendingFile;
      if (file) setTimeout(() => runImport(file), 100);
    }
  }, [pendingFile, refreshStatus, runImport]);

  return (
    <div className="space-y-6">
      <BannerAd />

      <div>
        <h1 className="text-2xl font-bold">PDFを取り込む</h1>
        <p className="mt-1 text-sm text-slate-400">
          OCR済みPDFを選ぶと、ページごとにテキスト抽出＆画像化して保存します。
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-900/30 px-3 py-1 text-xs text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          データはこの端末内だけに保存され、外部に送信されません
        </p>
      </div>

      <ShelfMeter status={status} />

      <UploadArea disabled={processing} onFile={handleFile} />

      {notice && (
        <div
          className={[
            "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
            notice.type === "success"
              ? "border-emerald-700 bg-emerald-900/30 text-emerald-300"
              : "border-rose-700 bg-rose-900/30 text-rose-300",
          ].join(" ")}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {notice.text}
        </div>
      )}

      {showInterstitial && (
        <InterstitialAd
          processing={processing}
          progress={progress}
          onDone={() => setShowInterstitial(false)}
        />
      )}

      {showRewarded && (
        <RewardedAd
          onComplete={handleRewardComplete}
          onCancel={() => {
            setShowRewarded(false);
            setPendingFile(null);
          }}
        />
      )}
    </div>
  );
}
