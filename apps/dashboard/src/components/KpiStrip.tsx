import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface KpiItem {
  id: string;
  label: string;
  /** big number; pass "—" when the data cannot support one */
  value: ReactNode;
  /** line under the number (use <Delta/> and spans) */
  detail?: ReactNode;
}

/** Joined panel of metrics: 2 columns on mobile, one row from md up. */
export function KpiStrip({ items, loading, className }: { items: KpiItem[]; loading?: boolean; className?: string }) {
  return (
    <section
      aria-label="Key metrics"
      className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-line-2 md:grid-cols-4", className)}
    >
      {items.map((k) => (
        <div key={k.id} className="min-w-0 bg-panel px-4 py-3.5">
          <div className="text-xs font-medium text-muted-foreground">{k.label}</div>
          {loading ? (
            <>
              <Skeleton className="my-1.5 h-7 w-20" />
              <Skeleton className="h-3.5 w-28" />
            </>
          ) : (
            <>
              <div className="my-1 text-2xl leading-tight font-semibold tracking-tight tabular">{k.value}</div>
              <div className="min-h-[18px] text-xs">{k.detail}</div>
            </>
          )}
        </div>
      ))}
    </section>
  );
}

/** Signed change: green when up, red when down, faint when flat. `unit` e.g. " pts". */
export function Delta({ value, unit = "", digits = 0 }: { value: number; unit?: string; digits?: number }) {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return <span className="text-faint">no change</span>;
  const up = rounded > 0;
  return (
    <span className={cn("font-medium tabular", up ? "text-success" : "text-danger")}>
      {up ? "↑ +" : "↓ −"}
      {Math.abs(rounded).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}
      {unit}
    </span>
  );
}
