export type ParsedMeta =
  | { kind: "object"; entries: [string, string][]; source: string | null }
  | { kind: "text"; text: string };

/**
 * Contact metadata is a free-form string the signup form sent. It is normally a JSON object
 * ({"source":"/pricing"}), but nothing enforces that, so anything else is shown verbatim.
 */
export function parseMetadata(raw: string): ParsedMeta {
  const text = (raw ?? "").trim();
  if (!text) return { kind: "object", entries: [], source: null };
  try {
    const v: unknown = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const entries = Object.entries(v as Record<string, unknown>).map<[string, string]>(([k, val]) => [
        k,
        typeof val === "string" ? val : JSON.stringify(val),
      ]);
      const src = (v as Record<string, unknown>).source;
      return { kind: "object", entries, source: typeof src === "string" && src ? src : null };
    }
  } catch {
    /* not JSON */
  }
  return { kind: "text", text: raw };
}

/** The `source` key of the metadata, or null. */
export function sourceOf(raw: string): string | null {
  const m = parseMetadata(raw);
  return m.kind === "object" ? m.source : null;
}

/** Pretty JSON for the "raw" view; non-JSON is returned untouched. */
export function prettyMetadata(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** Sources that look like URL paths render monospace. */
export const looksLikePath = (s: string) => s.startsWith("/");
