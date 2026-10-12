import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ContactsTable } from "../components/ContactsTable";
import { ListForm } from "../components/ListForm";
import { StarIcon } from "../components/Sidebar";
import { Badge, Btn, Empty, Modal, inputCls, statusTone, type Toast } from "../components/ui";
import { api, embedSnippet, type CreateListInput, type MailList } from "../lib/api";

type Tab = "contacts" | "activity" | "embed" | "settings";

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return iso;
  const mins = Math.max(1, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return iso.slice(0, 10);
}

function Activity({ listKey, adminKey, toast }: { listKey: string; adminKey: string; toast: (m: string, k?: Toast["kind"]) => void }) {
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

  if (loading) return <p className="py-6 text-center text-[13px] text-zinc-400">Loading…</p>;
  if (groups.length === 0) return <Empty>No signups yet — embed the form to start collecting.</Empty>;
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.day}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{g.day}</div>
          <div className="space-y-1">
            {g.items.map((it) => (
              <div key={it.email} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-zinc-50">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${it.status === "confirmed" ? "bg-emerald-500" : it.status === "pending" ? "bg-amber-500" : "bg-zinc-300"}`} />
                <span className="truncate font-mono text-xs text-zinc-800">{it.email}</span>
                <Badge tone={statusTone(it.status)}>{it.status}</Badge>
                <span className="ml-auto shrink-0 text-xs text-zinc-400">{relTime(it.at)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmbedTab({ list, collectorUrl, toast }: { list: MailList; collectorUrl: string; toast: (m: string, k?: Toast["kind"]) => void }) {
  const snippet = embedSnippet(collectorUrl, list.list_key);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const testPost = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      // Relative /v1 works in dev via vite proxy; absolute collector in production.
      const base = collectorUrl.startsWith("http") ? collectorUrl : "";
      const res = await fetch(`${base}/v1/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list_key: list.list_key, email, metadata: JSON.stringify({ source: "dashboard-test" }) }),
      });
      const data = await res.json();
      toast(data.status === "pending" ? "Test sent — check pending tab" : (data.error as string) || "done");
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
        <div className="mb-1 text-xs font-medium text-zinc-500">Paste into any static site. Keeps your own CSS.</div>
        <pre className="max-h-64 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] text-zinc-700">{snippet}</pre>
        <div className="mt-2">
          <Btn onClick={() => navigator.clipboard.writeText(snippet).then(() => toast("Snippet copied"), () => toast("copy failed", "err"))}>Copy snippet</Btn>
        </div>
      </div>
      <div className="rounded-xl border border-zinc-200 p-4">
        <div className="mb-2 text-[13px] font-medium text-zinc-800">Send a test signup</div>
        <form onSubmit={testPost} className="flex gap-2">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
          <Btn type="submit" variant="primary" disabled={sending}>{sending ? "…" : "Send"}</Btn>
        </form>
      </div>
    </div>
  );
}

/** Attio-style record view: breadcrumb, title+actions, tabs, right details rail. */
export function ListDetail({
  list, adminKey, collectorUrl, starred, onToggleStar, toast, refresh, goLists, onDeleted,
}: {
  list: MailList;
  adminKey: string;
  collectorUrl: string;
  starred: boolean;
  onToggleStar: () => void;
  toast: (m: string, k?: Toast["kind"]) => void;
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
    { id: "contacts", label: "Contacts", count: list.confirmed },
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
      {/* breadcrumb */}
      <div className="mb-1 flex items-center gap-1.5 text-[13px] text-zinc-500">
        <button onClick={goLists} className="hover:text-zinc-800">Lists</button>
        <span className="text-zinc-300">/</span>
        <span className="font-medium text-zinc-800">{list.name}</span>
      </div>
      {/* title row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white ${list.type === "waitlist" ? "bg-violet-500" : "bg-emerald-500"}`}>
          {list.name.slice(0, 1).toUpperCase()}
        </span>
        <h1 className="text-lg font-semibold text-zinc-900">{list.name}</h1>
        <button onClick={onToggleStar} title="Star" className="rounded-md p-1 hover:bg-zinc-100">
          <StarIcon filled={starred} />
        </button>
        <div className="ml-auto flex gap-2">
          <Btn onClick={() => setTab("embed")}>Embed</Btn>
          <Btn onClick={downloadCsv}>Export</Btn>
        </div>
      </div>
      {/* tabs */}
      <div className="mt-3 flex gap-1 border-b border-zinc-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-2 text-[13px] ${tab === t.id ? "font-medium text-zinc-900" : "text-zinc-500 hover:text-zinc-800"}`}
          >
            {t.label}
            {t.count != null && <span className="ml-1.5 rounded-full bg-zinc-100 px-1.5 text-[11px] tabular-nums text-zinc-500">{t.count}</span>}
            {tab === t.id && <motion.span layoutId="detail-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-zinc-900" />}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          {tab === "contacts" && <ContactsTable listKey={list.list_key} adminKey={adminKey} toast={toast} />}
          {tab === "activity" && <Activity listKey={list.list_key} adminKey={adminKey} toast={toast} />}
          {tab === "embed" && <EmbedTab list={list} collectorUrl={collectorUrl} toast={toast} />}
          {tab === "settings" && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <ListForm
                saving={saving}
                initial={{
                  name: list.name, type: list.type, sender_name: list.sender_name, sender_email: list.sender_email,
                  provider: list.provider, welcome_subject: list.welcome_subject, welcome_body: list.welcome_body,
                  confirm_redirect: list.confirm_redirect,
                }}
                onSubmit={save}
              />
              <div className="mt-6 border-t border-zinc-100 pt-4">
                <Btn variant="danger" onClick={() => setConfirmingDelete(true)}>Delete list…</Btn>
              </div>
            </div>
          )}
        </div>
        {/* right rail */}
        <aside className="h-fit rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-4 py-2.5 text-[13px] font-semibold text-zinc-900">List details</div>
          <dl className="space-y-2.5 px-4 py-3 text-[13px]">
            <DetailRow k="Type" v={<Badge tone={list.type === "waitlist" ? "purple" : "green"}>{list.type}</Badge>} />
            <DetailRow k="Provider" v={<Badge tone="blue">{list.provider}</Badge>} />
            <DetailRow k="Sender" v={<span className="text-zinc-800">{list.sender_name ? `${list.sender_name} · ` : ""}{list.sender_email}</span>} />
            <DetailRow k="Embed key" v={
              <button
                className="font-mono text-xs text-zinc-600 hover:text-zinc-900"
                title="Copy"
                onClick={() => navigator.clipboard.writeText(list.list_key).then(() => toast("Key copied"), () => toast("copy failed", "err"))}
              >
                {list.list_key.slice(0, 12)}…
              </button>
            } />
            <DetailRow k="Confirmed" v={<span className="tabular-nums text-zinc-800">{list.confirmed}</span>} />
            <DetailRow k="Pending" v={<span className="tabular-nums text-zinc-800">{list.pending}</span>} />
            {list.confirm_redirect && <DetailRow k="Redirect" v={<span className="truncate text-zinc-600">{list.confirm_redirect}</span>} />}
          </dl>
        </aside>
      </div>

      <AnimatePresence>
        {confirmingDelete && (
          <Modal title="Delete list?" onClose={() => setConfirmingDelete(false)}>
            <p className="text-[13px] text-zinc-600">
              <b className="text-zinc-900">{list.name}</b> and its {list.confirmed + list.pending} contacts will be permanently removed.
            </p>
            <div className="mt-4 flex gap-2">
              <Btn variant="danger" disabled={saving} onClick={destroy}>{saving ? "Deleting…" : "Delete forever"}</Btn>
              <Btn onClick={() => setConfirmingDelete(false)}>Cancel</Btn>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-zinc-500">{k}</dt>
      <dd className="min-w-0 text-right">{v}</dd>
    </div>
  );
}
