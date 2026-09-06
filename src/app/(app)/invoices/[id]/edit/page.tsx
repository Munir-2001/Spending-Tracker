import { notFound } from "next/navigation";

import { getInvoice } from "@/server/actions";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  return <InvoiceBuilder editing={invoice} />;
}
