"use client";

import { Reveal } from "@/components/reveal";
import { StatCard } from "@/components/dashboard/stat-card";
import { monthFlowsBase } from "@/lib/compute";
import { formatMoney } from "@/lib/format";
import { useAppData } from "@/components/transactions/transactions-provider";

/**
 * This month's cash movement — income, spending, and the net — shown as a calm
 * trio beneath the net-worth hero. Supporting detail, not the headline.
 */
export function MonthFlows() {
  const { items, baseCurrency, fx } = useAppData();
  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long" });
  const { income, expense, net } = monthFlowsBase(
    items,
    now.getFullYear(),
    now.getMonth(),
    fx
  );
  const money = { currency: baseCurrency, trimZeroCents: true } as const;

  return (
    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Reveal delay={0.05}>
        <StatCard
          label="Income"
          value={formatMoney(income, money)}
          caption={`Received in ${monthName}`}
        />
      </Reveal>
      <Reveal delay={0.1}>
        <StatCard
          label="Spending"
          value={formatMoney(-expense, money)}
          caption={`Spent in ${monthName}`}
        />
      </Reveal>
      <Reveal delay={0.15}>
        <StatCard
          label="Net"
          value={formatMoney(net, { ...money, signed: true })}
          caption="Income less spending"
        />
      </Reveal>
    </div>
  );
}
