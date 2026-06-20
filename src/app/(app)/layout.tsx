import { Search } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { TransactionsProvider } from "@/components/transactions/transactions-provider";
import { NewTransactionButton } from "@/components/transactions/new-transaction-button";
import {
  getCurrentUser,
  getSettings,
  listAccounts,
  listBudgets,
  listCategories,
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
  const [
    initialTransactions,
    initialAccounts,
    initialCategories,
    initialBudgets,
    initialSettings,
    user,
  ] = await Promise.all([
    listTransactions(),
    listAccounts(),
    listCategories(),
    listBudgets(),
    getSettings(),
    getCurrentUser(),
  ]);

  return (
    <SidebarProvider>
      <TransactionsProvider
        initialTransactions={initialTransactions}
        initialAccounts={initialAccounts}
        initialCategories={initialCategories}
        initialBudgets={initialBudgets}
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
    </SidebarProvider>
  );
}
