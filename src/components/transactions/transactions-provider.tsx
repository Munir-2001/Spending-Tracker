"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import type { Account, Asset, Budget, Category, Transaction } from "@/lib/data";
import type {
  NewAccountInput,
  NewAssetInput,
  NewCategoryInput,
  NewTransactionInput,
  RepaymentInput,
  TransferInput,
} from "@/lib/schema";
import { makeFx, type Fx } from "@/lib/currency";
import {
  createAccount,
  createAsset as createAssetAction,
  createCategory as createCategoryAction,
  createTransaction,
  deleteAccount as deleteAccountAction,
  deleteAsset as deleteAssetAction,
  deleteCategory as deleteCategoryAction,
  adjustBalance as adjustBalanceAction,
  deleteTransaction as deleteTransactionAction,
  importTransactions as importTransactionsAction,
  recordRepayment as recordRepaymentAction,
  recordTransfer as recordTransferAction,
  settleReimbursement as settleReimbursementAction,
  setBudget as setBudgetAction,
  updateAccount,
  updateAsset as updateAssetAction,
  updateCategory as updateCategoryAction,
  updateSettings as updateSettingsAction,
  updateTransaction,
  type AppSettings,
  type ImportRow,
} from "@/server/actions";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";
import { TransactionDetailDialog } from "@/components/transactions/transaction-detail-dialog";
import { AddAccountDialog } from "@/components/accounts/add-account-dialog";
import { AdjustBalanceDialog } from "@/components/accounts/adjust-balance-dialog";
import { ImportDialog } from "@/components/transactions/import-dialog";
import { CategoryDialog } from "@/components/categories/category-dialog";
import { AssetDialog } from "@/components/assets/asset-dialog";

export type NewTransaction = NewTransactionInput;
export type NewAccount = NewAccountInput;

type Ctx = {
  // Transactions
  items: Transaction[];
  addTransaction: (input: NewTransaction) => void;
  saveTransaction: (id: string, input: NewTransaction) => void;
  deleteTransaction: (id: string) => void;
  settleReimbursement: (id: string) => void;
  recordRepayment: (input: RepaymentInput) => void;
  recordTransfer: (input: TransferInput) => void;
  /** Reconcile an account to a real balance (target in account's minor units). */
  adjustBalance: (accountId: string, targetMinor: number) => void;
  isAdjustOpen: boolean;
  adjustAccount: Account | null;
  openAdjustBalance: (account: Account) => void;
  setAdjustOpen: (open: boolean) => void;
  isAddOpen: boolean;
  editingTransaction: Transaction | null;
  openAdd: () => void;
  openEditTransaction: (t: Transaction) => void;
  setAddOpen: (open: boolean) => void;

  // Transaction detail view
  isDetailOpen: boolean;
  detailTransaction: Transaction | null;
  openTransactionDetail: (t: Transaction) => void;
  setDetailOpen: (open: boolean) => void;

  // Import
  isImportOpen: boolean;
  openImport: () => void;
  setImportOpen: (open: boolean) => void;
  importTransactions: (
    accountId: string,
    categoryId: string | null,
    rows: ImportRow[]
  ) => Promise<{ created: Transaction[]; skipped: number }>;

  // Budgets
  budgets: Budget[];
  budgetFor: (categoryId: string) => number;
  setBudget: (categoryId: string, amount: number) => void;

  // Accounts
  accounts: Account[];
  addAccount: (input: NewAccount) => void;
  saveAccount: (id: string, input: NewAccount) => void;
  deleteAccount: (id: string) => void;
  isAddAccountOpen: boolean;
  editingAccount: Account | null;
  openAddAccount: () => void;
  openEditAccount: (account: Account) => void;
  setAddAccountOpen: (open: boolean) => void;

  // Categories
  categories: Category[];
  addCategory: (input: NewCategoryInput) => void;
  saveCategory: (id: string, input: NewCategoryInput) => void;
  deleteCategory: (id: string) => void;
  isCategoryOpen: boolean;
  editingCategory: Category | null;
  openAddCategory: () => void;
  openEditCategory: (c: Category) => void;
  setCategoryOpen: (open: boolean) => void;

  // Assets
  assets: Asset[];
  addAsset: (input: NewAssetInput) => void;
  saveAsset: (id: string, input: NewAssetInput) => void;
  deleteAsset: (id: string) => void;
  isAssetOpen: boolean;
  editingAsset: Asset | null;
  openAddAsset: () => void;
  openEditAsset: (a: Asset) => void;
  setAssetOpen: (open: boolean) => void;

  // Lookups
  getAccount: (id: string) => Account | undefined;
  getCategory: (id: string) => Category | undefined;
  /** Balance of a single account in its own currency: opening + its transactions. */
  balanceOf: (accountId: string) => number;

  // Currency settings
  baseCurrency: string;
  fx: Fx;
  rates: Record<string, number>;
  updateSettings: (settings: AppSettings) => void;
};

