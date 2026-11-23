import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { dialogOpen, isTyping } from "@/lib/keys";
import { Kbd } from "../Kbd";

export interface BulkAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Floating action bar for selected rows. Render inside a `relative` container (the table area);
 * it pins to the bottom centre. Hidden when count is 0. Esc calls onClear.
 */
export function BulkBar({ count, actions, onClear }: { count: number; actions: BulkAction[]; onClear: () => void }) {
  useEffect(() => {
    if (count === 0) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isTyping(e) && !dialogOpen()) onClear();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [count, onClear]);

  if (count === 0) return null;
  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="absolute bottom-[18px] left-1/2 z-20 flex h-[38px] max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-[10px] bg-bulk pr-1.5 pl-3.5 text-bulk-foreground shadow-[0_8px_30px_rgb(0_0_0/0.35),0_0_0_1px_rgb(255_255_255/0.08)] animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <b role="status" className="font-medium whitespace-nowrap">
        {count} selected
      </b>
      <span aria-hidden className="mx-1.5 h-[18px] w-px bg-white/15" />
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={a.onClick}
          disabled={a.disabled}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 font-medium whitespace-nowrap hover:bg-white/10 disabled:opacity-50 [&_svg]:size-[15px]",
            a.danger ? "text-bulk-danger" : "text-bulk-foreground",
          )}
        >
          {a.icon}
          {a.label}
        </button>
      ))}
      <span aria-hidden className="mx-1.5 h-[18px] w-px bg-white/15" />
      <button type="button" onClick={onClear} aria-label="Clear selection" className="rounded-md px-1 py-1 hover:bg-white/10">
        <Kbd className="bg-white/10 text-bulk-foreground/70">esc</Kbd>
      </button>
    </div>
  );
}
