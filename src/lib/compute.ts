/**
 * Live aggregations over the user's accounts and transactions, rolled up to the
 * base currency via FX rates. Pure functions — fed by the provider's state.
 */

import type {
  Account,
  Asset,
  AssetLot,
  Category,
  RecurringRule,
  Transaction,
} from "@/lib/data";
import type { Fx } from "@/lib/currency";
import { toMinorUnits, toMajorUnits } from "@/lib/currency";
import { gramsOf, goldValueMajor, makingChargePct } from "@/lib/gold";

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

// ── Gold cost-basis & P/L ────────────────────────────────────────────────────

/** Weighted-average cost per gram across lots, in minor units of their currency. */
export function weightedAvgCostPerGram(lots: AssetLot[]): number {
  const grams = lots.reduce((s, l) => s + gramsOf(l.quantity, l.unit ?? "tola"), 0);
  if (!grams) return 0;
  const cost = lots.reduce((s, l) => s + l.costBasis, 0);
  return cost / grams;
}

/**
 * Profit/loss of a single lot given the current per-gram 24k price in the lot's
 * currency (major units). `value`/`pl` are minor units of the lot currency.
 */
export function lotPL(
  lot: AssetLot,
  gramPrice: number
): { value: number; pl: number; plPct: number | null } {
  const value = toMinorUnits(
    goldValueMajor(lot.quantity, lot.unit ?? "tola", lot.karat, gramPrice),
    lot.currency
  );
  const pl = value - lot.costBasis;
  return { value, pl, plPct: lot.costBasis ? (pl / lot.costBasis) * 100 : null };
}

type PLSide = { value: number; cost: number; pl: number; plPct: number | null };

export type GoldPL = {
  native: PLSide; // in the asset's own currency (e.g. PKR)
  usd: PLSide; // benchmarked in USD
  makingChargePct: number; // premium paid over spot metal cost
  avgCostPerGram: number; // minor units of native currency per gram
};

const side = (value: number, cost: number): PLSide => ({
  value,
  cost,
  pl: value - cost,
  plPct: cost ? ((value - cost) / cost) * 100 : null,
});

/**
 * Dual-currency P/L for a gold holding. Native P/L uses the live market `value`
 * vs. cost basis. USD value comes from the raw USD spot (`usdGram`, per-gram 24k)
 * when available — exact, no round-trip; USD cost is pinned at each lot's
 * purchase FX rate so the USD figure reflects gold movement, not currency drift.
 * Falls back to `fx` conversion when the spot / purchase rate is missing.
 */
export function goldPL(
  asset: Asset,
  lots: AssetLot[],
  fx: Fx,
  usdGram: number | null
): GoldPL {
  const nativeCost = asset.costBasis ?? 0;

  // USD value: exact from the USD spot, else convert the native market value.
  let usdValue: number;
  if (usdGram != null && lots.length > 0) {
    usdValue = lots.reduce(
      (s, l) => s + toMinorUnits(goldValueMajor(l.quantity, l.unit ?? "tola", l.karat, usdGram), "USD"),
      0
    );
  } else if (usdGram != null && asset.quantity != null && asset.unit) {
    usdValue = toMinorUnits(
      goldValueMajor(asset.quantity, asset.unit, asset.karat, usdGram),
      "USD"
    );
  } else {
    usdValue = fx.convert(asset.value, asset.currency, "USD");
  }

  // USD cost: pinned at each lot's purchase FX rate (USD value of 1 unit paid).
  const usdCost =
    lots.length > 0
      ? lots.reduce(
          (s, l) =>
            s +
            (l.purchaseFxRate != null
              ? toMinorUnits(toMajorUnits(l.costBasis, l.currency) * l.purchaseFxRate, "USD")
              : fx.convert(l.costBasis, l.currency, "USD")),
          0
        )
      : fx.convert(nativeCost, asset.currency, "USD");

  const goldCost = lots.reduce((s, l) => s + l.goldCost, 0);
  const commission = lots.reduce((s, l) => s + l.commission, 0);
  const tax = lots.reduce((s, l) => s + l.tax, 0);

  return {
    native: side(asset.value, nativeCost),
    usd: side(usdValue, usdCost),
    makingChargePct: makingChargePct(commission, tax, goldCost),
    avgCostPerGram: weightedAvgCostPerGram(lots),
  };
}

// ── Crypto cost-basis & P/L ──────────────────────────────────────────────────

