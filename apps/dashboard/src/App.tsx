import { useCallback, useEffect, useRef, useState } from "react";
import { CommandPalette } from "./components/CommandPalette";
import { KeyGate } from "./components/KeyGate";
import { MenuButton, Sidebar, type Screen } from "./components/Sidebar";
import { Toasts, type Toast } from "./components/ui";
import { api, type MailList, type Stats } from "./lib/api";
import { ContactsPage } from "./pages/ContactsPage";
import { ListDetail } from "./pages/ListDetail";
import { ListsPage } from "./pages/ListsPage";
import { Overview } from "./pages/Overview";
import { SettingsPage } from "./pages/SettingsPage";
import "./index.css";

type View = Screen | { name: "list"; key: string };

const collectorUrl = () => {
  const v = (import.meta.env.VITE_COLLECTOR_URL as string | undefined) || "/api";
  return v.replace(/\/api$/, "") || window.location.origin;
};

function loadStars(): string[] {
  try {
    return JSON.parse(localStorage.getItem("mc-starred") || "[]") as string[];
  } catch {
    return [];
  }
}

export default function App() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("mc-admin-key") || "");
  const [view, setView] = useState<View>("overview");
  const [lists, setLists] = useState<MailList[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiOk, setApiOk] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((c) => !c);
      } else if (mod && e.key.toLowerCase() === "k") {
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
      localStorage.setItem("mc-starred", JSON.stringify(next));
      return next;
    });
  }, []);

  if (!adminKey) return <KeyGate onUnlock={setAdminKey} />;

  const screen: Screen | "list" = typeof view === "string" ? view : "list";
  const activeKey = typeof view === "object" ? view.key : null;
  const activeList = activeKey ? (lists.find((l) => l.list_key === activeKey) ?? null) : null;
  const openList = (key: string) => setView({ name: "list", key });

  return (
    <div className="flex min-h-screen bg-[#fafafa] text-zinc-900">
      <Sidebar
        screen={screen}
        go={(s) => setView(s)}
        lists={lists}
        starred={starred}
        activeKey={activeKey}
        openList={openList}
        collapsed={collapsed}
        toggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        pendingBadge={stats?.pending ?? 0}
        onSearch={() => setPalette(true)}
      />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-200 bg-[#fafafa]/90 px-4 py-2.5 backdrop-blur md:px-6">
          <MenuButton onClick={() => setMobileOpen(true)} />
          <button
            onClick={() => setPalette(true)}
            className="hidden items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[13px] text-zinc-400 hover:border-zinc-300 sm:flex"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
            Search or jump…
            <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 text-[11px]">⌘K</kbd>
          </button>
          <span className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
            <span className={`h-2 w-2 rounded-full ${apiOk ? "bg-emerald-500" : "bg-red-500"}`} />
            {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </span>
        </header>
        <main className="mx-auto max-w-6xl p-4 md:p-6">
          {typeof view === "string" && view === "overview" && (
            <Overview stats={stats} lists={lists} loading={loading} adminKey={adminKey} openList={openList} />
          )}
          {typeof view === "string" && view === "lists" && (
            <ListsPage
              lists={lists} adminKey={adminKey} toast={toast} refresh={refresh} loading={loading}
              starred={starred} onToggleStar={toggleStar} openList={openList} createNonce={createNonce}
            />
          )}
          {typeof view === "string" && view === "contacts" && <ContactsPage lists={lists} adminKey={adminKey} toast={toast} />}
          {typeof view === "string" && view === "settings" && (
            <SettingsPage
              collectorUrl={collectorUrl()} adminKey={adminKey} apiOk={apiOk} toast={toast}
              onLock={() => {
                localStorage.removeItem("mc-admin-key");
                setAdminKey("");
              }}
            />
          )}
          {typeof view === "object" && (
            activeList ? (
              <ListDetail
                list={activeList} adminKey={adminKey} collectorUrl={collectorUrl()}
                starred={starred.includes(activeList.list_key)} onToggleStar={() => toggleStar(activeList.list_key)}
                toast={toast} refresh={refresh} goLists={() => setView("lists")} onDeleted={() => setView("lists")}
              />
            ) : (
              <p className="text-[13px] text-zinc-500">List not found — it may have been deleted.</p>
            )
          )}
        </main>
      </div>
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
