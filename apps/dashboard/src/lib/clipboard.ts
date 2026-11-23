import { useCallback } from "react";
import { useToast } from "./toast";

/** Copy text to the clipboard; falls back to a hidden textarea on non-secure origins. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** `const copy = useCopy(); copy(key, "List key")` toasts the result. */
export function useCopy() {
  const toast = useToast();
  return useCallback(
    async (text: string, what: string) => {
      const ok = await copyText(text);
      toast(ok ? `${what} copied` : `Couldn't copy ${what.toLowerCase()}`, ok ? "ok" : "err");
    },
    [toast],
  );
}
