import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Trend = {
  value: string;
  /** "up" is rendered positive (emerald), "down" negative (terracotta). */
  direction: "up" | "down";
};

export function StatCard({
  label,
  value,
  caption,
  trend,
  accent = false,
}: {
  label: string;
  value: string;
  caption?: string;
  trend?: Trend;
  /** Featured card — inverts to the ink primary surface. */
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-6 transition-colors",
        accent
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border/60 bg-card hover:border-border"
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[11px] font-medium uppercase tracking-[0.12em]",
            accent ? "text-primary-foreground/60" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
              accent
                ? "bg-primary-foreground/10 text-primary-foreground/90"
                : trend.direction === "up"
                  ? "bg-income/10 text-income"
                  : "bg-expense/10 text-expense"
            )}
          >
            {trend.direction === "up" ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {trend.value}
          </span>
        )}
      </div>

      <div className="mt-6">
        <p className="display amount-lg text-3xl leading-none">{value}</p>
        {caption && (
          <p
            className={cn(
              "mt-2 text-xs",
              accent ? "text-primary-foreground/55" : "text-muted-foreground"
            )}
          >
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}
