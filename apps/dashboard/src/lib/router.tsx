import { forwardRef, useCallback, useMemo, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";

/**
 * Minimal history router (no dependency).
 *  - usePath()          current pathname
 *  - useSearchParams()  [URLSearchParams, setParams(patch, {replace})]
 *  - navigate(to)       push/replace a URL ("/contacts?list=pk_x")
 *  - <Link to>          real <a href>; modifier/middle clicks fall through to the browser
 *  - useIsActive(to)    whether the current path is `to` (or beneath it)
 */

const EVENT = "mb:navigate";

/** Return false to cancel. For "pop" (back/forward) the URL has already changed, so a blocker that cancels must restore it. */
type Blocker = (to: string, kind: "push" | "pop") => boolean;
let blocker: Blocker | null = null;

function subscribe(cb: () => void): () => void {
  // Back/forward: let the blocker veto (it restores the URL itself) before subscribers re-read it.
  const onPop = () => {
    if (blocker && !blocker(window.location.pathname + window.location.search, "pop")) return;
    cb();
  };
  window.addEventListener("popstate", onPop);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("popstate", onPop);
    window.removeEventListener(EVENT, cb);
  };
}



/** Install a navigation guard. It is asked before every in-app navigate() and on back/forward. Returns an uninstall fn. */
export function setNavigationBlocker(b: Blocker): () => void {
  blocker = b;
  return () => {
    if (blocker === b) blocker = null;
  };
}

export function navigate(to: string, opts: { replace?: boolean; force?: boolean } = {}): void {
  if (blocker && !opts.force && !blocker(to, "push")) return;
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (to !== current) {
    if (opts.replace) window.history.replaceState(null, "", to);
    else window.history.pushState(null, "", to);
  }
  window.dispatchEvent(new Event(EVENT));
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

export function useSearch(): string {
  return useSyncExternalStore(subscribe, () => window.location.search);
}

export type ParamsPatch = Record<string, string | number | null | undefined>;

export function useSearchParams(): [URLSearchParams, (patch: ParamsPatch, opts?: { replace?: boolean }) => void] {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const setParams = useCallback((patch: ParamsPatch, opts: { replace?: boolean } = {}) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    const qs = next.toString();
    navigate(window.location.pathname + (qs ? `?${qs}` : ""), { replace: opts.replace ?? true });
  }, []);
  return [params, setParams];
}

/** Build "/path?a=1&b=2", skipping empty values. */
export function withQuery(path: string, query: ParamsPatch): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
  const qs = p.toString();
  return qs ? `${path}?${qs}` : path;
}

export function useIsActive(to: string, exact = false): boolean {
  const path = usePath();
  const base = to.split("?")[0];
  if (exact || base === "/") return path === base;
  return path === base || path.startsWith(`${base}/`);
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  replace?: boolean;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ to, replace, onClick, target, ...rest }, ref) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
    if (e.button !== 0 || modified || (target && target !== "_self") || rest.download !== undefined) return;
    e.preventDefault();
    navigate(to, { replace });
  };
  return <a ref={ref} href={to} target={target} onClick={handle} {...rest} />;
});
