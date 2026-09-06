import type Stripe from "stripe";

import { getStripe, upsertSubscription } from "@/server/billing";

/**
 * `POST /api/billing/webhook` — Stripe events → the ONLY writer of the
 * `subscriptions` entitlement table (via service role in `upsertSubscription`).
 * Verifies the signature against the raw body. Node runtime.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("not configured", { status: 503 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing signature", { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return new Response("invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
          session.client_reference_id ?? session.metadata?.user_id ?? null;
        if (userId && session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await upsertSubscription(sub, userId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (userId) await upsertSubscription(sub, userId);
        break;
      }
    }
  } catch (err) {
    console.error("[stripe webhook] handler error:", err);
    return new Response("handler error", { status: 500 });
  }

  return new Response("ok");
}
