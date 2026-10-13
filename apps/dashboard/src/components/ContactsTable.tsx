import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

/** Shared paged contacts table used by list detail + global contacts screen. */
export function ContactsTable({
  listKey,
  adminKey,
  toast,
  initialQ = "",
}: {
  listKey: string;
  adminKey: string;
  toast: ToastFn;
  initialQ?: string;
}) {
  const [status, setStatus] = useState<(typeof statuses)[number]>("");
  const [q, setQ] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPage(0);
    setQ(initialQ);
    setDebouncedQ(initialQ);
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              [0, 1, 2, 3, 4].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-6" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              rows.map((c) => (
                <TableRow key={c.email}>
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
                </TableRow>
              ))
            )}
            {rows.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
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
