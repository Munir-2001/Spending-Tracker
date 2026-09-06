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
import { useAppData } from "@/components/transactions/transactions-provider";
import type { PaymentAccount } from "@/lib/data";
import type { NewPaymentAccountInput } from "@/lib/schema";
import { CURRENCIES } from "@/lib/currency";

export function PaymentAccountDialog({
  open,
  onOpenChange,
  onCreate,
  onSave,
  onDelete,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: NewPaymentAccountInput) => void;
  onSave: (id: string, input: NewPaymentAccountInput) => void;
  onDelete: (id: string) => void;
  editing: PaymentAccount | null;
}) {
  const isEditing = Boolean(editing);
  const { accounts } = useAppData();
  // Real bank accounts (not folders) the user can copy details from.
  const bankAccounts = useMemo(
    () => accounts.filter((a) => !a.isGroup),
    [accounts]
  );

  const [prefillId, setPrefillId] = useState("none");
  const [label, setLabel] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [iban, setIban] = useState("");
  const [swift, setSwift] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    setPrefillId("none");
    if (editing) {
      setLabel(editing.label);
      setAccountName(editing.accountName);
      setBankName(editing.bankName ?? "");
      setAccountNumber(editing.accountNumber ?? "");
      setIban(editing.iban ?? "");
      setSwift(editing.swift ?? "");
      setBranchCode(editing.branchCode ?? "");
      setCurrency(editing.currency);
      setNotes(editing.notes ?? "");
      setIsDefault(editing.isDefault);
    } else {
      setLabel("");
      setAccountName("");
      setBankName("");
      setAccountNumber("");
      setIban("");
      setSwift("");
      setBranchCode("");
      setCurrency("USD");
      setNotes("");
      setIsDefault(false);
    }
  }, [open, editing]);

  // Copy details from one of the user's tracked bank accounts.
  function prefillFrom(id: string) {
    setPrefillId(id);
    if (id === "none") return;
    const a = bankAccounts.find((x) => x.id === id);
    if (!a) return;
    if (!label.trim()) setLabel(a.name);
    if (!accountName.trim()) setAccountName(a.name);
    setBankName(a.institution ?? "");
    setAccountNumber(a.accountNumber ?? "");
    setIban(a.iban ?? "");
    setSwift(a.swift ?? "");
    setBranchCode(a.branch ?? "");
    setCurrency(a.currency);
  }

  const trimOrNull = (s: string) => (s.trim() ? s.trim() : null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return toast.error("Give it a label, e.g. “Meezan USD”.");
    if (!accountName.trim()) return toast.error("Enter the account title.");
    const input: NewPaymentAccountInput = {
      label: label.trim(),
      accountName: accountName.trim(),
      bankName: trimOrNull(bankName),
      accountNumber: trimOrNull(accountNumber),
      iban: trimOrNull(iban),
      swift: trimOrNull(swift)?.toUpperCase() ?? null,
      branchCode: trimOrNull(branchCode),
      currency,
      notes: trimOrNull(notes),
      isDefault,
    };
    if (editing) {
      onSave(editing.id, input);
      toast.success("Payment method updated", { description: label.trim() });
    } else {
      onCreate(input);
      toast.success("Payment method added", { description: label.trim() });
    }
    onOpenChange(false);
  }

  function handleDelete() {
    if (!editing) return;
    if (!confirmDelete) return setConfirmDelete(true);
    onDelete(editing.id);
    toast.success("Payment method removed", { description: editing.label });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-xl">
            {isEditing ? "Edit payment method" : "New payment method"}
          </DialogTitle>
          <DialogDescription>
            Your bank details, shown on invoices so clients know where to pay.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {bankAccounts.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-border/60 bg-surface p-3">
              <Label>Copy from an account</Label>
              <Select value={prefillId} onValueChange={prefillFrom}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Use one of your bank accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Enter manually</SelectItem>
                  {bankAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.institution ? ` · ${a.institution}` : ""} · {a.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Prefills the fields below from that account — edit anything before
                saving.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pa-label">Label</Label>
              <Input
                id="pa-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Meezan USD"
                autoFocus
              />
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
            <Label htmlFor="pa-name">Account title</Label>
            <Input
              id="pa-name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Your name / business name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pa-bank">Bank name</Label>
            <Input
              id="pa-bank"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Meezan Bank Limited"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pa-acct">Account number</Label>
              <Input
                id="pa-acct"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="num"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pa-iban">IBAN</Label>
              <Input
                id="pa-iban"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="PK…"
                className="num"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pa-swift">SWIFT / BIC</Label>
              <Input
                id="pa-swift"
                value={swift}
                onChange={(e) => setSwift(e.target.value)}
                placeholder="MEZNPKKA"
                className="num uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pa-branch">Branch</Label>
              <Input
                id="pa-branch"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                className="num"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pa-notes">Notes</Label>
            <textarea
              id="pa-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Intermediary bank, routing/sort code, reference instructions…"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border/60 bg-surface px-3.5 py-3">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="size-4"
              style={{ accentColor: "var(--primary)" }}
            />
            <span className="text-sm font-medium">
              Use as the default on new invoices
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {isEditing ? "Save changes" : "Add method"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
