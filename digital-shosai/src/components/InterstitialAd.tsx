"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

const SKIP_SECONDS = 5;

/**
 * インタースティシャル（全画面）広告。
 * アップロード処理中に表示し、最低 5 秒のカウントダウン後、
 * かつ処理が完了したら自動で閉じる。
 */
export function InterstitialAd({
  processing,
  progress,
  onDone,
}: {
  processing: boolean;
  progress?: { done: number; total: number } | null;
  onDone: () => void;
}) {
  const [remaining, setRemaining] = useState(SKIP_SECONDS);

  // スキップまでのカウントダウン
  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  // 処理完了 & カウントダウン終了で自動クローズ
  useEffect(() => {
    if (!processing && remaining <= 0) onDone();
  }, [processing, remaining, onDone]);

  const canClose = remaining <= 0 && !processing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <div className="relative flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-slate-700 bg-gradient-to-b from-indigo-900 to-slate-900 p-8 text-center">
        {/* 閉じる（カウントダウン後のみ有効） */}
        <button
          onClick={canClose ? onDone : undefined}
          disabled={!canClose}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-slate-300 disabled:opacity-40"
          aria-label="閉じる"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="rounded-full bg-white/10 px-3 py-1 text-xs tracking-widest text-slate-300">
          ADVERTISEMENT
        </span>

        <div className="flex h-40 w-full items-center justify-center rounded-xl border border-dashed border-slate-600 text-sm text-slate-400">
          全画面広告クリエイティブ
        </div>

        <div className="flex items-center gap-2 text-sm text-sky-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          {processing
            ? progress && progress.total > 0
              ? `ページを解析・画像化中… ${progress.done} / ${progress.total}`
              : "ページを解析・画像化しています…"
            : "まもなく完了します"}
        </div>

        <p className="text-xs text-slate-400">
          {remaining > 0
            ? `閉じるまであと ${remaining} 秒`
            : processing
              ? "処理の完了をお待ちください…"
              : "閉じられます"}
        </p>
      </div>
    </div>
  );
}
