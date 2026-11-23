import { Activity as ActivityIcon, Mail, Plus, ServerCrash } from "lucide-react";
import { Btn, LinkBtn } from "@/components/Btn";
import { ActivityFeed } from "@/components/ActivityFeed";
import { EmptyState } from "@/components/EmptyState";
import { Kbd } from "@/components/Kbd";
import { Panel, PanelHeader } from "@/components/Panel";
import { Segmented } from "@/components/Segmented";
import { ChartLegend, StackedBarChart } from "@/components/StackedBarChart";
import { Page } from "@/components/shell/Page";
import { useShell } from "@/components/shell/ShellContext";
import { Skeleton } from "@/components/ui/skeleton";
import { STATS_RANGES, type StatsRange } from "@/lib/api";
import { useSearchParams } from "@/lib/router";
import { paths } from "@/lib/routes";
import { useActivity, useLists, useStats } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { KpiRow } from "./KpiRow";
import { ListsTable } from "./ListsTable";
import { NeedsAttention } from "./NeedsAttention";

function parseRange(v: string | null): StatsRange {
  const n = Number(v);
  return (STATS_RANGES as readonly number[]).includes(n) ? (n as StatsRange) : 30;
}

export function OverviewPage() {
  const [params, setParams] = useSearchParams();
  const range = parseRange(params.get("range"));
  const { setNewListOpen } = useShell();

  const lists = useLists();
  const stats = useStats(range);
  const activity = useActivity({ limit: 8 });

  const actions = (
    <>
      <Segmented<`${StatsRange}`>
        ariaLabel="Date range"
        value={`${range}`}
        onChange={(v) => setParams({ range: v === "30" ? null : v })}
        options={STATS_RANGES.map((r) => ({ value: `${r}` as const, label: `${r}d` }))}
      />
      <Btn variant="primary" onClick={() => setNewListOpen(true)}>
        <Plus />
        New list
        <Kbd onAccent className="max-sm:hidden">
          C
        </Kbd>
      </Btn>
    </>
  );
  const crumbs = [{ label: "Overview" }];

  // Both core queries failed and nothing is cached: the API is unreachable or the key was revoked.
  if (lists.isError && stats.isError && !lists.data && !stats.data) {
    const msg = lists.error instanceof Error ? lists.error.message : "request failed";
    return (
      <Page crumbs={crumbs} actions={actions}>
        <Panel>
          <EmptyState
            tone="error"
            icon={ServerCrash}
            title="Can't load data from the API"
            description={`${msg}. Check that the API is running and reachable, then retry.`}
            action={
              <Btn
                onClick={() => {
                  void lists.refetch();
                  void stats.refetch();
                  void activity.refetch();
                }}
              >
                Retry
              </Btn>
            }
          />
        </Panel>
      </Page>
    );
  }

  if (lists.isSuccess && lists.data.length === 0) {
    return (
      <Page crumbs={crumbs} actions={actions}>
        <Panel>
          <EmptyState
            icon={Mail}
            title="Create your first list"
            description="A list collects signups from your site's form with double opt-in. Make one, then paste its embed snippet on your page."
            action={
              <Btn variant="primary" onClick={() => setNewListOpen(true)}>
                <Plus />
                New list
                <Kbd onAccent>C</Kbd>
              </Btn>
            }
          />
        </Panel>
      </Page>
    );
  }

  const staleTotal = (lists.data ?? []).reduce((s, l) => s + l.stale_pending, 0);
  const s = stats.data;
  const bars = s?.series?.map((d) => ({ day: d.day, confirmed: d.confirmed, pending: d.pending }));
  const events = activity.data?.events ?? [];

  return (
    <Page crumbs={crumbs} actions={actions}>
      <KpiRow stats={s} range={range} staleTotal={staleTotal} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
        <Panel className={cn("min-w-0", stats.isPlaceholderData && "opacity-60 transition-opacity")}>
          <PanelHeader title="Signups" sub="per day, all lists, excludes unsubscribed">
            <span className="flex items-center gap-2.5">
              <ChartLegend />
            </span>
          </PanelHeader>
          {stats.isPending ? (
            <div className="p-3.5">
              <Skeleton className="h-[150px] w-full" />
            </div>
          ) : bars ? (
            <StackedBarChart data={bars} />
          ) : (
            <EmptyState
              compact
              title={stats.isError ? "Couldn't load signups" : "No daily breakdown from this API version"}
              description={stats.isError ? "Check the API connection." : "Update the API to see the signups chart."}
              action={stats.isError ? <Btn size="sm" onClick={() => void stats.refetch()}>Retry</Btn> : undefined}
            />
          )}
        </Panel>
        <NeedsAttention lists={lists.data ?? []} loading={lists.isPending} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
        <ListsTable lists={lists.data ?? []} series={s?.list_series} range={range} loading={lists.isPending} />
        <Panel className="min-w-0">
          <PanelHeader
            title="Activity"
            actions={
              <LinkBtn to={paths.activity()} variant="ghost" size="sm">
                View all
              </LinkBtn>
            }
          />
          {activity.isPending ? (
            <div className="space-y-2 p-3.5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : activity.isError ? (
            <EmptyState
              compact
              tone="error"
              title="Couldn't load activity"
              action={<Btn size="sm" onClick={() => void activity.refetch()}>Retry</Btn>}
            />
          ) : events.length === 0 ? (
            <EmptyState compact icon={ActivityIcon} title="No activity yet" description="Signups, confirmations and unsubscribes will show up here." />
          ) : (
            <ActivityFeed events={events} />
          )}
        </Panel>
      </div>
    </Page>
  );
}
