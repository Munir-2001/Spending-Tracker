import { cn } from "@/lib/utils";

/**
 * The Ledger mark — three balanced, stacked bars (a ledger's ruled lines).
 * Uses currentColor so it inherits text color; wrap in a colored tile for the
 * lockup. This is the single source of truth for the brand mark.
 */
export function LedgerMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={cn("size-4", className)}
    >
      <rect x="2" y="3.5" width="12" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="2" y="7.4" width="8" height="2.2" rx="1.1" fill="currentColor" opacity="0.7" />
      <rect x="2" y="11.3" width="10.5" height="2.2" rx="1.1" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

/** The mark in its rounded brand tile (white mark on the primary color). */
export function LedgerTile({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className
      )}
    >
      <LedgerMark />
    </span>
  );
}

/** Full lockup: tile + wordmark. */
export function LedgerLogo({
  className,
  wordmarkClassName,
}: {
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LedgerTile />
      <span className={cn("display text-lg leading-none tracking-tight", wordmarkClassName)}>
        Ledger
      </span>
    </span>
  );
}