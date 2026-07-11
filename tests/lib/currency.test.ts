import { describe, it, expect } from "vitest";

import {
  toMinorUnits,
  toMajorUnits,
  convertWithRates,
  makeFx,
  DEFAULT_RATES,
} from "@/lib/currency";

describe("money units", () => {
  it("converts major → minor using each currency's decimals", () => {
    expect(toMinorUnits(5.5, "USD")).toBe(550);
    expect(toMinorUnits(19.99, "EUR")).toBe(1999);
    expect(toMinorUnits(100, "PKR")).toBe(100); // PKR has 0 decimals
  });

  it("always rounds to an integer number of minor units (never floats)", () => {
    const m = toMinorUnits(5.555, "USD");
    expect(m).toBe(556);
    expect(Number.isInteger(m)).toBe(true);
  });

  it("round-trips minor → major", () => {
    expect(toMajorUnits(550, "USD")).toBe(5.5);
    expect(toMajorUnits(100, "PKR")).toBe(100);
  });
});

describe("convertWithRates", () => {
  it("is identity for the same currency", () => {
    expect(convertWithRates(12345, "USD", "USD", DEFAULT_RATES)).toBe(12345);
  });

  it("converts through the USD numeraire", () => {
    // $100 → €(100 / 1.08) ≈ €92.59
    expect(convertWithRates(10000, "USD", "EUR", DEFAULT_RATES)).toBe(9259);
    // ₨100 (0-decimal) → $0.36
    expect(convertWithRates(100, "PKR", "USD", DEFAULT_RATES)).toBe(36);
  });

  it("makeFx.toBase rolls a foreign amount into the base currency", () => {
    const fx = makeFx("USD", DEFAULT_RATES);
    expect(fx.toBase(10000, "USD")).toBe(10000);
    expect(fx.toBase(100, "PKR")).toBe(36);
  });
});
