import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Native checkbox styled like the mockup (13px, accent when checked).
 * `onToggle(shiftKey)` receives the shift state so callers can range-select.
 */
export function RowCheckbox({
  checked,
  indeterminate,
  onToggle,
  label,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onToggle: (shiftKey: boolean) => void;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={() => {}}
      onClick={(e) => onToggle(e.shiftKey)}
      className={cn(
        "m-0 grid size-[13px] shrink-0 cursor-pointer appearance-none place-items-center rounded-[3.5px] border-[1.5px] border-faint/70 bg-transparent align-middle",
        "checked:border-brand checked:bg-brand indeterminate:border-brand indeterminate:bg-brand",
        "checked:after:block checked:after:h-[6px] checked:after:w-[3px] checked:after:-translate-y-px checked:after:rotate-45 checked:after:border-r-[1.5px] checked:after:border-b-[1.5px] checked:after:border-primary-foreground checked:after:content-['']",
        "indeterminate:after:block indeterminate:after:h-[1.5px] indeterminate:after:w-[7px] indeterminate:after:bg-primary-foreground indeterminate:after:content-['']",
        className,
      )}
    />
  );
}
