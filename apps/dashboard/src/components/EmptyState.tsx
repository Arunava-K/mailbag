import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Neutral empty/error state. `compact` for use inside small panels. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
  tone = "neutral",
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  tone?: "neutral" | "error";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-1.5 px-4 py-8" : "gap-2 px-6 py-14", className)}>
      {Icon && (
        <span
          aria-hidden
          className={cn("mb-1 grid size-9 place-items-center rounded-lg", tone === "error" ? "bg-danger-soft text-danger" : "bg-hover text-muted-foreground")}
        >
          <Icon className="size-[18px]" />
        </span>
      )}
      <p className="text-[13px] font-medium">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2 flex items-center gap-2">{action}</div>}
    </div>
  );
}
