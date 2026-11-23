import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** 20px outlined chip: `<Tag>Newsletter</Tag>`, `<Tag>SMTP</Tag>`. */
export function Tag({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-[5px] border border-line bg-panel px-[7px] text-[11.5px] font-medium text-muted-foreground",
        className,
      )}
      {...rest}
    />
  );
}
