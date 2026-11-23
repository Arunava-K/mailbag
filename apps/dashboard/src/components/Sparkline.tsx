import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Tiny line chart. `values` scale to their own max. An all-zero or single-point
 * series renders as a flat faint baseline (no invented trend).
 * `label` is the accessible description.
 */
export function Sparkline({
  values,
  width = 110,
  height = 24,
  label,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  label?: string;
  className?: string;
}) {
  const id = useId();
  const max = Math.max(0, ...values);
  const flat = values.length < 2 || max === 0;
  const pad = 2;
  const x0 = 1;
  const span = width - 2;
  const pts = flat
    ? `${x0},${height - pad} ${x0 + span},${height - pad}`
    : values
        .map((v, i) => `${(x0 + (i * span) / (values.length - 1)).toFixed(1)},${(height - pad - (v / max) * (height - pad * 2)).toFixed(1)}`)
        .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby={label ? id : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("block", className)}
    >
      {label && <title id={id}>{label}</title>}
      <polyline
        points={pts}
        fill="none"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className={flat ? "stroke-line" : "stroke-brand"}
      />
    </svg>
  );
}
