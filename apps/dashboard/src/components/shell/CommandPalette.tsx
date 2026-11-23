import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Activity, CornerDownLeft, LayoutDashboard, List, Lock, Monitor, PanelLeft, Plus, Search, Settings, SunMoon, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { navigate } from "@/lib/router";
import { paths } from "@/lib/routes";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useContacts, useLists } from "@/lib/queries";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Kbd } from "../Kbd";
import { TypeDot } from "../TypeDot";
import { StatusDot, statusTone } from "../StatusLabel";
import { useShell } from "./ShellContext";

type Group = "Pages" | "Lists" | "Actions" | "Contacts";
interface Item {
  id: string;
  group: Group;
  label: string;
  sub?: ReactNode;
  icon: ReactNode;
  hint?: string;
  run: () => void;
}

const GROUPS: Group[] = ["Pages", "Lists", "Actions", "Contacts"];

/** 2 = substring, 1 = subsequence, 0 = no match. */
function score(q: string, text: string): number {
  const t = text.toLowerCase();
  if (t.includes(q)) return t.startsWith(q) ? 3 : 2;
  let i = 0;
  for (const ch of t) if (ch === q[i]) i++;
  return i === q.length ? 1 : 0;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const ic = "size-[15px]";

function Palette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { setNewListOpen, toggleCollapsed } = useShell();
  const { lock } = useAuth();
  const { toggle, setMode } = useTheme();
  const lists = useLists();

  const query = q.trim().toLowerCase();
  const debounced = useDebounced(q.trim(), 250);
  const searching = debounced.length >= 2;
  const contacts = useContacts({ q: debounced, limit: 6 }, { enabled: searching });
  const contactsSettled = searching && debounced === q.trim() && !contacts.isFetching;

  const go = (to: string) => () => {
    onClose();
    navigate(to);
  };
  const act = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const items = useMemo<Item[]>(() => {
    const all: Item[] = [
      { id: "p-overview", group: "Pages", label: "Overview", icon: <LayoutDashboard className={ic} />, hint: "G O", run: go(paths.overview()) },
      { id: "p-contacts", group: "Pages", label: "Contacts", icon: <Users className={ic} />, hint: "G C", run: go(paths.contacts()) },
      { id: "p-activity", group: "Pages", label: "Activity", icon: <Activity className={ic} />, hint: "G A", run: go(paths.activity()) },
      { id: "p-lists", group: "Pages", label: "All lists", icon: <List className={ic} />, hint: "G L", run: go(paths.lists()) },
      { id: "p-settings", group: "Pages", label: "Settings", icon: <Settings className={ic} />, hint: "G S", run: go(paths.settings()) },
      ...(lists.data ?? []).map<Item>((l) => ({
        id: `l-${l.list_key}`,
        group: "Lists",
        label: l.name,
        sub: <span className="tabular">{fmtNum(l.confirmed)} confirmed</span>,
        icon: <TypeDot type={l.type} className="mx-[3px]" />,
        run: go(paths.list(l.list_key)),
      })),
      { id: "a-new", group: "Actions", label: "New list", icon: <Plus className={ic} />, hint: "C", run: act(() => setNewListOpen(true)) },
      { id: "a-theme", group: "Actions", label: "Toggle theme", sub: "light / dark", icon: <SunMoon className={ic} />, run: act(toggle) },
      { id: "a-system", group: "Actions", label: "Use system theme", icon: <Monitor className={ic} />, run: act(() => setMode("system")) },
      { id: "a-sidebar", group: "Actions", label: "Collapse or expand sidebar", icon: <PanelLeft className={ic} />, hint: "⌘\\", run: act(toggleCollapsed) },
      { id: "a-lock", group: "Actions", label: "Lock", sub: "forget the admin key in this browser", icon: <Lock className={ic} />, run: act(lock) },
    ];
    const local = query ? all.filter((i) => score(query, `${i.label} ${typeof i.sub === "string" ? i.sub : ""}`) > 0) : all;
    const sorted = query ? [...local].sort((a, b) => score(query, b.label) - score(query, a.label)) : local;
    const found: Item[] = searching
      ? (contacts.data?.contacts ?? []).map((c) => ({
          id: `c-${c.list_key}-${c.email}`,
          group: "Contacts" as const,
          label: c.email,
          sub: c.list_name,
          icon: <StatusDot tone={statusTone[c.status]} className="mx-1.5" />,
          run: go(paths.contact(c.list_key, c.email)),
        }))
      : [];
    return [...GROUPS.flatMap((g) => [...sorted, ...found].filter((i) => i.group === g))];
  }, [lists.data, query, searching, contacts.data]);

  useEffect(() => setCursor(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const onKey = (e: KeyboardEvent) => {
    const n = items.length;
    if (e.key === "ArrowDown") setCursor((c) => (n ? (c + 1) % n : 0));
    else if (e.key === "ArrowUp") setCursor((c) => (n ? (c - 1 + n) % n : 0));
    else if (e.key === "Home") setCursor(0);
    else if (e.key === "End") setCursor(Math.max(0, n - 1));
    else if (e.key === "Enter") items[cursor]?.run();
    else return;
    e.preventDefault();
  };

  let idx = -1;
  return (
    <>
      <div className="flex items-center gap-2 border-b border-line-2 px-3.5">
        <Search className="size-4 shrink-0 text-faint" aria-hidden />
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls="palette-list"
          aria-activedescendant={items[cursor] ? `palette-opt-${cursor}` : undefined}
          aria-autocomplete="list"
          aria-label="Search pages, lists, actions and contacts"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="Search or jump to…"
          className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
        <Kbd>esc</Kbd>
      </div>
      <div ref={listRef} id="palette-list" role="listbox" aria-label="Results" className="max-h-[min(55svh,420px)] overflow-y-auto p-1.5">
        {GROUPS.map((g) => {
          const rows = items.filter((i) => i.group === g);
          if (rows.length === 0) return null;
          return (
            <div key={g} role="group" aria-label={g}>
              <div aria-hidden className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-faint">
                {g}
              </div>
              {rows.map((it) => {
                idx++;
                const i = idx;
                const on = i === cursor;
                return (
                  <div
                    key={it.id}
                    id={`palette-opt-${i}`}
                    data-idx={i}
                    role="option"
                    aria-selected={on}
                    onMouseMove={() => setCursor(i)}
                    onClick={it.run}
                    className={cn("flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5", on ? "bg-hover" : "")}
                  >
                    <span className="grid w-[15px] shrink-0 place-items-center text-muted-foreground">{it.icon}</span>
                    <span className="min-w-0 truncate">{it.label}</span>
                    {it.sub && <span className="min-w-0 truncate text-xs text-faint">{it.sub}</span>}
                    <span className="flex-1" />
                    {it.hint && <Kbd>{it.hint}</Kbd>}
                    {on && !it.hint && <CornerDownLeft className="size-3.5 text-faint" aria-hidden />}
                  </div>
                );
              })}
            </div>
          );
        })}
        {searching && !items.some((i) => i.group === "Contacts") && (
          <p className="px-2.5 py-2 text-xs text-faint" role="status">
            {contacts.isError ? "Contact search failed." : contactsSettled ? `No contacts match “${debounced}”.` : "Searching contacts…"}
          </p>
        )}
        {items.length === 0 && !searching && <p className="px-2.5 py-6 text-center text-xs text-faint">Nothing matches “{q}”.</p>}
      </div>
      <div className="flex items-center gap-3 border-t border-line-2 px-3.5 py-2 text-[11px] text-faint max-sm:hidden">
        <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate</span>
        <span><Kbd>↵</Kbd> open</span>
        <span className="ml-auto">Type 2+ letters to search contacts</span>
      </div>
    </>
  );
}

/** ⌘K command palette: pages, lists, actions, and contact search across all lists. */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen } = useShell();
  return (
    <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[12svh] translate-y-0 gap-0 overflow-hidden bg-panel p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">Search pages, lists, actions and contacts. Use arrow keys and Enter.</DialogDescription>
        <Palette onClose={() => setPaletteOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
