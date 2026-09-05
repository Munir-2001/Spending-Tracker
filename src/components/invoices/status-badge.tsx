import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/lib/schema";

const STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-foreground/[0.06] text-foreground",
  viewed: "bg-foreground/[0.06] text-foreground",
  partial: "bg-warning/12 text-warning",
  paid: "bg-income/12 text-income",
  overdue: "bg-expense/10 text-expense",
  void: "bg-muted text-muted-foreground line-through",
};

const LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

/**
 * Status pill. `overdue` is a derived reading, so an invoice stored as `sent`
 * but past due should be shown overdue — pass `overdue` and it wins.
 */
export function StatusBadge({
  status,
  overdue,
  className,
}: {
  status: InvoiceStatus;
  overdue?: boolean;
  className?: string;
}) {
  const effective: InvoiceStatus = overdue ? "overdue" : status;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        STYLES[effective],
        className
      )}
    >
      {LABELS[effective]}
    </span>
  );
}
