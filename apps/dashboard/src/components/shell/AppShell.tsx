import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { GlobalShortcuts } from "@/lib/shortcuts";
import { CommandPalette } from "./CommandPalette";
import { NewListDialog } from "./NewListDialog";
import { ShellProvider, useShell } from "./ShellContext";
import { Sidebar, SidebarSheetBody } from "./Sidebar";

function Frame({ children }: { children: ReactNode }) {
  const { mobileNavOpen, setMobileNavOpen, newListOpen, setNewListOpen } = useShell();
  return (
    <div className="flex h-svh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:rounded-md focus:bg-panel focus:px-3 focus:py-1.5 focus:shadow-lg"
      >
        Skip to content
      </a>
      <Sidebar />
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-[272px] gap-0 border-line bg-side p-0 sm:max-w-[272px] lg:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Pages and lists</SheetDescription>
          <SidebarSheetBody onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-hidden outline-none">
        {children}
      </main>
      <CommandPalette />
      <NewListDialog open={newListOpen} onOpenChange={setNewListOpen} />
      <GlobalShortcuts />
    </div>
  );
}

/** Sidebar + main region + global dialogs and shortcuts. Pages render <Page> inside. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ShellProvider>
      <Frame>{children}</Frame>
    </ShellProvider>
  );
}
