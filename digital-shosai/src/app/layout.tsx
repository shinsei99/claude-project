import type { Metadata } from "next";
import Link from "next/link";
import { BookMarked, Upload, Search } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "デジタル書斎 — 自分専用ナレッジベース",
  description: "OCR済みPDFを取り込み、全文検索できるパーソナル書斎",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold">
              <BookMarked className="h-5 w-5 text-sky-400" />
              <span>デジタル書斎</span>
            </Link>
            <div className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-slate-800"
              >
                <Upload className="h-4 w-4" /> 取り込み
              </Link>
              <Link
                href="/search"
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-slate-800"
              >
                <Search className="h-4 w-4" /> 検索
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
