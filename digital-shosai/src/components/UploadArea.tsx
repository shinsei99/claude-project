"use client";

import { useRef, useState } from "react";
import { FileUp, FileText } from "lucide-react";

// ドラッグ＆ドロップ対応のPDFアップロードエリア
export function UploadArea({
  disabled,
  onFile,
}: {
  disabled?: boolean;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("PDFファイルを選択してください");
      return;
    }
    onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={[
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition",
        dragging
          ? "border-sky-400 bg-sky-400/10"
          : "border-slate-700 bg-slate-900 hover:border-slate-500",
        disabled ? "pointer-events-none opacity-50" : "",
      ].join(" ")}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800">
        {dragging ? (
          <FileText className="h-7 w-7 text-sky-400" />
        ) : (
          <FileUp className="h-7 w-7 text-sky-400" />
        )}
      </div>
      <p className="font-medium">PDFをドラッグ＆ドロップ</p>
      <p className="text-sm text-slate-400">またはクリックしてファイルを選択</p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
