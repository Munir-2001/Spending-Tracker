/**
 * Currency-exchange maths for transfers between accounts in different currencies
 * (sent ₨92,700 from Meezan, received €300 in Revolut). Both amounts are stored
 * as entered; these helpers only describe the rate and how it compares to market.
 */
import { toMajorUnits, type Fx } from "@/lib/currency";

/** Below this gap vs market, the difference isn't worth mentioning. */
export const MARKET_GAP_NOTICE = 0.005;

/** "1 {base} = {rate} {quote}", oriented so the rate reads ≥ 1. */
export type ExchangeQuote = { base: string; quote: string; rate: number };

export function exchangeQuote(
  sent: number,
  sentCurrency: string,
  received: number,
  receivedCurrency: string
): ExchangeQuote | null {
  const s = toMajorUnits(Math.abs(sent), sentCurrency);
  const r = toMajorUnits(Math.abs(received), receivedCurrency);
  if (!(s > 0) || !(r > 0)) return null;
  return s >= r
    ? { base: receivedCurrency, quote: sentCurrency, rate: s / r }
    : { base: sentCurrency, quote: receivedCurrency, rate: r / s };
}

/**
 * How much more (+) or less (−) arrived than today's market rate would give, in
 * the received currency's minor units — or 0 when the gap is negligible.
 */
export function marketGap(
  sent: number,
  sentCurrency: string,
  received: number,
  receivedCurrency: string,
  fx: Fx
): number {
  const atMarket = Math.abs(fx.convert(Math.abs(sent), sentCurrency, receivedCurrency));
  if (atMarket === 0) return 0;
  const gap = Math.abs(received) - atMarket;
  return Math.abs(gap) >= atMarket * MARKET_GAP_NOTICE ? gap : 0;
}
