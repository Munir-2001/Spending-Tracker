"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { NetWorthChart } from "@/components/dashboard/networth-chart";
import {
  assetsBase,
  currenciesInUse,
  monthFlowsBase,
  netWorthBase,
  pendingReceivablesBase,
} from "@/lib/compute";
import { formatMoney } from "@/lib/format";
import { useAppData } from "@/components/transactions/transactions-provider";
import { cn } from "@/lib/utils";

/**
 * The dashboard's hero: one honest number. Everything you own and owe — every
 * account, currency, and asset — rolled into a single net worth, with this
 * month's cash movement and the 6-month trend. This is the "here's where you
 * stand" moment; the rest of the dashboard is supporting detail.
 */
export function NetWorthHero() {
  const { accounts, items, assets, balanceOf, baseCurrency, fx } = useAppData();
  const now = new Date();

  const netWorth =
    netWorthBase(accounts, balanceOf, fx) +
    pendingReceivablesBase(items, fx) +
    assetsBase(assets, fx);
  const { net } = monthFlowsBase(items, now.getFullYear(), now.getMonth(), fx);

  const accountCount = accounts.filter((a) => !a.isGroup).length;
  const currencyCount = currenciesInUse(accounts).length;
  const up = net >= 0;
  const money = { currency: baseCurrency, trimZeroCents: true } as const;

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-border/60 bg-card p-6 md:p-8">
      <p className="text-sm text-muted-foreground">Your net worth</p>

      <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2.5">
        <span className="display num text-4xl leading-none tracking-tight tabular-nums md:text-6xl">
          {formatMoney(netWorth, money)}
        </span>
        {accountCount > 0 && net !== 0 && (
          <span
            className={cn(
              "num inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
              up ? "bg-income/12 text-income" : "bg-expense/12 text-expense"
            )}
          >
            {up ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            {formatMoney(Math.abs(net), money)} {up ? "saved" : "overspent"} this
            month
          </span>
        )}
      </div>

      <p className="mt-2.5 max-w-lg text-sm text-muted-foreground">
        {accountCount === 0
          ? "Add your first account to see your number."
          : `Across ${accountCount} account${accountCount > 1 ? "s" : ""}${
              currencyCount > 1
                ? ` in ${currencyCount} currencies → ${baseCurrency}`
                : ""
            }, plus every asset you hold.`}
      </p>

      <div className="mt-6 border-t border-border/60 pt-5">
        <p className="mb-3 text-xs text-muted-foreground">Last 6 months</p>
        <NetWorthChart />
      </div>
    </section>
  );
}
