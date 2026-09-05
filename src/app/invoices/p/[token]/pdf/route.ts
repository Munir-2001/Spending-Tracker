import { getPublicInvoice } from "@/server/public-invoice";
import { renderInvoicePdf } from "@/server/invoice-pdf";

/**
 * Public PDF download for a shared invoice link.
 * `GET /invoices/p/:token/pdf` → application/pdf. The unguessable token is the
 * capability; no session required. Node runtime (react-pdf isn't edge-safe).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const result = await getPublicInvoice(token);
  if (!result) return new Response("Invoice not found", { status: 404 });

  const pdf = await renderInvoicePdf(result.invoice, result.client);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${result.invoice.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
