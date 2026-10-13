import {
  LayoutDashboard,
  Lock,
  Mails,
  Mailbox,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useTheme } from "@/components/watermelon/astrix-dashboard/components/astrix/theme-provider";
import type { MailList } from "../lib/api";
import { cn } from "@/lib/utils";

export type Screen = "overview" | "lists" | "contacts" | "settings";

const mainItems: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "lists", label: "Lists", icon: Mails },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

function ListDot({ type }: { type: string }) {
  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-sm",
        type === "waitlist" ? "bg-violet-400" : "bg-emerald-400",
      )}
    />
  );
}

function MailbagSidebar({
  screen,
  go,
  lists,
  starred,
  activeKey,
  openList,
  pendingBadge,
  onLock,
}: {
  screen: Screen | "list";
  go: (s: Screen) => void;
  lists: MailList[];
  starred: string[];
  activeKey: string | null;
  openList: (k: string) => void;
  pendingBadge: number;
  onLock: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const starredLists = lists.filter((l) => starred.includes(l.list_key));

  return (
    <Sidebar collapsible="icon" className="border-none">
      <SidebarHeader className="h-16 flex-row items-center gap-2 px-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Mailbox className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <div className="truncate text-sm font-semibold">Mailbag</div>
          <div className="text-xs text-muted-foreground">
            {lists.length} list{lists.length === 1 ? "" : "s"}
          </div>
        </div>
        <SidebarTrigger className="ml-auto hidden md:flex" />
      </SidebarHeader>

      <SidebarContent className="gap-4 overflow-x-hidden px-2 py-2">
        <SidebarMenu>
          {mainItems.map((it) => {
            const Icon = it.icon;
            const active = screen === it.id;
            return (
              <SidebarMenuItem key={it.id}>
                <SidebarMenuButton
                  isActive={active}
                  tooltip={it.label}
                  onClick={() => go(it.id)}
                >
                  <Icon />
                  <span>{it.label}</span>
                  {it.id === "contacts" && pendingBadge > 0 && (
                    <span className="ml-auto rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-600 group-data-[collapsible=icon]:hidden dark:text-amber-400">
                      {pendingBadge}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        <div className="group-data-[collapsible=icon]:hidden">
          {starredLists.length > 0 && (
            <SidebarMenu>
              <div className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Starred
              </div>
              {starredLists.map((l) => (
                <SidebarMenuItem key={l.list_key}>
                  <SidebarMenuButton
                    isActive={activeKey === l.list_key}
                    onClick={() => openList(l.list_key)}
                  >
                    <ListDot type={l.type} />
                    <span className="truncate">{l.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          )}
          <SidebarMenu>
            <div className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Lists
            </div>
            {lists.map((l) => (
              <SidebarMenuItem key={l.list_key}>
                <SidebarMenuButton
                  isActive={activeKey === l.list_key}
                  onClick={() => openList(l.list_key)}
                >
                  <ListDot type={l.type} />
                  <span className="truncate">{l.name}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                    {l.confirmed}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            {lists.length === 0 && (
              <p className="px-2 py-1 text-xs text-muted-foreground">No lists yet.</p>
            )}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="px-2 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Toggle theme" onClick={toggleTheme}>
              {theme === "dark" ? <Sun /> : <Moon />}
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Lock dashboard" onClick={onLock}>
              <Lock />
              <span>Lock</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function Topbar({
  onSearch,
  onNewList,
  apiOk,
}: {
  onSearch: () => void;
  onNewList: () => void;
  apiOk: boolean;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="md:hidden" />
      <button
        onClick={onSearch}
        className="hidden h-10 flex-1 items-center gap-2 rounded-lg border-none bg-secondary px-3 text-sm text-muted-foreground hover:text-foreground sm:flex md:max-w-sm"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search or jump…</span>
        <kbd className="rounded-md bg-background px-1.5 py-1 text-[11px] font-medium">
          ⌘K
        </kbd>
      </button>
      <Button
        variant="secondary"
        size="icon-lg"
        className="size-10 sm:hidden"
        aria-label="Search"
        onClick={onSearch}
      >
        <Search className="size-5" />
      </Button>
      <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn(
            "size-2 rounded-full",
            apiOk ? "bg-emerald-500" : "bg-destructive",
          )}
        />
        {apiOk ? "API online" : "API offline"}
      </span>
      <Button onClick={onNewList} className="h-10">
        <Plus className="size-4" />
        <span className="hidden sm:inline">New list</span>
      </Button>
    </header>
  );
}

export function AppShell({
  screen,
  go,
  lists,
  starred,
  activeKey,
  openList,
  pendingBadge,
  onLock,
  onSearch,
  onNewList,
  apiOk,
  children,
}: {
  screen: Screen | "list";
  go: (s: Screen) => void;
  lists: MailList[];
  starred: string[];
  activeKey: string | null;
  openList: (k: string) => void;
  pendingBadge: number;
  onLock: () => void;
  onSearch: () => void;
  onNewList: () => void;
  apiOk: boolean;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider
      className="astrix-dashboard h-svh overflow-hidden"
      style={{ "--sidebar-width": "16.5rem", "--sidebar-width-icon": "3.75rem" } as React.CSSProperties}
    >
      <MailbagSidebar
        screen={screen}
        go={go}
        lists={lists}
        starred={starred}
        activeKey={activeKey}
        openList={openList}
        pendingBadge={pendingBadge}
        onLock={onLock}
      />
      <SidebarInset className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-30 w-full bg-background">
          <Topbar onSearch={onSearch} onNewList={onNewList} apiOk={apiOk} />
        </div>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
