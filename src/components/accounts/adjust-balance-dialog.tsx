"use client";

import { useEffect, useState } from "react";
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
import type { Account } from "@/lib/data";
import { currencyInfo, toMajorUnits, toMinorUnits } from "@/lib/currency";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppData } from "@/components/transactions/transactions-provider";

export function AdjustBalanceDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
}) {
  const { balanceOf, adjustBalance } = useAppData();
  const [actual, setActual] = useState("");

  const current = account ? balanceOf(account.id) : 0;
  const cur = account?.currency ?? "USD";

  useEffect(() => {
    if (open && account) setActual(String(toMajorUnits(current, cur)));
  }, [open, account]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!account) return null;

  const targetMajor = Number.parseFloat(actual);
  const targetMinor = Number.isFinite(targetMajor)
    ? toMinorUnits(targetMajor, cur)
    : current;
  const delta = targetMinor - current;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(targetMajor))
      return toast.error("Enter the account's actual balance.");
    adjustBalance(account!.id, targetMinor);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-xl">Reconcile balance</DialogTitle>
          <DialogDescription>
            Set {account.name} to its real balance. We post a one-line adjustment —
            it never counts as income or spending.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface px-4 py-3 text-sm">
            <span className="text-muted-foreground">Currently shown</span>
            <span className="num font-medium">{formatMoney(current, { currency: cur })}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="actual">Actual balance ({cur})</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {currencyInfo(cur).symbol}
              </span>
              <Input
                id="actual"
                type="number"
                inputMode="decimal"
                step="any"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                placeholder="0"
                className="num pl-7"
                autoFocus
              />
            </div>
          </div>

          {delta !== 0 && Number.isFinite(targetMajor) && (
            <p className="text-xs text-muted-foreground">
              Adjustment of{" "}
              <span
                className={cn(
                  "num font-medium",
                  delta > 0 ? "text-income" : "text-expense"
                )}
              >
                {formatMoney(delta, { currency: cur, signed: true })}
              </span>{" "}
              will be posted to reconcile.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={delta === 0}>
              Reconcile
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
