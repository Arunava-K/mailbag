import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { IconBtn } from "./Btn";
import { isTyping } from "@/lib/keys";

/**
 * Right-side detail panel (detail.html).
 *  - >= 1024px: an inline <aside> docked at the end of a flex row. Put it as a sibling
 *    of the table area: `<div className="flex min-h-0 flex-1"><div className="min-w-0 flex-1">…</div><Drawer …/></div>`.
 *  - < 1024px: a full-screen sheet.
 * Props: open, onClose, title (e.g. the email), meta (status row under the title),
 * label (accessible name), footer (pinned actions), children (scrolling body; compose
 * with DrawerSection / Timeline / KeyValueList / Callout from DrawerParts).
 * Esc closes it (when not typing in a field).
 */
export function Drawer({
  open,
  onClose,
  onEscape,
  title,
  meta,
  label,
  footer,
  width = 340,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Esc on desktop (defaults to onClose); lets the page consume Esc for something else first, like a selection */
  onEscape?: () => void;
  title: ReactNode;
  meta?: ReactNode;
  label: string;
  footer?: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  const desktop = useIsDesktop();
  const returnFocus = useRef<HTMLElement | null>(typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null));

  useEffect(() => {
    if (!open || !desktop) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isTyping(e) && !document.querySelector('[role="dialog"]')) (onEscape ?? onClose)();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, desktop, onClose, onEscape]);

  if (!open) return null;

  const header = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        {meta && <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">{meta}</div>}
      </div>
      {desktop && (
        <IconBtn label="Close details" onClick={onClose} className="-mt-0.5 border border-line">
          <X />
        </IconBtn>
      )}
    </div>
  );
  const body = (
    <>
      <div className="flex flex-col gap-3 overflow-y-auto p-4">{children}</div>
      {footer && <div className="mt-auto flex flex-col gap-2 border-t border-line-2 p-4">{footer}</div>}
    </>
  );

  if (desktop) {
    return (
      <aside aria-label={label} style={{ width }} className="flex shrink-0 flex-col border-l border-line bg-panel">
        <div className="border-b border-line-2 p-4 pb-3">{header}</div>
        {body}
      </aside>
    );
  }
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 bg-panel p-0 sm:max-w-none"
        aria-describedby={undefined}
        onCloseAutoFocus={(e) => {
          if (returnFocus.current?.isConnected) {
            e.preventDefault();
            returnFocus.current.focus();
          }
        }}
      >
        <SheetTitle className="sr-only">{label}</SheetTitle>
        <SheetDescription className="sr-only">{label}</SheetDescription>
        <div className={cn("border-b border-line-2 p-4 pr-12")}>{header}</div>
        {body}
      </SheetContent>
    </Sheet>
  );
}
