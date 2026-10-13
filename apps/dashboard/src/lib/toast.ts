export interface Toast {
  id: number;
  msg: string;
  kind: "ok" | "err";
}

export type ToastFn = (msg: string, kind?: Toast["kind"]) => void;
