import { useCallback, useEffect, useState } from "react";
import { Badge, Btn, Empty, inputCls, statusTone, type Toast } from "../components/ui";
import { api, type Contact, type MailList } from "../lib/api";

const PAGE = 25;
const statuses = ["", "confirmed", "pending", "unsubscribed"];

export function ContactsPage({
  lists, adminKey, toast,
}: {
  lists: MailList[];
  adminKey: string;
  toast: (msg: string, kind?: Toast["kind"]) => void;
}) {
  const [listKey, setListKey] = useState(lists[0]?.list_key ?? "");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lists.find((l) => l.list_key === listKey)) setListKey(lists[0]?.list_key ?? "");
  }, [lists, listKey]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    if (!listKey) return;
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

  if (lists.length === 0) return <Empty>Create a list first.</Empty>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 md:flex-row md:items-center">
        <select value={listKey} onChange={(e) => { setListKey(e.target.value); setPage(0); }} className={`${inputCls} md:w-64`}>
          {lists.map((l) => (
            <option key={l.list_key} value={l.list_key}>{l.name}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {statuses.map((s) => (
            <button
              key={s || "all"}
              onClick={() => { setStatus(s); setPage(0); }}
              className={`rounded-lg px-3 py-1.5 text-xs ${status === s ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              {s || "all"}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email…" className={`${inputCls} md:ml-auto md:w-56`} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900 text-xs text-zinc-500">
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Confirmed</th>
              <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-950">
            {rows.map((c) => (
              <tr key={c.email} className="hover:bg-zinc-900/60">
                <td className="px-4 py-2.5 font-mono text-xs text-zinc-200">{c.email}</td>
                <td className="px-4 py-2.5"><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
                <td className="hidden px-4 py-2.5 text-xs text-zinc-500 md:table-cell">{c.confirmed_at ?? "—"}</td>
                <td className="hidden px-4 py-2.5 text-xs text-zinc-500 lg:table-cell">{c.created_at}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-500">No contacts match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-zinc-400">
        <span>{loading ? "Loading…" : `${total} contact${total === 1 ? "" : "s"}`}</span>
        <div className="flex items-center gap-2">
          <Btn disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Btn>
          <span className="text-xs tabular-nums">{page + 1} / {pages}</span>
          <Btn disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Btn>
        </div>
      </div>
    </div>
  );
}
