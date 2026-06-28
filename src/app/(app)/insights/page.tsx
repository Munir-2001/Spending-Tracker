"use client";

import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { PieChart as PieIcon, BarChart3, Check } from "lucide-react";

import { Reveal } from "@/components/reveal";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/components/transactions/transactions-provider";
import { categoryLinesOf } from "@/lib/compute";
import { formatMoney, formatCompact, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type Period = "month" | "quarter" | "year" | "all";
type ChartType = "pie" | "bar";
type Sort = "high" | "low" | "name";
type GroupBy = "parent" | "sub";
type Row = { id: string; label: string; tint: string; amount: number };

const PERIODS: { value: Period; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

export default function InsightsPage() {
  const { items, categories, baseCurrency, fx } = useAppData();
  const [period, setPeriod] = useState<Period>("month");
  const [chart, setChart] = useState<ChartType>("pie");
  const [sort, setSort] = useState<Sort>("high");
  const [groupBy, setGroupBy] = useState<GroupBy>("parent");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const now = useMemo(() => new Date(), []);
  const inPeriod = useMemo(() => {
    return (iso: string) => {
      const d = new Date(iso);
      if (period === "all") return true;
      if (d.getFullYear() !== now.getFullYear()) return false;
      if (period === "year") return true;
      if (period === "quarter")
        return Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3);
      return d.getMonth() === now.getMonth();
    };
  }, [period, now]);

  // Spend by actual category (leaf) + rolled-up to parent, both unsorted.
  const { parentRows, leafRows, income } = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const leaf = new Map<string, number>();
    let income = 0;
    for (const t of items) {
      if (!inPeriod(t.date) || t.isReimbursement || t.isTransfer) continue;
      if (t.amount > 0) income += fx.toBase(t.amount, t.currency);
      const split = Boolean(t.items?.length);
      for (const line of categoryLinesOf(t)) {
        const amt =
          t.reimbursement && !split ? line.amount + t.reimbursement.amount : line.amount;
        if (amt >= 0) continue;
        leaf.set(
          line.categoryId,
          (leaf.get(line.categoryId) ?? 0) + Math.abs(fx.toBase(amt, t.currency))
        );
      }
    }

    const leafRows: Row[] = [];
    const rootAmount = new Map<string, number>();
    for (const [id, amount] of leaf) {
      if (amount <= 0) continue;
      const c = byId.get(id);
      const parent = c?.parentId ? byId.get(c.parentId) : undefined;
      leafRows.push({
        id,
        label: parent ? `${parent.label} › ${c?.label}` : c?.label ?? "Uncategorized",
        tint: c?.tint ?? "var(--muted-foreground)",
        amount,
      });
      const rootId = c?.parentId ?? id;
      rootAmount.set(rootId, (rootAmount.get(rootId) ?? 0) + amount);
    }
    const parentRows: Row[] = [...rootAmount.entries()].map(([id, amount]) => {
      const c = byId.get(id);
      return {
        id,
        label: c?.label ?? "Uncategorized",
        tint: c?.tint ?? "var(--muted-foreground)",
        amount,
      };
    });
    return { parentRows, leafRows, income };
  }, [items, categories, inPeriod, fx]);

  const sortFn = (a: Row, b: Row) =>
    sort === "name"
      ? a.label.localeCompare(b.label)
      : sort === "low"
        ? a.amount - b.amount
        : b.amount - a.amount;

  const rows = useMemo(
    () => [...(groupBy === "sub" ? leafRows : parentRows)].sort(sortFn),
    [groupBy, leafRows, parentRows, sort]
  );
  const visible = rows.filter((r) => !hidden.has(r.id));
  const shownSpent = visible.reduce((s, r) => s + r.amount, 0);
  const totalSpent = rows.reduce((s, r) => s + r.amount, 0);
  const saved = income - totalSpent;
  const savingsRate = income > 0 ? saved / income : 0;
  const fmt = (n: number) =>
    formatMoney(n, { currency: baseCurrency, trimZeroCents: true });

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-col gap-1.5">
          <h1 className="display text-3xl tracking-tight md:text-4xl">Insights</h1>
          <p className="text-sm text-muted-foreground">
            Where your money goes — all figures rolled up to {baseCurrency}.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Income" value={fmt(income)} tone="income" />
          <Stat label="Spent" value={fmt(totalSpent)} tone="expense" />
          <Stat label="Saved" value={fmt(saved)} tone={saved >= 0 ? "income" : "expense"} />
          <Stat label="Savings rate" value={formatPercent(savingsRate)} />
        </div>
      </Reveal>

      {/* Controls */}
      <Reveal delay={0.1}>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Segmented value={period} onChange={(v) => setPeriod(v as Period)} options={PERIODS} />
          <Segmented
            value={groupBy}
            onChange={(v) => setGroupBy(v as GroupBy)}
            options={[
              { value: "parent", label: "By category" },
              { value: "sub", label: "By sub-category" },
            ]}
          />
          <div className="ml-auto flex items-center gap-2">
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">Highest first</SelectItem>
                <SelectItem value="low">Lowest first</SelectItem>
                <SelectItem value="name">Name (A–Z)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex rounded-lg border border-border/60 bg-muted/40 p-1">
              <ChartToggle active={chart === "pie"} onClick={() => setChart("pie")} label="Pie">
                <PieIcon className="size-4" />
              </ChartToggle>
              <ChartToggle active={chart === "bar"} onClick={() => setChart("bar")} label="Bar">
                <BarChart3 className="size-4" />
              </ChartToggle>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Chart + filterable legend */}
      <Reveal delay={0.15}>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-border/60 bg-card p-6 lg:col-span-3">
            {visible.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-center text-sm text-muted-foreground">
                {rows.length === 0
                  ? "No spending recorded for this period."
                  : "All categories are filtered out — re-select some on the right."}
              </div>
            ) : chart === "pie" ? (
              <ChartContainer config={{}} className="mx-auto aspect-square max-h-[300px]">
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="text-muted-foreground">{name}</span>
                            <span className="num font-medium">{fmt(value as number)}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Pie data={visible} dataKey="amount" nameKey="label" innerRadius={70} strokeWidth={2} stroke="var(--card)">
                    {visible.map((d) => (
                      <Cell key={d.id} fill={d.tint} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <ChartContainer config={{}} className="h-[300px] w-full">
                <BarChart data={visible} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatCompact(v as number, baseCurrency)}
                    tickLine={false}
                    axisLine={false}
                    className="text-xs"
                  />
                  <YAxis type="category" dataKey="label" width={110} tickLine={false} axisLine={false} className="text-xs" />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)" }}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="text-muted-foreground">{name}</span>
                            <span className="num font-medium">{fmt(value as number)}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="amount" radius={5}>
                    {visible.map((d) => (
                      <Cell key={d.id} fill={d.tint} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </div>

          {/* Filterable legend */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Filter
              </p>
              {hidden.size > 0 && (
                <button
                  onClick={() => setHidden(new Set())}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset
                </button>
              )}
            </div>
            <ul className="space-y-2.5">
              {rows.map((d) => {
                const off = hidden.has(d.id);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => toggle(d.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-1 py-1 text-left transition-opacity hover:bg-muted/40",
                        off && "opacity-40"
                      )}
                    >
                      <span
                        className="flex size-4 shrink-0 items-center justify-center rounded-[5px] border"
                        style={{
                          backgroundColor: off ? "transparent" : d.tint,
                          borderColor: d.tint,
                        }}
                      >
                        {!off && <Check className="size-3 text-white" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {d.label}
                      </span>
                      <span className="num shrink-0 text-sm tabular-nums">{fmt(d.amount)}</span>
                      <span className="num w-10 shrink-0 text-right text-xs text-muted-foreground">
                        {shownSpent > 0 && !off ? formatPercent(d.amount / shownSpent) : "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
              {rows.length === 0 && (
                <li className="py-4 text-center text-sm text-muted-foreground">
                  Nothing to show yet.
                </li>
              )}
            </ul>
            {hidden.size > 0 && (
              <p className="mt-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                Showing {visible.length} of {rows.length} ·{" "}
                <span className="num font-medium text-foreground">{fmt(shownSpent)}</span>
              </p>
            )}
          </div>
        </div>
      </Reveal>
    </div>
  );
}

function Stat({
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

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap rounded-lg border border-border/60 bg-muted/40 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ChartToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
