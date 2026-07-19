import { describe, it, expect } from "vitest";

import {
  pendingReceivablesBase,
  spendingByCategoryBase,
  monthFlowsBase,
} from "@/lib/compute";
import { makeFx, DEFAULT_RATES } from "@/lib/currency";
import type { Category, Transaction } from "@/lib/data";

const fx = makeFx("USD", DEFAULT_RATES);

const categories: Category[] = [
  { id: "c_groc", label: "Groceries", kind: "expense", tint: "#0a0", parentId: null },
  { id: "c_house", label: "Household", kind: "expense", tint: "#00a", parentId: null },
];

// July 2026 is month index 6 (0-based) for the compute helpers.
const JULY = 6;

// A grocery run split across categories; some items were bought for a friend.
// Milk ($3) is yours; Soap ($5) and Chips ($4) are Ali's → he owes $9.
const splitForFriend: Transaction = {
  id: "t_split",
  date: "2026-07-10",
  merchant: "Carrefour",
  categoryId: "",
  accountId: "a1",
  amount: -1200,
  currency: "USD",
  items: [
    { id: "i1", categoryId: "c_groc", description: "Milk", amount: -300, reimbursable: false },
    { id: "i2", categoryId: "c_house", description: "Soap", amount: -500, reimbursable: true },
    { id: "i3", categoryId: "c_groc", description: "Chips", amount: -400, reimbursable: true },
  ],
  reimbursement: { person: "Ali", amount: 900, note: "", settled: false, settledAt: null },
};

describe("per-item reimbursement (bought for a friend inside a split)", () => {
  it("owes the sum of the tagged items", () => {
    expect(pendingReceivablesBase([splitForFriend], fx)).toBe(900);
  });

  it("excludes tagged items from category spending", () => {
    const spend = spendingByCategoryBase([splitForFriend], categories, 2026, JULY, fx);
    const groc = spend.find((s) => s.category.id === "c_groc");
    const house = spend.find((s) => s.category.id === "c_house");
    // Only the un-tagged Milk ($3) is your grocery spend; Chips ($4) is Ali's.
    expect(groc?.amount).toBe(300);
    // Soap ($5) is entirely Ali's → Household has no personal spend at all.
    expect(house).toBeUndefined();
  });

  it("nets the owed portion out of the month's expense", () => {
    const flows = monthFlowsBase([splitForFriend], 2026, JULY, fx);
    // $12 spent, $9 owed back → only $3 is actually yours.
    expect(flows.expense).toBe(-300);
    expect(flows.income).toBe(0);
    expect(flows.net).toBe(-300);
  });

  it("drops the receivable once the claim is settled", () => {
    const settled: Transaction = {
      ...splitForFriend,
      reimbursement: {
        ...splitForFriend.reimbursement!,
        settled: true,
        settledAt: "2026-07-12",
      },
    };
    expect(pendingReceivablesBase([settled], fx)).toBe(0);
  });
});

describe("whole-transaction reimbursement (non-split) still nets correctly", () => {
  const simple: Transaction = {
    id: "t_simple",
    date: "2026-07-05",
    merchant: "Concert tickets",
    categoryId: "c_groc",
    accountId: "a1",
    amount: -1000,
    currency: "USD",
    reimbursement: { person: "Sam", amount: 600, note: "", settled: false, settledAt: null },
  };

  it("owes the claim amount", () => {
    expect(pendingReceivablesBase([simple], fx)).toBe(600);
  });

  it("counts only the un-owed portion as spending", () => {
    const spend = spendingByCategoryBase([simple], categories, 2026, JULY, fx);
    expect(spend.find((s) => s.category.id === "c_groc")?.amount).toBe(400);
  });

  it("nets the owed portion out of the month's expense", () => {
    expect(monthFlowsBase([simple], 2026, JULY, fx).expense).toBe(-400);
  });
});
