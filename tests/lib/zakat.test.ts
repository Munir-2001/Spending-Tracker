import { describe, it, expect } from "vitest";

import {
  zakatLines,
  zakatSummary,
  ZAKAT_RATE,
  NISAB_SILVER_GRAMS,
  type ZakatLine,
} from "@/lib/compute";
import { makeFx, DEFAULT_RATES } from "@/lib/currency";
import type { Account, Asset, Transaction } from "@/lib/data";

const fx = makeFx("USD", DEFAULT_RATES);

function acc(o: Partial<Account> & { id: string }): Account {
  return {
    id: o.id,
    name: o.name ?? o.id,
    institution: null,
    accountNumber: null,
    swift: null,
    iban: null,
    branch: null,
    type: o.type ?? "asset",
    subtype: o.subtype ?? "checking",
    currency: o.currency ?? "USD",
    parentId: o.parentId ?? null,
    isGroup: o.isGroup ?? false,
    openingBalance: o.openingBalance ?? 0,
  };
}

function asset(o: Partial<Asset> & { value: number; type: Asset["type"] }): Asset {
  return {
    id: o.id ?? "as1",
    name: o.name ?? o.type,
    type: o.type,
    value: o.value,
    currency: o.currency ?? "USD",
    note: null,
    symbol: null,
    quantity: null,
    unit: null,
    karat: null,
    costBasis: null,
  };
}

describe("zakatLines", () => {
  it("marks cash, gold, crypto, investments and receivables as counted; personal assets and nothing else", () => {
    const accounts = [
      acc({ id: "chk", openingBalance: 100_000 }), // $1,000 cash
      acc({ id: "inv", subtype: "investment", openingBalance: 500_000 }), // $5,000
      acc({ id: "cc", type: "liability", subtype: "credit_card", openingBalance: -20_000 }), // -$200 debt
    ];
    const assets = [
      asset({ id: "g", type: "gold", value: 300_000 }), // $3,000
      asset({ id: "btc", type: "crypto", value: 200_000 }), // $2,000
      asset({ id: "home", type: "property", value: 50_000_00 }), // excluded
      asset({ id: "car", type: "vehicle", value: 1_500_000 }), // excluded
    ];
    const txns: Transaction[] = [
      {
        id: "t1",
        date: "2026-01-01",
        merchant: "M",
        categoryId: "c",
        accountId: "chk",
        amount: -5_000,
        currency: "USD",
        reimbursement: { person: "A", amount: 5_000, note: "", settled: false, settledAt: null },
      },
    ];

    const lines = zakatLines(accounts, (id) => accounts.find((a) => a.id === id)!.openingBalance, assets, txns, fx);
    const byId = new Map(lines.map((l) => [l.id, l]));

    expect(byId.get("chk")).toMatchObject({ category: "cash", included: true, value: 100_000 });
    expect(byId.get("inv")).toMatchObject({ category: "investment", included: true });
    expect(byId.get("cc")).toMatchObject({ category: "debt", included: true, value: 20_000 });
    expect(byId.get("g")).toMatchObject({ category: "gold", included: true });
    expect(byId.get("btc")).toMatchObject({ category: "crypto", included: true });
    expect(byId.get("home")).toMatchObject({ category: "other", included: false });
    expect(byId.get("car")).toMatchObject({ category: "other", included: false });
    expect(byId.get("receivables")).toMatchObject({ category: "receivable", included: true, value: 5_000 });
  });
});

describe("zakatSummary", () => {
  const lines: ZakatLine[] = [
    { id: "a", label: "Cash", category: "cash", value: 1_000_000, included: true },
    { id: "b", label: "Gold", category: "gold", value: 400_000, included: true },
    { id: "c", label: "Card", category: "debt", value: 200_000, included: true },
    { id: "d", label: "Home", category: "other", value: 9_999_999, included: false },
  ];

  it("deducts included debts and charges 2.5% of the net when above nisab", () => {
    const r = zakatSummary(lines, 100_000);
    expect(r.zakatable).toBe(1_400_000);
    expect(r.deductible).toBe(200_000);
    expect(r.net).toBe(1_200_000);
    expect(r.meetsNisab).toBe(true);
    expect(r.due).toBe(Math.round(1_200_000 * ZAKAT_RATE)); // 30,000 = $300
    expect(r.due).toBe(30_000);
  });

  it("charges nothing when net wealth is below nisab", () => {
    const r = zakatSummary(lines, 5_000_000); // very high threshold
    expect(r.meetsNisab).toBe(false);
    expect(r.due).toBe(0);
  });

  it("excluded lines don't count either way", () => {
    const only = zakatSummary(
      [{ id: "d", label: "Home", category: "other", value: 9_999_999, included: false }],
      100_000
    );
    expect(only.zakatable).toBe(0);
    expect(only.due).toBe(0);
  });

  it("never goes negative when debts exceed assets", () => {
    const r = zakatSummary(
      [
        { id: "a", label: "Cash", category: "cash", value: 100_000, included: true },
        { id: "c", label: "Loan", category: "debt", value: 500_000, included: true },
      ],
      1
    );
    expect(r.net).toBe(0);
    expect(r.due).toBe(0);
  });

  it("silver nisab weight is the classical 612.36g", () => {
    expect(NISAB_SILVER_GRAMS).toBeCloseTo(612.36, 2);
  });
});
