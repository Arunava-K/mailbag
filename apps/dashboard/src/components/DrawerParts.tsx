import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small faint section label inside a drawer ("Timeline", "Metadata"). */
export function DrawerSection({ children }: { children: ReactNode }) {
  return <h3 className="mt-1 text-[11.5px] font-medium text-faint">{children}</h3>;
}

/** Tinted notice box. tone="warn" for the "unconfirmed for 52 hours" style message. */
export function Callout({ icon, tone = "warn", children }: { icon?: ReactNode; tone?: "warn" | "info"; children: ReactNode }) {
  return (
    <div className={cn("flex gap-2.5 rounded-lg p-2.5 text-xs leading-relaxed", tone === "warn" ? "bg-warning-soft" : "bg-brand-soft")}>
      {icon && <span className={cn("mt-px shrink-0 [&_svg]:size-[15px]", tone === "warn" ? "text-warning" : "text-brand")}>{icon}</span>}
      <div>{children}</div>
    </div>
  );
}

/** Vertical timeline. Children are <TimelineEvent/>. */
export function Timeline({ children }: { children: ReactNode }) {
  return (
    <ol className="relative flex flex-col gap-3 pl-0.5 before:absolute before:top-2 before:bottom-5 before:left-[5.5px] before:w-px before:bg-line before:content-['']">
      {children}
    </ol>
  );
}

/** `hollow` marks a pending/future step. */
export function TimelineEvent({ title, detail, hollow }: { title: ReactNode; detail?: ReactNode; hollow?: boolean }) {
  return (
    <li className="relative flex gap-2.5">
      <span
        aria-hidden
        className={cn(
          "mt-[5px] shrink-0 rounded-full",
          hollow ? "size-[7px] border-[1.5px] border-warning bg-panel" : "size-2 bg-brand",
        )}
      />
      <div className="min-w-0">
        <div className={cn("font-medium", hollow && "text-muted-foreground")}>{title}</div>
        {detail && <p className="mt-px text-xs text-faint">{detail}</p>}
      </div>
    </li>
  );
}

/** Definition list: `<KeyValueList items={[["source","/pricing"]]} />`. Values render monospace. */
export function KeyValueList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="m-0 grid grid-cols-[100px_1fr] gap-x-2.5 gap-y-1.5 text-[12.5px]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="truncate text-muted-foreground">{k}</dt>
          <dd className="m-0 min-w-0 break-words font-mono text-[11.5px]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
