"use client";

import { spendingByCategoryBase } from "@/lib/compute";
import { formatMoney } from "@/lib/format";
import { useAppData } from "@/components/transactions/transactions-provider";

export function SpendingCategories({ limit = 6 }: { limit?: number }) {
  const { items, categories, baseCurrency, fx } = useAppData();
  const now = new Date();
  const spend = spendingByCategoryBase(
    items,
    categories,
    now.getFullYear(),
    now.getMonth(),
    fx
  ).slice(0, limit);

  if (spend.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No spending recorded this month yet.
      </p>
    );
  }

  const max = Math.max(...spend.map((s) => s.amount));

  return (
    <ul className="space-y-5">
      {spend.map(({ category, amount }) => (
        <li key={category.id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 truncate">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: category.tint }}
              />
              <span className="truncate font-medium">{category.label}</span>
            </span>
            <span className="num shrink-0 text-xs text-muted-foreground">
              {formatMoney(amount, { currency: baseCurrency, trimZeroCents: true })}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max((amount / max) * 100, 2)}%`,
                backgroundColor: category.tint,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
