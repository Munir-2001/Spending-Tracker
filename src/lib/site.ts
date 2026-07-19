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
 * Canonical origin, used (server-side only) for metadata, Open Graph, sitemap,
 * robots and llms.txt. Prefers an explicit NEXT_PUBLIC_SITE_URL (set this once
 * you have a custom domain), then auto-detects the Vercel deployment URL, then a
 * placeholder. Auto-detection means og:image resolves correctly on Vercel with
 * zero config. VERCEL_* are server env vars, and SITE_URL is never read on the
 * client, so this stays correct.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL &&
    `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  "https://ledger.app"
).replace(/\/$/, "");
