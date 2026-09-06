import type { Client, Invoice } from "@/lib/data";
import { amountDue } from "@/lib/invoice";
import { formatMoney, formatFullDate } from "@/lib/format";
import { StatusBadge } from "@/components/invoices/status-badge";
import { cn } from "@/lib/utils";

/**
 * The on-brand invoice document — warm editorial letterhead used in the detail
 * view, builder preview, public link, and mirrored by the PDF.
 *
 * Type rule (consistent per block): the serif (Fraunces `.display`) appears in
 * ONE place — the LEDGER wordmark. EVERY other block is the sans; figures and
 * codes use `tabular-nums` so columns align without switching to a second
 * (mono) family. Base text 15px.
 */

const LABEL =
  "text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground";
const nums = "tabular-nums";

/** The Ledger mark — three stacked balanced bars (matches the app sidebar). */
function LedgerMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <rect x="2" y="3.5" width="12" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="2" y="7.4" width="8" height="2.2" rx="1.1" fill="currentColor" opacity="0.7" />
      <rect x="2" y="11.3" width="10.5" height="2.2" rx="1.1" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

function TotalRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right", nums)}>{value}</dd>
    </div>
  );
}

/** One aligned label/value row in the bank-details grid. */
function BankRow({
  label,
  value,
  code,
}: {
  label: string;
  value: string;
  code?: boolean;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium", code && "tabular-nums break-all")}>
        {value}
      </dd>
    </>
  );
}

