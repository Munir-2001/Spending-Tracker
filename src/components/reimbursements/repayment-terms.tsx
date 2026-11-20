"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currencyInfo, toMajorUnits, toMinorUnits, type Fx } from "@/lib/currency";
import type { Transaction } from "@/lib/data";
import { formatMoney } from "@/lib/format";
import {
  coveredBy,
  impliedRate,
  isRateInverted,
  marketRate,
  receivedFor,
  settlesClaim,
} from "@/lib/reimbursement";
import { cn } from "@/lib/utils";

/** Show a rate difference vs market only when it's worth mentioning. */
const MARKET_GAP_NOTICE = 0.005;

const fmtRate = (r: number) => String(Number(r.toPrecision(6)));
const fmtMajor = (minor: number, currency: string) =>
  String(Number(toMajorUnits(minor, currency).toFixed(currencyInfo(currency).decimals)));

/** Parse a typed major-unit amount into positive minor units, or null. */
function parseMinor(value: string, currency: string): number | null {
  const major = Number.parseFloat(value);
  return Number.isFinite(major) && major > 0 ? toMinorUnits(major, currency) : null;
}

function parseRate(value: string): number | null {
  const r = Number.parseFloat(value);
  return Number.isFinite(r) && r > 0 ? r : null;
}

/** Default received amount: what's left on the claim, at today's market rate. */
export function defaultReceived(
  remaining: number,
  claimCurrency: string,
  currency: string,
  fx: Fx
): string {
  const minor = receivedFor(remaining, claimCurrency, marketRate(fx, currency, claimCurrency), currency);
  return fmtMajor(minor, currency);
}

export type RepaymentResult =
  | { ok: true; amount: number; fxRate: number | null; settle: boolean }
  | { ok: false; error: string };

/**
 * State + rules for the "how much did this repay" part of a repayment form.
 *
 * Settle-in-full (default): amount and rate are linked through what's owed —
 * type what arrived and the rate is derived, or type the agreed rate and the
 * amount follows. Partial: amount and rate are independent and the claim stays
 * open for whatever is left. The parent owns `amount` (it's shared with other
 * form modes); this owns the rate and the settle flag.
 */
export function useRepaymentTerms({
  claim,
  remaining,
  currency,
  amount,
  setAmount,
  fx,
  amountLocked = false,
}: {
  claim: Transaction | null;
  remaining: number;
  currency: string;
  amount: string;
  setAmount: (v: string) => void;
  fx: Fx;
  /** True when linking an already-recorded payment: the amount is fixed. */
  amountLocked?: boolean;
}) {
  const claimCurrency = claim?.currency ?? currency;
  const cross = Boolean(claim) && currency !== claimCurrency;
  const inverted = cross && isRateInverted(fx, currency, claimCurrency);
  const toDisplay = (stored: number) => (inverted ? 1 / stored : stored);
  const toStored = (display: number) => (inverted ? 1 / display : display);
  const market = marketRate(fx, currency, claimCurrency);

  const initialRate = () => {
    const received = parseMinor(amount, currency);
    const implied =
      amountLocked && received ? impliedRate(remaining, claimCurrency, received, currency) : null;
    return fmtRate(toDisplay(implied ?? market));
  };

  // Reset rate + settle whenever the claim, currency or locked payment changes.
  const key = `${claim?.id ?? ""}|${currency}|${amountLocked ? amount : ""}`;
  const [state, setState] = useState(() => ({ key, rate: initialRate(), settle: true }));
  if (state.key !== key) setState({ key, rate: initialRate(), settle: true });
  const { rate, settle } = state;
  const setRate = (r: string) => setState((s) => ({ ...s, rate: r }));
  const setSettle = (v: boolean) => setState((s) => ({ ...s, settle: v }));

  const received = parseMinor(amount, currency);
  const typedRate = parseRate(rate);
  // Settle mode with no rate typed: derive it from what arrived.
  const storedRate = !cross
    ? null
    : typedRate != null
      ? toStored(typedRate)
      : settle && received
        ? impliedRate(remaining, claimCurrency, received, currency)
        : null;

  const covered =
    received == null || (cross && storedRate == null)
      ? null
      : coveredBy({ amount: received, currency, fxRate: storedRate }, claimCurrency, fx);

  function onAmountChange(v: string) {
    setAmount(v);
    const next = parseMinor(v, currency);
    if (!cross) {
      if (next != null) setSettle(settlesClaim(next, remaining));
      return;
    }
    if (!settle || next == null) return;
    const implied = impliedRate(remaining, claimCurrency, next, currency);
    if (implied) setRate(fmtRate(toDisplay(implied)));
  }

  function onRateChange(v: string) {
    setRate(v);
    const r = parseRate(v);
    if (!settle || amountLocked || r == null) return;
    setAmount(fmtMajor(receivedFor(remaining, claimCurrency, toStored(r), currency), currency));
  }

  function onSettleChange(v: boolean) {
    setSettle(v);
    // Back to settle-in-full: re-link the rate to what actually arrived.
    if (v && cross && received) {
      const implied = impliedRate(remaining, claimCurrency, received, currency);
      if (implied) setRate(fmtRate(toDisplay(implied)));
    }
  }

  function toInput(): RepaymentResult {
    if (received == null) return { ok: false, error: "Enter the amount you received." };
    if (cross && storedRate == null)
      return { ok: false, error: "Enter the rate it was exchanged at." };
    return {
      ok: true,
      amount: received,
      fxRate: cross ? storedRate : null,
      settle: settle || settlesClaim(covered ?? 0, remaining),
    };
  }

  // Covered at market, to show how the agreed rate compares.
  const marketCovered =
    cross && received != null
      ? toMinorUnits(toMajorUnits(received, currency) * market, claimCurrency)
      : null;

  return {
    claimCurrency,
    currency,
    cross,
    rateUnit: inverted
      ? `${currencyInfo(currency).symbol} per ${currencyInfo(claimCurrency).symbol}`
      : `${currencyInfo(claimCurrency).symbol} per ${currencyInfo(currency).symbol}`,
    marketDisplay: cross ? fmtRate(toDisplay(market)) : null,
    rate,
    settle,
    received,
    covered,
    marketCovered,
    remaining,
    rateLocked: amountLocked && settle,
    onAmountChange,
    onRateChange,
    onSettleChange,
    toInput,
  };
}

