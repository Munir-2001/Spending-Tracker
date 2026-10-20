"use client";

import { useMemo } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppData } from "@/components/transactions/transactions-provider";
import { fundingOutflow } from "@/lib/asset-funding";
import { formatMoney } from "@/lib/format";

/** Select value for "this purchase isn't linked to an account". */
export const NOT_LINKED = "none";

/**
 * "Paid from" picker for a gold/crypto purchase. Choosing an account deducts the
 * purchase's cost basis from it as a transfer (an asset swap, never spending).
 * Shared by the Add asset form (first purchase) and Add purchase (later lots).
 */
export function PaidFromField({
  value,
  onChange,
  costMinor,
  currency,
}: {
  value: string;
  onChange: (accountId: string) => void;
  costMinor: number; // cost basis in minor units of `currency`
  currency: string;
}) {
  const { accounts, fx } = useAppData();
  const payable = useMemo(() => accounts.filter((a) => !a.isGroup), [accounts]);
  const payer = payable.find((a) => a.id === value) ?? null;
  const outflow = payer
    ? fundingOutflow({ costBasis: costMinor, currency }, payer.currency, fx.rates)
    : null;

  return (
    <div className="space-y-1.5">
      <Label>Paid from</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NOT_LINKED}>Not linked to an account</SelectItem>
          {payable.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name} · {a.currency}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">
        {payer && outflow
          ? `${formatMoney(Math.abs(outflow.amount), { currency: outflow.currency })} leaves ${payer.name} — recorded as a transfer, not spending.`
          : "Pick the account you paid with to deduct it from that balance."}
      </p>
    </div>
  );
}

/** The chosen account id, or null when the purchase isn't linked. */
export function paidFromAccountId(value: string): string | null {
  return value === NOT_LINKED ? null : value;
}
