import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  Activity,
  ChevronDown,
  LayoutDashboard,
  List,
  Lock,
  Mail,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { Link, useIsActive } from "@/lib/router";
import { paths } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { useApiStatus, useBuildDrift, useLists, type ApiStatus } from "@/lib/queries";
import { buildLabel } from "@/lib/version";
import type { MailList } from "@/lib/api";
import { Kbd, modK } from "../Kbd";
import { TypeDot } from "../TypeDot";
import { IconBtn } from "../Btn";
import { NavItem, PendingBadge, RailLink, Tip } from "./SidebarParts";
import { useShell } from "./ShellContext";

const LISTS_OPEN_KEY = "mb-sidebar-lists-open";

const statusText: Record<ApiStatus, string> = {
  checking: "Checking API…",
  online: "API online",
  degraded: "API degraded",
  offline: "API unreachable",
};
const ledClass: Record<ApiStatus, string> = {
  checking: "bg-warning shadow-[0_0_0_3px_var(--warning-soft)]",
  online: "bg-success shadow-[0_0_0_3px_var(--success-soft)]",
  degraded: "bg-warning shadow-[0_0_0_3px_var(--warning-soft)]",
  offline: "bg-danger shadow-[0_0_0_3px_var(--danger-soft)]",
};

const nextMode: Record<ThemeMode, ThemeMode> = { light: "dark", dark: "system", system: "light" };
const modeIcon = { light: Sun, dark: Moon, system: Monitor };

function useSidebarData() {
  const lists = useLists();
  const data = lists.data ?? [];
  const pending = data.reduce((s, l) => s + l.pending, 0);
  return { lists: data, pending, loaded: lists.isSuccess };
}

function ThemeButton() {
  const { mode, setMode } = useTheme();
  const Icon = modeIcon[mode];
  return (
    <Tip label={`Theme: ${mode}. Switch to ${nextMode[mode]}`} side="top">
      <IconBtn label={`Theme: ${mode}. Switch to ${nextMode[mode]}`} onClick={() => setMode(nextMode[mode])}>
        <Icon />
      </IconBtn>
    </Tip>
  );
}

function SystemCard({ onNavigate }: { onNavigate?: () => void }) {
  const status = useApiStatus();
  const { apiBuild, drift, dashboardBuild } = useBuildDrift();
  const inSync = !drift && apiBuild && apiBuild.commit !== "none" && dashboardBuild.commit !== "none";
  return (
    <Link
      to={paths.settings()}
      onClick={onNavigate}
      className="flex items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-2 hover:bg-hover"
    >
      <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", ledClass[status])} />
      <span className="min-w-0 flex-1 leading-tight">
        <b className="block text-xs font-medium">{statusText[status]}</b>
        <span className="block truncate font-mono text-[11px] text-faint">{buildLabel(apiBuild)}</span>
      </span>
      {drift ? (
        <span className="text-[11px] font-medium text-warning">out of sync</span>
      ) : inSync ? (
        <span className="text-[11px] text-faint">in sync</span>
      ) : null}
    </Link>
  );
}

function AccountRow({ onNavigate }: { onNavigate?: () => void }) {
  const { lock } = useAuth();
  return (
    <div className="flex items-center gap-2 pr-0.5 pl-1.5">
      <span
        aria-hidden
        className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[10.5px] font-semibold text-primary-foreground"
      >
        AD
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <b className="block text-[12.5px] font-medium">Admin</b>
        <span className="block text-[11px] text-faint">this browser</span>
      </span>
      <ThemeButton />
      <Tip label="Settings" side="top">
        <Link
          to={paths.settings()}
          onClick={onNavigate}
          aria-label="Settings"
          className="grid size-[26px] place-items-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground [&_svg]:size-[15px]"
        >
          <Settings />
        </Link>
      </Tip>
      <Tip label="Lock (forget admin key)" side="top">
        <IconBtn label="Lock" onClick={lock}>
          <Lock />
        </IconBtn>
      </Tip>
    </div>
  );
}

