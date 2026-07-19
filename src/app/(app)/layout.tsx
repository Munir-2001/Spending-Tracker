import type { Metadata } from "next";
import { Search } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { DataLoadError } from "@/components/data-load-error";
import { ModeToggle } from "@/components/mode-toggle";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { TransactionsProvider } from "@/components/transactions/transactions-provider";
import { NewTransactionButton } from "@/components/transactions/new-transaction-button";
import { RouteProgress } from "@/components/ui/route-progress";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import {
  getCurrentUser,
  getSettings,
  listAccounts,
  listAssets,
  listAllLots,
  listBudgets,
  listCategories,
  listGoals,
  listRecurring,
  listTransactions,
} from "@/server/actions";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

// The app is private + auth-gated — keep every page out of search indexes.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resilient load: a transient backend error shouldn't 500 the whole app.
  // Fall back to empty data so the shell still renders; the user can retry.
  let initialTransactions: Awaited<ReturnType<typeof listTransactions>> = [];
  let initialAccounts: Awaited<ReturnType<typeof listAccounts>> = [];
  let initialCategories: Awaited<ReturnType<typeof listCategories>> = [];
  let initialBudgets: Awaited<ReturnType<typeof listBudgets>> = [];
  let initialAssets: Awaited<ReturnType<typeof listAssets>> = [];
  let initialLots: Awaited<ReturnType<typeof listAllLots>> = [];
  let initialGoals: Awaited<ReturnType<typeof listGoals>> = [];
  let initialRecurring: Awaited<ReturnType<typeof listRecurring>> = [];
  let initialSettings: Awaited<ReturnType<typeof getSettings>> = {
    baseCurrency: "USD",
    rates: {},
  };
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  let loadFailed = false;

  try {
    [
      initialTransactions,
      initialAccounts,
      initialCategories,
      initialBudgets,
      initialAssets,
      initialLots,
      initialGoals,
      initialRecurring,
      initialSettings,
      user,
    ] = await Promise.all([
      listTransactions(),
      listAccounts(),
      listCategories(),
      listBudgets(),
      listAssets(),
      listAllLots(),
      listGoals(),
      listRecurring(),
      getSettings(),
      getCurrentUser(),
    ]);
  } catch (err) {
    // Re-throw Next's control-flow signals (dynamic-rendering bailout, redirect,
    // notFound) — they carry a `digest` and swallowing them breaks rendering.
    if (err && typeof err === "object" && "digest" in err) throw err;
    // A genuine data-load failure: don't fall through with empty data (that
    // would render an error as an empty account). Log it and show a distinct,
    // retryable error state instead.
    console.error("[AppLayout] failed to load initial data:", err);
    loadFailed = true;
  }

  if (loadFailed) return <DataLoadError />;

  return (
    <SidebarProvider>
      <RouteProgress />
      <ConfirmProvider>
      <TransactionsProvider
        initialTransactions={initialTransactions}
        initialAccounts={initialAccounts}
        initialCategories={initialCategories}
        initialBudgets={initialBudgets}
        initialAssets={initialAssets}
        initialLots={initialLots}
        initialGoals={initialGoals}
        initialRecurring={initialRecurring}
        initialSettings={initialSettings}
      >
        <AppSidebar user={user} />
        <SidebarInset className="bg-background">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md md:px-6">
          <SidebarTrigger className="-ml-1 text-muted-foreground" />
          <div className="hidden items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-1.5 text-sm text-muted-foreground sm:flex">
            <Search className="size-4" />
            <span className="pr-8">Search transactions…</span>
            <kbd className="rounded border border-border/70 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <PrivacyToggle />
            <ModeToggle />
            <NewTransactionButton />
          </div>
        </header>
        <main className="flex-1">{children}</main>
        </SidebarInset>
      </TransactionsProvider>
      </ConfirmProvider>
    </SidebarProvider>
  );
}
