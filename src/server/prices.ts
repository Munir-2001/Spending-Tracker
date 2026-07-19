import "server-only";

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { GRAMS_PER_UNIT } from "@/lib/gold";
import { CURRENCIES } from "@/lib/currency";

/**
 * Live gold spot price (per-gram 24k, in USD), cached to disk with a 12h TTL.
 *
 * Primary source is Swissquote's free public XAU/USD feed — no API key, no
 * quota. It quotes per troy ounce, so we take the bid/ask mid and divide by the
 * grams-per-ounce to get a per-gram 24k price. If it's ever unreachable we fall
 * back to goldapi.io, but only when GOLD_API_KEY is set. Any failure degrades to
 * the last-known cached value (or null).
 */
export type GoldQuote = { gram24k: number; currency: string; at: string };

const TTL_MS = 12 * 60 * 60 * 1000; // 12h
const OZT_GRAMS = GRAMS_PER_UNIT.ozt; // 31.1034768 g per troy ounce

const SWISSQUOTE_URL =
  "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD";

/**
 * Guard against a compromised, buggy, or spoofed upstream response: accept a
 * number only if it's finite, positive, and within a sane range. Rejects
 * NaN/Infinity/negatives/strings and absurd magnitudes that would otherwise
 * corrupt downstream money math. We only ever read specific numeric fields off
 * these responses (never render or eval them), so this bounds-check is the
 * whole sanitization surface.
 */
function sane(n: unknown, max: number): number | null {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) && v > 0 && v < max ? v : null;
}
// Loose upper bounds — wide enough to never reject a genuine quote, tight enough
// to reject garbage or injected extreme values.
const MAX_OZT = 1_000_000; // USD per troy ounce
const MAX_GRAM = 1_000_000; // USD per gram
const MAX_COIN_USD = 100_000_000; // USD per coin
const MAX_FX_PER_USD = 1e9; // units of a currency per 1 USD

// Prefer the project's /data dir (local mode); fall back to tmp on read-only
// serverless filesystems.
const CACHE_FILES = [
  path.join(process.cwd(), "data", "prices.json"),
  path.join(os.tmpdir(), "ledger-prices.json"),
];

async function readCache(): Promise<Record<string, GoldQuote>> {
  for (const file of CACHE_FILES) {
    try {
      return JSON.parse(await fs.readFile(file, "utf8")) as Record<string, GoldQuote>;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") continue;
    }
  }
  return {};
}

async function writeCache(data: Record<string, GoldQuote>): Promise<void> {
  const body = JSON.stringify(data, null, 2) + "\n";
  for (const file of CACHE_FILES) {
    try {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, body, "utf8");
      return;
    } catch {
      /* try next location */
    }
  }
}

type SwissquoteQuote = {
  spreadProfilePrices?: { bid?: number; ask?: number }[];
};

