import { cn } from "@/lib/utils";

/**
 * The centered icon + title + body + optional CTA empty state. Replaces the
 * four near-identical copies (accounts / assets / categories / reimbursements).
 *
 * `variant="dashed"` (default) is the page-level "nothing here yet" block;
 * `variant="plain"` is for inside an existing card/panel.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "dashed",
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "dashed" | "plain";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 py-16 text-center",
        variant === "dashed" && "rounded-2xl border border-dashed border-border",
        className,
      )}
    >
      {icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </span>
      )}
      <div className="max-w-sm">
        <p className="font-medium">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
