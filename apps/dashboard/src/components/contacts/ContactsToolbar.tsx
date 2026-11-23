import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MailList } from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { IconBtn } from "../Btn";
import { FilterInput } from "../FilterInput";
import { Segmented } from "../Segmented";
import { PAGE_SIZE, type StatusFilter } from "./useContactsView";

/** Local text state that commits to the URL after a pause, and follows the URL when it changes elsewhere (back button). */
function useDebouncedField(urlValue: string, commit: (v: string) => void, ms = 300) {
  const [draft, setDraft] = useState(urlValue);
  const committed = useRef(urlValue);
  const latest = useRef(commit);
  latest.current = commit;

  useEffect(() => {
    if (urlValue !== committed.current) {
      committed.current = urlValue;
      setDraft(urlValue);
    }
  }, [urlValue]);

  useEffect(() => {
    if (draft === committed.current) return;
    const t = setTimeout(() => {
      committed.current = draft;
      latest.current(draft);
    }, ms);
    return () => clearTimeout(t);
  }, [draft, ms]);

  return [draft, setDraft] as const;
}

export interface Counts {
  all: number;
  confirmed: number;
  pending: number;
  unsubscribed: number;
  stale: number;
}

/** Status counts from the lists data: the scoped/filtered list, or every list summed. */
export function countsFor(lists: MailList[], listKey?: string): Counts {
  const src = listKey ? lists.filter((l) => l.list_key === listKey) : lists;
  const c = { confirmed: 0, pending: 0, unsubscribed: 0, stale: 0 };
  for (const l of src) {
    c.confirmed += l.confirmed;
    c.pending += l.pending;
    c.unsubscribed += l.unsubscribed;
    c.stale += l.stale_pending;
  }
  return { ...c, all: c.confirmed + c.pending + c.unsubscribed };
}

export function ContactsToolbar({
  status,
  onStatus,
  q,
  onQ,
  stale,
  onStale,
  counts,
  lists,
  listKey,
  onList,
  showListFilter,
  page,
  total,
  onPage,
  fetching,
}: {
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  q: string;
  onQ: (v: string) => void;
  stale: boolean;
  onStale: (on: boolean) => void;
  counts: Counts | null;
  lists: MailList[];
  listKey?: string;
  onList: (k: string) => void;
  showListFilter: boolean;
  page: number;
  total: number | null;
  onPage: (n: number) => void;
  fetching: boolean;
}) {
  const [draft, setDraft] = useDebouncedField(q, onQ);
  const from = total === null ? 0 : total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = total === null ? 0 : Math.min(total, page * PAGE_SIZE);
  const pages = total === null ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const n = (v: number | undefined) => (v === undefined ? undefined : fmtNum(v));

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 px-3 py-3 sm:px-5">
      <div className="max-w-full overflow-x-auto">
        <Segmented<StatusFilter>
          ariaLabel="Status"
          value={status}
          onChange={onStatus}
          options={[
            { value: "all", label: "All", count: n(counts?.all) },
            { value: "confirmed", label: "Confirmed", count: n(counts?.confirmed) },
            { value: "pending", label: "Pending", count: n(counts?.pending) },
            { value: "unsubscribed", label: "Unsubscribed", count: n(counts?.unsubscribed) },
          ]}
        />
      </div>
      <FilterInput
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Filter by email…"
        aria-label="Filter contacts by email"
        title="Status counts don't change with the email filter"
      />
      <button
        type="button"
        aria-pressed={stale}
        onClick={() => onStale(!stale)}
        title="Pending for more than 48 hours"
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
          stale ? "border-transparent bg-warning-soft text-warning" : "border-line bg-panel text-muted-foreground hover:text-foreground",
        )}
      >
        <i aria-hidden className="size-1.5 rounded-full bg-warning" />
        Stale pending
        {counts && counts.stale > 0 && <span className="font-normal tabular opacity-80">{fmtNum(counts.stale)}</span>}
      </button>
      {showListFilter && (
        <select
          aria-label="List"
          value={listKey ?? ""}
          onChange={(e) => onList(e.target.value)}
          className="h-7 max-w-44 rounded-[7px] border border-line bg-panel px-2 text-xs font-medium text-foreground outline-none focus-visible:border-brand"
        >
          <option value="">All lists</option>
          {lists.map((l) => (
            <option key={l.list_key} value={l.list_key}>
              {l.name}
            </option>
          ))}
        </select>
      )}
      <span className="flex-1" />
      <span className={cn("text-xs tabular text-faint", fetching && "opacity-60")} aria-live="polite">
        {total === null ? "" : total === 0 ? "0 contacts" : `${fmtNum(from)}–${fmtNum(to)} of ${fmtNum(total)}`}
      </span>
      <span className="flex gap-1.5">
        <IconBtn label="Previous page" className="border border-line" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft />
        </IconBtn>
        <IconBtn label="Next page" className="border border-line" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight />
        </IconBtn>
      </span>
    </div>
  );
}
