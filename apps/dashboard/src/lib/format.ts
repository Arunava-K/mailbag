/** Relative timestamps ("3 hours ago") with full-date fallback. */
export function relTime(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return iso;
  const mins = Math.max(1, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return iso.slice(0, 10);
}

/** Full local date-time for tooltips. */
export function fullTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}
