"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { FREE_BOOK_SLOTS } from "@/lib/constants";
import type { SearchResult, ShelfStatus } from "@/lib/types";

// ============================================================
// 端末内データベース（IndexedDB）
// すべてのデータ（本・ページ・画像）はこの端末のブラウザ/WebView 内にのみ保存され、
// 外部サーバーには一切送信されない。
// ============================================================

export interface BookRecord {
  id: string;
  title: string;
  uploadedAt: number;
  pageCount: number;
}

export interface PageRecord {
  id: string;
  bookId: string;
  pageNumber: number;
  content: string;
  image: Blob; // PNG 画像（端末内に保存）
}

export interface ProfileRecord {
  id: "me";
  maxBookSlots: number;
}

interface ShosaiDB extends DBSchema {
  books: { key: string; value: BookRecord };
  pages: {
    key: string;
    value: PageRecord;
    indexes: { byBook: string };
  };
  profile: { key: string; value: ProfileRecord };
}

const DB_NAME = "digital-shosai";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ShosaiDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ShosaiDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("books")) {
          db.createObjectStore("books", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("pages")) {
          const store = db.createObjectStore("pages", { keyPath: "id" });
          store.createIndex("byBook", "bookId");
        }
        if (!db.objectStoreNames.contains("profile")) {
          db.createObjectStore("profile", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

function uuid(): string {
  // ブラウザ / iOS WebView (Safari) で利用可能
  return crypto.randomUUID();
}

// --- プロフィール（本棚スロット） --------------------------------

export async function getProfile(): Promise<ProfileRecord> {
  const db = await getDB();
  let profile = await db.get("profile", "me");
  if (!profile) {
    profile = { id: "me", maxBookSlots: FREE_BOOK_SLOTS };
    await db.put("profile", profile);
  }
  return profile;
}

export async function addSlot(): Promise<number> {
  const db = await getDB();
  const profile = await getProfile();
  const updated: ProfileRecord = {
    ...profile,
    maxBookSlots: profile.maxBookSlots + 1,
  };
  await db.put("profile", updated);
  return updated.maxBookSlots;
}

// --- 状態（本棚メーター） --------------------------------------

export async function getStatus(): Promise<ShelfStatus> {
  const db = await getDB();
  const [bookCount, profile] = await Promise.all([
    db.count("books"),
    getProfile(),
  ]);
  return { bookCount, maxBookSlots: profile.maxBookSlots };
}

// --- 本の保存（取り込み） --------------------------------------

export interface NewPage {
  pageNumber: number;
  content: string;
  image: Blob;
}

/**
 * 1冊分（メタ＋全ページ）を1トランザクションで端末内に保存する。
 * 上限到達時は LIMIT_REACHED エラーを投げる。
 */
export async function saveBook(title: string, pages: NewPage[]): Promise<BookRecord> {
  const db = await getDB();

  const status = await getStatus();
  if (status.bookCount >= status.maxBookSlots) {
    throw new Error("LIMIT_REACHED");
  }

  const bookId = uuid();
  const book: BookRecord = {
    id: bookId,
    title,
    uploadedAt: Date.now(),
    pageCount: pages.length,
  };

  const tx = db.transaction(["books", "pages"], "readwrite");
  await tx.objectStore("books").put(book);
  const pageStore = tx.objectStore("pages");
  for (const p of pages) {
    await pageStore.put({
      id: uuid(),
      bookId,
      pageNumber: p.pageNumber,
      content: p.content,
      image: p.image,
    });
  }
  await tx.done;
  return book;
}

// --- 検索（端末内・全ページ部分一致） --------------------------

export async function searchPages(query: string, limit = 50): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const db = await getDB();

  // 本タイトルの辞書を用意
  const books = await db.getAll("books");
  const titleById = new Map(books.map((b) => [b.id, b.title]));

  const results: SearchResult[] = [];
  // ページを走査して部分一致（端末内なので件数は現実的）
  let cursor = await db.transaction("pages").store.openCursor();
  while (cursor) {
    const p = cursor.value;
    if (p.content && p.content.toLowerCase().includes(q)) {
      results.push({
        id: p.id,
        bookId: p.bookId,
        title: titleById.get(p.bookId) ?? "(無題)",
        pageNumber: p.pageNumber,
        content: p.content,
      });
      if (results.length >= limit) break;
    }
    cursor = await cursor.continue();
  }

  results.sort((a, b) =>
    a.title === b.title ? a.pageNumber - b.pageNumber : a.title.localeCompare(b.title)
  );
  return results;
}

// --- ページ画像の取得（ビューア用 objectURL） ------------------

export async function getPageImageUrl(pageId: string): Promise<string | null> {
  const db = await getDB();
  const page = await db.get("pages", pageId);
  if (!page?.image) return null;
  return URL.createObjectURL(page.image);
}

// --- 本の一覧 / 削除（端末の容量管理用） ------------------------

export async function listBooks(): Promise<BookRecord[]> {
  const db = await getDB();
  const books = await db.getAll("books");
  return books.sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export async function deleteBook(bookId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["books", "pages"], "readwrite");
  await tx.objectStore("books").delete(bookId);
  const idx = tx.objectStore("pages").index("byBook");
  let cursor = await idx.openCursor(bookId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}
