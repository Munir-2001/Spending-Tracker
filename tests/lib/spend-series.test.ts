import { describe, it, expect } from "vitest";

import { spendSeries } from "@/lib/compute";
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

describe("spendSeries", () => {
  it("buckets by day, contiguous from first to last spend, income excluded", () => {
    const s = spendSeries(
      [
        tx({ amount: -1000, date: "2026-07-01" }),
        tx({ amount: -500, date: "2026-07-01" }),
        tx({ amount: 2000, date: "2026-07-02" }), // income → no spend
        tx({ amount: -300, date: "2026-07-03" }),
      ],
      fx,
      "day"
    );
    expect(s.map((b) => b.key)).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"]);
    expect(s.map((b) => b.spend)).toEqual([1500, 0, 300]);
  });

  it("buckets by month, filling empty months in between", () => {
    const s = spendSeries(
      [tx({ amount: -1000, date: "2026-06-15" }), tx({ amount: -2000, date: "2026-08-10" })],
      fx,
      "month"
    );
    expect(s.map((b) => b.key)).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(s.map((b) => b.spend)).toEqual([1000, 0, 2000]);
    expect(s[0].start).toBe("2026-06-01");
    expect(s[0].end).toBe("2026-06-30");
  });

  it("excludes transfers/repayments and nets the owed portion", () => {
    const s = spendSeries(
      [
        tx({ amount: -1000, date: "2026-07-01" }),
        tx({ amount: -5000, date: "2026-07-01", isTransfer: true }),
        tx({
          amount: -1000,
          date: "2026-07-01",
          reimbursement: { person: "A", amount: 600, note: "", settled: false, settledAt: null },
        }),
      ],
      fx,
      "day"
    );
    // 1000 spend + (1000 − 600 owed) = 1400; transfer ignored.
    expect(s).toHaveLength(1);
    expect(s[0].spend).toBe(1400);
  });

  it("returns [] when there is no spending", () => {
    expect(spendSeries([], fx, "day")).toEqual([]);
    expect(spendSeries([tx({ amount: 5000, date: "2026-07-01" })], fx, "day")).toEqual([]);
  });
});
