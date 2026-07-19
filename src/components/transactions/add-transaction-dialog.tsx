"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Wallet, Trash2, X } from "lucide-react";
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
import type { Account, Asset, Category, Transaction } from "@/lib/data";
import type { RepaymentInput, TransferInput } from "@/lib/schema";
import {
  CURRENCIES,
  currencyInfo,
  toMajorUnits,
  toMinorUnits,
  type Fx,
} from "@/lib/currency";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NewTransaction } from "@/components/transactions/transactions-provider";

type Kind = "expense" | "income" | "transfer";
type ItemRow = { key: string; description: string; categoryId: string; amount: string };
const today = () => new Date().toISOString().slice(0, 10);

let _itemKey = 0;
const keyGen = () => `it_${_itemKey++}`;

export function AddTransactionDialog({
  open,
  onOpenChange,
  onSubmit,
  onSave,
  onDelete,
  onRepayment,
  onTransfer,
  openClaims,
  editing,
  accounts,
  assets,
  categories,
  fx,
  defaultAccountId,
  onAddAccount,
  onAddAsset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (t: NewTransaction) => void;
  onSave: (id: string, t: NewTransaction) => void;
  onDelete: (id: string) => void;
  onRepayment: (input: RepaymentInput) => void;
  onTransfer: (input: TransferInput) => void;
  openClaims: Transaction[];
  editing: Transaction | null;
  accounts: Account[];
  assets: Asset[];
  categories: Category[];
  fx: Fx;
  defaultAccountId: string | null;
  onAddAccount: () => void;
  onAddAsset: () => void;
}) {
  const isEditing = Boolean(editing);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selectable = useMemo(() => accounts.filter((a) => !a.isGroup), [accounts]);
  const accountsById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === "expense"),
    [categories]
  );
  // Parents first, each followed by its sub-categories (depth 1), for the picker.
  const orderedExpenseCats = useMemo(() => {
    const out: { cat: Category; depth: number }[] = [];
    const seen = new Set<string>();
    for (const p of expenseCategories.filter((c) => !c.parentId)) {
      out.push({ cat: p, depth: 0 });
      seen.add(p.id);
      for (const ch of expenseCategories.filter((c) => c.parentId === p.id)) {
        out.push({ cat: ch, depth: 1 });
        seen.add(ch.id);
      }
    }
    for (const c of expenseCategories)
      if (!seen.has(c.id)) out.push({ cat: c, depth: 0 });
    return out;
  }, [expenseCategories]
  );
  const incomeCategory = useMemo(
    () => categories.find((c) => c.kind === "income"),
    [categories]
  );

  const [kind, setKind] = useState<Kind>("expense");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [date, setDate] = useState(today());
  const [itemized, setItemized] = useState(false);
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [reimbOn, setReimbOn] = useState(false);
  const [reimbPerson, setReimbPerson] = useState("");
  const [reimbAmount, setReimbAmount] = useState("");
  const [reimbNote, setReimbNote] = useState("");
  const [repayOn, setRepayOn] = useState(false);
  const [repayClaimId, setRepayClaimId] = useState("");
  // Transfer destination, encoded as "acc:<id>" or "ast:<id>".
  const [toTarget, setToTarget] = useState("");

  const blankItem = (): ItemRow => ({
    key: keyGen(),
    description: "",
    categoryId: expenseCategories[0]?.id ?? "",
    amount: "",
  });

  // Prefill (edit) or seed defaults (create) whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (editing) {
      const cur = editing.currency;
      setKind(editing.amount > 0 ? "income" : "expense");
      setMerchant(editing.merchant);
      setAmount(String(Math.abs(toMajorUnits(editing.amount, cur))));
      setCategoryId(editing.categoryId || expenseCategories[0]?.id || "");
      setAccountId(editing.accountId);
      setCurrency(cur);
      setDate(editing.date);
      if (editing.items && editing.items.length) {
        setItemized(true);
        setItemRows(
          editing.items.map((i) => ({
            key: keyGen(),
            description: i.description,
            categoryId: i.categoryId,
            amount: String(Math.abs(toMajorUnits(i.amount, cur))),
          }))
        );
      } else {
        setItemized(false);
        setItemRows([]);
      }
      if (editing.reimbursement) {
        setReimbOn(true);
        setReimbPerson(editing.reimbursement.person);
        setReimbAmount(String(Math.abs(toMajorUnits(editing.reimbursement.amount, cur))));
        setReimbNote(editing.reimbursement.note);
      } else {
        setReimbOn(false);
        setReimbPerson("");
        setReimbAmount("");
        setReimbNote("");
      }
      setRepayOn(false);
      setRepayClaimId("");
      setToTarget("");
    } else {
      setItemized(false);
      setItemRows([]);
      setReimbOn(false);
      setReimbPerson("");
      setReimbAmount("");
      setReimbNote("");
      setRepayOn(false);
      setRepayClaimId("");
      setToTarget("");
      // Seed with the user's default wallet (if it still exists), else the first.
      const seedId =
        (defaultAccountId && accountsById.has(defaultAccountId)
          ? defaultAccountId
          : selectable[0]?.id) || "";
      setAccountId((prev) => prev || seedId);
      setCurrency(accountsById.get(seedId)?.currency ?? "USD");
      setCategoryId((prev) => prev || expenseCategories[0]?.id || "");
    }
    // Initialize only when the dialog opens or a different transaction is loaded.
    // Must NOT depend on field state (accountId, etc.) — otherwise editing a field
    // re-runs this and resets the form (e.g. picking a new account snapped back).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const symbol = currencyInfo(currency).symbol;
  const transferMode = kind === "transfer" && !isEditing;
  const useItems = itemized && kind === "expense";
  const useReimb = reimbOn && kind === "expense" && !useItems;
  const useRepay = repayOn && kind === "income" && !isEditing;
  // Possible transfer destinations: other accounts + assets.
  const toOptions = useMemo(
    () => [
      ...selectable
        .filter((a) => a.id !== accountId)
        .map((a) => ({ value: `acc:${a.id}`, label: a.name, sub: a.currency })),
      ...assets.map((a) => ({
        value: `ast:${a.id}`,
        label: a.name,
        sub: `asset · ${a.currency}`,
      })),
    ],
    [selectable, assets, accountId]
  );
  const itemsTotal = itemRows.reduce(
    (s, r) => s + (Number.parseFloat(r.amount) || 0),
    0
  );

  function reset() {
    setKind("expense");
    setMerchant("");
    setAmount("");
    setCategoryId(expenseCategories[0]?.id ?? "");
    setAccountId(selectable[0]?.id ?? "");
    setCurrency(selectable[0]?.currency ?? "USD");
    setDate(today());
    setItemized(false);
    setItemRows([]);
    setReimbOn(false);
    setReimbPerson("");
    setReimbAmount("");
    setReimbNote("");
    setRepayOn(false);
    setRepayClaimId("");
    setToTarget("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Transfer: move money between an account and another account/asset.
    if (transferMode) {
      if (!accountId) return toast.error("Choose the account to transfer from.");
      if (!toTarget) return toast.error("Choose where to transfer to.");
      const major = Number.parseFloat(amount);
      if (!Number.isFinite(major) || major <= 0)
        return toast.error("Enter an amount greater than zero.");
      const [k, id] = toTarget.split(":");
      const toKind = k === "ast" ? "asset" : "account";
      const destCurrency =
        toKind === "asset"
          ? assets.find((a) => a.id === id)?.currency ?? currency
          : accountsById.get(id)?.currency ?? currency;
      const amountMinor = toMinorUnits(major, currency);
      const toAmount = fx.convert(amountMinor, currency, destCurrency);
      onTransfer({
        fromAccountId: accountId,
        toKind,
        toId: id,
        amount: amountMinor,
        toAmount,
        date,
        note: merchant.trim(),
      });
      reset();
      onOpenChange(false);
      return;
    }

    // Repayment: settles a chosen reimbursable expense, not income.
    if (useRepay) {
      if (!repayClaimId)
        return toast.error("Choose which expense this repays.");
      if (!accountId) return toast.error("Choose an account.");
      const major = Number.parseFloat(amount);
      if (!Number.isFinite(major) || major <= 0)
        return toast.error("Enter the amount received.");
      onRepayment({
        claimId: repayClaimId,
        accountId,
        amount: toMinorUnits(major, currency),
        currency,
        date,
      });
      reset();
      onOpenChange(false);
      return;
    }

    if (!merchant.trim()) return toast.error("Add a merchant or description.");
    if (!accountId) return toast.error("Choose an account.");

    let input: NewTransaction;

    if (useItems) {
      const rows = itemRows
        .map((r) => ({
          categoryId: r.categoryId,
          description: r.description.trim(),
          major: Number.parseFloat(r.amount),
        }))
        .filter((r) => Number.isFinite(r.major) && r.major > 0);
      if (rows.length === 0)
        return toast.error("Add at least one item with an amount.");

      const items = rows.map((r) => ({
        categoryId: r.categoryId,
        description: r.description,
        amount: -toMinorUnits(r.major, currency),
      }));
      const total = items.reduce((s, i) => s + i.amount, 0);
      input = {
        merchant: merchant.trim(),
        amount: total,
        categoryId: "",
        accountId,
        currency,
        date,
        items,
      };
    } else {
      const major = Number.parseFloat(amount);
      if (!Number.isFinite(major) || major <= 0)
        return toast.error("Enter an amount greater than zero.");
      const minor = toMinorUnits(major, currency);
      input = {
        merchant: merchant.trim(),
        amount: kind === "expense" ? -minor : minor,
        categoryId: kind === "income" ? incomeCategory?.id ?? "" : categoryId,
        accountId,
        currency,
        date,
      };

      if (useReimb) {
        const owedMajor = Number.parseFloat(reimbAmount);
        if (!reimbPerson.trim())
          return toast.error("Who did you buy this for?");
        if (!Number.isFinite(owedMajor) || owedMajor <= 0)
          return toast.error("Enter how much they owe you.");
        if (owedMajor > major)
          return toast.error("The reimbursable amount can't exceed the expense.");
        input.reimbursement = {
          person: reimbPerson.trim(),
          amount: toMinorUnits(owedMajor, currency),
          note: reimbNote.trim(),
        };
      }
    }

    if (editing) {
      onSave(editing.id, input);
      toast.success("Transaction updated", { description: merchant.trim() });
    } else {
      onSubmit(input);
      toast.success(`${kind === "expense" ? "Expense" : "Income"} recorded`, {
        description: `${merchant.trim()} · ${formatMoney(Math.abs(input.amount), {
          currency,
        })}`,
      });
    }
    reset();
    onOpenChange(false);
  }

  function handleDelete() {
    if (!editing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(editing.id);
    toast.success("Transaction deleted", { description: editing.merchant });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-xl">
            {isEditing ? "Edit transaction" : "New transaction"}
          </DialogTitle>
          <DialogDescription>
            Recorded as a balanced double-entry journal line.
          </DialogDescription>
        </DialogHeader>

        {selectable.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Wallet className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium">No accounts yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add an account before recording a transaction.
              </p>
            </div>
            <Button size="sm" className="gap-1.5" onClick={onAddAccount}>
              <Plus className="size-4" />
              Add an account
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div
              className={cn(
                "grid gap-1 rounded-lg border border-border/60 bg-muted/40 p-1",
                isEditing ? "grid-cols-2" : "grid-cols-3"
              )}
            >
              {(isEditing
                ? (["expense", "income"] as const)
                : (["expense", "income", "transfer"] as const)
              ).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setKind(k);
                    if (k !== "expense") {
                      setItemized(false);
                      setReimbOn(false);
                    }
                    if (k !== "income") setRepayOn(false);
                  }}
                  className={cn(
                    "rounded-md py-1.5 text-sm font-medium capitalize transition-colors",
                    kind === k
                      ? k === "expense"
                        ? "bg-expense/10 text-expense"
                        : k === "income"
                          ? "bg-income/10 text-income"
                          : "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>

            {/* Transfer destination (transfer mode only) */}
            {transferMode && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Transfer to</Label>
                  <button
                    type="button"
                    onClick={onAddAsset}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="size-3.5" />
                    New asset
                  </button>
                </div>
                {toOptions.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                    Add an account or asset to transfer into — tap “New asset”.
                  </p>
                ) : (
                  <Select value={toTarget} onValueChange={setToTarget}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {toOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}{" "}
                          <span className="text-muted-foreground">· {o.sub}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Moves money between holdings — not counted as income or spending.
                </p>
              </div>
            )}

            {/* Repayment option (income only) — settle a reimbursable expense */}
            {kind === "income" && !isEditing && (
              <button
                type="button"
                onClick={() => {
                  const next = !repayOn;
                  setRepayOn(next);
                  if (next && !repayClaimId && openClaims[0]) {
                    const c = openClaims[0];
                    setRepayClaimId(c.id);
                    setCurrency(c.currency);
                    setAmount(
                      String(Math.abs(toMajorUnits(c.reimbursement!.amount, c.currency)))
                    );
                  }
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
                  useRepay
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/60 hover:bg-muted/50"
                )}
              >
                <span className="font-medium">
                  A friend paying me back{" "}
                  <span className="font-normal text-muted-foreground">
                    (not income)
                  </span>
                </span>
                <span
                  className={cn(
                    "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors",
                    useRepay ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                >
                  <span
                    className={cn(
                      "size-4 rounded-full bg-background transition-transform",
                      useRepay && "translate-x-4"
                    )}
                  />
                </span>
              </button>
            )}

            {useRepay && (
              <div className="space-y-1.5">
                <Label>Repayment for</Label>
                {openClaims.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                    No open reimbursements to settle.
                  </p>
                ) : (
                  <Select
                    value={repayClaimId}
                    onValueChange={(v) => {
                      setRepayClaimId(v);
                      const c = openClaims.find((x) => x.id === v);
                      if (c) {
                        setCurrency(c.currency);
                        setAmount(
                          String(Math.abs(toMajorUnits(c.reimbursement!.amount, c.currency)))
                        );
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose an expense" />
                    </SelectTrigger>
                    <SelectContent>
                      {openClaims.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.reimbursement!.person} · {c.merchant} ·{" "}
                          {currencyInfo(c.currency).symbol}
                          {toMajorUnits(c.reimbursement!.amount, c.currency)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {!useRepay && (
              <div className="space-y-1.5">
                <Label htmlFor="merchant">
                  {transferMode ? "Note (optional)" : "Merchant / description"}
                </Label>
                <Input
                  id="merchant"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder={transferMode ? "Bought crypto" : "Carrefour"}
                  autoFocus={!transferMode}
                />
              </div>
            )}

            {/* Account that paid + the currency it was charged in */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{transferMode ? "From account" : "Account paid from"}</Label>
                <Select
                  value={accountId}
                  onValueChange={(v) => {
                    setAccountId(v);
                    const acc = accountsById.get(v);
                    if (acc) setCurrency(acc.currency);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectable.map((a) => {
                      const parent = a.parentId
                        ? accountsById.get(a.parentId)
                        : undefined;
                      return (
                        <SelectItem key={a.id} value={a.id}>
                          {parent ? `${parent.name} › ` : ""}
                          {a.name}{" "}
                          <span className="text-muted-foreground">· {a.currency}</span>
                        </SelectItem>
                      );
                    })}
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

            {(() => {
              const acc = accountsById.get(accountId);
              if (acc && currency !== acc.currency)
                return (
                  <p className="-mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Charged in {currency}, but {acc.name} is in {acc.currency} — the
                    balance will use today&apos;s conversion.
                  </p>
                );
              return null;
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div className={cn("space-y-1.5", useItems && "col-span-2")}>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="num"
                />
              </div>
              {!useItems && (
                <div className="space-y-1.5">
                  <Label htmlFor="amount">Amount ({currency})</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {symbol}
                    </span>
                    <Input
                      id="amount"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="num pl-7"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Itemize toggle (expenses only, not while reimbursing) */}
            {kind === "expense" && !reimbOn && (
              <button
                type="button"
                onClick={() => {
                  const next = !itemized;
                  setItemized(next);
                  if (next && itemRows.length === 0) setItemRows([blankItem()]);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
                  useItems
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/60 hover:bg-muted/50"
                )}
              >
                <span className="font-medium">Itemize into categories</span>
                <span
                  className={cn(
                    "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors",
                    useItems ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                >
                  <span
                    className={cn(
                      "size-4 rounded-full bg-background transition-transform",
                      useItems && "translate-x-4"
                    )}
                  />
                </span>
              </button>
            )}

            {useItems ? (
              <div className="space-y-2">
                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {itemRows.map((row) => (
                    <div
                      key={row.key}
                      className="space-y-2 rounded-lg border border-border/60 p-2"
                    >
                      <div className="flex gap-2">
                        <Input
                          value={row.description}
                          onChange={(e) =>
                            setItemRows((prev) =>
                              prev.map((r) =>
                                r.key === row.key
                                  ? { ...r, description: e.target.value }
                                  : r
                              )
                            )
                          }
                          placeholder="Item name"
                          className="h-8"
                        />
                        <div className="relative w-24 shrink-0">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {symbol}
                          </span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            value={row.amount}
                            onChange={(e) =>
                              setItemRows((prev) =>
                                prev.map((r) =>
                                  r.key === row.key
                                    ? { ...r, amount: e.target.value }
                                    : r
                                )
                              )
                            }
                            placeholder="0"
                            className="num h-8 pl-6 text-right"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground"
                          onClick={() =>
                            setItemRows((prev) =>
                              prev.filter((r) => r.key !== row.key)
                            )
                          }
                          aria-label="Remove item"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      <Select
                        value={row.categoryId}
                        onValueChange={(v) =>
                          setItemRows((prev) =>
                            prev.map((r) =>
                              r.key === row.key ? { ...r, categoryId: v } : r
                            )
                          )
                        }
                      >
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {orderedExpenseCats.map(({ cat, depth }) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <span
                                className="flex items-center gap-2"
                                style={{ paddingLeft: depth * 14 }}
                              >
                                <span
                                  className="size-2 rounded-full"
                                  style={{ backgroundColor: cat.tint }}
                                />
                                {depth > 0 && (
                                  <span className="text-muted-foreground">↳</span>
                                )}
                                {cat.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setItemRows((prev) => [...prev, blankItem()])}
                  >
                    <Plus className="size-4" />
                    Add item
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Total{" "}
                    <span className="num font-medium text-foreground">
                      {symbol}
                      {itemsTotal.toLocaleString()}
                    </span>
                  </span>
                </div>
              </div>
            ) : (
              kind === "expense" && (
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {orderedExpenseCats.map(({ cat, depth }) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <span
                            className="flex items-center gap-2"
                            style={{ paddingLeft: depth * 14 }}
                          >
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: cat.tint }}
                            />
                            {depth > 0 && (
                              <span className="text-muted-foreground">↳</span>
                            )}
                            {cat.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            )}

            {/* Bought for a friend (reimbursable) — expenses only, not itemized */}
            {kind === "expense" && !useItems && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    const next = !reimbOn;
                    setReimbOn(next);
                    if (next) {
                      setItemized(false);
                      if (!reimbAmount && amount) setReimbAmount(amount);
                    }
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
                    useReimb
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/60 hover:bg-muted/50"
                  )}
                >
                  <span className="font-medium">
                    Bought for a friend{" "}
                    <span className="font-normal text-muted-foreground">
                      (they&apos;ll pay you back)
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors",
                      useReimb ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  >
                    <span
                      className={cn(
                        "size-4 rounded-full bg-background transition-transform",
                        useReimb && "translate-x-4"
                      )}
                    />
                  </span>
                </button>

                {useReimb && (
                  <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="reimb-person">Friend&apos;s name</Label>
                        <Input
                          id="reimb-person"
                          value={reimbPerson}
                          onChange={(e) => setReimbPerson(e.target.value)}
                          placeholder="Ali"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="reimb-amount">They owe ({currency})</Label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            {symbol}
                          </span>
                          <Input
                            id="reimb-amount"
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            value={reimbAmount}
                            onChange={(e) => setReimbAmount(e.target.value)}
                            placeholder="0"
                            className="num pl-7"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reimb-note">Note (optional)</Label>
                      <Input
                        id="reimb-note"
                        value={reimbNote}
                        onChange={(e) => setReimbNote(e.target.value)}
                        placeholder="Concert ticket — pay me back next week"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This won&apos;t count toward your spending, and their refund
                      won&apos;t count as income.
                    </p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 sm:justify-between">
              {isEditing ? (
                <Button
                  type="button"
                  variant={confirmDelete ? "destructive" : "ghost"}
                  size="sm"
                  className="gap-1.5"
                  onClick={handleDelete}
                >
                  <Trash2 className="size-4" />
                  {confirmDelete ? "Confirm delete" : "Delete"}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {isEditing
                    ? "Save changes"
                    : transferMode
                      ? "Record transfer"
                      : "Record transaction"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
