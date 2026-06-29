/**
 * Money is stored everywhere as an integer number of MINOR UNITS of the row's
 * currency (cents for USD, whole rupees for PKR, …). Display formatting is the
 * ONLY place we convert back to major units. Never do math on the formatted
 * strings — keep arithmetic on the integer minor units.
 */

import { currencyInfo, decimalsFor, toMajorUnits } from "@/lib/currency";

export const DEFAULT_CURRENCY = "USD";

type MoneyOptions = {
  currency?: string;
  /** Show an explicit +/− sign (used for signed cashflow figures). */
  signed?: boolean;
  /** Drop the fraction when the value is a whole amount. */
  trimZeroCents?: boolean;
};

/** Format minor units as a localized currency string, e.g. 123456 USD → "$1,234.56". */
export function formatMoney(minor: number, opts: MoneyOptions = {}): string {
  const { currency = DEFAULT_CURRENCY, signed = false, trimZeroCents = false } =
    opts;
  const decimals = decimalsFor(currency);
  const major = toMajorUnits(Math.abs(minor), currency);
  const whole = major % 1 === 0;

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: trimZeroCents && whole ? 0 : decimals,
    maximumFractionDigits: decimals,
  }).format(major);

  if (minor < 0) return `−${formatted}`;
  if (signed && minor > 0) return `+${formatted}`;
  return formatted;
}

/** Compact form for chart axes and tight spaces, e.g. 1234567 USD → "$12.3k". */
export function formatCompact(minor: number, currency = DEFAULT_CURRENCY): string {
  const major = toMajorUnits(minor, currency);
  const symbol = currencyInfo(currency).symbol;
  const sign = major < 0 ? "−" : "";
  const abs = Math.abs(major);
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)
    return `${sign}${symbol}${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

const DAY = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" });
const FULL = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });

export function formatDate(iso: string): string {
  return DAY.format(new Date(iso));
}

export function formatFullDate(iso: string): string {
  return FULL.format(new Date(iso));
}

export function formatMonth(iso: string): string {
  return MONTH.format(new Date(iso));
}

/** Human relative label for recent transactions: "Today", "Yesterday", else date. */
export function formatRelativeDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays === -1) return "Tomorrow";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < -1 && diffDays > -7) return `in ${-diffDays} days`;
  return formatDate(iso);
}

export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}
