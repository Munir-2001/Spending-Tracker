"use client";

import { useState } from "react";
import {
  Wallet,
  Plus,
  Folder,
  TriangleAlert,
  RefreshCw,
  PieChart,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile, StatTileSkeleton } from "@/components/ui/stat-tile";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { RowMenu } from "@/components/ui/row-menu";

// ── helpers ─────────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border/60 py-10 first:border-t-0">
      <p className="eyebrow">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
          {description}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Swatch({
  name,
  className,
  fg,
}: {
  name: string;
  className: string;
  /** Optional foreground class to demo text-on-fill contrast. */
  fg?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "flex h-16 items-end rounded-lg border border-border/60 p-2",
          className,
        )}
      >
        {fg && <span className={cn("text-xs font-medium", fg)}>Aa 123</span>}
      </div>
      <p className="text-xs text-muted-foreground">{name}</p>
    </div>
  );
}

const SAMPLE_ROWS = [
  { name: "Whole Foods Market", meta: "Checking · USD · Groceries", amount: "−$84.20", cat: "var(--cat-3)" },
  { name: "Acme Payroll", meta: "Checking · USD · Income", amount: "+$5,200.00", cat: "var(--cat-1)", income: true },
  { name: "Transport for London", meta: "Amex · GBP · Transit", amount: "−£18.40", cat: "var(--cat-8)" },
];

// ── page ─────────────────────────────────────────────────────────────────────

