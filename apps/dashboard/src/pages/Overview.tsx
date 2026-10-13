import { useEffect, useState } from "react";
import { ChevronRight, CircleCheck, Hourglass, Mails, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "../components/app-shell";
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
  pill,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  footnote?: string;
  pill?: string;
}) {
  const v = useCountUp(value);
  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-4 md:gap-8">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg border">
            <Icon className="size-4 text-muted-foreground" />
          </span>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[2rem] leading-none font-semibold tabular-nums">{v}</p>
          {pill ? (
            <p className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-xl bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                <TrendingUp className="size-3" />
                {pill}
              </span>
            </p>
          ) : (
            footnote && (
              <p className="text-xs font-medium text-muted-foreground">{footnote}</p>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PipeNode({ title, sub, count, tone }: { title: string; sub: string; count: number; tone: "zinc" | "amber" | "green" | "primary" }) {
  const dot = tone === "amber" ? "bg-amber-500" : tone === "green" ? "bg-emerald-500" : tone === "primary" ? "bg-primary" : "bg-muted-foreground";
  return (
    <div className="relative w-44 shrink-0 rounded-xl border bg-card px-4 py-3 shadow-sm">
      <span className={`absolute top-1/2 -left-1 size-2 -translate-y-1/2 rounded-full ${dot}`} />
      <span className={`absolute top-1/2 -right-1 size-2 -translate-y-1/2 rounded-full ${dot}`} />
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{count}</p>
    </div>
  );
}

function PipeLink() {
  return <div className="h-px w-8 shrink-0 bg-border md:w-12" />;
}

function PipelinePanel({ stats, total }: { stats: Stats; total: number }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Live Signup Pipeline</h2>
      <div className="relative overflow-hidden rounded-3xl border bg-secondary">
        <div className="pipeline-dots absolute inset-0" />
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
              <span className="relative size-full rounded-full bg-success" />
            </span>
            <span className="text-sm text-success">Live Pipeline</span>
          </span>
          <span className="hidden items-center rounded-xl border bg-card px-3 py-2 text-sm font-medium text-primary md:flex">
            Pipeline: Double opt-in standard v1
          </span>
        </div>
        <div className="no-scrollbar relative flex items-center overflow-x-auto px-6 pt-24 pb-10">
          <div className="mx-auto flex min-w-max items-center">
            <PipeNode title="Subscribe" sub="forms + API" count={total} tone="zinc" />
            <PipeLink />
            <PipeNode title="Pending" sub="awaiting confirm" count={stats.pending} tone="amber" />
            <PipeLink />
            <PipeNode title="Confirmed" sub="double opt-in" count={stats.confirmed} tone="green" />
            <PipeLink />
            <PipeNode title="Welcome sent" sub="post-confirm mail" count={stats.confirmed} tone="primary" />
          </div>
        </div>
      </div>
    </section>
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
  goContacts,
}: {
  stats: Stats | null;
  lists: MailList[];
  loading: boolean;
  adminKey: string;
  openList: (k: string) => void;
  onNewList: () => void;
  goContacts: () => void;
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
      <>
        <PageHeader title="Overview" sub="Signup activity across all lists." />
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
      </>
    );
  }

  if (!stats) {
    return (
      <>
        <PageHeader title="Overview" sub="Signup activity across all lists." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm font-medium">Couldn't reach the API.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Check the connection in Settings — the API URL or key may be wrong.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  if (lists.length === 0) {
    return (
      <>
        <PageHeader title="Overview" sub="Signup activity across all lists." />
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
      </>
    );
  }

  const total = stats.confirmed + stats.pending;
  const fortnight = stats.by_day.reduce((n, d) => n + d.count, 0);
  const newsletters = lists.filter((l) => l.type === "newsletter").length;
  const waitlists = lists.filter((l) => l.type === "waitlist").length;
  return (
    <>
      <PageHeader title="Overview" sub="Signup activity across all lists." />
      <div className="flex flex-col gap-10">
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MetricCard
            icon={Mails}
            label="Lists"
            value={stats.lists}
            footnote={stats.lists > 0 ? `${newsletters} newsletter${newsletters === 1 ? "" : "s"} · ${waitlists} waitlist${waitlists === 1 ? "" : "s"}` : undefined}
          />
          <MetricCard
            icon={CircleCheck}
            label="Confirmed"
            value={stats.confirmed}
            pill={fortnight > 0 ? `+${fortnight} in 14 days` : undefined}
            footnote={fortnight === 0 && total > 0 ? `${Math.round((stats.confirmed / total) * 100)}% of all contacts` : undefined}
          />
          <MetricCard icon={Hourglass} label="Awaiting confirmation" value={stats.pending} />
          <MetricCard
            icon={Users}
            label="Total contacts"
            value={total}
            footnote={total > 0 ? `${stats.confirmed} confirmed · ${stats.pending} pending` : undefined}
          />
        </section>
        <PipelinePanel stats={stats} total={total} />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-lg font-medium">Recent signups</h2>
              <Button variant="secondary" size="sm" onClick={goContacts}>
                See all <ChevronRight className="size-4" />
              </Button>
            </div>
            <Card>
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
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">Confirmed — last 14 days</h2>
          <Card>
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
        </section>
      </div>
      </div>
    </>
  );
}
