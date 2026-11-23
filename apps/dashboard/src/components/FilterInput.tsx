import { forwardRef, type InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "./Kbd";

/**
 * Toolbar filter field. Carries `data-page-filter`, so pressing "/" anywhere focuses it
 * (see lib/shortcuts). Render at most one per page.
 */
export const FilterInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function FilterInput(
  { className, ...rest },
  ref,
) {
  return (
    <label
      className={cn(
        "flex h-7 w-full items-center gap-1.5 rounded-[7px] border border-line bg-panel px-2.5 text-faint focus-within:border-brand sm:w-52",
        className,
      )}
    >
      <Search className="size-3.5 shrink-0" aria-hidden />
      <input
        ref={ref}
        data-page-filter
        type="search"
        className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
        {...rest}
      />
      <Kbd aria-hidden className="max-sm:hidden">/</Kbd>
    </label>
  );
});
