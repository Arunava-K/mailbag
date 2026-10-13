import { useEffect, useState } from "react";
import { CircleCheck, Hourglass, Mails, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "../hooks/useCountUp";
import { api, type MailList, type Stats } from "../lib/api";
import { fullTime, relTime } from "../lib/format";

interface Recent {
  email: string;
  status: string;
  at: string;
  list: string;
  listKey: string;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  footnote,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  footnote?: string;
}) {
  const v = useCountUp(value);
  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg border">
            <Icon className="size-4 text-muted-foreground" />
          </span>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        <div>
          <p className="text-3xl leading-none font-semibold tabular-nums">{v}</p>
          {footnote && (
            <p className="mt-2 text-xs font-medium text-muted-foreground">{footnote}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Sparkline({ days }: { days: { day: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="flex h-24 items-end gap-1.5" role="img" aria-label="Confirmed signups per day, last 14 days">
      {days.map((d) => (
        <div
          key={d.day}
          title={`${d.day}: ${d.count} confirmed`}
          className="flex-1 rounded-sm bg-primary/80"
          style={{ height: `${Math.max(6, Math.round((d.count / max) * 100))}%` }}
        />
      ))}
    </div>
  );
}

export function Overview({
  stats,
  lists,
  loading,
  adminKey,
  openList,
  onNewList,
}: {
  stats: Stats | null;
  lists: MailList[];
  loading: boolean;
  adminKey: string;
  openList: (k: string) => void;
  onNewList: () => void;
}) {
  const [recent, setRecent] = useState<Recent[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  useEffect(() => {
    let live = true;
    if (lists.length === 0) {
      setRecent([]);
      return;
    }
    setRecentLoading(true);
    Promise.all(
      lists.slice(0, 12).map((l) =>
        api.contacts(adminKey, { listKey: l.list_key, limit: 6, offset: 0 }).then((r) =>
          r.contacts.map((c) => ({ email: c.email, status: c.status, at: c.created_at, list: l.name, listKey: l.list_key })),
        ).catch(() => [] as Recent[]),
      ),
    ).then((groups) => {
      if (!live) return;
      setRecent(groups.flat().sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 10));
      setRecentLoading(false);
    });
    return () => {
      live = false;
    };
  }, [lists, adminKey]);

  if (loading && !stats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm font-medium">Couldn't reach the API.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Check the connection in Settings — the API URL or key may be wrong.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (lists.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <Mails className="size-5 text-primary" />
          </span>
          <p className="text-sm font-medium">No lists yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Create your first list to get an embed key, then paste the form snippet
            into any static site.
          </p>
          <Button onClick={onNewList} className="mt-1">Create your first list</Button>
        </CardContent>
      </Card>
    );
  }

  const total = stats.confirmed + stats.pending;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={Mails} label="Lists" value={stats.lists} />
        <MetricCard
          icon={CircleCheck}
          label="Confirmed"
          value={stats.confirmed}
          footnote={total > 0 ? `${Math.round((stats.confirmed / total) * 100)}% of all contacts` : undefined}
        />
        <MetricCard icon={Hourglass} label="Awaiting confirmation" value={stats.pending} />
        <MetricCard icon={Users} label="Total contacts" value={total} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent signups</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nothing yet — new signups will show up here.
              </p>
            ) : (
              <div className="space-y-1">
                {recent.map((r) => (
                  <button
                    key={`${r.listKey}-${r.email}`}
                    onClick={() => openList(r.listKey)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.status === "confirmed" ? "bg-emerald-500" : r.status === "pending" ? "bg-amber-500" : "bg-zinc-300"}`}
                    />
                    <span className="truncate font-mono text-xs">{r.email}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-muted-foreground" title={fullTime(r.at)}>
                      {r.list} · {relTime(r.at)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Confirmed — last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.by_day.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No confirmations in the last 14 days.
              </p>
            ) : (
              <Sparkline days={stats.by_day} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
