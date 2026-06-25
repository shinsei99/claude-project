"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { BannerAd } from "@/components/BannerAd";
import { SearchResults } from "@/components/SearchResults";
import { PageViewerModal } from "@/components/PageViewerModal";
import { searchPages } from "@/lib/db";
import type { SearchResult } from "@/lib/types";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [committed, setCommitted] = useState(""); // 実際に検索したキーワード
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    const kw = q.trim();
    setCommitted(kw);
    if (!kw) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      setResults(await searchPages(kw));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 入力のデバウンス検索（300ms）
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  return (
    <div className="space-y-6">
      {/* バナー広告（画面最上部） */}
      <BannerAd />

      <div>
        <h1 className="text-2xl font-bold">書斎を検索</h1>
        <p className="mt-1 text-sm text-slate-400">
          キーワードを入力すると、保存済みの全ページから高速に部分一致検索します。
        </p>
      </div>

      {/* 検索窓 */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例: 契約条項、減価償却、第3章 …"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-12 pr-4 text-base outline-none focus:border-sky-500"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>

      {/* 結果 */}
      {committed && !loading && (
        <p className="text-sm text-slate-400">
          「{committed}」の検索結果：{results.length} 件
        </p>
      )}

      <SearchResults results={results} keyword={committed} onSelect={setSelected} />

      {searched && !loading && results.length === 0 && committed && (
        <p className="py-10 text-center text-sm text-slate-500">
          一致するページが見つかりませんでした。
        </p>
      )}

      {/* 詳細ビューア */}
      {selected && (
        <PageViewerModal
          result={selected}
          keyword={committed}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
