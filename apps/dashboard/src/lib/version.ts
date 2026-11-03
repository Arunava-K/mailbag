// Build identity, baked into the JS by Vite at image build time (see the
// Dockerfile and .github/workflows/docker.yml). A local `npm run dev` or
// `npm run build` without those env vars reports "dev".
const env = import.meta.env as Record<string, string | undefined>;

export interface BuildInfo {
  version: string;
  commit: string;
  build_time: string;
}

export const dashboardBuild: BuildInfo = {
  version: env.VITE_APP_VERSION || "dev",
  commit: env.VITE_APP_COMMIT || "none",
  build_time: env.VITE_APP_BUILD_TIME || "unknown",
};

/** First 7 chars of a commit SHA, or the placeholder as-is. */
export function shortCommit(commit: string): string {
  return commit === "none" || commit === "unknown" ? commit : commit.slice(0, 7);
}

/** "v0.1.0 · 7d53563", or "dev build" when nothing was injected at build time. */
export function buildLabel(info: BuildInfo | null): string {
  if (!info) return "not reported";
  if (info.commit === "none") return "dev build";
  return `v${info.version} · ${shortCommit(info.commit)}`;
}

/** True only when both builds carry real SHAs and they differ. */
export function buildsDiffer(a: BuildInfo | null, b: BuildInfo | null): boolean {
  if (!a || !b) return false;
  if (a.commit === "none" || b.commit === "none") return false;
  return a.commit.slice(0, 7) !== b.commit.slice(0, 7);
}

/** "2026-11-03T06:39:09Z" -> "2026-11-03 06:39 UTC" (falls back to the raw value). */
export function formatBuildTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
