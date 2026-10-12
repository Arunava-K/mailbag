import { motion } from "motion/react";
import type { MailList, Stats } from "../lib/api";
import { Badge, Empty, Stat } from "../components/ui";

function Bars({ byDay }: { byDay: { day: string; count: number }[] }) {
  const max = Math.max(1, ...byDay.map((d) => d.count));
  const days = last14Labels();
  const map = new Map(byDay.map((d) => [d.day, d.count]));
  return (
    <div className="flex h-32 items-end gap-1.5">
      {days.map((d) => {
        const v = map.get(d) ?? 0;
        return (
          <div key={d} className="flex flex-1 flex-col items-center gap-1" title={`${d}: ${v}`}>
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
              className="w-full origin-bottom rounded-sm bg-zinc-100/80"
            />
            <span className="text-[9px] text-zinc-600">{d.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

function last14Labels(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function Overview({ stats, lists, loading }: { stats: Stats | null; lists: MailList[]; loading: boolean }) {
  if (!stats) {
    return <Empty>{loading ? "Loading…" : "No data. Check the API connection in Settings."}</Empty>;
  }
  const total = stats.confirmed + stats.pending;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Lists" value={stats.lists} />
        <Stat label="Confirmed" value={stats.confirmed} sub={total ? `${Math.round((stats.confirmed / Math.max(1, total)) * 100)}% of all contacts` : undefined} />
        <Stat label="Pending confirm" value={stats.pending} />
        <Stat label="Total contacts" value={total} />
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="mb-3 text-sm font-medium text-zinc-300">Confirmations · last 14 days</h3>
        <Bars byDay={stats.by_day} />
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="mb-3 text-sm font-medium text-zinc-300">Lists</h3>
        <div className="divide-y divide-zinc-800">
          {lists.map((l) => {
            const t = l.confirmed + l.pending;
            return (
              <div key={l.list_key} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-zinc-100">{l.name}</div>
                  <div className="mt-0.5 h-1 overflow-hidden rounded bg-zinc-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${t ? (l.confirmed / t) * 100 : 0}%` }}
                      className="h-full bg-emerald-500/80"
                    />
                  </div>
                </div>
                <Badge>{l.type}</Badge>
                <span className="w-20 text-right text-sm tabular-nums text-zinc-300">{l.confirmed}</span>
              </div>
            );
          })}
          {lists.length === 0 && <p className="py-2 text-sm text-zinc-500">No lists yet.</p>}
        </div>
      </div>
    </div>
  );
}
