import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";

import { getPublicInvoice } from "@/server/public-invoice";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { Button } from "@/components/ui/button";

// Public share link — readable without auth, but never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getPublicInvoice(token);
  if (!result) notFound();
  const { invoice, client } = result;

  return (
    <div className="min-h-screen bg-background px-4 py-10 md:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="display text-lg tracking-tight">Ledger</span>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href={`/invoices/p/${token}/pdf`} target="_blank" rel="noreferrer">
              <Download className="size-4" />
              Download PDF
            </a>
          </Button>
        </div>
        <InvoiceDocument invoice={invoice} client={client} />
      </div>
    </div>
  );
}
