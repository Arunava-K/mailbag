import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Native <select> styled to match inputs (keeps full a11y and mobile pickers). */
export const selectClass =
  "h-8 w-full rounded-md border border-input bg-panel px-2.5 text-[13px] text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50";

/** Label + control + hint/error. `id` must match the control's id. */
export function Field({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-xs font-medium">
        {label}
        {optional && <span className="font-normal text-faint">optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-faint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
