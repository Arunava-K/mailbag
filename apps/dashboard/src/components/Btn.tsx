import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Link, type LinkProps } from "@/lib/router";

export type BtnVariant = "default" | "primary" | "ghost" | "danger";
export type BtnSize = "md" | "sm";

/**
 * Button language from the mockups (.btn): 28px (md) / 24px (sm), 7px radius.
 * `btnClass` is exported so links can look like buttons.
 */
export function btnClass({ variant = "default", size = "md" }: { variant?: BtnVariant; size?: BtnSize } = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] border font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[15px] [&_svg]:shrink-0",
    size === "md" ? "h-7 px-2.5 text-[13px]" : "h-6 px-2 text-xs [&_svg]:size-3.5",
    variant === "default" && "border-line bg-panel text-foreground hover:bg-hover",
    variant === "primary" && "border-transparent bg-brand text-primary-foreground hover:brightness-110",
    variant === "ghost" && "border-transparent bg-transparent text-muted-foreground hover:bg-hover hover:text-foreground",
    variant === "danger" && "border-transparent bg-transparent text-danger hover:bg-danger-soft",
  );
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
}

/** `<Btn variant="primary">New list <Kbd>C</Kbd></Btn>` */
export const Btn = forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  { variant, size, className, type = "button", ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={cn(btnClass({ variant, size }), className)} {...rest} />;
});

export function LinkBtn({ variant, size, className, ...rest }: LinkProps & { variant?: BtnVariant; size?: BtnSize }) {
  return <Link className={cn(btnClass({ variant, size }), className)} {...rest} />;
}

/** Square icon-only button. `label` is required (aria-label + title). */
export const IconBtn = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  function IconBtn({ label, className, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={cn(
          "grid size-[26px] shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground disabled:opacity-50 [&_svg]:size-[15px]",
          className,
        )}
        {...rest}
      />
    );
  },
);
