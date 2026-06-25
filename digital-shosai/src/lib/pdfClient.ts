"use client";

// pdf.js（legacy build）でブラウザ内のみで PDF を処理する。
// テキスト抽出とページ画像化の両方をクライアントで行い、サーバーには送らない。
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import { RENDER_SCALE } from "@/lib/constants";
import type { NewPage } from "@/lib/db";

// ワーカーは public/ に同梱した自前ホストのものを使う（オフライン動作）
pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.min.mjs";

export type ProgressFn = (done: number, total: number) => void;

/**
 * PDF をページごとに「テキスト」＋「PNG画像」に変換して返す。
 * すべて端末内で完結する。
 */
export async function processPdf(file: File, onProgress?: ProgressFn): Promise<NewPage[]> {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data,
    // 日本語など CID フォントのテキスト抽出・描画に必須（public/ に同梱）
    cMapUrl: "./cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "./standard_fonts/",
  }).promise;
  const total = pdf.numPages;
  const pages: NewPage[] = [];

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);

    // --- テキスト抽出（行の折り返しを推定） ---
    const textContent = await page.getTextContent();
    let lastY: number | undefined;
    let text = "";
    for (const item of textContent.items as any[]) {
      if (typeof item.str !== "string") continue;
      if (lastY === undefined || lastY === item.transform[5]) {
        text += item.str;
      } else {
        text += "\n" + item.str;
      }
      lastY = item.transform[5];
    }

    // --- ページ画像化（canvas → PNG Blob） ---
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D コンテキストを取得できませんでした");

    await page.render({ canvasContext: ctx, viewport }).promise;
    const image: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("画像化に失敗しました"))),
        "image/png"
      )
    );

    pages.push({ pageNumber: i, content: text, image });
    page.cleanup();
    onProgress?.(i, total);
  }

  await pdf.destroy();
  return pages;
}

export function titleFromFileName(name: string): string {
  return name.replace(/\.pdf$/i, "");
}
