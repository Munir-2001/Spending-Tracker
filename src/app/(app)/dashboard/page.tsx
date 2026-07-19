import Link from "next/link";
import { ArrowUpRight, Download, Sparkles } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import { NetWorthChart } from "@/components/dashboard/networth-chart";
import { NetWorthBreakdown } from "@/components/dashboard/networth-breakdown";
import { SpendingCategories } from "@/components/dashboard/spending-categories";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { AccountsOverview } from "@/components/dashboard/accounts-overview";
import { UpcomingBills } from "@/components/dashboard/upcoming-bills";
import { getCurrentUser } from "@/server/actions";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const firstName = user?.name?.split(" ")[0] || "there";
  const monthName = new Date().toLocaleString("en-US", { month: "long" });

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
      {/* Page header */}
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {greeting()}, {firstName}
            </p>
            <h1 className="display mt-1.5 text-3xl tracking-tight md:text-4xl">
              {monthName} overview
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

      {/* Money Wrapped teaser */}
      <Reveal delay={0.12}>
        <Link
          href="/wrapped"
          className="group relative mt-5 flex items-center gap-4 overflow-hidden rounded-2xl px-5 py-4 text-[#171207] shadow-sm transition-transform hover:-translate-y-0.5"
          style={{ background: "linear-gradient(110deg, #E9B44C 0%, #E4603E 100%)" }}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#171207] text-[#F6F1E7]">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="display text-lg leading-tight">
              Your {monthName}, wrapped
            </p>
            <p className="truncate text-sm text-[#171207]/70">
              Your month in money — the habits, the splurges, the wins.
            </p>
          </div>
          <ArrowUpRight className="size-5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
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

          <Reveal delay={0.19}>
            <Panel
              title="What it's made of"
              description="Every account & asset in your net worth"
            >
              <NetWorthBreakdown />
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
          <Reveal delay={0.28}>
            <Panel title="Upcoming bills" description="Due in the next 14 days">
              <UpcomingBills />
            </Panel>
          </Reveal>

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