export function InvoiceDocument({
  invoice,
  client,
}: {
  invoice: Invoice;
  client?: Client;
}) {
  const { currency } = invoice;
  const lines = invoice.lines ?? [];
  const prefs = invoice.fieldPrefs;
  const due = amountDue(invoice.total, invoice.amountPaid);
  const pa = invoice.paymentAccount;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card text-[15px] leading-relaxed text-foreground">
      <div className="px-8 py-10 md:px-14 md:py-12">
        {/* ── Letterhead (the only serif moment) ─────────────────────────── */}
        <div className="flex flex-col items-center text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LedgerMark className="size-5" />
          </span>
          <p className="display mt-3 text-xl uppercase tracking-[0.26em]">
            Ledger
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Invoice
          </p>
        </div>

        <div className="mt-8 h-px bg-border" />

        {/* ── Parties + meta ─────────────────────────────────────────────── */}
        <div className="mt-8 flex flex-wrap justify-between gap-6">
          <div className="max-w-[60%]">
            <p className={LABEL}>Issued to</p>
            <p className="mt-2 text-lg font-semibold leading-tight">
              {client?.name ?? "—"}
            </p>
            {client?.email && (
              <p className="mt-1 text-sm text-muted-foreground">{client.email}</p>
            )}
            {client?.address && (
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {client.address}
              </p>
            )}
            {client?.taxId && (
              <p className="mt-1 text-sm text-muted-foreground">
                Tax ID {client.taxId}
              </p>
            )}
          </div>

          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <p className={LABEL}>Invoice no.</p>
              <StatusBadge status={invoice.status} overdue={invoice.overdue} />
            </div>
            <p className={cn("mt-2 text-lg font-semibold", nums)}>
              {invoice.number}
            </p>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-8">
                <dt className="text-muted-foreground">Issued</dt>
                <dd className="font-medium">{formatFullDate(invoice.issueDate)}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-muted-foreground">Due</dt>
                <dd
                  className={cn(
                    "font-medium",
                    invoice.overdue && "text-expense"
                  )}
                >
                  {formatFullDate(invoice.dueDate)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* ── Line items ─────────────────────────────────────────────────── */}
        <div className="mt-10 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={cn("border-b-2 border-foreground/80 text-left align-bottom", LABEL)}>
                <th className="pb-3">Description</th>
                <th className="pb-3 text-right">Unit price</th>
                {prefs.quantity && <th className="pb-3 text-right">Qty</th>}
                {prefs.tax && <th className="pb-3 text-right">Tax</th>}
                <th className="pb-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-border/50 align-top">
                  <td className="py-3.5 pr-4 font-medium">{l.description}</td>
                  <td className={cn("py-3.5 text-right", nums)}>
                    {formatMoney(l.unitPrice, { currency })}
                  </td>
                  {prefs.quantity && (
                    <td className={cn("py-3.5 text-right", nums)}>{l.quantity}</td>
                  )}
                  {prefs.tax && (
                    <td className={cn("py-3.5 text-right text-muted-foreground", nums)}>
                      {l.taxRate ? `${l.taxRate}%` : "—"}
                    </td>
                  )}
                  {/* pre-tax line total — reconciles with Subtotal */}
                  <td className={cn("py-3.5 text-right font-semibold", nums)}>
                    {formatMoney(l.amount, { currency })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Totals ─────────────────────────────────────────────────────── */}
        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-[17rem] space-y-2 text-sm">
            <TotalRow
              label="Subtotal"
              value={formatMoney(invoice.subtotal, { currency })}
            />
            {invoice.discountTotal > 0 && (
              <TotalRow
                label="Discount"
                value={`−${formatMoney(invoice.discountTotal, { currency })}`}
              />
            )}
            {prefs.tax && (
              <TotalRow
                label="Tax"
                value={formatMoney(invoice.taxTotal, { currency })}
              />
            )}
            {invoice.amountPaid > 0 && (
              <TotalRow
                label="Paid"
                value={formatMoney(invoice.amountPaid, { currency })}
              />
            )}
            <div className="mt-1 flex items-center justify-between gap-4 border-t-2 border-foreground/80 pt-3">
              <dt className="text-base font-semibold">
                {invoice.amountPaid > 0 ? "Amount due" : "Total"}
              </dt>
              <dd className={cn("text-xl font-bold", nums)}>
                {formatMoney(invoice.amountPaid > 0 ? due : invoice.total, {
                  currency,
                })}
              </dd>
            </div>
          </dl>
        </div>

        {/* ── Note — under the table, quiet ──────────────────────────────── */}
        {prefs.notes && invoice.notes && (
          <div className="mt-8 max-w-lg border-l-2 border-border pl-4">
            <p className={LABEL}>Note</p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
              {invoice.notes}
            </p>
          </div>
        )}

        {/* ── Footer: bank details (aligned grid) + terms + thank you ────── */}
        <div className="mt-12 flex flex-wrap items-end justify-between gap-x-10 gap-y-8 border-t border-border/60 pt-8">
          <div className="min-w-0 flex-1 space-y-6">
            {prefs.paymentDetails && pa && (
              <div>
                <p className={LABEL}>Bank details</p>
                <dl className="mt-3 grid max-w-md grid-cols-[7.5rem_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
                  {pa.bankName && <BankRow label="Bank" value={pa.bankName} />}
                  <BankRow label="Account title" value={pa.accountName} />
                  {pa.accountNumber && (
                    <BankRow label="Account no." value={pa.accountNumber} code />
                  )}
                  {pa.iban && <BankRow label="IBAN" value={pa.iban} code />}
                  {pa.swift && <BankRow label="SWIFT / BIC" value={pa.swift} code />}
                  {pa.branchCode && (
                    <BankRow label="Branch" value={pa.branchCode} />
                  )}
                </dl>
              </div>
            )}

            {prefs.terms && invoice.terms && (
              <div>
                <p className={LABEL}>Terms</p>
                <p className="mt-1 max-w-md whitespace-pre-line text-sm text-muted-foreground">
                  {invoice.terms}
                </p>
              </div>
            )}
          </div>

          <p className="ml-auto text-2xl font-medium italic text-muted-foreground/70">
            Thank you
          </p>
        </div>
      </div>
    </div>
  );
}
