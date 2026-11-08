import { describe, it, expect } from "vitest";

import { flowsOf, scopeToCategories } from "@/lib/compute";
import { makeFx, DEFAULT_RATES } from "@/lib/currency";
import type { Transaction } from "@/lib/data";

const fx = makeFx("EUR", { ...DEFAULT_RATES, EUR: 1 });

// An €8 grocery bill where only €2 was meat.
const groceryBill: Transaction = {
  id: "t_bill",
  date: "2026-10-01",
  merchant: "Lidl",
  categoryId: "",
  accountId: "a1",
  amount: -800,
  currency: "EUR",
  items: [
    { id: "i1", categoryId: "c_meat", description: "Chicken", amount: -200 },
    { id: "i2", categoryId: "c_veg", description: "Veg", amount: -350 },
    { id: "i3", categoryId: "c_dairy", description: "Milk", amount: -250 },
  ],
};

const simpleMeat: Transaction = {
  id: "t_simple",
  date: "2026-10-02",
  merchant: "Butcher",
  categoryId: "c_meat",
  accountId: "a1",
  amount: -500,
  currency: "EUR",
};

describe("scopeToCategories", () => {
  it("narrows a split bill to only the matching line items", () => {
    const scoped = scopeToCategories(groceryBill, new Set(["c_meat"]));

    expect(scoped).not.toBeNull();
    expect(scoped!.amount).toBe(-200);
    expect(scoped!.items).toHaveLength(1);
    expect(scoped!.items![0].id).toBe("i1");
  });

  it("does not mutate the original transaction", () => {
    scopeToCategories(groceryBill, new Set(["c_meat"]));

    expect(groceryBill.amount).toBe(-800);
    expect(groceryBill.items).toHaveLength(3);
  });

  it("sums several matching lines (e.g. parent + subcategory)", () => {
    const scoped = scopeToCategories(groceryBill, new Set(["c_meat", "c_dairy"]));

    expect(scoped!.amount).toBe(-450);
  });

  it("returns null when no line matches", () => {
    expect(scopeToCategories(groceryBill, new Set(["c_fuel"]))).toBeNull();
  });

  it("returns simple transactions unchanged when their category matches", () => {
    expect(scopeToCategories(simpleMeat, new Set(["c_meat"]))).toBe(simpleMeat);
  });

  it("returns null for a simple transaction in another category", () => {
    expect(scopeToCategories(simpleMeat, new Set(["c_veg"]))).toBeNull();
  });

  it("makes filtered Money out count only the meat portion", () => {
    const accepted = new Set(["c_meat"]);
    const scoped = [groceryBill, simpleMeat]
      .map((t) => scopeToCategories(t, accepted))
      .filter((t): t is Transaction => t !== null);

    expect(flowsOf(scoped, fx).expense).toBe(-700); // €2 + €5, not €8 + €5
  });

  it("keeps only the owed portion of matching items bought for a friend", () => {
    const shared: Transaction = {
      ...groceryBill,
      items: [
        { id: "i1", categoryId: "c_meat", description: "Chicken", amount: -200, reimbursable: true },
        { id: "i2", categoryId: "c_meat", description: "Mince", amount: -300 },
        { id: "i3", categoryId: "c_veg", description: "Veg", amount: -300, reimbursable: true },
      ],
      reimbursement: { person: "Ali", amount: 500, note: "", settled: false, settledAt: null },
    };

    const scoped = scopeToCategories(shared, new Set(["c_meat"]));

    expect(scoped!.amount).toBe(-500);
    expect(scoped!.reimbursement!.amount).toBe(200);
    // Your own meat spend = €3 (the €2 chicken is owed back by Ali).
    expect(flowsOf([scoped!], fx).expense).toBe(-300);
  });
});
