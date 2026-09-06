"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import {
  addClient as addClientAction,
  updateClient as updateClientAction,
  deleteClient as deleteClientAction,
  createInvoice as createInvoiceAction,
  updateInvoice as updateInvoiceAction,
  deleteInvoice as deleteInvoiceAction,
  sendInvoice as sendInvoiceAction,
  unsendInvoice as unsendInvoiceAction,
  voidInvoice as voidInvoiceAction,
  markInvoicePaid as markInvoicePaidAction,
  addPaymentAccount as addPaymentAccountAction,
  updatePaymentAccount as updatePaymentAccountAction,
  deletePaymentAccount as deletePaymentAccountAction,
} from "@/server/actions";
import type { Client, Invoice, PaymentAccount } from "@/lib/data";
import type {
  NewClientInput,
  NewInvoiceInput,
  NewPaymentAccountInput,
  InvoicePaymentInput,
} from "@/lib/schema";
import { ClientDialog } from "@/components/invoices/client-dialog";
import { PaymentDialog } from "@/components/invoices/payment-dialog";
import { PaymentAccountDialog } from "@/components/invoices/payment-account-dialog";

/**
 * Owns all invoicing client state + dialogs — a sibling to TransactionsProvider
 * (mounted inside it, so its dialogs can still read accounts/base currency via
 * useAppData). Mutations are optimistic: call the server action, then reconcile
 * local state in `.then`, `toast.error` in `.catch`. Mirrors the app's existing
 * provider idiom.
 */

type InvoicesContext = {
  clients: Client[];
  invoices: Invoice[];
  paymentAccounts: PaymentAccount[];
  getClient: (id: string | null) => Client | undefined;

  // Client mutations
  createClient: (input: NewClientInput) => void;
  editClient: (id: string, input: NewClientInput) => void;
  removeClient: (id: string) => void;

  // Invoice mutations
  createInvoice: (input: NewInvoiceInput) => void;
  editInvoice: (id: string, input: NewInvoiceInput) => void;
  removeInvoice: (id: string) => void;
  send: (id: string) => void;
  unsend: (id: string) => void;
  voidOne: (id: string) => void;
  pay: (input: InvoicePaymentInput) => Promise<void>;

  // Payment-account mutations
  createPaymentAccount: (input: NewPaymentAccountInput) => void;
  editPaymentAccount: (id: string, input: NewPaymentAccountInput) => void;
  removePaymentAccount: (id: string) => void;

  // Dialog controls
  openAddClient: () => void;
  openEditClient: (c: Client) => void;
  openPayment: (i: Invoice) => void;
  openAddPaymentAccount: () => void;
  openEditPaymentAccount: (p: PaymentAccount) => void;
};

const Ctx = createContext<InvoicesContext | null>(null);

export function useInvoices(): InvoicesContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useInvoices must be used within InvoicesProvider");
  return ctx;
}

