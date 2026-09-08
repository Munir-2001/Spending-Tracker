import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TableMap, TableName } from "@/lib/schema";
import { WORKSPACE_SCOPED } from "@/lib/schema";
import { getActiveWorkspaceId } from "@/server/workspace";

/**
 * Thin data-access layer over Supabase. The function signatures match the old
 * file-based store, so the server actions didn't have to change. Every query
 * runs through the user-scoped Supabase client, so Row-Level Security ensures
 * each user only ever touches their own rows.
 *
 * Workspace scoping: tables in {@link WORKSPACE_SCOPED} are additionally filtered
 * to the caller's active workspace (`org_id`) on read, and stamped with it on
 * insert. Cross-USER safety still comes from RLS/`user_id`; `org_id` only silos
 * a single user's separate books from one another.
 */

/** Read every (visible) row from a table. */
export async function selectAll<T extends TableName>(
  table: T
): Promise<TableMap[T][]> {
  const supabase = await createClient();
  let q = supabase.from(table).select("*");
  if (WORKSPACE_SCOPED.has(table)) q = q.eq("org_id", await getActiveWorkspaceId());
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TableMap[T][];
}

/** Read rows matching a shallow equality filter. */
export async function selectWhere<T extends TableName>(
  table: T,
  where: Partial<TableMap[T]>
): Promise<TableMap[T][]> {
  const supabase = await createClient();
  const match: Record<string, unknown> = { ...(where as Record<string, unknown>) };
  if (WORKSPACE_SCOPED.has(table)) match.org_id = await getActiveWorkspaceId();
  const { data, error } = await supabase.from(table).select("*").match(match);
  if (error) throw error;
  return (data ?? []) as TableMap[T][];
}

export async function findById<T extends TableName>(
  table: T,
  id: string
): Promise<TableMap[T] | null> {
  const supabase = await createClient();
  let q = supabase.from(table).select("*").eq("id", id);
  if (WORKSPACE_SCOPED.has(table)) q = q.eq("org_id", await getActiveWorkspaceId());
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return (data as TableMap[T]) ?? null;
}

/**
 * Insert a row and return the inserted record. For workspace-scoped tables the
 * active workspace is auto-stamped onto `org_id` when the caller left it null —
 * so callers don't have to thread the workspace through every insert. Pass an
 * explicit `org_id` to target a specific workspace (e.g. an invoice's income txn).
 */
export async function insert<T extends TableName>(
  table: T,
  row: TableMap[T]
): Promise<TableMap[T]> {
  const supabase = await createClient();
  const toInsert: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  if (WORKSPACE_SCOPED.has(table) && toInsert.org_id == null) {
    toInsert.org_id = await getActiveWorkspaceId();
  }
  const { data, error } = await supabase
    .from(table)
    .insert(toInsert)
    .select()
    .single();
  if (error) throw error;
  return data as TableMap[T];
}

/**
 * Patch a row by id and return the updated record (or null if absent). When
 * `ownerId` is given, the update is additionally scoped to that user_id —
 * defense in depth alongside RLS, so the query itself can never touch another
 * user's row even if RLS were ever misconfigured.
 */
export async function update<T extends TableName>(
  table: T,
  id: string,
  patch: Partial<TableMap[T]>,
  ownerId?: string
): Promise<TableMap[T] | null> {
  const supabase = await createClient();
  let q = supabase
    .from(table)
    .update(patch as Record<string, unknown>)
    .eq("id", id);
  if (ownerId) q = q.eq("user_id", ownerId);
  const { data, error } = await q.select().maybeSingle();
  if (error) throw error;
  return (data as TableMap[T]) ?? null;
}

/** Delete a row by id (optionally scoped to `ownerId`). Returns true on success. */
export async function remove<T extends TableName>(
  table: T,
  id: string,
  ownerId?: string
): Promise<boolean> {
  const supabase = await createClient();
  let q = supabase.from(table).delete().eq("id", id);
  if (ownerId) q = q.eq("user_id", ownerId);
  const { error } = await q;
  if (error) throw error;
  return true;
}
