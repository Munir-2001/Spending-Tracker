"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppData } from "@/components/transactions/transactions-provider";
import { useInvoices } from "@/components/invoices/invoices-provider";
import { FieldToggles } from "@/components/invoices/field-toggles";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import type { Invoice, InvoiceLine } from "@/lib/data";
import type { NewInvoiceInput, NewInvoiceLine, InvoiceFieldPrefs } from "@/lib/schema";
import { CURRENCIES, currencyInfo, toMajorUnits, toMinorUnits } from "@/lib/currency";
import { invoiceTotals } from "@/lib/invoice";

type LineDraft = {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

const today = () => new Date().toISOString().slice(0, 10);
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const blankLine = (): LineDraft => ({
  description: "",
  quantity: "1",
  unitPrice: "",
  taxRate: "",
});

/**
 * Full-page invoice editor with a live preview: the form on the left, the exact
 * rendered <InvoiceDocument> on the right, updating as you type. Replaces the old
 * modal. `editing` is a fully-loaded invoice (with lines) or null for a new one.
 */
export function InvoiceBuilder({ editing }: { editing: Invoice | null }) {
  const router = useRouter();
  const { accounts, baseCurrency, invoicePrefs } = useAppData();
  const {
    clients,
    paymentAccounts,
    getClient,
    createInvoice,
    editInvoice,
    openAddClient,
    openAddPaymentAccount,
  } = useInvoices();
  const selectableAccounts = useMemo(
    () => accounts.filter((a) => !a.isGroup),
    [accounts]
  );
  const isEditing = Boolean(editing);

  const [clientId, setClientId] = useState(
    editing?.clientId ?? clients[0]?.id ?? ""
  );
  const [issueDate, setIssueDate] = useState(editing?.issueDate ?? today());
  const [dueDate, setDueDate] = useState(
    editing?.dueDate ?? addDays(today(), 14)
  );
  const [currency, setCurrency] = useState(
    editing?.currency ?? clients[0]?.currency ?? baseCurrency
  );
  const [accountId, setAccountId] = useState(editing?.accountId ?? "none");
  const [paymentAccountId, setPaymentAccountId] = useState(
    editing?.paymentAccountId ??
      paymentAccounts.find((p) => p.isDefault)?.id ??
      "none"
  );
  const [prefs, setPrefs] = useState<InvoiceFieldPrefs>(
    editing?.fieldPrefs ?? invoicePrefs
  );
  const [discount, setDiscount] = useState(
    editing?.discountTotal
      ? String(toMajorUnits(editing.discountTotal, editing.currency))
      : ""
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [terms, setTerms] = useState(editing?.terms ?? "");
  const [lines, setLines] = useState<LineDraft[]>(
    editing?.lines?.length
      ? editing.lines.map((l) => ({
          description: l.description,
          quantity: String(l.quantity),
          unitPrice: String(toMajorUnits(l.unitPrice, editing.currency)),
          taxRate: l.taxRate != null ? String(l.taxRate) : "",
        }))
      : [blankLine()]
  );

  function pickClient(id: string) {
    setClientId(id);
    if (!editing) {
      const c = clients.find((x) => x.id === id);
      if (c) setCurrency(c.currency);
    }
  }
  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  const addLine = () => setLines((prev) => [...prev, blankLine()]);
  const removeLine = (i: number) =>
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)
    );

  // Numeric line math honoring prefs — shared by the live totals AND the preview.
  const mathLines = useMemo(
    () =>
      lines.map((l) => {
        const quantity = prefs.quantity ? Number.parseFloat(l.quantity) || 0 : 1;
        const unitPrice = toMinorUnits(
          Number.parseFloat(l.unitPrice) || 0,
          currency
        );
        const taxRate =
          prefs.tax && l.taxRate.trim() ? Number.parseFloat(l.taxRate) || 0 : null;
        return {
          description: l.description,
          quantity,
          unitPrice,
          amount: Math.round(quantity * unitPrice),
          taxRate,
        };
      }),
    [lines, prefs, currency]
  );

  const discountMinor = prefs.discount
    ? toMinorUnits(Number.parseFloat(discount) || 0, currency)
    : 0;
  const totals = useMemo(
    () => invoiceTotals(mathLines, discountMinor),
    [mathLines, discountMinor]
  );

  // The exact object the preview <InvoiceDocument> renders.
  const preview: Invoice = {
    id: editing?.id ?? "preview",
    clientId,
    number: editing?.number ?? "INV-—",
    status: editing?.status ?? "draft",
    overdue: editing?.overdue ?? false,
    issueDate,
    dueDate,
    currency,
    subtotal: totals.subtotal,
    discountTotal: discountMinor,
    taxTotal: totals.taxTotal,
    total: totals.total,
    amountPaid: editing?.amountPaid ?? 0,
    accountId: accountId === "none" ? null : accountId,
    paymentAccountId: paymentAccountId === "none" ? null : paymentAccountId,
    notes: notes.trim() || null,
    terms: terms.trim() || null,
    publicToken: editing?.publicToken ?? null,
    sentAt: editing?.sentAt ?? null,
    paidAt: editing?.paidAt ?? null,
    fieldPrefs: prefs,
    lines: mathLines
      .filter((l) => l.description.trim() || l.unitPrice)
      .map((l, i): InvoiceLine => ({
        id: `p${i}`,
        description: l.description || "—",
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        amount: l.amount,
        taxRate: l.taxRate,
      })),
    paymentAccount:
      paymentAccountId === "none"
        ? null
        : paymentAccounts.find((p) => p.id === paymentAccountId) ?? null,
  };

  function save() {
    if (!clientId) return toast.error("Pick a client.");
    const cleaned: NewInvoiceLine[] = [];
    for (const l of lines) {
      const desc = l.description.trim();
      const qty = Number.parseFloat(l.quantity);
      const price = Number.parseFloat(l.unitPrice);
      if (!desc && !l.unitPrice.trim()) continue;
      if (!desc) return toast.error("Every line needs a description.");
      if (!Number.isFinite(qty) || qty <= 0)
        return toast.error("Quantity must be greater than zero.");
      if (!Number.isFinite(price))
        return toast.error("Enter a unit price for every line.");
      const rate = l.taxRate.trim() ? Number.parseFloat(l.taxRate) : null;
      if (rate != null && (!Number.isFinite(rate) || rate < 0 || rate > 100))
        return toast.error("Tax rate must be between 0 and 100.");
      cleaned.push({
        description: desc,
        quantity: qty,
        unitPrice: toMinorUnits(price, currency),
        taxRate: rate,
      });
    }
    if (!cleaned.length) return toast.error("Add at least one line item.");

    const input: NewInvoiceInput = {
      clientId,
      issueDate,
      dueDate,
      currency,
      discountTotal: toMinorUnits(Number.parseFloat(discount) || 0, currency),
      accountId: accountId === "none" ? null : accountId,
      paymentAccountId: paymentAccountId === "none" ? null : paymentAccountId,
      notes: notes.trim() || null,
      terms: terms.trim() || null,
      fieldPrefs: prefs,
      lines: cleaned,
    };

    if (editing) {
      editInvoice(editing.id, input);
      toast.success("Invoice updated");
      router.push(`/invoices/${editing.id}`);
    } else {
      createInvoice(input);
      toast.success("Invoice created");
      router.push("/invoices");
    }
  }

  const symbol = currencyInfo(currency).symbol;
  const gridCols = [
    "1fr",
    prefs.quantity ? "4rem" : null,
    "6rem",
    prefs.tax ? "4rem" : null,
    "2rem",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={editing ? `/invoices/${editing.id}` : "/invoices"}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {editing ? editing.number : "Invoices"}
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() =>
              router.push(editing ? `/invoices/${editing.id}` : "/invoices")
            }
          >
            Cancel
          </Button>
          <Button onClick={save}>
            {isEditing ? "Save changes" : "Create invoice"}
          </Button>
        </div>
      </div>

      <h1 className="display mt-4 text-2xl tracking-tight md:text-3xl">
        {isEditing ? `Edit ${editing?.number}` : "New invoice"}
      </h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* ── Form ────────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Client + currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Client</Label>
                <button
                  type="button"
                  onClick={openAddClient}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  + New
                </button>
              </div>
              <Select value={clientId} onValueChange={pickClient}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} · {c.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-issue">Issue date</Label>
              <Input
                id="inv-issue"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-due">Due date</Label>
              <Input
                id="inv-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Fields on this invoice */}
          <div className="space-y-2">
            <Label>Fields on this invoice</Label>
            <FieldToggles value={prefs} onChange={setPrefs} />
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <Label>Line items</Label>
            <div className="space-y-2">
              <div
                className="hidden gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid"
                style={{ gridTemplateColumns: gridCols }}
              >
                <span>Description</span>
                {prefs.quantity && <span className="text-right">Qty</span>}
                <span className="text-right">Price</span>
                {prefs.tax && <span className="text-right">Tax %</span>}
                <span />
              </div>
              {lines.map((l, i) => (
                <div
                  key={i}
                  className="grid gap-2"
                  style={{ gridTemplateColumns: gridCols }}
                >
                  <Input
                    value={l.description}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                    placeholder="Consulting — 5 hrs"
                    aria-label="Description"
                  />
                  {prefs.quantity && (
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={l.quantity}
                      onChange={(e) => updateLine(i, { quantity: e.target.value })}
                      className="num text-right"
                      aria-label="Quantity"
                    />
                  )}
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={l.unitPrice}
                    onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                    placeholder="0"
                    className="num text-right"
                    aria-label="Unit price"
                  />
                  {prefs.tax && (
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      max="100"
                      value={l.taxRate}
                      onChange={(e) => updateLine(i, { taxRate: e.target.value })}
                      placeholder="0"
                      className="num text-right"
                      aria-label="Tax rate"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    disabled={lines.length === 1}
                    className="flex items-center justify-center text-muted-foreground transition-colors hover:text-expense disabled:opacity-30"
                    aria-label="Remove line"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={addLine}
            >
              <Plus className="size-4" />
              Add line
            </Button>
          </div>

          {/* Discount */}
          {prefs.discount && (
            <div className="max-w-[12rem] space-y-1.5">
              <Label htmlFor="inv-discount">Discount</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {symbol}
                </span>
                <Input
                  id="inv-discount"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                  className="num pl-7"
                />
              </div>
            </div>
          )}

          {/* Payment method (shown on invoice) + deposit account (ledger) */}
          <div className="grid grid-cols-2 gap-3">
            {prefs.paymentDetails ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Payment details</Label>
                  <button
                    type="button"
                    onClick={openAddPaymentAccount}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    + New
                  </button>
                </div>
                <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Bank shown on invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {paymentAccounts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label} · {p.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div />
            )}
            <div className="space-y-1.5">
              <Label>Deposit account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Where payments land" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose on payment</SelectItem>
                  {selectableAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.institution ? ` · ${a.institution}` : ""} · {a.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(prefs.notes || prefs.terms) && (
            <div className="grid grid-cols-2 gap-3">
              {prefs.notes && (
                <div className="space-y-1.5">
                  <Label htmlFor="inv-notes">Notes</Label>
                  <Input
                    id="inv-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Thanks for your business"
                  />
                </div>
              )}
              {prefs.terms && (
                <div className="space-y-1.5">
                  <Label htmlFor="inv-terms">Terms</Label>
                  <Input
                    id="inv-terms"
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    placeholder="Net 14 · bank details"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Live preview ─────────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="eyebrow mb-2">Preview</p>
          <div className="lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <InvoiceDocument
              invoice={preview}
              client={getClient(clientId) ?? undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
