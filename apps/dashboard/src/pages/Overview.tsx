import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Stat } from "../components/ui";
import { api, type MailList, type Stats } from "../lib/api";

interface Recent {
  email: string;
  status: string;
  at: string;
  list: string;
}

export function Overview({
  stats, lists, loading, adminKey, openList,
}: {
  stats: Stats | null;
  lists: MailList[];
  loading: boolean;
  adminKey: string;
  openList: (k: string) => void;
}) {
  const [recent, setRecent] = useState<Recent[]>([]);

  useEffect(() => {
    let live = true;
    if (lists.length === 0) {
      setRecent([]);
      return;
    }
    Promise.all(
      lists.slice(0, 12).map((l) =>
        api.contacts(adminKey, { listKey: l.list_key, limit: 6, offset: 0 }).then((r) =>
          r.contacts.map((c) => ({ email: c.email, status: c.status, at: c.created_at, list: l.name })),
        ).catch(() => [] as Recent[]),
      ),
    ).then((groups) => {
      if (!live) return;
      setRecent(groups.flat().sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 10));
    });
    return () => {
      live = false;
    };
  }, [lists, adminKey]);

  if (!stats) return <Empty>{loading ? "Loading…" : "No data. Check the API connection in Settings."}</Empty>;
  const total = stats.confirmed + stats.pending;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Lists" value={stats.lists} />
        <Stat label="Confirmed" value={stats.confirmed} />
        <Stat label="Pending confirm" value={stats.pending} />
        <Stat label="Total contacts" value={total} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Recent signups">
          {recent.length === 0 ? (
            <p className="text-[13px] text-zinc-400">Nothing yet.</p>
          ) : (
            <div className="space-y-1">
              {recent.map((r) => (
                <div key={`${r.list}-${r.email}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.status === "confirmed" ? "bg-emerald-500" : r.status === "pending" ? "bg-amber-500" : "bg-zinc-300"}`} />
                  <span className="truncate font-mono text-xs text-zinc-800">{r.email}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-zinc-400">{r.list}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Lists" action={<span className="text-xs text-zinc-400">{lists.length}</span>}>
          <div className="divide-y divide-zinc-100">
            {lists.map((l) => (
              <button key={l.list_key} onClick={() => openList(l.list_key)} className="flex w-full items-center gap-2 py-2 text-left hover:bg-zinc-50">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-800">{l.name}</span>
                <Badge>{l.type}</Badge>
                <span className="w-16 text-right text-[13px] tabular-nums text-zinc-500">{l.confirmed}</span>
              </button>
            ))}
            {lists.length === 0 && <p className="py-2 text-[13px] text-zinc-400">No lists yet.</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
