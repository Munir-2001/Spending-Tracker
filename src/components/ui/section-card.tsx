import { cn } from "@/lib/utils";

/**
 * A titled card with a border-b header strip and a body. Replaces the four
 * different "section card" dialects across categories / reimbursements /
 * settings / accounts groups.
 *
 * `trailing` fills the right side of the header (a count, subtotals, a menu).
 * Omit `title` for a plain bordered container.
 */
export function SectionCard({
  title,
  icon,
  trailing,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/60 bg-card",
        className,
      )}
    >
      {(title || trailing) && (
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            {icon}
            {title}
          </span>
          {trailing && (
            <div className="flex shrink-0 items-center gap-3">{trailing}</div>
          )}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
