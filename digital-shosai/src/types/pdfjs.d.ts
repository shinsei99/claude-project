// pdfjs-dist の legacy ビルドは型宣言を持たないため、
// メインモジュールの型を再エクスポートして補う。
declare module "pdfjs-dist/legacy/build/pdf" {
  export * from "pdfjs-dist";
}
