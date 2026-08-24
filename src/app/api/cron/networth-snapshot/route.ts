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
 * Default (monthly, run on the 1st): writes ONE snapshot per user dated to the
 * month that just closed (previous month-end), capturing today's honest figure
 * so it's frozen in time. Idempotent — re-running overwrites that same date.
 *
 * `?seed=1`: one-time backfill. Writes APPROXIMATE snapshots for the trailing
 * months (default 6) so a fresh install isn't an empty chart. Seed rows never
 * overwrite an existing snapshot (a later real snapshot always wins).
 *
 * Auth: `Authorization: Bearer $CRON_SECRET`. Vercel Cron sends this header
 * automatically when CRON_SECRET is set in the project env.
 */
export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Last calendar day of the month containing (year, month0). */
const monthEnd = (year: number, month0: number) => ymd(new Date(year, month0 + 1, 0));

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
  const months = Math.min(24, Math.max(1, Number(url.searchParams.get("months")) || 6));
  const now = new Date();

  // Pull everything once and group by user — cheaper than N queries per user.
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

  const accountsByUser = groupBy(
    (accounts.data ?? []) as AccountRow[],
    (r) => r.user_id
  );
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

  for (const userId of userIds) {
    const userAccounts = accountsByUser.get(userId) ?? [];
    const userTxns = txnsByUser.get(userId) ?? [];
    const userLines = linesByUser.get(userId) ?? [];
    const userAssets = assetsByUser.get(userId) ?? [];
    // No accounts and no assets ⇒ nothing meaningful to snapshot.
    if (userAccounts.length === 0 && userAssets.length === 0) continue;

    const userRates = resolveUserRates(
      settingsByUser.get(userId) ?? null,
      liveRates,
      DEFAULT_BASE_CURRENCY
    );

    if (seed) {
      const series = netWorthSeedFromRows(
        userAccounts,
        userTxns,
        userLines,
        userAssets,
        userRates,
        now,
        months
      );
      for (const p of series) {
        const [y, m] = p.month.split("-").map(Number);
        // Skip the current (still-open) month — the live dashboard covers it.
        if (y === now.getFullYear() && m - 1 === now.getMonth()) continue;
        rows.push({
          user_id: userId,
          as_of: monthEnd(y, m - 1),
          value_minor: Math.round(p.value),
          base_currency: userRates.baseCurrency,
          breakdown: {},
          approximate: true,
        });
      }
    } else {
      const snap = netWorthFromRows(
        userAccounts,
        userTxns,
        userLines,
        userAssets,
        userRates
      );
      rows.push({
        user_id: userId,
        as_of: monthEnd(now.getFullYear(), now.getMonth() - 1),
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
  }

  if (rows.length === 0) {
    return Response.json({ ok: true, seed, users: userIds.length, written: 0 });
  }

  // Monthly snapshots overwrite the same (user, date); seed points never clobber
  // an existing snapshot (a real one always wins).
  const { error: writeError } = await supabase
    .from("net_worth_snapshots")
    .upsert(rows, { onConflict: "user_id,as_of", ignoreDuplicates: seed });
  if (writeError) {
    return Response.json({ error: writeError.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    seed,
    users: userIds.length,
    written: rows.length,
  });
}
