import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Btn } from "./Btn";

/**
 * Confirmation for destructive or bulk actions.
 * `onConfirm` may return a promise; the dialog shows a busy state and closes on success.
 * If it throws, the dialog stays open (surface the error with a toast in the caller).
 * Focus starts on Cancel.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  confirmDisabled,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  /** keep the confirm button disabled (e.g. until a name is typed) */
  confirmDisabled?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      /* caller reports the error; keep the dialog open */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent showCloseButton={false} className="gap-4 bg-panel p-5 sm:max-w-md">
        <div className="space-y-1.5">
          <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
          {description && <DialogDescription className="text-[13px] text-muted-foreground">{description}</DialogDescription>}
        </div>
        {children}
        <div className="flex justify-end gap-2">
          <Btn onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Btn>
          <Btn
            variant={destructive ? "default" : "primary"}
            className={destructive ? "border-transparent bg-danger text-primary-foreground hover:brightness-110" : undefined}
            onClick={run}
            disabled={busy || confirmDisabled}
          >
            {busy ? "Working…" : confirmLabel}
          </Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}
