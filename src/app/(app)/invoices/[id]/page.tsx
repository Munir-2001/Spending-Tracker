"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Send, Undo2, CreditCard, Ban, Download, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useInvoices } from "@/components/invoices/invoices-provider";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { getInvoice } from "@/server/actions";
import type { Invoice } from "@/lib/data";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { invoices, getClient, openEditInvoice, openPayment, send, unsend, voidOne } =
    useInvoices();
  const confirm = useConfirm();

  const listInvoice = invoices.find((i) => i.id === id);
  const [fetched, setFetched] = useState<Invoice | null>(null);

  // Load the full record (with line items) — the list version omits lines.
  // Re-fetch when the totals change (i.e. after an edit).
  useEffect(() => {
    let alive = true;
    getInvoice(id)
      .then((full) => {
        if (alive) setFetched(full);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id, listInvoice?.subtotal, listInvoice?.taxTotal, listInvoice?.total]);

  // Prefer the provider record for reactive status/amountPaid; take lines from
  // the fetched full record.
  const base = listInvoice ?? fetched;
  const invoice: Invoice | null = base
    ? { ...base, lines: fetched?.lines ?? base.lines }
    : null;

  if (!invoice) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-14 md:px-8">
        <EmptyState
          title="Invoice not found"
          description="It may have been deleted."
          action={
            <Button asChild variant="outline">
              <Link href="/invoices">Back to invoices</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const client = getClient(invoice.clientId);
  const isDraft = invoice.status === "draft";
  const isVoid = invoice.status === "void";
  const isPaid = invoice.status === "paid";
  const canPay = !isDraft && !isVoid && !isPaid;
  const canUnsend =
    (invoice.status === "sent" || invoice.status === "viewed") &&
    invoice.amountPaid === 0;
  const canVoid = !isVoid && !isPaid && invoice.amountPaid === 0;

  async function onVoid() {
    if (!invoice) return;
    const ok = await confirm({
      title: `Void ${invoice.number}?`,
      description: "A voided invoice can't be paid or edited.",
      confirmText: "Void invoice",
      tone: "warning",
    });
    if (ok) voidOne(invoice.id);
  }

  async function copyLink() {
    if (!invoice?.publicToken) return;
    const url = `${window.location.origin}/invoices/p/${invoice.publicToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Public link copied");
    } catch {
      toast.message("Public link", { description: url });
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/invoices"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Invoices
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {isDraft && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => openEditInvoice(invoice)}
                >
                  <Pencil className="size-4" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => send(invoice.id)}
                >
                  <Send className="size-4" />
                  Send
                </Button>
              </>
            )}
            {canPay && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => openPayment(invoice)}
              >
                <CreditCard className="size-4" />
                Record payment
              </Button>
            )}
            {canUnsend && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => unsend(invoice.id)}
              >
                <Undo2 className="size-4" />
                Unsend
              </Button>
            )}
            {!isDraft && invoice.publicToken && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={copyLink}
              >
                <Link2 className="size-4" />
                Copy link
              </Button>
            )}
            {!isDraft && (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
                  <Download className="size-4" />
                  PDF
                </a>
              </Button>
            )}
            {canVoid && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={onVoid}
              >
                <Ban className="size-4" />
                Void
              </Button>
            )}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-6">
          <InvoiceDocument invoice={invoice} client={client} />
        </div>
      </Reveal>
    </div>
  );
}
