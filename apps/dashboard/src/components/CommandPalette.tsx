import { useEffect, useMemo, useRef, useState } from "react";
import type { MailList } from "../lib/api";
import type { Screen } from "./app-shell";

/** ⌘K palette: jump to screens + lists, create a list. */
export function CommandPalette({
  open, onClose, lists, go, openList, onNewList,
}: {
  open: boolean;
  onClose: () => void;
  lists: MailList[];
  go: (s: Screen) => void;
  openList: (k: string) => void;
  onNewList: () => void;
}) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const screens: { label: string; hint: string; run: () => void }[] = [
      { label: "Go to Overview", hint: "screen", run: () => go("overview") },
      { label: "Go to Lists", hint: "screen", run: () => go("lists") },
      { label: "Go to Contacts", hint: "screen", run: () => go("contacts") },
      { label: "Go to Settings", hint: "screen", run: () => go("settings") },
      { label: "New list…", hint: "action", run: onNewList },
    ].filter((s) => !needle || s.label.toLowerCase().includes(needle));
    const hits = lists
      .filter((l) => !needle || l.name.toLowerCase().includes(needle) || l.list_key.includes(needle))
      .slice(0, 8)
      .map((l) => ({ label: l.name, hint: `${l.type} · ${l.confirmed} confirmed`, run: () => openList(l.list_key) }));
    return [...hits, ...screens].slice(0, 12);
  }, [q, lists, go, openList, onNewList]);

  useEffect(() => setIdx(0), [results.length]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  const run = (fn: () => void) => {
    onClose();
    fn();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[15vh]" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border bg-popover shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIdx((i) => Math.min(results.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIdx((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter" && results[idx]) {
            run(results[idx].run);
          }
        }}
      >
        <div className="flex items-center gap-2 border-b px-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted-foreground"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search lists or jump…"
            aria-label="Search lists or jump"
            className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border bg-muted px-1 text-[11px] text-muted-foreground">esc</kbd>
        </div>
        <div className="max-h-64 overflow-auto p-1.5">
          {results.map((r, i) => (
            <button
              key={`${r.hint}-${r.label}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => run(r.run)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${i === idx ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            >
              <span className="flex-1 truncate">{r.label}</span>
              <span className="text-[11px] text-muted-foreground">{r.hint}</span>
            </button>
          ))}
          {results.length === 0 && <p className="px-2.5 py-4 text-center text-sm text-muted-foreground">No matches.</p>}
        </div>
      </div>
    </div>
  );
}
