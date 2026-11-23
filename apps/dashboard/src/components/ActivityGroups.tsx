import { useMemo } from "react";
import { useSearchParams } from "@/lib/router";
import { Activity as ActivityIcon, ServerCrash } from "lucide-react";
import type { ActivityEvent, ActivityType } from "@/lib/api";
import { dayHeading, dayKey } from "@/lib/format";
import { useActivityFeed } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityFeed } from "./ActivityFeed";
import { Btn } from "./Btn";
import { EmptyState } from "./EmptyState";
import { Panel } from "./Panel";

export const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: "signup", label: "Signups" },
  { value: "confirmed", label: "Confirmed" },
  { value: "unsubscribed", label: "Unsubscribed" },
];

/** Event-type filter in the URL: `types=signup,confirmed` (absent = all). */
export function useActivityTypes(): [ActivityType[], (v: ActivityType[]) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("types");
  const types = useMemo(
    () => (raw ? raw.split(",").filter((t): t is ActivityType => ACTIVITY_TYPES.some((a) => a.value === t)) : []),
    [raw],
  );
  return [types, (v) => setParams({ types: v.length ? v.join(",") : null })];
}

/** Toggle chips (multi-select). Empty selection = all types. */
export function TypeChips({ value, onChange }: { value: ActivityType[]; onChange: (v: ActivityType[]) => void }) {
  return (
    <div role="group" aria-label="Event types" className="flex flex-wrap gap-1.5">
      {ACTIVITY_TYPES.map((t) => {
        const on = value.includes(t.value);
        return (
          <button
            key={t.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== t.value) : [...value, t.value])}
            className={cn(
              "h-7 rounded-[7px] border px-2.5 text-xs font-medium transition-colors",
              on ? "border-transparent bg-brand-soft text-brand" : "border-line bg-panel text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Day-grouped activity for one list or all lists, with "Load more" and 30s refresh of the first page.
 * `types` filters client-side over what has been fetched so far. Mount with key={listKey}.
 */
export function ActivityGroups({ listKey, types, showList = true }: { listKey?: string; types: ActivityType[]; showList?: boolean }) {
  const feed = useActivityFeed(listKey);
  const { first } = feed;

  const shown = useMemo(
    () => (types.length ? feed.events.filter((e) => types.includes(e.type)) : feed.events),
    [feed.events, types],
  );
  const groups = useMemo(() => {
    const out: { key: string; events: ActivityEvent[] }[] = [];
    for (const e of shown) {
      const k = dayKey(e.at);
      const last = out[out.length - 1];
      if (last && last.key === k) last.events.push(e);
      else out.push({ key: k, events: [e] });
    }
    return out;
  }, [shown]);

  if (first.isPending) {
    return (
      <Panel className="space-y-2 p-3.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </Panel>
    );
  }
  if (first.isError && feed.events.length === 0) {
    return (
      <Panel>
        <EmptyState
          tone="error"
          icon={ServerCrash}
          title="Couldn't load activity"
          description={first.error instanceof Error ? first.error.message : undefined}
          action={<Btn onClick={() => void first.refetch()}>Retry</Btn>}
        />
      </Panel>
    );
  }
  if (feed.events.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={ActivityIcon}
          title="No activity yet"
          description="Signups, confirmations and unsubscribes will show up here as they happen."
        />
      </Panel>
    );
  }

  const filtered = types.length > 0;
  return (
    <div className="flex flex-col gap-4">
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {feed.events.length} activity events loaded.
      </p>
      {groups.length === 0 ? (
        <Panel>
          <EmptyState
            compact
            title="No matching events in what's loaded"
            description={feed.hasMore ? "Older events may match. Load more to keep looking." : "Try another event type."}
          />
        </Panel>
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-label={dayHeading(g.key)}>
            <h3 className="mb-1.5 px-0.5 text-[11.5px] font-medium text-faint">{dayHeading(g.key)}</h3>
            <Panel>
              <ActivityFeed events={g.events} showList={showList} clock />
            </Panel>
          </section>
        ))
      )}
      <div className="flex flex-col items-center gap-2 pb-2">
        {filtered && (
          <p className="text-xs text-faint">
            Showing {shown.length} of {feed.events.length} loaded events
          </p>
        )}
        {feed.moreError && (
          <p role="alert" className="text-xs text-danger">
            Couldn't load more: {feed.moreError}
          </p>
        )}
        {feed.hasMore ? (
          <Btn onClick={() => void feed.loadMore()} disabled={feed.loadingMore}>
            {feed.loadingMore ? "Loading…" : "Load more"}
          </Btn>
        ) : (
          <p className="text-xs text-faint">That's everything.</p>
        )}
      </div>
    </div>
  );
}
