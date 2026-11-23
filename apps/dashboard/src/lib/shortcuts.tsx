import { useEffect, useRef } from "react";
import { navigate } from "./router";
import { paths } from "./routes";
import { dialogOpen, hasMod, isTyping } from "./keys";
import { useShell } from "@/components/shell/ShellContext";

const GO: Record<string, () => string> = {
  o: paths.overview,
  c: () => paths.contacts(),
  a: paths.activity,
  l: paths.lists,
  s: paths.settings,
};

/**
 * Global keyboard shortcuts (mount once, inside the shell).
 *  Mod+K palette, Mod+\ collapse sidebar, G then O/C/A/L/S navigate, C new list,
 *  / focuses the page filter ([data-page-filter]). Plain keys are ignored while typing or a dialog is open.
 */
export function GlobalShortcuts() {
  const { setPaletteOpen, toggleCollapsed, setNewListOpen } = useShell();
  const gPending = useRef<number | null>(null);

  useEffect(() => {
    const clearG = () => {
      if (gPending.current !== null) window.clearTimeout(gPending.current);
      gPending.current = null;
    };
    const h = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (hasMod(e) && k === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (hasMod(e) && e.key === "\\") {
        e.preventDefault();
        toggleCollapsed();
        return;
      }
      if (hasMod(e) || e.altKey || isTyping(e) || dialogOpen()) return;

      if (gPending.current !== null) {
        const to = GO[k];
        clearG();
        if (to) {
          e.preventDefault();
          navigate(to());
        }
        return;
      }
      if (k === "g") {
        gPending.current = window.setTimeout(clearG, 1200);
      } else if (k === "c") {
        e.preventDefault();
        setNewListOpen(true);
      } else if (k === "/") {
        const el = document.querySelector<HTMLInputElement>("[data-page-filter]");
        if (el) {
          e.preventDefault();
          el.focus();
          el.select();
        }
      }
    };
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("keydown", h);
      clearG();
    };
  }, [setPaletteOpen, toggleCollapsed, setNewListOpen]);

  return null;
}

/** Reference list shown on Settings. Keep in sync with the handlers here, in table/useRowNav and in Drawer/BulkBar. */
export const SHORTCUT_GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: "Anywhere",
    items: [
      { keys: ["⌘/Ctrl", "K"], label: "Open the command palette" },
      { keys: ["G", "then O / C / A / L / S"], label: "Go to Overview / Contacts / Activity / Lists / Settings" },
      { keys: ["C"], label: "New list" },
      { keys: ["/"], label: "Focus the page filter" },
      { keys: ["⌘/Ctrl", "\\"], label: "Collapse or expand the sidebar" },
    ],
  },
  {
    title: "Contact tables",
    items: [
      { keys: ["↑", "↓"], label: "Move the row cursor (J / K also work)" },
      { keys: ["Enter"], label: "Open the contact in the side panel" },
      { keys: ["X"], label: "Select or deselect the row" },
      { keys: ["Shift", "click"], label: "Select a range of rows" },
      { keys: ["Esc"], label: "Clear the selection, then close the side panel" },
    ],
  },
  {
    title: "Welcome email",
    items: [{ keys: ["⌘/Ctrl", "S"], label: "Save changes" }],
  },
];