const AppDataContext = createContext<Ctx | null>(null);

const byDateDesc = (a: Transaction, b: Transaction) =>
  b.date.localeCompare(a.date) || b.id.localeCompare(a.id);

export function TransactionsProvider({
  initialTransactions,
  initialAccounts,
  initialCategories,
  initialBudgets,
  initialAssets,
  initialSettings,
  children,
}: {
  initialTransactions: Transaction[];
  initialAccounts: Account[];
  initialCategories: Category[];
  initialBudgets: Budget[];
  initialAssets: Asset[];
  initialSettings: AppSettings;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<Transaction[]>(() =>
    [...initialTransactions].sort(byDateDesc)
  );
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [budgets, setBudgets] = useState<Budget[]>(initialBudgets);
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [isAssetOpen, setAssetOpenState] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isCategoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [baseCurrency, setBaseCurrency] = useState(initialSettings.baseCurrency);
  const [rates, setRates] = useState(initialSettings.rates);
  const fx = useMemo(() => makeFx(baseCurrency, rates), [baseCurrency, rates]);

  const updateSettings = useCallback((s: AppSettings) => {
    setBaseCurrency(s.baseCurrency);
    setRates(s.rates);
    updateSettingsAction(s).catch(() =>
      toast.error("Couldn't save currency settings.")
    );
  }, []);
  const [isAddOpen, setAddOpenState] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [isDetailOpen, setDetailOpenState] = useState(false);
  const [detailTransaction, setDetailTransaction] =
    useState<Transaction | null>(null);
  const [isImportOpen, setImportOpen] = useState(false);
  const [isAddAccountOpen, setAddAccountOpenState] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const setAddOpen = useCallback((open: boolean) => {
    setAddOpenState(open);
    if (!open) setEditingTransaction(null);
  }, []);

  const addTransaction = useCallback((input: NewTransaction) => {
    createTransaction(input)
      .then((saved) => setItems((prev) => [saved, ...prev].sort(byDateDesc)))
      .catch(() => toast.error("Couldn't save transaction. Please try again."));
  }, []);

  const saveTransaction = useCallback((id: string, input: NewTransaction) => {
    updateTransaction(id, input)
      .then((saved) => {
        if (saved)
          setItems((prev) =>
            prev.map((t) => (t.id === id ? saved : t)).sort(byDateDesc)
          );
      })
      .catch(() => toast.error("Couldn't update transaction. Please try again."));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    deleteTransactionAction(id)
      .then(() => setItems((prev) => prev.filter((t) => t.id !== id)))
      .catch(() => toast.error("Couldn't delete transaction. Please try again."));
  }, []);

  const settleReimbursement = useCallback((id: string) => {
    settleReimbursementAction(id)
      .then(({ updated, inflow }) => {
        setItems((prev) => {
          let next = prev.map((t) => (updated && t.id === id ? updated : t));
          if (inflow) next = [inflow, ...next];
          return next.sort(byDateDesc);
        });
        toast.success("Marked as refunded");
      })
      .catch(() => toast.error("Couldn't record the refund. Please try again."));
  }, []);

  const recordRepayment = useCallback((input: RepaymentInput) => {
    recordRepaymentAction(input)
      .then(({ updated, inflow }) => {
        setItems((prev) => {
          let next = prev.map((t) =>
            updated && t.id === input.claimId ? updated : t
          );
          if (inflow) next = [inflow, ...next];
          return next.sort(byDateDesc);
        });
        toast.success("Repayment recorded", {
          description: "Counted against what you were owed — not as income.",
        });
      })
      .catch(() => toast.error("Couldn't record the repayment. Please try again."));
  }, []);

  const recordTransfer = useCallback((input: TransferInput) => {
    recordTransferAction(input)
      .then(({ source, dest, asset }) => {
        setItems((prev) => {
          const add = [source, ...(dest ? [dest] : [])];
          return [...add, ...prev].sort(byDateDesc);
        });
        if (asset) setAssets((prev) => prev.map((a) => (a.id === asset.id ? asset : a)));
        toast.success("Transfer recorded", {
          description: "Moved between holdings — not counted as spending.",
        });
      })
      .catch(() => toast.error("Couldn't record the transfer. Please try again."));
  }, []);

  const importTransactions = useCallback(
    async (accountId: string, categoryId: string | null, rows: ImportRow[]) => {
      const res = await importTransactionsAction(accountId, categoryId, rows);
      if (res.created.length)
        setItems((prev) => [...res.created, ...prev].sort(byDateDesc));
      return res;
    },
    []
  );

  const setBudget = useCallback((categoryId: string, amount: number) => {
    setBudgetAction(categoryId, amount)
      .then((saved) =>
        setBudgets((prev) => {
          const without = prev.filter((b) => b.categoryId !== categoryId);
          return saved ? [...without, saved] : without;
        })
      )
      .catch(() => toast.error("Couldn't save budget. Please try again."));
  }, []);

  const addAsset = useCallback((input: NewAssetInput) => {
    createAssetAction(input)
      .then((saved) => setAssets((prev) => [...prev, saved]))
      .catch(() => toast.error("Couldn't add asset. Please try again."));
  }, []);

  const saveAsset = useCallback((id: string, input: NewAssetInput) => {
    updateAssetAction(id, input)
      .then((saved) => {
        if (saved) setAssets((prev) => prev.map((a) => (a.id === id ? saved : a)));
      })
      .catch(() => toast.error("Couldn't update asset. Please try again."));
  }, []);

  const deleteAsset = useCallback((id: string) => {
    deleteAssetAction(id)
      .then(() => setAssets((prev) => prev.filter((a) => a.id !== id)))
      .catch(() => toast.error("Couldn't delete asset. Please try again."));
  }, []);

  const setAssetOpen = useCallback((open: boolean) => {
    setAssetOpenState(open);
    if (!open) setEditingAsset(null);
  }, []);

  const addCategory = useCallback((input: NewCategoryInput) => {
    createCategoryAction(input)
      .then((saved) => setCategories((prev) => [...prev, saved]))
      .catch(() => toast.error("Couldn't create category. Please try again."));
  }, []);

  const saveCategory = useCallback((id: string, input: NewCategoryInput) => {
    updateCategoryAction(id, input)
      .then((saved) => {
        if (saved)
          setCategories((prev) => prev.map((c) => (c.id === id ? saved : c)));
      })
      .catch(() => toast.error("Couldn't update category. Please try again."));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    deleteCategoryAction(id)
      .then(() => {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        // Unlink the category locally so views update immediately.
        setItems((prev) =>
          prev.map((t) => ({
            ...t,
            categoryId: t.categoryId === id ? "" : t.categoryId,
            items: t.items?.map((it) =>
              it.categoryId === id ? { ...it, categoryId: "" } : it
            ),
          }))
        );
        setBudgets((prev) => prev.filter((b) => b.categoryId !== id));
      })
      .catch(() => toast.error("Couldn't delete category. Please try again."));
  }, []);

  const addAccount = useCallback((input: NewAccount) => {
    createAccount(input)
      .then((saved) => setAccounts((prev) => [...prev, saved]))
      .catch(() => toast.error("Couldn't create account. Please try again."));
  }, []);

  const saveAccount = useCallback((id: string, input: NewAccount) => {
    updateAccount(id, input)
      .then((saved) => {
        if (saved)
          setAccounts((prev) => prev.map((a) => (a.id === id ? saved : a)));
      })
      .catch(() => toast.error("Couldn't update account. Please try again."));
  }, []);

  const deleteAccount = useCallback((id: string) => {
    deleteAccountAction(id)
      .then(() =>
        setAccounts((prev) =>
          // Drop the account; promote its children to top level.
          prev
            .filter((a) => a.id !== id)
            .map((a) => (a.parentId === id ? { ...a, parentId: null } : a))
        )
      )
      .catch(() => toast.error("Couldn't delete account. Please try again."));
  }, []);

  const setAddAccountOpen = useCallback((open: boolean) => {
    setAddAccountOpenState(open);
    if (!open) setEditingAccount(null);
  }, []);

  const accountsById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const ownBalance = useMemo(() => {
    const curById = new Map(accounts.map((a) => [a.id, a.currency]));
    const map = new Map<string, number>();
    for (const a of accounts) map.set(a.id, a.isGroup ? 0 : a.openingBalance);
    for (const t of items) {
      const accCur = curById.get(t.accountId);
      // Convert the charge into the account's own currency (they may differ).
      const amt = accCur ? fx.convert(t.amount, t.currency, accCur) : t.amount;
      map.set(t.accountId, (map.get(t.accountId) ?? 0) + amt);
    }
    return map;
  }, [accounts, items, fx]);

  const [isAdjustOpen, setAdjustOpenState] = useState(false);
  const [adjustAccount, setAdjustAccount] = useState<Account | null>(null);
  const setAdjustOpen = useCallback((open: boolean) => {
    setAdjustOpenState(open);
    if (!open) setAdjustAccount(null);
  }, []);

  const adjustBalance = useCallback(
    (accountId: string, targetMinor: number) => {
      const current = ownBalance.get(accountId) ?? 0;
      const delta = targetMinor - current;
      if (delta === 0) {
        toast("Balance already matches — no adjustment needed.");
        return;
      }
      adjustBalanceAction(accountId, delta)
        .then((saved) => {
          if (saved) setItems((prev) => [saved, ...prev].sort(byDateDesc));
          toast.success("Balance reconciled");
        })
        .catch(() => toast.error("Couldn't adjust the balance. Please try again."));
    },
    [ownBalance]
  );

  const budgetByCategory = useMemo(
    () => new Map(budgets.map((b) => [b.categoryId, b.amount])),
    [budgets]
  );

  const value = useMemo<Ctx>(
    () => ({
      items,
      addTransaction,
      saveTransaction,
      deleteTransaction,
      settleReimbursement,
      recordRepayment,
      recordTransfer,
      adjustBalance,
      isAdjustOpen,
      adjustAccount,
      openAdjustBalance: (account: Account) => {
        setAdjustAccount(account);
        setAdjustOpenState(true);
      },
      setAdjustOpen,
      isAddOpen,
      editingTransaction,
      openAdd: () => {
        setEditingTransaction(null);
        setAddOpenState(true);
      },
      openEditTransaction: (t: Transaction) => {
        setEditingTransaction(t);
        setAddOpenState(true);
      },
      setAddOpen,
      isDetailOpen,
      detailTransaction,
      openTransactionDetail: (t: Transaction) => {
        setDetailTransaction(t);
        setDetailOpenState(true);
      },
      setDetailOpen: setDetailOpenState,
      isImportOpen,
      openImport: () => setImportOpen(true),
      setImportOpen,
      importTransactions,
      budgets,
      budgetFor: (id) => budgetByCategory.get(id) ?? 0,
      setBudget,
      accounts,
      addAccount,
      saveAccount,
      deleteAccount,
      isAddAccountOpen,
      editingAccount,
      openAddAccount: () => {
        setEditingAccount(null);
        setAddAccountOpenState(true);
      },
      openEditAccount: (account: Account) => {
        setEditingAccount(account);
        setAddAccountOpenState(true);
      },
      setAddAccountOpen,
      categories,
      addCategory,
      saveCategory,
      deleteCategory,
      isCategoryOpen,
      editingCategory,
      openAddCategory: () => {
        setEditingCategory(null);
        setCategoryOpen(true);
      },
      openEditCategory: (c: Category) => {
        setEditingCategory(c);
        setCategoryOpen(true);
      },
      setCategoryOpen: (open: boolean) => {
        setCategoryOpen(open);
        if (!open) setEditingCategory(null);
      },
      assets,
      addAsset,
      saveAsset,
      deleteAsset,
      isAssetOpen,
      editingAsset,
      openAddAsset: () => {
        setEditingAsset(null);
        setAssetOpenState(true);
      },
      openEditAsset: (a: Asset) => {
        setEditingAsset(a);
        setAssetOpenState(true);
      },
      setAssetOpen,
      getAccount: (id) => accountsById.get(id),
      getCategory: (id) => categoriesById.get(id),
      balanceOf: (id) => ownBalance.get(id) ?? 0,
      baseCurrency,
      fx,
      rates,
      updateSettings,
    }),
    [
      items,
      addTransaction,
      saveTransaction,
      deleteTransaction,
      settleReimbursement,
      recordRepayment,
      recordTransfer,
      adjustBalance,
      isAdjustOpen,
      adjustAccount,
      setAdjustOpen,
      isAddOpen,
      editingTransaction,
      setAddOpen,
      isDetailOpen,
      detailTransaction,
      isImportOpen,
      importTransactions,
      budgets,
      budgetByCategory,
      setBudget,
      accounts,
      addAccount,
      saveAccount,
      deleteAccount,
      isAddAccountOpen,
      editingAccount,
      setAddAccountOpen,
      categories,
      addCategory,
      saveCategory,
      deleteCategory,
      isCategoryOpen,
      editingCategory,
      assets,
      addAsset,
      saveAsset,
      deleteAsset,
      isAssetOpen,
      editingAsset,
      setAssetOpen,
      accountsById,
      categoriesById,
      ownBalance,
      baseCurrency,
      fx,
      rates,
      updateSettings,
    ]
  );

  return (
    <AppDataContext.Provider value={value}>
      {children}
      <AddTransactionDialog
        open={isAddOpen}
        onOpenChange={setAddOpen}
        onSubmit={addTransaction}
        onSave={saveTransaction}
        onDelete={deleteTransaction}
        onRepayment={recordRepayment}
        onTransfer={recordTransfer}
        openClaims={items.filter((t) => t.reimbursement && !t.reimbursement.settled)}
        editing={editingTransaction}
        accounts={accounts}
        assets={assets}
        categories={categories}
        fx={fx}
        onAddAccount={() => {
          setAddOpen(false);
          setAddAccountOpen(true);
        }}
        onAddAsset={() => {
          // Open the asset dialog on top — keep the transfer form open so the
          // new asset can be picked as the destination once created.
          setEditingAsset(null);
          setAssetOpenState(true);
        }}
      />
      <TransactionDetailDialog
        open={isDetailOpen}
        onOpenChange={setDetailOpenState}
        transaction={detailTransaction}
      />
      <AddAccountDialog
        open={isAddAccountOpen}
        onOpenChange={setAddAccountOpen}
        onCreate={addAccount}
        onSave={saveAccount}
        onDelete={deleteAccount}
        editing={editingAccount}
        accounts={accounts}
      />
      <ImportDialog
        open={isImportOpen}
        onOpenChange={setImportOpen}
        onImport={importTransactions}
        accounts={accounts}
        categories={categories}
      />
      <CategoryDialog
        open={isCategoryOpen}
        onOpenChange={(o) => {
          setCategoryOpen(o);
          if (!o) setEditingCategory(null);
        }}
        onCreate={addCategory}
        onSave={saveCategory}
        onDelete={deleteCategory}
        editing={editingCategory}
      />
      <AssetDialog
        open={isAssetOpen}
        onOpenChange={setAssetOpen}
        onCreate={addAsset}
        onSave={saveAsset}
        onDelete={deleteAsset}
        editing={editingAsset}
      />
      <AdjustBalanceDialog
        open={isAdjustOpen}
        onOpenChange={setAdjustOpen}
        account={adjustAccount}
      />
    </AppDataContext.Provider>
  );
}

export function useAppData(): Ctx {
  const ctx = useContext(AppDataContext);
  if (!ctx)
    throw new Error("useAppData must be used within TransactionsProvider");
  return ctx;
}

/** Back-compat alias — same context, used by transaction-centric components. */
export const useTransactions = useAppData;
