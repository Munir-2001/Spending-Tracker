"use client";

import { createContext, useContext } from "react";

import type { Workspace } from "@/lib/data";

/**
 * Exposes the user's workspaces + the active one to client components, seeded by
 * the layout. Pass-through (no internal state) like {@link PlanProvider}, so a
 * `router.refresh()` propagates a fresh value — a rename shows instantly, and a
 * switch flips the active id.
 */
type WorkspaceContextValue = {
  workspaces: Workspace[];
  activeId: string;
};

const Ctx = createContext<WorkspaceContextValue>({ workspaces: [], activeId: "" });

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceContextValue;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** `{ workspaces, activeId }` for the current user. */
export function useWorkspaces(): WorkspaceContextValue {
  return useContext(Ctx);
}
