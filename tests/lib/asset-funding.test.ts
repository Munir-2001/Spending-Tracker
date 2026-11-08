import { describe, it, expect } from "vitest";

import { fundingOutflow, isLotPriced } from "@/lib/asset-funding";
import { DEFAULT_RATES } from "@/lib/currency";

describe("fundingOutflow", () => {
  it("debits the full cost basis from a same-currency account", () => {
    // Arrange: 2 tola bought for ₨900,000 incl. making + tax, paid from Meezan (PKR).
    const lot = { costBasis: 900_000, currency: "PKR" };

    // Act
    const out = fundingOutflow(lot, "PKR", DEFAULT_RATES);

    // Assert
    expect(out).toEqual({ amount: -900_000, currency: "PKR" });
  });

  it("converts into the paying account's currency when they differ", () => {
    // €1,000.00 lot paid from a USD account at EUR=1.08 USD.
    const out = fundingOutflow({ costBasis: 100_000, currency: "EUR" }, "USD", DEFAULT_RATES);

    expect(out.currency).toBe("USD");
    expect(out.amount).toBe(-108_000);
  });

  it("is always an outflow, even for a zero-cost lot", () => {
    const out = fundingOutflow({ costBasis: 0, currency: "PKR" }, "PKR", DEFAULT_RATES);

    expect(out.amount).toBeLessThanOrEqual(0);
  });
});

describe("isLotPriced", () => {
  it("is true only for holdings valued from purchase lots", () => {
    expect(isLotPriced("gold")).toBe(true);
    expect(isLotPriced("crypto")).toBe(true);
    expect(isLotPriced("property")).toBe(false);
    expect(isLotPriced("cash")).toBe(false);
  });
});
