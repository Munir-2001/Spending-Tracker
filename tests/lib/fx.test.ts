import { describe, it, expect } from "vitest";

import { fxFromPerUsd, saneFxRate } from "@/lib/fx";

describe("fxFromPerUsd", () => {
  it("inverts open.er-api-style UPPERCASE per-USD rates to USD-per-unit", () => {
    const out = fxFromPerUsd({ EUR: 0.9, PKR: 280, GBP: 0.8 });
    expect(out.USD).toBe(1);
    expect(out.EUR).toBeCloseTo(1 / 0.9, 10);
    expect(out.PKR).toBeCloseTo(1 / 280, 10);
    expect(out.GBP).toBeCloseTo(1 / 0.8, 10);
  });

  it("accepts Fawaz-style lowercase keys unchanged (same fallback path)", () => {
    const out = fxFromPerUsd({ eur: 0.9, pkr: 280 });
    expect(out.EUR).toBeCloseTo(1 / 0.9, 10);
    expect(out.PKR).toBeCloseTo(1 / 280, 10);
  });

  it("coerces string-numeric rates", () => {
    expect(fxFromPerUsd({ EUR: "0.9" }).EUR).toBeCloseTo(1 / 0.9, 10);
  });

  it("drops garbage / out-of-range values instead of poisoning the map", () => {
    const out = fxFromPerUsd({
      EUR: 0.9,
      PKR: -1,
      GBP: "abc",
      JPY: 0,
      AED: Infinity,
    });
    expect(out.EUR).toBeCloseTo(1 / 0.9, 10);
    expect(out.PKR).toBeUndefined();
    expect(out.GBP).toBeUndefined();
    expect(out.JPY).toBeUndefined();
    expect(out.AED).toBeUndefined();
  });

  it("omits currencies the source didn't provide, but always sets USD=1", () => {
    const out = fxFromPerUsd({});
    expect(out.USD).toBe(1);
    expect(Object.keys(out)).toEqual(["USD"]);
  });
});

describe("saneFxRate", () => {
  it("accepts finite positive in-range numbers", () => {
    expect(saneFxRate(1.5)).toBe(1.5);
    expect(saneFxRate("278.5")).toBeCloseTo(278.5, 10);
  });
  it("rejects non-positive, non-finite, and absurd magnitudes", () => {
    expect(saneFxRate(0)).toBeNull();
    expect(saneFxRate(-2)).toBeNull();
    expect(saneFxRate("x")).toBeNull();
    expect(saneFxRate(Infinity)).toBeNull();
    expect(saneFxRate(1e12)).toBeNull(); // above MAX_FX_PER_USD
  });
});
