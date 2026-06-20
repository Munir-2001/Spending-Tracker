/**
 * Double-entry bookkeeping core.
 *
 * Every transaction the user sees as a single line is, under the hood, a
 * balanced journal entry: equal debits and credits. Lookups (accounts,
 * categories) are passed in so this stays pure and free of data-source coupling.
 *
 * Normal-balance rules:
 *   Assets, Expenses    → increase with a DEBIT
 *   Liabilities, Income → increase with a CREDIT
 */

import type { Account, Category, Transaction } from "@/lib/data";
import type { Fx } from "@/lib/currency";

export type AccountClass = "Asset" | "Liability" | "Income" | "Expense";

export type JournalLine = {
  account: string;
  classification: AccountClass;
  debit: number; // minor units of `currency`
  credit: number;
  currency: string;
};

export type JournalEntry = {
  id: string;
  date: string;
  memo: string;
  currency: string;
  lines: JournalLine[];
};

export type LedgerLookups = {
  accounts: Map<string, Account>;
  categories: Map<string, Category>;
};

export function toJournalEntry(
  t: Transaction,
  { accounts, categories }: LedgerLookups
): JournalEntry {
  const amount = Math.abs(t.amount);
  const acc = accounts.get(t.accountId);
  const isIncome = t.amount > 0;
  const cur = t.currency;

  const moneyLabel = acc
    ? `${acc.name}${acc.institution ? ` (${acc.institution})` : ""}`
    : "Unknown account";
  const moneyClass: AccountClass = acc?.type === "liability" ? "Liability" : "Asset";
  const moneyLine = (debit: number, credit: number): JournalLine => ({
    account: moneyLabel,
    classification: moneyClass,
    debit,
    credit,
    currency: cur,
  });

  const catLine = (
    categoryId: string,
    debit: number,
    credit: number
  ): JournalLine => {
    const cat = categories.get(categoryId);
    return {
      account: isIncome
        ? cat?.label ?? "Income"
        : `${cat?.label ?? "Uncategorized"} expense`,
      classification: isIncome ? "Income" : "Expense",
      debit,
      credit,
      currency: cur,
    };
  };

  // One category line per item (split), or a single line for a simple txn.
  const parts =
    t.items && t.items.length
      ? t.items.map((i) => ({ categoryId: i.categoryId, amount: Math.abs(i.amount) }))
      : [{ categoryId: t.categoryId, amount }];

  const lines: JournalLine[] = isIncome
    ? [moneyLine(amount, 0), ...parts.map((p) => catLine(p.categoryId, 0, p.amount))]
    : [...parts.map((p) => catLine(p.categoryId, p.amount, 0)), moneyLine(0, amount)];

  return { id: t.id, date: t.date, memo: t.merchant, currency: cur, lines };
}

export function journalFrom(
  transactions: Transaction[],
  lookups: LedgerLookups
): JournalEntry[] {
  return transactions.map((t) => toJournalEntry(t, lookups));
}

/**
 * Totals across entries, rolled up to the base currency. Each entry balances
 * natively by construction, so we report the base-currency volume and confirm
 * every entry's debits equal its credits.
 */
export function journalTotals(
  entries: JournalEntry[],
  fx: Fx
): {
  debit: number; // base-currency minor units
  credit: number;
  balanced: boolean;
} {
  let debit = 0;
  let credit = 0;
  let balanced = true;

  for (const e of entries) {
    let entryDebit = 0;
    let entryCredit = 0;
    for (const l of e.lines) {
      entryDebit += l.debit;
      entryCredit += l.credit;
      debit += fx.toBase(l.debit, l.currency);
      credit += fx.toBase(l.credit, l.currency);
    }
    if (entryDebit !== entryCredit) balanced = false;
  }

  return { debit, credit, balanced };
}

export const CLASS_TINT: Record<AccountClass, string> = {
  Asset: "oklch(0.6 0.11 280)",
  Liability: "oklch(0.62 0.13 28)",
  Income: "var(--income)",
  Expense: "oklch(0.66 0.14 50)",
};
