import { useCallback, useEffect, useState } from "react";
import { KeyGate } from "./components/KeyGate";
import { CreateListForm, ListCard } from "./components/Lists";
import { api, type MailList } from "./lib/api";
import "./index.css";

const collectorUrl = () =>
  ((import.meta.env.VITE_COLLECTOR_URL as string | undefined) || "/api").replace(/\/api$/, "") || window.location.origin;

export default function App() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("mc-admin-key") || "");
  const [lists, setLists] = useState<MailList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiDown, setApiDown] = useState(false);

  const refresh = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    setError("");
    try {
      setLists(await api.lists(adminKey));
      setApiDown(false);
    } catch (e) {
      if (e instanceof Error && /failed to fetch|network/i.test(e.message)) setApiDown(true);
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    refresh();
    api.health().then((ok) => setApiDown(!ok));
  }, [refresh]);

  if (!adminKey) return <KeyGate onUnlock={setAdminKey} />;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <h1 className="font-semibold">MailCollector</h1>
        <div className="flex items-center gap-3">
          <span className={`h-2 w-2 rounded-full ${apiDown ? "bg-red-500" : "bg-emerald-500"}`} title={apiDown ? "api unreachable" : "api ok"} />
          <button
            className="text-xs text-zinc-500 hover:text-zinc-300"
            onClick={() => {
              localStorage.removeItem("mc-admin-key");
              setAdminKey("");
            }}
          >
            Lock
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        {error && <div className="rounded-lg border border-red-900 bg-red-950 px-4 py-2 text-sm text-red-200">{error}</div>}
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">{loading ? "Loading…" : `${lists.length} list${lists.length === 1 ? "" : "s"}`}</p>
          <CreateListForm adminKey={adminKey} onCreated={refresh} onError={setError} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {lists.map((l) => (
            <ListCard key={l.list_key} list={l} adminKey={adminKey} collectorUrl={collectorUrl()} onError={setError} />
          ))}
        </div>
        {!loading && lists.length === 0 && !error && (
          <p className="text-sm text-zinc-500">No lists yet — create one to get an embed key.</p>
        )}
      </main>
    </div>
  );
}
