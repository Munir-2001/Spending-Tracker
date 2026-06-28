"use client";

import { useMemo, useState } from "react";

import { Reveal } from "@/components/reveal";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import { useAppData } from "@/components/transactions/transactions-provider";
import {
  assetsBase,
  categoryLinesOf,
  netWorthBase,
  pendingReceivablesBase,
  rollupCategoryId,
} from "@/lib/compute";
import { formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type Period = "month" | "year";

export default function ReportsPage() {
  const { items, accounts, categories, assets, balanceOf, baseCurrency, fx } =
    useAppData();
  const [period, setPeriod] = useState<Period>("month");
  const now = new Date();
  const periodLabel =
    period === "month"
      ? now.toLocaleString("en-US", { month: "long", year: "numeric" })
      : String(now.getFullYear());

  const inPeriod = useMemo(() => {
    return (iso: string) => {
      const d = new Date(iso);
      if (d.getFullYear() !== now.getFullYear()) return false;
      return period === "year" ? true : d.getMonth() === now.getMonth();
    };
  }, [period, now]);

  // Income statement, base currency.
  const statement = useMemo(() => {
    const catById = new Map(categories.map((c) => [c.id, c]));
    let income = 0;
    const expenseByCat = new Map<string, number>();
    for (const t of items) {
      if (!inPeriod(t.date) || t.isReimbursement || t.isTransfer) continue;
      if (t.amount > 0) income += fx.toBase(t.amount, t.currency);
      const split = Boolean(t.items?.length);
      for (const line of categoryLinesOf(t)) {
        const amt =
          t.reimbursement && !split ? line.amount + t.reimbursement.amount : line.amount;
        if (amt >= 0) continue;
        const rollId = rollupCategoryId(line.categoryId, catById);
        expenseByCat.set(
          rollId,
          (expenseByCat.get(rollId) ?? 0) + Math.abs(fx.toBase(amt, t.currency))
        );
      }
    }
    const expenses = [...expenseByCat.entries()]
      .map(([id, amount]) => ({ category: catById.get(id), amount }))
      .filter((x) => x.category)
      .sort((a, b) => b.amount - a.amount);
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
    return { income, expenses, totalExpense, net: income - totalExpense };
  }, [items, categories, inPeriod, fx]);

  const netWorth =
    netWorthBase(accounts, balanceOf, fx) +
    pendingReceivablesBase(items, fx) +
    assetsBase(assets, fx);
  const savingsRate = statement.income > 0 ? statement.net / statement.income : 0;
  const money = { currency: baseCurrency } as const;

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="display text-3xl tracking-tight md:text-4xl">Reports</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Income statement · {periodLabel} · all figures in {baseCurrency}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
            {(["month", "year"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                  period === p
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p === "month" ? "This month" : "This year"}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Headline figures */}
      <Reveal delay={0.05}>
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Revenue" value={formatMoney(statement.income, money)} tone="income" />
          <Stat label="Expenses" value={formatMoney(statement.totalExpense, money)} tone="expense" />
          <Stat
            label="Net income"
            value={formatMoney(statement.net, { ...money, signed: true })}
            tone={statement.net >= 0 ? "income" : "expense"}
          />
          <Stat label="Savings rate" value={formatPercent(savingsRate)} />
        </div>
      </Reveal>

      {/* Income statement */}
      <Reveal delay={0.1}>
        <section className="mt-3 rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="text-sm font-semibold tracking-tight">Income statement</h2>

          <div className="mt-4 space-y-1.5">
            <Line label="Revenue" amount={formatMoney(statement.income, money)} bold />
            <Divider />
            <p className="pt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Expenses
            </p>
            {statement.expenses.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">
                No expenses recorded in this period.
              </p>
            )}
            {statement.expenses.map((e) => (
              <Line
                key={e.category!.id}
                label={e.category!.label}
                tint={e.category!.tint}
                amount={`(${formatMoney(e.amount, money)})`}
                muted
              />
            ))}
            {statement.expenses.length > 0 && (
              <Line
                label="Total expenses"
                amount={`(${formatMoney(statement.totalExpense, money)})`}
              />
            )}
            <Divider />
            <Line
              label="Net income"
              amount={formatMoney(statement.net, { ...money, signed: true })}
              bold
              tone={statement.net >= 0 ? "income" : "expense"}
            />
          </div>
        </section>
      </Reveal>

      {/* Net worth + cash flow */}
      <Reveal delay={0.15}>
        <section className="mt-3 rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Cash flow</h2>
            <span className="text-xs text-muted-foreground">
              Net worth:{" "}
              <span className="num font-medium text-foreground">
                {formatMoney(netWorth, money)}
              </span>
            </span>
          </div>
          <div className="mt-4">
            <CashflowChart />
          </div>
        </section>
      </Reveal>
    </div>
  );
}

function Stat({
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

function Line({
  label,
  amount,
  tint,
  bold,
  muted,
  tone,
}: {
  label: string;
  amount: string;
  tint?: string;
  bold?: boolean;
  muted?: boolean;
  tone?: "income" | "expense";
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span
        className={cn(
          "flex items-center gap-2 text-sm",
          bold && "font-semibold",
          muted && "text-muted-foreground"
        )}
      >
        {tint && (
          <span className="size-2 rounded-full" style={{ backgroundColor: tint }} />
        )}
        {label}
      </span>
      <span
        className={cn(
          "num text-sm tabular-nums",
          bold && "font-semibold",
          muted && "text-muted-foreground",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense"
        )}
      >
        {amount}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="my-1 border-t border-border/60" />;
}
