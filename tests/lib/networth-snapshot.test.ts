import { describe, it, expect } from "vitest";

import {
  accountBalances,
  netWorthSnapshot,
  netWorthBase,
  partialSale,
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

let n = 0;
function tx(o: Partial<Transaction> & { amount: number }): Transaction {
  return {
    id: o.id ?? `t${++n}`,
    date: o.date ?? "2026-07-01",
    merchant: "M",
    categoryId: "c1",
    accountId: o.accountId ?? "a1",
    amount: o.amount,
    currency: o.currency ?? "USD",
    reimbursement: o.reimbursement,
  };
}

function asset(o: Partial<Asset> & { value: number }): Asset {
  return {
    id: o.id ?? "as1",
    name: "Asset",
    type: o.type ?? "cash",
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

describe("accountBalances", () => {
  it("is opening balance plus transactions in the account's currency", () => {
    const accounts = [acc({ id: "a1", openingBalance: 10_000 })];
    const bal = accountBalances(
      accounts,
      [tx({ accountId: "a1", amount: 2500 }), tx({ accountId: "a1", amount: -500 })],
      fx
    );
    expect(bal.get("a1")).toBe(12_000);
  });

  it("converts a foreign-currency charge into the account currency", () => {
    // EUR account, charge booked in USD. 1000 USD → EUR at DEFAULT_RATES (1.08).
    const accounts = [acc({ id: "a1", currency: "EUR", openingBalance: 0 })];
    const bal = accountBalances(accounts, [tx({ accountId: "a1", amount: 1000, currency: "USD" })], fx);
    // convertWithRates(1000, USD, EUR) = round(10 * 1 / 1.08 * 100) = 926
    expect(bal.get("a1")).toBe(926);
  });

  it("ignores a group account's opening balance (groups are containers)", () => {
    const accounts = [acc({ id: "g", isGroup: true, openingBalance: 5000 })];
    const bal = accountBalances(accounts, [], fx);
    expect(bal.get("g")).toBe(0);
  });
});

describe("netWorthSnapshot", () => {
  it("sums accounts, assets and receivables into a total with a matching breakdown", () => {
    const accounts = [
      acc({ id: "a1", openingBalance: 100_000 }), // $1,000
      acc({ id: "a2", type: "liability", subtype: "credit_card", openingBalance: -30_000 }), // -$300
    ];
    const txns = [
      tx({ accountId: "a1", amount: -5_000 }), // spend $50 → a1 = $950
      // an unsettled reimbursement: $20 owed back to you
      tx({
        accountId: "a1",
        amount: -2_000,
        reimbursement: { person: "Sam", amount: 2_000, note: "", settled: false, settledAt: null },
      }),
    ];
    const assets = [asset({ id: "as1", value: 250_000 })]; // $2,500
    const balances = accountBalances(accounts, txns, fx);

    const snap = netWorthSnapshot(
      accounts,
      (id) => balances.get(id) ?? 0,
      assets,
      txns,
      fx
    );

    const accountsTotal = netWorthBase(accounts, (id) => balances.get(id) ?? 0, fx);
    expect(snap.breakdown.accounts).toBe(accountsTotal);
    expect(snap.breakdown.assets).toBe(250_000);
    expect(snap.breakdown.receivables).toBe(2_000);
    expect(snap.value).toBe(
      snap.breakdown.accounts + snap.breakdown.assets + snap.breakdown.receivables
    );
    // a1 = 100000 - 5000 - 2000 = 93000; a2 = -30000; assets 250000; recv 2000
    expect(snap.value).toBe(93_000 - 30_000 + 250_000 + 2_000);
  });

  it("rolls multi-currency holdings up to the base currency", () => {
    const accounts = [acc({ id: "eur", currency: "EUR", openingBalance: 10_000 })]; // €100
    const assets = [asset({ id: "g", currency: "EUR", value: 5_000 })]; // €50
    const balances = accountBalances(accounts, [], fx);
    const snap = netWorthSnapshot(accounts, (id) => balances.get(id) ?? 0, assets, [], fx);
    // €150 → USD at 1.08 = $162 → 16200 minor
    expect(snap.value).toBe(16_200);
  });

  it("excludes settled receivables", () => {
    const txns = [
      tx({
        amount: -1_000,
        reimbursement: { person: "A", amount: 1_000, note: "", settled: true, settledAt: "2026-07-02" },
      }),
    ];
    const snap = netWorthSnapshot([], () => 0, [], txns, fx);
    expect(snap.breakdown.receivables).toBe(0);
    expect(snap.value).toBe(0);
  });
});

describe("partialSale (withdrawing from an asset)", () => {
  it("withdraws part and reports the fraction to keep", () => {
    // Hold 500,000 minor; withdraw 200,000 → keep 60%.
    const r = partialSale(500_000, 200_000);
    expect(r.withdrawn).toBe(200_000);
    expect(r.remaining).toBe(300_000);
    expect(r.keep).toBeCloseTo(0.6, 10);
  });

  it("scales quantity and cost basis by the keep fraction", () => {
    // A crypto holding: value 500k, qty 2 coins, cost basis 400k. Sell 200k.
    const { keep } = partialSale(500_000, 200_000);
    expect(2 * keep).toBeCloseTo(1.2, 10); // remaining coins
    expect(Math.round(400_000 * keep)).toBe(240_000); // remaining cost basis
  });

  it("clamps a withdrawal larger than the holding to a full sale", () => {
    const r = partialSale(100_000, 250_000);
    expect(r.withdrawn).toBe(100_000);
    expect(r.remaining).toBe(0);
    expect(r.keep).toBe(0); // everything (incl. lots/quantity) goes to zero
  });

  it("is a no-op fraction for a zero-value holding", () => {
    const r = partialSale(0, 100);
    expect(r.withdrawn).toBe(0);
    expect(r.remaining).toBe(0);
    expect(r.keep).toBe(0);
  });
});
