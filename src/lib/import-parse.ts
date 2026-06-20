/**
 * Client-side parsing for CSV / XLSX bank-statement imports. Files are read in
 * the browser (never uploaded) and turned into row objects keyed by header.
 * Bank exports vary enormously, so we guess columns and let the user correct.
 */

import * as XLSX from "xlsx";

export type ParsedSheet = {
  headers: string[];
  rows: Record<string, string>[];
};

/** Read an .xlsx/.xls/.csv file into headers + row objects. */
export async function parseWorkbook(file: File): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { headers: [], rows: [] };

  // Array-of-arrays so we can locate the real header row (banks add preambles).
  const matrix = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  if (matrix.length === 0) return { headers: [], rows: [] };

  // Header = the row with the most non-empty cells in the first ~10 rows.
  let headerIdx = 0;
  let best = -1;
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const filled = matrix[i].filter((c) => String(c).trim() !== "").length;
    if (filled > best) {
      best = filled;
      headerIdx = i;
    }
  }

  const rawHeaders = matrix[headerIdx].map((h, i) =>
    String(h).trim() || `Column ${i + 1}`
  );
  const rows: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const cells = matrix[i];
    if (cells.every((c) => String(c).trim() === "")) continue;
    const obj: Record<string, string> = {};
    rawHeaders.forEach((h, j) => {
      obj[h] = String(cells[j] ?? "").trim();
    });
    rows.push(obj);
  }

  return { headers: rawHeaders, rows };
}

/** Pick the first header that contains any of the keyword fragments. */
export function guessColumn(
  headers: string[],
  keywords: string[]
): string | undefined {
  const lower = headers.map((h) => ({ h, l: h.toLowerCase() }));
  for (const kw of keywords) {
    const hit = lower.find(({ l }) => l.includes(kw));
    if (hit) return hit.h;
  }
  return undefined;
}

/** Parse a money string ("1,234.50", "(45.00)", "Rs 2,000", "-12") → number. */
export function parseAmount(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.includes("-");
  s = s.replace(/[()]/g, "");
  // Keep digits, separators and sign; drop currency symbols/letters.
  s = s.replace(/[^0-9.,-]/g, "");
  // If both separators present, assume comma = thousands.
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  else if (s.includes(",") && !s.includes("."))
    // Comma as decimal (e.g. "1.234,56" handled above; "12,50" → 12.50)
    s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  s = s.replace(/-/g, "");
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Detect whether a date column is day-first or month-first from its values. */
export function detectDateOrder(samples: string[]): "dmy" | "mdy" {
  for (const s of samples) {
    const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
    if (m) {
      const a = Number(m[1]);
      if (a > 12) return "dmy"; // first part can only be a day
    }
  }
  return "dmy"; // default to day-first (most non-US bank exports)
}

/** Parse a date string into an ISO yyyy-mm-dd, honoring day/month order. */
export function parseDate(raw: string, order: "dmy" | "mdy"): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // ISO or yyyy/mm/dd
  const iso = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (iso) return toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // dd/mm/yyyy or mm/dd/yyyy
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const p1 = Number(m[1]);
    const p2 = Number(m[2]);
    const day = order === "dmy" ? p1 : p2;
    const month = order === "dmy" ? p2 : p1;
    return toIso(y, month, day);
  }

  // Fallback: let the engine try (e.g. "5 Jun 2026").
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return toIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return null;
}

function toIso(y: number, m: number, d: number): string | null {
  if (!y || !m || !d || m > 12 || d > 31) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}`;
}
