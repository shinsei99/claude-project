"use client";

import { useEffect, useState } from "react";
import { Gift, PlayCircle, X } from "lucide-react";

const WATCH_SECONDS = 15; // 15〜30秒のシミュレーション（ここでは15秒）

/**
 * 動画リワード広告ポップアップ。
 * 視聴完了で onComplete を呼び、本棚スロット +1 を行う想定。
 */
export function RewardedAd({
  onComplete,
  onCancel,
}: {
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [watching, setWatching] = useState(false);
  const [progress, setProgress] = useState(0); // 0..100

  useEffect(() => {
    if (!watching) return;
    const step = 100 / (WATCH_SECONDS * 10); // 100ms 毎
    const t = setInterval(() => {
      setProgress((p) => {
        const next = p + step;
        if (next >= 100) {
          clearInterval(t);
          return 100;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(t);
  }, [watching]);

  useEffect(() => {
    if (watching && progress >= 100) {
      const t = setTimeout(onComplete, 400);
      return () => clearTimeout(t);
    }
  }, [watching, progress, onComplete]);

  const remaining = Math.ceil(((100 - progress) / 100) * WATCH_SECONDS);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-7 text-center">
        {!watching && (
          <button
            onClick={onCancel}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-slate-300"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20">
          <Gift className="h-7 w-7 text-amber-400" />
        </div>

        {!watching ? (
          <>
            <h3 className="mb-2 text-lg font-bold">本棚の枠が足りません</h3>
            <p className="mb-6 text-sm text-slate-300">
              30秒の動画広告を見ると、
              <br />
              本棚の枠が <span className="font-bold text-amber-400">1枠追加</span> されます！
            </p>
            <button
              onClick={() => setWatching(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-bold text-slate-900 transition hover:bg-amber-400"
            >
              <PlayCircle className="h-5 w-5" /> 動画を見て枠を増やす
            </button>
            <button
              onClick={onCancel}
              className="mt-3 text-xs text-slate-400 hover:text-slate-200"
            >
              あとにする
            </button>
          </>
        ) : (
          <>
            <h3 className="mb-4 text-lg font-bold">動画広告 再生中…</h3>
            <div className="mb-3 flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-600 text-sm text-slate-400">
              動画クリエイティブ
            </div>
            <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full bg-amber-400 transition-[width] duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">
              {remaining > 0 ? `あと ${remaining} 秒で報酬獲得` : "報酬を付与しています…"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
