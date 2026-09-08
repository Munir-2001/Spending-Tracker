import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/config";
import { DEMO_USER_ID } from "@/lib/schema";

/**
 * Session scope resolution — shared by the db layer (workspace read/write
 * filtering) and the server actions. Kept separate from `actions.ts` so
 * `db-supabase.ts` can import the active-workspace resolver without an import
 * cycle. These are internal helpers, NOT server actions (no "use server").
 */

/** Local file-store demo runs as a single user in a single workspace. */
export const DEMO_WORKSPACE_ID = "00000000-0000-0000-0000-0000000000ws";

/** The signed-in user's id (memoized per request). */
export const getUserId = cache(async (): Promise<string> => {
  if (!SUPABASE_CONFIGURED) return DEMO_USER_ID;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
});

/**
 * The active workspace ("book") id for the current user (memoized per request).
 * Reads `user_settings.active_workspace_id`, falling back to the user's earliest
 * workspace. Uses the raw Supabase client — NEVER the workspace-scoped `db`
 * layer, which would recurse. RLS still guarantees the row belongs to the user.
 */
export const getActiveWorkspaceId = cache(async (): Promise<string> => {
  if (!SUPABASE_CONFIGURED) return DEMO_WORKSPACE_ID;
  const userId = await getUserId();
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("user_settings")
    .select("active_workspace_id")
    .eq("user_id", userId)
    .maybeSingle();
  const active = (settings?.active_workspace_id as string | null) ?? null;
  if (active) return active;

  // Fallback: the earliest workspace this user owns (backfill/signup guarantees ≥1).
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (org?.id) return org.id as string;

  throw new Error("No workspace found for the current user");
});
