"use client";

import { useEffect, useState } from "react";
import { Trash2, Info } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

// The create flow is split into steps so a first-time user isn't hit with one
// dense form. Editing keeps the single form (you already know your account).
const STEP_TITLES = ["The basics", "Money", "Bank details"] as const;

/** Small info icon with a tooltip, for explaining a field. */
function Hint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-label="More information"
          className="text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

function FieldLabel({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{children}</Label>
      {hint && <Hint text={hint} />}
    </div>
  );
}

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
  const [swift, setSwift] = useState("");
  const [iban, setIban] = useState("");
  const [branch, setBranch] = useState("");
  const [balance, setBalance] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [step, setStep] = useState(1); // create-flow step (1-based)

  // A group needs only the first step; a regular account has all three.
  const totalSteps = isGroup ? 1 : 3;

  // Groups available as a parent — exclude the account being edited itself.
  const groups = accounts.filter((a) => a.isGroup && a.id !== editing?.id);

  // Prefill (edit) or reset (create) whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    setStep(1);
    if (editing) {
      setIsGroup(editing.isGroup);
      setName(editing.name);
      setType(editing.type);
      setSubtype(editing.subtype ?? "checking");
      setCurrency(editing.currency);
      setInstitution(editing.institution ?? "");
      setAccountNumber(editing.accountNumber ?? "");
      setSwift(editing.swift ?? "");
      setIban(editing.iban ?? "");
      setBranch(editing.branch ?? "");
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
      setSwift("");
      setIban("");
      setBranch("");
      setBalance("");
      setParentId("none");
    }
  }, [open, editing]);

  // In edit mode every section shows; in create mode only the active step's.
  const showSection = (n: 1 | 2 | 3) => isEditing || step === n;

  function goNext() {
    if (step === 1 && !name.trim()) {
      toast.error("Give the account a name.");
      return;
    }
    setStep((s) => Math.min(totalSteps, s + 1));
  }

  function commit() {
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
      swift: isGroup ? null : swift.trim().toUpperCase() || null,
      iban: isGroup ? null : iban.trim() || null,
      branch: isGroup ? null : branch.trim() || null,
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // In the create wizard, Enter / the primary button advances until the last step.
    if (!isEditing && step < totalSteps) {
      goNext();
      return;
    }
    commit();
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
        <TooltipProvider delayDuration={150}>
          <DialogHeader>
            <DialogTitle className="display text-xl">
              {isEditing ? "Edit account" : "New account"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "A group can hold sub-accounts in any currency."
                : isGroup
                  ? "A group (e.g. “Pakistani Accounts”) holds sub-accounts."
                  : `Step ${step} of ${totalSteps} · ${STEP_TITLES[step - 1]}`}
            </DialogDescription>
          </DialogHeader>

          {/* Step progress (create flow only) */}
          {!isEditing && (
            <div className="flex gap-1.5" aria-hidden>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i < step ? "bg-primary" : "bg-muted"
                  )}
                />
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ── Step 1 · basics ─────────────────────────────────────── */}
            {showSection(1) && (
              <>
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
                  <FieldLabel
                    htmlFor="acc-name"
                    hint={
                      isGroup
                        ? "A folder that groups sub-accounts and rolls up their balances."
                        : "A friendly name you'll recognise, e.g. “HBL Current Account”."
                    }
                  >
                    Account title
                  </FieldLabel>
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
                    <FieldLabel hint="Nest this account inside a group so its balance rolls up.">
                      Parent group (optional)
                    </FieldLabel>
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
              </>
            )}

            {/* ── Step 2 · money ──────────────────────────────────────── */}
            {!isGroup && showSection(2) && (
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
                    <FieldLabel hint="Checking, savings, cash, or an investment account.">
                      Type
                    </FieldLabel>
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
                    <FieldLabel hint="The account's own currency. Net worth converts everything to your display currency.">
                      Currency
                    </FieldLabel>
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

                  <div className="col-span-2 space-y-1.5">
                    <FieldLabel
                      htmlFor="acc-bal"
                      hint="The balance today, before any transactions you log. You can reconcile it later."
                    >
                      {type === "liability" ? "Amount owed" : "Starting balance"}
                    </FieldLabel>
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
                  </div>
                </div>
              </>
            )}

            {/* ── Step 3 · bank details (all optional) ────────────────── */}
            {!isGroup && showSection(3) && (
              <div className="grid grid-cols-2 gap-3">
                {!isEditing && (
                  <p className="col-span-2 -mb-1 text-xs text-muted-foreground">
                    All optional — add what you like, skip the rest.
                  </p>
                )}
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="acc-inst" hint="The bank or provider, e.g. HBL or Revolut.">
                    Institution
                  </FieldLabel>
                  <Input
                    id="acc-inst"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="HBL"
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel
                    htmlFor="acc-swift"
                    hint="Bank identifier used for international transfers (a.k.a. BIC)."
                  >
                    SWIFT / BIC
                  </FieldLabel>
                  <Input
                    id="acc-swift"
                    value={swift}
                    onChange={(e) => setSwift(e.target.value)}
                    placeholder="MEZNPKKA"
                    autoComplete="off"
                    className="num uppercase"
                  />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <FieldLabel
                    htmlFor="acc-iban"
                    hint="🔒 Encrypted before it's stored — the database never sees it in plain text."
                  >
                    IBAN
                  </FieldLabel>
                  <Input
                    id="acc-iban"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="PK00 HABB 0000 1234 5678"
                    autoComplete="off"
                    className="num"
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel
                    htmlFor="acc-num"
                    hint="🔒 Also encrypted at rest. Only you can read it back."
                  >
                    Account number
                  </FieldLabel>
                  <Input
                    id="acc-num"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="0123456789"
                    autoComplete="off"
                    className="num"
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="acc-branch" hint="The branch name or code, if relevant.">
                    Branch
                  </FieldLabel>
                  <Input
                    id="acc-branch"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="Gulshan-e-Iqbal, Karachi"
                    autoComplete="off"
                  />
                </div>
              </div>
            )}

            {/* ── Footer ──────────────────────────────────────────────── */}
            {isEditing ? (
              <DialogFooter className="gap-2 sm:justify-between">
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
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save changes</Button>
                </div>
              </DialogFooter>
            ) : (
              <DialogFooter className="gap-2 sm:justify-between">
                {step > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep((s) => Math.max(1, s - 1))}
                  >
                    Back
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                )}
                <Button type="submit">
                  {step < totalSteps
                    ? "Next"
                    : isGroup
                      ? "Create group"
                      : "Create account"}
                </Button>
              </DialogFooter>
            )}
          </form>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
