import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Keyboard hint chip. Pass `onAccent` inside primary buttons. */
export function Kbd({ className, onAccent, ...rest }: HTMLAttributes<HTMLElement> & { onAccent?: boolean }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center rounded-[4px] px-[5px] py-px font-sans text-[10.5px] leading-[1.4] font-medium",
        onAccent ? "bg-white/20 text-primary-foreground" : "bg-kbd text-muted-foreground",
        className,
      )}
      {...rest}
    />
  );
}

export const isMac = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
export const modKey = isMac ? "⌘" : "Ctrl";
export const modK = isMac ? "⌘K" : "Ctrl K";
