import "server-only";

import Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionStatus } from "@/lib/schema";

/**
 * Stripe billing. The paywall's $0.99 trial + $12/mo Pro. All config is env-
 * driven (returns null when Stripe isn't configured, so the app degrades to a
 * friendly "checkout unavailable" instead of crashing). Entitlement is written
 * ONLY here (service-role) via the webhook — never trusted from the client.
 */

let _stripe: Stripe | null = null;
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

const site = () =>
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";

/** Stripe subscription status → our stored enum. */
export function mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    default:
      return "canceled"; // canceled, paused
  }
}

/** Period end, read defensively across Stripe API versions. */
function periodEndISO(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0] as unknown as
    | { current_period_end?: number | null }
    | undefined;
  const top = sub as unknown as { current_period_end?: number | null };
  const ts = item?.current_period_end ?? top.current_period_end ?? null;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

/** The user's stored Stripe customer id, if any. */
async function storedCustomerId(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.stripe_customer_id as string | null) ?? null;
}

/** Reuse or create the Stripe customer for a user (user_id kept in metadata). */
async function ensureCustomer(
  stripe: Stripe,
  userId: string,
  email?: string
): Promise<string> {
  const existing = await storedCustomerId(userId);
  if (existing) return existing;
  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId },
  });
  return customer.id;
}

/** Create a Checkout session; returns the redirect URL (or null if unconfigured). */
export async function createCheckout(opts: {
  userId: string;
  email?: string;
  plan: "trial" | "annual";
}): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const monthly = process.env.STRIPE_PRICE_MONTHLY;
  const annual = process.env.STRIPE_PRICE_ANNUAL;

  const customer = await ensureCustomer(stripe, opts.userId, opts.email);
  const base = {
    mode: "subscription" as const,
    customer,
    client_reference_id: opts.userId,
    automatic_tax: { enabled: true },
    customer_update: { address: "auto" as const },
    tax_id_collection: { enabled: true },
    success_url: `${site()}/dashboard?checkout=success`,
    cancel_url: `${site()}/paywall?checkout=cancel`,
  };

  if (opts.plan === "annual") {
    if (!annual) return null;
    const s = await stripe.checkout.sessions.create({
      ...base,
      line_items: [{ price: annual, quantity: 1 }],
      subscription_data: { metadata: { user_id: opts.userId } },
      allow_promotion_codes: true,
    });
    return s.url;
  }

  // $0.99 now (one-time) + 7-day trial, then $12/mo.
  if (!monthly) return null;
  const s = await stripe.checkout.sessions.create({
    ...base,
    line_items: [
      { price: monthly, quantity: 1 },
      {
        price_data: {
          currency: "usd",
          product_data: { name: "7-day trial" },
          unit_amount: 99,
        },
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: 7,
      metadata: { user_id: opts.userId },
    },
  });
  return s.url;
}

/** Billing Portal URL for the user to manage/cancel (or null). */
export async function createPortal(userId: string): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const customer = await storedCustomerId(userId);
  if (!customer) return null;
  const s = await stripe.billingPortal.sessions.create({
    customer,
    return_url: `${site()}/settings`,
  });
  return s.url;
}

/**
 * Upsert our `subscriptions` row from a Stripe Subscription (service-role write).
 * `userId` comes from subscription/customer metadata set at checkout.
 */
export async function upsertSubscription(
  sub: Stripe.Subscription,
  userId: string
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      status: mapStatus(sub.status),
      plan: "pro",
      stripe_customer_id:
        typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      price_id: sub.items.data[0]?.price.id ?? null,
      current_period_end: periodEndISO(sub),
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}
