import type { ReactNode } from "react";
import { Link, useIsActive } from "@/lib/router";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Tooltip around a single child (used by the collapsed rail and icon buttons). */
export function Tip({
  label,
  keys,
  side = "right",
  children,
}: {
  label: string;
  keys?: string;
  side?: "right" | "top" | "bottom";
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={8} className="flex items-center gap-2">
        {label}
        {keys && <span className="text-[10.5px] opacity-70">{keys}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

const itemBase =
  "group/item relative flex h-[30px] items-center gap-[9px] rounded-md px-2 font-medium text-muted-foreground transition-colors hover:bg-hover hover:text-foreground";
const itemOn = "bg-panel text-foreground shadow-[0_0_0_1px_var(--line),0_1px_2px_rgb(0_0_0/0.04)] hover:bg-panel";

/** Expanded sidebar row. `hint` (e.g. "G C") appears on hover/focus. `right` renders trailing content. */
export function NavItem({
  to,
  icon,
  label,
  hint,
  right,
  exact,
  onNavigate,
  className,
  muted,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  hint?: string;
  right?: ReactNode;
  exact?: boolean;
  onNavigate?: () => void;
  className?: string;
  muted?: boolean;
}) {
  const active = useIsActive(to, exact);
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(itemBase, active && itemOn, muted && !active && "font-normal text-faint", className)}
    >
      <span className="grid shrink-0 place-items-center [&_svg]:size-[15px]">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        {hint && (
          <span aria-hidden className="text-[10.5px] font-normal text-faint opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-visible/item:opacity-100 max-lg:hidden">
            {hint}
          </span>
        )}
        {right}
      </span>
    </Link>
  );
}

/** Collapsed-rail icon link with tooltip. `dot` shows a small amber attention dot. */
export function RailLink({
  to,
  label,
  keys,
  dot,
  exact,
  children,
}: {
  to: string;
  label: string;
  keys?: string;
  dot?: boolean;
  exact?: boolean;
  children: ReactNode;
}) {
  const active = useIsActive(to, exact);
  return (
    <Tip label={label} keys={keys}>
      <Link
        to={to}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative grid size-[34px] place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground [&_svg]:size-[15px]",
          active && itemOn,
        )}
      >
        {children}
        {dot && <span aria-hidden className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-warning" />}
      </Link>
    </Tip>
  );
}

export function PendingBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-warning-soft px-[5px] text-[11px] font-semibold text-warning tabular"
      aria-label={`${n} pending`}
    >
      {n > 999 ? "999+" : n}
    </span>
  );
}

