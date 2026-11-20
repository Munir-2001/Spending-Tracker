import { describe, it, expect } from "vitest";

import { makeFx } from "@/lib/currency";
import { exchangeQuote, marketGap } from "@/lib/exchange";

// Market: 1 EUR = 300 PKR.
const fx = makeFx("EUR", { USD: 1, EUR: 1.08, PKR: 0.0036 });

describe("exchangeQuote", () => {
  it("reads PKR → EUR as rupees per euro", () => {
    // Sent ₨92,700 (0 decimals), received €300.00.
    expect(exchangeQuote(92700, "PKR", 30000, "EUR")).toEqual({
      base: "EUR",
      quote: "PKR",
      rate: 309,
    });
  });

  it("reads EUR → PKR the same way round", () => {
    const q = exchangeQuote(30000, "EUR", 92700, "PKR");
    expect(q?.base).toBe("EUR");
    expect(q?.quote).toBe("PKR");
    expect(q?.rate).toBeCloseTo(309, 9);
  });

  it("returns null when either side is empty", () => {
    expect(exchangeQuote(0, "PKR", 30000, "EUR")).toBeNull();
    expect(exchangeQuote(92700, "PKR", 0, "EUR")).toBeNull();
  });
});

describe("marketGap", () => {
  it("is negative when less arrived than at market", () => {
    // ₨92,700 at market = €309.00; only €300 arrived → €9 less.
    expect(marketGap(92700, "PKR", 30000, "EUR", fx)).toBe(-900);
  });

  it("is positive when more arrived than at market", () => {
    expect(marketGap(90000, "PKR", 31000, "EUR", fx)).toBe(1000);
  });

  it("ignores negligible differences", () => {
    // €300.50 vs €300.00 at market (≈0.17%).
    expect(marketGap(90000, "PKR", 30050, "EUR", fx)).toBe(0);
  });
});
