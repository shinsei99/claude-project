import { Library } from "lucide-react";
import type { ShelfStatus } from "@/lib/types";

// 本棚の使用状況メーター（○/○冊）
export function ShelfMeter({ status }: { status: ShelfStatus | null }) {
  const used = status?.bookCount ?? 0;
  const max = status?.maxBookSlots ?? 5;
  const ratio = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  const full = used >= max;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-slate-300">
          <Library className="h-4 w-4 text-sky-400" /> 本棚の使用状況
        </span>
        <span className={full ? "font-bold text-amber-400" : "font-bold text-slate-100"}>
          {used} / {max} 冊
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-700">
        <div
          className={`h-full transition-[width] ${full ? "bg-amber-400" : "bg-sky-400"}`}
          style={{ width: `${ratio}%` }}
        />
      </div>
      {full && (
        <p className="mt-2 text-xs text-amber-400">
          無料枠が満杯です。追加するには動画広告の視聴で +1 枠できます。
        </p>
      )}
    </div>
  );
}
