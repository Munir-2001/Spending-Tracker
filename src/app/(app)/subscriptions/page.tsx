"use client";

import { useMemo } from "react";
import { Repeat } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { useAppData } from "@/components/transactions/transactions-provider";
import { detectSubscriptions } from "@/lib/compute";
import { formatMoney, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function SubscriptionsPage() {
  const { items, categories, baseCurrency, fx } = useAppData();

  const subs = useMemo(() => {
    const found = detectSubscriptions(items, categories);
    return found
      .map((s) => ({ ...s, base: fx.toBase(s.amount, s.currency) }))
      .sort((a, b) => b.base - a.base);
  }, [items, categories, fx]);

  const monthly = subs.reduce((s, x) => s + x.base, 0);
  const yearly = monthly * 12;
  const fmt = (n: number) =>
    formatMoney(n, { currency: baseCurrency, trimZeroCents: true });

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-col gap-1.5">
          <h1 className="display text-3xl tracking-tight md:text-4xl">
            Subscriptions
          </h1>
          <p className="text-sm text-muted-foreground">
            Recurring charges detected from your transactions — same merchant, a
            steady amount, two or more months running.
          </p>
        </div>
      </Reveal>

      {subs.length === 0 ? (
        <Reveal delay={0.05}>
          <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Repeat className="size-6" />
            </span>
            <div>
              <p className="font-medium">No subscriptions detected yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Once a merchant (e.g. Netflix, Spotify) shows up with a steady
                amount across a couple of months, it&apos;ll appear here.
              </p>
            </div>
          </div>
        </Reveal>
      ) : (
        <>
          <Reveal delay={0.05}>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Tile label="Per month" value={fmt(monthly)} />
              <Tile label="Per year" value={fmt(yearly)} tone="expense" />
              <Tile label="Active" value={String(subs.length)} />
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <ul className="mt-3 divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card px-2">
              {subs.map((s) => (
                <li key={s.merchant} className="flex items-center gap-3 px-3 py-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${s.category?.tint ?? "var(--muted-foreground)"} 14%, transparent)`,
                      color: s.category?.tint ?? "var(--muted-foreground)",
                    }}
                  >
                    {s.merchant.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">
                      {s.merchant}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {s.category?.label ?? "Uncategorized"} · {s.count}× · last{" "}
                      {formatRelativeDay(s.lastDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="num text-sm font-medium tabular-nums">
                      {formatMoney(s.amount, { currency: s.currency })}
                      <span className="text-muted-foreground">/mo</span>
                    </p>
                    {s.currency !== baseCurrency && (
                      <p className="num text-[11px] text-muted-foreground">
                        ≈ {fmt(s.base)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.15}>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Detected automatically. A charge needs a consistent amount across
              2+ months to show up here.
            </p>
          </Reveal>
        </>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "expense";
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "num mt-1.5 text-lg font-medium tabular-nums",
          tone === "expense" && "text-expense"
        )}
      >
        {value}
      </p>
    </div>
  );
}
