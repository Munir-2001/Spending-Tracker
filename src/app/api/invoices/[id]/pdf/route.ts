import { getInvoice, listClients } from "@/server/actions";
import { renderInvoicePdf } from "@/server/invoice-pdf";

/**
 * Server-rendered PDF download for an invoice.
 * `GET /api/invoices/:id/pdf` → application/pdf.
 *
 * Ownership: getInvoice reads through the user-scoped Supabase client, so RLS
 * ensures a user can only render their own invoice (in local file mode there's
 * a single demo user). Runs on the Node runtime — react-pdf is not edge-safe.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const invoice = await getInvoice(id);
  if (!invoice) return new Response("Invoice not found", { status: 404 });

  const clients = await listClients();
  const client = clients.find((c) => c.id === invoice.clientId);

  const pdf = await renderInvoicePdf(invoice, client);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
