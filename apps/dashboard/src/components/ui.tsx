import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { useCountUp } from "../hooks/useCountUp";

/* ---------- buttons / inputs ---------- */

export function Btn({
  children,
  onClick,
  variant = "ghost",
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const cls =
    variant === "primary"
      ? "bg-zinc-100 text-zinc-900 hover:bg-white"
      : variant === "danger"
        ? "border border-red-900 text-red-300 hover:border-red-700"
        : "border border-zinc-700 text-zinc-200 hover:border-zinc-500";
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${cls}`}
    >
      {children}
    </motion.button>
  );
}

export const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500";
export const labelCls = "mb-1 block text-xs font-medium text-zinc-400";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

export function Badge({ children, tone = "zinc" }: { children: ReactNode; tone?: "zinc" | "green" | "amber" | "red" | "blue" }) {
  const tones: Record<string, string> = {
    zinc: "border-zinc-700 text-zinc-300",
    green: "border-emerald-900 text-emerald-300",
    amber: "border-amber-900 text-amber-300",
    red: "border-red-900 text-red-300",
    blue: "border-sky-900 text-sky-300",
  };
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${tones[tone]}`}>{children}</span>;
}

export function statusTone(s: string): "green" | "amber" | "zinc" {
  return s === "confirmed" ? "green" : s === "pending" ? "amber" : "zinc";
}

/* ---------- modal (morphing-modal spirit) ---------- */

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 font-semibold text-zinc-100">{title}</h2>
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ---------- toasts (toast-stack spirit) ---------- */

export interface Toast {
  id: number;
  msg: string;
  kind: "ok" | "err";
}

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-72 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            className={`rounded-xl border px-4 py-2.5 text-sm shadow-xl ${
              t.kind === "err" ? "border-red-900 bg-red-950 text-red-200" : "border-zinc-700 bg-zinc-900 text-zinc-100"
            }`}
          >
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------- stat card (number-animation spirit) ---------- */

export function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const v = useCountUp(value);
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="text-3xl font-semibold tabular-nums text-zinc-100">{v}</div>
      <div className="mt-1 text-sm text-zinc-400">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-600">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">{children}</div>;
}
