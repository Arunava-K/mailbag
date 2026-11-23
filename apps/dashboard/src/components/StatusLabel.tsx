import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ContactStatus } from "@/lib/api";

export type StatusTone = "ok" | "warn" | "off";

const toneText: Record<StatusTone, string> = { ok: "text-success", warn: "text-warning", off: "text-off" };
const toneBg: Record<StatusTone, string> = { ok: "bg-success", warn: "bg-warning", off: "bg-off" };

export const statusTone: Record<ContactStatus, StatusTone> = { confirmed: "ok", pending: "warn", unsubscribed: "off" };
export const statusText: Record<ContactStatus, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  unsubscribed: "Unsubscribed",
};

/** 6px status dot. Decorative; pair with text. */
export function StatusDot({ tone, className }: { tone: StatusTone; className?: string }) {
  return <i aria-hidden className={cn("inline-block size-1.5 shrink-0 rounded-full", toneBg[tone], className)} />;
}

/** Dot + text for a contact status: confirmed = green, pending = amber, unsubscribed = grey. */
export function StatusLabel({
  status,
  children,
  className,
}: {
  status: ContactStatus;
  /** override the default text */
  children?: ReactNode;
  className?: string;
}) {
  const tone = statusTone[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", toneText[tone], className)}>
      <StatusDot tone={tone} />
      {children ?? statusText[status]}
    </span>
  );
}
