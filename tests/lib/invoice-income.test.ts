import { describe, it, expect } from "vitest";

import { flowsOf } from "@/lib/compute";
import { makeFx, DEFAULT_RATES } from "@/lib/currency";
import type { Transaction } from "@/lib/data";

/**
 * A paid invoice counts as income because markInvoicePaid posts an ordinary
 * positive transaction (invoice_id set, none of the not-income flags). This
 * guards that the invoice_id link does NOT accidentally exclude it from income,
 * and that unpaid/void invoices — which post no transaction — contribute nothing.
 */

const fx = makeFx("USD", DEFAULT_RATES);

let n = 0;
function tx(o: Partial<Transaction> & { amount: number }): Transaction {
  return {
    id: `t${++n}`,
    date: "2026-09-01",
    merchant: "M",
    categoryId: "",
    accountId: "a1",
    currency: "USD",
    ...o, // includes amount (required by the caller)
  };
}

describe("invoice payment → income", () => {
  it("counts an invoice-payment inflow as income", () => {
    const r = flowsOf(
      [tx({ amount: 50000, invoiceId: "inv1" })], // a paid invoice's inflow
      fx
    );
    expect(r.income).toBe(50000);
    expect(r.expense).toBe(0);
  });

  it("still respects exclusion flags even with an invoiceId", () => {
    // Defensive: a transfer/refund should never count, invoice link or not.
    const r = flowsOf(
      [
        tx({ amount: 50000, invoiceId: "inv1" }), // real invoice income
        tx({ amount: 9999, invoiceId: "inv2", isTransfer: true }), // excluded
      ],
      fx
    );
    expect(r.income).toBe(50000);
  });

  it("an unpaid/void invoice posts no transaction → no income", () => {
    // No transaction rows exist for a draft/void invoice.
    const r = flowsOf([], fx);
    expect(r.income).toBe(0);
    expect(r.net).toBe(0);
  });
});
