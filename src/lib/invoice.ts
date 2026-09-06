/**
 * Pure invoice math — the single source of truth for how an invoice's money is
 * derived from its line items. Shared by the server action (which persists the
 * result) and the on-brand document/PDF view (which displays it), so the number
 * a customer sees always equals the number we recorded. No I/O, no clock.
 *
 * All money is integer minor units (cents). Tax is per-line (VAT/GST-style):
 * each line may carry its own percentage rate.
 */

import type { InvoiceStatus, InvoiceFieldPrefs } from "@/lib/schema";

/** All sections on by default — the baseline a new user starts from. */
export const DEFAULT_INVOICE_PREFS: InvoiceFieldPrefs = {
  quantity: true,
  tax: true,
  discount: true,
  paymentDetails: true,
  notes: true,
  terms: true,
};

/** Coerce a stored/loose prefs map into a full, typed prefs object (missing → default). */
export function normalizeInvoicePrefs(
  raw: Record<string, unknown> | null | undefined
): InvoiceFieldPrefs {
  const r = raw ?? {};
  const pick = (k: keyof InvoiceFieldPrefs) =>
    typeof r[k] === "boolean" ? (r[k] as boolean) : DEFAULT_INVOICE_PREFS[k];
  return {
    quantity: pick("quantity"),
    tax: pick("tax"),
    discount: pick("discount"),
    paymentDetails: pick("paymentDetails"),
    notes: pick("notes"),
    terms: pick("terms"),
  };
}

/** The shape needed to compute a line's money — a subset of a line item. */
export type LineMath = {
  quantity: number; // may be fractional (hours/units)
  unitPrice: number; // minor units
  taxRate?: number | null; // percent 0..100; null/undefined = no tax
};

/** A line's pre-tax amount, rounded to the nearest minor unit. */
export function lineAmount(l: LineMath): number {
  return Math.round(l.quantity * l.unitPrice);
}

/** A line's tax, rounded to the nearest minor unit (0 when no rate). */
export function lineTax(l: LineMath): number {
  if (!l.taxRate) return 0;
  return Math.round((lineAmount(l) * l.taxRate) / 100);
}

export type InvoiceTotals = {
  subtotal: number; // Σ line amounts, pre-tax/discount
  taxTotal: number; // Σ per-line tax
  total: number; // subtotal - discount + tax
};

/**
 * Roll a set of lines (plus an optional whole-invoice discount) into the stored
 * totals. Discount is applied to the subtotal before tax is added back.
 */
export function invoiceTotals(
  lines: LineMath[],
  discountTotal = 0
): InvoiceTotals {
  let subtotal = 0;
  let taxTotal = 0;
  for (const l of lines) {
    subtotal += lineAmount(l);
    taxTotal += lineTax(l);
  }
  return { subtotal, taxTotal, total: subtotal - discountTotal + taxTotal };
}

/** Amount still owed on an invoice (never negative). */
export function amountDue(total: number, amountPaid: number): number {
  return Math.max(0, total - amountPaid);
}

/**
 * Derive the status that a stored invoice should have from its money + dates.
 * `today` (yyyy-mm-dd) is passed in so this stays pure. `draft` and `void` are
 * lifecycle states set explicitly and are never overridden here.
 */
export function deriveStatus(
  stored: InvoiceStatus,
  total: number,
  amountPaid: number,
  dueDate: string,
  today: string
): InvoiceStatus {
  if (stored === "draft" || stored === "void") return stored;
  if (amountPaid >= total && total > 0) return "paid";
  if (amountPaid > 0) return "partial";
  if (dueDate < today) return "overdue";
  return stored; // sent / viewed
}

/** True when an invoice is past due and not settled. */
export function isOverdue(
  status: InvoiceStatus,
  total: number,
  amountPaid: number,
  dueDate: string,
  today: string
): boolean {
  return (
    status !== "paid" &&
    status !== "void" &&
    status !== "draft" &&
    amountPaid < total &&
    dueDate < today
  );
}