export default function StyleGuidePage() {
  const [seg, setSeg] = useState<"month" | "quarter" | "year">("month");

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 pb-24">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 py-6">
        <div>
          <h1 className="display text-2xl leading-none">Ledger — Style Guide</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Every token and primitive, in every state. Toggle the theme to check
            light/dark parity. See DESIGN.md for the rules.
          </p>
        </div>
        <ModeToggle />
      </header>

      {/* COLOR — SURFACES */}
      <Section title="Surfaces" description="Warm paper canvas. Never pure white or black.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          <Swatch name="background" className="bg-background" fg="text-foreground" />
          <Swatch name="surface" className="bg-surface" fg="text-foreground" />
          <Swatch name="card" className="bg-card" fg="text-card-foreground" />
          <Swatch name="muted" className="bg-muted" fg="text-muted-foreground" />
          <Swatch name="accent" className="bg-accent" fg="text-accent-foreground" />
          <Swatch name="secondary" className="bg-secondary" fg="text-secondary-foreground" />
          <Swatch name="primary" className="bg-primary" fg="text-primary-foreground" />
          <Swatch name="popover" className="bg-popover" fg="text-popover-foreground" />
          <Swatch name="border" className="bg-border" />
        </div>
      </Section>

      {/* COLOR — SEMANTIC */}
      <Section
        title="Semantic / finance"
        description="Color only carries meaning: direction (income/expense), status (warning/destructive)."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Swatch name="income" className="bg-income" fg="text-income-foreground" />
          <Swatch name="expense" className="bg-expense" fg="text-expense-foreground" />
          <Swatch name="warning ★ new" className="bg-warning" fg="text-warning-foreground" />
          <Swatch name="destructive" className="bg-destructive" fg="text-destructive-foreground" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="chip-income rounded-full px-2.5 py-1 text-xs font-medium">Received</span>
          <span className="chip-expense rounded-full px-2.5 py-1 text-xs font-medium">Spent</span>
          <span className="chip-warning rounded-full px-2.5 py-1 text-xs font-medium">Pending review</span>
        </div>
      </Section>

      {/* COLOR — CHART + CATEGORY */}
      <Section
        title="Chart & category palettes"
        description="--chart-1..5 is the emerald→ink chart sequence. --cat-1..10 is category identity (lifted from category-dialog so it adapts to dark)."
      >
        <p className="mb-2 text-xs text-muted-foreground">chart</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Swatch key={n} name={`chart-${n}`} className={`bg-chart-${n}`} />
          ))}
        </div>
        <p className="mb-2 mt-6 text-xs text-muted-foreground">category</p>
        <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <Swatch key={n} name={`cat-${n}`} className={`bg-cat-${n}`} />
          ))}
        </div>
      </Section>

      {/* TYPOGRAPHY */}
      <Section
        title="Typography"
        description="Fraunces (.display) for figures & titles · Hanken (sans) for UI · Geist Mono (.num) for money."
      >
        <div className="space-y-4">
          <p className="display text-5xl leading-none">$1,284,902.50</p>
          <p className="display amount-lg text-4xl leading-none">$48,210.00</p>
          <div className="num text-2xl">$12,480.00</div>
          <p className="text-base">
            The quick brown fox — Hanken Grotesk body copy at base size for labels and descriptions.
          </p>
          <p className="eyebrow">Eyebrow label · replaces text-[10px]/[11px]</p>
          <p className="text-sm text-muted-foreground">muted-foreground at text-sm</p>
        </div>
      </Section>

      {/* PRIMITIVE: StatTile */}
      <Section
        title="StatTile"
        description="The one KPI tile. Tones color the figure; accent is the inverted hero. Last column shows the loading skeleton."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Balance" value="$12,480.00" />
          <StatTile label="Income" value="$5,200.00" tone="income" />
          <StatTile label="Spending" value="$3,914.20" tone="expense" />
          <StatTile label="Near budget" value="92%" tone="warning" />
          <StatTile label="Net worth" value="$48,210.00" accent />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton />
        </div>
      </Section>

      {/* PRIMITIVE: SectionCard + RowMenu */}
      <Section
        title="SectionCard + RowMenu"
        description="Titled card with a header strip and trailing slot. Default, loading, and empty states."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {/* default */}
          <SectionCard
            title="Pakistani Accounts"
            icon={<Folder className="size-4 text-muted-foreground" />}
            trailing={
              <>
                <span className="num text-xs text-muted-foreground">$4,210.00</span>
                <RowMenu onEdit={() => toast("Edit")} onDelete={() => toast("Delete")} />
              </>
            }
            bodyClassName="divide-y divide-border/40"
          >
            {SAMPLE_ROWS.map((r) => (
              <div key={r.name} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="size-8 shrink-0 rounded-lg"
                  style={{ backgroundColor: r.cat }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">{r.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.meta}</p>
                </div>
                <span
                  className={cn(
                    "num text-sm font-semibold",
                    r.income ? "text-income" : "text-foreground",
                  )}
                >
                  {r.amount}
                </span>
                <RowMenu onEdit={() => toast("Edit")} onDelete={() => toast("Delete")} />
              </div>
            ))}
          </SectionCard>

          {/* loading */}
          <SectionCard
            title="Loading"
            icon={<Folder className="size-4 text-muted-foreground" />}
            bodyClassName="divide-y divide-border/40"
          >
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-8 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </SectionCard>
        </div>
      </Section>

      {/* PRIMITIVE: EmptyState */}
      <Section title="EmptyState" description="Page-level (dashed) and in-panel (plain) variants.">
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState
            icon={<Wallet className="size-6" />}
            title="No accounts yet"
            description="Create a group, then add your banks inside it — each in its own currency."
            action={
              <Button className="gap-1.5">
                <Plus className="size-4" />
                Add your first account
              </Button>
            }
          />
          <EmptyState
            variant="plain"
            icon={<PieChart className="size-6" />}
            title="Nothing to chart"
            description="Add a few transactions and your spending breakdown shows up here."
          />
        </div>
      </Section>

      {/* PRIMITIVE: Segmented */}
      <Section title="Segmented" description="Radiogroup semantics; active pill stays raised in dark mode.">
        <Segmented
          ariaLabel="Time range"
          value={seg}
          onChange={setSeg}
          options={[
            { value: "month", label: "Month" },
            { value: "quarter", label: "Quarter" },
            { value: "year", label: "Year" },
          ]}
        />
        <p className="mt-2 text-xs text-muted-foreground">selected: {seg}</p>
      </Section>

      {/* ERROR STATE */}
      <Section
        title="Error state"
        description="Pattern for a failed data view (candidate for a future ErrorState primitive)."
      >
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert className="size-6" />
          </span>
          <div className="max-w-sm">
            <p className="font-medium">Couldn’t load transactions</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Something went wrong reaching your data. This is usually temporary.
            </p>
          </div>
          <Button variant="outline" className="gap-1.5" onClick={() => toast("Retry")}>
            <RefreshCw className="size-4" />
            Try again
          </Button>
        </div>
      </Section>

      {/* BUTTONS + BADGES (reference) */}
      <Section title="Buttons & badges" description="Existing primitives, for reference.">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="ghost">Ghost</Badge>
        </div>
      </Section>
    </div>
  );
}
