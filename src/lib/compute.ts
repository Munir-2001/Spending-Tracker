/**
 * Live aggregations over the user's accounts and transactions, rolled up to the
 * base currency via FX rates. Pure functions — fed by the provider's state.
 */

import type { Account, Asset, Category, Transaction } from "@/lib/data";
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
    if (t.isReimbursement || t.isTransfer) continue; // settles a receivable / moves money — not income
    // The reimbursable portion is owed back, so it isn't your spending.
    const own = t.reimbursement ? t.amount + t.reimbursement.amount : t.amount;
    const base = fx.toBase(own, t.currency);
    if (base > 0) income += base;
    else expense += base; // negative
  }
  return { income, expense, net: income + expense };
}

/** Total value of all assets, converted to base currency. */
export function assetsBase(assets: Asset[], fx: Fx): number {
  return assets.reduce((sum, a) => sum + fx.toBase(a.value, a.currency), 0);
}

export type NetWorthPoint = { month: string; value: number };

/**
 * Reconstruct net worth at the end of each of the trailing `months`, in base
 * currency. Account balances are exact (opening + transactions up to that date);
 * assets are held at their current value (we don't store asset history yet).
 */
export function netWorthSeriesBase(
  accounts: Account[],
  transactions: Transaction[],
  assets: Asset[],
  fx: Fx,
  anchor: Date,
  months = 6
): NetWorthPoint[] {
  const leaves = accounts.filter((a) => !a.isGroup);
  const txnsByAccount = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const list = txnsByAccount.get(t.accountId) ?? [];
    list.push(t);
    txnsByAccount.set(t.accountId, list);
  }
  const heldAssets = assetsBase(assets, fx);

  const points: NetWorthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const cutoff = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      .toISOString()
      .slice(0, 10);
    let total = heldAssets;
    for (const a of leaves) {
      let bal = a.openingBalance;
      for (const t of txnsByAccount.get(a.id) ?? [])
        if (t.date < cutoff) bal += fx.convert(t.amount, t.currency, a.currency);
      total += fx.toBase(bal, a.currency);
    }
    points.push({ month: d.toISOString().slice(0, 10), value: total });
  }
  return points;
}

export type Subscription = {
  merchant: string;
  amount: number; // typical (median) charge, native minor units
  currency: string;
  count: number;
  lastDate: string;
  category?: Category;
};

/**
 * Detect likely subscriptions: a merchant charged a consistent amount across at
 * least two distinct months. Pure heuristic over existing transactions — no
 * external data. Variable-amount recurring merchants (groceries) are filtered
 * out by the consistency check.
 */
export function detectSubscriptions(
  transactions: Transaction[],
  categories: Category[]
): Subscription[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const groups = new Map<
    string,
    { merchant: string; txns: { date: string; amount: number; currency: string; categoryId: string }[] }
  >();
  for (const t of transactions) {
    if (t.isTransfer || t.isReimbursement || t.amount >= 0) continue;
    const key = t.merchant.trim().toLowerCase();
    if (!key) continue;
    const g = groups.get(key) ?? { merchant: t.merchant.trim(), txns: [] };
    g.txns.push({
      date: t.date,
      amount: Math.abs(t.amount),
      currency: t.currency,
      categoryId: t.categoryId,
    });
    groups.set(key, g);
  }

  const subs: Subscription[] = [];
  for (const g of groups.values()) {
    const months = new Set(g.txns.map((x) => x.date.slice(0, 7)));
    if (months.size < 2) continue; // must recur across ≥2 months
    const amounts = g.txns.map((x) => x.amount).sort((a, b) => a - b);
    const min = amounts[0];
    const max = amounts[amounts.length - 1];
    if (min > 0 && max / min > 1.35) continue; // amounts must be consistent
    const median = amounts[Math.floor(amounts.length / 2)];
    const latest = [...g.txns].sort((a, b) => b.date.localeCompare(a.date))[0];
    subs.push({
      merchant: g.merchant,
      amount: median,
      currency: latest.currency,
      count: g.txns.length,
      lastDate: latest.date,
      category: catById.get(latest.categoryId),
    });
  }
  return subs;
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

/** Resolve a category to its roll-up root: its parent if it's a sub-category. */
export function rollupCategoryId(
  categoryId: string,
  byId: Map<string, Category>
): string {
  return byId.get(categoryId)?.parentId ?? categoryId;
}

/**
 * Expense totals by category for a month, base currency, sorted desc.
 * Sub-categories roll up into their parent.
 */
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
    if (t.isReimbursement || t.isTransfer) continue;
    const split = Boolean(t.items?.length);
    for (const line of categoryLinesOf(t)) {
      // Exclude the reimbursable portion (non-split only) from the category total.
      const amt =
        t.reimbursement && !split ? line.amount + t.reimbursement.amount : line.amount;
      if (amt >= 0) continue; // expenses only
      const rollId = rollupCategoryId(line.categoryId, byId);
      totals.set(
        rollId,
        (totals.get(rollId) ?? 0) + Math.abs(fx.toBase(amt, t.currency))
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
