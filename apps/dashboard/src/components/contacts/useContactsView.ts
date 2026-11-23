import { useCallback, useMemo } from "react";
import type { ContactsQuery, ContactStatus } from "@/lib/api";
import { contactParam, parseContactParam, type ContactRef } from "@/lib/contactRef";
import { useSearchParams } from "@/lib/router";

export const PAGE_SIZE = 50;
/** "Stale pending" = pending for more than this many hours (matches the API's stale_pending). */
export const STALE_HOURS = 48;

export type StatusFilter = "all" | ContactStatus;

const parseStatus = (v: string | null): StatusFilter => (v === "confirmed" || v === "pending" || v === "unsubscribed" ? v : "all");

/**
 * Contacts view state, kept entirely in the URL query so refresh and back/forward work:
 *   status=confirmed|pending|unsubscribed   q=<email search>   stale=1   list=<key> (global page only)
 *   page=<n>   contact=<open contact, see lib/contactRef>
 * `scopeKey` pins the list (List detail); otherwise `list` comes from the URL.
 * Filter/page/contact changes push history entries; typing in search replaces.
 */
export function useContactsView(scopeKey?: string) {
  const [params, setParams] = useSearchParams();
  const listKey = scopeKey ?? (params.get("list") || undefined);
  const stale = params.get("stale") === "1";
  const status: StatusFilter = stale ? "pending" : parseStatus(params.get("status"));
  const q = params.get("q") ?? "";
  const page = Math.max(1, Math.floor(Number(params.get("page"))) || 1);
  const contact = parseContactParam(params.get("contact"), scopeKey);
  const contactEmail = contact?.email;
  const contactList = contact?.listKey;

  const query = useMemo<ContactsQuery>(
    () => ({
      listKey,
      status: status === "all" ? undefined : status,
      q: q.trim() || undefined,
      pendingOlderThan: stale ? STALE_HOURS : undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    [listKey, status, q, stale, page],
  );

  const push = useCallback((patch: Parameters<typeof setParams>[0]) => setParams(patch, { replace: false }), [setParams]);

  return {
    listKey,
    status,
    stale,
    q,
    page,
    contact: useMemo<ContactRef | null>(
      () => (contactEmail && contactList ? { email: contactEmail.toLowerCase(), listKey: contactList } : null),
      [contactEmail, contactList],
    ),
    query,
    hasFilters: status !== "all" || q.trim() !== "" || stale || (!scopeKey && !!listKey),
    setStatus: (s: StatusFilter) => push({ status: s === "all" ? null : s, stale: null, page: null, contact: null }),
    setStale: (on: boolean) => push({ stale: on ? "1" : null, status: null, page: null, contact: null }),
    setList: (k: string) => push({ list: k || null, page: null, contact: null }),
    setQ: (v: string) => setParams({ q: v.trim() ? v : null, page: null }, { replace: true }),
    setPage: (n: number) => push({ page: n > 1 ? n : null, contact: null }),
    setContact: useCallback(
      (ref: ContactRef | null, replace = false) =>
        setParams({ contact: ref ? contactParam(ref, scopeKey) : null }, { replace }),
      [setParams, scopeKey],
    ),
    clearFilters: () => push({ status: null, stale: null, q: null, page: null, contact: null, ...(scopeKey ? {} : { list: null }) }),
  };
}
