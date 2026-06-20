import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TableMap, TableName } from "@/lib/schema";

/**
 * Thin data-access layer over Supabase. The function signatures match the old
 * file-based store, so the server actions didn't have to change. Every query
 * runs through the user-scoped Supabase client, so Row-Level Security ensures
 * each user only ever touches their own rows.
 */

/** Read every (visible) row from a table. */
export async function selectAll<T extends TableName>(
  table: T
): Promise<TableMap[T][]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw error;
  return (data ?? []) as TableMap[T][];
}

/** Read rows matching a shallow equality filter. */
export async function selectWhere<T extends TableName>(
  table: T,
  where: Partial<TableMap[T]>
): Promise<TableMap[T][]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .match(where as Record<string, unknown>);
  if (error) throw error;
  return (data ?? []) as TableMap[T][];
}

export async function findById<T extends TableName>(
  table: T,
  id: string
): Promise<TableMap[T] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as TableMap[T]) ?? null;
}

/** Insert a row and return the inserted record. */
export async function insert<T extends TableName>(
  table: T,
  row: TableMap[T]
): Promise<TableMap[T]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .insert(row as Record<string, unknown>)
    .select()
    .single();
  if (error) throw error;
  return data as TableMap[T];
}

/** Patch a row by id and return the updated record (or null if absent). */
export async function update<T extends TableName>(
  table: T,
  id: string,
  patch: Partial<TableMap[T]>
): Promise<TableMap[T] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .update(patch as Record<string, unknown>)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as TableMap[T]) ?? null;
}

/** Delete a row by id. Returns true on success. */
export async function remove<T extends TableName>(
  table: T,
  id: string
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
  return true;
}
