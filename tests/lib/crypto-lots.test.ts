import { describe, it, expect } from "vitest";

import { cryptoPL, cryptoLotPL } from "@/lib/compute";
import { makeFx, DEFAULT_RATES, toMinorUnits } from "@/lib/currency";
import type { Asset, AssetLot } from "@/lib/data";

const fx = makeFx("USD", DEFAULT_RATES);
const EUR = DEFAULT_RATES.EUR; // USD value of 1 EUR

let n = 0;
function lot(o: Partial<AssetLot> & { quantity: number; goldCost: number }): AssetLot {
  const commission = o.commission ?? 0;
  const tax = o.tax ?? 0;
  return {
    id: `l${++n}`,
    assetId: "eth",
    date: o.date ?? "2025-01-01",
    quantity: o.quantity,
    unit: null, // crypto has no metal unit
    karat: null,
    goldCost: o.goldCost, // coin cost paid, minor units
    commission,
    tax,
    costBasis: o.costBasis ?? o.goldCost + commission + tax,
    currency: o.currency ?? "EUR",
    purchaseFxRate: o.purchaseFxRate === undefined ? EUR : o.purchaseFxRate,
    note: null,
  };
}

function cryptoAsset(lots: AssetLot[], value: number): Asset {
  return {
    id: "eth",
    name: "Ethereum",
    type: "crypto",
    value,
    currency: "EUR",
    note: null,
    symbol: "ethereum",
    quantity: lots.reduce((s, l) => s + l.quantity, 0),
    unit: null,
    karat: null,
    costBasis: lots.reduce((s, l) => s + l.costBasis, 0),
  };
}

describe("cryptoLotPL", () => {
  it("values a lot at quantity × price", () => {
    const l = lot({ quantity: 2, goldCost: 300_000 }); // €3,000 for 2 coins
    const { value, pl, plPct } = cryptoLotPL(l, 2000); // €2,000 / coin now
    expect(value).toBe(toMinorUnits(2 * 2000, "EUR")); // €4,000
    expect(pl).toBe(value - 300_000);
    expect(plPct).toBeCloseTo(((value - 300_000) / 300_000) * 100, 6);
  });
});

describe("cryptoPL", () => {
  it("native P/L is value − cost; fee % and avg cost from the split", () => {
    const lots = [lot({ quantity: 2, goldCost: 290_000, commission: 10_000 })]; // cost €3,000
    const value = toMinorUnits(2 * 2000, "EUR"); // €4,000
    const g = cryptoPL(cryptoAsset(lots, value), lots, fx);
    expect(g.native.value).toBe(value);
    expect(g.native.cost).toBe(300_000);
    expect(g.native.pl).toBe(value - 300_000);
    expect(g.feePct).toBeCloseTo((10_000 / 290_000) * 100, 4);
    expect(g.avgCostPerUnit).toBeCloseTo(300_000 / 2, 4);
  });

  it("USD value ≈ native value converted at the current rate", () => {
    const lots = [lot({ quantity: 1, goldCost: 200_000 })];
    const value = toMinorUnits(2500, "EUR");
    const g = cryptoPL(cryptoAsset(lots, value), lots, fx);
    expect(Math.abs(g.usd.value - fx.convert(value, "EUR", "USD"))).toBeLessThan(5);
  });

  it("USD cost is pinned at the purchase FX rate, falling back to fx.convert", () => {
    const pinned = [lot({ quantity: 1, goldCost: 200_000, purchaseFxRate: EUR })];
    const g1 = cryptoPL(cryptoAsset(pinned, toMinorUnits(2500, "EUR")), pinned, fx);
    expect(g1.usd.cost).toBe(toMinorUnits(2000 * EUR, "USD"));

    const nullRate = [lot({ quantity: 1, goldCost: 200_000, purchaseFxRate: null })];
    const g2 = cryptoPL(cryptoAsset(nullRate, toMinorUnits(2500, "EUR")), nullRate, fx);
    expect(g2.usd.cost).toBe(fx.convert(200_000, "EUR", "USD"));
  });
});
