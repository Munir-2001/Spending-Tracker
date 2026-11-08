"use client";

import { formatMoney } from "@/lib/format";
import type { EventSlice } from "@/lib/events";

/** Ranked horizontal bars with amount + share — the event's "where it went". */
export function BreakdownBars({
  slices,
  total,
  currency,
  empty,
}: {
  slices: EventSlice[];
  total: number;
  currency: string;
  empty: string;
}) {
  if (slices.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;

  const max = slices[0].amount;
  return (
    <ul className="space-y-4">
      {slices.map((s) => (
        <li key={s.id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.tint }} />
              <span className="truncate font-medium">{s.label}</span>
            </span>
            <span className="num shrink-0 text-xs text-muted-foreground">
              {formatMoney(s.amount, { currency, trimZeroCents: true })}
              <span className="ml-1.5 text-muted-foreground/70">
                {total > 0 ? Math.round((s.amount / total) * 100) : 0}%
              </span>
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max((s.amount / max) * 100, 2)}%`,
                backgroundColor: s.tint,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Spend per day as a compact column strip (only days with spending). */
export function DailyColumns({
  days,
  currency,
  tint,
}: {
  days: { date: string; amount: number }[];
  currency: string;
  tint: string;
}) {
  if (days.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">No spending yet.</p>;

  const max = Math.max(...days.map((d) => d.amount));
  const label = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <div className="flex h-40 items-end gap-1.5 overflow-x-auto pb-1">
      {days.map((d) => (
        <div
          key={d.date}
          className="group flex h-full min-w-6 flex-1 flex-col items-center justify-end gap-1.5"
          title={`${label(d.date)} · ${formatMoney(d.amount, { currency })}`}
        >
          <div
            className="w-full max-w-10 rounded-t-md opacity-80 transition-opacity group-hover:opacity-100"
            style={{ height: `${Math.max((d.amount / max) * 100, 3)}%`, backgroundColor: tint }}
          />
          <span className="text-[10px] whitespace-nowrap text-muted-foreground">{label(d.date)}</span>
        </div>
      ))}
    </div>
  );
}
