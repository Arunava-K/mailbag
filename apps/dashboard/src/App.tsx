import { useCallback, useEffect, useRef, useState } from "react";
import { KeyGate } from "./components/KeyGate";
import { MenuButton, Sidebar, type Screen } from "./components/Sidebar";
import { Toasts, type Toast } from "./components/ui";
import { api, type MailList, type Stats } from "./lib/api";
import { ContactsPage } from "./pages/ContactsPage";
import { ListsPage } from "./pages/ListsPage";
import { Overview } from "./pages/Overview";
import { SettingsPage } from "./pages/SettingsPage";
import "./index.css";

const titles: Record<Screen, string> = {
  overview: "Overview",
  lists: "Lists",
  contacts: "Contacts",
  settings: "Settings",
};

const collectorUrl = () => {
  const v = (import.meta.env.VITE_COLLECTOR_URL as string | undefined) || "/api";
  return v.replace(/\/api$/, "") || window.location.origin;
};

export default function App() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("mc-admin-key") || "");
  const [screen, setScreen] = useState<Screen>("overview");
  const [lists, setLists] = useState<MailList[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiOk, setApiOk] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  if (!adminKey) return <KeyGate onUnlock={setAdminKey} />;

  const pendingBadge = stats?.pending ?? 0;

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar
        screen={screen}
        go={setScreen}
        collapsed={collapsed}
        toggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        pendingBadge={pendingBadge}
      />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-800 bg-zinc-950/90 px-4 py-3 backdrop-blur md:px-6">
          <MenuButton onClick={() => setMobileOpen(true)} />
          <h1 className="text-sm font-semibold">{titles[screen]}</h1>
          <span className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
            <span className={`h-2 w-2 rounded-full ${apiOk ? "bg-emerald-500" : "bg-red-500"}`} />
            {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </span>
        </header>
        <main className="mx-auto max-w-6xl p-4 md:p-6">
          {screen === "overview" && <Overview stats={stats} lists={lists} loading={loading} />}
          {screen === "lists" && (
            <ListsPage lists={lists} adminKey={adminKey} collectorUrl={collectorUrl()} toast={toast} refresh={refresh} loading={loading} />
          )}
          {screen === "contacts" && <ContactsPage lists={lists} adminKey={adminKey} toast={toast} />}
          {screen === "settings" && (
            <SettingsPage
              collectorUrl={collectorUrl()}
              adminKey={adminKey}
              apiOk={apiOk}
              toast={toast}
              onLock={() => {
                localStorage.removeItem("mc-admin-key");
                setAdminKey("");
              }}
            />
          )}
        </main>
      </div>
      <Toasts toasts={toasts} />
    </div>
  );
}
