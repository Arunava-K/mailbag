import { useCallback, useEffect, useState } from "react";
import { Badge, Btn, inputCls, statusTone, type Toast } from "../components/ui";
import { api, type Contact } from "../lib/api";

const PAGE = 25;
const statuses = ["", "confirmed", "pending", "unsubscribed"];

/** Shared paged contacts table used by list detail + global contacts screen. */
export function ContactsTable({
  listKey, adminKey, toast, initialQ = "",
}: {
  listKey: string;
  adminKey: string;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  initialQ?: string;
}) {
  const [status, setStatus] = useState("");
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
              onClick={() => { setStatus(s); setPage(0); }}
              className={`rounded-lg px-2.5 py-1 text-xs ${status === s ? "bg-zinc-900 font-medium text-white" : "text-zinc-500 hover:bg-zinc-100"}`}
            >
              {s || "all"}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email…" className={`${inputCls} md:ml-auto md:w-56`} />
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Confirmed</th>
              <th className="hidden px-3 py-2 font-medium lg:table-cell">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {rows.map((c) => (
              <tr key={c.email} className="hover:bg-zinc-50">
                <td className="px-3 py-2 font-mono text-xs text-zinc-800">{c.email}</td>
                <td className="px-3 py-2"><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
                <td className="hidden px-3 py-2 text-xs text-zinc-500 md:table-cell">{c.confirmed_at ?? "—"}</td>
                <td className="hidden px-3 py-2 text-xs text-zinc-500 lg:table-cell">{c.created_at}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-[13px] text-zinc-400">No contacts match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-[13px] text-zinc-500">
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
