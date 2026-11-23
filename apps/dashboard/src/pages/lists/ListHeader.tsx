import { Copy } from "lucide-react";
import { Tag } from "@/components/Tag";
import { TypeDot, typeLabel } from "@/components/TypeDot";
import type { MailList } from "@/lib/api";
import { useCopy } from "@/lib/clipboard";
import { fmtNum, parseTs, shortDate } from "@/lib/format";
import { Link } from "@/lib/router";
import { LIST_TABS, paths, type ListTab } from "@/lib/routes";
import { cn } from "@/lib/utils";

export const tabLabel: Record<ListTab, string> = {
  contacts: "Contacts",
  activity: "Activity",
  embed: "Form & embed",
  email: "Welcome email",
  settings: "Settings",
};

/** The list key as a click-to-copy chip (truncated; the full key is copied). */
export function KeyChip({ listKey }: { listKey: string }) {
  const copy = useCopy();
  const short = listKey.length > 14 ? `${listKey.slice(0, 11)}…` : listKey;
  return (
    <button
      type="button"
      onClick={() => void copy(listKey, "List key")}
      aria-label={`Copy list key ${listKey}`}
      title={`${listKey} (click to copy)`}
      className="inline-flex h-7 items-center gap-1.5 rounded-[7px] bg-hover px-[9px] font-mono text-[11.5px] text-muted-foreground transition-colors hover:text-foreground max-sm:hidden"
    >
      {short}
      <Copy className="size-[13px]" aria-hidden />
    </button>
  );
}

/** Title, meta line and tab links shown above every list tab. */
export function ListHeader({ list, tab }: { list: MailList; tab: ListTab }) {
  const created = parseTs(list.created_at);
  const total = list.confirmed + list.pending + list.unsubscribed;
  return (
    <div className="shrink-0 border-b border-line px-3 pt-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <TypeDot type={list.type} className="size-[9px]" />
        <h1 className="mr-1 min-w-0 truncate text-lg font-semibold tracking-tight">{list.name}</h1>
        <Tag>{typeLabel[list.type]}</Tag>
        <Tag>{list.provider === "plunk" ? "Plunk" : "SMTP"}</Tag>
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] text-muted-foreground">
        <span>
          <b className="font-medium text-foreground tabular">{fmtNum(list.confirmed)}</b> confirmed
        </span>
        <Sep />
        <span>
          <b className={cn("font-medium tabular", list.pending > 0 ? "text-warning" : "text-foreground")}>{fmtNum(list.pending)}</b> pending
        </span>
        <Sep />
        <span>
          <b className="font-medium text-foreground tabular">{fmtNum(list.unsubscribed)}</b> unsubscribed
        </span>
        {list.sender_email && (
          <>
            <Sep />
            <span>from {list.sender_email}</span>
          </>
        )}
        {created && (
          <>
            <Sep />
            <span>created {shortDate(created)}</span>
          </>
        )}
      </p>
      <nav aria-label="List sections" className="-mb-px mt-3.5 flex gap-[18px] overflow-x-auto">
        {LIST_TABS.map((t) => (
          <Link
            key={t}
            to={paths.list(list.list_key, t)}
            aria-current={t === tab ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-sm border-b-2 border-transparent pb-[9px] font-medium text-muted-foreground transition-colors hover:text-foreground",
              t === tab && "border-foreground text-foreground",
            )}
          >
            {tabLabel[t]}
            {t === "contacts" && <span className="ml-1 text-[11.5px] font-normal text-faint tabular">{fmtNum(total)}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}

const Sep = () => (
  <span aria-hidden className="text-faint">
    ·
  </span>
);
