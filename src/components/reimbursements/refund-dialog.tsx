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
import { Segmented } from "@/components/ui/segmented";
import { useAppData } from "@/components/transactions/transactions-provider";
import {
  RepaymentTermsFields,
  defaultReceived,
  useRepaymentTerms,
} from "@/components/reimbursements/repayment-terms";
import { currencyInfo, toMajorUnits } from "@/lib/currency";
import type { Transaction } from "@/lib/data";
import { formatMoney } from "@/lib/format";
import { claimRemaining, repaymentsByClaim } from "@/lib/reimbursement";

const today = () => new Date().toISOString().slice(0, 10);

/** How many already-recorded inflows to offer when linking a payment. */
const LINK_CANDIDATES = 40;

type Mode = "new" | "link";

/**
 * Record a refund for a reimbursable expense, choosing WHERE the money landed —
 * a friend may pay you back into a different account (or currency) than the one
 * you paid from, in part or in full. If the money is already in the ledger as a
 * normal inflow, link that instead so it isn't counted twice.
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
  const { accounts, items, fx, recordRepayment, getAccount } = useAppData();
  const selectable = useMemo(() => accounts.filter((a) => !a.isGroup), [accounts]);
  const remaining = useMemo(
    () => claimRemaining(claim, repaymentsByClaim(items).get(claim.id) ?? [], fx),
    [claim, items, fx]
  );

  // Inflows already in the ledger that could be this repayment: money in, not a
  // transfer/invoice/other repayment, on or after the claim date. Newest first.
  const candidates = useMemo(
    () =>
      items
        .filter(
          (t) =>
            t.amount > 0 &&
            !t.isTransfer &&
            !t.isReimbursement &&
            !t.settlesId &&
            !t.invoiceId &&
            t.date >= claim.date
        )
        .slice(0, LINK_CANDIDATES),
    [items, claim.date]
  );

  const [mode, setMode] = useState<Mode>("new");
  const [accountId, setAccountId] = useState(claim.accountId);
  const [existingId, setExistingId] = useState("");
  const existing = candidates.find((t) => t.id === existingId);
  const account = selectable.find((a) => a.id === accountId);
  const currency =
    mode === "link" ? (existing?.currency ?? claim.currency) : (account?.currency ?? claim.currency);

  const [amount, setAmount] = useState(() =>
    defaultReceived(remaining, claim.currency, claim.currency, fx)
  );
  const [date, setDate] = useState(today);
  const linkedAmount = existing
    ? String(toMajorUnits(existing.amount, existing.currency))
    : "";

  const terms = useRepaymentTerms({
    claim,
    remaining,
    currency,
    amount: mode === "link" ? linkedAmount : amount,
    setAmount,
    fx,
    amountLocked: mode === "link",
  });
  const reimb = claim.reimbursement;

  function submit() {
    if (mode === "link" && !existing) return toast.error("Choose the payment to link.");
    if (mode === "new" && !account) return toast.error("Choose the account the money went into.");
    const res = terms.toInput();
    if (!res.ok) return toast.error(res.error);
    recordRepayment({
      claimId: claim.id,
      accountId: existing?.accountId ?? account!.id,
      amount: res.amount,
      currency,
      date: existing?.date ?? date,
      fxRate: res.fxRate,
      settle: res.settle,
      existingId: existing?.id,
    });
    onDone();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Mark refunded</DialogTitle>
        <DialogDescription>
          {reimb?.person || "Someone"} owes{" "}
          {formatMoney(remaining, { currency: claim.currency })}
          {remaining !== reimb?.amount &&
            ` (of ${formatMoney(reimb?.amount ?? 0, { currency: claim.currency })})`}{" "}
          for {claim.merchant}. Refunds never count as income.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <Segmented
          value={mode}
          onChange={setMode}
          ariaLabel="Repayment source"
          options={[
            { value: "new", label: "New payment" },
            { value: "link", label: "Already recorded" },
          ]}
        />

        {mode === "link" ? (
          <div className="space-y-1.5">
            <Label>Payment that repaid this</Label>
            {candidates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                No incoming payments on or after {claim.date} to link.
              </p>
            ) : (
              <Select value={existingId} onValueChange={setExistingId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a payment" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.date} · {t.merchant} ·{" "}
                      {formatMoney(t.amount, { currency: t.currency })}
                      <span className="text-muted-foreground">
                        {" "}· {getAccount(t.accountId)?.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>Refunded to</Label>
              <Select
                value={accountId}
                onValueChange={(v) => {
                  setAccountId(v);
                  const next = selectable.find((a) => a.id === v);
                  if (next) setAmount(defaultReceived(remaining, claim.currency, next.currency, fx));
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
                  onChange={(e) => terms.onAmountChange(e.target.value)}
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
          </>
        )}

        {(mode === "new" || existing) && <RepaymentTermsFields terms={terms} />}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit}>{mode === "link" ? "Link payment" : "Record refund"}</Button>
      </DialogFooter>
    </>
  );
}
