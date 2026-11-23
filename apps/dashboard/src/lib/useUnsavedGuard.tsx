import { useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { navigate, setNavigationBlocker } from "./router";

const pathOf = (url: string) => new URL(url, window.location.origin).pathname;

/**
 * Guards unsaved edits. While `dirty`:
 *  - closing/reloading the tab shows the browser's native prompt,
 *  - in-app navigation to another path (links, sidebar, ⌘K, tab switches) and back/forward
 *    open a "Discard changes?" dialog instead of leaving.
 * Query-string-only changes (filters) are not blocked. Render the returned node once.
 */
export function useUnsavedGuard(dirty: boolean): ReactNode {
  const [pending, setPending] = useState<string | null>(null);
  const here = useRef({ path: window.location.pathname, href: "" });

  useEffect(() => {
    if (!dirty) return;
    here.current = { path: window.location.pathname, href: window.location.pathname + window.location.search };

    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    const unblock = setNavigationBlocker((to, kind) => {
      if (pathOf(to) === here.current.path) return true;
      if (kind === "pop") window.history.pushState(null, "", here.current.href); // undo the step, then ask
      setPending(to);
      return false;
    });
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      unblock();
    };
  }, [dirty]);

  return (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(o) => !o && setPending(null)}
      title="Discard unsaved changes?"
      description="You have edits that haven't been saved. If you leave now they will be lost."
      confirmLabel="Discard and leave"
      destructive
      onConfirm={() => {
        const to = pending;
        setPending(null);
        if (to) navigate(to, { force: true });
      }}
    />
  );
}
