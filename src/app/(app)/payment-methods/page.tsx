"use client";

import { Plus, Landmark } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RowMenu } from "@/components/ui/row-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useInvoices } from "@/components/invoices/invoices-provider";
import type { PaymentAccount } from "@/lib/data";

export default function PaymentMethodsPage() {
  const { paymentAccounts, openAddPaymentAccount } = useInvoices();

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="display text-3xl tracking-tight md:text-4xl">
              Payment methods
            </h1>
            <p className="text-sm text-muted-foreground">
              Your receiving bank accounts. Add one to an invoice so clients know
              where to pay — locally or by international transfer.
            </p>
          </div>
          <Button onClick={openAddPaymentAccount} className="shrink-0 gap-1.5">
            <Plus className="size-4" />
            New
          </Button>
        </div>
      </Reveal>

      {paymentAccounts.length === 0 ? (
        <Reveal delay={0.05}>
          <EmptyState
            className="mt-10"
            icon={<Landmark className="size-6" />}
            title="No payment methods yet"
            description="Add your bank details (account title, IBAN, SWIFT/BIC) to show them on invoices."
            action={
              <Button
                onClick={openAddPaymentAccount}
                variant="outline"
                className="gap-1.5"
              >
                <Plus className="size-4" />
                New method
              </Button>
            }
          />
        </Reveal>
      ) : (
        <Reveal delay={0.05}>
          <ul className="mt-8 divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card">
            {paymentAccounts.map((p) => (
              <PaymentRow key={p.id} account={p} />
            ))}
          </ul>
        </Reveal>
      )}
    </div>
  );
}

function PaymentRow({ account }: { account: PaymentAccount }) {
  const { openEditPaymentAccount, removePaymentAccount } = useInvoices();
  const confirm = useConfirm();

  async function onDelete() {
    const ok = await confirm({
      title: `Delete ${account.label}?`,
      description: "Invoices already sent keep the details they were sent with.",
      confirmText: "Delete",
      tone: "danger",
    });
    if (ok) removePaymentAccount(account.id);
  }

  const detail = [
    account.bankName,
    account.iban || account.accountNumber,
    account.swift,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-foreground">
        <Landmark className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium leading-tight">
            {account.label}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {account.currency}
          </span>
          {account.isDefault && (
            <span className="shrink-0 rounded-full bg-income/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-income">
              Default
            </span>
          )}
        </div>
        <p className="num mt-0.5 truncate text-xs text-muted-foreground">
          {detail || account.accountName}
        </p>
      </div>
      <RowMenu
        onEdit={() => openEditPaymentAccount(account)}
        onDelete={onDelete}
        label={`Actions for ${account.label}`}
      />
    </li>
  );
}