/** P/L of a single crypto lot given the current coin price in the lot's currency. */
export function cryptoLotPL(
  lot: AssetLot,
  coinPrice: number
): { value: number; pl: number; plPct: number | null } {
  const value = toMinorUnits(lot.quantity * coinPrice, lot.currency);
  const pl = value - lot.costBasis;
  return { value, pl, plPct: lot.costBasis ? (pl / lot.costBasis) * 100 : null };
}

export type CryptoPL = {
  native: PLSide;
  usd: PLSide;
  feePct: number; // exchange/network fees as a % of coin cost
  avgCostPerUnit: number; // minor units of native currency per coin
};

/**
 * Dual-currency P/L for a crypto holding. Same shape as {@link goldPL} but the
 * value is `quantity × price` (no grams/karat). USD cost is pinned at each lot's
 * purchase FX rate so USD P/L reflects coin movement, not currency drift.
 */
export function cryptoPL(asset: Asset, lots: AssetLot[], fx: Fx): CryptoPL {
  const nativeCost = asset.costBasis ?? 0;
  const usdValue = fx.convert(asset.value, asset.currency, "USD");
  const usdCost =
    lots.length > 0
      ? lots.reduce(
          (s, l) =>
            s +
            (l.purchaseFxRate != null
              ? toMinorUnits(toMajorUnits(l.costBasis, l.currency) * l.purchaseFxRate, "USD")
              : fx.convert(l.costBasis, l.currency, "USD")),
          0
        )
      : fx.convert(nativeCost, asset.currency, "USD");

  const coinCost = lots.reduce((s, l) => s + l.goldCost, 0);
  const commission = lots.reduce((s, l) => s + l.commission, 0);
  const tax = lots.reduce((s, l) => s + l.tax, 0);
  const totalQty = lots.reduce((s, l) => s + l.quantity, 0);

  return {
    native: side(asset.value, nativeCost),
    usd: side(usdValue, usdCost),
    feePct: makingChargePct(commission, tax, coinCost),
    avgCostPerUnit: totalQty ? nativeCost / totalQty : 0,
  };
}

export type NetWorthSlice = {
  id: string;
  label: string;
  kind: "account" | "asset" | "receivable";
  value: number; // base-currency minor units (signed; neg = liability/overdraft)
};

/**
 * Every component of net worth as a base-currency slice: each non-group account
 * balance, each asset, and money owed to you. Sorted largest first.
 */
export function netWorthComposition(
  accounts: Account[],
  balanceOf: (id: string) => number,
  assets: Asset[],
  transactions: Transaction[],
  fx: Fx
): NetWorthSlice[] {
  const slices: NetWorthSlice[] = [];
  for (const a of accounts.filter((x) => !x.isGroup)) {
    const value = fx.toBase(balanceOf(a.id), a.currency);
    if (value !== 0)
      slices.push({ id: a.id, label: a.name, kind: "account", value });
  }
  for (const a of assets) {
    const value = fx.toBase(a.value, a.currency);
    if (value !== 0)
      slices.push({ id: a.id, label: a.name, kind: "asset", value });
  }
  const receivable = pendingReceivablesBase(transactions, fx);
  if (receivable > 0)
    slices.push({
      id: "receivables",
      label: "Owed to you",
      kind: "receivable",
      value: receivable,
    });
  return slices.sort((a, b) => b.value - a.value);
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

  const pad = (n: number) => String(n).padStart(2, "0");
  const points: NetWorthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const dt = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const y = dt.getFullYear();
    const m = dt.getMonth(); // 0-based
    // First day of the NEXT month (Date normalizes Dec→Jan), built from parts so
    // it never round-trips through UTC and shifts across a month boundary.
    const nx = new Date(y, m + 1, 1);
    const cutoff = `${nx.getFullYear()}-${pad(nx.getMonth() + 1)}-01`;
    let total = heldAssets;
    for (const a of leaves) {
      let bal = a.openingBalance;
      for (const t of txnsByAccount.get(a.id) ?? [])
        if (t.date < cutoff) bal += fx.convert(t.amount, t.currency, a.currency);
      total += fx.toBase(bal, a.currency);
    }
    // Label at mid-month ("-15") so a ±timezone offset can't roll it into the
    // previous month when formatMonth parses it.
    points.push({ month: `${y}-${pad(m + 1)}-15`, value: total });
  }
  return points;
}

