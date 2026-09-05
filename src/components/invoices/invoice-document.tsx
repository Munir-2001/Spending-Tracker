import type { Client, Invoice } from "@/lib/data";
import { amountDue, lineTax } from "@/lib/invoice";
import { formatMoney, formatFullDate } from "@/lib/format";
import { StatusBadge } from "@/components/invoices/status-badge";
import { cn } from "@/lib/utils";

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium", mono && "num break-all")}>{value}</dd>
    </div>
  );
}

/**
 * The on-brand invoice document — the single visual source of truth for how an
 * invoice reads. Shown in the app detail view and (later) the public link; the
 * @react-pdf renderer mirrors this layout for the downloadable file. Numbers use
 * `.num`; the header figure uses `.display`. Presentational only.
 */
export function InvoiceDocument({
  invoice,
  client,
  from,
}: {
  invoice: Invoice;
  client?: Client;
  /** The issuing business name (from profile/settings). */
  from?: string;
}) {
  const { currency } = invoice;
  const lines = invoice.lines ?? [];
  const due = amountDue(invoice.total, invoice.amountPaid);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Invoice</p>
          <p className="display mt-1 text-3xl tracking-tight">{invoice.number}</p>
        </div>
        <div className="text-right">
          <StatusBadge status={invoice.status} overdue={invoice.overdue} />
          <p className="num mt-2 text-2xl font-semibold tabular-nums">
            {formatMoney(invoice.total, { currency })}
          </p>
          {invoice.amountPaid > 0 && due > 0 && (
            <p className="num mt-0.5 text-xs text-muted-foreground tabular-nums">
              {formatMoney(due, { currency })} due
            </p>
          )}
        </div>
      </div>

      {/* Parties + dates */}
      <div className="mt-8 grid grid-cols-2 gap-6 text-sm md:grid-cols-4">
        {from && (
          <div>
            <p className="eyebrow">From</p>
            <p className="mt-1 font-medium">{from}</p>
          </div>
        )}
        <div>
          <p className="eyebrow">Bill to</p>
          <p className="mt-1 font-medium">{client?.name ?? "—"}</p>
          {client?.email && (
            <p className="text-xs text-muted-foreground">{client.email}</p>
          )}
          {client?.address && (
            <p className="whitespace-pre-line text-xs text-muted-foreground">
              {client.address}
            </p>
          )}
          {client?.taxId && (
            <p className="text-xs text-muted-foreground">Tax ID {client.taxId}</p>
          )}
        </div>
        <div>
          <p className="eyebrow">Issued</p>
          <p className="mt-1">{formatFullDate(invoice.issueDate)}</p>
        </div>
        <div>
          <p className="eyebrow">Due</p>
          <p className="mt-1">{formatFullDate(invoice.dueDate)}</p>
        </div>
      </div>

      {/* Line items */}
      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left">
              <th className="eyebrow py-2 font-medium">Description</th>
              <th className="eyebrow py-2 text-right font-medium">Qty</th>
              <th className="eyebrow py-2 text-right font-medium">Price</th>
              <th className="eyebrow py-2 text-right font-medium">Tax</th>
              <th className="eyebrow py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-border/40">
                <td className="py-2.5 pr-4">{l.description}</td>
                <td className="num py-2.5 text-right tabular-nums">
                  {l.quantity}
                </td>
                <td className="num py-2.5 text-right tabular-nums">
                  {formatMoney(l.unitPrice, { currency })}
                </td>
                <td className="num py-2.5 text-right tabular-nums text-muted-foreground">
                  {l.taxRate ? `${l.taxRate}%` : "—"}
                </td>
                <td className="num py-2.5 text-right font-medium tabular-nums">
                  {formatMoney(l.amount + lineTax(l), { currency })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="mt-6 flex justify-end">
        <dl className="w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="num tabular-nums">
              {formatMoney(invoice.subtotal, { currency })}
            </dd>
          </div>
          {invoice.discountTotal > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="num tabular-nums">
                −{formatMoney(invoice.discountTotal, { currency })}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tax</dt>
            <dd className="num tabular-nums">
              {formatMoney(invoice.taxTotal, { currency })}
            </dd>
          </div>
          <div className="flex justify-between border-t border-border/60 pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="num tabular-nums">
              {formatMoney(invoice.total, { currency })}
            </dd>
          </div>
          {invoice.amountPaid > 0 && (
            <>
              <div className="flex justify-between text-income">
                <dt>Paid</dt>
                <dd className="num tabular-nums">
                  {formatMoney(invoice.amountPaid, { currency })}
                </dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Due</dt>
                <dd className="num tabular-nums">
                  {formatMoney(due, { currency })}
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {/* Payment details */}
      {invoice.paymentAccount && (
        <div className="mt-8 rounded-xl border border-border/60 bg-surface p-4">
          <p className="eyebrow">Payment details</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
            {invoice.paymentAccount.bankName && (
              <Field label="Bank" value={invoice.paymentAccount.bankName} />
            )}
            <Field label="Account name" value={invoice.paymentAccount.accountName} />
            {invoice.paymentAccount.accountNumber && (
              <Field
                label="Account no."
                value={invoice.paymentAccount.accountNumber}
                mono
              />
            )}
            {invoice.paymentAccount.iban && (
              <Field label="IBAN" value={invoice.paymentAccount.iban} mono />
            )}
            {invoice.paymentAccount.swift && (
              <Field
                label="SWIFT / BIC"
                value={invoice.paymentAccount.swift}
                mono
              />
            )}
            {invoice.paymentAccount.branchCode && (
              <Field
                label="Branch code"
                value={invoice.paymentAccount.branchCode}
                mono
              />
            )}
          </dl>
          {invoice.paymentAccount.notes && (
            <p className="mt-3 whitespace-pre-line text-xs text-muted-foreground">
              {invoice.paymentAccount.notes}
            </p>
          )}
        </div>
      )}

      {/* Notes + terms */}
      {(invoice.notes || invoice.terms) && (
        <div className="mt-8 space-y-3 border-t border-border/60 pt-6 text-sm text-muted-foreground">
          {invoice.notes && (
            <div>
              <p className="eyebrow">Notes</p>
              <p className="mt-1 whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div>
              <p className="eyebrow">Terms</p>
              <p className="mt-1 whitespace-pre-line">{invoice.terms}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
