"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppData } from "@/components/transactions/transactions-provider";
import { CURRENCIES } from "@/lib/currency";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { baseCurrency, rates, accounts, updateSettings, refreshRates } = useAppData();

  const [base, setBase] = useState(baseCurrency);
  const [refreshing, setRefreshing] = useState(false);

  const usedCodes = new Set(accounts.filter((a) => !a.isGroup).map((a) => a.currency));

  function save() {
    updateSettings({ baseCurrency: base, rates });
    toast.success("Settings saved", { description: `Display currency: ${base}` });
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshRates();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-col gap-1.5">
          <h1 className="display text-3xl tracking-tight md:text-4xl">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Choose the currency your totals are shown in. Exchange rates update
            themselves.
          </p>
        </div>
      </Reveal>

      {/* Display currency */}
      <Reveal delay={0.05}>
        <section className="mt-8 rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="text-sm font-semibold tracking-tight">Display currency</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Net worth, budgets, and reports roll up to this currency. Each
            transaction still shows its original currency.
          </p>
          <div className="mt-4 max-w-xs space-y-1.5">
            <Label>Show totals in</Label>
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} · {c.name}
                    {usedCodes.has(c.code) ? " (in use)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>
      </Reveal>

      {/* Exchange rates — live */}
      <Reveal delay={0.1}>
        <section className="mt-3 rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Exchange rates</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Live mid-market rates, refreshed automatically. Used only to combine
                currencies into one total — your stored amounts never change.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
              {refreshing ? "Updating…" : "Refresh"}
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CURRENCIES.filter((c) => c.code !== "USD").map((c) => {
              const r = rates[c.code];
              const perUsd = r && r > 0 ? 1 / r : null;
              return (
                <div
                  key={c.code}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <span className="font-medium">
                    {c.symbol} {c.code}
                  </span>
                  <span className="num text-muted-foreground">
                    $1 ={" "}
                    {perUsd != null
                      ? perUsd.toLocaleString(undefined, {
                          maximumFractionDigits: perUsd > 100 ? 0 : 4,
                        })
                      : "—"}{" "}
                    {c.code}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </Reveal>

      <Reveal delay={0.15}>
        <div className="mt-4 flex justify-end">
          <Button onClick={save}>Save settings</Button>
        </div>
      </Reveal>
    </div>
  );
}
