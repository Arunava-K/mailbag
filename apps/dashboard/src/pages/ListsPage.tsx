import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ListForm } from "../components/ListForm";
import { StarIcon } from "../components/Sidebar";
import { Badge, Btn, Empty, Modal, type Toast } from "../components/ui";
import { api, type CreateListInput, type MailList } from "../lib/api";

export function ListsPage({
  lists, adminKey, toast, refresh, loading, starred, onToggleStar, openList, createNonce,
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

  useEffect(() => {
    if (createNonce > 0) setCreating(true);
  }, [createNonce]);

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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-zinc-500">{loading ? "Loading…" : `${lists.length} list${lists.length === 1 ? "" : "s"}`}</p>
        <Btn variant="primary" onClick={() => setCreating(true)}>New list</Btn>
      </div>
      {lists.length === 0 && !loading ? (
        <Empty>No lists yet — create one to get an embed key.</Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {lists.map((l, i) => (
            <motion.button
              key={l.list_key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => openList(l.list_key)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 ${i > 0 ? "border-t border-zinc-100" : ""}`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${l.type === "waitlist" ? "bg-violet-500" : "bg-emerald-500"}`}>
                {l.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-zinc-900">{l.name}</span>
                <span className="block truncate font-mono text-[11px] text-zinc-400">{l.list_key}</span>
              </span>
              <span className="hidden sm:block"><Badge>{l.type}</Badge></span>
              <span className="hidden text-[13px] tabular-nums text-zinc-500 md:block">{l.confirmed} confirmed</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onToggleStar(l.list_key); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onToggleStar(l.list_key); } }}
                className="rounded p-1 hover:bg-zinc-100"
              >
                <StarIcon filled={starred.includes(l.list_key)} />
              </span>
              <span className="text-zinc-300">→</span>
            </motion.button>
          ))}
        </div>
      )}
      <AnimatePresence>
        {creating && (
          <Modal title="New list" onClose={() => setCreating(false)}>
            <ListForm saving={saving} submitLabel="Create" onSubmit={create} />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
