import { useState } from "react";

export function KeyGate({ onUnlock }: { onUnlock: (key: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <form
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) {
            localStorage.setItem("mc-admin-key", value.trim());
            onUnlock(value.trim());
          }
        }}
      >
        <h1 className="text-lg font-semibold text-zinc-100">MailCollector</h1>
        <p className="mt-1 text-sm text-zinc-400">Enter ADMIN_API_KEY to manage lists.</p>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="admin key"
          className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          className="mt-3 w-full rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
