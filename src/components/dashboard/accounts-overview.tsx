"use client";

import {
  Landmark,
  PiggyBank,
  CreditCard,
  Banknote,
  TrendingUp,
  Folder,
  Wallet,
  Plus,
} from "lucide-react";

import type { Account } from "@/lib/data";
import type { AccountSubtype } from "@/lib/schema";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/components/transactions/transactions-provider";

const icons: Record<string, typeof Landmark> = {
  checking: Landmark,
  savings: PiggyBank,
  credit_card: CreditCard,
  cash: Banknote,
  investment: TrendingUp,
};

function iconFor(subtype: AccountSubtype | null) {
  return (subtype && icons[subtype]) || Wallet;
}

export function AccountsOverview() {
  const { accounts, balanceOf, openAddAccount } = useAppData();

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Wallet className="size-5" />
        </span>
        <p className="text-sm text-muted-foreground">No accounts yet.</p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={openAddAccount}>
          <Plus className="size-4" />
          Add account
        </Button>
      </div>
    );
  }

  const topLevel = accounts.filter((a) => !a.parentId);

  return (
    <ul className="space-y-1">
      {topLevel.map((a) =>
        a.isGroup ? (
          <li key={a.id}>
            <div className="flex items-center gap-2 px-2 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Folder className="size-3.5" />
              {a.name}
            </div>
            <ul className="space-y-1">
              {accounts
                .filter((c) => c.parentId === a.id)
                .map((c) => (
                  <AccountRow key={c.id} account={c} balance={balanceOf(c.id)} indented />
                ))}
            </ul>
          </li>
        ) : (
          <AccountRow key={a.id} account={a} balance={balanceOf(a.id)} />
        )
      )}
    </ul>
  );
}

function AccountRow({
  account,
  balance,
  indented = false,
}: {
  account: Account;
  balance: number;
  indented?: boolean;
}) {
  const Icon = iconFor(account.subtype);
  const owed = balance < 0;
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50",
        indented && "ml-3"
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{account.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {account.institution ? `${account.institution} · ` : ""}
          <span className="num">{account.currency}</span>
        </p>
      </div>
      <p
        className={cn(
          "num text-sm font-medium tabular-nums",
          owed ? "text-expense" : "text-foreground"
        )}
      >
        {formatMoney(balance, { currency: account.currency })}
      </p>
    </li>
  );
}