/**
 * Active expense rules due within the next `days` (overdue ones included),
 * soonest first — the data behind "upcoming bills."
 */
export function upcomingBills(
  rules: RecurringRule[],
  anchor: Date,
  days = 14
): RecurringRule[] {
  const horizon = new Date(anchor);
  horizon.setDate(horizon.getDate() + days);
  const horizonIso = horizon.toISOString().slice(0, 10);
  return rules
    .filter((r) => r.active && r.amount < 0 && r.nextDate <= horizonIso)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
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

export type WrappedStats = {
  year: number;
  month: number; // 0-based
  label: string; // month name, e.g. "July"
  totalSpent: number; // base minor units
  totalIncome: number;
  net: number;
  txnCount: number;
  savingsRate: number | null; // 0..1, or null if no income
  topCategories: { label: string; tint: string; amount: number; share: number }[];
  biggestSplurge: { merchant: string; amount: number; date: string } | null;
  busiestDay: { date: string; amount: number } | null;
  topMerchant: { merchant: string; count: number } | null;
  hasData: boolean;
};

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Playful month-in-review aggregates (for "Money Wrapped"). Scoped to one
 * `year`/`month` (month is 0-based). Everything is rolled to base currency;
 * transfers and reimbursements are excluded, sub-categories fold into parents.
 */
export function wrappedStats(
  transactions: Transaction[],
  categories: Category[],
  fx: Fx,
  year: number,
  month: number
): WrappedStats {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const rows = transactions.filter(
    (t) => !t.isTransfer && !t.isReimbursement && t.date.startsWith(prefix)
  );

  let totalSpent = 0;
  let totalIncome = 0;
  const byCat = new Map<string, number>();
  const byDay = new Map<string, number>();
  const merchantFreq = new Map<string, { merchant: string; count: number }>();
  let biggest: WrappedStats["biggestSplurge"] = null;

  for (const t of rows) {
    if (t.amount > 0) {
      totalIncome += fx.toBase(t.amount, t.currency);
      continue;
    }
    const spend = -fx.toBase(t.amount, t.currency); // positive
    if (spend <= 0) continue;
    totalSpent += spend;

    byDay.set(t.date, (byDay.get(t.date) ?? 0) + spend);

    if (!biggest || spend > biggest.amount)
      biggest = { merchant: t.merchant, amount: spend, date: t.date };

    const key = t.merchant.trim().toLowerCase();
    if (key) {
      const prev = merchantFreq.get(key);
      merchantFreq.set(key, {
        merchant: t.merchant.trim(),
        count: (prev?.count ?? 0) + 1,
      });
    }

    for (const line of categoryLinesOf(t)) {
      if (line.amount >= 0) continue;
      const rollId = rollupCategoryId(line.categoryId, byId);
      byCat.set(rollId, (byCat.get(rollId) ?? 0) + -fx.toBase(line.amount, t.currency));
    }
  }

  const topCategories = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, amount]) => ({
      label: byId.get(id)?.label ?? "Uncategorized",
      tint: byId.get(id)?.tint ?? "var(--muted-foreground)",
      amount,
      share: totalSpent > 0 ? amount / totalSpent : 0,
    }));

  let busiestDay: WrappedStats["busiestDay"] = null;
  for (const [date, amount] of byDay)
    if (!busiestDay || amount > busiestDay.amount) busiestDay = { date, amount };

  const topMerchant =
    [...merchantFreq.values()].sort((a, b) => b.count - a.count)[0] ?? null;

  return {
    year,
    month,
    label: MONTHS[month] ?? "",
    totalSpent,
    totalIncome,
    net: totalIncome - totalSpent,
    txnCount: rows.length,
    savingsRate:
      totalIncome > 0 ? Math.max(0, (totalIncome - totalSpent) / totalIncome) : null,
    topCategories,
    biggestSplurge: biggest,
    busiestDay,
    topMerchant: topMerchant && topMerchant.count > 1 ? topMerchant : null,
    hasData: rows.length > 0,
  };
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
  const pad = (n: number) => String(n).padStart(2, "0");
  const points: CashflowPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const dt = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const flows = monthFlowsBase(transactions, dt.getFullYear(), dt.getMonth(), fx);
    // Mid-month label so a ±timezone offset can't shift it a month back.
    points.push({
      month: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-15`,
      income: flows.income,
      expense: Math.abs(flows.expense),
    });
  }
  return points;
}
