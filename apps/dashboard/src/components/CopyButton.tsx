import { Copy } from "lucide-react";
import { useCopy } from "@/lib/clipboard";
import { Btn, IconBtn } from "./Btn";

/** Copies `text` and toasts "<what> copied". Pass `label` for a text button, omit for an icon button. */
export function CopyButton({ text, what, label, className }: { text: string; what: string; label?: string; className?: string }) {
  const copy = useCopy();
  if (label) {
    return (
      <Btn size="sm" onClick={() => void copy(text, what)} className={className}>
        <Copy />
        {label}
      </Btn>
    );
  }
  return (
    <IconBtn label={`Copy ${what.toLowerCase()}`} onClick={() => void copy(text, what)} className={className}>
      <Copy />
    </IconBtn>
  );
}
