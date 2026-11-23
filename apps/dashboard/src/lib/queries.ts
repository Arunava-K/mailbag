import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, MutationCache, QueryCache, QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  ApiError,
  type ActivityEvent,
  type ActivityQuery,
  type BulkAction,
  type BulkContact,
  type ContactsQuery,
  type CreateListInput,
} from "./api";
import { UNAUTHORIZED_EVENT, useAuth } from "./auth";
import { buildsDiffer, dashboardBuild } from "./version";

/** Polling cadence for live data. Only runs while the tab is visible. */
export const POLL_MS = 30_000;

function onApiError(e: unknown) {
  if (e instanceof ApiError && e.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: onApiError }),
    mutationCache: new MutationCache({ onError: onApiError }),
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        retry: (n, e) => !(e instanceof ApiError && (e.status === 401 || e.status === 403 || e.status === 404)) && n < 1,
        refetchOnWindowFocus: true,
      },
    },
  });
}

const live = { refetchInterval: POLL_MS, refetchIntervalInBackground: false } as const;

export const qk = {
  lists: ["lists"] as const,
  stats: (days: number) => ["stats", days] as const,
  activity: (q: ActivityQuery) => ["activity", q] as const,
  contacts: (q: ContactsQuery) => ["contacts", q] as const,
  health: ["health"] as const,
  version: ["version"] as const,
};

export function useLists() {
  const { adminKey } = useAuth();
  return useQuery({ queryKey: qk.lists, queryFn: () => api.lists(adminKey), ...live });
}

export function useStats(days: number) {
  const { adminKey } = useAuth();
  return useQuery({
    queryKey: qk.stats(days),
    queryFn: () => api.stats(adminKey, days),
    placeholderData: keepPreviousData,
    ...live,
  });
}

export function useActivity(q: ActivityQuery = {}) {
  const { adminKey } = useAuth();
  return useQuery({ queryKey: qk.activity(q), queryFn: () => api.activity(adminKey, q), ...live });
}

/** Contacts (optionally across all lists). Pass enabled:false to skip. */
export function useContacts(q: ContactsQuery, opts: { enabled?: boolean } = {}) {
  const { adminKey } = useAuth();
  return useQuery({
    queryKey: qk.contacts(q),
    queryFn: () => api.contacts(adminKey, q),
    placeholderData: keepPreviousData,
    enabled: opts.enabled ?? true,
  });
}

export function useHealth() {
  return useQuery({ queryKey: qk.health, queryFn: () => api.health(), ...live });
}

export function useApiBuild() {
  return useQuery({ queryKey: qk.version, queryFn: () => api.version(), staleTime: 5 * 60_000, retry: false });
}

export type ApiStatus = "checking" | "online" | "degraded" | "offline";

/** green = online, amber = checking/degraded (health ok but admin calls failing), red = offline. */
export function useApiStatus(): ApiStatus {
  const health = useHealth();
  const lists = useLists();
  if (health.isPending) return "checking";
  if (health.data === false) return "offline";
  if (lists.isError) return "degraded";
  return "online";
}

/** API and dashboard builds differ (only one container got the new image). */
export function useBuildDrift() {
  const { data } = useApiBuild();
  return { apiBuild: data ?? null, dashboardBuild, drift: buildsDiffer(data ?? null, dashboardBuild) };
}

/* ---------- mutations: each invalidates what it can change ---------- */

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["lists"] }),
      qc.invalidateQueries({ queryKey: ["stats"] }),
      qc.invalidateQueries({ queryKey: ["contacts"] }),
      qc.invalidateQueries({ queryKey: ["activity"] }),
    ]);
}

export function useCreateList() {
  const { adminKey } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateListInput) => api.createList(adminKey, input),
    onSuccess: invalidate,
  });
}

export function useUpdateList() {
  const { adminKey } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { listKey: string; input: CreateListInput }) => api.updateList(adminKey, v.listKey, v.input),
    onSuccess: invalidate,
  });
}

export function useDeleteList() {
  const { adminKey } = useAuth();
  const invalidate = useInvalidate();
  // Don't await the refetch: the caller navigates away right after, and awaiting would flash a "not found" page.
  return useMutation({
    mutationFn: (listKey: string) => api.deleteList(adminKey, listKey),
    onSuccess: () => {
      void invalidate();
    },
  });
}

/** Public signup (same endpoint as the embed form), for "Test signup". Refreshes counts everywhere. */
export function useTestSignup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { listKey: string; email: string }) => api.subscribe(v.listKey, v.email, "dashboard-test"),
    onSuccess: invalidate,
  });
}

export function useBulkContacts() {
  const { adminKey } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { action: BulkAction; contacts: BulkContact[] }) => api.bulkContacts(adminKey, v.action, v.contacts),
    onSuccess: invalidate,
  });
}

type ContactRef = { listKey: string; email: string };

export function useConfirmContact() {
  const { adminKey } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (v: ContactRef) => api.confirmContact(adminKey, v.listKey, v.email), onSuccess: invalidate });
}

export function useResendContact() {
  const { adminKey } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (v: ContactRef) => api.resendContact(adminKey, v.listKey, v.email), onSuccess: invalidate });
}

export function useDeleteContact() {
  const { adminKey } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (v: ContactRef) => api.deleteContact(adminKey, v.listKey, v.email), onSuccess: invalidate });
}

/* ---------- activity feed with "load more" ---------- */

const FEED_PAGE = 50;
const eventKey = (e: ActivityEvent) => `${e.type}|${e.list_key}|${e.email}|${e.at}`;

/**
 * Activity events newest-first, paged with the API's opaque cursor.
 * The first page polls (POLL_MS, visible tab only). Every event ever fetched is kept, so a refresh
 * that shifts the first page's tail never leaves a gap before the "older" pages. Mount it with a
 * `key` per listKey so state resets when the filter changes.
 */
export function useActivityFeed(listKey?: string) {
  const { adminKey } = useAuth();
  const first = useActivity({ limit: FEED_PAGE, listKey });
  const [store, setStore] = useState<Map<string, ActivityEvent>>(new Map());
  const [paged, setPaged] = useState(false);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  useEffect(() => {
    const evs = first.data?.events;
    if (!evs) return;
    setStore((prev) => {
      const next = new Map(prev);
      for (const e of evs) next.set(eventKey(e), e);
      return next.size === prev.size ? prev : next;
    });
  }, [first.data]);

  const events = useMemo(
    () => [...store.values()].sort((a, b) => (a.at === b.at ? 0 : a.at < b.at ? 1 : -1)),
    [store],
  );
  const nextCursor = paged ? olderCursor : (first.data?.next_cursor ?? null);
  const hasMore = nextCursor !== null;

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const res = await api.activity(adminKey, { limit: FEED_PAGE, listKey, cursor: nextCursor });
      setStore((prev) => {
        const next = new Map(prev);
        for (const e of res.events) next.set(eventKey(e), e);
        return next;
      });
      setOlderCursor(res.next_cursor || null);
      setPaged(true);
    } catch (e) {
      setMoreError(e instanceof Error ? e.message : "request failed");
    } finally {
      setLoadingMore(false);
    }
  }, [adminKey, nextCursor, listKey]);

  return { events, hasMore, loadMore, loadingMore, moreError, first };
}
