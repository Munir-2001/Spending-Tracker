/**
 * Repayment maths for reimbursable expenses ("bought for a friend").
 *
 * A friend can pay you back in a different currency than the claim (you sent
 * PKR, they sent EUR). Each repayment inflow stores the rate it was exchanged at
 * as `fxRate` = claim-currency units per 1 received unit (major units, e.g. 309
 * PKR per EUR), so "how much of the claim did this cover" is exact and never
 * drifts with today's market rate. A claim can be repaid in several parts; what
 * is still owed = owed − Σ covered by its linked repayments.
 *
 * Pure and framework-free so it's unit-testable and shared by client + server.
 */
import { toMajorUnits, toMinorUnits, type Fx } from "@/lib/currency";
import type { Transaction } from "@/lib/data";

/**
 * A repayment within this fraction of what's left is treated as settling it in
 * full — absorbs rounding and small rate differences.
 */
export const SETTLE_TOLERANCE = 0.02;

/** Today's market rate: units of `to` that 1 unit of `from` buys (major units). */
export function marketRate(fx: Fx, from: string, to: string): number {
  if (from === to) return 1;
  // Rates are "USD per unit"; ratio them directly so tiny rates (e.g. EUR per
  // PKR) don't round to zero the way a minor-unit conversion would.
  return (fx.rates[from] ?? 1) / (fx.rates[to] ?? 1);
}

/**
 * How much of a claim (in the claim's currency, minor units) a repayment covers.
 * Same currency → its amount. Different currency → amount × the stored rate, or
 * today's market rate for older repayments recorded before rates were stored.
 */
export function coveredBy(
  repayment: Pick<Transaction, "amount" | "currency" | "fxRate">,
  claimCurrency: string,
  fx: Fx
): number {
  const amount = Math.abs(repayment.amount);
  if (repayment.currency === claimCurrency) return amount;
  const rate = repayment.fxRate;
  if (rate && rate > 0)
    return toMinorUnits(toMajorUnits(amount, repayment.currency) * rate, claimCurrency);
  return Math.abs(fx.convert(amount, repayment.currency, claimCurrency));
}

/** Received amount (minor units of `currency`) needed to cover `cover` at `rate`. */
export function receivedFor(
  cover: number,
  claimCurrency: string,
  rate: number,
  currency: string
): number {
  if (!(rate > 0)) return 0;
  return toMinorUnits(toMajorUnits(cover, claimCurrency) / rate, currency);
}

/** The rate implied by receiving `received` for `cover` of the claim, or null. */
export function impliedRate(
  cover: number,
  claimCurrency: string,
  received: number,
  currency: string
): number | null {
  const receivedMajor = toMajorUnits(Math.abs(received), currency);
  if (!(receivedMajor > 0) || !(cover > 0)) return null;
  return toMajorUnits(cover, claimCurrency) / receivedMajor;
}

/** Repayment inflows grouped by the claim they settle. */
export function repaymentsByClaim(transactions: Transaction[]): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (!t.settlesId) continue;
    const list = map.get(t.settlesId) ?? [];
    list.push(t);
    map.set(t.settlesId, list);
  }
  return map;
}

/**
 * What is still owed on a claim, in the claim's currency (minor units). Zero once
 * settled; otherwise the owed amount minus everything already repaid against it.
 */
export function claimRemaining(
  claim: Transaction,
  repayments: Transaction[],
  fx: Fx
): number {
  const r = claim.reimbursement;
  if (!r || r.settled) return 0;
  const paid = repayments.reduce((sum, t) => sum + coveredBy(t, claim.currency, fx), 0);
  return Math.max(0, r.amount - paid);
}

/** Whether covering `covered` of `remaining` should close the claim. */
export function settlesClaim(covered: number, remaining: number): boolean {
  return covered >= remaining * (1 - SETTLE_TOLERANCE);
}

/**
 * Rates are stored as claim-per-received, but shown in whichever direction reads
 * ≥ 1 ("₨309 per €", never "€0.0032 per ₨"). True when the display is flipped.
 */
export function isRateInverted(fx: Fx, received: string, claimCurrency: string): boolean {
  return marketRate(fx, received, claimCurrency) < 1;
}
