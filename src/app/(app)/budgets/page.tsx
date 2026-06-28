"use client";

import { useMemo, useState } from "react";

import { Reveal } from "@/components/reveal";
import { Input } from "@/components/ui/input";
import { useAppData } from "@/components/transactions/transactions-provider";
import { currencyInfo, toMajorUnits, toMinorUnits } from "@/lib/currency";
import { spendingByCategoryBase } from "@/lib/compute";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function BudgetsPage() {
  const { items, categories, budgetFor, setBudget, baseCurrency, fx } = useAppData();
  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long" });

  const spendByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of spendingByCategoryBase(
      items,
      categories,
      now.getFullYear(),
      now.getMonth(),
      fx
    ))
      map.set(s.category.id, s.amount);
    return map;
  }, [items, categories, now, fx]);

  // Budgets are set on top-level categories; sub-category spend rolls up.
  const expenseCategories = categories.filter(
    (c) => c.kind === "expense" && !c.parentId
  );
  const totalBudget = expenseCategories.reduce((s, c) => s + budgetFor(c.id), 0);
  const totalSpent = expenseCategories.reduce(
    (s, c) => s + (spendByCat.get(c.id) ?? 0),
    0
  );
  const remaining = totalBudget - totalSpent;

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-col gap-1.5">
          <h1 className="display text-3xl tracking-tight md:text-4xl">Budgets</h1>
          <p className="text-sm text-muted-foreground">
            Set a monthly limit per category. Spending is rolled up to{" "}
            {baseCurrency}. — {monthName}
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Tile label="Budgeted" value={formatMoney(totalBudget, { currency: baseCurrency, trimZeroCents: true })} />
          <Tile label="Spent" value={formatMoney(totalSpent, { currency: baseCurrency, trimZeroCents: true })} />
          <Tile
            label="Remaining"
            value={formatMoney(remaining, { currency: baseCurrency, trimZeroCents: true })}
            tone={remaining < 0 ? "expense" : "income"}
          />
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-3 divide-y divide-border/50 rounded-2xl border border-border/60 bg-card px-5">
          {expenseCategories.map((c) => (
            <BudgetRow
              key={c.id}
              label={c.label}
              tint={c.tint}
              base={baseCurrency}
              spent={spendByCat.get(c.id) ?? 0}
              budget={budgetFor(c.id)}
              onSet={(amount) => setBudget(c.id, amount)}
            />
          ))}
        </div>
      </Reveal>
    </div>
  );
}

function BudgetRow({
  label,
  tint,
  base,
  spent,
  budget,
  onSet,
}: {
  label: string;
  tint: string;
  base: string;
  spent: number;
  budget: number;
  onSet: (amountMinor: number) => void;
}) {
  const symbol = currencyInfo(base).symbol;
  const [draft, setDraft] = useState<string>(
    budget > 0 ? String(toMajorUnits(budget, base)) : ""
  );

  const pct = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const over = budget > 0 && spent > budget;
  const near = !over && budget > 0 && pct >= 0.9;

  function commit() {
    const major = Number.parseFloat(draft || "0");
    onSet(Number.isFinite(major) ? toMinorUnits(major, base) : 0);
  }

  return (
    <div className="flex flex-col gap-2 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="size-2 rounded-full" style={{ backgroundColor: tint }} />
          {label}
        </span>
        <div className="flex items-center gap-3">
          <span className="num text-xs text-muted-foreground">
            {formatMoney(spent, { currency: base, trimZeroCents: true })} spent
          </span>
          <div className="relative w-28">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {symbol}
            </span>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={draft}
              placeholder="No limit"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="num h-8 pl-6 text-right text-sm"
            />
          </div>
        </div>
      </div>
      {budget > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", over && "!bg-expense", near && "!bg-amber-500")}
            style={{
              width: `${Math.max(pct * 100, 2)}%`,
              backgroundColor: over || near ? undefined : tint,
            }}
          />
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "income" | "expense";
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "num mt-1.5 text-lg font-medium tabular-nums",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense"
        )}
      >
        {value}
      </p>
    </div>
  );
}
