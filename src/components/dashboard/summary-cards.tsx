"use client";

import { Reveal } from "@/components/reveal";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  currenciesInUse,
  monthFlowsBase,
  netWorthBase,
  pendingReceivablesBase,
} from "@/lib/compute";
import { formatMoney } from "@/lib/format";
import { useAppData } from "@/components/transactions/transactions-provider";

export function SummaryCards() {
  const { accounts, items, balanceOf, baseCurrency, fx } = useAppData();
  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long" });

  const netWorth =
    netWorthBase(accounts, balanceOf, fx) + pendingReceivablesBase(items, fx);
  const { income, expense, net } = monthFlowsBase(
    items,
    now.getFullYear(),
    now.getMonth(),
    fx
  );

  const accountCount = accounts.filter((a) => !a.isGroup).length;
  const currencyCount = currenciesInUse(accounts).length;
  const money = { currency: baseCurrency, trimZeroCents: true } as const;

  return (
    <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Reveal delay={0.05}>
        <StatCard
          accent
          label="Net worth"
          value={formatMoney(netWorth, money)}
          caption={
            accountCount === 0
              ? "Add an account to begin"
              : `${accountCount} account${accountCount > 1 ? "s" : ""}${
                  currencyCount > 1 ? ` · ${currencyCount} currencies → ${baseCurrency}` : ""
                }`
          }
        />
      </Reveal>
      <Reveal delay={0.1}>
        <StatCard label="Income" value={formatMoney(income, money)} caption={`Received in ${monthName}`} />
      </Reveal>
      <Reveal delay={0.15}>
        <StatCard
          label="Spending"
          value={formatMoney(-expense, money)}
          caption={`Spent in ${monthName}`}
        />
      </Reveal>
      <Reveal delay={0.2}>
        <StatCard
          label="Net cashflow"
          value={formatMoney(net, { ...money, signed: true })}
          caption="Income less spending"
        />
      </Reveal>
    </div>
  );
}
