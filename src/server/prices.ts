import "server-only";

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { GRAMS_PER_UNIT } from "@/lib/gold";

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
    const data = (await res.json()) as SwissquoteQuote[];
    for (const platform of data ?? []) {
      for (const p of platform.spreadProfilePrices ?? []) {
        const bid = Number(p.bid);
        const ask = Number(p.ask);
        if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0) {
          const midOzt = (bid + ask) / 2; // USD per troy ounce
          return midOzt / OZT_GRAMS; // USD per gram, 24k
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
    const data = (await res.json()) as { price_gram_24k?: number };
    const g = Number(data.price_gram_24k);
    return Number.isFinite(g) && g > 0 ? g : null;
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
