import { useState } from "react";
import {
  Activity,
  ChevronDown,
  LayoutDashboard,
  List,
  Lock,
  Mail,
  Monitor,
  Moon,
  PanelLeft,
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
import { Kbd, modK, modKey } from "../Kbd";
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

/** Full 232px sidebar. `onNavigate` closes the mobile sheet after a link is followed. */
function SidebarExpanded({ onNavigate, showCollapse }: { onNavigate?: () => void; showCollapse: boolean }) {
  const { lists, pending, loaded } = useSidebarData();
  const { toggleCollapsed, setPaletteOpen, setNewListOpen } = useShell();
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
        <div className="flex-1 leading-tight">
          <b className="block text-[13.5px] font-semibold">Mailbag</b>
          <span className="text-[11.5px] text-faint">Steiner &amp; Co</span>
        </div>
        {showCollapse && (
          <Tip label="Collapse sidebar" keys={`${modKey} \\`} side="bottom">
            <IconBtn label="Collapse sidebar" onClick={toggleCollapsed}>
              <PanelLeft />
            </IconBtn>
          </Tip>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          setPaletteOpen(true);
        }}
        className="mb-3 flex h-[30px] items-center gap-[7px] rounded-[7px] border border-line bg-panel px-2 text-faint hover:bg-hover"
      >
        <Search className="size-[15px]" aria-hidden />
        <span className="flex-1 text-left">Search or jump to…</span>
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
  const { toggleCollapsed, setPaletteOpen, setNewListOpen } = useShell();
  const status = useApiStatus();
  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-0.5 py-2.5">
      <Tip label="Expand sidebar" keys={`${modKey} \\`}>
        <button type="button" onClick={toggleCollapsed} aria-label="Expand sidebar" className="mb-2 rounded-[7px]">
          <Logo />
        </button>
      </Tip>
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

/** Desktop docked sidebar (232px or 56px rail). Hidden below 1024px. */
export function Sidebar() {
  const { collapsed } = useShell();
  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        "hidden shrink-0 border-r border-line bg-side transition-[width] duration-200 lg:block",
        collapsed ? "w-14" : "w-[232px]",
      )}
    >
      {collapsed ? <SidebarRail /> : <SidebarExpanded showCollapse />}
    </aside>
  );
}

/** Sidebar body for the mobile sheet. */
export function SidebarSheetBody({ onNavigate }: { onNavigate: () => void }) {
  return <SidebarExpanded showCollapse={false} onNavigate={onNavigate} />;
}
