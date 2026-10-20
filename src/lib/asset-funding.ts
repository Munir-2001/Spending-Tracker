/**
 * "Paid from" for asset purchases. Buying gold/crypto from a bank account is an
 * asset swap, not spending: Dr Asset (cost basis) / Cr Bank. The bank side is a
 * single outflow transaction flagged as a transfer, so it moves the balance but
 * never shows up in Money out or category spend.
 */
import { convertWithRates } from "@/lib/currency";
import type { AssetType } from "@/lib/schema";

/** Holdings valued from their purchase lots × live price. Money can't simply be
 *  transferred into these — the next re-price would overwrite it — so buys are
 *  recorded as a lot with "Paid from" instead. */
export function isLotPriced(type: AssetType): boolean {
  return type === "gold" || type === "crypto";
}

export type FundingOutflow = { amount: number; currency: string };

/** The bank-side outflow for a lot: its full cost basis, negative, in the paying
 *  account's currency (converted at current rates if the currencies differ). */
export function fundingOutflow(
  lot: { costBasis: number; currency: string },
  accountCurrency: string,
  rates: Record<string, number>
): FundingOutflow {
  const amount = convertWithRates(Math.abs(lot.costBasis), lot.currency, accountCurrency, rates);
  return { amount: -Math.abs(amount), currency: accountCurrency };
}
