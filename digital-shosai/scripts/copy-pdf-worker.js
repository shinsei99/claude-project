// pdf.js のワーカー・cMap・標準フォントを public/ にコピーする。
// オフライン（端末内完結）で動かすため CDN ではなく自前ホストする。
// cMap / standard_fonts は日本語など CID フォントのテキスト抽出・表示に必須。
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pdfjs = path.join(root, "node_modules", "pdfjs-dist");
const publicDir = path.join(root, "public");

fs.mkdirSync(publicDir, { recursive: true });

// 1) ワーカー
fs.copyFileSync(
  path.join(pdfjs, "legacy", "build", "pdf.worker.min.mjs"),
  path.join(publicDir, "pdf.worker.min.mjs")
);

// 2) ディレクトリ丸ごとコピー（cmaps / standard_fonts）
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

copyDir(path.join(pdfjs, "cmaps"), path.join(publicDir, "cmaps"));
copyDir(path.join(pdfjs, "standard_fonts"), path.join(publicDir, "standard_fonts"));

console.log("copied pdf worker + cmaps + standard_fonts -> public/");
