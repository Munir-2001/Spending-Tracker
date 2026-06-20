"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function SettingsPage() {
  const { baseCurrency, rates, accounts, updateSettings } = useAppData();

  const [base, setBase] = useState(baseCurrency);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(CURRENCIES.map((c) => [c.code, String(rates[c.code] ?? 1)]))
  );

  const usedCodes = new Set(accounts.filter((a) => !a.isGroup).map((a) => a.currency));

  function save() {
    const nextRates: Record<string, number> = {};
    for (const c of CURRENCIES) {
      const v = Number.parseFloat(draft[c.code]);
      nextRates[c.code] = Number.isFinite(v) && v > 0 ? v : (rates[c.code] ?? 1);
    }
    nextRates["USD"] = 1; // numeraire is always 1
    updateSettings({ baseCurrency: base, rates: nextRates });
    toast.success("Settings saved", {
      description: `Display currency: ${base}`,
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-col gap-1.5">
          <h1 className="display text-3xl tracking-tight md:text-4xl">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Choose the currency your totals are shown in, and keep exchange rates
            up to date.
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

      {/* Exchange rates */}
      <Reveal delay={0.1}>
        <section className="mt-3 rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="text-sm font-semibold tracking-tight">Exchange rates</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Value of 1 unit in USD. Used only to combine different currencies into
            one total — your stored amounts never change.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CURRENCIES.map((c) => (
              <div
                key={c.code}
                className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2"
              >
                <span className="w-20 shrink-0 text-sm font-medium">
                  {c.symbol} {c.code}
                </span>
                <span className="text-xs text-muted-foreground">1 =</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={c.code === "USD" ? "1" : draft[c.code]}
                  disabled={c.code === "USD"}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, [c.code]: e.target.value }))
                  }
                  className="num h-8 text-right"
                />
                <span className="text-xs text-muted-foreground">USD</span>
              </div>
            ))}
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
