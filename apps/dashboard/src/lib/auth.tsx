import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

const KEY = "mb-admin-key";
export const UNAUTHORIZED_EVENT = "mb:unauthorized";

interface AuthState {
  /** Admin key (never empty inside the authenticated app). */
  adminKey: string;
  unlock: (key: string) => void;
  lock: () => void;
}

const Ctx = createContext<AuthState | null>(null);

function stored(): string {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

/** Holds the admin key. Renders `gate` while locked, `children` once unlocked. */
export function AuthProvider({ gate, children }: { gate: (unlock: (k: string) => void) => ReactNode; children: ReactNode }) {
  const qc = useQueryClient();
  const [adminKey, setKey] = useState(stored);

  const unlock = useCallback((k: string) => {
    try {
      localStorage.setItem(KEY, k);
    } catch {
      /* ignore */
    }
    setKey(k);
  }, []);

  const lock = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    qc.clear();
    setKey("");
  }, [qc]);

  // Any 401 from the API means the key is no longer valid.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, lock);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, lock);
  }, [lock]);

  const value = useMemo(() => ({ adminKey, unlock, lock }), [adminKey, unlock, lock]);
  if (!adminKey) return <>{gate(unlock)}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside an unlocked AuthProvider");
  return c;
}
