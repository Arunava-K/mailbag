import { useCallback, useEffect, useState } from "react";
import { dialogOpen, hasMod, isTyping } from "@/lib/keys";

/**
 * Keyboard cursor over table rows: ↑/↓ (or K/J) move, Home/End jump, Enter opens,
 * X toggles the row's checkbox. Works from anywhere on the page while no field has focus
 * and no dialog is open. Rows get `data-row-index` so the active one is scrolled into view.
 *
 *   const nav = useRowNav({ count: rows.length, onOpen: (i) => open(rows[i]), onToggle: (i) => sel.toggle(id(rows[i])) });
 *   <Tr active={nav.active === i} data-row-index={i} …/>
 * `onCursor` may be used to react to cursor moves (e.g. keep a drawer in sync).
 */
export function useRowNav({
  count,
  onOpen,
  onToggle,
  enabled = true,
}: {
  count: number;
  onOpen?: (index: number) => void;
  onToggle?: (index: number) => void;
  enabled?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);

  // keep the cursor inside the list when rows change
  useEffect(() => {
    setActive((a) => (a === null ? null : count === 0 ? null : Math.min(a, count - 1)));
  }, [count]);

  const move = useCallback(
    (to: (a: number | null) => number) => {
      setActive((a) => {
        const next = Math.max(0, Math.min(count - 1, to(a)));
        requestAnimationFrame(() =>
          document.querySelector(`[data-row-index="${next}"]`)?.scrollIntoView({ block: "nearest" }),
        );
        return next;
      });
    },
    [count],
  );

  useEffect(() => {
    if (!enabled || count === 0) return;
    const h = (e: KeyboardEvent) => {
      if (isTyping(e) || hasMod(e) || e.altKey || dialogOpen()) return;
      const k = e.key;
      if (k === "ArrowDown" || k === "j") move((a) => (a === null ? 0 : a + 1));
      else if (k === "ArrowUp" || k === "k") move((a) => (a === null ? count - 1 : a - 1));
      else if (k === "Home") move(() => 0);
      else if (k === "End") move(() => count - 1);
      else if (k === "Enter" && active !== null && onOpen && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)) onOpen(active);
      else if (k === "x" && active !== null && onToggle) onToggle(active);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [enabled, count, active, move, onOpen, onToggle]);

  return { active, setActive };
}
