import { useState } from "react";

export function KeyGate({ onUnlock }: { onUnlock: (key: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] p-6">
      <form
        className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) {
            localStorage.setItem("mb-admin-key", value.trim());
            onUnlock(value.trim());
          }
        }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-base font-bold text-white">M</div>
        <h1 className="mt-3 text-[15px] font-semibold text-zinc-900">Mailbag</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">Enter ADMIN_API_KEY to manage lists.</p>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="admin key"
          className="mt-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
        />
        <button type="submit" className="mt-3 w-full rounded-lg bg-zinc-900 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-zinc-700">
          Unlock
        </button>
      </form>
    </div>
  );
}
