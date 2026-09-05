import { describe, it, expect } from "vitest";

import {
  amountDue,
  deriveStatus,
  invoiceTotals,
  isOverdue,
  lineAmount,
  lineTax,
} from "@/lib/invoice";

describe("invoice line math", () => {
  it("rounds amount to the nearest minor unit", () => {
    // 2.5 hours * 4000 cents = 10000
    expect(lineAmount({ quantity: 2.5, unitPrice: 4000 })).toBe(10000);
    // fractional cents round half-up
    expect(lineAmount({ quantity: 1.005, unitPrice: 10000 })).toBe(10050);
  });

  it("computes per-line tax, zero when no rate", () => {
    expect(lineTax({ quantity: 1, unitPrice: 10000, taxRate: 20 })).toBe(2000);
    expect(lineTax({ quantity: 1, unitPrice: 10000, taxRate: null })).toBe(0);
    expect(lineTax({ quantity: 1, unitPrice: 10000 })).toBe(0);
  });
});

describe("invoiceTotals (per-line tax + discount)", () => {
  it("sums subtotal and per-line tax", () => {
    const t = invoiceTotals([
      { quantity: 2, unitPrice: 5000, taxRate: 10 }, // 10000 + 1000 tax
      { quantity: 1, unitPrice: 3000, taxRate: 0 }, //  3000 + 0
      { quantity: 3, unitPrice: 1000, taxRate: 20 }, //  3000 + 600 tax
    ]);
    expect(t.subtotal).toBe(16000);
    expect(t.taxTotal).toBe(1600);
    expect(t.total).toBe(17600);
  });

  it("applies discount to subtotal before adding tax back", () => {
    const t = invoiceTotals(
      [{ quantity: 1, unitPrice: 10000, taxRate: 10 }],
      2000 // discount
    );
    expect(t.subtotal).toBe(10000);
    expect(t.taxTotal).toBe(1000);
    expect(t.total).toBe(9000); // 10000 - 2000 + 1000
  });

  it("handles an empty line list", () => {
    expect(invoiceTotals([])).toEqual({ subtotal: 0, taxTotal: 0, total: 0 });
  });
});

describe("amountDue", () => {
  it("never goes negative on overpayment", () => {
    expect(amountDue(10000, 3000)).toBe(7000);
    expect(amountDue(10000, 12000)).toBe(0);
  });
});

describe("deriveStatus", () => {
  const today = "2026-09-05";
  it("keeps draft and void untouched", () => {
    expect(deriveStatus("draft", 100, 0, "2020-01-01", today)).toBe("draft");
    expect(deriveStatus("void", 100, 0, "2020-01-01", today)).toBe("void");
  });
  it("marks fully paid as paid, partial as partial", () => {
    expect(deriveStatus("sent", 10000, 10000, "2026-10-01", today)).toBe("paid");
    expect(deriveStatus("sent", 10000, 4000, "2026-10-01", today)).toBe("partial");
  });
  it("marks past-due unpaid as overdue", () => {
    expect(deriveStatus("sent", 10000, 0, "2026-08-01", today)).toBe("overdue");
  });
  it("leaves a future-dated sent invoice as sent", () => {
    expect(deriveStatus("sent", 10000, 0, "2026-10-01", today)).toBe("sent");
  });
});

describe("isOverdue", () => {
  const today = "2026-09-05";
  it("is true only for past-due, unpaid, live invoices", () => {
    expect(isOverdue("sent", 10000, 0, "2026-08-01", today)).toBe(true);
    expect(isOverdue("partial", 10000, 5000, "2026-08-01", today)).toBe(true);
  });
  it("is false for draft, void, paid, or future-due", () => {
    expect(isOverdue("draft", 10000, 0, "2026-08-01", today)).toBe(false);
    expect(isOverdue("void", 10000, 0, "2026-08-01", today)).toBe(false);
    expect(isOverdue("paid", 10000, 10000, "2026-08-01", today)).toBe(false);
    expect(isOverdue("sent", 10000, 0, "2026-10-01", today)).toBe(false);
  });
});
