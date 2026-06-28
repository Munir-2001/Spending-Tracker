import { cn } from "@/lib/utils";

/**
 * Segmented toggle. Replaces the reusable copy in insights and the re-inlined
 * one in reports.
 *
 * Accessibility: rendered as a radiogroup with `aria-checked` per segment, so
 * screen readers announce the active option. The active pill uses `bg-card`
 * (not `bg-background`) so it still reads as raised in dark mode.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "flex flex-wrap rounded-lg border border-border/60 bg-muted/40 p-1",
        className,
      )}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
