import { Megaphone } from "lucide-react";

// 画面最上部に常時表示する横長バナー広告枠（ダミー）
export function BannerAd() {
  return (
    <div className="mb-4 flex h-16 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-900 text-xs text-slate-500">
      <Megaphone className="h-4 w-4" />
      <span>広告スペース（バナー 728×90）</span>
    </div>
  );
}
