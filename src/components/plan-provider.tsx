"use client";

import { createContext, useContext } from "react";

import type { Entitlement } from "@/lib/entitlement";
import { FREE_ENTITLEMENT } from "@/lib/entitlement";

/**
 * Exposes the signed-in user's Pro entitlement to client components, seeded once
 * by the server (the layout calls `getEntitlement()` and passes it here). Client
 * checks are for UI/upsell only — the authoritative gate lives in the server
 * actions (`requirePro`).
 */
const Ctx = createContext<Entitlement>(FREE_ENTITLEMENT);

export function PlanProvider({
  value,
  children,
}: {
  value: Entitlement;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** `{ pro, trialing, founding }` for the current user. */
export function useEntitlement(): Entitlement {
  return useContext(Ctx);
}
