"use client";

import { useEffect, useState } from "react";
import { X, FileText, ImageOff, Loader2 } from "lucide-react";
import { highlight } from "@/lib/highlight";
import { getPageImageUrl } from "@/lib/db";
import type { SearchResult } from "@/lib/types";

/**
 * 左右2カラムのページ詳細ビューア（全画面モーダル）。
 * 左：テキスト全文（キーワードハイライト）／ 右：端末内に保存したページ画像
 */
export function PageViewerModal({
  result,
  keyword,
  onClose,
}: {
  result: SearchResult;
  keyword: string;
  onClose: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(true);

  // Esc で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 端末内の画像 Blob から objectURL を生成（アンマウント時に解放）
  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    setLoadingImage(true);
    getPageImageUrl(result.id)
      .then((u) => {
        if (!alive) {
          if (u) URL.revokeObjectURL(u);
          return;
        }
        url = u;
        setImageUrl(u);
      })
      .finally(() => alive && setLoadingImage(false));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [result.id]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-950/95">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{result.title}</p>
          <p className="text-xs text-slate-400">ページ {result.pageNumber}</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700"
          aria-label="閉じる"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 2カラム本体 */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
        {/* 左：テキスト */}
        <div className="thin-scroll overflow-y-auto border-b border-slate-800 p-6 md:border-b-0 md:border-r">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
            <FileText className="h-4 w-4" /> テキスト
          </div>
          <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-200">
            {highlight(result.content, keyword)}
          </p>
        </div>

        {/* 右：画像 */}
        <div className="thin-scroll overflow-auto bg-slate-900/50 p-6">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
            元のページ画像
          </div>
          {loadingImage ? (
            <div className="flex h-64 items-center justify-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={`${result.title} p.${result.pageNumber}`}
              className="mx-auto h-auto w-full max-w-3xl rounded-lg border border-slate-800 shadow-lg"
            />
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500">
              <ImageOff className="h-8 w-8" />
              <span className="text-sm">画像がありません</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