/** Free public XAU/USD feed (per troy ounce) → USD per-gram 24k. Null on failure. */
async function fetchSwissquoteGram(): Promise<number | null> {
  try {
    const res = await fetch(SWISSQUOTE_URL, {
      headers: { Accept: "application/json", "User-Agent": "Ledger/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return null; // unexpected shape → reject
    for (const platform of data as SwissquoteQuote[]) {
      const profiles = platform?.spreadProfilePrices;
      if (!Array.isArray(profiles)) continue;
      for (const p of profiles) {
        const bid = sane(p?.bid, MAX_OZT);
        const ask = sane(p?.ask, MAX_OZT);
        if (bid != null && ask != null) {
          return sane((bid + ask) / 2 / OZT_GRAMS, MAX_GRAM); // per-gram 24k, USD
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** goldapi.io per-gram 24k in `currency` — fallback only, and only if a key is set. */
async function fetchGoldApiGram(currency: string): Promise<number | null> {
  const token = process.env.GOLD_API_KEY;
  if (!token) return null;
  try {
    const res = await fetch(`https://www.goldapi.io/api/XAU/${currency.toUpperCase()}`, {
      headers: { "x-access-token": token, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { price_gram_24k?: unknown } | null;
    return sane(data?.price_gram_24k, MAX_GRAM);
  } catch {
    return null;
  }
}

/**
 * International gold spot in USD (per-gram 24k) — the source of truth. Callers
 * convert into each holding's currency with the user's own FX rates.
 *
 * `force` bypasses the fresh-cache short-circuit so an explicit user refresh
 * always re-fetches; background refreshes leave it false to reuse the cache.
 */
export async function getUsdGoldQuote(force = false): Promise<GoldQuote | null> {
  const key = "XAU:USD";
  const cache = await readCache();
  const hit = cache[key];
  if (!force && hit && Date.now() - Date.parse(hit.at) < TTL_MS) return hit;

  // Free public feed first; goldapi only as a keyed fallback.
  let gram24k = await fetchSwissquoteGram();
  if (gram24k == null) gram24k = await fetchGoldApiGram("USD");
  if (gram24k == null || !Number.isFinite(gram24k) || gram24k <= 0) return hit ?? null;

  const quote: GoldQuote = { gram24k, currency: "USD", at: new Date().toISOString() };
  cache[key] = quote;
  // A cache-write failure (read-only FS) must not discard a good quote.
  try {
    await writeCache(cache);
  } catch {
    /* ignore */
  }
  return quote;
}

/**
 * Live FX rates as "USD value of 1 unit of currency" — our numeraire convention
 * — for the currencies the app supports. Source: open.er-api.com (free, no key),
 * whose rates are units-per-USD, so we invert (1 / rate). Cached like the metal
 * spot; `force` bypasses the cache. Falls back to the last-known cached rates on
 * any failure (caller then layers its own defaults under these).
 */
export async function getFxRatesUsd(force = false): Promise<Record<string, number>> {
  const cachedRates = (): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const k of Object.keys(cache))
      if (k.startsWith("FX:") && k !== "FX:__at__") out[k.slice(3)] = cache[k].gram24k;
    return out;
  };
  const cache = await readCache();
  const at = cache["FX:__at__"];
  if (!force && at && Date.now() - Date.parse(at.at) < TTL_MS) return cachedRates();

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return cachedRates();
    const data = (await res.json()) as { result?: unknown; rates?: unknown };
    if (data?.result !== "success" || !data.rates || typeof data.rates !== "object")
      return cachedRates(); // unexpected / error shape → keep last-known
    const rates = data.rates as Record<string, unknown>;
    const stamp = new Date().toISOString();
    const out: Record<string, number> = { USD: 1 };
    for (const { code } of CURRENCIES) {
      if (code === "USD") continue;
      const perUsd = sane(rates[code], MAX_FX_PER_USD);
      if (perUsd != null) {
        const usdPerUnit = 1 / perUsd;
        out[code] = usdPerUnit;
        cache[`FX:${code}`] = { gram24k: usdPerUnit, currency: code, at: stamp };
      }
    }
    cache["FX:__at__"] = { gram24k: 1, currency: "USD", at: stamp };
    try {
      await writeCache(cache);
    } catch {
      /* ignore */
    }
    return out;
  } catch {
    return cachedRates();
  }
}

/**
 * Current USD price per coin for a set of CoinGecko ids, in one call. Free
 * public API, no key. Cached per coin with the same TTL as gold (reusing the
 * quote cache — `gram24k` holds the coin's USD unit price). `force` bypasses the
 * cache. Missing/failed coins fall back to their last-known price; unknown coins
 * are simply absent from the result.
 */
export async function getCryptoPricesUsd(
  ids: string[],
  force = false
): Promise<Record<string, number>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};

  const cache = await readCache();
  const out: Record<string, number> = {};
  const missing: string[] = [];
  for (const id of unique) {
    const hit = cache[`CRYPTO:${id}`];
    if (!force && hit && Date.now() - Date.parse(hit.at) < TTL_MS) out[id] = hit.gram24k;
    else missing.push(id);
  }
  if (missing.length === 0) return out;

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${missing
        .map(encodeURIComponent)
        .join(",")}&vs_currencies=usd`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );
    if (res.ok) {
      const raw: unknown = await res.json();
      const data =
        raw && typeof raw === "object"
          ? (raw as Record<string, { usd?: unknown }>)
          : {}; // unexpected shape → treat as empty, fall through to last-known
      const at = new Date().toISOString();
      for (const id of missing) {
        const p = sane(data[id]?.usd, MAX_COIN_USD);
        if (p != null) {
          out[id] = p;
          cache[`CRYPTO:${id}`] = { gram24k: p, currency: "USD", at };
        } else if (cache[`CRYPTO:${id}`]) {
          out[id] = cache[`CRYPTO:${id}`].gram24k; // stale but better than nothing
        }
      }
      try {
        await writeCache(cache);
      } catch {
        /* ignore */
      }
    } else {
      for (const id of missing)
        if (cache[`CRYPTO:${id}`]) out[id] = cache[`CRYPTO:${id}`].gram24k;
    }
  } catch {
    for (const id of missing)
      if (cache[`CRYPTO:${id}`]) out[id] = cache[`CRYPTO:${id}`].gram24k;
  }
  return out;
}
