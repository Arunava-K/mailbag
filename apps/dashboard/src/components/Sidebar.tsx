import { AnimatePresence, motion } from "motion/react";
import type { MailList } from "../lib/api";

export type Screen = "overview" | "lists" | "contacts" | "settings";

const mainItems: { id: Screen; label: string; icon: React.ReactNode; count?: number }[] = [
  {
    id: "overview",
    label: "Overview",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "lists",
    label: "Lists",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 17 9 5 9-5" />
      </svg>
    ),
  },
  {
    id: "contacts",
    label: "Contacts",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  },
];

export function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className={filled ? "text-amber-500" : "text-zinc-300"}>
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
    </svg>
  );
}

function NavBody({
  screen, go, lists, starred, activeKey, openList, rail, pendingBadge, onSearch,
}: {
  screen: Screen | "list";
  go: (s: Screen) => void;
  lists: MailList[];
  starred: string[];
  activeKey: string | null;
  openList: (k: string) => void;
  rail: boolean;
  pendingBadge: number;
  onSearch: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <div>
        <button onClick={onSearch} className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[13px] text-zinc-400 hover:border-zinc-300">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
          {!rail && <span className="flex-1 text-left">Search…</span>}
          {!rail && <kbd className="rounded border border-zinc-200 bg-white px-1 text-[11px] text-zinc-400">⌘K</kbd>}
        </button>
      </div>
      <nav className="flex flex-col gap-0.5">
        {mainItems.map((it) => {
          const active = screen === it.id;
          return (
            <button
              key={it.id}
              onClick={() => go(it.id)}
              title={rail ? it.label : undefined}
              className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] ${active ? "font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-100"} ${rail ? "justify-center" : ""}`}
            >
              {active && <motion.span layoutId="nav-pill" transition={{ type: "spring", stiffness: 550, damping: 40 }} className="absolute inset-0 rounded-lg bg-zinc-100" />}
              <span className="relative">{it.icon}</span>
              {!rail && <span className="relative flex-1 text-left">{it.label}</span>}
              {!rail && it.id === "contacts" && pendingBadge > 0 && (
                <span className="relative rounded-full bg-amber-100 px-1.5 text-[11px] font-medium text-amber-700">{pendingBadge}</span>
              )}
            </button>
          );
        })}
      </nav>
      {!rail && (
        <>
          {starred.length > 0 && (
            <div>
              <div className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">Starred</div>
              {lists.filter((l) => starred.includes(l.list_key)).map((l) => (
                <button key={l.list_key} onClick={() => openList(l.list_key)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] ${activeKey === l.list_key ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-100"}`}>
                  <span className={`h-2 w-2 shrink-0 rounded-sm ${l.type === "waitlist" ? "bg-violet-400" : "bg-emerald-400"}`} />
                  <span className="truncate">{l.name}</span>
                </button>
              ))}
            </div>
          )}
          <div>
            <div className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">Lists</div>
            {lists.map((l) => (
              <button key={l.list_key} onClick={() => openList(l.list_key)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] ${activeKey === l.list_key ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-100"}`}>
                <span className={`h-2 w-2 shrink-0 rounded-sm ${l.type === "waitlist" ? "bg-violet-400" : "bg-emerald-400"}`} />
                <span className="truncate">{l.name}</span>
                <span className="ml-auto text-[11px] tabular-nums text-zinc-400">{l.confirmed}</span>
              </button>
            ))}
            {lists.length === 0 && <p className="px-2.5 py-1 text-xs text-zinc-400">No lists yet.</p>}
          </div>
        </>
      )}
    </div>
  );
}

export function Sidebar(props: {
  screen: Screen | "list";
  go: (s: Screen) => void;
  lists: MailList[];
  starred: string[];
  activeKey: string | null;
  openList: (k: string) => void;
  collapsed: boolean;
  toggle: () => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  pendingBadge: number;
  onSearch: () => void;
}) {
  const { collapsed, toggle, mobileOpen, setMobileOpen } = props;
  const pick = (s: Screen) => {
    props.go(s);
    setMobileOpen(false);
  };
  const openList = (k: string) => {
    props.openList(k);
    setMobileOpen(false);
  };
  return (
    <>
      <motion.aside
        animate={{ width: collapsed ? 60 : 248 }}
        transition={{ type: "spring", stiffness: 340, damping: 36 }}
        className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-zinc-200 bg-white md:flex"
      >
        <div className={`flex items-center gap-2 border-b border-zinc-100 px-3 py-3 ${collapsed ? "justify-center" : ""}`}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white">M</span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-zinc-900">MailCollector</div>
              <div className="text-[11px] text-zinc-500">{props.lists.length} lists</div>
            </div>
          )}
          {!collapsed && (
            <button onClick={toggle} title="Collapse (⌘B)" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
            </button>
          )}
        </div>
        {collapsed && (
          <button onClick={toggle} title="Expand (⌘B)" className="mx-auto mt-2 rounded-md p-1 text-zinc-400 hover:bg-zinc-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
          </button>
        )}
        <div className="flex-1 overflow-hidden p-2">
          <NavBody {...props} go={pick} openList={openList} rail={collapsed} />
        </div>
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-zinc-950/30 md:hidden" onClick={() => setMobileOpen(false)}>
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="flex h-full w-72 flex-col bg-white p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 border-b border-zinc-100 px-2 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white">M</span>
                <div className="text-[13px] font-semibold text-zinc-900">MailCollector</div>
              </div>
              <div className="flex-1 overflow-hidden pt-2">
                <NavBody {...props} go={pick} openList={openList} rail={false} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function MenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 md:hidden" aria-label="Open menu">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
      </svg>
    </button>
  );
}
