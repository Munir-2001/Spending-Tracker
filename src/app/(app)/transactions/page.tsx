"use client";

import { Fragment, useMemo, useState } from "react";
import { Search, MoreHorizontal, Pencil, Trash2, Upload, Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Reveal } from "@/components/reveal";
import { useAppData } from "@/components/transactions/transactions-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { formatFullDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const PERIODS: { value: string; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "last-30", label: "Last 30 days" },
  { value: "this-year", label: "This year" },
];

/**
 * Inclusive-start / exclusive-end date bounds (yyyy-mm-dd strings) for a period.
 * Built from local date parts so there's no timezone drift, and since dates are
 * zero-padded ISO, plain string comparison orders them correctly.
 */
function periodBounds(period: string): [string | null, string | null] {
  const ymd = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case "this-month":
      return [ymd(y, m, 1), ymd(y, m + 1, 1)];
    case "last-month":
      return [ymd(y, m - 1, 1), ymd(y, m, 1)];
    case "last-30": {
      const s = new Date(now);
      s.setDate(s.getDate() - 30);
      return [ymd(s.getFullYear(), s.getMonth(), s.getDate()), null];
    }
    case "this-year":
      return [ymd(y, 0, 1), ymd(y + 1, 0, 1)];
    default:
      return [null, null];
  }
}

export default function TransactionsPage() {
  const {
    items,
    accounts,
    categories,
    getAccount,
    getCategory,
    openEditTransaction,
    deleteTransaction,
    openImport,
    openTransactionDetail,
    baseCurrency,
    fx,
  } = useAppData();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [includeSubs, setIncludeSubs] = useState(true);
  const [account, setAccount] = useState("all");
  const [period, setPeriod] = useState("all");

  // Category tree: top-level parents, and each parent's children.
  const parents = useMemo(
    () => categories.filter((c) => !c.parentId),
    [categories]
  );
  const childrenByParent = useMemo(() => {
    const m = new Map<string, typeof categories>();
    for (const c of categories) {
      if (!c.parentId) continue;
      const arr = m.get(c.parentId) ?? [];
      arr.push(c);
      m.set(c.parentId, arr);
    }
    return m;
  }, [categories]);
  const selectedHasChildren =
    category !== "all" && (childrenByParent.get(category)?.length ?? 0) > 0;

  // The set of category ids a transaction may match. null = no category filter.
  const acceptedCats = useMemo(() => {
    if (category === "all") return null;
    const set = new Set<string>([category]);
    if (includeSubs)
      for (const ch of childrenByParent.get(category) ?? []) set.add(ch.id);
    return set;
  }, [category, includeSubs, childrenByParent]);

  async function confirmDelete(id: string, merchant: string) {
    const ok = await confirm({
      title: "Delete transaction?",
      description: `“${merchant}” will be permanently removed. This can’t be undone.`,
      confirmText: "Delete",
      tone: "danger",
    });
    if (ok) deleteTransaction(id);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const [start, end] = periodBounds(period);
    return items.filter((t) => {
      // Time period (string compare on yyyy-mm-dd).
      if (start && t.date < start) return false;
      if (end && t.date >= end) return false;
      // Category — for a split, match if ANY line falls in the accepted set,
      // so e.g. a grocery split still shows under "Groceries".
      if (acceptedCats) {
        const inCat = t.items?.length
          ? t.items.some((i) => acceptedCats.has(i.categoryId))
          : acceptedCats.has(t.categoryId);
        if (!inCat) return false;
      }
      if (account !== "all" && t.accountId !== account) return false;
      if (q && !t.merchant.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, acceptedCats, account, period]);

  // Mixed currencies → roll the summary up to the base currency.
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      const base = fx.toBase(t.amount, t.currency);
      if (base > 0) income += base;
      else expense += base;
    }
    return { income, expense, net: income + expense, count: filtered.length };
  }, [filtered, fx]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <h1 className="display text-3xl tracking-tight md:text-4xl">
              Transactions
            </h1>
            <p className="text-sm text-muted-foreground">
              Every entry, searchable and reconciled against your accounts.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openImport}>
            <Upload className="size-4" />
            Import
          </Button>
        </div>
      </Reveal>

      {/* Summary strip */}
      <Reveal delay={0.05}>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryStat label="Transactions" value={String(totals.count)} />
          <SummaryStat
            label="Money in"
            value={formatMoney(totals.income, { trimZeroCents: true, currency: baseCurrency })}
            tone="income"
          />
          <SummaryStat
            label="Money out"
            value={formatMoney(totals.expense, { trimZeroCents: true, currency: baseCurrency })}
            tone="expense"
          />
          <SummaryStat
            label="Net"
            value={formatMoney(totals.net, { signed: true, trimZeroCents: true, currency: baseCurrency })}
          />
        </div>
      </Reveal>

      {/* Filters */}
      <Reveal delay={0.1}>
        <div className="mt-5 flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search merchant…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {parents.map((p) => (
                  <Fragment key={p.id}>
                    <SelectItem value={p.id}>{p.label}</SelectItem>
                    {(childrenByParent.get(p.id) ?? []).map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        <span className="text-muted-foreground">↳</span> {ch.label}
                      </SelectItem>
                    ))}
                  </Fragment>
                ))}
              </SelectContent>
            </Select>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedHasChildren && (
              <button
                type="button"
                onClick={() => setIncludeSubs((v) => !v)}
                aria-pressed={includeSubs}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  includeSubs
                    ? "border-primary/40 bg-primary/5 text-foreground"
                    : "border-input text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded border transition-colors",
                    includeSubs
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input"
                  )}
                >
                  {includeSubs && <Check className="size-3" strokeWidth={3} />}
                </span>
                Include subcategories
              </button>
            )}
          </div>
        </div>
      </Reveal>

      {/* Table */}
      <Reveal delay={0.15}>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Date</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="hidden sm:table-cell">Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10 pr-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const cat = getCategory(t.categoryId);
                const acc = getAccount(t.accountId);
                const isIncome = t.amount > 0;
                return (
                  <TableRow
                    key={t.id}
                    className="group cursor-pointer"
                    onClick={() => openTransactionDetail(t)}
                  >
                    <TableCell className="num whitespace-nowrap pl-5 text-xs text-muted-foreground">
                      {formatFullDate(t.date)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {t.merchant}
                      {t.pending && (
                        <span className="ml-2 rounded bg-amber-500/12 px-1.5 py-px text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          Pending
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.isTransfer ? (
                        <span className="inline-flex items-center gap-1.5 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Transfer
                        </span>
                      ) : t.items?.length ? (
                        <span className="inline-flex items-center gap-1.5 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Split · {t.items.length}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: cat?.tint }}
                          />
                          {cat?.label}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {acc?.name}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "num text-right font-medium tabular-nums",
                        isIncome ? "text-income" : "text-foreground"
                      )}
                    >
                      {formatMoney(t.amount, { signed: isIncome, currency: t.currency })}
                    </TableCell>
                    <TableCell
                      className="pr-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground"
                            aria-label="Transaction actions"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditTransaction(t)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => confirmDelete(t.id, t.merchant)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No transactions match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Reveal>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "income" | "expense";
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "num mt-1.5 text-lg font-medium tabular-nums",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense"
        )}
      >
        {value}
      </p>
    </div>
  );
}
