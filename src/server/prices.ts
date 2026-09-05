import "server-only";

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { GRAMS_PER_UNIT } from "@/lib/gold";
import { fxFromPerUsd } from "@/lib/fx";
import { createAdminClient } from "@/lib/supabase/admin";

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

const swissquoteUrl = (metal: "XAU" | "XAG") =>
  `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${metal}/USD`;

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

// Hard ceiling on any single upstream request so a hanging or very slow external
// API can't stall the serverless function — it aborts, and the caller's existing
// try/catch degrades to the last-known cached value.
const FETCH_TIMEOUT_MS = 8000;
function timedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

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

/** Free public metal/USD feed (per troy ounce) → USD per-gram. Null on failure. */
async function fetchSwissquoteGram(metal: "XAU" | "XAG" = "XAU"): Promise<number | null> {
  try {
    const res = await timedFetch(swissquoteUrl(metal), {
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

/** goldapi.io per-gram in `currency` — fallback only, and only if a key is set. */
async function fetchGoldApiGram(
  currency: string,
  metal: "XAU" | "XAG" = "XAU"
): Promise<number | null> {
  const token = process.env.GOLD_API_KEY;
  if (!token) return null;
  try {
    const res = await timedFetch(`https://www.goldapi.io/api/${metal}/${currency.toUpperCase()}`, {
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
 * Live metal spot in USD (per-gram), shared by gold (XAU) and silver (XAG).
 * Free public feed first, keyed goldapi.io only as a fallback. Cached in the
 * shared DB `price_cache` in production (so the upstream is hit ~once per TTL for
 * the whole app), and on disk in local mode. `force` bypasses the cache.
 */
async function getMetalQuote(
  metal: "XAU" | "XAG",
  force: boolean
): Promise<GoldQuote | null> {
  const admin = createAdminClient();
  const fetchGram = async () =>
    (await fetchSwissquoteGram(metal)) ?? (await fetchGoldApiGram("USD", metal));

  // Production: shared DB cache.
  if (admin) {
    const dbKey = `metal:${metal}`;
    const hit = await dbCacheGet(admin, dbKey);
    if (!force && hit && Date.now() - Date.parse(hit.at) < TTL_MS) {
      return hit.data as GoldQuote;
    }
    const gram = await fetchGram();
    if (gram == null || !Number.isFinite(gram) || gram <= 0) {
      return (hit?.data as GoldQuote) ?? null; // upstream down → last-known
    }
    const quote: GoldQuote = { gram24k: gram, currency: "USD", at: new Date().toISOString() };
    await dbCacheSet(admin, dbKey, quote);
    return quote;
  }

  // Local mode: on-disk cache.
  const key = `${metal}:USD`;
  const cache = await readCache();
  const hit = cache[key];
  if (!force && hit && Date.now() - Date.parse(hit.at) < TTL_MS) return hit;

  const gram = await fetchGram();
  if (gram == null || !Number.isFinite(gram) || gram <= 0) return hit ?? null;

  const quote: GoldQuote = { gram24k: gram, currency: "USD", at: new Date().toISOString() };
  cache[key] = quote;
  try {
    await writeCache(cache);
  } catch {
    /* ignore */
  }
  return quote;
}

/**
 * International gold spot in USD (per-gram 24k) — the source of truth. Callers
 * convert into each holding's currency with the user's own FX rates. `force`
 * bypasses the cache so an explicit user refresh always re-fetches.
 */
export function getUsdGoldQuote(force = false): Promise<GoldQuote | null> {
  return getMetalQuote("XAU", force);
}

/**
 * Live silver spot in USD (per-gram) for the Zakat silver nisab. `gram24k` holds
 * the per-gram pure-silver price (the field name is shared with the gold quote).
 */
export function getUsdSilverQuote(force = false): Promise<GoldQuote | null> {
  return getMetalQuote("XAG", force);
}

/**
 * Live FX rates as "USD value of 1 unit of currency" — our numeraire convention
 * — for the currencies the app supports. Primary source is open.er-api.com (free,
 * no key); if it's unreachable we fall back to Fawaz Ahmed's currency-api (free,
 * no key, CDN-hosted). Both return units-per-USD, which `fxFromPerUsd` inverts
 * and sanitizes. Cached like the metal spot; `force` bypasses the cache. Falls
 * back to the last-known cached rates when BOTH sources fail (the caller then
 * layers its own defaults under these).
 */
// FX moves at most once a day, so we refresh at most once a day for the whole
// app. The shared DB row means the upstream API is hit ~once per TTL total, not
// once per serverless instance / cold start.
const FX_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const FX_CACHE_KEY = "fx:usd";

// ── Shared DB cache (production) ─────────────────────────────────────────────
// A single durable row per feed, read/written through the service-role client so
// it's the same cache for every instance. Returns null (→ callers degrade) when
// Supabase isn't configured (local mode) or on any error — never throws.
async function dbCacheGet(
  admin: SupabaseClient,
  key: string
): Promise<{ data: unknown; at: string } | null> {
  try {
    const { data, error } = await admin
      .from("price_cache")
      .select("data, fetched_at")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { data: unknown; fetched_at: string };
    return { data: row.data, at: row.fetched_at };
  } catch {
    return null;
  }
}

async function dbCacheSet(admin: SupabaseClient, key: string, value: unknown): Promise<void> {
  try {
    await admin
      .from("price_cache")
      .upsert(
        { key, data: value, fetched_at: new Date().toISOString() },
        { onConflict: "key" }
      );
  } catch {
    // A cache-write failure must never break the request that triggered it.
  }
}

/** Batch read (one query) — for per-item caches like crypto coins. */
async function dbCacheGetMany(
  admin: SupabaseClient,
  keys: string[]
): Promise<Map<string, { data: unknown; at: string }>> {
  const out = new Map<string, { data: unknown; at: string }>();
  if (keys.length === 0) return out;
  try {
    const { data, error } = await admin
      .from("price_cache")
      .select("key, data, fetched_at")
      .in("key", keys);
    if (error || !data) return out;
    for (const row of data as { key: string; data: unknown; fetched_at: string }[])
      out.set(row.key, { data: row.data, at: row.fetched_at });
  } catch {
    /* return whatever we have */
  }
  return out;
}

/** Batch upsert — writes only the keys that were refreshed this call. */
async function dbCacheSetMany(
  admin: SupabaseClient,
  entries: { key: string; data: unknown }[]
): Promise<void> {
  if (entries.length === 0) return;
  const at = new Date().toISOString();
  try {
    await admin
      .from("price_cache")
      .upsert(
        entries.map((e) => ({ key: e.key, data: e.data, fetched_at: at })),
        { onConflict: "key" }
      );
  } catch {
    /* cache-write failure must never break the request */
  }
}

/** CoinGecko USD price per coin id, sanitized. Returns only the ids it resolved
 *  (missing/failed ids are simply absent); never throws. */
async function fetchCoinGeckoUsd(ids: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (ids.length === 0) return out;
  try {
    const res = await timedFetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids
        .map(encodeURIComponent)
        .join(",")}&vs_currencies=usd`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );
    if (!res.ok) return out;
    const raw: unknown = await res.json();
    const data =
      raw && typeof raw === "object"
        ? (raw as Record<string, { usd?: unknown }>)
        : {};
    for (const id of ids) {
      const p = sane(data[id]?.usd, MAX_COIN_USD);
      if (p != null) out[id] = p;
    }
  } catch {
    /* return what we have */
  }
  return out;
}

/** Primary → fallback FX fetch → "USD value of 1 unit" map, or null if both fail. */
async function fetchFxMap(): Promise<Record<string, number> | null> {
  const perUsd = (await fetchErApiRates()) ?? (await fetchFawazRates());
  return perUsd ? fxFromPerUsd(perUsd) : null;
}

export async function getFxRatesUsd(force = false): Promise<Record<string, number>> {
  const admin = createAdminClient();

  // Production (Supabase): the shared DB row is the source of truth. Reads never
  // touch the upstream API; only a stale (or forced) read re-fetches and stores.
  if (admin) {
    const hit = await dbCacheGet(admin, FX_CACHE_KEY);
    if (!force && hit && Date.now() - Date.parse(hit.at) < FX_TTL_MS) {
      return hit.data as Record<string, number>;
    }
    const fresh = await fetchFxMap();
    if (!fresh) return (hit?.data as Record<string, number>) ?? {}; // sources down → last-known
    await dbCacheSet(admin, FX_CACHE_KEY, fresh);
    return fresh;
  }

  // Local mode (no Supabase): fall back to the on-disk cache.
  const cache = await readCache();
  const cachedRates = (): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const k of Object.keys(cache))
      if (k.startsWith("FX:") && k !== "FX:__at__") out[k.slice(3)] = cache[k].gram24k;
    return out;
  };
  const at = cache["FX:__at__"];
  if (!force && at && Date.now() - Date.parse(at.at) < FX_TTL_MS) return cachedRates();

  const fresh = await fetchFxMap();
  if (!fresh) return cachedRates(); // both sources down → keep last-known

  const stamp = new Date().toISOString();
  for (const [code, usdPerUnit] of Object.entries(fresh)) {
    if (code === "USD") continue;
    cache[`FX:${code}`] = { gram24k: usdPerUnit, currency: code, at: stamp };
  }
  cache["FX:__at__"] = { gram24k: 1, currency: "USD", at: stamp };
  try {
    await writeCache(cache);
  } catch {
    /* ignore */
  }
  return fresh;
}

/** open.er-api.com → raw units-per-USD map (UPPERCASE codes), or null on failure. */
async function fetchErApiRates(): Promise<Record<string, unknown> | null> {
  try {
    const res = await timedFetch("https://open.er-api.com/v6/latest/USD", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: unknown; rates?: unknown };
    if (data?.result !== "success" || !data.rates || typeof data.rates !== "object")
      return null; // unexpected / error shape
    return data.rates as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Fawaz Ahmed's currency-api (free, no key, CDN) → raw units-per-USD map
 * (lowercase codes), or null. Shape: `{ date, usd: { eur: 0.9, pkr: 278, … } }`.
 * Tries the jsDelivr host, then the Cloudflare Pages mirror.
 */
async function fetchFawazRates(): Promise<Record<string, unknown> | null> {
  const urls = [
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
    "https://latest.currency-api.pages.dev/v1/currencies/usd.min.json",
  ];
  for (const url of urls) {
    try {
      const res = await timedFetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { usd?: unknown };
      if (data.usd && typeof data.usd === "object")
        return data.usd as Record<string, unknown>;
    } catch {
      continue;
    }
  }
  return null;
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

  const admin = createAdminClient();
  const out: Record<string, number> = {};

  // Production: shared DB cache, one row per coin (`crypto:<id>`).
  if (admin) {
    const cached = await dbCacheGetMany(admin, unique.map((id) => `crypto:${id}`));
    const missing: string[] = [];
    for (const id of unique) {
      const hit = cached.get(`crypto:${id}`);
      if (!force && hit && Date.now() - Date.parse(hit.at) < TTL_MS) {
        out[id] = (hit.data as GoldQuote).gram24k;
      } else {
        missing.push(id);
      }
    }
    if (missing.length === 0) return out;

    const fetched = await fetchCoinGeckoUsd(missing);
    const at = new Date().toISOString();
    const toWrite: { key: string; data: unknown }[] = [];
    for (const id of missing) {
      const p = fetched[id];
      if (p != null) {
        out[id] = p;
        toWrite.push({ key: `crypto:${id}`, data: { gram24k: p, currency: "USD", at } });
      } else {
        const hit = cached.get(`crypto:${id}`);
        if (hit) out[id] = (hit.data as GoldQuote).gram24k; // stale but better than nothing
      }
    }
    await dbCacheSetMany(admin, toWrite);
    return out;
  }

  // Local mode: on-disk cache.
  const cache = await readCache();
  const missing: string[] = [];
  for (const id of unique) {
    const hit = cache[`CRYPTO:${id}`];
    if (!force && hit && Date.now() - Date.parse(hit.at) < TTL_MS) out[id] = hit.gram24k;
    else missing.push(id);
  }
  if (missing.length === 0) return out;

  const fetched = await fetchCoinGeckoUsd(missing);
  const at = new Date().toISOString();
  for (const id of missing) {
    const p = fetched[id];
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
  return out;
}
