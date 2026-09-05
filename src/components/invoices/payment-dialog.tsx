"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { Invoice } from "@/lib/data";
import type { InvoicePaymentInput } from "@/lib/schema";
import { currencyInfo, toMajorUnits, toMinorUnits } from "@/lib/currency";
import { amountDue } from "@/lib/invoice";
import { formatMoney } from "@/lib/format";

const today = () => new Date().toISOString().slice(0, 10);

export function PaymentDialog({
  open,
  onOpenChange,
  invoice,
  onPay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onPay: (input: InvoicePaymentInput) => Promise<void>;
}) {
  const { accounts } = useAppData();
  const selectableAccounts = useMemo(
    () => accounts.filter((a) => !a.isGroup),
    [accounts]
  );

  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const due = invoice ? amountDue(invoice.total, invoice.amountPaid) : 0;

  useEffect(() => {
    if (!open || !invoice) return;
    setSaving(false);
    setAccountId(invoice.accountId ?? selectableAccounts[0]?.id ?? "");
    setAmount(String(toMajorUnits(due, invoice.currency)));
    setDate(today());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    if (!accountId) return toast.error("Pick an account.");
    const major = Number.parseFloat(amount);
    if (!Number.isFinite(major) || major <= 0)
      return toast.error("Enter a payment amount.");
    setSaving(true);
    await onPay({
      invoiceId: invoice.id,
      accountId,
      amount: toMinorUnits(major, invoice.currency),
      date,
    });
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="display text-xl">Record payment</DialogTitle>
          <DialogDescription>
            {invoice
              ? `${invoice.number} · ${formatMoney(due, {
                  currency: invoice.currency,
                })} due. This posts income to the chosen account.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Deposit to</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose account" />
              </SelectTrigger>
              <SelectContent>
                {selectableAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">
                Amount ({invoice?.currency ?? ""})
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {invoice ? currencyInfo(invoice.currency).symbol : ""}
                </span>
                <Input
                  id="pay-amount"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="num pl-7"
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Date</Label>
              <Input
                id="pay-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
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
            <Button type="submit" disabled={saving}>
              {saving ? "Recording…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
