"use client";

import { BookOpen } from "lucide-react";
import { highlight, snippet } from "@/lib/highlight";
import type { SearchResult } from "@/lib/types";

export function SearchResults({
  results,
  keyword,
  onSelect,
}: {
  results: SearchResult[];
  keyword: string;
  onSelect: (r: SearchResult) => void;
}) {
  if (results.length === 0) return null;

  return (
    <ul className="space-y-3">
      {results.map((r) => (
        <li key={r.id}>
          <button
            onClick={() => onSelect(r)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:border-sky-600 hover:bg-slate-800/60"
          >
            <div className="mb-1 flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-sky-400" />
              <span className="font-semibold">{r.title}</span>
              <span className="text-xs text-slate-400">／ ページ {r.pageNumber}</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              {highlight(snippet(r.content, keyword), keyword)}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}
