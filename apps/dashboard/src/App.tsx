import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AppShell, type Screen } from "./components/app-shell";
import { CommandPalette } from "./components/CommandPalette";
import { KeyGate } from "./components/KeyGate";
import { api, type MailList, type Stats } from "./lib/api";
import type { Toast } from "./lib/toast";
import { ContactsPage } from "./pages/ContactsPage";
import { ListDetail } from "./pages/ListDetail";
import { ListsPage } from "./pages/ListsPage";
import { Overview } from "./pages/Overview";
import { SettingsPage } from "./pages/SettingsPage";
import { cn } from "./lib/utils";
import "./index.css";

type View = Screen | { name: "list"; key: string };

const collectorUrl = () => {
  const v = (import.meta.env.VITE_MAILBAG_URL as string | undefined) || "/api";
  return v.replace(/\/api$/, "") || window.location.origin;
};

function loadStars(): string[] {
  try {
    return JSON.parse(localStorage.getItem("mb-starred") || "[]") as string[];
  } catch {
    return [];
  }
}

function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-72 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            className={cn(
              "rounded-xl border bg-popover px-4 py-2.5 text-sm shadow-lg",
              t.kind === "err" ? "border-destructive/40 text-destructive" : "text-popover-foreground",
            )}
          >
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("mb-admin-key") || "");
  const [view, setView] = useState<View>("overview");
  const [lists, setLists] = useState<MailList[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiOk, setApiOk] = useState(true);
  const [palette, setPalette] = useState(false);
  const [createNonce, setCreateNonce] = useState(0);
  const [starred, setStarred] = useState<string[]>(loadStars);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((msg: string, kind: Toast["kind"] = "ok") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const refresh = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const [l, s] = await Promise.all([api.lists(adminKey), api.stats(adminKey)]);
      setLists(l);
      setStats(s);
      setApiOk(true);
    } catch (e) {
      setApiOk(false);
      toast(e instanceof Error ? e.message : "load failed", "err");
    } finally {
      setLoading(false);
    }
  }, [adminKey, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const toggleStar = useCallback((k: string) => {
    setStarred((s) => {
      const next = s.includes(k) ? s.filter((x) => x !== k) : [...s, k];
      localStorage.setItem("mb-starred", JSON.stringify(next));
      return next;
    });
  }, []);

  const lock = useCallback(() => {
    localStorage.removeItem("mb-admin-key");
    setAdminKey("");
  }, []);

  if (!adminKey) return <KeyGate collectorUrl={collectorUrl()} onUnlock={setAdminKey} />;

  const screen: Screen | "list" = typeof view === "string" ? view : "list";
  const activeKey = typeof view === "object" ? view.key : null;
  const activeList = activeKey ? (lists.find((l) => l.list_key === activeKey) ?? null) : null;
  const openList = (key: string) => setView({ name: "list", key });

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppShell
        screen={screen}
        go={(s) => setView(s)}
        lists={lists}
        starred={starred}
        activeKey={activeKey}
        openList={openList}
        pendingBadge={stats?.pending ?? 0}
        onLock={lock}
        onSearch={() => setPalette(true)}
        onNewList={() => {
          setView("lists");
          setCreateNonce((n) => n + 1);
        }}
        apiOk={apiOk}
      >
        {typeof view === "string" && view === "overview" && (
          <Overview
            stats={stats}
            lists={lists}
            loading={loading}
            adminKey={adminKey}
            openList={openList}
            onNewList={() => {
              setView("lists");
              setCreateNonce((n) => n + 1);
            }}
          />
        )}
        {typeof view === "string" && view === "lists" && (
          <ListsPage
            lists={lists} adminKey={adminKey} toast={toast} refresh={refresh} loading={loading}
            starred={starred} onToggleStar={toggleStar} openList={openList} createNonce={createNonce}
          />
        )}
        {typeof view === "string" && view === "contacts" && <ContactsPage lists={lists} adminKey={adminKey} toast={toast} />}
        {typeof view === "string" && view === "settings" && (
          <SettingsPage collectorUrl={collectorUrl()} adminKey={adminKey} apiOk={apiOk} toast={toast} onLock={lock} />
        )}
        {typeof view === "object" && (
          activeList ? (
            <ListDetail
              list={activeList} adminKey={adminKey} collectorUrl={collectorUrl()}
              starred={starred.includes(activeList.list_key)} onToggleStar={() => toggleStar(activeList.list_key)}
              toast={toast} refresh={refresh} goLists={() => setView("lists")} onDeleted={() => setView("lists")}
            />
          ) : (
            <p className="text-sm text-muted-foreground">List not found — it may have been deleted.</p>
          )
        )}
      </AppShell>
      <CommandPalette
        open={palette}
        onClose={() => setPalette(false)}
        lists={lists}
        go={(s) => setView(s)}
        openList={openList}
        onNewList={() => {
          setView("lists");
          setCreateNonce((n) => n + 1);
        }}
      />
      <Toasts toasts={toasts} />
    </div>
  );
}
