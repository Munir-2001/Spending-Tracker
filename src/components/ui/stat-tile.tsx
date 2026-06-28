import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type Tone = "income" | "expense" | "warning";

/**
 * The canonical KPI tile — one label + one figure. Replaces the three local
 * `Stat`/`Tile` copies across reports/insights/budgets. Numbers are the hero,
 * so the value renders in `.num` at a deliberate size.
 */
export function StatTile({
  label,
  value,
  tone,
  accent,
  className,
}: {
  label: string;
  value: React.ReactNode;
  /** Color the figure to signal direction/status. Omit for neutral. */
  tone?: Tone;
  /** Inverted ink card — use for the single hero metric in a row. */
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 p-4",
        accent ? "border-transparent bg-primary text-primary-foreground" : "bg-card",
        className,
      )}
    >
      <p className={cn("eyebrow", accent && "text-primary-foreground/60")}>{label}</p>
      <p
        className={cn(
          "num amount-lg mt-1.5 text-2xl font-medium leading-none",
          !accent && tone === "income" && "text-income",
          !accent && tone === "expense" && "text-expense",
          !accent && tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** Loading placeholder matching StatTile's geometry. */
export function StatTileSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-card p-4", className)}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2.5 h-6 w-28" />
    </div>
  );
}
