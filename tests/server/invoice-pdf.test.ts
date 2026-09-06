import { describe, it, expect } from "vitest";

import { renderInvoicePdf } from "@/server/invoice-pdf";
import type { Client, Invoice } from "@/lib/data";

const client: Client = {
  id: "c1",
  name: "Acme Inc.",
  email: "billing@acme.com",
  phone: null,
  address: "1 Market St\nSan Francisco, CA",
  taxId: "US-123",
  currency: "USD",
  notes: null,
};

const invoice: Invoice = {
  id: "i1",
  clientId: "c1",
  number: "INV-0001",
  status: "sent",
  overdue: false,
  issueDate: "2026-09-01",
  dueDate: "2026-09-15",
  currency: "USD",
  subtotal: 16000,
  discountTotal: 0,
  taxTotal: 1600,
  total: 17600,
  amountPaid: 0,
  accountId: null,
  paymentAccountId: "pa1",
  notes: "Thanks for your business",
  terms: "Net 14",
  publicToken: "tok",
  sentAt: "2026-09-01T00:00:00Z",
  paidAt: null,
  fieldPrefs: {
    quantity: true,
    tax: true,
    discount: true,
    paymentDetails: true,
    notes: true,
    terms: true,
  },
  paymentAccount: {
    id: "pa1",
    label: "Meezan USD",
    accountName: "My Studio Ltd",
    bankName: "Meezan Bank Limited",
    accountNumber: "0123456789",
    iban: "PK00MEZN0000000123456789",
    swift: "MEZNPKKA",
    branchCode: "0042",
    currency: "USD",
    notes: null,
    isDefault: true,
  },
  lines: [
    { id: "l1", description: "Consulting", quantity: 2, unitPrice: 5000, amount: 10000, taxRate: 10 },
    { id: "l2", description: "Setup fee", quantity: 1, unitPrice: 6000, amount: 6000, taxRate: 10 },
  ],
};

describe("renderInvoicePdf", () => {
  it("produces a valid, non-trivial PDF document", async () => {
    const buf = await renderInvoicePdf(invoice, client);
    // PDF files start with the "%PDF" magic bytes.
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    // A real one-page invoice is comfortably larger than a few hundred bytes.
    expect(buf.length).toBeGreaterThan(1000);
  }, 20000);
});
