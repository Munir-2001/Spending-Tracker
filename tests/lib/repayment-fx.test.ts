import { describe, it, expect } from "vitest";

import { pendingReceivablesBase } from "@/lib/compute";
import { makeFx } from "@/lib/currency";
import type { Transaction } from "@/lib/data";
import {
  claimRemaining,
  coveredBy,
  impliedRate,
  isRateInverted,
  marketRate,
  receivedFor,
  repaymentsByClaim,
  settlesClaim,
} from "@/lib/reimbursement";

// 1 EUR = 300 PKR at "market" (USD per unit: EUR 1.08, PKR 0.0036).
const fx = makeFx("EUR", { USD: 1, EUR: 1.08, PKR: 0.0036 });

// You sent a friend ₨92,700 to buy euros on your behalf (PKR has 0 decimals).
const claim: Transaction = {
  id: "c1",
  date: "2026-10-27",
  merchant: "Sent to Mudassir for euro transfer",
  categoryId: "",
  accountId: "meezan",
  amount: -92700,
  currency: "PKR",
  reimbursement: { person: "Mudassir", amount: 92700, note: "", settled: false, settledAt: null },
};

const repay = (over: Partial<Transaction>): Transaction => ({
  id: "r1",
  date: "2026-10-28",
  merchant: "Repayment",
  categoryId: "",
  accountId: "revolut",
  amount: 30000, // €300.00
  currency: "EUR",
  isReimbursement: true,
  settlesId: "c1",
  ...over,
});

describe("marketRate", () => {
  it("is 1 for the same currency", () => {
    expect(marketRate(fx, "PKR", "PKR")).toBe(1);
  });

  it("gives PKR per EUR from the USD-per-unit table", () => {
    expect(marketRate(fx, "EUR", "PKR")).toBeCloseTo(300, 6);
  });

  it("keeps tiny reverse rates instead of rounding them to zero", () => {
    expect(marketRate(fx, "PKR", "EUR")).toBeCloseTo(1 / 300, 9);
  });
});

describe("coveredBy", () => {
  it("covers the face amount in the same currency", () => {
    expect(coveredBy(repay({ currency: "PKR", amount: 50000 }), "PKR", fx)).toBe(50000);
  });

  it("uses the stored exchange rate across currencies", () => {
    expect(coveredBy(repay({ fxRate: 309 }), "PKR", fx)).toBe(92700);
  });

  it("falls back to the market rate when no rate was stored", () => {
    expect(coveredBy(repay({ fxRate: null }), "PKR", fx)).toBe(90000);
  });
});

describe("receivedFor / impliedRate", () => {
  it("works out the euros needed to cover the claim at a rate", () => {
    expect(receivedFor(92700, "PKR", 309, "EUR")).toBe(30000);
  });

  it("derives the rate from what actually arrived", () => {
    expect(impliedRate(92700, "PKR", 30000, "EUR")).toBeCloseTo(309, 9);
  });

  it("returns null when nothing was received", () => {
    expect(impliedRate(92700, "PKR", 0, "EUR")).toBeNull();
  });

  it("returns 0 received for a non-positive rate", () => {
    expect(receivedFor(92700, "PKR", 0, "EUR")).toBe(0);
  });
});

describe("claimRemaining", () => {
  it("is the full amount with no repayments", () => {
    expect(claimRemaining(claim, [], fx)).toBe(92700);
  });

  it("subtracts a partial repayment at its own rate", () => {
    // €200 at 300 = ₨60,000 → ₨32,700 still owed.
    const part = repay({ amount: 20000, fxRate: 300 });
    expect(claimRemaining(claim, [part], fx)).toBe(32700);
  });

  it("never goes negative when overpaid", () => {
    expect(claimRemaining(claim, [repay({ fxRate: 400 })], fx)).toBe(0);
  });

  it("is zero once the claim is settled", () => {
    const settled = { ...claim, reimbursement: { ...claim.reimbursement!, settled: true, settledAt: "x" } };
    expect(claimRemaining(settled, [], fx)).toBe(0);
  });
});

describe("settlesClaim", () => {
  it("settles when the payment covers what is left", () => {
    expect(settlesClaim(92700, 92700)).toBe(true);
  });

  it("tolerates small rate/rounding gaps", () => {
    expect(settlesClaim(91000, 92700)).toBe(true);
  });

  it("does not settle a clearly partial payment", () => {
    expect(settlesClaim(60000, 92700)).toBe(false);
  });
});

describe("isRateInverted", () => {
  it("shows PKR per EUR directly", () => {
    expect(isRateInverted(fx, "EUR", "PKR")).toBe(false);
  });

  it("flips when a PKR repayment settles a EUR claim", () => {
    expect(isRateInverted(fx, "PKR", "EUR")).toBe(true);
  });
});

describe("pendingReceivablesBase with partial repayments", () => {
  it("counts only what is still owed on a part-repaid claim", () => {
    const part = repay({ amount: 20000, fxRate: 300 }); // covers ₨60,000
    // ₨32,700 left → €109.00 at market.
    expect(pendingReceivablesBase([claim, part], fx)).toBe(10900);
  });

  it("groups repayments by the claim they settle", () => {
    const map = repaymentsByClaim([claim, repay({}), repay({ id: "r2", settlesId: "other" })]);
    expect(map.get("c1")?.length).toBe(1);
    expect(map.get("other")?.length).toBe(1);
  });
});
