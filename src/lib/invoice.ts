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

/** All sections on by default — the baseline a new user starts from. The
 *  invoice number only ever appears once the invoice is sent (see
 *  {@link displayInvoiceNumber}). */
export const DEFAULT_INVOICE_PREFS: InvoiceFieldPrefs = {
  quantity: true,
  tax: true,
  discount: true,
  paymentDetails: true,
  notes: true,
  terms: true,
  invoiceNumber: true,
};

// ── Numbering ────────────────────────────────────────────────────────────────
// Drafts carry a unique placeholder (the column is NOT NULL + unique per user);
// the real, sequential number is issued when the invoice is sent, so deleted
// drafts never leave gaps in the issued sequence.

const DRAFT_PREFIX = "DRAFT-";

/** Placeholder number for an unsent draft. Never shown to anyone. */
export function draftNumber(invoiceId: string): string {
  return `${DRAFT_PREFIX}${invoiceId.replace(/-/g, "").slice(0, 12)}`;
}

export function isDraftNumber(number: string | null | undefined): boolean {
  return (number ?? "").startsWith(DRAFT_PREFIX);
}

/** Next issued number, INV-%04d, after the highest issued one. Custom one-off
 *  numbers (e.g. "6") count by their trailing digits; draft placeholders don't. */
export function nextIssuedNumber(existing: readonly string[]): string {
  let max = 0;
  for (const n of existing) {
    if (isDraftNumber(n)) continue;
    const m = /(\d+)\s*$/.exec(n ?? "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `INV-${String(max + 1).padStart(4, "0")}`;
}

/** The number to print on the client-facing invoice, or null to show none:
 *  only once sent (never on a draft), and only when the toggle is on. */
export function displayInvoiceNumber(invoice: {
  number: string;
  status: InvoiceStatus;
  fieldPrefs: InvoiceFieldPrefs;
}): string | null {
  if (!invoice.fieldPrefs.invoiceNumber) return null;
  if (invoice.status === "draft" || isDraftNumber(invoice.number)) return null;
  return invoice.number;
}

export const MAX_INVOICE_NUMBER_LENGTH = 32;

/** Validate a manually typed invoice number (rename / custom number). */
export function cleanInvoiceNumber(
  raw: string
): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: false, error: "Enter an invoice number." };
  if (value.length > MAX_INVOICE_NUMBER_LENGTH)
    return { ok: false, error: `Keep it under ${MAX_INVOICE_NUMBER_LENGTH} characters.` };
  if (isDraftNumber(value.toUpperCase()))
    return { ok: false, error: "Numbers starting with “DRAFT-” are reserved." };
  return { ok: true, value };
}

/** How the app refers to an invoice in lists, titles and confirmations. */
export function invoiceLabel(invoice: { number: string }): string {
  return isDraftNumber(invoice.number) ? "Draft invoice" : invoice.number;
}

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
    invoiceNumber: pick("invoiceNumber"),
  };
}

/** Download name for an invoice PDF — never leaks a number the document hides. */
export function invoicePdfFilename(invoice: {
  number: string;
  status: InvoiceStatus;
  issueDate: string;
  fieldPrefs: InvoiceFieldPrefs;
}): string {
  const shown = displayInvoiceNumber(invoice);
  return shown ? `${shown.replace(/[^\w.-]+/g, "-")}.pdf` : `invoice-${invoice.issueDate}.pdf`;
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