function ListRow({ list, onNavigate }: { list: MailList; onNavigate?: () => void }) {
  const to = paths.list(list.list_key);
  const active = useIsActive(`/lists/${encodeURIComponent(list.list_key)}`);
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-[30px] items-center gap-[9px] rounded-md px-2 font-medium text-muted-foreground transition-colors hover:bg-hover hover:text-foreground",
        active && "bg-panel text-foreground shadow-[0_0_0_1px_var(--line),0_1px_2px_rgb(0_0_0/0.04)] hover:bg-panel",
      )}
    >
      <TypeDot type={list.type} className="size-2" />
      <span className="min-w-0 flex-1 truncate">{list.name}</span>
      {list.stale_pending > 0 && (
        <span
          role="img"
          aria-label={`${list.stale_pending} pending for more than 48 hours`}
          title={`${list.stale_pending} pending > 48h`}
          className="size-1.5 shrink-0 rounded-full bg-warning"
        />
      )}
      <span className="shrink-0 text-[11.5px] font-normal text-faint tabular" title="confirmed">
        {fmtNum(list.confirmed)}
      </span>
    </Link>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("grid size-7 shrink-0 place-items-center rounded-[7px] bg-brand text-primary-foreground", className)}>
      <Mail className="size-[15px]" strokeWidth={2} aria-hidden />
    </span>
  );
}

const SIDEBAR_WIDTH_KEY = "mb-sidebar-width";
const DEFAULT_WIDTH = 232;
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;
const COLLAPSE_WIDTH = 160;
const RAIL_WIDTH = 56;

const clampWidth = (width: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));

function initialSidebarWidth() {
  try {
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return stored >= MIN_WIDTH && stored <= MAX_WIDTH ? stored : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

/** Resizable desktop sidebar. `onNavigate` closes the mobile sheet after a link is followed. */
function SidebarExpanded({ onNavigate }: { onNavigate?: () => void }) {
  const { lists, pending, loaded } = useSidebarData();
  const { setPaletteOpen, setNewListOpen } = useShell();
  const [open, setOpen] = useState(() => localStorage.getItem(LISTS_OPEN_KEY) !== "0");
  const toggleOpen = () =>
    setOpen((o) => {
      localStorage.setItem(LISTS_OPEN_KEY, o ? "0" : "1");
      return !o;
    });

  return (
    <div className="flex h-full min-h-0 flex-col px-2 py-2.5">
      <div className="flex items-center gap-[9px] px-1 pb-3">
        <Logo />
        <div className="min-w-0 flex-1 leading-tight">
          <b className="block text-[13.5px] font-semibold">Mailbag</b>
          <span className="text-[11.5px] text-faint">Steiner &amp; Co</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          setPaletteOpen(true);
        }}
        className="mb-3 flex h-[30px] items-center gap-[7px] rounded-[7px] border border-line bg-panel px-2 text-faint hover:bg-hover"
      >
        <Search className="size-[15px] shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">Search or jump to…</span>
        <Kbd>{modK}</Kbd>
      </button>

      <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col">
        <NavItem to={paths.overview()} exact icon={<LayoutDashboard />} label="Overview" hint="G O" onNavigate={onNavigate} />
        <NavItem
          to={paths.contacts()}
          icon={<Users />}
          label="Contacts"
          hint="G C"
          right={<PendingBadge n={pending} />}
          onNavigate={onNavigate}
        />
        <NavItem to={paths.activity()} icon={<Activity />} label="Activity" hint="G A" onNavigate={onNavigate} />

        <div className="mt-3.5 flex h-[26px] items-center gap-1 pr-1 pl-2 text-[11.5px] font-medium text-faint">
          <button
            type="button"
            onClick={toggleOpen}
            aria-expanded={open}
            aria-controls="sidebar-lists"
            className="flex flex-1 items-center gap-1 rounded text-left hover:text-foreground"
          >
            Lists
            <ChevronDown className={cn("size-3 transition-transform", !open && "-rotate-90")} aria-hidden />
          </button>
          <Tip label="New list" keys="C" side="bottom">
            <IconBtn label="New list" onClick={() => setNewListOpen(true)} className="size-[22px]">
              <Plus />
            </IconBtn>
          </Tip>
        </div>

        <div id="sidebar-lists" className="min-h-0 overflow-y-auto" hidden={!open}>
          {lists.map((l) => (
            <ListRow key={l.list_key} list={l} onNavigate={onNavigate} />
          ))}
          {loaded && lists.length === 0 && <p className="px-2 py-1.5 text-xs text-faint">No lists yet</p>}
        </div>
        <NavItem
          to={paths.lists()}
          exact
          icon={<List />}
          label="All lists"
          muted
          hint="G L"
          onNavigate={onNavigate}
          className="mt-0.5"
        />
      </nav>

      <div className="mt-auto flex flex-col gap-1.5 pt-2">
        <SystemCard onNavigate={onNavigate} />
        <div className="mx-0.5 my-1 h-px bg-line" />
        <AccountRow onNavigate={onNavigate} />
      </div>
    </div>
  );
}

