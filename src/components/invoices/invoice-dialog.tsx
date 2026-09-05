"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { getInvoice } from "@/server/actions";
import type { Client, Invoice, PaymentAccount } from "@/lib/data";
import type { NewInvoiceInput, NewInvoiceLine } from "@/lib/schema";
import {
  CURRENCIES,
  currencyInfo,
  toMajorUnits,
  toMinorUnits,
} from "@/lib/currency";
import { invoiceTotals } from "@/lib/invoice";
import { formatMoney } from "@/lib/format";

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

export function InvoiceDialog({
  open,
  onOpenChange,
  onCreate,
  onSave,
  editing,
  clients,
  paymentAccounts,
  onAddClient,
  onAddPaymentAccount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: NewInvoiceInput) => void;
  onSave: (id: string, input: NewInvoiceInput) => void;
  editing: Invoice | null;
  clients: Client[];
  paymentAccounts: PaymentAccount[];
  onAddClient: () => void;
  onAddPaymentAccount: () => void;
}) {
  const { accounts, baseCurrency } = useAppData();
  const selectableAccounts = useMemo(
    () => accounts.filter((a) => !a.isGroup),
    [accounts]
  );
  const isEditing = Boolean(editing);

  const [clientId, setClientId] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(addDays(today(), 14));
  const [currency, setCurrency] = useState(baseCurrency);
  const [accountId, setAccountId] = useState<string>("none");
  const [paymentAccountId, setPaymentAccountId] = useState<string>("none");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setClientId(editing.clientId ?? "");
      setIssueDate(editing.issueDate);
      setDueDate(editing.dueDate);
      setCurrency(editing.currency);
      setAccountId(editing.accountId ?? "none");
      setPaymentAccountId(editing.paymentAccountId ?? "none");
      setDiscount(
        editing.discountTotal
          ? String(toMajorUnits(editing.discountTotal, editing.currency))
          : ""
      );
      setNotes(editing.notes ?? "");
      setTerms(editing.terms ?? "");
      // List invoices don't carry lines — fetch the full record if needed.
      if (editing.lines && editing.lines.length) {
        setLines(
          editing.lines.map((l) => ({
            description: l.description,
            quantity: String(l.quantity),
            unitPrice: String(toMajorUnits(l.unitPrice, editing.currency)),
            taxRate: l.taxRate != null ? String(l.taxRate) : "",
          }))
        );
      } else {
        setLines([blankLine()]);
        getInvoice(editing.id)
          .then((full) => {
            if (full?.lines?.length) {
              setLines(
                full.lines.map((l) => ({
                  description: l.description,
                  quantity: String(l.quantity),
                  unitPrice: String(toMajorUnits(l.unitPrice, full.currency)),
                  taxRate: l.taxRate != null ? String(l.taxRate) : "",
                }))
              );
            }
          })
          .catch(() => {});
      }
    } else {
      setClientId(clients[0]?.id ?? "");
      setIssueDate(today());
      setDueDate(addDays(today(), 14));
      setCurrency(clients[0]?.currency ?? baseCurrency);
      setAccountId("none");
      setPaymentAccountId(
        paymentAccounts.find((p) => p.isDefault)?.id ?? "none"
      );
      setDiscount("");
      setNotes("");
      setTerms("");
      setLines([blankLine()]);
    }
  }, [open, editing, clients, paymentAccounts, baseCurrency]);

  // When the client changes on a new invoice, follow their billing currency.
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
  function addLine() {
    setLines((prev) => [...prev, blankLine()]);
  }
  function removeLine(i: number) {
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)
    );
  }

  // Live totals — mirror the server math exactly (per-line tax + discount).
  const totals = useMemo(() => {
    const math = lines.map((l) => ({
      quantity: Number.parseFloat(l.quantity) || 0,
      unitPrice: toMinorUnits(Number.parseFloat(l.unitPrice) || 0, currency),
      taxRate: l.taxRate.trim() ? Number.parseFloat(l.taxRate) || 0 : null,
    }));
    const discountMinor = toMinorUnits(Number.parseFloat(discount) || 0, currency);
    return invoiceTotals(math, discountMinor);
  }, [lines, discount, currency]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) return toast.error("Pick a client.");
    const cleaned: NewInvoiceLine[] = [];
    for (const l of lines) {
      const desc = l.description.trim();
      const qty = Number.parseFloat(l.quantity);
      const price = Number.parseFloat(l.unitPrice);
      if (!desc && !l.unitPrice.trim()) continue; // skip empty rows
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
      lines: cleaned,
    };

    if (editing) {
      onSave(editing.id, input);
      toast.success("Invoice updated");
    } else {
      onCreate(input);
      toast.success("Invoice created");
    }
    onOpenChange(false);
  }

  const symbol = currencyInfo(currency).symbol;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="display text-xl">
            {isEditing ? `Edit ${editing?.number}` : "New invoice"}
          </DialogTitle>
          <DialogDescription>
            Line items, tax, and dates. Totals update as you type.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Client + currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Client</Label>
                <button
                  type="button"
                  onClick={onAddClient}
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

          {/* Line items */}
          <div className="space-y-2">
            <Label>Line items</Label>
            <div className="space-y-2">
              {/* Column headers */}
              <div className="hidden grid-cols-[1fr_4rem_6rem_4rem_2rem] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Price</span>
                <span className="text-right">Tax %</span>
                <span />
              </div>
              {lines.map((l, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_4rem_6rem_4rem_2rem] gap-2"
                >
                  <Input
                    value={l.description}
                    onChange={(e) =>
                      updateLine(i, { description: e.target.value })
                    }
                    placeholder="Consulting — 5 hrs"
                    aria-label="Description"
                  />
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

          {/* Discount + totals */}
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/60 bg-surface p-4">
            <div className="space-y-1.5">
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
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="num tabular-nums">
                  {formatMoney(totals.subtotal, { currency })}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="num tabular-nums">
                  {formatMoney(totals.taxTotal, { currency })}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border/60 pt-1 font-semibold">
                <dt>Total</dt>
                <dd className="num tabular-nums">
                  {formatMoney(totals.total, { currency })}
                </dd>
              </div>
            </dl>
          </div>

          {/* Payment method (shown on invoice) + deposit account (ledger) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Payment details</Label>
                <button
                  type="button"
                  onClick={onAddPaymentAccount}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  + New
                </button>
              </div>
              <Select
                value={paymentAccountId}
                onValueChange={setPaymentAccountId}
              >
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
                      {a.name} · {a.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-notes">Notes</Label>
              <Input
                id="inv-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Thanks for your business"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-terms">Terms</Label>
              <Input
                id="inv-terms"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Net 14 · bank details"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {isEditing ? "Save changes" : "Create invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
