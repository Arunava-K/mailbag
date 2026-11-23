import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const COLLAPSED_KEY = "mb-sidebar-collapsed";

interface ShellState {
  /** desktop sidebar is the 56px rail (persisted) */
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** < 1024px: sidebar sheet */
  mobileNavOpen: boolean;
  setMobileNavOpen: (o: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (o: boolean) => void;
  newListOpen: boolean;
  setNewListOpen: (o: boolean) => void;
}

const Ctx = createContext<ShellState | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newListOpen, setNewListOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);
  const value = useMemo(
    () => ({ collapsed, toggleCollapsed, mobileNavOpen, setMobileNavOpen, paletteOpen, setPaletteOpen, newListOpen, setNewListOpen }),
    [collapsed, toggleCollapsed, mobileNavOpen, paletteOpen, newListOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShell(): ShellState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShell must be used within ShellProvider");
  return c;
}