/** 56px collapsed rail: icons with tooltips. */
function SidebarRail() {
  const { lists, pending } = useSidebarData();
  const { setPaletteOpen, setNewListOpen } = useShell();
  const status = useApiStatus();
  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-0.5 py-2.5">
      <div className="mb-2">
        <Logo />
      </div>
      <Tip label="Search or jump to…" keys={modK}>
        <IconBtn label="Search" onClick={() => setPaletteOpen(true)} className="mb-1.5 size-[34px] border border-line bg-panel">
          <Search />
        </IconBtn>
      </Tip>
      <RailLink to={paths.overview()} exact label="Overview" keys="G O">
        <LayoutDashboard />
      </RailLink>
      <RailLink
        to={paths.contacts()}
        label={pending > 0 ? `Contacts · ${fmtNum(pending)} pending` : "Contacts"}
        keys="G C"
        dot={pending > 0}
      >
        <Users />
      </RailLink>
      <RailLink to={paths.activity()} label="Activity" keys="G A">
        <Activity />
      </RailLink>
      <div className="my-2 h-px w-7 bg-line" aria-hidden />
      <div className="flex min-h-0 flex-col items-center gap-0.5 overflow-y-auto">
        {lists.map((l) => (
          <RailLink key={l.list_key} to={paths.list(l.list_key)} label={l.name} dot={l.stale_pending > 0}>
            <TypeDot type={l.type} />
          </RailLink>
        ))}
      </div>
      <Tip label="New list" keys="C">
        <IconBtn label="New list" onClick={() => setNewListOpen(true)} className="size-[34px]">
          <Plus />
        </IconBtn>
      </Tip>
      <div className="mt-auto flex flex-col items-center gap-1 pt-2">
        <Tip label={statusText[status]}>
          <Link to={paths.settings()} aria-label={statusText[status]} className="grid size-[26px] place-items-center rounded-md hover:bg-hover">
            <span aria-hidden className={cn("size-[7px] rounded-full", ledClass[status])} />
          </Link>
        </Tip>
        <ThemeButton />
        <RailLink to={paths.settings()} label="Settings">
          <Settings />
        </RailLink>
        <span aria-hidden className="mt-1 grid size-6 place-items-center rounded-full bg-brand text-[10.5px] font-semibold text-primary-foreground">
          AD
        </span>
      </div>
    </div>
  );
}

