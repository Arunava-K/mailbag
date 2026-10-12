import { motion } from "motion/react";
import { useState } from "react";
import { useCountUp } from "../hooks/useCountUp";
import { api, embedSnippet, type MailList } from "../lib/api";

const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500";
const labelCls = "mb-1 block text-xs font-medium text-zinc-400";

export function ListCard({
  list,
  adminKey,
  collectorUrl,
  onError,
}: {
  list: MailList;
  adminKey: string;
  collectorUrl: string;
  onError: (msg: string) => void;
}) {
  const confirmed = useCountUp(list.confirmed);
  const pending = useCountUp(list.pending);
  const [showSnippet, setShowSnippet] = useState(false);
  const [copied, setCopied] = useState(false);
  const snippet = embedSnippet(collectorUrl, list.list_key);

  const downloadCsv = async () => {
    try {
      const blob = await api.exportCsv(adminKey, list.list_key);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${list.name}-export.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      onError(e instanceof Error ? e.message : "export failed");
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-zinc-100">{list.name}</h2>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">{list.list_key}</p>
        </div>
        <div className="flex gap-1.5">
          <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">{list.type}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">{list.provider}</span>
        </div>
      </div>
      <div className="mt-4 flex gap-6">
        <div>
          <div className="text-2xl font-semibold text-zinc-100 tabular-nums">{confirmed}</div>
          <div className="text-xs text-zinc-500">confirmed</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-zinc-400 tabular-nums">{pending}</div>
          <div className="text-xs text-zinc-500">pending</div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setShowSnippet((s) => !s)}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
        >
          Embed
        </button>
        <button
          onClick={downloadCsv}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
        >
          Export CSV
        </button>
      </div>
      {showSnippet && (
        <div className="mt-3">
          <pre className="max-h-48 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] text-zinc-300">
            {snippet}
          </pre>
          <button
            onClick={() => {
              navigator.clipboard.writeText(snippet).then(
                () => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                },
                () => onError("copy failed"),
              );
            }}
            className="mt-2 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white"
          >
            {copied ? "Copied" : "Copy snippet"}
          </button>
        </div>
      )}
    </motion.div>
  );
}

export function CreateListForm({
  adminKey,
  onCreated,
  onError,
}: {
  adminKey: string;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "newsletter",
    sender_name: "",
    sender_email: "",
    provider: "smtp",
    welcome_subject: "",
    welcome_body: "",
    confirm_redirect: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
      >
        New list
      </button>
    );
  }
  return (
    <motion.form
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await api.createList(adminKey, {
            ...form,
            type: form.type as "newsletter" | "waitlist",
            provider: form.provider as "smtp" | "plunk",
          });
          setOpen(false);
          setForm({ name: "", type: "newsletter", sender_name: "", sender_email: "", provider: "smtp", welcome_subject: "", welcome_body: "", confirm_redirect: "" });
          onCreated();
        } catch (err) {
          onError(err instanceof Error ? err.message : "create failed");
        } finally {
          setSaving(false);
        }
      }}
    >
      <div><label className={labelCls}>Name</label><input required className={inputCls} value={form.name} onChange={set("name")} placeholder="AI Directory" /></div>
      <div><label className={labelCls}>Sender email</label><input required type="email" className={inputCls} value={form.sender_email} onChange={set("sender_email")} placeholder="hello@yourdomain.com" /></div>
      <div><label className={labelCls}>Type</label>
        <select className={inputCls} value={form.type} onChange={set("type")}><option value="newsletter">newsletter</option><option value="waitlist">waitlist</option></select>
      </div>
      <div><label className={labelCls}>Provider</label>
        <select className={inputCls} value={form.provider} onChange={set("provider")}><option value="smtp">smtp</option><option value="plunk">plunk</option></select>
      </div>
      <div><label className={labelCls}>Sender name</label><input className={inputCls} value={form.sender_name} onChange={set("sender_name")} /></div>
      <div><label className={labelCls}>Confirm redirect (optional)</label><input className={inputCls} value={form.confirm_redirect} onChange={set("confirm_redirect")} placeholder="https://…/thanks" /></div>
      <div><label className={labelCls}>Welcome subject</label><input className={inputCls} value={form.welcome_subject} onChange={set("welcome_subject")} /></div>
      <div><label className={labelCls}>Welcome body (html)</label><input className={inputCls} value={form.welcome_body} onChange={set("welcome_body")} /></div>
      <div className="flex gap-2 md:col-span-2">
        <button disabled={saving} className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50">
          {saving ? "Saving…" : "Create"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300">Cancel</button>
      </div>
    </motion.form>
  );
}
