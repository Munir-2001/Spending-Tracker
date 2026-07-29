import { describe, it, expect } from "vitest";

import { transactionInput } from "@/server/validation";

const base = {
  merchant: "Travel to Apuglia",
  amount: -22573,
  accountId: "acc_1",
  currency: "EUR",
  date: "2026-07-10",
};

describe("transactionInput — uncategorized handling", () => {
  it("accepts a simple expense with no category", () => {
    const r = transactionInput.safeParse({ ...base, categoryId: "" });
    expect(r.success).toBe(true);
  });

  it("accepts a split where a line item has no category", () => {
    // Regression: a line's categoryId must tolerate "" (buildLines maps it to
    // null) exactly like the parent — otherwise editing such a split throws.
    const r = transactionInput.safeParse({
      ...base,
      categoryId: "",
      items: [
        { categoryId: "c_travel", description: "Flights", amount: -15000 },
        { categoryId: "", description: "Misc", amount: -7573 },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("still carries the per-item reimbursable flag through", () => {
    const r = transactionInput.safeParse({
      ...base,
      categoryId: "",
      items: [
        { categoryId: "c_travel", description: "Flights", amount: -15000, reimbursable: true },
      ],
      reimbursement: { person: "Ali", amount: 15000, note: "" },
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.items?.[0].reimbursable).toBe(true);
  });
});
