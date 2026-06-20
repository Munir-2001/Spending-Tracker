"use client";

import { formatMoney, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppData } from "@/components/transactions/transactions-provider";

export function RecentTransactions({ limit = 6 }: { limit?: number }) {
  const { items, getAccount, getCategory } = useAppData();
  const rows = items.slice(0, limit);

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No transactions yet. Hit “New transaction” to add your first.
      </p>
    );
  }

  return (
    <ul className="-mx-2 divide-y divide-border/40">
      {rows.map((t) => {
        const category = getCategory(t.categoryId);
        const account = getAccount(t.accountId);
        const isIncome = t.amount > 0;

        return (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50"
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={{
                backgroundColor: `color-mix(in oklab, ${category?.tint ?? "var(--muted-foreground)"} 14%, transparent)`,
                color: category?.tint ?? "var(--muted-foreground)",
              }}
            >
              {t.merchant.slice(0, 1)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">
                {t.merchant}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <span>
                  {t.items?.length
                    ? `Split · ${t.items.length} items`
                    : category?.label}
                </span>
                <span className="text-border">·</span>
                <span>{account?.name}</span>
                {t.pending && (
                  <span className="rounded bg-amber-500/12 px-1.5 py-px text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    Pending
                  </span>
                )}
                {t.reimbursement && (
                  <span className="rounded bg-income/10 px-1.5 py-px text-[10px] font-medium text-income">
                    for {t.reimbursement.person}
                  </span>
                )}
              </p>
            </div>

            <div className="text-right">
              <p
                className={cn(
                  "num text-sm font-medium tabular-nums",
                  isIncome ? "text-income" : "text-foreground"
                )}
              >
                {formatMoney(t.amount, { signed: isIncome, currency: t.currency })}
              </p>
              <p className="num mt-0.5 text-[11px] text-muted-foreground">
                {formatRelativeDay(t.date)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
