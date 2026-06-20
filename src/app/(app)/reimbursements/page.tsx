"use client";

import { useMemo } from "react";
import { HandCoins, Check } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/components/transactions/transactions-provider";
import { pendingReceivablesBase } from "@/lib/compute";
import { formatMoney, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function ReimbursementsPage() {
  const { items, getAccount, baseCurrency, fx, settleReimbursement } = useAppData();

  const claims = useMemo(
    () => items.filter((t) => t.reimbursement),
    [items]
  );
  const pending = claims.filter((c) => !c.reimbursement!.settled);
  const settled = claims.filter((c) => c.reimbursement!.settled);

  const owed = pendingReceivablesBase(items, fx);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-col gap-1.5">
          <h1 className="display text-3xl tracking-tight md:text-4xl">
            Reimbursements
          </h1>
          <p className="text-sm text-muted-foreground">
            Money you fronted for others. Refunds settle what&apos;s owed — they
            never count as income.
          </p>
        </div>
      </Reveal>

      {/* Owed total */}
      <Reveal delay={0.05}>
        <div className="mt-8 rounded-2xl border border-border/60 bg-primary p-6 text-primary-foreground">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground/60">
            Owed to you · {baseCurrency}
          </p>
          <p className="display amount-lg mt-2 text-4xl leading-none">
            {formatMoney(owed, { currency: baseCurrency })}
          </p>
          <p className="mt-2 text-xs text-primary-foreground/55">
            {pending.length} open {pending.length === 1 ? "claim" : "claims"}
          </p>
        </div>
      </Reveal>

      {claims.length === 0 ? (
        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <HandCoins className="size-6" />
            </span>
            <div>
              <p className="font-medium">Nothing owed to you</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                When you add an expense, turn on “Bought for a friend” to track
                what they owe you here.
              </p>
            </div>
          </div>
        </Reveal>
      ) : (
        <>
          {pending.length > 0 && (
            <Reveal delay={0.1}>
              <Section title="Open">
                {pending.map((t) => (
                  <ClaimRow
                    key={t.id}
                    person={t.reimbursement!.person}
                    note={t.reimbursement!.note}
                    merchant={t.merchant}
                    date={t.date}
                    amount={formatMoney(t.reimbursement!.amount, {
                      currency: t.currency,
                    })}
                    accountName={getAccount(t.accountId)?.name}
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => settleReimbursement(t.id)}
                      >
                        <Check className="size-4" />
                        Mark refunded
                      </Button>
                    }
                  />
                ))}
              </Section>
            </Reveal>
          )}

          {settled.length > 0 && (
            <Reveal delay={0.15}>
              <Section title="Refunded">
                {settled.map((t) => (
                  <ClaimRow
                    key={t.id}
                    person={t.reimbursement!.person}
                    note={t.reimbursement!.note}
                    merchant={t.merchant}
                    date={t.date}
                    amount={formatMoney(t.reimbursement!.amount, {
                      currency: t.currency,
                    })}
                    accountName={getAccount(t.accountId)?.name}
                    settled
                  />
                ))}
              </Section>
            </Reveal>
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-border/60 bg-card">
      <p className="border-b border-border/60 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      <ul className="divide-y divide-border/50 px-2">{children}</ul>
    </section>
  );
}

function ClaimRow({
  person,
  note,
  merchant,
  date,
  amount,
  accountName,
  action,
  settled,
}: {
  person: string;
  note: string;
  merchant: string;
  date: string;
  amount: string;
  accountName?: string;
  action?: React.ReactNode;
  settled?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-income/12 text-xs font-semibold text-income">
        {person.slice(0, 1).toUpperCase() || "?"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">
          {person || "Someone"}
          {settled && (
            <span className="ml-2 rounded bg-income/10 px-1.5 py-px text-[10px] font-medium text-income">
              Refunded
            </span>
          )}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {merchant}
          {accountName ? ` · ${accountName}` : ""} · {formatRelativeDay(date)}
          {note ? ` — ${note}` : ""}
        </p>
      </div>
      <span className={cn("num text-sm font-medium tabular-nums", settled ? "text-muted-foreground" : "text-foreground")}>
        {amount}
      </span>
      {action}
    </li>
  );
}
