import { createAdminClient } from "@/lib/supabase/admin";
import { getFxRatesUsd } from "@/server/prices";
import {
  netWorthFromRows,
  netWorthSeedFromRows,
  resolveUserRates,
} from "@/server/networth";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import type {
  AccountRow,
  AssetRow,
  NetWorthSnapshotRow,
  TransactionLineRow,
  TransactionRow,
  UserSettingsRow,
} from "@/lib/schema";

/**
 * Net-worth snapshot cron.
 *
 * Default (run hourly): takes ONE immutable snapshot per user at their local
 * end-of-day (≈23:00 in their timezone), dated to that local day. Snapshots are
 * NEVER overwritten — a day's value is frozen the moment it's captured, so
 * refreshing rates or re-running the job never rewrites history.
 *
 * `?force=1`: snapshot every user for their current local day right now,
 * regardless of the hour (manual/backfill of "today"). Still immutable.
 * `?seed=1`: one-time backfill of trailing months as APPROXIMATE points so a
 * fresh install isn't an empty chart. Also never overwrites a real snapshot.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it automatically).
 * An hourly trigger is required for true per-timezone timing — Vercel Pro cron,
 * or any external hourly pinger (e.g. cron-job.org) hitting this URL.
 */
export const dynamic = "force-dynamic";

// Local hour at which the daily snapshot is taken — "night", end of the day.
const SNAPSHOT_HOUR = 23;

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthEnd = (year: number, month0: number) => ymd(new Date(year, month0 + 1, 0));

/** A moment expressed in a given IANA timezone: local calendar date + hour. */
function localParts(now: Date, tz: string): { date: string; hour: number } {
  // A bad/unknown tz makes Intl throw — fall back to UTC so the user still gets
  // a daily snapshot (UTC is always valid, so this never recurses infinitely).
  const zone = (() => {
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC" });
      return tz || "UTC";
    } catch {
      return "UTC";
    }
  })();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now)
  );
  return { date, hour: Number.isFinite(hour) ? hour : 0 };
}

function groupBy<T>(rows: T[], key: (r: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    const arr = map.get(k) ?? [];
    arr.push(r);
    map.set(k, arr);
  }
  return map;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return Response.json({ error: "Service role not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const seed = url.searchParams.get("seed") === "1";
  const force = url.searchParams.get("force") === "1";
  const months = Math.min(24, Math.max(1, Number(url.searchParams.get("months")) || 6));
  const now = new Date();

  const [profiles, accounts, txns, lines, assets, settings, liveRates] =
    await Promise.all([
      supabase.from("profiles").select("id"),
      supabase.from("accounts").select("*"),
      supabase.from("transactions").select("*"),
      supabase.from("transaction_lines").select("*"),
      supabase.from("assets").select("*"),
      supabase.from("user_settings").select("*"),
      getFxRatesUsd(),
    ]);

  const firstError =
    profiles.error ||
    accounts.error ||
    txns.error ||
    lines.error ||
    assets.error ||
    settings.error;
  if (firstError) {
    return Response.json({ error: firstError.message }, { status: 500 });
  }

  const accountsByUser = groupBy((accounts.data ?? []) as AccountRow[], (r) => r.user_id);
  const txnRows = (txns.data ?? []) as TransactionRow[];
  const txnsByUser = groupBy(txnRows, (r) => r.user_id);
  const txnUser = new Map(txnRows.map((t) => [t.id, t.user_id]));
  const linesByUser = groupBy(
    (lines.data ?? []) as TransactionLineRow[],
    (l) => txnUser.get(l.transaction_id) ?? null
  );
  const assetsByUser = groupBy((assets.data ?? []) as AssetRow[], (r) => r.user_id);
  const settingsByUser = new Map(
    ((settings.data ?? []) as UserSettingsRow[]).map((s) => [s.user_id, s])
  );

  const userIds = ((profiles.data ?? []) as { id: string }[]).map((p) => p.id);
  const rows: Omit<NetWorthSnapshotRow, "id" | "created_at">[] = [];
  let due = 0; // users whose local night hit this run (daily mode)

  for (const userId of userIds) {
    const userAccounts = accountsByUser.get(userId) ?? [];
    const userTxns = txnsByUser.get(userId) ?? [];
    const userLines = linesByUser.get(userId) ?? [];
    const userAssets = assetsByUser.get(userId) ?? [];
    if (userAccounts.length === 0 && userAssets.length === 0) continue;

    const userSettings = settingsByUser.get(userId) ?? null;
    const userRates = resolveUserRates(userSettings, liveRates, DEFAULT_BASE_CURRENCY);

    if (seed) {
      const series = netWorthSeedFromRows(
        userAccounts, userTxns, userLines, userAssets, userRates, now, months
      );
      for (const p of series) {
        const [y, m] = p.month.split("-").map(Number);
        if (y === now.getFullYear() && m - 1 === now.getMonth()) continue; // skip open month
        rows.push({
          user_id: userId,
          as_of: monthEnd(y, m - 1),
          value_minor: Math.round(p.value),
          base_currency: userRates.baseCurrency,
          breakdown: {},
          approximate: true,
        });
      }
      continue;
    }

    // Daily: only the users for whom it's local end-of-day right now (unless forced).
    const { date: localDate, hour } = localParts(now, userSettings?.timezone ?? "UTC");
    if (!force && hour !== SNAPSHOT_HOUR) continue;
    due++;

    const snap = netWorthFromRows(userAccounts, userTxns, userLines, userAssets, userRates);
    rows.push({
      user_id: userId,
      as_of: localDate,
      value_minor: Math.round(snap.value),
      base_currency: userRates.baseCurrency,
      breakdown: {
        accounts: Math.round(snap.breakdown.accounts),
        assets: Math.round(snap.breakdown.assets),
        receivables: Math.round(snap.breakdown.receivables),
      },
      approximate: false,
    });
  }

  if (rows.length === 0) {
    return Response.json({ ok: true, seed, force, users: userIds.length, due, written: 0 });
  }

  // ALWAYS insert-if-absent: an existing (user, as_of) snapshot is immutable.
  const { error: writeError } = await supabase
    .from("net_worth_snapshots")
    .upsert(rows, { onConflict: "user_id,as_of", ignoreDuplicates: true });
  if (writeError) {
    return Response.json({ error: writeError.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    seed,
    force,
    users: userIds.length,
    due,
    written: rows.length,
  });
}
