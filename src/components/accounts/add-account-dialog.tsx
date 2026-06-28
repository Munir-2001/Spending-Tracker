"use client";

import { useEffect, useState } from "react";
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
import type { Account } from "@/lib/data";
import type { AccountSubtype } from "@/lib/schema";
import type { NewAccount } from "@/components/transactions/transactions-provider";
import {
  CURRENCIES,
  currencyInfo,
  toMajorUnits,
  toMinorUnits,
} from "@/lib/currency";
import { cn } from "@/lib/utils";

type Kind = "asset" | "liability";

const subtypesFor: Record<Kind, { value: AccountSubtype; label: string }[]> = {
  asset: [
    { value: "checking", label: "Checking" },
    { value: "savings", label: "Savings" },
    { value: "cash", label: "Cash" },
    { value: "investment", label: "Investment" },
    { value: "other", label: "Other" },
  ],
  liability: [
    { value: "credit_card", label: "Credit card" },
    { value: "loan", label: "Loan" },
    { value: "other", label: "Other" },
  ],
};

export function AddAccountDialog({
  open,
  onOpenChange,
  onCreate,
  onSave,
  onDelete,
  editing,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (a: NewAccount) => void;
  onSave: (id: string, a: NewAccount) => void;
  onDelete: (id: string) => void;
  editing: Account | null;
  accounts: Account[];
}) {
  const isEditing = Boolean(editing);

  const [isGroup, setIsGroup] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<Kind>("asset");
  const [subtype, setSubtype] = useState<AccountSubtype>("checking");
  const [currency, setCurrency] = useState("USD");
  const [institution, setInstitution] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [balance, setBalance] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Groups available as a parent — exclude the account being edited itself.
  const groups = accounts.filter((a) => a.isGroup && a.id !== editing?.id);

  // Prefill (edit) or reset (create) whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (editing) {
      setIsGroup(editing.isGroup);
      setName(editing.name);
      setType(editing.type);
      setSubtype(editing.subtype ?? "checking");
      setCurrency(editing.currency);
      setInstitution(editing.institution ?? "");
      setAccountNumber(editing.accountNumber ?? "");
      setBalance(
        editing.isGroup
          ? ""
          : String(Math.abs(toMajorUnits(editing.openingBalance, editing.currency)))
      );
      setParentId(editing.parentId ?? "none");
    } else {
      setIsGroup(false);
      setName("");
      setType("asset");
      setSubtype("checking");
      setCurrency("USD");
      setInstitution("");
      setAccountNumber("");
      setBalance("");
      setParentId("none");
    }
  }, [open, editing]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Give the account a name.");

    const major = Number.parseFloat(balance || "0");
    const magnitude = Number.isFinite(major) ? Math.abs(major) : 0;
    const signed = type === "liability" ? -magnitude : magnitude;

    const input: NewAccount = {
      name: name.trim(),
      type,
      subtype: isGroup ? null : subtype,
      currency,
      institution: institution.trim() || null,
      accountNumber: isGroup ? null : accountNumber.trim() || null,
      openingBalance: isGroup ? 0 : toMinorUnits(signed, currency),
      parentId: parentId === "none" ? null : parentId,
      isGroup,
    };

    if (editing) {
      onSave(editing.id, input);
      toast.success("Account updated", { description: name.trim() });
    } else {
      onCreate(input);
      toast.success(isGroup ? "Group created" : "Account created", {
        description: name.trim(),
      });
    }
    onOpenChange(false);
  }

  function handleDelete() {
    if (!editing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(editing.id);
    toast.success("Account deleted", { description: editing.name });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-xl">
            {isEditing ? "Edit account" : "New account"}
          </DialogTitle>
          <DialogDescription>
            A group (e.g. “Pakistani Accounts”) can hold sub-accounts in any
            currency.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Account / Group segmented control */}
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
            {[
              { v: false, label: "Account" },
              { v: true, label: "Group / folder" },
            ].map((opt) => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => setIsGroup(opt.v)}
                className={cn(
                  "rounded-md py-1.5 text-sm font-medium transition-colors",
                  isGroup === opt.v
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="acc-name">Name</Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isGroup ? "Pakistani Accounts" : "HBL Current Account"}
              autoFocus
            />
          </div>

          {groups.length > 0 && (
            <div className="space-y-1.5">
              <Label>Parent group (optional)</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None — top level</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isGroup && (
            <>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
                {(["asset", "liability"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setType(k);
                      setSubtype(subtypesFor[k][0].value);
                    }}
                    className={cn(
                      "rounded-md py-1.5 text-sm font-medium capitalize transition-colors",
                      type === k
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {k === "asset" ? "Asset" : "Liability / debt"}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={subtype}
                    onValueChange={(v) => setSubtype(v as AccountSubtype)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {subtypesFor[type].map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
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

                <div className="space-y-1.5">
                  <Label htmlFor="acc-bal">
                    {type === "liability" ? "Amount owed" : "Starting balance"}
                  </Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {currencyInfo(currency).symbol}
                    </span>
                    <Input
                      id="acc-bal"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={balance}
                      onChange={(e) => setBalance(e.target.value)}
                      placeholder="0"
                      className="num pl-7"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Balance before any transactions you log. Use “Reconcile
                    balance” later to match it to reality.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="acc-inst">Institution</Label>
                  <Input
                    id="acc-inst"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="HBL"
                  />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="acc-num">Account number (optional)</Label>
                  <Input
                    id="acc-num"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="PK00 HABB 0000 1234 5678"
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    🔒 Encrypted before it’s stored — the database never sees it
                    in plain text.
                  </p>
                </div>
              </div>
            </>
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {isEditing
                  ? "Save changes"
                  : isGroup
                    ? "Create group"
                    : "Create account"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
