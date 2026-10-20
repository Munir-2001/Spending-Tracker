"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppData } from "@/components/transactions/transactions-provider";
import { currencyInfo, toMajorUnits, toMinorUnits } from "@/lib/currency";
import type { Transaction } from "@/lib/data";
import { formatMoney } from "@/lib/format";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Record a refund for a reimbursable expense, choosing WHERE the money landed —
 * a friend may pay you back into a different account (or currency) than the one
 * you paid from. Defaults to the original account and the owed amount.
 */
export function RefundDialog({
  claim,
  onOpenChange,
}: {
  claim: Transaction | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(claim)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Keyed so each claim starts from fresh defaults. */}
        {claim && (
          <RefundForm key={claim.id} claim={claim} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RefundForm({ claim, onDone }: { claim: Transaction; onDone: () => void }) {
  const { accounts, fx, recordRepayment } = useAppData();
  const selectable = useMemo(() => accounts.filter((a) => !a.isGroup), [accounts]);

  // The owed amount, converted into the receiving account's currency.
  const owedIn = (targetCurrency: string) => {
    const owed = fx.convert(claim.reimbursement?.amount ?? 0, claim.currency, targetCurrency);
    return String(Math.abs(toMajorUnits(owed, targetCurrency)));
  };

  const [accountId, setAccountId] = useState(claim.accountId);
  const [amount, setAmount] = useState(() => owedIn(claim.currency));
  const [date, setDate] = useState(today);

  const account = selectable.find((a) => a.id === accountId);
  const currency = account?.currency ?? claim.currency;
  const reimb = claim.reimbursement;

  function submit() {
    if (!account) return toast.error("Choose the account the money went into.");
    const major = Number.parseFloat(amount);
    if (!Number.isFinite(major) || major <= 0)
      return toast.error("Enter the amount you received.");
    recordRepayment({
      claimId: claim.id,
      accountId: account.id,
      amount: toMinorUnits(major, currency),
      currency,
      date,
    });
    onDone();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Mark refunded</DialogTitle>
        <DialogDescription>
          {reimb?.person || "Someone"} owes{" "}
          {formatMoney(reimb?.amount ?? 0, { currency: claim.currency })} for{" "}
          {claim.merchant}. Refunds never count as income.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Refunded to</Label>
          <Select
            value={accountId}
            onValueChange={(v) => {
              setAccountId(v);
              const next = selectable.find((a) => a.id === v);
              if (next) setAmount(owedIn(next.currency));
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose an account" />
            </SelectTrigger>
            <SelectContent>
              {selectable.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="refund-amount">
              Amount received ({currencyInfo(currency).symbol})
            </Label>
            <Input
              id="refund-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="num"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refund-date">Date</Label>
            <Input
              id="refund-date"
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              className="num"
            />
          </div>
        </div>
        {currency !== claim.currency && (
          <p className="text-[11px] text-muted-foreground">
            Converted at today&apos;s rate — edit to match what actually arrived.
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit}>Record refund</Button>
      </DialogFooter>
    </>
  );
}
