"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { netWorthSnapshot } from "@/lib/compute";
import { formatCompact, formatMonth, formatMoney } from "@/lib/format";
import { useAppData } from "@/components/transactions/transactions-provider";

const chartConfig = {
  value: { label: "Net worth", color: "var(--chart-1)" },
} satisfies ChartConfig;

// How far back the trend runs.
const MONTHS_SHOWN = 6;

export function NetWorthChart() {
  const { accounts, items, assets, snapshots, balanceOf, baseCurrency, fx } =
    useAppData();

  if (accounts.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        Add accounts to see your net-worth trend.
      </div>
    );
  }

  // History comes from persisted daily snapshots (anchored in time — each day's
  // value is frozen when taken and never rewritten when rates change). Today is
  // shown as a live figure, computed like a snapshot so the line joins smoothly
  // until tonight's snapshot lands.
  const todayIso = new Date().toISOString().slice(0, 10);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - MONTHS_SHOWN);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const history = snapshots
    .filter((s) => s.asOf >= cutoffIso && s.asOf < todayIso)
    .map((s) => ({ date: s.asOf, value: s.value }));

  const live = netWorthSnapshot(accounts, balanceOf, assets, items, fx);
  const data = [...history, { date: todayIso, value: live.value }];

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="fillNetworth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => formatMonth(d as string)}
          minTickGap={40}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          className="text-xs"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v) => formatCompact(v as number, baseCurrency)}
          className="text-xs"
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          content={
            <ChartTooltipContent
              indicator="dot"
              labelFormatter={(_, payload) => {
                const iso = payload?.[0]?.payload?.date as string | undefined;
                return iso
                  ? new Date(iso).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "";
              }}
              formatter={(value) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">Net worth</span>
                  <span className="num font-medium">
                    {formatMoney(value as number, { currency: baseCurrency })}
                  </span>
                </div>
              )}
            />
          }
        />
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2}
          fill="url(#fillNetworth)"
          dot={false}
          activeDot={{ r: 3.5, strokeWidth: 0 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
