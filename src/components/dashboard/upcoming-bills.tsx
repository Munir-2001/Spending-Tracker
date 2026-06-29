"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { useAppData } from "@/components/transactions/transactions-provider";
import { upcomingBills } from "@/lib/compute";
import { formatMoney, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

export function UpcomingBills() {
  const { recurring, getAccount, postRecurring } = useAppData();
  const bills = upcomingBills(recurring, new Date(), 14).slice(0, 5);
  const today = new Date().toISOString().slice(0, 10);

  if (bills.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-6 text-center">
        <CalendarClock className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No bills due soon.</p>
        <Link
          href="/recurring"
          className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
        >
          Set up recurring
        </Link>
      </div>
    );
  }

  return (
    <ul className="-mx-1 flex flex-col">
      {bills.map((b) => {
        const overdue = b.nextDate < today;
        const due = b.nextDate <= today;
        const account = getAccount(b.accountId);
        return (
          <li
            key={b.id}
            className="flex items-center gap-3 rounded-lg px-1 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">
                {b.merchant}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {account?.name ?? "—"} ·{" "}
                <span className={cn(overdue && "text-expense")}>
                  {overdue ? "overdue" : formatRelativeDay(b.nextDate)}
                </span>
              </p>
            </div>
            <span className="num shrink-0 text-sm font-medium tabular-nums">
              {formatMoney(b.amount, { currency: b.currency })}
            </span>
            {due && !b.autoPost && (
              <button
                type="button"
                onClick={() => postRecurring(b.id)}
                className="shrink-0 rounded-md border border-border/70 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Post
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
