import type { BulkAction, BulkResult } from "@/lib/api";

const done: Record<BulkAction, string> = { confirm: "confirmed", resend: "resent", delete: "deleted" };

/**
 * "18 resent · 2 already confirmed". Failures are grouped by the API's error text.
 * `kind` is "err" only when nothing succeeded.
 */
export function summarizeBulk(action: BulkAction, r: BulkResult): { msg: string; kind: "ok" | "err" } {
  const parts: string[] = [];
  if (r.ok > 0) parts.push(`${r.ok} ${done[action]}`);
  const byError = new Map<string, number>();
  for (const f of r.failed) byError.set(f.error, (byError.get(f.error) ?? 0) + 1);
  for (const [err, n] of byError) parts.push(`${n} ${err}`);
  if (parts.length === 0) parts.push("Nothing to do");
  return { msg: parts.join(" · "), kind: r.ok === 0 && r.failed.length > 0 ? "err" : "ok" };
}
