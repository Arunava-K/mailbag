import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "./utils";

type Kind = "ok" | "err";
interface ToastItem {
  id: number;
  msg: string;
  kind: Kind;
}
export type ToastFn = (msg: string, kind?: Kind) => void;

const Ctx = createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const id = useRef(0);

  const dismiss = useCallback((i: number) => setItems((t) => t.filter((x) => x.id !== i)), []);
  const toast = useCallback<ToastFn>(
    (msg, kind = "ok") => {
      const n = ++id.current;
      setItems((t) => [...t.slice(-3), { id: n, msg, kind }]);
      setTimeout(() => dismiss(n), kind === "err" ? 6500 : 3800);
    },
    [dismiss],
  );
  const value = useMemo(() => toast, [toast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        role="region"
        aria-label="Notifications"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === "err" ? "alert" : "status"}
            className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-popover px-3 py-2.5 text-[13px] text-popover-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            {t.kind === "err" ? (
              <AlertCircle className="mt-px size-4 shrink-0 text-danger" aria-hidden />
            ) : (
              <CheckCircle2 className="mt-px size-4 shrink-0 text-success" aria-hidden />
            )}
            <span className={cn("min-w-0 flex-1 break-words", t.kind === "err" && "text-foreground")}>{t.msg}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="-mr-1 grid size-5 shrink-0 place-items-center rounded text-faint hover:bg-hover hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
