import { useState } from "react";
import { Btn, type Toast } from "../components/ui";

export function SettingsPage({
  collectorUrl, adminKey, apiOk, toast, onLock,
}: {
  collectorUrl: string;
  adminKey: string;
  apiOk: boolean;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  onLock: () => void;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-sm font-medium text-zinc-200">Connection</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Collector</dt>
            <dd className="font-mono text-xs text-zinc-200">{collectorUrl}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-zinc-500">Status</dt>
            <dd className="flex items-center gap-2 text-xs text-zinc-200">
              <span className={`h-2 w-2 rounded-full ${apiOk ? "bg-emerald-500" : "bg-red-500"}`} />
              {apiOk ? "reachable" : "unreachable"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-zinc-500">Admin key</dt>
            <dd className="flex items-center gap-2 font-mono text-xs text-zinc-200">
              {reveal ? adminKey : "••••••••••••"}
              <button className="text-zinc-500 hover:text-zinc-200" onClick={() => setReveal((v) => !v)}>
                {reveal ? "hide" : "show"}
              </button>
              <button
                className="text-zinc-500 hover:text-zinc-200"
                onClick={() => navigator.clipboard.writeText(adminKey).then(() => toast("Key copied"), () => toast("copy failed", "err"))}
              >
                copy
              </button>
            </dd>
          </div>
        </dl>
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-sm font-medium text-zinc-200">Session</h3>
        <p className="mt-1 text-xs text-zinc-500">The key lives in this browser only (localStorage). Lock to clear it from this view.</p>
        <div className="mt-3"><Btn variant="danger" onClick={onLock}>Lock dashboard</Btn></div>
      </div>
    </div>
  );
}
