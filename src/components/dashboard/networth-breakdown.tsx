"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { Landmark, Boxes, HandCoins } from "lucide-react";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { netWorthComposition, type NetWorthSlice } from "@/lib/compute";
import { formatCompact, formatMoney } from "@/lib/format";
import { useAppData } from "@/components/transactions/transactions-provider";
import { cn } from "@/lib/utils";

const PALETTE = [
  "var(--cat-1)",
  "var(--cat-2)",
  "var(--cat-3)",
  "var(--cat-4)",
  "var(--cat-5)",
  "var(--cat-6)",
  "var(--cat-7)",
  "var(--cat-8)",
  "var(--cat-9)",
  "var(--cat-10)",
];

const kindIcon = {
  account: Landmark,
  asset: Boxes,
  receivable: HandCoins,
} as const;

export function NetWorthBreakdown() {
  const { accounts, assets, items, balanceOf, baseCurrency, fx } = useAppData();

  const slices = useMemo(
    () => netWorthComposition(accounts, balanceOf, assets, items, fx),
    [accounts, assets, items, balanceOf, fx]
  );

  const colored = useMemo(
    () => slices.map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] })),
    [slices]
  );
  const positives = colored.filter((s) => s.value > 0);
  const negatives = colored.filter((s) => s.value < 0);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const positiveTotal = positives.reduce((sum, s) => sum + s.value, 0);

  const fmt = (n: number) => formatMoney(n, { currency: baseCurrency });

  if (slices.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Add accounts or assets to see what your net worth is made of.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
      {/* Donut with the total in the middle */}
      <div className="relative shrink-0">
        <ChartContainer
          config={{}}
          className="aspect-square h-[180px] w-[180px]"
        >
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="text-muted-foreground">{name}</span>
                      <span className="num font-medium">{fmt(value as number)}</span>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={positives}
              dataKey="value"
              nameKey="label"
              innerRadius={58}
              outerRadius={84}
              strokeWidth={2}
              stroke="var(--card)"
            >
              {positives.map((s) => (
                <Cell key={s.id} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Net worth
          </span>
          <span className="num text-lg font-semibold tabular-nums">
            {formatCompact(total, baseCurrency)}
          </span>
        </div>
      </div>

      {/* Legend: every account + asset that makes it up */}
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {positives.map((s) => (
          <LegendRow
            key={s.id}
            slice={s}
            color={s.color}
            pct={positiveTotal > 0 ? (s.value / positiveTotal) * 100 : 0}
            value={fmt(s.value)}
          />
        ))}
        {negatives.map((s) => (
          <LegendRow
            key={s.id}
            slice={s}
            color="var(--expense)"
            value={fmt(s.value)}
            negative
          />
        ))}
      </ul>
    </div>
  );
}

function LegendRow({
  slice,
  color,
  pct,
  value,
  negative,
}: {
  slice: NetWorthSlice;
  color: string;
  pct?: number;
  value: string;
  negative?: boolean;
}) {
  const Icon = kindIcon[slice.kind];
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        className="size-2.5 shrink-0 rounded-[3px]"
        style={{ backgroundColor: color }}
      />
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{slice.label}</span>
      {pct !== undefined && (
        <span className="num shrink-0 text-xs text-muted-foreground">
          {Math.round(pct)}%
        </span>
      )}
      <span
        className={cn(
          "num shrink-0 tabular-nums font-medium",
          negative && "text-expense"
        )}
      >
        {value}
      </span>
    </li>
  );
}
