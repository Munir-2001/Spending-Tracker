import "server-only";

import { makeFx, DEFAULT_RATES } from "@/lib/currency";
import {
  accountBalances,
  netWorthSeriesBase,
  netWorthSnapshot,
  type NetWorthPoint,
  type NetWorthSnapshotResult,
} from "@/lib/compute";
import { accountToUi, assetToUi, lineToUi, transactionToUi } from "@/server/mappers";
import type { TransactionItem } from "@/lib/data";
import type {
  AccountRow,
  AssetRow,
  TransactionLineRow,
  TransactionRow,
  UserSettingsRow,
} from "@/lib/schema";

/**
 * Net-worth computation shared by the snapshot cron and (as the seed) the
 * backfill. Pure functions over raw DB rows — no I/O — so they're trivially
 * testable and behave identically to the live dashboard figure, which comes
 * from the same {@link netWorthSnapshot} primitive.
 *
 * Asset valuation uses the stored `assets.value` column (materialised by the
 * price-refresh flow), and FX uses the rates live at capture time — i.e. this
 * captures exactly what the dashboard would show right now. That's the point of
 * a snapshot: freeze today's honest number so it never drifts later.
 */

export type UserRates = { baseCurrency: string; rates: Record<string, number> };

/**
 * A user's effective base currency + rate table: live rates take precedence,
 * then the user's saved overrides, then built-in defaults — matching
 * `getSettings()` so a snapshot uses the same numbers the app does.
 */
export function resolveUserRates(
  saved: Pick<UserSettingsRow, "base_currency" | "rates"> | null,
  liveRates: Record<string, number>,
  fallbackBase: string
): UserRates {
  return {
    baseCurrency: saved?.base_currency || fallbackBase,
    rates: { ...DEFAULT_RATES, ...(saved?.rates ?? {}), ...liveRates },
  };
}

/** Compute a user's net worth (total + breakdown) from their raw rows. */
export function netWorthFromRows(
  accountRows: AccountRow[],
  txnRows: TransactionRow[],
  lineRows: TransactionLineRow[],
  assetRows: AssetRow[],
  { baseCurrency, rates }: UserRates
): NetWorthSnapshotResult {
  const fx = makeFx(baseCurrency, rates);
  const accounts = accountRows.map(accountToUi);
  const assets = assetRows.map(assetToUi);

  const linesByTxn = new Map<string, TransactionItem[]>();
  for (const l of lineRows) {
    const arr = linesByTxn.get(l.transaction_id) ?? [];
    arr.push(lineToUi(l));
    linesByTxn.set(l.transaction_id, arr);
  }
  const transactions = txnRows.map((r) => transactionToUi(r, linesByTxn.get(r.id)));

  const balances = accountBalances(accounts, transactions, fx);
  return netWorthSnapshot(
    accounts,
    (id) => balances.get(id) ?? 0,
    assets,
    transactions,
    fx
  );
}

/**
 * APPROXIMATE trailing net-worth series for the one-time backfill seed, from raw
 * rows. Delegates to {@link netWorthSeriesBase} — past FX/asset prices aren't
 * historical, so these points are estimates (flagged `approximate` when stored).
 */
export function netWorthSeedFromRows(
  accountRows: AccountRow[],
  txnRows: TransactionRow[],
  lineRows: TransactionLineRow[],
  assetRows: AssetRow[],
  { baseCurrency, rates }: UserRates,
  anchor: Date,
  months: number
): NetWorthPoint[] {
  const fx = makeFx(baseCurrency, rates);
  const accounts = accountRows.map(accountToUi);
  const assets = assetRows.map(assetToUi);

  const linesByTxn = new Map<string, TransactionItem[]>();
  for (const l of lineRows) {
    const arr = linesByTxn.get(l.transaction_id) ?? [];
    arr.push(lineToUi(l));
    linesByTxn.set(l.transaction_id, arr);
  }
  const transactions = txnRows.map((r) => transactionToUi(r, linesByTxn.get(r.id)));

  return netWorthSeriesBase(accounts, transactions, assets, fx, anchor, months);
}
