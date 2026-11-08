import { describe, it, expect } from "vitest";

import {
  amountDue,
  deriveStatus,
  invoiceTotals,
  isOverdue,
  lineAmount,
  lineTax,
  normalizeInvoicePrefs,
  DEFAULT_INVOICE_PREFS,
  invoicePdfFilename,
  draftNumber,
  isDraftNumber,
  nextIssuedNumber,
  displayInvoiceNumber,
  invoiceLabel,
  cleanInvoiceNumber,
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

describe("normalizeInvoicePrefs", () => {
  it("defaults everything on when nothing is stored", () => {
    expect(normalizeInvoicePrefs(null)).toEqual(DEFAULT_INVOICE_PREFS);
    expect(normalizeInvoicePrefs(undefined)).toEqual(DEFAULT_INVOICE_PREFS);
    expect(normalizeInvoicePrefs({})).toEqual(DEFAULT_INVOICE_PREFS);
  });

  it("honors stored booleans and fills missing keys with the default", () => {
    expect(normalizeInvoicePrefs({ tax: false, discount: false })).toEqual({
      quantity: true,
      tax: false,
      discount: false,
      paymentDetails: true,
      notes: true,
      terms: true,
      invoiceNumber: true,
    });
  });

  it("keeps the invoice number off when it was switched off", () => {
    expect(normalizeInvoicePrefs({ invoiceNumber: false }).invoiceNumber).toBe(false);
  });

  it("ignores non-boolean junk", () => {
    expect(normalizeInvoicePrefs({ tax: "no" as unknown as boolean })).toEqual(
      DEFAULT_INVOICE_PREFS
    );
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

describe("invoicePdfFilename", () => {
  const inv = { number: "INV-0007", issueDate: "2026-10-24", status: "sent" as const };

  it("uses the issue date when the number is hidden", () => {
    const prefs = { ...DEFAULT_INVOICE_PREFS, invoiceNumber: false };

    expect(invoicePdfFilename({ ...inv, fieldPrefs: prefs })).toBe("invoice-2026-10-24.pdf");
  });

  it("uses the number when it is shown", () => {
    const prefs = { ...DEFAULT_INVOICE_PREFS, invoiceNumber: true };

    expect(invoicePdfFilename({ ...inv, fieldPrefs: prefs })).toBe("INV-0007.pdf");
  });
});

describe("invoice numbering — assigned when sent", () => {
  it("gives a draft a placeholder that is never shown as its number", () => {
    const n = draftNumber("3f2a9c1e-0000-4000-8000-000000000000");

    expect(isDraftNumber(n)).toBe(true);
    expect(isDraftNumber("INV-0007")).toBe(false);
    expect(isDraftNumber("6")).toBe(false);
  });

  it("issues the next number after the highest issued one, ignoring drafts", () => {
    const numbers = ["INV-0001", "INV-0002", draftNumber("a1b2c3d4-9999"), "INV-0003"];

    expect(nextIssuedNumber(numbers)).toBe("INV-0004");
  });

  it("starts at INV-0001 when nothing has been issued yet", () => {
    expect(nextIssuedNumber([draftNumber("deadbeef-1234")])).toBe("INV-0001");
  });

  it("continues after a custom one-off number like '6'", () => {
    expect(nextIssuedNumber(["INV-0004", "6"])).toBe("INV-0007");
  });
});

describe("displayInvoiceNumber", () => {
  const on = { ...DEFAULT_INVOICE_PREFS, invoiceNumber: true };

  it("shows the number on a sent invoice", () => {
    expect(displayInvoiceNumber({ number: "INV-0004", status: "sent", fieldPrefs: on })).toBe("INV-0004");
  });

  it("shows nothing on a draft, even one that already had a number", () => {
    expect(displayInvoiceNumber({ number: "INV-0004", status: "draft", fieldPrefs: on })).toBeNull();
    expect(displayInvoiceNumber({ number: draftNumber("abcd1234-0"), status: "draft", fieldPrefs: on })).toBeNull();
  });

  it("shows nothing when the toggle is off", () => {
    const off = { ...DEFAULT_INVOICE_PREFS, invoiceNumber: false };

    expect(displayInvoiceNumber({ number: "INV-0004", status: "paid", fieldPrefs: off })).toBeNull();
  });

  it("is on by default again", () => {
    expect(DEFAULT_INVOICE_PREFS.invoiceNumber).toBe(true);
  });
});

describe("invoiceLabel (in-app)", () => {
  it("labels an unnumbered draft as a draft", () => {
    expect(invoiceLabel({ number: draftNumber("abcd1234-0") })).toBe("Draft invoice");
  });

  it("uses the number once issued", () => {
    expect(invoiceLabel({ number: "INV-0004" })).toBe("INV-0004");
  });
});

describe("cleanInvoiceNumber (manual rename)", () => {
  it("accepts and trims a normal number", () => {
    expect(cleanInvoiceNumber("  INV-0006 ")).toEqual({ ok: true, value: "INV-0006" });
    expect(cleanInvoiceNumber("0006")).toEqual({ ok: true, value: "0006" });
  });

  it("rejects an empty number", () => {
    expect(cleanInvoiceNumber("   ").ok).toBe(false);
  });

  it("rejects the reserved draft placeholder prefix", () => {
    expect(cleanInvoiceNumber("DRAFT-123").ok).toBe(false);
  });

  it("rejects a number longer than 32 characters", () => {
    expect(cleanInvoiceNumber("X".repeat(33)).ok).toBe(false);
  });
});
