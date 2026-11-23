/**
 * The open contact lives in the URL as `?contact=`.
 *  - inside a list (/lists/:key/contacts):  contact=<email>
 *  - on the global page (/contacts):        contact=<list_key>:<email>   (list keys never contain ":")
 */
export interface ContactRef {
  listKey: string;
  email: string;
}

export function parseContactParam(value: string | null, scopeKey?: string): ContactRef | null {
  if (!value) return null;
  if (scopeKey) return { listKey: scopeKey, email: value };
  const i = value.indexOf(":");
  if (i <= 0 || i === value.length - 1) return null;
  return { listKey: value.slice(0, i), email: value.slice(i + 1) };
}

export function contactParam(ref: ContactRef, scopeKey?: string): string {
  return scopeKey ? ref.email : `${ref.listKey}:${ref.email}`;
}

export const contactId = (c: ContactRef) => `${c.listKey}:${c.email}`;