export function InvoicesProvider({
  initialClients,
  initialInvoices,
  initialPaymentAccounts,
  children,
}: {
  initialClients: Client[];
  initialInvoices: Invoice[];
  initialPaymentAccounts: PaymentAccount[];
  children: React.ReactNode;
}) {
  const [clients, setClients] = useState(initialClients);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [paymentAccounts, setPaymentAccounts] = useState(
    initialPaymentAccounts
  );

  const [clientOpen, setClientOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paOpen, setPaOpen] = useState(false);
  const [editingPa, setEditingPa] = useState<PaymentAccount | null>(null);

  const clientsById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients]
  );

  // ── Client mutations ───────────────────────────────────────────────────────
  const createClient = useCallback((input: NewClientInput) => {
    addClientAction(input)
      .then((c) => setClients((prev) => [...prev, c]))
      .catch(() => toast.error("Couldn't create the client. Please try again."));
  }, []);

  const editClient = useCallback((id: string, input: NewClientInput) => {
    updateClientAction(id, input)
      .then((c) => {
        if (c) setClients((prev) => prev.map((x) => (x.id === id ? c : x)));
      })
      .catch(() => toast.error("Couldn't update the client. Please try again."));
  }, []);

  const removeClient = useCallback((id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    deleteClientAction(id).catch(() =>
      toast.error("Couldn't delete the client. It may have invoices.")
    );
  }, []);

  // ── Invoice mutations ──────────────────────────────────────────────────────
  const createInvoice = useCallback((input: NewInvoiceInput) => {
    createInvoiceAction(input)
      .then((i) => setInvoices((prev) => [i, ...prev]))
      .catch(() => toast.error("Couldn't create the invoice. Please try again."));
  }, []);

  const editInvoice = useCallback((id: string, input: NewInvoiceInput) => {
    updateInvoiceAction(id, input)
      .then((i) => {
        if (i) setInvoices((prev) => prev.map((x) => (x.id === id ? i : x)));
      })
      .catch(() => toast.error("Couldn't update the invoice. Please try again."));
  }, []);

  const removeInvoice = useCallback((id: string) => {
    setInvoices((prev) => prev.filter((i) => i.id !== id));
    deleteInvoiceAction(id).catch(() =>
      toast.error("Only draft invoices can be deleted.")
    );
  }, []);

  const send = useCallback((id: string) => {
    sendInvoiceAction(id)
      .then((i) => {
        if (i) setInvoices((prev) => prev.map((x) => (x.id === id ? i : x)));
        toast.success("Invoice sent");
      })
      .catch(() => toast.error("Couldn't send the invoice. Please try again."));
  }, []);

  const unsend = useCallback((id: string) => {
    unsendInvoiceAction(id)
      .then((i) => {
        if (i) setInvoices((prev) => prev.map((x) => (x.id === id ? i : x)));
        toast.success("Moved back to draft");
      })
      .catch(() => toast.error("Couldn't unsend — it may already have payments."));
  }, []);

  const voidOne = useCallback((id: string) => {
    voidInvoiceAction(id)
      .then((i) => {
        if (i) setInvoices((prev) => prev.map((x) => (x.id === id ? i : x)));
        toast.success("Invoice voided");
      })
      .catch(() =>
        toast.error("Couldn't void — an invoice with payments can't be voided.")
      );
  }, []);

  const pay = useCallback(async (input: InvoicePaymentInput) => {
    try {
      const { invoice } = await markInvoicePaidAction(input);
      if (invoice)
        setInvoices((prev) =>
          prev.map((x) => (x.id === invoice.id ? invoice : x))
        );
      toast.success("Payment recorded", {
        description: "It now counts as income.",
      });
    } catch {
      toast.error("Couldn't record the payment. Please try again.");
    }
  }, []);

  // ── Payment-account mutations ──────────────────────────────────────────────
  // When one is set default, the server clears the flag on the others; mirror
  // that locally so the UI stays consistent without a refetch.
  const applyDefault = (list: PaymentAccount[], id: string, isDefault: boolean) =>
    isDefault
      ? list.map((p) => ({ ...p, isDefault: p.id === id }))
      : list;

  const createPaymentAccount = useCallback((input: NewPaymentAccountInput) => {
    addPaymentAccountAction(input)
      .then((p) =>
        setPaymentAccounts((prev) => applyDefault([...prev, p], p.id, p.isDefault))
      )
      .catch(() => toast.error("Couldn't save the payment method."));
  }, []);

  const editPaymentAccount = useCallback(
    (id: string, input: NewPaymentAccountInput) => {
      updatePaymentAccountAction(id, input)
        .then((p) => {
          if (p)
            setPaymentAccounts((prev) =>
              applyDefault(
                prev.map((x) => (x.id === id ? p : x)),
                id,
                p.isDefault
              )
            );
        })
        .catch(() => toast.error("Couldn't update the payment method."));
    },
    []
  );

  const removePaymentAccount = useCallback((id: string) => {
    setPaymentAccounts((prev) => prev.filter((p) => p.id !== id));
    deletePaymentAccountAction(id).catch(() =>
      toast.error("Couldn't delete the payment method.")
    );
  }, []);

  // ── Dialog controls ────────────────────────────────────────────────────────
  const openAddClient = useCallback(() => {
    setEditingClient(null);
    setClientOpen(true);
  }, []);
  const openEditClient = useCallback((c: Client) => {
    setEditingClient(c);
    setClientOpen(true);
  }, []);
  const openPayment = useCallback((i: Invoice) => {
    setPayingInvoice(i);
    setPaymentOpen(true);
  }, []);
  const openAddPaymentAccount = useCallback(() => {
    setEditingPa(null);
    setPaOpen(true);
  }, []);
  const openEditPaymentAccount = useCallback((p: PaymentAccount) => {
    setEditingPa(p);
    setPaOpen(true);
  }, []);

  const value = useMemo<InvoicesContext>(
    () => ({
      clients,
      invoices,
      paymentAccounts,
      getClient: (id) => (id ? clientsById.get(id) : undefined),
      createClient,
      editClient,
      removeClient,
      createInvoice,
      editInvoice,
      removeInvoice,
      send,
      unsend,
      voidOne,
      pay,
      createPaymentAccount,
      editPaymentAccount,
      removePaymentAccount,
      openAddClient,
      openEditClient,
      openPayment,
      openAddPaymentAccount,
      openEditPaymentAccount,
    }),
    [
      clients,
      invoices,
      paymentAccounts,
      clientsById,
      createClient,
      editClient,
      removeClient,
      createInvoice,
      editInvoice,
      removeInvoice,
      send,
      unsend,
      voidOne,
      pay,
      createPaymentAccount,
      editPaymentAccount,
      removePaymentAccount,
      openAddClient,
      openEditClient,
      openPayment,
      openAddPaymentAccount,
      openEditPaymentAccount,
    ]
  );

  return (
    <Ctx.Provider value={value}>
      {children}

      <ClientDialog
        open={clientOpen}
        onOpenChange={(o) => {
          setClientOpen(o);
          if (!o) setEditingClient(null);
        }}
        onCreate={createClient}
        onSave={editClient}
        onDelete={removeClient}
        editing={editingClient}
      />

      <PaymentAccountDialog
        open={paOpen}
        onOpenChange={(o) => {
          setPaOpen(o);
          if (!o) setEditingPa(null);
        }}
        onCreate={createPaymentAccount}
        onSave={editPaymentAccount}
        onDelete={removePaymentAccount}
        editing={editingPa}
      />

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={(o) => {
          setPaymentOpen(o);
          if (!o) setPayingInvoice(null);
        }}
        invoice={payingInvoice}
        onPay={pay}
      />
    </Ctx.Provider>
  );
}
