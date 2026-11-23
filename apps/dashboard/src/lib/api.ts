import type { BuildInfo } from "./version";

// Types and calls follow the API contract (mailbag/API_CONTRACT.md).

export type ListType = "newsletter" | "waitlist";
export type Provider = "smtp" | "plunk";
export type ContactStatus = "confirmed" | "pending" | "unsubscribed";

export interface MailList {
  list_key: string;
  name: string;
  type: ListType;
  sender_name: string;
  sender_email: string;
  provider: Provider;
  welcome_subject: string;
  welcome_body: string;
  confirm_redirect: string;
  confirmed: number;
  pending: number;
  unsubscribed: number;
  created_at: string;
  /** pending contacts older than 48h */
  stale_pending: number;
}

export interface Contact {
  email: string;
  status: ContactStatus;
  position: number;
  metadata: string;
  confirmed_at: string | null;
  created_at: string;
  list_key: string;
  list_name: string;
  unsubscribed_at: string | null;
}

export interface DayCount {
  day: string;
  count: number;
}

export interface SeriesDay {
  day: string;
  confirmed: number;
  pending: number;
  unsubscribed: number;
}

export interface PeriodTotals {
  signups: number;
  confirmed: number;
  unsubscribed: number;
}

export interface Stats {
  lists: number;
  confirmed: number;
  pending: number;
  by_day: DayCount[];
  unsubscribed: number;
  stale_pending: number;
  days: number;
  series: SeriesDay[];
  period: PeriodTotals;
  prev_period: PeriodTotals;
  /** per list_key, aligned with `series` days: signups on that day that are currently confirmed */
  list_series: Record<string, number[]>;
}

export const STATS_RANGES = [7, 30, 90] as const;
export type StatsRange = (typeof STATS_RANGES)[number];

export type ActivityType = "signup" | "confirmed" | "unsubscribed";

export interface ActivityEvent {
  type: ActivityType;
  email: string;
  list_key: string;
  list_name: string;
  at: string;
}

export type BulkAction = "confirm" | "resend" | "delete";

export interface BulkContact {
  list_key: string;
  email: string;
}

export interface BulkResult {
  ok: number;
  failed: { list_key: string; email: string; error: string }[];
}

export interface CreateListInput {
  name: string;
  type: ListType;
  sender_name: string;
  sender_email: string;
  provider: Provider;
  welcome_subject: string;
  welcome_body: string;
  confirm_redirect: string;
}

export const emptyListInput: CreateListInput = {
  name: "",
  type: "newsletter",
  sender_name: "",
  sender_email: "",
  provider: "smtp",
  welcome_subject: "",
  welcome_body: "",
  confirm_redirect: "",
};

export const apiBase = () =>
  (import.meta.env.VITE_MAILBAG_URL as string | undefined)?.replace(/\/$/, "") || "/api";

