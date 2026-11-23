import { useSyncExternalStore } from "react";

/** Subscribe to a CSS media query, e.g. useMediaQuery("(min-width: 1024px)"). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True at the lg breakpoint (1024px) and up: sidebar is docked, drawers are inline. */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
