import { Fragment, useCallback, useEffect, useState } from "react";
import { Check, MoreHorizontal, Search, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, type Contact } from "../lib/api";
import { fullTime, relTime } from "../lib/format";
import type { ToastFn } from "../lib/toast";
import { cn } from "@/lib/utils";

const PAGE = 25;
const statuses = ["", "confirmed", "pending", "unsubscribed"] as const;

function statusVariant(s: string): "default" | "secondary" | "outline" {
  if (s === "confirmed") return "default";
  if (s === "pending") return "secondary";
  return "outline";
}

function MetadataDetail({ c }: { c: Contact }) {
  let pretty = c.metadata || "{}";
  try {
    pretty = JSON.stringify(JSON.parse(c.metadata || "{}"), null, 2);
  } catch {
    // not JSON — show raw
  }
  return (
    <div className="flex flex-col gap-1 px-2 py-2 text-xs text-muted-foreground md:flex-row md:items-start md:gap-6">
      {c.position > 0 && (
        <div>
          <span className="font-medium">Position</span>
          <p className="tabular-nums">{c.position}</p>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <span className="font-medium">Metadata</span>
        <pre className="mt-0.5 max-h-32 overflow-auto rounded-md bg-muted/60 p-2 font-mono text-[11px] whitespace-pre-wrap">{pretty}</pre>
      </div>
    </div>
  );
}

/** Shared paged contacts table used by list detail + global contacts screen. */
export function ContactsTable({
  listKey,
  adminKey,
  toast,
  initialQ = "",
  refresh,
}: {
  listKey: string;
  adminKey: string;
  toast: ToastFn;
  initialQ?: string;
  /** Called after a mutation so parent counts stay in sync. */
  refresh?: () => void;
}) {
  const [status, setStatus] = useState<(typeof statuses)[number]>("");
  const [q, setQ] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setPage(0);
    setQ(initialQ);
    setDebouncedQ(initialQ);
    setOpen(null);
  }, [listKey, initialQ]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.contacts(adminKey, { listKey, status: status || undefined, q: debouncedQ || undefined, limit: PAGE, offset: page * PAGE });
      setTotal(r.total);
      setRows(r.contacts);
    } catch (e) {
      toast(e instanceof Error ? e.message : "load failed", "err");
    } finally {
      setLoading(false);
    }
  }, [adminKey, listKey, status, debouncedQ, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE));

  const act = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast(label);
      await load();
      refresh?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "action failed", "err");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex gap-1">
          {statuses.map((s) => (
            <button
              key={s || "all"}
              type="button"
              onClick={() => {
                setStatus(s);
                setPage(0);
              }}
              aria-pressed={status === s}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {s || "all"}
            </button>
          ))}
        </div>
        <InputGroup className="h-9 border-none bg-secondary px-3 md:ml-auto md:max-w-56">
          <InputGroupAddon className="pl-0">
            <Search className="size-4 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search contacts"
            placeholder="Search email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </InputGroup>
      </div>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confirmed</TableHead>
              <TableHead className="hidden lg:table-cell">Added</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              [0, 1, 2, 3, 4].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              rows.map((c) => (
                <Fragment key={c.email}>
                <TableRow className="cursor-pointer" onClick={() => setOpen(open === c.email ? null : c.email)}>
                  <TableCell className="font-mono text-xs">{c.email}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground" title={fullTime(c.confirmed_at)}>
                    {relTime(c.confirmed_at)}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground lg:table-cell" title={fullTime(c.created_at)}>
                    {relTime(c.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Actions for ${c.email}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {c.status !== "confirmed" && (
                          <DropdownMenuItem onClick={() => act("Contact confirmed", () => api.confirmContact(adminKey, listKey, c.email))}>
                            <Check className="size-3.5" /> Confirm now
                          </DropdownMenuItem>
                        )}
                        {c.status !== "confirmed" && (
                          <DropdownMenuItem onClick={() => act("Confirmation email sent", () => api.resendContact(adminKey, listKey, c.email))}>
                            <Send className="size-3.5" /> Resend confirmation
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => act("Contact deleted", () => api.deleteContact(adminKey, listKey, c.email))}
                        >
                          <Trash2 className="size-3.5" /> Delete contact
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                {open === c.email && (
                  <TableRow>
                    <TableCell colSpan={5} className="bg-muted/30 p-0">
                      <MetadataDetail c={c} />
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
              ))
            )}
            {rows.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No contacts match.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {loading ? "Loading…" : `${total} contact${total === 1 ? "" : "s"}`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <span className="text-xs tabular-nums">
            {page + 1} / {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
