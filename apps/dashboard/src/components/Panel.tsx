import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Bordered surface (10px radius). Wrap tables in it: `<Panel className="overflow-hidden">`. */
export function Panel({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-[10px] border border-line bg-panel", className)} {...rest} />;
}

/**
 * 40px panel header. `title` is semibold, `sub` is faint small text next to it,
 * `actions` (and children) sit on the right.
 */
export function PanelHeader({
  title,
  sub,
  actions,
  className,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header className={cn("flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1 border-b border-line-2 px-3.5 py-1", className)}>
      <h2 className="text-[13px] font-semibold">{title}</h2>
      {sub !== undefined && <span className="text-xs font-normal text-faint">{sub}</span>}
      <span className="flex-1" />
      {children}
      {actions}
    </header>
  );
}
