/**
 * Pure FX-rate normalization shared by the live-rate fetchers. Kept out of the
 * server module so it's unit-testable without network or filesystem.
 *
 * Two conventions are in play:
 *  - "per USD": how many units of a currency equal 1 USD — what upstream APIs
 *    return (open.er-api's `rates`, Fawaz's `usd` map).
 *  - "USD per unit": the USD value of 1 unit — the app's numeraire convention.
 */
import { CURRENCIES } from "@/lib/currency";

// Wide enough to never reject a genuine quote, tight enough to reject garbage or
// an injected extreme value that would corrupt downstream money math.
export const MAX_FX_PER_USD = 1e9;

/** Accept a units-per-USD value only if it's finite, positive, and in range. */
export function saneFxRate(n: unknown): number | null {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) && v > 0 && v < MAX_FX_PER_USD ? v : null;
}

/**
 * Invert a "per USD" rate map into the app's "USD per unit" convention, for the
 * supported currencies only. Case-insensitive on the source keys, so it accepts
 * both open.er-api (UPPERCASE codes) and Fawaz (lowercase codes) unchanged. Any
 * currency whose rate is missing or fails the sanity check is dropped rather than
 * poisoning the map. USD is always 1.
 */
export function fxFromPerUsd(perUsd: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = { USD: 1 };
  for (const { code } of CURRENCIES) {
    if (code === "USD") continue;
    const raw = perUsd[code] ?? perUsd[code.toLowerCase()];
    const perUsdRate = saneFxRate(raw);
    if (perUsdRate != null) out[code] = 1 / perUsdRate;
  }
  return out;
}
