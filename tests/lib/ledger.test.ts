import { describe, it, expect } from "vitest";

import { toJournalEntry, type LedgerLookups } from "@/lib/ledger";
import type { Account, Category, Transaction } from "@/lib/data";

const meezan: Account = {
  id: "a_meezan",
  name: "Meezan Bank",
  institution: null,
  accountNumber: null,
  swift: null,
  iban: null,
  branch: null,
  type: "asset",
  subtype: null,
  currency: "PKR",
  parentId: null,
  isGroup: false,
  openingBalance: 0,
};

const groceries: Category = {
  id: "c_groc",
  label: "Groceries",
  kind: "expense",
  tint: "#0a0",
  parentId: null,
};

const base = (o: Partial<Transaction>): Transaction => ({
  id: "t1",
  date: "2026-10-13",
  merchant: "x",
  categoryId: "",
  accountId: meezan.id,
  amount: -443_000,
  currency: "PKR",
  ...o,
});

const lookups = (counterparts?: Map<string, string>): LedgerLookups => ({
  accounts: new Map([[meezan.id, meezan]]),
  categories: new Map([[groceries.id, groceries]]),
  transferCounterparts: counterparts,
});

describe("toJournalEntry — transfers", () => {
  it("posts a gold purchase outflow as Dr Gold (asset) / Cr Meezan, not an expense", () => {
    // Arrange: the "Paid from" outflow for a lot on the "Gold" holding.
    const t = base({ id: "t_gold", merchant: "Bought Gold", isTransfer: true });

    // Act
    const entry = toJournalEntry(t, lookups(new Map([["t_gold", "Gold"]])));

    // Assert
    expect(entry.lines).toEqual([
      { account: "Gold", classification: "Asset", debit: 443_000, credit: 0, currency: "PKR" },
      { account: "Meezan Bank", classification: "Asset", debit: 0, credit: 443_000, currency: "PKR" },
    ]);
  });

  it("posts an unlinked transfer-out leg against a clearing account", () => {
    const t = base({ isTransfer: true, amount: -50_000 });

    const entry = toJournalEntry(t, lookups());

    expect(entry.lines[0]).toMatchObject({ account: "Transfers (clearing)", classification: "Asset", debit: 50_000 });
    expect(entry.lines.some((l) => l.classification === "Expense")).toBe(false);
  });

  it("posts a transfer-in leg as Dr account / Cr clearing", () => {
    const t = base({ isTransfer: true, amount: 50_000 });

    const entry = toJournalEntry(t, lookups());

    expect(entry.lines).toEqual([
      { account: "Meezan Bank", classification: "Asset", debit: 50_000, credit: 0, currency: "PKR" },
      { account: "Transfers (clearing)", classification: "Asset", debit: 0, credit: 50_000, currency: "PKR" },
    ]);
  });

  it("still posts an ordinary expense to its category", () => {
    const t = base({ categoryId: groceries.id, amount: -2_000 });

    const entry = toJournalEntry(t, lookups());

    expect(entry.lines[0]).toMatchObject({ account: "Groceries expense", classification: "Expense", debit: 2_000 });
  });
});
