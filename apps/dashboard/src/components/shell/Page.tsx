import { useEffect, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import { IconBtn } from "../Btn";
import { useShell } from "./ShellContext";

export interface Crumb {
  label: string;
  /** omit for the current page (last crumb) */
  to?: string;
}

/**
 * The 46px top bar: breadcrumb on the left, page actions on the right, hamburger below 1024px.
 * Prefer <Page>, which renders this for you.
 */
export function PageHeader({ crumbs, actions }: { crumbs: Crumb[]; actions?: ReactNode }) {
  const { setMobileNavOpen } = useShell();
  return (
    <header className="flex h-[46px] shrink-0 items-center gap-2.5 border-b border-line px-3 sm:px-5">
      <IconBtn label="Open navigation" onClick={() => setMobileNavOpen(true)} className="-ml-1 lg:hidden">
        <Menu />
      </IconBtn>
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex items-center gap-1.5 font-medium">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={`${c.label}-${i}`} className={cn("flex min-w-0 items-center gap-1.5", !last && "max-sm:hidden")}>
                {c.to && !last ? (
                  <Link to={c.to} className="rounded text-muted-foreground hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className="truncate">
                    {c.label}
                  </span>
                )}
                {!last && (
                  <span aria-hidden className="text-faint">
                    /
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="flex-1" />
      {actions && <div className="flex min-w-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/**
 * Page frame used by every route.
 *  - crumbs / actions: fill the top bar
 *  - bare: no padding, body is a non-scrolling flex column (for pages that manage their own
 *    scroll regions, e.g. list detail with a table + drawer). Default: padded, scrolling body.
 */
export function Page({
  crumbs,
  actions,
  bare,
  children,
}: {
  crumbs: Crumb[];
  actions?: ReactNode;
  bare?: boolean;
  children: ReactNode;
}) {
  const title = crumbs[crumbs.length - 1]?.label;
  useEffect(() => {
    document.title = title ? `${title} · Mailbag` : "Mailbag";
  }, [title]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader crumbs={crumbs} actions={actions} />
      {bare ? (
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-5">{children}</div>
      )}
    </div>
  );
}
