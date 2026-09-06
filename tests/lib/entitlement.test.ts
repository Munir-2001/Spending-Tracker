import { describe, it, expect } from "vitest";

import { entitlementFrom, FREE_ENTITLEMENT } from "@/lib/entitlement";
import type { SubscriptionRow } from "@/lib/schema";

const sub = (o: Partial<SubscriptionRow>): SubscriptionRow => ({
  user_id: "u1",
  status: "active",
  plan: "pro",
  stripe_customer_id: null,
  stripe_subscription_id: null,
  price_id: null,
  current_period_end: null,
  cancel_at_period_end: false,
  founding: false,
  created_at: "",
  updated_at: "",
  ...o,
});

describe("entitlementFrom", () => {
  it("no subscription → free", () => {
    expect(entitlementFrom(null)).toEqual(FREE_ENTITLEMENT);
    expect(entitlementFrom(undefined)).toEqual(FREE_ENTITLEMENT);
  });

  it("active → pro", () => {
    expect(entitlementFrom(sub({ status: "active" })).pro).toBe(true);
  });

  it("trialing → pro AND trialing", () => {
    const e = entitlementFrom(sub({ status: "trialing" }));
    expect(e.pro).toBe(true);
    expect(e.trialing).toBe(true);
  });

  it("past_due keeps access (dunning grace)", () => {
    expect(entitlementFrom(sub({ status: "past_due" })).pro).toBe(true);
  });

  it("canceled / incomplete → free", () => {
    expect(entitlementFrom(sub({ status: "canceled" })).pro).toBe(false);
    expect(entitlementFrom(sub({ status: "incomplete" })).pro).toBe(false);
  });

  it("surfaces the founding flag", () => {
    expect(entitlementFrom(sub({ founding: true })).founding).toBe(true);
  });
});
