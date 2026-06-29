"use client";

import { useMemo } from "react";
import {
  Landmark,
  PiggyBank,
  CreditCard,
  Banknote,
  TrendingUp,
  Folder,
  Wallet,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Scale,
} from "lucide-react";

import type { Account } from "@/lib/data";
import type { AccountSubtype } from "@/lib/schema";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppData } from "@/components/transactions/transactions-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { formatMoney } from "@/lib/format";
import { assetsBase, pendingReceivablesBase } from "@/lib/compute";
import { cn } from "@/lib/utils";

const icons: Record<string, typeof Landmark> = {
  checking: Landmark,
  savings: PiggyBank,
  credit_card: CreditCard,
  cash: Banknote,
  investment: TrendingUp,
};
const iconFor = (s: AccountSubtype | null) => (s && icons[s]) || Wallet;

export default function AccountsPage() {
  const {
    accounts,
    items,
    assets,
    balanceOf,
    openAddAccount,
    openEditAccount,
    deleteAccount,
    openAdjustBalance,
    baseCurrency,
    fx,
  } = useAppData();
  const confirm = useConfirm();

  async function confirmDelete(account: Account) {
    const ok = await confirm({
      title: account.isGroup ? "Delete group?" : "Delete account?",
      description: account.isGroup
        ? `“${account.name}” will be removed. Its sub-accounts stay but become top-level.`
        : `“${account.name}” will be removed. Any transactions on it are kept but no longer counted in a balance.`,
      confirmText: "Delete",
      tone: "danger",
    });
    if (ok) deleteAccount(account.id);
  }

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, Account[]>();
    for (const a of accounts) {
      const key = a.parentId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [accounts]);

  // Per-currency totals across all leaf (non-group) accounts.
  const perCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    for (const a of accounts) {
      if (a.isGroup) continue;
      totals.set(a.currency, (totals.get(a.currency) ?? 0) + balanceOf(a.id));
    }
    return [...totals.entries()];
  }, [accounts, balanceOf]);

  const receivables = pendingReceivablesBase(items, fx);
  const baseTotal =
    perCurrency.reduce((sum, [cur, amt]) => sum + fx.toBase(amt, cur), 0) +
    receivables +
    assetsBase(assets, fx);

  // Roll up a group's leaf descendants into per-currency subtotals.
  function groupSubtotals(groupId: string): [string, number][] {
    const totals = new Map<string, number>();
    const walk = (id: string) => {
      for (const c of childrenOf.get(id) ?? []) {
        if (c.isGroup) walk(c.id);
        else totals.set(c.currency, (totals.get(c.currency) ?? 0) + balanceOf(c.id));
      }
    };
    walk(groupId);
    return [...totals.entries()];
  }

  const topLevel = childrenOf.get(null) ?? [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="display text-3xl tracking-tight md:text-4xl">Accounts</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Group accounts by region or currency. Sub-accounts roll up to their
              group.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openAddAccount}>
            <Plus className="size-4" />
            Add account
          </Button>
        </div>
      </Reveal>

      {accounts.length === 0 ? (
        <Reveal delay={0.05}>
          <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Wallet className="size-6" />
            </span>
            <div>
              <p className="font-medium">No accounts yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a group like “Pakistani Accounts”, then add your banks
                inside it — each in its own currency.
              </p>
            </div>
            <Button className="gap-1.5" onClick={openAddAccount}>
              <Plus className="size-4" />
              Add your first account
            </Button>
          </div>
        </Reveal>
      ) : (
        <>
          {/* Net worth rollup */}
          <Reveal delay={0.05}>
            <div className="mt-8 rounded-2xl border border-border/60 bg-primary p-6 text-primary-foreground">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground/60">
                Total net worth · {baseCurrency}
              </p>
              <p className="display amount-lg mt-2 text-4xl leading-none">
                {formatMoney(baseTotal, { currency: baseCurrency })}
              </p>
              {perCurrency.length > 1 && (
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-primary-foreground/70">
                  {perCurrency.map(([cur, amt]) => (
                    <span key={cur} className="num">
                      {formatMoney(amt, { currency: cur })}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Reveal>

          {/* Tree */}
          <Reveal delay={0.1}>
            <div className="mt-3 space-y-3">
              {topLevel.map((node) =>
                node.isGroup ? (
                  <div
                    key={node.id}
                    className="overflow-hidden rounded-2xl border border-border/60 bg-card"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Folder className="size-4 text-muted-foreground" />
                        {node.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="flex flex-wrap justify-end gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {groupSubtotals(node.id).map(([cur, amt]) => (
                            <span key={cur} className="num">
                              {formatMoney(amt, { currency: cur })}
                            </span>
                          ))}
                        </span>
                        <RowMenu
                          onEdit={() => openEditAccount(node)}
                          onDelete={() => confirmDelete(node)}
                        />
                      </div>
                    </div>
                    <ul className="divide-y divide-border/40 px-2 py-1">
                      {(childrenOf.get(node.id) ?? []).map((c) => (
                        <AccountRow
                          key={c.id}
                          account={c}
                          balance={balanceOf(c.id)}
                          onEdit={() => openEditAccount(c)}
                          onDelete={() => confirmDelete(c)}
                          onAdjust={() => openAdjustBalance(c)}
                        />
                      ))}
                      {(childrenOf.get(node.id) ?? []).length === 0 && (
                        <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                          No sub-accounts yet — add one and pick this group as its
                          parent.
                        </li>
                      )}
                    </ul>
                  </div>
                ) : (
                  <div
                    key={node.id}
                    className="rounded-2xl border border-border/60 bg-card px-2 py-1"
                  >
                    <AccountRow
                      account={node}
                      balance={balanceOf(node.id)}
                      onEdit={() => openEditAccount(node)}
                      onDelete={() => confirmDelete(node)}
                      onAdjust={() => openAdjustBalance(node)}
                    />
                  </div>
                )
              )}
            </div>
          </Reveal>
        </>
      )}
    </div>
  );
}

function AccountRow({
  account,
  balance,
  onEdit,
  onDelete,
  onAdjust,
}: {
  account: Account;
  balance: number;
  onEdit: () => void;
  onDelete: () => void;
  onAdjust: () => void;
}) {
  const Icon = iconFor(account.subtype);
  const owed = balance < 0;
  return (
    <div className="group/row flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/40">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{account.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {account.institution ? `${account.institution} · ` : ""}
          <span className="num">{account.currency}</span>
          {account.subtype ? ` · ${account.subtype.replace("_", " ")}` : ""}
          {account.accountNumber
            ? ` · ···· ${account.accountNumber.replace(/\s/g, "").slice(-4)}`
            : ""}
        </p>
      </div>
      <p
        className={cn(
          "num text-sm font-semibold tabular-nums",
          owed ? "text-expense" : "text-foreground"
        )}
      >
        {formatMoney(balance, { currency: account.currency })}
      </p>
      <RowMenu onEdit={onEdit} onDelete={onDelete} onAdjust={onAdjust} />
    </div>
  );
}

function RowMenu({
  onEdit,
  onDelete,
  onAdjust,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onAdjust?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          aria-label="Account actions"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onAdjust && (
          <DropdownMenuItem onClick={onAdjust}>
            <Scale className="size-4" />
            Reconcile balance
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
