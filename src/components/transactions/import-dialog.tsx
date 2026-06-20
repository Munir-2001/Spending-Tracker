"use client";

import { useMemo, useRef, useState } from "react";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Account, Category } from "@/lib/data";
import type { ImportRow } from "@/server/actions";
import {
  detectDateOrder,
  guessColumn,
  parseAmount,
  parseDate,
  parseWorkbook,
  type ParsedSheet,
} from "@/lib/import-parse";
import { currencyInfo, toMinorUnits } from "@/lib/currency";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const NONE = "__none__";

export function ImportDialog({
  open,
  onOpenChange,
  onImport,
  accounts,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (
    accountId: string,
    categoryId: string | null,
    rows: ImportRow[]
  ) => Promise<{ created: unknown[]; skipped: number }>;
  accounts: Account[];
  categories: Category[];
}) {
  const selectable = useMemo(() => accounts.filter((a) => !a.isGroup), [accounts]);
  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);

  const [accountId, setAccountId] = useState("");
  const [dateCol, setDateCol] = useState("");
  const [descCol, setDescCol] = useState("");
  const [amountMode, setAmountMode] = useState<"single" | "split">("single");
  const [amountCol, setAmountCol] = useState("");
  const [debitCol, setDebitCol] = useState(NONE);
  const [creditCol, setCreditCol] = useState(NONE);
  const [flipSign, setFlipSign] = useState(false);
  const [dateOrder, setDateOrder] = useState<"dmy" | "mdy">("dmy");
  const [categoryId, setCategoryId] = useState(NONE);

  const currency = accounts.find((a) => a.id === accountId)?.currency ?? "USD";

  function resetAll() {
    setFileName("");
    setSheet(null);
    setDateCol("");
    setDescCol("");
    setAmountCol("");
    setDebitCol(NONE);
    setCreditCol(NONE);
    setAmountMode("single");
    setFlipSign(false);
    setCategoryId(NONE);
  }

  async function onFile(file: File) {
    setParsing(true);
    setFileName(file.name);
    try {
      const parsed = await parseWorkbook(file);
      if (parsed.rows.length === 0) {
        toast.error("Couldn't find any rows in that file.");
        setParsing(false);
        return;
      }
      setSheet(parsed);
      const h = parsed.headers;
      setDateCol(guessColumn(h, ["date", "posted", "value"]) ?? h[0]);
      setDescCol(
        guessColumn(h, ["description", "narration", "details", "particular", "memo", "payee", "remit"]) ?? h[1] ?? h[0]
      );
      const debit = guessColumn(h, ["debit", "withdraw", "paid out", "money out", " dr"]);
      const credit = guessColumn(h, ["credit", "deposit", "paid in", "money in", " cr"]);
      const amount = guessColumn(h, ["amount", "value"]);
      if (debit || credit) {
        setAmountMode("split");
        setDebitCol(debit ?? NONE);
        setCreditCol(credit ?? NONE);
      } else {
        setAmountMode("single");
        setAmountCol(amount ?? h[h.length - 1]);
      }
      const dcol = guessColumn(h, ["date", "posted", "value"]) ?? h[0];
      setDateOrder(detectDateOrder(parsed.rows.map((r) => r[dcol]).slice(0, 30)));
      if (!accountId) setAccountId(selectable[0]?.id ?? "");
    } catch {
      toast.error("Couldn't read that file. Try CSV or XLSX.");
    } finally {
      setParsing(false);
    }
  }

  // Build preview rows from the current mapping.
  const preview = useMemo(() => {
    if (!sheet) return { rows: [] as ImportRow[], invalid: 0 };
    const out: ImportRow[] = [];
    let invalid = 0;
    for (const r of sheet.rows) {
      const iso = parseDate(r[dateCol] ?? "", dateOrder);
      let major: number | null = null;
      if (amountMode === "single") {
        major = parseAmount(r[amountCol] ?? "");
        if (major != null && flipSign) major = -major;
      } else {
        const debit = debitCol !== NONE ? parseAmount(r[debitCol] ?? "") ?? 0 : 0;
        const credit = creditCol !== NONE ? parseAmount(r[creditCol] ?? "") ?? 0 : 0;
        const v = (credit || 0) - Math.abs(debit || 0);
        major = v === 0 && !r[debitCol] && !r[creditCol] ? null : v;
      }
      if (!iso || major == null || major === 0) {
        invalid++;
        continue;
      }
      out.push({
        date: iso,
        description: (r[descCol] ?? "").slice(0, 140),
        amount: toMinorUnits(major, currency),
      });
    }
    return { rows: out, invalid };
  }, [sheet, dateCol, descCol, amountCol, debitCol, creditCol, amountMode, flipSign, dateOrder, currency]);

  async function handleImport() {
    if (!accountId) return toast.error("Choose an account to import into.");
    if (preview.rows.length === 0) return toast.error("Nothing to import — check the column mapping.");
    setImporting(true);
    try {
      const res = await onImport(
        accountId,
        categoryId === NONE ? null : categoryId,
        preview.rows
      );
      toast.success(`Imported ${res.created.length} transaction${res.created.length === 1 ? "" : "s"}`, {
        description: res.skipped ? `${res.skipped} duplicate row(s) skipped.` : undefined,
      });
      resetAll();
      onOpenChange(false);
    } catch {
      toast.error("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  const colOptions = (includeNone: boolean) => (
    <>
      {includeNone && <SelectItem value={NONE}>— None —</SelectItem>}
      {sheet?.headers.map((h) => (
        <SelectItem key={h} value={h}>
          {h}
        </SelectItem>
      ))}
    </>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetAll();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="display text-xl">Import transactions</DialogTitle>
          <DialogDescription>
            Upload a bank statement or spreadsheet (.csv, .xlsx). Nothing leaves
            your browser until you import.
          </DialogDescription>
        </DialogHeader>

        {!sheet ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-14 text-center transition-colors hover:bg-muted/40"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {parsing ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
            </span>
            <div>
              <p className="text-sm font-medium">
                {parsing ? "Reading file…" : "Click to choose a file"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">CSV, XLSX or XLS</p>
            </div>
          </button>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm">
              <FileSpreadsheet className="size-4 text-muted-foreground" />
              <span className="flex-1 truncate">{fileName}</span>
              <span className="text-xs text-muted-foreground">{sheet.rows.length} rows</span>
              <Button variant="ghost" size="sm" onClick={resetAll}>
                Change
              </Button>
            </div>

            {/* Mapping */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Import into account">
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>
                    {selectable.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} · {a.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Default category (optional)">
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Uncategorized</SelectItem>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Date column">
                <Select value={dateCol} onValueChange={setDateCol}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{colOptions(false)}</SelectContent>
                </Select>
              </Field>
              <Field label="Date format">
                <Select value={dateOrder} onValueChange={(v) => setDateOrder(v as "dmy" | "mdy")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dmy">Day / Month / Year</SelectItem>
                    <SelectItem value="mdy">Month / Day / Year</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Description column" className="col-span-2">
                <Select value={descCol} onValueChange={setDescCol}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{colOptions(false)}</SelectContent>
                </Select>
              </Field>
            </div>

            {/* Amount mapping */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
                {([["single", "Single amount column"], ["split", "Separate debit / credit"]] as const).map(
                  ([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAmountMode(v)}
                      className={cn(
                        "rounded-md py-1.5 text-sm font-medium transition-colors",
                        amountMode === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>

              {amountMode === "single" ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Amount column">
                    <Select value={amountCol} onValueChange={setAmountCol}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{colOptions(false)}</SelectContent>
                    </Select>
                  </Field>
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <input
                      type="checkbox"
                      checked={flipSign}
                      onChange={(e) => setFlipSign(e.target.checked)}
                      className="size-4 accent-[var(--primary)]"
                    />
                    Spending shown as positive (flip sign)
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Debit (money out)">
                    <Select value={debitCol} onValueChange={setDebitCol}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{colOptions(true)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Credit (money in)">
                    <Select value={creditCol} onValueChange={setCreditCol}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{colOptions(true)}</SelectContent>
                    </Select>
                  </Field>
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="rounded-xl border border-border/60">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">{preview.rows.length}</span> ready
                  {preview.invalid > 0 && ` · ${preview.invalid} skipped (unparsable)`}
                </span>
                <span>Preview</span>
              </div>
              <ul className="max-h-48 divide-y divide-border/40 overflow-y-auto">
                {preview.rows.slice(0, 12).map((r, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="num w-20 shrink-0 text-xs text-muted-foreground">{r.date}</span>
                    <span className="flex-1 truncate">{r.description || "—"}</span>
                    <span className={cn("num tabular-nums", r.amount < 0 ? "text-foreground" : "text-income")}>
                      {formatMoney(r.amount, { signed: r.amount > 0, currency })}
                    </span>
                  </li>
                ))}
                {preview.rows.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No rows parsed — adjust the column mapping above.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />

        {sheet && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={importing || preview.rows.length === 0}>
              {importing && <Loader2 className="size-4 animate-spin" />}
              Import {preview.rows.length || ""}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
