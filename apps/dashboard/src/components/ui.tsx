import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { useCountUp } from "../hooks/useCountUp";

/* ---------- buttons / inputs (light, attio-like) ---------- */

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
      ? "bg-zinc-900 text-white hover:bg-zinc-700"
      : variant === "danger"
        ? "border border-red-200 text-red-600 hover:bg-red-50"
        : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50";
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-[13px] font-medium shadow-sm disabled:opacity-50 ${cls}`}
    >
      {children}
    </motion.button>
  );
}

export const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400";
export const labelCls = "mb-1 block text-xs font-medium text-zinc-500";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

export function Badge({ children, tone = "zinc" }: { children: ReactNode; tone?: "zinc" | "green" | "amber" | "red" | "blue" | "purple" }) {
  const tones: Record<string, string> = {
    zinc: "bg-zinc-100 text-zinc-600",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700",
    blue: "bg-sky-50 text-sky-700",
    purple: "bg-violet-50 text-violet-700",
  };
  return <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function statusTone(s: string): "green" | "amber" | "zinc" {
  return s === "confirmed" ? "green" : s === "pending" ? "amber" : "zinc";
}

export function Dot({ tone = "zinc" }: { tone?: "green" | "amber" | "zinc" | "blue" }) {
  const tones = { green: "bg-emerald-500", amber: "bg-amber-500", zinc: "bg-zinc-300", blue: "bg-sky-500" };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${tones[tone]}`} />;
}

/* ---------- modal ---------- */

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/30 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-[15px] font-semibold text-zinc-900">{title}</h2>
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ---------- toasts ---------- */

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
            className={`rounded-xl border px-4 py-2.5 text-[13px] shadow-lg ${
              t.kind === "err" ? "border-red-200 bg-white text-red-700" : "border-zinc-200 bg-white text-zinc-800"
            }`}
          >
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------- stat card ---------- */

export function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const v = useCountUp(value);
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-2xl font-semibold tabular-nums text-zinc-900">{v}</div>
      <div className="mt-0.5 text-[13px] text-zinc-500">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-400">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8 text-center text-[13px] text-zinc-500">{children}</div>;
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
        <h3 className="text-[13px] font-semibold text-zinc-900">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
