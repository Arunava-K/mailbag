import { useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { fmtNum, shortDay } from "@/lib/format";

export interface DayBar {
  /** "YYYY-MM-DD" */
  day: string;
  confirmed: number;
  pending: number;
}

/** Round the max up so the mid tick is a whole number: 2,4,6,8,10,20,40,60,80,100… */
function niceMax(max: number): number {
  if (max <= 2) return 2;
  const mag = 10 ** Math.floor(Math.log10(max));
  for (const m of [2, 4, 6, 8, 10]) if (m * mag >= max) return m * mag;
  return 10 * mag;
}

/**
 * Daily stacked bars: confirmed (accent) with pending on top (amber, translucent).
 * Y axis with two grid lines, 5 x labels, dashed "today" marker on the last bar,
 * per-bar tooltip on hover and via ←/→ when the chart is focused.
 * Shows an honest empty message when every bar is zero.
 */
export function StackedBarChart({
  data,
  height = 150,
  className,
  emptyLabel = "No signups in this period",
}: {
  data: DayBar[];
  height?: number;
  className?: string;
  emptyLabel?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const n = data.length;
  const total = data.reduce((s, d) => s + d.confirmed + d.pending, 0);
  const yMax = niceMax(Math.max(0, ...data.map((d) => d.confirmed + d.pending)));
  const gap = n > 45 ? 2 : 4;

  const onKey = (e: KeyboardEvent) => {
    if (n === 0) return;
    if (e.key === "ArrowRight") setActive((a) => (a === null ? n - 1 : Math.min(n - 1, a + 1)));
    else if (e.key === "ArrowLeft") setActive((a) => (a === null ? n - 1 : Math.max(0, a - 1)));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  const act = active !== null ? data[active] : null;
  const labelIdx = n < 2 ? [0] : [0, 1, 2, 3, 4].map((i) => Math.round((i * (n - 1)) / 4));
  const tipPos =
    active === null ? "" : active < n * 0.18 ? "translate-x-[-8px]" : active > n * 0.82 ? "translate-x-[calc(-100%+8px)]" : "-translate-x-1/2";

  return (
    <div className={cn("px-3.5 pt-3.5 pb-3", className)}>
      <div className="flex gap-2" style={{ height }}>
        <div aria-hidden className="flex w-[22px] flex-col justify-between text-right text-[10.5px] text-faint tabular">
          <span>{fmtNum(yMax)}</span>
          <span>{fmtNum(yMax / 2)}</span>
          <span>0</span>
        </div>
        <div
          role="group"
          tabIndex={0}
          aria-label="Signups per day. Use the left and right arrow keys to inspect individual days."
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          onMouseLeave={() => setActive(null)}
          className="relative flex-1 rounded-sm"
        >
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-line-2" />
          <div aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-line-2" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-line" />
          <div className="relative flex h-full items-end" style={{ gap }}>
            {data.map((d, i) => {
              const t = d.confirmed + d.pending;
              return (
                <div
                  key={d.day}
                  onMouseEnter={() => setActive(i)}
                  className="flex h-full flex-1 items-end"
                >
                  <div
                    className={cn(
                      "flex w-full flex-col-reverse overflow-hidden rounded-t-[2px]",
                      i === n - 1 && "outline outline-1 outline-offset-2 outline-dashed outline-faint",
                      active === i && "brightness-110",
                    )}
                    style={{ height: `${(t / yMax) * 100}%` }}
                  >
                    <div className="bg-brand" style={{ flex: d.confirmed }} />
                    <div className="bg-warning opacity-55" style={{ flex: d.pending }} />
                  </div>
                </div>
              );
            })}
          </div>
          {act && active !== null && (
            <div
              role="presentation"
              className={cn(
                "pointer-events-none absolute bottom-full z-10 mb-1 min-w-32 rounded-lg border border-line bg-popover px-2.5 py-2 text-xs shadow-lg",
                tipPos,
              )}
              style={{ left: `${((active + 0.5) / n) * 100}%` }}
            >
              <div className="mb-1 font-medium">
                {shortDay(act.day)}
                {active === n - 1 && <span className="ml-1 font-normal text-faint">today</span>}
              </div>
              <div className="flex items-center justify-between gap-4 text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <i className="size-2 rounded-[2px] bg-brand" />
                  Confirmed
                </span>
                <b className="font-medium text-foreground tabular">{fmtNum(act.confirmed)}</b>
              </div>
              <div className="flex items-center justify-between gap-4 text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <i className="size-2 rounded-[2px] bg-warning opacity-55" />
                  Pending
                </span>
                <b className="font-medium text-foreground tabular">{fmtNum(act.pending)}</b>
              </div>
            </div>
          )}
          {total === 0 && (
            <div className="absolute inset-0 grid place-items-center text-xs text-faint">{emptyLabel}</div>
          )}
        </div>
      </div>
      <div aria-hidden className="flex justify-between pt-1.5 pl-[30px] text-[10.5px] text-faint">
        {labelIdx.map((i, k) => (
          <span key={`${i}-${k}`}>{data[i] ? (i === n - 1 ? "Today" : shortDay(data[i].day)) : ""}</span>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {act ? `${shortDay(act.day)}: ${act.confirmed} confirmed, ${act.pending} pending` : ""}
      </p>
    </div>
  );
}

/** Legend matching the chart colours. Place in a PanelHeader. */
export function ChartLegend() {
  return (
    <>
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-normal text-muted-foreground">
        <i className="size-2 rounded-[2px] bg-brand" />
        Confirmed
      </span>
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-normal text-muted-foreground">
        <i className="size-2 rounded-[2px] bg-warning opacity-55" />
        Still pending
      </span>
    </>
  );
}