/** Public origin of the collector API (used in embed snippets and the login screen). */
export function collectorUrl(): string {
  const v = (import.meta.env.VITE_MAILBAG_URL as string | undefined) || "/api";
  return v.replace(/\/api$/, "") || window.location.origin;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function req<T>(path: string, key: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { error?: string }).error || `request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export interface ContactsQuery {
  /** omit to search across all lists */
  listKey?: string;
  status?: ContactStatus;
  q?: string;
  /** only pending contacts older than N hours */
  pendingOlderThan?: number;
  limit?: number;
  offset?: number;
}

export interface ActivityQuery {
  limit?: number;
  listKey?: string;
  /** Opaque tie-safe cursor returned as next_cursor by the previous page. */
  cursor?: string;
}

const enc = encodeURIComponent;

/** The full settings object for a list. PATCH /admin/lists overwrites every field, so edits must start from this. */
export function listToInput(l: MailList): CreateListInput {
  return {
    name: l.name,
    type: l.type,
    sender_name: l.sender_name,
    sender_email: l.sender_email,
    provider: l.provider,
    welcome_subject: l.welcome_subject,
    welcome_body: l.welcome_body,
    confirm_redirect: l.confirm_redirect,
  };
}

export const api = {
  lists: (key: string) => req<MailList[]>("/admin/lists", key),
  stats: (key: string, days: number = 14) => req<Stats>(`/admin/stats?days=${days}`, key),
  activity: (key: string, q: ActivityQuery = {}) => {
    const p = new URLSearchParams({ limit: String(q.limit ?? 50) });
    if (q.listKey) p.set("list_key", q.listKey);
    if (q.cursor) p.set("cursor", q.cursor);
    return req<{ events: ActivityEvent[]; next_cursor: string }>(`/admin/activity?${p}`, key);
  },
  createList: (key: string, input: CreateListInput) =>
    req<{ list_key: string; name: string }>("/admin/lists", key, { method: "POST", body: JSON.stringify(input) }),
  updateList: (key: string, listKey: string, input: CreateListInput) =>
    req<{ status: string }>(`/admin/lists?list_key=${enc(listKey)}`, key, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteList: (key: string, listKey: string) =>
    req<{ status: string }>(`/admin/lists?list_key=${enc(listKey)}`, key, { method: "DELETE" }),
  contacts: (key: string, q: ContactsQuery = {}) => {
    const p = new URLSearchParams({ limit: String(q.limit ?? 50), offset: String(q.offset ?? 0) });
    if (q.listKey) p.set("list_key", q.listKey);
    if (q.status) p.set("status", q.status);
    if (q.q) p.set("q", q.q);
    if (q.pendingOlderThan) p.set("pending_older_than", String(q.pendingOlderThan));
    return req<{ total: number; contacts: Contact[] }>(`/admin/contacts?${p}`, key);
  },
  bulkContacts: (key: string, action: BulkAction, contacts: BulkContact[]) =>
    req<BulkResult>("/admin/contacts/bulk", key, { method: "POST", body: JSON.stringify({ action, contacts }) }),
  confirmContact: (key: string, listKey: string, email: string) =>
    req<{ status: string }>("/admin/contacts/confirm", key, {
      method: "POST",
      body: JSON.stringify({ list_key: listKey, email }),
    }),
  resendContact: (key: string, listKey: string, email: string) =>
    req<{ status: string }>("/admin/contacts/resend", key, {
      method: "POST",
      body: JSON.stringify({ list_key: listKey, email }),
    }),
  deleteContact: (key: string, listKey: string, email: string) =>
    req<{ status: string }>(`/admin/contacts?list_key=${enc(listKey)}&email=${enc(email)}`, key, {
      method: "DELETE",
    }),
  exportCsv: async (key: string, listKey: string): Promise<Blob> => {
    const res = await fetch(`${apiBase()}/admin/export?list_key=${enc(listKey)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new ApiError(res.status, `export failed (${res.status})`);
    return await res.blob();
  },
  /** Public endpoint (no auth), same one the embed form posts to. */
  subscribe: async (listKey: string, email: string, source: string): Promise<{ status: string }> => {
    const res = await fetch(`${collectorUrl()}/v1/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list_key: listKey, email, metadata: JSON.stringify({ source }) }),
    });
    const body = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
    if (!res.ok) throw new ApiError(res.status, body.error || `request failed (${res.status})`);
    return { status: body.status ?? "ok" };
  },
  health: async (): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase()}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },
  version: async (): Promise<BuildInfo> => {
    const res = await fetch(`${apiBase()}/version`);
    if (!res.ok) throw new ApiError(res.status, `version failed (${res.status})`);
    return (await res.json()) as BuildInfo;
  },
};

export function embedSnippet(collectorUrl: string, listKey: string): string {
  return `<form id="mb-form">
  <input type="email" name="email" required placeholder="you@example.com" />
  <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off" />
  <button type="submit">Subscribe</button>
  <p id="mb-msg"></p>
</form>
<script>
  (function () {
    var form = document.getElementById("mb-form");
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var res = await fetch("${collectorUrl}/v1/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          list_key: "${listKey}",
          email: fd.get("email"),
          website: fd.get("website"),
          metadata: JSON.stringify({ source: location.pathname })
        })
      });
      var data = await res.json();
      document.getElementById("mb-msg").textContent =
        data.status === "pending" ? "Check your inbox to confirm." :
        data.status === "confirmed" ? "You're already subscribed." :
        (data.error || "Something went wrong.");
    });
  })();
<\/script>`;
}
