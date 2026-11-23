import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Dense table primitives (32px header, 36px rows) with real table semantics.
 * `<TableScroll><Table><thead><tr><Th>…</Th></tr></thead><tbody><Tr>…<Td/></Tr></tbody></Table></TableScroll>`
 * TableScroll makes the table scroll horizontally inside its panel on narrow screens.
 */
export function TableScroll({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full min-w-0 max-w-full overflow-x-auto", className)} {...rest} />;
}

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-[13px]", className)} {...rest} />;
}

export function Th({ className, right, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { right?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "h-8 border-b border-line-2 px-3.5 text-[11.5px] font-medium whitespace-nowrap text-faint",
        right ? "text-right" : "text-left",
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ className, right, num, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { right?: boolean; num?: boolean }) {
  return (
    <td
      className={cn("h-9 border-b border-line-2 px-3.5 whitespace-nowrap", (right || num) && "text-right", num && "tabular", className)}
      {...rest}
    />
  );
}

/**
 * Row. `selected` = checked (tinted), `open` = shown in the drawer (hover tint + accent edge),
 * `active` = keyboard cursor (see useRowNav). The last row has no bottom border.
 */
export function Tr({
  className,
  selected,
  open,
  active,
  ...rest
}: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean; open?: boolean; active?: boolean }) {
  return (
    <tr
      data-active={active || undefined}
      data-selected={selected || undefined}
      className={cn(
        "group/row hover:bg-hover [&:last-child>td]:border-b-0",
        selected && "bg-sel hover:bg-sel",
        open && "bg-hover [&>td:first-child]:shadow-[inset_2px_0_0_var(--brand)]",
        active && "[&>td:first-child]:shadow-[inset_2px_0_0_var(--faint)]",
        className,
      )}
      {...rest}
    />
  );
}
