"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RowMenu } from "@/components/ui/row-menu";
import { Segmented } from "@/components/ui/segmented";
import { StatTile } from "@/components/ui/stat-tile";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAppData } from "@/components/transactions/transactions-provider";
import { useInvoices } from "@/components/invoices/invoices-provider";
import { StatusBadge } from "@/components/invoices/status-badge";
import type { Invoice } from "@/lib/data";
import { amountDue } from "@/lib/invoice";
import { formatMoney, formatDate } from "@/lib/format";

type Filter = "all" | "outstanding" | "draft" | "paid" | "overdue";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "outstanding", label: "Outstanding" },
  { value: "overdue", label: "Overdue" },
  { value: "draft", label: "Drafts" },
  { value: "paid", label: "Paid" },
];

export default function InvoicesPage() {
  const { invoices, getClient } = useInvoices();
  const { fx, baseCurrency } = useAppData();
  const [filter, setFilter] = useState<Filter>("all");

  // Base-currency roll-ups (invoices can be multi-currency).
  const stats = useMemo(() => {
    let outstanding = 0;
    let overdue = 0;
    let collected = 0;
    for (const inv of invoices) {
      if (inv.status === "void") continue;
      collected += fx.toBase(inv.amountPaid, inv.currency);
      if (inv.status === "draft" || inv.status === "paid") continue;
      const due = fx.toBase(amountDue(inv.total, inv.amountPaid), inv.currency);
      outstanding += due;
      if (inv.overdue) overdue += due;
    }
    return { outstanding, overdue, collected };
  }, [invoices, fx]);

  const shown = useMemo(() => {
    const list = invoices.filter((inv) => {
      switch (filter) {
        case "outstanding":
          return (
            inv.status !== "draft" &&
            inv.status !== "paid" &&
            inv.status !== "void"
          );
        case "overdue":
          return inv.overdue;
        case "draft":
          return inv.status === "draft";
        case "paid":
          return inv.status === "paid";
        default:
          return true;
      }
    });
    return list.sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  }, [invoices, filter]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="display text-3xl tracking-tight md:text-4xl">
              Invoices
            </h1>
            <p className="text-sm text-muted-foreground">
              Bill clients, track what&apos;s owed, and count payments as income.
            </p>
          </div>
          <Button asChild className="shrink-0 gap-1.5">
            <Link href="/invoices/new">
              <Plus className="size-4" />
              New
            </Link>
          </Button>
        </div>
      </Reveal>

      {invoices.length === 0 ? (
        <Reveal delay={0.05}>
          <EmptyState
            className="mt-10"
            icon={<FileText className="size-6" />}
            title="No invoices yet"
            description="Create your first invoice. When it's paid, it counts as income automatically."
            action={
              <Button asChild variant="outline" className="gap-1.5">
                <Link href="/invoices/new">
                  <Plus className="size-4" />
                  New invoice
                </Link>
              </Button>
            }
          />
        </Reveal>
      ) : (
        <>
          <Reveal delay={0.05}>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile
                label="Outstanding"
                value={formatMoney(stats.outstanding, { currency: baseCurrency })}
              />
              <StatTile
                label="Overdue"
                value={formatMoney(stats.overdue, { currency: baseCurrency })}
                tone="expense"
              />
              <StatTile
                label="Collected"
                value={formatMoney(stats.collected, { currency: baseCurrency })}
                tone="income"
              />
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-6">
              <Segmented
                value={filter}
                onChange={setFilter}
                options={FILTERS}
                ariaLabel="Filter invoices by status"
              />
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            {shown.length === 0 ? (
              <EmptyState
                className="mt-6"
                variant="plain"
                title="Nothing here"
                description="No invoices match this filter."
              />
            ) : (
              <ul className="mt-4 divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card">
                {shown.map((inv) => (
                  <InvoiceRow
                    key={inv.id}
                    invoice={inv}
                    clientName={getClient(inv.clientId)?.name ?? "—"}
                  />
                ))}
              </ul>
            )}
          </Reveal>
        </>
      )}
    </div>
  );
}

function InvoiceRow({
  invoice,
  clientName,
}: {
  invoice: Invoice;
  clientName: string;
}) {
  const { removeInvoice } = useInvoices();
  const router = useRouter();
  const confirm = useConfirm();
  const isDraft = invoice.status === "draft";

  async function onDelete() {
    const ok = await confirm({
      title: `Delete ${invoice.number}?`,
      description: "Draft invoices are removed permanently.",
      confirmText: "Delete",
      tone: "danger",
    });
    if (ok) removeInvoice(invoice.id);
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <Link
        href={`/invoices/${invoice.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium leading-tight">
              {invoice.number}
            </p>
            <StatusBadge status={invoice.status} overdue={invoice.overdue} />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {clientName} · issued {formatDate(invoice.issueDate)} · due{" "}
            {formatDate(invoice.dueDate)}
          </p>
        </div>
        <span className="num shrink-0 text-sm font-semibold tabular-nums">
          {formatMoney(invoice.total, { currency: invoice.currency })}
        </span>
      </Link>

      {isDraft ? (
        <RowMenu
          onEdit={() => router.push(`/invoices/${invoice.id}/edit`)}
          onDelete={onDelete}
          label={`Actions for ${invoice.number}`}
        />
      ) : (
        <span className="inline-block w-8 shrink-0" />
      )}
    </li>
  );
}
