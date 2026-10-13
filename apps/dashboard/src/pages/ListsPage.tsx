import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ListForm } from "../components/ListForm";
import { api, type CreateListInput, type MailList } from "../lib/api";
import { cn } from "@/lib/utils";
import type { Toast } from "../lib/toast";

const PAGE = 15;
type TypeFilter = "all" | "newsletter" | "waitlist";
const filters: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "newsletter", label: "Newsletters" },
  { value: "waitlist", label: "Waitlists" },
];

export function ListsPage({
  lists,
  adminKey,
  toast,
  refresh,
  loading,
  starred,
  onToggleStar,
  openList,
  createNonce,
}: {
  lists: MailList[];
  adminKey: string;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  refresh: () => void;
  loading: boolean;
  starred: string[];
  onToggleStar: (k: string) => void;
  openList: (k: string) => void;
  createNonce: number;
}) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (createNonce > 0) setCreating(true);
  }, [createNonce]);

  useEffect(() => {
    setPage(1);
  }, [q, typeFilter, lists.length]);

  const counts = useMemo(
    () => ({
      all: lists.length,
      newsletter: lists.filter((l) => l.type === "newsletter").length,
      waitlist: lists.filter((l) => l.type === "waitlist").length,
    }),
    [lists],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lists.filter((l) => {
      if (typeFilter !== "all" && l.type !== typeFilter) return false;
      return (
        needle === "" ||
        l.name.toLowerCase().includes(needle) ||
        l.list_key.toLowerCase().includes(needle)
      );
    });
  }, [lists, q, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE, currentPage * PAGE);

  const create = async (v: CreateListInput) => {
    setSaving(true);
    try {
      const r = await api.createList(adminKey, v);
      setCreating(false);
      toast(`Created ${r.name}`);
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "create failed", "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <InputGroup className="h-10 border-none bg-secondary px-3 lg:max-w-xs">
          <InputGroupAddon className="pl-0">
            <Search className="size-4 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search lists"
            placeholder="Search name or key…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </InputGroup>
        <div className="flex items-center gap-1 rounded-lg border bg-secondary p-0.5">
          {filters.map((f) => {
            const active = typeFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setTypeFilter(f.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "rounded px-1.5 text-xs tabular-nums",
                    active ? "bg-background text-primary" : "bg-background text-foreground",
                  )}
                >
                  {counts[f.value]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm font-medium">
              {lists.length === 0 ? "No lists yet" : "No lists match"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {lists.length === 0
                ? "Create your first list to get an embed key for your site."
                : "Try a different search or filter."}
            </p>
            {lists.length === 0 && (
              <Button onClick={() => setCreating(true)} className="mt-1">
                <Plus className="size-4" /> New list
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>List</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Confirmed</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="w-10" />
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow
                    key={l.list_key}
                    className="cursor-pointer"
                    onClick={() => openList(l.list_key)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white",
                            l.type === "waitlist" ? "bg-violet-500" : "bg-emerald-500",
                          )}
                        >
                          {l.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{l.name}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {l.list_key}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{l.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.confirmed}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.pending}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        aria-label={starred.includes(l.list_key) ? "Unstar list" : "Star list"}
                        aria-pressed={starred.includes(l.list_key)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStar(l.list_key);
                        }}
                        className="rounded-md p-1.5 hover:bg-accent"
                      >
                        <Star
                          className={cn(
                            "size-4",
                            starred.includes(l.list_key)
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground",
                          )}
                        />
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">→</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Showing {rows.length} of {filtered.length}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <span className="text-xs tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New list</DialogTitle>
          </DialogHeader>
          <ListForm saving={saving} submitLabel="Create" onSubmit={create} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
