"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, HandCoins } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Transaction } from "@/lib/data";
import { formatMoney, formatFullDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppData } from "@/components/transactions/transactions-provider";

export function TransactionDetailDialog({
  open,
  onOpenChange,
  transaction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
}) {
  const {
    getAccount,
    getCategory,
    openEditTransaction,
    deleteTransaction,
    settleReimbursement,
  } = useAppData();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!transaction) return null;
  const t = transaction;
  const account = getAccount(t.accountId);
  const category = getCategory(t.categoryId);
  const isIncome = t.amount > 0;
  const reimb = t.reimbursement;

  function close() {
    setConfirmDelete(false);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setConfirmDelete(false);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-xl">{t.merchant}</DialogTitle>
          <DialogDescription>{formatFullDate(t.date)}</DialogDescription>
        </DialogHeader>

        {/* Amount */}
        <div className="rounded-xl border border-border/60 bg-surface px-5 py-4 text-center">
          <p
            className={cn(
              "num text-3xl font-medium tabular-nums",
              isIncome ? "text-income" : "text-foreground"
            )}
          >
            {formatMoney(t.amount, { signed: isIncome, currency: t.currency })}
          </p>
          <div className="mt-1.5 flex items-center justify-center gap-1.5">
            {t.pending && (
              <span className="rounded bg-amber-500/12 px-1.5 py-px text-[10px] font-medium text-amber-600 dark:text-amber-400">
                Pending
              </span>
            )}
            {t.isReimbursement && (
              <span className="rounded bg-income/10 px-1.5 py-px text-[10px] font-medium text-income">
                Repayment · not income
              </span>
            )}
            {t.isTransfer && !t.isReimbursement && (
              <span className="rounded bg-foreground/[0.08] px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                Transfer · not income/expense
              </span>
            )}
          </div>
        </div>

        {/* Details */}
        <dl className="divide-y divide-border/50 text-sm">
          <Row label="Account" value={account?.name ?? "—"} />
          <Row
            label="Category"
            value={
              t.items?.length ? (
                <span className="text-muted-foreground">Split · {t.items.length} items</span>
              ) : (
                <span className="flex items-center gap-2">
                  {category && (
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: category.tint }}
                    />
                  )}
                  {category?.label ?? "Uncategorized"}
                </span>
              )
            }
          />
          <Row label="Currency" value={t.currency} />
        </dl>

        {/* Note */}
        {t.notes && (
          <div className="rounded-xl border border-border/60 bg-surface px-3.5 py-2.5">
            <p className="text-xs text-muted-foreground">Note</p>
            <p className="mt-0.5 text-sm">{t.notes}</p>
          </div>
        )}

        {/* Split items */}
        {t.items && t.items.length > 0 && (
          <div className="space-y-1 rounded-xl border border-border/60 p-2">
            {t.items.map((it) => {
              const c = getCategory(it.categoryId);
              return (
                <div key={it.id} className="flex items-center gap-2 px-1 py-1.5 text-sm">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: c?.tint ?? "var(--muted-foreground)" }}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {it.description || c?.label || "Item"}
                  </span>
                  {it.reimbursable && (
                    <HandCoins
                      className="size-3.5 shrink-0 text-income"
                      aria-label={`For ${reimb?.person || "a friend"}`}
                    />
                  )}
                  <span className="num tabular-nums">
                    {formatMoney(it.amount, { currency: t.currency })}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Reimbursement */}
        {reimb && (
          <div className="space-y-2 rounded-xl border border-income/30 bg-income/5 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <HandCoins className="size-4 text-income" />
                Bought for {reimb.person || "a friend"}
              </span>
              <span className="num text-sm font-medium text-income">
                {formatMoney(reimb.amount, { currency: t.currency })}
              </span>
            </div>
            {reimb.note && (
              <p className="text-xs text-muted-foreground">{reimb.note}</p>
            )}
            {reimb.settled ? (
              <span className="inline-flex items-center gap-1 rounded bg-income/10 px-1.5 py-0.5 text-[11px] font-medium text-income">
                <Check className="size-3" /> Refunded
              </span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  settleReimbursement(t.id);
                  close();
                }}
              >
                <Check className="size-4" />
                Mark refunded
              </Button>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant={confirmDelete ? "destructive" : "ghost"}
            size="sm"
            className="gap-1.5"
            onClick={() => {
              if (!confirmDelete) return setConfirmDelete(true);
              deleteTransaction(t.id);
              close();
            }}
          >
            <Trash2 className="size-4" />
            {confirmDelete ? "Confirm delete" : "Delete"}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              Close
            </Button>
            <Button
              type="button"
              className="gap-1.5"
              onClick={() => {
                onOpenChange(false);
                openEditTransaction(t);
              }}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
