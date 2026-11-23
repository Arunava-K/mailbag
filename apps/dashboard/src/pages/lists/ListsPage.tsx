import { useMemo } from "react";
import { Layers, Plus, SearchX, ServerCrash } from "lucide-react";
import { Btn } from "@/components/Btn";
import { EmptyState } from "@/components/EmptyState";
import { FilterInput } from "@/components/FilterInput";
import { Kbd } from "@/components/Kbd";
import { Panel } from "@/components/Panel";
import { Segmented } from "@/components/Segmented";
import { Sparkline } from "@/components/Sparkline";
import { StatusDot } from "@/components/StatusLabel";
import { Tag } from "@/components/Tag";
import { TypeDot, typeLabel } from "@/components/TypeDot";
import { Page } from "@/components/shell/Page";
import { useShell } from "@/components/shell/ShellContext";
import { Table, TableScroll, Td, Th, Tr } from "@/components/table/Table";
import { Skeleton } from "@/components/ui/skeleton";
import type { ListType } from "@/lib/api";
import { fmtNum, parseTs, shortDate } from "@/lib/format";
import { useLists, useStats } from "@/lib/queries";
import { Link, navigate, useSearchParams } from "@/lib/router";
import { paths } from "@/lib/routes";
import { cn } from "@/lib/utils";

type TypeFilter = "all" | ListType;

/** /lists: every list with counts and a 30-day sparkline. Filters live in the URL (`type`, `q`). */
export function ListsPage() {
  const [params, setParams] = useSearchParams();
  const { setNewListOpen } = useShell();
  const lists = useLists();
  const stats = useStats(30);
  const type: TypeFilter = params.get("type") === "newsletter" || params.get("type") === "waitlist" ? (params.get("type") as ListType) : "all";
  const q = params.get("q") ?? "";

  const all = lists.data ?? [];
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (l) => (type === "all" || l.type === type) && (!needle || l.name.toLowerCase().includes(needle) || l.list_key.toLowerCase().includes(needle)),
    );
  }, [all, type, q]);
  const count = (t: ListType) => all.filter((l) => l.type === t).length;

  const newBtn = (
    <Btn variant="primary" onClick={() => setNewListOpen(true)}>
      <Plus />
      New list
      <Kbd onAccent className="max-sm:hidden">C</Kbd>
    </Btn>
  );
  const crumbs = [{ label: "Lists" }];

  if (lists.isError && !lists.data) {
    return (
      <Page crumbs={crumbs}>
        <Panel>
          <EmptyState
            tone="error"
            icon={ServerCrash}
            title="Couldn't load lists"
            description={lists.error instanceof Error ? lists.error.message : undefined}
            action={<Btn onClick={() => void lists.refetch()}>Retry</Btn>}
          />
        </Panel>
      </Page>
    );
  }
  if (lists.isSuccess && all.length === 0) {
    return (
      <Page crumbs={crumbs}>
        <Panel>
          <EmptyState
            icon={Layers}
            title="No lists yet"
            description="A list is one signup form. Create a newsletter or a waitlist, paste its embed snippet on your site, and confirmed signups show up here."
            action={newBtn}
          />
        </Panel>
      </Page>
    );
  }

  return (
    <Page crumbs={crumbs} actions={newBtn}>
      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented<TypeFilter>
          ariaLabel="List type"
          value={type}
          onChange={(v) => setParams({ type: v === "all" ? null : v }, { replace: false })}
          options={[
            { value: "all", label: "All", count: lists.data ? all.length : undefined },
            { value: "newsletter", label: "Newsletters", count: lists.data ? count("newsletter") : undefined },
            { value: "waitlist", label: "Waitlists", count: lists.data ? count("waitlist") : undefined },
          ]}
        />
        <FilterInput
          value={q}
          onChange={(e) => setParams({ q: e.target.value })}
          placeholder="Filter by name or key…"
          aria-label="Filter lists by name or key"
        />
      </div>
      <Panel className="min-w-0 overflow-hidden">
        {lists.isPending ? (
          <div className="space-y-2 p-3.5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            compact
            icon={SearchX}
            title="No lists match"
            description="Try a different type or search."
            action={<Btn size="sm" onClick={() => setParams({ type: null, q: null }, { replace: false })}>Clear filters</Btn>}
          />
        ) : (
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th right>Confirmed</Th>
                  <Th right>Pending</Th>
                  <Th right>Unsubscribed</Th>
                  <Th>Created</Th>
                  <Th className="w-[112px]">30d signups</Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => {
                  const s = stats.data?.list_series?.[l.list_key];
                  return (
                    <Tr key={l.list_key} className="cursor-pointer" onClick={() => navigate(paths.list(l.list_key))}>
                      <Td>
                        <Link
                          to={paths.list(l.list_key)}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-2 rounded-sm font-medium hover:underline"
                        >
                          <TypeDot type={l.type} />
                          {l.name}
                        </Link>
                      </Td>
                      <Td>
                        <Tag>{typeLabel[l.type]}</Tag>
                      </Td>
                      <Td num>{fmtNum(l.confirmed)}</Td>
                      <Td num className={cn(l.stale_pending > 0 ? "font-medium text-warning" : l.pending === 0 && "text-muted-foreground")}>
                        <span className="inline-flex items-center gap-1.5">
                          {l.stale_pending > 0 && (
                            <span title={`${l.stale_pending} pending for more than 48 hours`} className="inline-flex">
                              <StatusDot tone="warn" />
                              <span className="sr-only">{l.stale_pending} stale</span>
                            </span>
                          )}
                          {fmtNum(l.pending)}
                        </span>
                      </Td>
                      <Td num className="text-muted-foreground">
                        {fmtNum(l.unsubscribed)}
                      </Td>
                      <Td className="text-muted-foreground">{shortCreated(l.created_at)}</Td>
                      <Td>
                        {s ? (
                          <Sparkline
                            width={88}
                            values={s}
                            label={`${l.name}: ${fmtNum(s.reduce((a, b) => a + b, 0))} confirmed signups in the last 30 days`}
                          />
                        ) : stats.isPending ? (
                          <Skeleton className="h-4 w-[88px]" />
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </Panel>
    </Page>
  );
}

function shortCreated(iso: string): string {
  const d = parseTs(iso);
  return d ? shortDate(d) : "—";
}
