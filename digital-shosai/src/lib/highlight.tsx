import React from "react";

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * text 内の keyword（大文字小文字無視）を <mark> でハイライトして返す。
 */
export function highlight(text: string, keyword: string): React.ReactNode {
  if (!keyword) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(keyword)})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <mark key={i} className="rounded bg-yellow-300 px-0.5 text-black">
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

/**
 * keyword 周辺だけを抜き出したプレビュー文字列を返す（前後 radius 文字）。
 */
export function snippet(text: string, keyword: string, radius = 60): string {
  if (!text) return "";
  const idx = keyword ? text.toLowerCase().indexOf(keyword.toLowerCase()) : -1;
  if (idx === -1) {
    return text.slice(0, radius * 2) + (text.length > radius * 2 ? "…" : "");
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + keyword.length + radius);
  return (
    (start > 0 ? "…" : "") +
    text.slice(start, end).trim() +
    (end < text.length ? "…" : "")
  );
}
