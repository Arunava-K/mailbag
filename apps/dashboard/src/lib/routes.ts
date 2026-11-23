import { withQuery } from "./router";

export const LIST_TABS = ["contacts", "activity", "embed", "email", "settings"] as const;
export type ListTab = (typeof LIST_TABS)[number];

export type Route =
  | { name: "overview" }
  | { name: "contacts" }
  | { name: "activity" }
  | { name: "lists" }
  | { name: "list"; key: string; tab: ListTab }
  | { name: "settings" }
  | { name: "notfound" };

const isTab = (s: string): s is ListTab => (LIST_TABS as readonly string[]).includes(s);

/** Map a pathname to a route. Trailing slashes are ignored. */
export function matchRoute(pathname: string): Route {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [a, b, c] = parts;
  if (parts.length === 0) return { name: "overview" };
  if (parts.length === 1) {
    if (a === "contacts" || a === "activity" || a === "lists" || a === "settings") return { name: a };
  }
  if (a === "lists" && b && parts.length === 2) return { name: "list", key: b, tab: "contacts" };
  if (a === "lists" && b && c && parts.length === 3 && isTab(c)) return { name: "list", key: b, tab: c };
  return { name: "notfound" };
}

/** Path builders. Use these instead of string literals. */
export const paths = {
  overview: () => "/",
  contacts: (q: { list?: string; status?: string; q?: string; stale?: boolean } = {}) =>
    withQuery("/contacts", { list: q.list, status: q.status, q: q.q, stale: q.stale ? "1" : undefined }),
  /** A contact's drawer, in its list's contacts tab. */
  contact: (listKey: string, email: string) => withQuery(`/lists/${encodeURIComponent(listKey)}`, { contact: email }),
  activity: () => "/activity",
  lists: () => "/lists",
  list: (key: string, tab: ListTab = "contacts") =>
    `/lists/${encodeURIComponent(key)}${tab === "contacts" ? "" : `/${tab}`}`,
  settings: () => "/settings",
};
