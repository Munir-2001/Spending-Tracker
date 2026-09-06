import type { SubscriptionRow, SubscriptionStatus } from "@/lib/schema";

/**
 * Pure entitlement logic — the single place that decides whether a user is Pro.
 * Shared by the server (gating) and the client (UI), so both agree. No I/O.
 *
 * `trialing` counts as Pro (the 14-day trial unlocks everything); `past_due`
 * keeps access during Stripe's dunning grace so a failed card doesn't instantly
 * lock a paying user out; `canceled`/`incomplete`/no-row are free.
 */

export type Entitlement = {
  pro: boolean;
  /** True while on the 14-day trial (drives "X days left" UI). */
  trialing: boolean;
  /** True for the 50%-off-forever founding cohort. */
  founding: boolean;
};

const PRO_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  "active",
  "trialing",
  "past_due",
]);

export const FREE_ENTITLEMENT: Entitlement = {
  pro: false,
  trialing: false,
  founding: false,
};

/** Map a subscription row (or none) to what the user is entitled to. */
export function entitlementFrom(
  sub: Pick<SubscriptionRow, "status" | "founding"> | null | undefined
): Entitlement {
  if (!sub) return FREE_ENTITLEMENT;
  return {
    pro: PRO_STATUSES.has(sub.status),
    trialing: sub.status === "trialing",
    founding: sub.founding ?? false,
  };
}
