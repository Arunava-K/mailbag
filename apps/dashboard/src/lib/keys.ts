/** True when the keyboard event comes from a field the user is typing into. */
export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT";
}

/** A modal dialog (Radix) is currently open. */
export function dialogOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}

export const hasMod = (e: KeyboardEvent) => e.metaKey || e.ctrlKey;
