import "server-only";

import crypto from "node:crypto";

/**
 * Application-level encryption for sensitive text fields (account names/numbers,
 * institutions, merchant descriptions, people's names, notes).
 *
 * AES-256-GCM. The key lives ONLY in the app's environment (APP_ENCRYPTION_KEY),
 * never in the database — so the DB (and any leak/backup/provider) only ever
 * sees ciphertext, while amounts stay plaintext so reports/sums still work.
 *
 * Generate a key:  openssl rand -base64 32
 *
 * Graceful no-op: if no key is set (e.g. local demo) values pass through as
 * plaintext, and decrypt returns non-encrypted values unchanged — so existing
 * data and the keyless local mode keep working.
 */

const PREFIX = "enc1:";

function getKey(): Buffer | null {
  const b64 = process.env.APP_ENCRYPTION_KEY;
  if (!b64) return null;
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error(
      "APP_ENCRYPTION_KEY must be 32 bytes (base64). Generate with: openssl rand -base64 32"
    );
  }
  return key;
}

/** Encrypt a string for storage. Returns plaintext unchanged if no key set. */
export function enc(value: string | null | undefined): string | null {
  if (value == null || value === "") return value ?? null;
  const key = getKey();
  if (!key) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Decrypt a stored string. Returns the value unchanged if it isn't encrypted. */
export function dec(value: string | null | undefined): string | null {
  if (value == null) return null;
  const key = getKey();
  if (!key || !value.startsWith(PREFIX)) return value;
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key / corrupt value — return as-is rather than crashing.
    return value;
  }
}

/** Stable, non-reversible token for dedupe keys (so plaintext isn't stored). */
export function hashToken(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 40);
}
