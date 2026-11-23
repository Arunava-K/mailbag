import { Delta, KpiStrip, type KpiItem } from "@/components/KpiStrip";
import { fmtNum, fmtPct } from "@/lib/format";
import type { Stats } from "@/lib/api";

/** Builds the four Overview KPIs strictly from the stats payload. Missing data renders "—". */
export function KpiRow({ stats, range, staleTotal }: { stats?: Stats; range: number; staleTotal: number }) {
  const p = stats?.period;
  const pp = stats?.prev_period;
  const rate = p && p.signups > 0 ? p.confirmed / p.signups : null;
  const prevRate = pp && pp.signups > 0 ? pp.confirmed / pp.signups : null;

  const items: KpiItem[] = [
    {
      id: "confirmed",
      label: `Confirmed · last ${range}d`,
      value: p ? fmtNum(p.confirmed) : "—",
      detail:
        p && pp ? (
          <>
            <Delta value={p.confirmed - pp.confirmed} />{" "}
            <span className="text-faint">
              vs prior {range}d {fmtNum(pp.confirmed)}
            </span>
          </>
        ) : (
          <span className="text-faint">no comparison available</span>
        ),
    },
    {
      id: "pending",
      label: "Pending confirmation",
      value: stats ? fmtNum(stats.pending) : "—",
      detail:
        staleTotal > 0 ? (
          <span className="font-medium text-warning">{fmtNum(staleTotal)} older than 48h</span>
        ) : (
          <span className="text-faint">none older than 48h</span>
        ),
    },
    {
      id: "rate",
      label: "Confirm rate",
      value: rate === null ? "—" : fmtPct(rate),
      detail:
        rate === null ? (
          <span className="text-faint">no signups in this period</span>
        ) : (
          <>
            {prevRate !== null && <Delta value={(rate - prevRate) * 100} unit=" pts" digits={1} />}{" "}
            <span className="text-faint">of {fmtNum(p!.signups)} signups</span>
          </>
        ),
    },
    {
      id: "unsub",
      label: "Unsubscribed",
      value: stats ? fmtNum(stats.unsubscribed) : "—",
      detail: p ? <span className="text-faint">{fmtNum(p.unsubscribed)} from last {range}d signups</span> : undefined,
    },
  ];
  return <KpiStrip items={items} loading={!stats} />;
}
