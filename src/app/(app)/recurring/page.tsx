"use client";

import { Plus, Pencil, CalendarClock, Zap, Bell } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/components/transactions/transactions-provider";
import type { RecurringRule } from "@/lib/data";
import { formatMoney, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

const cadenceLabel: Record<RecurringRule["cadence"], string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export default function RecurringPage() {
  const { recurring, openAddRecurring } = useAppData();
  const rules = [...recurring].sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="display text-3xl tracking-tight md:text-4xl">
              Recurring
            </h1>
            <p className="text-sm text-muted-foreground">
              Scheduled income and bills. Auto-post ones are created when due;
              the rest wait here as reminders.
            </p>
          </div>
          <Button onClick={openAddRecurring} className="shrink-0 gap-1.5">
            <Plus className="size-4" />
            New
          </Button>
        </div>
      </Reveal>

      {rules.length === 0 ? (
        <Reveal delay={0.05}>
          <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CalendarClock className="size-6" />
            </span>
            <div>
              <p className="font-medium">Nothing recurring yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Add rent, your salary, or a subscription and Ledger will keep it
                on schedule.
              </p>
            </div>
            <Button onClick={openAddRecurring} variant="outline" className="mt-1 gap-1.5">
              <Plus className="size-4" />
              New recurring
            </Button>
          </div>
        </Reveal>
      ) : (
        <Reveal delay={0.05}>
          <ul className="mt-8 divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card">
            {rules.map((r) => (
              <RuleRow key={r.id} rule={r} />
            ))}
          </ul>
        </Reveal>
      )}
    </div>
  );
}

function RuleRow({ rule }: { rule: RecurringRule }) {
  const { getAccount, getCategory, openEditRecurring, postRecurring } = useAppData();
  const today = new Date().toISOString().slice(0, 10);
  const isExpense = rule.amount < 0;
  const overdue = rule.nextDate < today;
  const due = rule.nextDate <= today;
  const account = getAccount(rule.accountId);
  const category = rule.categoryId ? getCategory(rule.categoryId) : undefined;

  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          rule.autoPost
            ? "bg-foreground/[0.06] text-foreground"
            : "bg-muted text-muted-foreground"
        )}
        title={rule.autoPost ? "Auto-posts when due" : "Reminder only"}
      >
        {rule.autoPost ? <Zap className="size-4" /> : <Bell className="size-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium leading-tight">
            {rule.merchant}
          </p>
          {due && (
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                overdue ? "bg-expense/10 text-expense" : "bg-muted text-muted-foreground"
              )}
            >
              {overdue ? "Overdue" : "Due"}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {cadenceLabel[rule.cadence]} · {account?.name ?? "—"}
          {category ? ` · ${category.label}` : ""} · next{" "}
          {formatRelativeDay(rule.nextDate)}
        </p>
      </div>

      <span
        className={cn(
          "num shrink-0 text-sm font-semibold tabular-nums",
          isExpense ? "text-expense" : "text-income"
        )}
      >
        {formatMoney(rule.amount, { currency: rule.currency, signed: true })}
      </span>

      {due && !rule.autoPost && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0"
          onClick={() => postRecurring(rule.id)}
        >
          Post now
        </Button>
      )}

      <button
        type="button"
        onClick={() => openEditRecurring(rule)}
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Edit schedule"
      >
        <Pencil className="size-4" />
      </button>
    </li>
  );
}