export type RepaymentTerms = ReturnType<typeof useRepaymentTerms>;

/** Rate field (cross-currency only), settle-in-full toggle and a live summary. */
export function RepaymentTermsFields({ terms }: { terms: RepaymentTerms }) {
  const { claimCurrency, currency, cross, covered, remaining, settle } = terms;
  const money = (minor: number, cur = claimCurrency) => formatMoney(minor, { currency: cur });
  const fullyCovered = covered != null && settlesClaim(covered, remaining);
  const gap =
    terms.marketCovered && covered != null ? covered - terms.marketCovered : 0;
  const showGap =
    terms.marketCovered != null &&
    Math.abs(gap) >= terms.marketCovered * MARKET_GAP_NOTICE;

  return (
    <div className="space-y-3">
      {cross && (
        <div className="space-y-1.5">
          <Label htmlFor="repay-rate">Exchange rate ({terms.rateUnit})</Label>
          <Input
            id="repay-rate"
            inputMode="decimal"
            value={terms.rate}
            onChange={(e) => terms.onRateChange(e.target.value)}
            readOnly={terms.rateLocked}
            className={cn("num", terms.rateLocked && "bg-muted/40")}
          />
          <p className="text-[11px] text-muted-foreground">
            Today&apos;s market ≈ {terms.marketDisplay}.{" "}
            {settle
              ? "Type what arrived or the rate you agreed — the other follows."
              : "Enter the rate you actually got."}
          </p>
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={settle}
          onChange={(e) => terms.onSettleChange(e.target.checked)}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          <span className="font-medium">Settle in full</span>
          <span className="block text-xs text-muted-foreground">
            Untick if they&apos;ve only paid back part of it.
          </span>
        </span>
      </label>

      {covered != null && (
        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
          <p className="num">
            {cross && terms.received != null && (
              <>
                {money(terms.received, currency)} × {terms.rate} ={" "}
              </>
            )}
            <span className="font-medium text-foreground">{money(covered)}</span> of{" "}
            {money(remaining)} owed
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {fullyCovered
              ? "Settles the claim in full."
              : settle
                ? `Closes the claim — ${money(remaining - covered)} written off.`
                : `${money(remaining - covered)} still owed after this.`}
            {showGap &&
              ` ${money(Math.abs(gap))} ${gap < 0 ? "less" : "more"} than at market.`}
          </p>
        </div>
      )}
    </div>
  );
}
