"use client";

import { X } from "lucide-react";

import { useAppData } from "@/components/transactions/transactions-provider";
import type { Transaction } from "@/lib/data";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The event's expenses; click opens the detail, ✕ removes it from the event. */
export function EventExpenses({
  transactions,
  onRemove,
}: {
  transactions: Transaction[];
  onRemove: (t: Transaction) => void;
}) {
  const { getAccount, getCategory, openTransactionDetail } = useAppData();

  return (
    <ul className="divide-y divide-border/40">
      {transactions.map((t) => {
        const category = getCategory(t.categoryId);
        const tint = category?.tint ?? "var(--muted-foreground)";
        const kind = t.isTransfer
          ? "Transfer"
          : t.items?.length
            ? `Split · ${t.items.length} items`
            : category?.label ?? "Uncategorized";
        return (
          <li key={t.id} className="group flex items-center gap-3 px-5 py-3">
            <button
              type="button"
              onClick={() => openTransactionDetail(t)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: `color-mix(in oklab, ${tint} 14%, transparent)`,
                  color: tint,
                }}
              >
                {t.merchant.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-tight">
                  {t.merchant}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {formatDate(t.date)} · {kind} · {getAccount(t.accountId)?.name ?? "—"}
                  {t.reimbursement && !t.reimbursement.settled && (
                    <> · {t.reimbursement.person} owes you</>
                  )}
                </span>
              </span>
              <span
                className={cn(
                  "num shrink-0 text-sm font-medium",
                  t.amount < 0 ? "text-foreground" : "text-income"
                )}
              >
                {formatMoney(t.amount, { currency: t.currency, signed: true })}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(t)}
              className="shrink-0 rounded-md p-1 text-muted-foreground opacity-60 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
              aria-label={`Remove ${t.merchant} from this event`}
              title="Remove from event"
            >
              <X className="size-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
