"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
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
import type { Account, Category, RecurringRule } from "@/lib/data";
import type { NewRecurringInput, RecurringCadence } from "@/lib/schema";
import {
  CURRENCIES,
  currencyInfo,
  toMajorUnits,
  toMinorUnits,
} from "@/lib/currency";
import { cn } from "@/lib/utils";

const CADENCES: { value: RecurringCadence; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const today = () => new Date().toISOString().slice(0, 10);

export function RecurringDialog({
  open,
  onOpenChange,
  onCreate,
  onSave,
  onDelete,
  editing,
  accounts,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: NewRecurringInput) => void;
  onSave: (id: string, input: NewRecurringInput) => void;
  onDelete: (id: string) => void;
  editing: RecurringRule | null;
  accounts: Account[];
  categories: Category[];
}) {
  const isEditing = Boolean(editing);
  const selectable = useMemo(() => accounts.filter((a) => !a.isGroup), [accounts]);

  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("none");
  const [cadence, setCadence] = useState<RecurringCadence>("monthly");
  const [nextDate, setNextDate] = useState(today());
  const [autoPost, setAutoPost] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pickCategories = useMemo(
    () => categories.filter((c) => c.kind === kind),
    [categories, kind]
  );

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (editing) {
      const isExpense = editing.amount < 0;
      setKind(isExpense ? "expense" : "income");
      setMerchant(editing.merchant);
      setAmount(String(toMajorUnits(Math.abs(editing.amount), editing.currency)));
      setCurrency(editing.currency);
      setAccountId(editing.accountId);
      setCategoryId(editing.categoryId || "none");
      setCadence(editing.cadence);
      setNextDate(editing.nextDate);
      setAutoPost(editing.autoPost);
    } else {
      setKind("expense");
      setMerchant("");
      setAmount("");
      setCurrency(selectable[0]?.currency ?? "USD");
      setAccountId(selectable[0]?.id ?? "");
      setCategoryId("none");
      setCadence("monthly");
      setNextDate(today());
      setAutoPost(true);
    }
  }, [open, editing, selectable]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!merchant.trim()) return toast.error("Give the schedule a name.");
    if (!accountId) return toast.error("Pick an account.");
    const major = Number.parseFloat(amount);
    if (!Number.isFinite(major) || major <= 0)
      return toast.error("Enter an amount.");
    const minor = toMinorUnits(major, currency);
    const input: NewRecurringInput = {
      merchant: merchant.trim(),
      amount: kind === "expense" ? -minor : minor,
      categoryId: categoryId === "none" ? "" : categoryId,
      accountId,
      currency,
      cadence,
      nextDate,
      autoPost,
    };
    if (editing) {
      onSave(editing.id, input);
      toast.success("Schedule updated", { description: merchant.trim() });
    } else {
      onCreate(input);
      toast.success("Schedule created", { description: merchant.trim() });
    }
    onOpenChange(false);
  }

  function handleDelete() {
    if (!editing) return;
    if (!confirmDelete) return setConfirmDelete(true);
    onDelete(editing.id);
    toast.success("Schedule removed", { description: editing.merchant });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-xl">
            {isEditing ? "Edit schedule" : "New recurring"}
          </DialogTitle>
          <DialogDescription>
            A transaction that repeats — rent, salary, a subscription. We&apos;ll
            post it (or remind you) when it&apos;s due.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
            {(["expense", "income"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setCategoryId("none");
                }}
                className={cn(
                  "rounded-md py-1.5 text-sm font-medium transition-colors",
                  kind === k
                    ? k === "expense"
                      ? "bg-expense/10 text-expense"
                      : "bg-income/10 text-income"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {k === "expense" ? "Bill / expense" : "Income"}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rec-name">Name</Label>
            <Input
              id="rec-name"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder={kind === "expense" ? "Rent · Netflix" : "Salary"}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-amount">Amount ({currency})</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {currencyInfo(currency).symbol}
                </span>
                <Input
                  id="rec-amount"
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

          <div className="space-y-1.5">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose account" />
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

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {pickCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.parentId ? "— " : ""}
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Repeats</Label>
              <Select
                value={cadence}
                onValueChange={(v) => setCadence(v as RecurringCadence)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CADENCES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-next">Next date</Label>
              <Input
                id="rec-next"
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border/60 bg-surface px-3.5 py-3">
            <input
              type="checkbox"
              checked={autoPost}
              onChange={(e) => setAutoPost(e.target.checked)}
              className="mt-0.5 size-4"
              style={{ accentColor: "var(--primary)" }}
            />
            <span className="text-sm">
              <span className="font-medium">Auto-post when due</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Create the transaction automatically. Turn off to only get a
                reminder you can post yourself.
              </span>
            </span>
          </label>

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
              <Button type="submit">{isEditing ? "Save changes" : "Create"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
