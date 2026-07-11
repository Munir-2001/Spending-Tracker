import { describe, it, expect } from "vitest";

import { wrappedStats } from "@/lib/compute";
import { makeFx, DEFAULT_RATES } from "@/lib/currency";
import type { Category, Transaction } from "@/lib/data";

const fx = makeFx("USD", DEFAULT_RATES);

const categories: Category[] = [
  { id: "c_groc", label: "Groceries", kind: "expense", tint: "#0a0", parentId: null },
  { id: "c_meat", label: "Meat", kind: "expense", tint: "#a00", parentId: "c_groc" },
  { id: "c_dine", label: "Dining", kind: "expense", tint: "#00a", parentId: null },
  { id: "c_inc", label: "Income", kind: "income", tint: "#0aa", parentId: null },
];

let n = 0;
function tx(o: {
  amount: number;
  date: string;
  categoryId?: string;
  merchant?: string;
  currency?: string;
  isTransfer?: boolean;
  isReimbursement?: boolean;
}): Transaction {
  return {
    id: `t${++n}`,
    date: o.date,
    merchant: o.merchant ?? "Merchant",
    categoryId: o.categoryId ?? "c_groc",
    accountId: "a1",
    amount: o.amount,
    currency: o.currency ?? "USD",
    isTransfer: o.isTransfer,
    isReimbursement: o.isReimbursement,
  };
}

const txns: Transaction[] = [
  tx({ amount: -5000, date: "2026-07-03", categoryId: "c_groc", merchant: "Aldi" }),
  tx({ amount: -5000, date: "2026-07-03", categoryId: "c_meat", merchant: "Butcher" }),
  tx({ amount: -9000, date: "2026-07-10", categoryId: "c_dine", merchant: "Restaurant" }),
  tx({ amount: 100000, date: "2026-07-01", categoryId: "c_inc", merchant: "Salary" }),
  // excluded: transfer, reimbursement, and a different month
  tx({ amount: -2000, date: "2026-07-05", merchant: "Move", isTransfer: true }),
  tx({ amount: 1000, date: "2026-07-06", merchant: "Refund", isReimbursement: true }),
  tx({ amount: -1000, date: "2026-06-15", categoryId: "c_groc", merchant: "Aldi" }),
];

describe("wrappedStats (monthly recap)", () => {
  const s = wrappedStats(txns, categories, fx, 2026, 6); // July (0-based)

  it("scopes to the month and excludes transfers/reimbursements", () => {
    expect(s.hasData).toBe(true);
    expect(s.label).toBe("July");
    expect(s.month).toBe(6);
    expect(s.txnCount).toBe(4); // 3 expenses + salary; transfer/reimb/June dropped
  });

  it("sums spend and income in the base currency", () => {
    expect(s.totalSpent).toBe(19000);
    expect(s.totalIncome).toBe(100000);
    expect(s.net).toBe(81000);
    expect(s.savingsRate).toBeCloseTo(0.81, 5);
  });

  it("rolls sub-categories into their parent and ranks them", () => {
    // Meat (5000) folds into Groceries (5000) = 10000, ahead of Dining (9000).
    expect(s.topCategories[0]).toMatchObject({ label: "Groceries", amount: 10000 });
    expect(s.topCategories[1]).toMatchObject({ label: "Dining", amount: 9000 });
    expect(s.topCategories[0].share).toBeCloseTo(10000 / 19000, 5);
  });

  it("finds the single biggest splurge", () => {
    expect(s.biggestSplurge).toMatchObject({
      merchant: "Restaurant",
      amount: 9000,
      date: "2026-07-10",
    });
  });

  it("finds the heaviest day by total spend (not single txn)", () => {
    // Jul 3 has two 5000 charges (10000) — beats Jul 10's single 9000.
    expect(s.busiestDay).toMatchObject({ date: "2026-07-03", amount: 10000 });
  });

  it("omits a top merchant when nothing repeats within the month", () => {
    expect(s.topMerchant).toBeNull();
  });

  it("reports an empty month cleanly", () => {
    const jan = wrappedStats(txns, categories, fx, 2026, 0);
    expect(jan.hasData).toBe(false);
    expect(jan.totalSpent).toBe(0);
    expect(jan.txnCount).toBe(0);
  });

  it("surfaces a repeated merchant", () => {
    const withRepeat = [
      ...txns,
      tx({ amount: -1500, date: "2026-07-20", categoryId: "c_groc", merchant: "Aldi" }),
    ];
    const r = wrappedStats(withRepeat, categories, fx, 2026, 6);
    expect(r.topMerchant).toMatchObject({ merchant: "Aldi", count: 2 });
  });
});