/** Desktop docked sidebar, resizable from its right edge. Hidden below 1024px. */
export function Sidebar() {
  const { collapsed, setCollapsed } = useShell();
  const [width, setWidth] = useState(initialSidebarWidth);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [settling, setSettling] = useState(false);
  const aside = useRef<HTMLElement | null>(null);
  const settleTimer = useRef<number | null>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
    currentWidth: number;
    cursor: string;
    userSelect: string;
  } | null>(null);
  const dragging = dragWidth !== null;
  const visualWidth = dragWidth ?? (collapsed ? RAIL_WIDTH : width);
  const panelWidth = dragging && collapsed ? RAIL_WIDTH : visualWidth;
  const previewing = dragging || settling;
  const expandedOpacity = collapsed ? 0 : 1;

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
    } catch {
      /* ignore */
    }
  }, [width]);

  useEffect(
    () => () => {
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      if (drag.current) {
        document.body.style.cursor = drag.current.cursor;
        document.body.style.userSelect = drag.current.userSelect;
      }
    },
    [],
  );

  const interruptSettle = () => {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = null;
    setSettling(false);
  };

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    interruptSettle();
    const currentWidth = aside.current?.getBoundingClientRect().width ?? (collapsed ? RAIL_WIDTH : width);
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startWidth: currentWidth,
      currentWidth,
      cursor: document.body.style.cursor,
      userSelect: document.body.style.userSelect,
    };
    document.body.style.cursor = collapsed ? "pointer" : "col-resize";
    document.body.style.userSelect = "none";
    setDragWidth(currentWidth);
  };

  const moveDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== e.pointerId || collapsed) return;
    const next = current.startWidth + e.clientX - current.startX;
    const preview = Math.min(MAX_WIDTH, Math.max(COLLAPSE_WIDTH, Math.round(next)));
    current.currentWidth = preview;
    setDragWidth(preview);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const current = drag.current;
    if (!current || current.pointerId !== e.pointerId) return;
    drag.current = null;
    document.body.style.cursor = current.cursor;
    document.body.style.userSelect = current.userSelect;
    if (!cancelled) {
      const nextCollapsed = collapsed ? false : current.currentWidth <= COLLAPSE_WIDTH;
      setCollapsed(nextCollapsed);
      if (!nextCollapsed) setWidth(collapsed ? width : clampWidth(current.currentWidth));
    }
    setDragWidth(null);
    setSettling(true);
    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = null;
      setSettling(false);
    }, 200);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const resizeWithKeyboard = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      if (collapsed) return;
      e.preventDefault();
      interruptSettle();
      if (width - 16 < MIN_WIDTH) setCollapsed(true);
      else setWidth(clampWidth(width - 16));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      interruptSettle();
      if (collapsed) setCollapsed(false);
      else setWidth(clampWidth(width + 16));
    } else if (e.key === "Home") {
      e.preventDefault();
      interruptSettle();
      setCollapsed(true);
    } else if (e.key === "End") {
      e.preventDefault();
      interruptSettle();
      setCollapsed(false);
      setWidth(MAX_WIDTH);
    }
  };

  return (
    <aside
      ref={aside}
      aria-label="Sidebar"
      style={{
        width: panelWidth,
        transition: settling ? "width 200ms cubic-bezier(0.32, 0.72, 0, 1)" : undefined,
      }}
      className="relative hidden shrink-0 border-r border-line bg-side lg:block"
    >
      {previewing ? (
        <>
          <div
            aria-hidden={expandedOpacity > 0.5}
            inert={expandedOpacity > 0.5}
            className="absolute inset-0"
            style={{
              opacity: 1 - expandedOpacity,
              pointerEvents: expandedOpacity > 0.5 ? "none" : "auto",
              transition: settling ? "opacity 120ms ease-out" : undefined,
            }}
          >
            <SidebarRail />
          </div>
          <div
            aria-hidden={expandedOpacity <= 0.5}
            inert={expandedOpacity <= 0.5}
            className="absolute inset-0"
            style={{
              opacity: expandedOpacity,
              pointerEvents: expandedOpacity > 0.5 ? "auto" : "none",
              transition: settling ? "opacity 120ms ease-out" : undefined,
            }}
          >
            <SidebarExpanded />
          </div>
        </>
      ) : (
        <div className="h-full">{collapsed ? <SidebarRail /> : <SidebarExpanded />}</div>
      )}
      <div
        role="separator"
        tabIndex={0}
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemin={RAIL_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={Math.round(visualWidth)}
        aria-valuetext={dragging || !collapsed ? `${Math.round(visualWidth)} pixels` : "Collapsed"}
        title={collapsed ? "Click to expand" : "Drag to resize · Double-click to reset"}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={(e) => endDrag(e, true)}
        onLostPointerCapture={(e) => endDrag(e, true)}
        onKeyDown={resizeWithKeyboard}
        onDoubleClick={() => {
          interruptSettle();
          setCollapsed(false);
          setWidth(DEFAULT_WIDTH);
        }}
        className={cn(
          "group/resize absolute inset-y-0 -right-1 z-30 w-2 touch-none focus-visible:outline-none",
          collapsed ? "cursor-pointer" : "cursor-col-resize",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors",
            dragging ? "bg-brand" : "bg-transparent group-hover/resize:bg-brand/60 group-focus-visible/resize:bg-brand/60",
          )}
        />
      </div>
    </aside>
  );
}

/** Sidebar body for the mobile sheet. */
export function SidebarSheetBody({ onNavigate }: { onNavigate: () => void }) {
  return <SidebarExpanded onNavigate={onNavigate} />;
}
