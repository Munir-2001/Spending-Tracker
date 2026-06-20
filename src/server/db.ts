import "server-only";

import { SUPABASE_CONFIGURED } from "@/lib/supabase/config";
import * as fileDb from "@/server/db-file";
import * as supaDb from "@/server/db-supabase";

/**
 * Data-access layer. Picks the backend automatically:
 *   • Supabase     — when real keys are configured (production / deployed)
 *   • Local files  — otherwise (localhost demo, zero setup)
 * Both implementations share the same signatures, so callers never change.
 */
const impl: typeof supaDb = SUPABASE_CONFIGURED ? supaDb : fileDb;

export const selectAll = impl.selectAll;
export const selectWhere = impl.selectWhere;
export const findById = impl.findById;
export const insert = impl.insert;
export const update = impl.update;
export const remove = impl.remove;

// Single-doc settings (used by local mode; Supabase mode reads user_settings).
export const readSettings = fileDb.readSettings;
export const writeSettings = fileDb.writeSettings;
