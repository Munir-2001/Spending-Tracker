import { describe, it, expect } from "vitest";

import { rangeFlowsBase, flowsOf } from "@/lib/compute";
import { makeFx, DEFAULT_RATES } from "@/lib/currency";
import type { Transaction } from "@/lib/data";

const fx = makeFx("USD", DEFAULT_RATES);

let n = 0;
function tx(o: Partial<Transaction> & { amount: number; date: string }): Transaction {
  return {
    id: `t${++n}`,
    date: o.date,
    merchant: o.merchant ?? "M",
    categoryId: o.categoryId ?? "c1",
    accountId: o.accountId ?? "a1",
    amount: o.amount,
    currency: o.currency ?? "USD",
    isTransfer: o.isTransfer,
    isReimbursement: o.isReimbursement,
    reimbursement: o.reimbursement,
  };
}

const txns: Transaction[] = [
  tx({ amount: -1000, date: "2026-06-15" }), // before window
  tx({ amount: -2000, date: "2026-07-01" }), // on lower bound (inclusive)
  tx({ amount: -3000, date: "2026-07-15" }),
  tx({ amount: 5000, date: "2026-07-20" }), // income
  tx({ amount: -4000, date: "2026-07-31" }), // on upper bound (inclusive)
  tx({ amount: -9999, date: "2026-08-02" }), // after window
];

describe("rangeFlowsBase", () => {
  it("includes both endpoints of the range", () => {
    const r = rangeFlowsBase(txns, "2026-07-01", "2026-07-31", fx);
    // -2000 -3000 -4000 spend, +5000 income
    expect(r.expense).toBe(-9000);
    expect(r.income).toBe(5000);
    expect(r.net).toBe(-4000);
  });

  it("open-ended lower bound (from=null) counts everything up to `to`", () => {
    const r = rangeFlowsBase(txns, null, "2026-07-31", fx);
    expect(r.expense).toBe(-10000); // includes the -1000 June txn
  });

  it("open-ended upper bound (to=null) counts everything from `from`", () => {
    const r = rangeFlowsBase(txns, "2026-08-01", null, fx);
    expect(r.expense).toBe(-9999);
    expect(r.income).toBe(0);
  });

  it("null/null = the whole set", () => {
    const all = rangeFlowsBase(txns, null, null, fx);
    expect(all).toEqual(flowsOf(txns, fx));
  });
});

describe("flowsOf true-spending semantics", () => {
  it("excludes transfers and reimbursement settlements", () => {
    const set = [
      tx({ amount: -1000, date: "2026-07-10" }),
      tx({ amount: -5000, date: "2026-07-11", isTransfer: true }), // moved money
      tx({ amount: 800, date: "2026-07-12", isReimbursement: true }), // repayment
    ];
    const r = flowsOf(set, fx);
    expect(r.expense).toBe(-1000);
    expect(r.income).toBe(0);
  });

  it("nets the owed portion of a reimbursable expense out of spend", () => {
    const set = [
      tx({
        amount: -1000,
        date: "2026-07-10",
        reimbursement: { person: "Ali", amount: 600, note: "", settled: false, settledAt: null },
      }),
    ];
    // $10 paid, $6 owed back → $4 is your real spend.
    expect(flowsOf(set, fx).expense).toBe(-400);
  });
});
