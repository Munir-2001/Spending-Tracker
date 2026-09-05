import { describe, it, expect } from "vitest";

import { flowsOf, rangeFlowsBase } from "@/lib/compute";
import { makeFx, DEFAULT_RATES } from "@/lib/currency";
import type { Transaction } from "@/lib/data";

const fx = makeFx("USD", DEFAULT_RATES);

let n = 0;
function tx(o: Partial<Transaction> & { amount: number; date: string }): Transaction {
  return {
    id: `t${++n}`,
    date: o.date,
    merchant: o.merchant ?? "M",
    categoryId: "c1",
    accountId: "a1",
    amount: o.amount,
    currency: "USD",
    notIncome: o.notIncome,
  };
}

describe("notIncome flag", () => {
  it("excludes a flagged inflow from income (but keeps real income + expense)", () => {
    const r = flowsOf(
      [
        tx({ amount: 5000, date: "2026-07-01" }), // real income
        tx({ amount: 4000, date: "2026-07-02", notIncome: true }), // refund/gift
        tx({ amount: -1000, date: "2026-07-03" }), // expense
      ],
      fx
    );
    expect(r.income).toBe(5000); // the 4000 refund is excluded
    expect(r.expense).toBe(-1000);
    expect(r.net).toBe(4000);
  });

  it("is honored through rangeFlowsBase", () => {
    const r = rangeFlowsBase(
      [
        tx({ amount: 2000, date: "2026-07-10", notIncome: true }),
        tx({ amount: 3000, date: "2026-07-10" }),
      ],
      "2026-07-01",
      "2026-07-31",
      fx
    );
    expect(r.income).toBe(3000);
  });
});
