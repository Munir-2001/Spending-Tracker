/**
 * Live aggregations over the user's accounts and transactions, rolled up to the
 * base currency via FX rates. Pure functions — fed by the provider's state.
 */

import type { Account, Category, Transaction } from "@/lib/data";
import type { Fx } from "@/lib/currency";

/**
 * The per-category contributions of a transaction. Split transactions return
 * one entry per line item; simple ones return a single entry. Amounts stay in
 * the transaction's own currency, signed.
 */
export function categoryLinesOf(
  t: Transaction
): { categoryId: string; amount: number }[] {
  if (t.items && t.items.length)
    return t.items.map((i) => ({ categoryId: i.categoryId, amount: i.amount }));
  return [{ categoryId: t.categoryId, amount: t.amount }];
}

/** Net worth in base currency: every non-group account's balance, converted. */
export function netWorthBase(
  accounts: Account[],
  balanceOf: (id: string) => number,
  fx: Fx
): number {
  return accounts
    .filter((a) => !a.isGroup)
    .reduce((sum, a) => sum + fx.toBase(balanceOf(a.id), a.currency), 0);
}

/** Distinct currencies in use across non-group accounts. */
export function currenciesInUse(accounts: Account[]): string[] {
  return [...new Set(accounts.filter((a) => !a.isGroup).map((a) => a.currency))];
}

const inMonth = (iso: string, year: number, month: number) => {
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() === month;
};

export type MonthFlows = { income: number; expense: number; net: number };

/** Income / expense / net for a given month, in base currency. */
export function monthFlowsBase(
  transactions: Transaction[],
  year: number,
  month: number,
  fx: Fx
): MonthFlows {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (!inMonth(t.date, year, month)) continue;
    if (t.isReimbursement) continue; // a refund settles a receivable, not income
    // The reimbursable portion is owed back, so it isn't your spending.
    const own = t.reimbursement ? t.amount + t.reimbursement.amount : t.amount;
    const base = fx.toBase(own, t.currency);
    if (base > 0) income += base;
    else expense += base; // negative
  }
  return { income, expense, net: income + expense };
}

/** Total still owed to you across unsettled reimbursements, in base currency. */
export function pendingReceivablesBase(
  transactions: Transaction[],
  fx: Fx
): number {
  let total = 0;
  for (const t of transactions)
    if (t.reimbursement && !t.reimbursement.settled)
      total += fx.toBase(t.reimbursement.amount, t.currency);
  return total;
}

export type CategorySpend = { category: Category; amount: number };

/** Expense totals by category for a month, base currency, sorted desc. */
export function spendingByCategoryBase(
  transactions: Transaction[],
  categories: Category[],
  year: number,
  month: number,
  fx: Fx
): CategorySpend[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (!inMonth(t.date, year, month)) continue;
    if (t.isReimbursement) continue;
    const split = Boolean(t.items?.length);
    for (const line of categoryLinesOf(t)) {
      // Exclude the reimbursable portion (non-split only) from the category total.
      const amt =
        t.reimbursement && !split ? line.amount + t.reimbursement.amount : line.amount;
      if (amt >= 0) continue; // expenses only
      totals.set(
        line.categoryId,
        (totals.get(line.categoryId) ?? 0) + Math.abs(fx.toBase(amt, t.currency))
      );
    }
  }
  return [...totals.entries()]
    .map(([id, amount]) => ({ category: byId.get(id), amount }))
    .filter((x): x is CategorySpend => Boolean(x.category))
    .sort((a, b) => b.amount - a.amount);
}

export type CashflowPoint = { month: string; income: number; expense: number };

/** Trailing `months` of income vs. expense (positive magnitude), base currency. */
export function monthlyCashflowBase(
  transactions: Transaction[],
  anchor: Date,
  fx: Fx,
  months = 6
): CashflowPoint[] {
  const points: CashflowPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const flows = monthFlowsBase(transactions, d.getFullYear(), d.getMonth(), fx);
    points.push({
      month: d.toISOString().slice(0, 10),
      income: flows.income,
      expense: Math.abs(flows.expense),
    });
  }
  return points;
}
