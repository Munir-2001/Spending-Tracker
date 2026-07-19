/**
 * Site-wide constants. Configurable via env so they can differ per deployment
 * without code changes. `NEXT_PUBLIC_` = safe to read in the browser (these
 * values are shown publicly anyway).
 */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export const SITE_NAME = "Ledger";

export const SITE_TAGLINE = "Money, kept honest.";

export const SITE_DESCRIPTION =
  "An accounting-grade personal finance tracker. Double-entry rigor underneath, encrypted and multi-currency, with live gold, crypto and FX pricing \u2014 beautifully simple on top.";

/**
 * Canonical origin, used for metadata, Open Graph, sitemap, robots and llms.txt.
 * Set NEXT_PUBLIC_SITE_URL in the deployment (e.g. https://your-domain.com);
 * falls back to the Vercel-provided URL, then a placeholder.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : "https://ledger.app")
).replace(/\/$/, "");
