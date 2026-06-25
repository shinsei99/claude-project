export interface SearchResult {
  id: string; // page id
  bookId: string;
  title: string;
  pageNumber: number;
  content: string;
}

export interface ShelfStatus {
  bookCount: number;
  maxBookSlots: number;
}
