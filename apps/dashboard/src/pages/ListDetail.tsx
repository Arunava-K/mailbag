import { useEffect, useState } from "react";
import { Copy, Download, Send, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactsTable } from "../components/ContactsTable";
import { ListForm } from "../components/ListForm";
import { api, embedSnippet, type CreateListInput, type MailList } from "../lib/api";
import { fullTime, relTime } from "../lib/format";
import type { ToastFn } from "../lib/toast";
import { cn } from "@/lib/utils";

type Tab = "contacts" | "activity" | "embed" | "settings";

function Activity({ listKey, adminKey, toast }: { listKey: string; adminKey: string; toast: ToastFn }) {
  const [groups, setGroups] = useState<{ day: string; items: { email: string; status: string; at: string }[] }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    api
      .contacts(adminKey, { listKey, limit: 200, offset: 0 })
      .then((r) => {
        if (!live) return;
        const map = new Map<string, { email: string; status: string; at: string }[]>();
        for (const c of r.contacts) {
          const day = c.created_at.slice(0, 10);
          if (!map.has(day)) map.set(day, []);
          map.get(day)!.push({ email: c.email, status: c.status, at: c.created_at });
        }
        setGroups([...map.entries()].map(([day, items]) => ({ day, items })).sort((a, b) => (a.day < b.day ? 1 : -1)));
      })
      .catch((e) => toast(e instanceof Error ? e.message : "load failed", "err"))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [listKey, adminKey, toast]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
    );
  }
  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No signups yet — use the Embed tab to start collecting.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.day}>
          <div className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{g.day}</div>
          <div className="space-y-1">
            {g.items.map((it) => (
              <div key={it.email} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${it.status === "confirmed" ? "bg-emerald-500" : it.status === "pending" ? "bg-amber-500" : "bg-zinc-300"}`} />
                <span className="truncate font-mono text-xs">{it.email}</span>
                <Badge variant={it.status === "confirmed" ? "default" : it.status === "pending" ? "secondary" : "outline"}>
                  {it.status}
                </Badge>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground" title={fullTime(it.at)}>
                  {relTime(it.at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmbedTab({ list, collectorUrl, toast }: { list: MailList; collectorUrl: string; toast: ToastFn }) {
  const snippet = embedSnippet(collectorUrl, list.list_key);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const testPost = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      // Relative /v1 works in dev via vite proxy; absolute URL in production.
      const base = collectorUrl.startsWith("http") ? collectorUrl : "";
      const res = await fetch(`${base}/v1/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list_key: list.list_key, email, metadata: JSON.stringify({ source: "dashboard-test" }) }),
      });
      const data = await res.json();
      toast(data.status === "pending" ? "Test sent — see it under Contacts" : (data.error as string) || "done");
      setEmail("");
    } catch {
      toast("request failed", "err");
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Paste into any static site. Keeps your own CSS.</p>
        <pre className="max-h-64 overflow-auto rounded-xl border bg-muted/50 p-3 font-mono text-[11px]">{snippet}</pre>
        <div className="mt-2">
          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(snippet).then(() => toast("Snippet copied"), () => toast("copy failed", "err"))}>
            <Copy className="size-3.5" /> Copy snippet
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-medium">Send a test signup</p>
          <form onSubmit={testPost} className="flex gap-2">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <Button type="submit" disabled={sending}>
              <Send className="size-3.5" /> {sending ? "…" : "Send"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/** Record view: breadcrumb, title + actions, tabs, details rail. */
export function ListDetail({
  list, adminKey, collectorUrl, starred, onToggleStar, toast, refresh, goLists, onDeleted,
}: {
  list: MailList;
  adminKey: string;
  collectorUrl: string;
  starred: boolean;
  onToggleStar: () => void;
  toast: ToastFn;
  refresh: () => void;
  goLists: () => void;
  onDeleted: () => void;
}) {
  const [tab, setTab] = useState<Tab>("contacts");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const save = async (v: CreateListInput) => {
    setSaving(true);
    try {
      await api.updateList(adminKey, list.list_key, v);
      toast("List updated");
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "update failed", "err");
    } finally {
      setSaving(false);
    }
  };

  const destroy = async () => {
    setSaving(true);
    try {
      await api.deleteList(adminKey, list.list_key);
      toast("List deleted");
      onDeleted();
    } catch (e) {
      toast(e instanceof Error ? e.message : "delete failed", "err");
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "contacts", label: "Contacts", count: list.confirmed + list.pending },
    { id: "activity", label: "Activity" },
    { id: "embed", label: "Embed" },
    { id: "settings", label: "Settings" },
  ];

  const downloadCsv = () =>
    api
      .exportCsv(adminKey, list.list_key)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${list.name}-export.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast("CSV downloaded");
      })
      .catch((e) => toast(e instanceof Error ? e.message : "export failed", "err"));

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        <button onClick={goLists} className="hover:text-foreground">Lists</button>
        <span className="text-muted-foreground/60">/</span>
        <span className="font-medium text-foreground">{list.name}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn(
          "flex size-8 items-center justify-center rounded-lg text-sm font-bold text-white",
          list.type === "waitlist" ? "bg-violet-500" : "bg-emerald-500",
        )}>
          {list.name.slice(0, 1).toUpperCase()}
        </span>
        <h1 className="text-xl font-semibold">{list.name}</h1>
        <button
          type="button"
          onClick={onToggleStar}
          aria-label={starred ? "Unstar list" : "Star list"}
          aria-pressed={starred}
          className="rounded-md p-1.5 hover:bg-accent"
        >
          <Star className={cn("size-4", starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
        </button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setTab("embed")}>Embed</Button>
          <Button variant="outline" size="sm" onClick={downloadCsv}>
            <Download className="size-3.5" /> Export
          </Button>
        </div>
      </div>
      <div className="mt-3 flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-selected={tab === t.id}
            role="tab"
            className={cn(
              "relative px-3 py-2 text-sm",
              tab === t.id ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count != null && (
              <span className="ml-1.5 rounded-full bg-secondary px-1.5 text-[11px] text-muted-foreground tabular-nums">
                {t.count}
              </span>
            )}
            {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-primary" />}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          {tab === "contacts" && <ContactsTable listKey={list.list_key} adminKey={adminKey} toast={toast} />}
          {tab === "activity" && <Activity listKey={list.list_key} adminKey={adminKey} toast={toast} />}
          {tab === "embed" && <EmbedTab list={list} collectorUrl={collectorUrl} toast={toast} />}
          {tab === "settings" && (
            <Card>
              <CardContent className="p-4">
                <ListForm
                  saving={saving}
                  initial={{
                    name: list.name, type: list.type, sender_name: list.sender_name, sender_email: list.sender_email,
                    provider: list.provider, welcome_subject: list.welcome_subject, welcome_body: list.welcome_body,
                    confirm_redirect: list.confirm_redirect,
                  }}
                  onSubmit={save}
                />
                <div className="mt-6 border-t pt-4">
                  <Button variant="destructive" onClick={() => setConfirmingDelete(true)}>Delete list…</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        <aside className="h-fit">
          <Card>
            <CardContent className="p-0">
              <div className="border-b px-4 py-2.5 text-sm font-semibold">List details</div>
              <dl className="space-y-2.5 px-4 py-3 text-sm">
                <DetailRow k="Type" v={<Badge variant="secondary">{list.type}</Badge>} />
                <DetailRow k="Provider" v={<Badge variant="outline">{list.provider}</Badge>} />
                <DetailRow k="Sender" v={<span>{list.sender_name ? `${list.sender_name} · ` : ""}{list.sender_email}</span>} />
                <DetailRow k="Embed key" v={
                  <button
                    type="button"
                    className="font-mono text-xs text-muted-foreground hover:text-foreground"
                    title="Copy full key"
                    onClick={() => navigator.clipboard.writeText(list.list_key).then(() => toast("Key copied"), () => toast("copy failed", "err"))}
                  >
                    {list.list_key.slice(0, 12)}…
                  </button>
                } />
                <DetailRow k="Confirmed" v={<span className="tabular-nums">{list.confirmed}</span>} />
                <DetailRow k="Pending" v={<span className="tabular-nums">{list.pending}</span>} />
                {list.confirm_redirect && <DetailRow k="Redirect" v={<span className="truncate text-muted-foreground">{list.confirm_redirect}</span>} />}
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={confirmingDelete} onOpenChange={(o) => !o && setConfirmingDelete(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete list?</DialogTitle>
            <DialogDescription>
              <b>{list.name}</b> and its {list.confirmed + list.pending} contacts will be
              permanently removed. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={destroy}>
              {saving ? "Deleting…" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{k}</dt>
      <dd className="min-w-0 text-right">{v}</dd>
    </div>
  );
}
