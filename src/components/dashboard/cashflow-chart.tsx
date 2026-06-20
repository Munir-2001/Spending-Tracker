"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { monthlyCashflowBase } from "@/lib/compute";
import { formatCompact, formatMonth } from "@/lib/format";
import { useAppData } from "@/components/transactions/transactions-provider";

const chartConfig = {
  income: { label: "Income", color: "var(--chart-1)" },
  expense: { label: "Spending", color: "var(--chart-4)" },
} satisfies ChartConfig;

export function CashflowChart() {
  const { items, baseCurrency, fx } = useAppData();

  if (items.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        Add transactions to see your cash-flow trend.
      </div>
    );
  }

  const data = monthlyCashflowBase(items, new Date(), fx, 6).map((p) => ({
    month: formatMonth(p.month),
    income: p.income,
    expense: p.expense,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-income)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-income)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fillExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-expense)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--color-expense)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          className="text-xs"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v) => formatCompact(v as number, baseCurrency)}
          className="text-xs"
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          content={
            <ChartTooltipContent
              indicator="dot"
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground capitalize">{name}</span>
                  <span className="num font-medium">
                    {formatCompact(value as number, baseCurrency)}
                  </span>
                </div>
              )}
            />
          }
        />
        <Area
          dataKey="income"
          type="monotone"
          stroke="var(--color-income)"
          strokeWidth={2}
          fill="url(#fillIncome)"
          dot={false}
          activeDot={{ r: 3.5, strokeWidth: 0 }}
        />
        <Area
          dataKey="expense"
          type="monotone"
          stroke="var(--color-expense)"
          strokeWidth={2}
          fill="url(#fillExpense)"
          dot={false}
          activeDot={{ r: 3.5, strokeWidth: 0 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
