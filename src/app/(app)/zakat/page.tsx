"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, HandHeart, Info } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useAppData } from "@/components/transactions/transactions-provider";
import { getZakatMetals } from "@/server/actions";
import {
  zakatLines,
  zakatSummary,
  ZAKAT_RATE,
  NISAB_GOLD_GRAMS,
  NISAB_SILVER_GRAMS,
  type ZakatCategory,
} from "@/lib/compute";
import { currencyInfo, toMajorUnits, toMinorUnits } from "@/lib/currency";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Standard = "silver" | "gold";

const CATEGORY_LABEL: Record<ZakatCategory, string> = {
  cash: "Cash",
  gold: "Gold",
  crypto: "Crypto",
  investment: "Investment",
  receivable: "Owed to you",
  debt: "Debt",
  other: "Personal use",
};

// Which section a line belongs to.
const SECTION: Record<ZakatCategory, "wealth" | "debt" | "excluded"> = {
  cash: "wealth",
  gold: "wealth",
  crypto: "wealth",
  investment: "wealth",
  receivable: "wealth",
  debt: "debt",
  other: "excluded",
};

export default function ZakatPage() {
  const { accounts, assets, items, balanceOf, baseCurrency, fx, rates } = useAppData();

  const [standard, setStandard] = useState<Standard>("silver");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [nisabOverride, setNisabOverride] = useState("");
  const [metals, setMetals] = useState<{
    goldGramUsd: number | null;
    silverGramUsd: number | null;
    at: string | null;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    getZakatMetals()
      .then((m) => alive && setMetals(m))
      .catch(() => alive && setMetals({ goldGramUsd: null, silverGramUsd: null, at: null }));
    return () => {
      alive = false;
    };
  }, []);

  // Lines with the user's include/exclude overrides applied.
  const lines = useMemo(() => {
    return zakatLines(accounts, balanceOf, assets, items, fx).map((l) => ({
      ...l,
      included: overrides[l.id] ?? l.included,
    }));
  }, [accounts, balanceOf, assets, items, fx, overrides]);

  // Nisab in base currency: metal grams × per-gram USD, converted USD→base.
  // rates[c] = USD value of 1 unit of c, so baseValue = usdValue / rates[base].
  const gramUsd = standard === "gold" ? metals?.goldGramUsd : metals?.silverGramUsd;
  const grams = standard === "gold" ? NISAB_GOLD_GRAMS : NISAB_SILVER_GRAMS;
  const computedNisab =
    gramUsd != null
      ? toMinorUnits((grams * gramUsd) / (rates[baseCurrency] ?? 1), baseCurrency)
      : null;
  const manualMajor = Number.parseFloat(nisabOverride);
  const nisab =
    Number.isFinite(manualMajor) && manualMajor >= 0
      ? toMinorUnits(manualMajor, baseCurrency)
      : computedNisab ?? 0;

  const summary = useMemo(() => zakatSummary(lines, nisab), [lines, nisab]);

  const sections = {
    wealth: lines.filter((l) => SECTION[l.category] === "wealth"),
    debt: lines.filter((l) => SECTION[l.category] === "debt"),
    excluded: lines.filter((l) => SECTION[l.category] === "excluded"),
  };
  const money = (v: number) => formatMoney(v, { currency: baseCurrency });
  const toggle = (id: string, current: boolean) =>
    setOverrides((prev) => ({ ...prev, [id]: !current }));

  const hasHoldings = lines.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-col gap-1.5">
          <h1 className="display text-3xl tracking-tight md:text-4xl">Zakat</h1>
          <p className="text-sm text-muted-foreground">
            Zakat is {ZAKAT_RATE * 100}% of your qualifying wealth once it stays above
            the nisab for a full lunar year. This estimates it from your accounts and
            assets — adjust anything below to match your situation.
          </p>
        </div>
      </Reveal>

      {!hasHoldings ? (
        <Reveal delay={0.05}>
          <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <HandHeart className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              Add accounts or assets and your Zakat will be calculated here.
            </p>
          </div>
        </Reveal>
      ) : (
        <>
          {/* Result */}
          <Reveal delay={0.05}>
            <div className="mt-8 rounded-2xl border border-border/60 bg-card p-6 md:p-8">
              <p className="text-sm text-muted-foreground">Zakat due</p>
              <p className="display mt-1 text-4xl tracking-tight md:text-5xl">
                <span className="num">{money(summary.due)}</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {summary.meetsNisab ? (
                  <>
                    {ZAKAT_RATE * 100}% of{" "}
                    <span className="num">{money(summary.net)}</span> net zakatable
                    wealth.
                  </>
                ) : (
                  <>
                    Your net zakatable wealth (
                    <span className="num">{money(summary.net)}</span>) is below the
                    nisab — no Zakat is due.
                  </>
                )}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border/60 pt-5 sm:grid-cols-3">
                <Stat label="Zakatable wealth" value={money(summary.zakatable)} />
                <Stat label="Debts deducted" value={money(summary.deductible)} />
                <Stat label="Net" value={money(summary.net)} />
              </div>
            </div>
          </Reveal>

          {/* Nisab */}
          <Reveal delay={0.1}>
            <div className="mt-6 rounded-2xl border border-border/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Nisab threshold</p>
                  <p className="text-xs text-muted-foreground">
                    {standard === "gold"
                      ? `${NISAB_GOLD_GRAMS} g of gold`
                      : `${NISAB_SILVER_GRAMS} g of silver`}
                    {gramUsd != null ? (
                      <> · live price{metals?.at ? "" : ""}</>
                    ) : (
                      <> · price unavailable — enter it below</>
                    )}
                  </p>
                </div>
                <Segmented<Standard>
                  value={standard}
                  onChange={setStandard}
                  ariaLabel="Nisab standard"
                  options={[
                    { value: "silver", label: "Silver" },
                    { value: "gold", label: "Gold" },
                  ]}
                />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {currencyInfo(baseCurrency).symbol}
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={nisabOverride}
                    onChange={(e) => setNisabOverride(e.target.value)}
                    placeholder={
                      computedNisab != null
                        ? String(toMajorUnits(computedNisab, baseCurrency))
                        : "Enter nisab"
                    }
                    className="num pl-7"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {nisabOverride ? "Custom" : "Auto"} ·{" "}
                  <span className="num">{money(nisab)}</span>
                </p>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Silver gives a lower threshold, so more wealth qualifies — many
                scholars recommend it. Choose the standard you follow.
              </p>
            </div>
          </Reveal>

          {/* Breakdown */}
          <Reveal delay={0.15}>
            <div className="mt-6 space-y-6">
              <LineSection
                title="Zakatable wealth"
                hint="Counted toward your Zakat."
                lines={sections.wealth}
                money={money}
                onToggle={toggle}
              />
              {sections.debt.length > 0 && (
                <LineSection
                  title="Debts"
                  hint="Subtracted from your wealth."
                  lines={sections.debt}
                  money={money}
                  onToggle={toggle}
                />
              )}
              {sections.excluded.length > 0 && (
                <LineSection
                  title="Personal use — usually exempt"
                  hint="Off by default. Turn on anything you hold to trade or invest."
                  lines={sections.excluded}
                  money={money}
                  onToggle={toggle}
                />
              )}
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="mt-8 flex items-start gap-2.5 rounded-xl bg-muted/50 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <p>
                This is an estimate to help you calculate Zakat, not a religious
                ruling. Rules on nisab, personal gold, investments, debts and the
                lunar-year (hawl) condition vary by school of thought — please
                confirm with a qualified scholar.
              </p>
            </div>
          </Reveal>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num text-lg font-medium">{value}</p>
    </div>
  );
}

function LineSection({
  title,
  hint,
  lines,
  money,
  onToggle,
}: {
  title: string;
  hint: string;
  lines: { id: string; label: string; category: ZakatCategory; value: number; included: boolean }[];
  money: (v: number) => string;
  onToggle: (id: string, current: boolean) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
        {lines.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onToggle(l.id, l.included)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
            aria-pressed={l.included}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                l.included
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              )}
            >
              {l.included && <Check className="size-3.5" />}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{l.label}</span>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {CATEGORY_LABEL[l.category]}
            </span>
            <span
              className={cn(
                "num shrink-0 text-sm tabular-nums",
                !l.included && "text-muted-foreground line-through"
              )}
            >
              {money(l.value)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
