"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { useAppData } from "@/components/transactions/transactions-provider";
import { CLASS_TINT, journalFrom, journalTotals } from "@/lib/ledger";
import { formatMoney, formatFullDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function LedgerPage() {
  const { items, accounts, categories, baseCurrency, fx } = useAppData();
  const entries = useMemo(() => {
    const lookups = {
      accounts: new Map(accounts.map((a) => [a.id, a])),
      categories: new Map(categories.map((c) => [c.id, c])),
    };
    return journalFrom(items, lookups);
  }, [items, accounts, categories]);
  const totals = useMemo(() => journalTotals(entries, fx), [entries, fx]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-col gap-1.5">
          <h1 className="display text-3xl tracking-tight md:text-4xl">
            General ledger
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Each transaction posted as a balanced double-entry journal — equal
            debits and credits. This is the bookkeeping core that scales from one
            person to an entire finance team.
          </p>
        </div>
      </Reveal>

      {/* Balance banner */}
      <Reveal delay={0.05}>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Tile
            label={`Total debits (${baseCurrency})`}
            value={formatMoney(totals.debit, { currency: baseCurrency })}
          />
          <Tile
            label={`Total credits (${baseCurrency})`}
            value={formatMoney(totals.credit, { currency: baseCurrency })}
          />
          <div
            className={cn(
              "flex items-center justify-between rounded-xl border p-4",
              totals.balanced
                ? "border-income/30 bg-income/5"
                : "border-expense/30 bg-expense/5"
            )}
          >
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Status
              </p>
              <p
                className={cn(
                  "mt-1.5 text-lg font-medium",
                  totals.balanced ? "text-income" : "text-expense"
                )}
              >
                {totals.balanced ? "Balanced" : "Out of balance"}
              </p>
            </div>
            {totals.balanced && (
              <span className="flex size-9 items-center justify-center rounded-full bg-income/15 text-income">
                <Check className="size-5" />
              </span>
            )}
          </div>
        </div>
      </Reveal>

      {/* Journal */}
      <Reveal delay={0.1}>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border/60 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            <span>Account</span>
            <span className="w-24 text-right">Debit</span>
            <span className="w-24 text-right">Credit</span>
          </div>

          {entries.length === 0 && (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">
              No journal entries yet. Record a transaction and it posts here as a
              balanced double-entry.
            </p>
          )}

          <div className="divide-y divide-border/60">
            {entries.map((entry) => (
              <div key={entry.id} className="px-5 py-3.5">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm font-medium">{entry.memo}</span>
                  <span className="num text-xs text-muted-foreground">
                    {formatFullDate(entry.date)}
                  </span>
                </div>

                {entry.lines.map((line, i) => {
                  const isCredit = line.credit > 0;
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-1"
                    >
                      <span
                        className={cn(
                          "flex items-center gap-2 text-sm",
                          // Accounting convention: credits indented under debits.
                          isCredit && "pl-6 text-muted-foreground"
                        )}
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{
                            backgroundColor: CLASS_TINT[line.classification],
                          }}
                        />
                        {line.account}
                        <span className="rounded bg-muted px-1.5 py-px text-[10px] uppercase tracking-wide text-muted-foreground">
                          {line.classification}
                        </span>
                      </span>
                      <span className="num w-24 text-right text-sm tabular-nums">
                        {line.debit > 0
                          ? formatMoney(line.debit, { currency: line.currency })
                          : "—"}
                      </span>
                      <span className="num w-24 text-right text-sm tabular-nums text-muted-foreground">
                        {line.credit > 0
                          ? formatMoney(line.credit, { currency: line.currency })
                          : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer totals */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-t border-border/60 bg-surface px-5 py-3 text-sm font-medium">
            <span>Totals ({baseCurrency})</span>
            <span className="num w-24 text-right tabular-nums">
              {formatMoney(totals.debit, { currency: baseCurrency })}
            </span>
            <span className="num w-24 text-right tabular-nums">
              {formatMoney(totals.credit, { currency: baseCurrency })}
            </span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="num mt-1.5 text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}
