import { AnimatePresence, motion } from "motion/react";

export type Screen = "overview" | "lists" | "contacts" | "settings";

const items: { id: Screen; label: string; icon: React.ReactNode }[] = [
  {
    id: "overview",
    label: "Overview",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    id: "lists",
    label: "Lists",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="21" y1="4" x2="14" y2="4" />
        <line x1="10" y1="4" x2="3" y2="4" />
        <line x1="21" y1="12" x2="12" y2="12" />
        <line x1="8" y1="12" x2="3" y2="12" />
        <line x1="21" y1="20" x2="16" y2="20" />
        <line x1="12" y1="20" x2="3" y2="20" />
        <line x1="14" y1="2" x2="14" y2="6" />
        <line x1="8" y1="10" x2="8" y2="14" />
        <line x1="16" y1="18" x2="16" y2="22" />
      </svg>
    ),
  },
];

function Nav({ screen, go, rail, badge }: { screen: Screen; go: (s: Screen) => void; rail: boolean; badge?: number }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((it) => {
        const active = screen === it.id;
        return (
          <button
            key={it.id}
            onClick={() => go(it.id)}
            title={rail ? it.label : undefined}
            className={`relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
              active ? "text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            } ${rail ? "justify-center" : ""}`}
          >
            {active && (
              <motion.span
                layoutId="nav-pill"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
                className="absolute inset-0 rounded-xl bg-zinc-800"
              />
            )}
            <span className="relative">{it.icon}</span>
            {!rail && <span className="relative">{it.label}</span>}
            {!rail && it.id === "contacts" && badge != null && badge > 0 && (
              <span className="relative ml-auto rounded-full bg-amber-900/60 px-2 py-0.5 text-xs text-amber-200">{badge}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/** beui animated-sidebar spirit: icon rail on desktop, sheet on mobile. */
export function Sidebar({
  screen,
  go,
  collapsed,
  toggle,
  mobileOpen,
  setMobileOpen,
  pendingBadge,
}: {
  screen: Screen;
  go: (s: Screen) => void;
  collapsed: boolean;
  toggle: () => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  pendingBadge?: number;
}) {
  const pick = (s: Screen) => {
    go(s);
    setMobileOpen(false);
  };
  return (
    <>
      {/* desktop */}
      <motion.aside
        animate={{ width: collapsed ? 68 : 232 }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 p-3 md:flex"
      >
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between px-1"} py-2`}>
          {!collapsed && <span className="text-sm font-semibold text-zinc-100">MailCollector</span>}
          <button onClick={toggle} title="Toggle sidebar (⌘B)" className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>
        <div className="mt-2 flex-1">
          <Nav screen={screen} go={pick} rail={collapsed} badge={pendingBadge} />
        </div>
        {!collapsed && <div className="px-2 py-1 text-[11px] text-zinc-600">internal tool · v1</div>}
      </motion.aside>

      {/* mobile sheet */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
              className="flex h-full w-64 flex-col bg-zinc-950 p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-1 py-2 text-sm font-semibold text-zinc-100">MailCollector</div>
              <Nav screen={screen} go={pick} rail={false} badge={pendingBadge} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function MenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 md:hidden" aria-label="Open menu">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
      </svg>
    </button>
  );
}
