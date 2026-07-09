import "server-only";

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Live gold spot price via goldapi.io, cached to disk with a daily TTL so we
 * don't burn the free-tier quota. Degrades gracefully: no API key, a failed
 * request, or a bad response all fall back to the last cached value (or null).
 *
 * We request XAU in the asset's own currency, so goldapi returns the per-gram
 * 24k price already converted — no extra FX step needed.
 */
export type GoldQuote = { gram24k: number; currency: string; at: string };

const TTL_MS = 12 * 60 * 60 * 1000; // 12h

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

/** Per-gram 24k gold price in `currency`, cached daily. Null if unavailable. */
export async function getGoldQuote(currency: string): Promise<GoldQuote | null> {
  const key = `XAU:${currency.toUpperCase()}`;
  const cache = await readCache();
  const hit = cache[key];
  if (hit && Date.now() - Date.parse(hit.at) < TTL_MS) return hit;

  const token = process.env.GOLD_API_KEY;
  if (!token) return hit ?? null; // no key → last known (or nothing)

  try {
    const res = await fetch(
      `https://www.goldapi.io/api/XAU/${currency.toUpperCase()}`,
      {
        headers: { "x-access-token": token, "Content-Type": "application/json" },
        cache: "no-store",
      }
    );
    if (!res.ok) return hit ?? null;
    const data = (await res.json()) as { price_gram_24k?: number };
    const gram24k = Number(data.price_gram_24k);
    if (!Number.isFinite(gram24k) || gram24k <= 0) return hit ?? null;

    const quote: GoldQuote = {
      gram24k,
      currency: currency.toUpperCase(),
      at: new Date().toISOString(),
    };
    cache[key] = quote;
    // A cache-write failure (read-only FS) must not discard a good quote.
    try {
      await writeCache(cache);
    } catch {
      /* ignore */
    }
    return quote;
  } catch {
    return hit ?? null;
  }
}