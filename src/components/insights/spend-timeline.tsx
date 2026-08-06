"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, Brush, Cell, CartesianGrid } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useAppData } from "@/components/transactions/transactions-provider";
import {
  rangeFlowsBase,
  spendSeries,
  type SpendBucket,
  type SpendGranularity,
} from "@/lib/compute";
import { formatMoney } from "@/lib/format";

const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
};
function tickLabel(startIso: string, gran: SpendGranularity) {
  const { m, d } = parse(startIso);
  return gran === "month" ? MON[m] : `${d} ${MON[m]}`;
}
function rangeLabel(a: string, b: string) {
  const A = parse(a);
  const B = parse(b);
  if (A.y === B.y && A.m === B.m && A.d === B.d) return `${A.d} ${MON[A.m]}`;
  if (A.y === B.y && A.m === B.m) return `${A.d}–${B.d} ${MON[A.m]}`;
  const yr = A.y === B.y ? "" : ` ’${String(B.y).slice(2)}`;
  return `${A.d} ${MON[A.m]} – ${B.d} ${MON[B.m]}${yr}`;
}
function daysInclusive(a: string, b: string) {
  const A = parse(a);
  const B = parse(b);
  return Math.round((Date.UTC(B.y, B.m, B.d) - Date.UTC(A.y, A.m, A.d)) / 86400000) + 1;
}

/**
 * Brushable spend timeline. Drag the handles to select a span; the "Money out"
 * hero and the transaction list below snap to it. Bar granularity (day/week/
 * month) adapts to the total span so the chart stays readable.
 */
export function SpendTimeline() {
  const { items, fx, baseCurrency, getCategory, getAccount, openTransactionDetail } =
    useAppData();
  const [sel, setSel] = useState<{ s: number; e: number } | null>(null);

  const gran: SpendGranularity = useMemo(() => {
    const ds = items
      .filter((t) => !t.isTransfer && !t.isReimbursement && t.amount < 0)
      .map((t) => t.date)
      .sort();
    if (!ds.length) return "day";
    const span = daysInclusive(ds[0], ds[ds.length - 1]);
    return span <= 62 ? "day" : span <= 420 ? "week" : "month";
  }, [items]);

  const buckets = useMemo(() => spendSeries(items, fx, gran), [items, fx, gran]);
  const n = buckets.length;
  const fmt = (m: number) => formatMoney(m, { currency: baseCurrency, trimZeroCents: true });

  if (n === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No spending recorded yet — add some transactions to explore your timeline.
      </div>
    );
  }

  // Clamp the selection against current buckets so stale indices never crash.
  const s = Math.max(0, Math.min(sel?.s ?? 0, n - 1));
  const e = Math.max(s, Math.min(sel?.e ?? n - 1, n - 1));
  const rangeStart = buckets[s].start;
  const rangeEnd = buckets[e].end;
  const isFull = s === 0 && e === n - 1;

  const flows = rangeFlowsBase(items, rangeStart, rangeEnd, fx);
  const out = -flows.expense; // spend magnitude
  const days = daysInclusive(rangeStart, rangeEnd);
  const perDay = days > 0 ? Math.round(out / days) : 0;

  const spendRows = items
    .filter(
      (t) =>
        t.date >= rangeStart &&
        t.date <= rangeEnd &&
        !t.isTransfer &&
        !t.isReimbursement &&
        t.amount < 0
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.amount - b.amount);
  const count = spendRows.length;
  const shown = spendRows.slice(0, 12);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      {/* Money-out hero */}
      <div className="flex flex-col gap-4 border-b border-border/60 p-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-expense" />
            Money out · {rangeLabel(rangeStart, rangeEnd)}
          </p>
          <p className="display amount-lg mt-2 text-4xl leading-none tabular-nums md:text-5xl">
            {fmt(out)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {count} {count === 1 ? "transaction" : "transactions"} · avg{" "}
            <span className="num text-foreground">{fmt(perDay)}</span>/day
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isFull && (
            <button
              onClick={() => setSel(null)}
              className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Reset span
            </button>
          )}
        </div>
      </div>

      {/* Brushable timeline — drag the handles to select a span */}
      <div className="px-3 pt-4">
        <ChartContainer config={{}} className="h-[170px] w-full">
          <BarChart data={buckets} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="start"
              tickFormatter={(v) => tickLabel(v as string, gran)}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
              className="text-[10px]"
            />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, p) => {
                    const b = (p?.[0]?.payload ?? {}) as SpendBucket;
                    return b.start ? rangeLabel(b.start, b.end) : "";
                  }}
                  formatter={(value) => (
                    <span className="num font-medium">{fmt(value as number)}</span>
                  )}
                />
              }
            />
            <Bar dataKey="spend" radius={3}>
              {buckets.map((b, i) => (
                <Cell
                  key={b.key}
                  fill={i >= s && i <= e ? "var(--expense)" : "var(--muted)"}
                />
              ))}
            </Bar>
            <Brush
              dataKey="start"
              height={22}
              travellerWidth={8}
              stroke="var(--expense)"
              fill="var(--muted)"
              startIndex={s}
              endIndex={e}
              tickFormatter={(v) => tickLabel(v as string, gran)}
              onChange={(r) => {
                if (typeof r.startIndex === "number" && typeof r.endIndex === "number")
                  setSel({ s: r.startIndex, e: r.endIndex });
              }}
            />
          </BarChart>
        </ChartContainer>
      </div>

      {/* Drill list — the transactions inside the selected span */}
      <ul className="divide-y divide-border/50 px-2 pb-2">
        {shown.map((t) => {
          const c = getCategory(t.categoryId);
          const acc = getAccount(t.accountId);
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => openTransactionDetail(t)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: c?.tint ?? "var(--muted-foreground)" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{t.merchant}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t.items?.length
                      ? `Split · ${t.items.length}`
                      : c?.label ?? "Uncategorized"}
                    {acc ? ` · ${acc.name}` : ""}
                  </span>
                </span>
                <span className="num shrink-0 text-sm font-medium tabular-nums">
                  {formatMoney(t.amount, { currency: t.currency })}
                </span>
              </button>
            </li>
          );
        })}
        {count === 0 && (
          <li className="py-8 text-center text-sm text-muted-foreground">
            No spending in this span.
          </li>
        )}
        {count > shown.length && (
          <li className="px-3 py-2 text-center text-xs text-muted-foreground">
            + {count - shown.length} more in this span
          </li>
        )}
      </ul>
    </div>
  );
}
