import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import type { TableMap, TableName } from "@/lib/schema";

/**
 * Local "database" — each table is a JSON file under `/data`. Used in local mode
 * (no Supabase keys) so the app runs on localhost with zero setup. Same function
 * signatures as the Supabase impl, so the selector in db.ts can swap freely.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const fileFor = (table: TableName) => path.join(DATA_DIR, `${table}.json`);

async function readJson<T>(file: string): Promise<T[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeJson<T>(file: string, rows: T[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(rows, null, 2) + "\n", "utf8");
}

export async function selectAll<T extends TableName>(
  table: T
): Promise<TableMap[T][]> {
  return readJson<TableMap[T]>(fileFor(table));
}

export async function selectWhere<T extends TableName>(
  table: T,
  where: Partial<TableMap[T]>
): Promise<TableMap[T][]> {
  const rows = await selectAll(table);
  const entries = Object.entries(where);
  return rows.filter((row) =>
    entries.every(([k, v]) => (row as Record<string, unknown>)[k] === v)
  );
}

export async function findById<T extends TableName>(
  table: T,
  id: string
): Promise<TableMap[T] | null> {
  const rows = await selectAll(table);
  return rows.find((r) => (r as { id: string }).id === id) ?? null;
}

export async function insert<T extends TableName>(
  table: T,
  row: TableMap[T]
): Promise<TableMap[T]> {
  const rows = await selectAll(table);
  rows.push(row);
  await writeJson(fileFor(table), rows);
  return row;
}

export async function update<T extends TableName>(
  table: T,
  id: string,
  patch: Partial<TableMap[T]>
): Promise<TableMap[T] | null> {
  const rows = await selectAll(table);
  const idx = rows.findIndex((r) => (r as { id: string }).id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...patch };
  await writeJson(fileFor(table), rows);
  return rows[idx];
}

export async function remove<T extends TableName>(
  table: T,
  id: string
): Promise<boolean> {
  const rows = await selectAll(table);
  const next = rows.filter((r) => (r as { id: string }).id !== id);
  if (next.length === rows.length) return false;
  await writeJson(fileFor(table), next);
  return true;
}

// Single-document settings file (local mode only).
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

export async function readSettings<T = Record<string, unknown>>(): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeSettings<T>(doc: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");
}
