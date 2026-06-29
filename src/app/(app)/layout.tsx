import { Search } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
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
  let initialGoals: Awaited<ReturnType<typeof listGoals>> = [];
  let initialRecurring: Awaited<ReturnType<typeof listRecurring>> = [];
  let initialSettings: Awaited<ReturnType<typeof getSettings>> = {
    baseCurrency: "USD",
    rates: {},
  };
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;

  try {
    [
      initialTransactions,
      initialAccounts,
      initialCategories,
      initialBudgets,
      initialAssets,
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
      listGoals(),
      listRecurring(),
      getSettings(),
      getCurrentUser(),
    ]);
  } catch (err) {
    console.error("[AppLayout] failed to load initial data:", err);
  }

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
