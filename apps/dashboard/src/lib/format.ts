const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** API timestamps are "YYYY-MM-DD HH:MM:SS" in UTC. Parse them as UTC. */
export function parseTs(iso: string | null): Date | null {
  if (!iso) return null;
  const hasZone = /[zZ]|[+-]\d\d:?\d\d$/.test(iso);
  const d = new Date(hasZone ? iso : `${iso.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2m", "5h", "3d", "2w", then "Oct 12". Compact, for feeds. */
export function agoShort(iso: string | null, now = Date.now()): string {
  const d = parseTs(iso);
  if (!d) return "—";
  const s = Math.max(0, (now - d.getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 14) return `${Math.floor(s / 86400)}d`;
  if (s < 86400 * 60) return `${Math.floor(s / (86400 * 7))}w`;
  return shortDate(d);
}

/** "2m ago", "3d ago", "Oct 12". For tables. */
export function relTime(iso: string | null, now = Date.now()): string {
  const d = parseTs(iso);
  if (!d) return "—";
  const a = agoShort(iso, now);
  if (a === "now") return "just now";
  return /^\d+[mhdw]$/.test(a) ? `${a} ago` : a;
}

/** Full local date-time for tooltips. */
export function fullTime(iso: string | null): string {
  const d = parseTs(iso);
  return d ? d.toLocaleString() : "—";
}

export function shortDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "2026-10-25" -> "Oct 25" (calendar day, no timezone shifts). */
export function shortDay(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return m && d ? `${MONTHS[m - 1]} ${d}` : day;
}

const nf = new Intl.NumberFormat("en-US");
export const fmtNum = (n: number): string => nf.format(n);

/** 0.874 -> "87.4%" */
export function fmtPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/** Hours since a timestamp, or null. */
export function hoursSince(iso: string | null, now = Date.now()): number | null {
  const d = parseTs(iso);
  return d ? Math.floor((now - d.getTime()) / 3600000) : null;
}

/** Elapsed time between two instants, compact: "<1m", "35m", "2h 10m", "52h", "3d 4h". */
export function fmtDuration(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

/** Local "14:32". */
export function fmtClock(iso: string | null): string {
  const d = parseTs(iso);
  return d ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "—";
}

/** Local calendar-day key ("2026-11-21") for grouping. */
export function dayKey(iso: string): string {
  const d = parseTs(iso);
  if (!d) return "unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Today", "Yesterday", "Fri, Nov 21" for a dayKey. */
export function dayHeading(key: string, now = new Date()): string {
  if (key === dayKey(now.toISOString())) return "Today";
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (key === dayKey(y.toISOString())) return "Yesterday";
  const [yy, m, d] = key.split("-").map(Number);
  if (!yy || !m || !d) return key;
  const date = new Date(yy, m - 1, d);
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[m - 1]} ${d}${yy !== now.getFullYear() ? `, ${yy}` : ""}`;
}
