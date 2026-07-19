import { describe, it, expect } from "vitest";

import { goldPL, lotPL, weightedAvgCostPerGram } from "@/lib/compute";
import { makeFx, DEFAULT_RATES, toMinorUnits } from "@/lib/currency";
import { gramsOf, goldValueMajor, GRAMS_PER_UNIT } from "@/lib/gold";
import type { Asset, AssetLot } from "@/lib/data";

const fx = makeFx("USD", DEFAULT_RATES);
const USD_GRAM = 85; // per-gram 24k spot, USD
const PKR_RATE = DEFAULT_RATES.PKR; // USD value of 1 PKR

// Per-gram 24k price in PKR, derived from the USD spot the way refreshGoldPrices does.
const gramPkr = (USD_GRAM * (DEFAULT_RATES.USD ?? 1)) / PKR_RATE;

let n = 0;
function lot(
  o: Partial<AssetLot> & { quantity: number; goldCost: number }
): AssetLot {
  const commission = o.commission ?? 0;
  const tax = o.tax ?? 0;
  return {
    id: `l${++n}`,
    assetId: "gold1",
    date: o.date ?? "2025-01-01",
    quantity: o.quantity,
    unit: o.unit ?? "tola",
    karat: o.karat ?? 24,
    goldCost: o.goldCost,
    commission,
    tax,
    costBasis: o.costBasis ?? o.goldCost + commission + tax,
    currency: o.currency ?? "PKR",
    purchaseFxRate: o.purchaseFxRate === undefined ? PKR_RATE : o.purchaseFxRate,
    note: null,
  };
}

/** Live PKR value the way the refresh action computes it (sum per lot). */
function liveValuePkr(lots: AssetLot[]): number {
  return lots.reduce(
    (s, l) => s + toMinorUnits(goldValueMajor(l.quantity, l.unit, l.karat, gramPkr), "PKR"),
    0
  );
}

function goldAsset(lots: AssetLot[], value: number): Asset {
  const grams = lots.reduce((s, l) => s + gramsOf(l.quantity, l.unit), 0);
  return {
    id: "gold1",
    name: "Gold",
    type: "gold",
    value,
    currency: "PKR",
    note: null,
    symbol: "XAU",
    quantity: grams / GRAMS_PER_UNIT.tola,
    unit: "tola",
    karat: lots[lots.length - 1]?.karat ?? 24,
    costBasis: lots.reduce((s, l) => s + l.costBasis, 0),
  };
}

describe("weightedAvgCostPerGram", () => {
  it("averages across mixed units (1 tola == 11.6638038 g)", () => {
    const lots = [
      lot({ quantity: 1, unit: "tola", goldCost: 100_000 }),
      lot({ quantity: GRAMS_PER_UNIT.tola, unit: "gram", goldCost: 100_000 }),
    ];
    // Same grams each, total cost 200,000 over 2 tola of grams.
    expect(weightedAvgCostPerGram(lots)).toBeCloseTo(
      200_000 / (2 * GRAMS_PER_UNIT.tola),
      6
    );
  });

  it("is 0 with no grams", () => {
    expect(weightedAvgCostPerGram([])).toBe(0);
  });
});

describe("lotPL", () => {
  it("values a lot at the current gram price and nets cost basis", () => {
    const l = lot({ quantity: 1, unit: "tola", goldCost: 100_000 });
    const { value, pl, plPct } = lotPL(l, gramPkr);
    const expected = toMinorUnits(goldValueMajor(1, "tola", 24, gramPkr), "PKR");
    expect(value).toBe(expected);
    expect(pl).toBe(expected - 100_000);
    expect(plPct).toBeCloseTo(((expected - 100_000) / 100_000) * 100, 6);
  });
});

describe("goldPL", () => {
  it("native P/L is market value minus cost basis; making charge from split", () => {
    const lots = [lot({ quantity: 1, goldCost: 100_000, commission: 8_000, tax: 2_000 })];
    const value = liveValuePkr(lots);
    const g = goldPL(goldAsset(lots, value), lots, fx, USD_GRAM);
    expect(g.native.value).toBe(value);
    expect(g.native.cost).toBe(110_000);
    expect(g.native.pl).toBe(value - 110_000);
    expect(g.makingChargePct).toBeCloseTo(10, 6); // 10,000 fees over 100,000 metal
  });

  it("USD value from the spot matches the PKR value converted, within rounding", () => {
    const lots = [lot({ quantity: 1, goldCost: 100_000 })];
    const value = liveValuePkr(lots);
    const g = goldPL(goldAsset(lots, value), lots, fx, USD_GRAM);
    const usdFromNative = fx.convert(value, "PKR", "USD");
    expect(Math.abs(g.usd.value - usdFromNative)).toBeLessThan(200); // < $2 rounding
  });

  it("sums mixed-karat lots (USD value = Σ per-lot value)", () => {
    const mixed = [
      lot({ quantity: 1, karat: 24, goldCost: 100_000 }),
      lot({ quantity: 1, karat: 22, goldCost: 90_000 }),
    ];
    const value = liveValuePkr(mixed);
    const g = goldPL(goldAsset(mixed, value), mixed, fx, USD_GRAM);
    const usdSum = mixed.reduce(
      (s, l) => s + toMinorUnits(goldValueMajor(l.quantity, l.unit, l.karat, USD_GRAM), "USD"),
      0
    );
    expect(g.usd.value).toBe(usdSum);
  });

  it("falls back to fx conversion when the USD spot is missing", () => {
    const lots = [lot({ quantity: 1, goldCost: 100_000 })];
    const value = liveValuePkr(lots);
    const asset = goldAsset(lots, value);
    const g = goldPL(asset, lots, fx, null);
    expect(g.usd.value).toBe(fx.convert(asset.value, "PKR", "USD"));
  });

  it("falls back to fx conversion for cost when a lot has no pinned purchase rate", () => {
    const lots = [
      lot({ quantity: 1, goldCost: 100_000, commission: 10_000, purchaseFxRate: null }),
    ];
    const value = liveValuePkr(lots);
    const g = goldPL(goldAsset(lots, value), lots, fx, USD_GRAM);
    expect(g.usd.cost).toBe(fx.convert(110_000, "PKR", "USD"));
  });

  it("single lot equals the legacy value − cost basis, and guards zero cost", () => {
    const lots = [lot({ quantity: 1, goldCost: 100_000 })];
    const value = liveValuePkr(lots);
    const g = goldPL(goldAsset(lots, value), lots, fx, USD_GRAM);
    expect(g.native.pl).toBe(value - 100_000);

    const empty = goldPL(
      { ...goldAsset([], 0), costBasis: 0, quantity: 0 },
      [],
      fx,
      USD_GRAM
    );
    expect(empty.native.plPct).toBeNull();
  });
});
