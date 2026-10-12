import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Badge, Btn, Empty, Field, Modal, inputCls, statusTone, type Toast } from "../components/ui";
import { api, embedSnippet, emptyListInput, type CreateListInput, type MailList } from "../lib/api";

function ListForm({
  initial,
  saving,
  onSubmit,
}: {
  initial: CreateListInput;
  saving: boolean;
  onSubmit: (v: CreateListInput) => void;
}) {
  const [form, setForm] = useState(initial);
  const set =
    (k: keyof CreateListInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      className="grid grid-cols-1 gap-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...form, type: form.type as "newsletter" | "waitlist", provider: form.provider as "smtp" | "plunk" });
      }}
    >
      <Field label="Name"><input required className={inputCls} value={form.name} onChange={set("name")} placeholder="AI Directory" /></Field>
      <Field label="Sender email"><input required type="email" className={inputCls} value={form.sender_email} onChange={set("sender_email")} /></Field>
      <Field label="Type">
        <select className={inputCls} value={form.type} onChange={set("type")}>
          <option value="newsletter">newsletter</option>
          <option value="waitlist">waitlist</option>
        </select>
      </Field>
      <Field label="Provider">
        <select className={inputCls} value={form.provider} onChange={set("provider")}>
          <option value="smtp">smtp</option>
          <option value="plunk">plunk</option>
        </select>
      </Field>
      <Field label="Sender name"><input className={inputCls} value={form.sender_name} onChange={set("sender_name")} /></Field>
      <Field label="Confirm redirect"><input className={inputCls} value={form.confirm_redirect} onChange={set("confirm_redirect")} placeholder="https://…/thanks" /></Field>
      <Field label="Welcome subject"><input className={inputCls} value={form.welcome_subject} onChange={set("welcome_subject")} /></Field>
      <Field label="Welcome body (html)"><input className={inputCls} value={form.welcome_body} onChange={set("welcome_body")} /></Field>
      <div className="md:col-span-2">
        <Btn type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </div>
    </form>
  );
}

function ListCard({
  list,
  adminKey,
  collectorUrl,
  toast,
  refresh,
}: {
  list: MailList;
  adminKey: string;
  collectorUrl: string;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  refresh: () => void;
}) {
  const [tab, setTab] = useState<"none" | "embed" | "edit" | "delete">("none");
  const [saving, setSaving] = useState(false);
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
      toast("CSV downloaded");
    } catch (e) {
      toast(e instanceof Error ? e.message : "export failed", "err");
    }
  };

  const save = async (v: CreateListInput) => {
    setSaving(true);
    try {
      await api.updateList(adminKey, list.list_key, v);
      setTab("none");
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
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "delete failed", "err");
    } finally {
      setSaving(false);
      setTab("none");
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-zinc-100">{list.name}</h2>
          <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">{list.list_key}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Badge>{list.type}</Badge>
          <Badge tone="blue">{list.provider}</Badge>
        </div>
      </div>
      <div className="mt-3 flex gap-6 text-sm">
        <span className="tabular-nums text-zinc-100">{list.confirmed} <span className="text-zinc-500">confirmed</span></span>
        <span className="tabular-nums text-zinc-400">{list.pending} <span className="text-zinc-500">pending</span></span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Btn onClick={() => setTab(tab === "embed" ? "none" : "embed")}>Embed</Btn>
        <Btn onClick={downloadCsv}>Export CSV</Btn>
        <Btn onClick={() => setTab("edit")}>Edit</Btn>
        <Btn variant="danger" onClick={() => setTab("delete")}>Delete</Btn>
      </div>
      <AnimatePresence>
        {tab === "embed" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] text-zinc-300">{snippet}</pre>
            <div className="mt-2">
              <Btn onClick={() => navigator.clipboard.writeText(snippet).then(() => toast("Snippet copied"), () => toast("copy failed", "err"))}>Copy snippet</Btn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {tab === "edit" && (
          <Modal title={`Edit ${list.name}`} onClose={() => setTab("none")}>
            <ListForm
              saving={saving}
              initial={{
                name: list.name, type: list.type, sender_name: list.sender_name, sender_email: list.sender_email,
                provider: list.provider, welcome_subject: list.welcome_subject, welcome_body: list.welcome_body,
                confirm_redirect: list.confirm_redirect,
              }}
              onSubmit={save}
            />
          </Modal>
        )}
        {tab === "delete" && (
          <Modal title="Delete list?" onClose={() => setTab("none")}>
            <p className="text-sm text-zinc-400">
              <b className="text-zinc-200">{list.name}</b> and its {list.confirmed + list.pending} contacts will be permanently removed.
            </p>
            <div className="mt-4 flex gap-2">
              <Btn variant="danger" disabled={saving} onClick={destroy}>{saving ? "Deleting…" : "Delete forever"}</Btn>
              <Btn onClick={() => setTab("none")}>Cancel</Btn>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ListsPage({
  lists, adminKey, collectorUrl, toast, refresh, loading,
}: {
  lists: MailList[];
  adminKey: string;
  collectorUrl: string;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  refresh: () => void;
  loading: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const create = async (v: CreateListInput) => {
    setSaving(true);
    try {
      const r = await api.createList(adminKey, v);
      setCreating(false);
      toast(`Created ${r.name} (${r.list_key})`);
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "create failed", "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">{loading ? "Loading…" : `${lists.length} list${lists.length === 1 ? "" : "s"}`}</p>
        <Btn variant="primary" onClick={() => setCreating(true)}>New list</Btn>
      </div>
      {lists.length === 0 && !loading ? (
        <Empty>No lists yet — create one to get an embed key.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {lists.map((l) => (
            <ListCard key={l.list_key} list={l} adminKey={adminKey} collectorUrl={collectorUrl} toast={toast} refresh={refresh} />
          ))}
        </div>
      )}
      <AnimatePresence>
        {creating && (
          <Modal title="New list" onClose={() => setCreating(false)}>
            <ListForm initial={emptyListInput} saving={saving} onSubmit={create} />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

export function statusBadge(s: string) {
  return <Badge tone={statusTone(s)}>{s}</Badge>;
}
