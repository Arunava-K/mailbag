import { cn } from "@/lib/utils";
import type { ListType } from "@/lib/api";

/** Rounded-square list-type marker: newsletter = accent, waitlist = amber-orange. */
export function TypeDot({ type, className }: { type: ListType; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-[2.5px]", type === "waitlist" ? "bg-waitlist" : "bg-brand", className)}
    />
  );
}

export const typeLabel: Record<ListType, string> = { newsletter: "Newsletter", waitlist: "Waitlist" };
