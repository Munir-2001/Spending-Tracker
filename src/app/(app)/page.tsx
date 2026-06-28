import { ArrowUpRight, Download } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import { NetWorthChart } from "@/components/dashboard/networth-chart";
import { SpendingCategories } from "@/components/dashboard/spending-categories";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { AccountsOverview } from "@/components/dashboard/accounts-overview";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
      {/* Page header */}
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{greeting()}, Munir</p>
            <h1 className="display mt-1.5 text-3xl tracking-tight md:text-4xl">
              June overview
            </h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
          >
            <Download className="size-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </Reveal>

      {/* Stat cards */}
      <SummaryCards />

      {/* Main grid */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left column */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Reveal delay={0.18}>
            <Panel
              title="Net worth"
              description="Trend over the last 6 months"
            >
              <NetWorthChart />
            </Panel>
          </Reveal>

          <Reveal delay={0.2}>
            <Panel
              title="Cash flow"
              description="Income vs. spending, last 6 months"
              action={<Legend />}
            >
              <CashflowChart />
            </Panel>
          </Reveal>

          <Reveal delay={0.25}>
            <Panel
              title="Recent activity"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-muted-foreground"
                >
                  View all
                  <ArrowUpRight className="size-3.5" />
                </Button>
              }
            >
              <RecentTransactions />
            </Panel>
          </Reveal>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          <Reveal delay={0.3}>
            <Panel title="Accounts" description="Balances across institutions">
              <AccountsOverview />
            </Panel>
          </Reveal>

          <Reveal delay={0.35}>
            <Panel title="Top spending" description="This month, by category">
              <SpendingCategories />
            </Panel>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-income" />
        Income
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: "var(--chart-4)" }}
        />
        Spending
      </span>
    </div>
  );
}
