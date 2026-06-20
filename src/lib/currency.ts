/**
 * Multi-currency support.
 *
 * Each account holds money in ONE currency. Amounts are stored as integer
 * MINOR UNITS of that currency (e.g. cents for USD, paisa-free whole rupees for
 * PKR) — never floats. The number of minor digits varies per currency, so we
 * keep a `decimals` map and convert at the edges (input → minor, minor →
 * display).
 *
 * To show a single blended figure (e.g. total net worth) across currencies we
 * roll everything up to a BASE currency using `RATES`. Rates are approximate
 * and meant to be user-editable later — we never silently invent a number
 * without surfacing that it's a conversion.
 */

export type CurrencyInfo = {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
};

export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 },
  { code: "EUR", symbol: "€", name: "Euro", decimals: 2 },
  { code: "GBP", symbol: "£", name: "British Pound", decimals: 2 },
  { code: "PKR", symbol: "₨", name: "Pakistani Rupee", decimals: 0 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", decimals: 2 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", decimals: 2 },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", decimals: 2 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", decimals: 2 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0 },
];

const byCode = new Map(CURRENCIES.map((c) => [c.code, c]));

export function currencyInfo(code: string): CurrencyInfo {
  return byCode.get(code) ?? { code, symbol: code, name: code, decimals: 2 };
}

export function decimalsFor(code: string): number {
  return currencyInfo(code).decimals;
}

/** Convert a major-unit amount (what the user types) to stored minor units. */
export function toMinorUnits(major: number, code: string): number {
  return Math.round(major * 10 ** decimalsFor(code));
}

/** Convert stored minor units back to a major-unit number. */
export function toMajorUnits(minor: number, code: string): number {
  return minor / 10 ** decimalsFor(code);
}

// FX rates expressed as: value of 1 unit of the currency in USD (the numeraire).
// These are editable defaults — the user can override them in Settings.
export const DEFAULT_BASE_CURRENCY = "USD";

export const DEFAULT_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  PKR: 0.0036,
  AED: 0.272,
  INR: 0.012,
  CAD: 0.73,
  AUD: 0.66,
  JPY: 0.0064,
};

/** Convert minor units between currencies using a given rate table (via USD). */
export function convertWithRates(
  minor: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  if (from === to) return minor;
  const rFrom = rates[from] ?? 1;
  const rTo = rates[to] ?? 1;
  const usd = toMajorUnits(minor, from) * rFrom;
  return toMinorUnits(usd / rTo, to);
}

/**
 * A configured FX context: the chosen display/base currency plus a rate table.
 * Components get this from the provider so every rolled-up figure uses the
 * user's currency and rates rather than hardcoded constants.
 */
export type Fx = {
  base: string;
  rates: Record<string, number>;
  convert: (minor: number, from: string, to: string) => number;
  toBase: (minor: number, from: string) => number;
};

export function makeFx(base: string, rates: Record<string, number>): Fx {
  return {
    base,
    rates,
    convert: (minor, from, to) => convertWithRates(minor, from, to, rates),
    toBase: (minor, from) => convertWithRates(minor, from, base, rates),
  };
}

// Back-compat constants (defaults) for any non-configured usage.
export const BASE_CURRENCY = DEFAULT_BASE_CURRENCY;
export function convertMinor(minor: number, from: string, to: string): number {
  return convertWithRates(minor, from, to, DEFAULT_RATES);
}
