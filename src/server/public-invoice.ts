import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/config";
import * as fileDb from "@/server/db-file";
import {
  invoiceToUi,
  invoiceLineToUi,
  clientToUi,
  paymentAccountToUi,
} from "@/server/mappers";
import type { Client, Invoice, PaymentAccount } from "@/lib/data";
import type {
  ClientRow,
  InvoiceLineRow,
  InvoiceRow,
  PaymentAccountRow,
} from "@/lib/schema";

/**
 * Read an invoice by its public share token — the ONE legitimate cross-user
 * read. The token is an unguessable capability (minted on send); it, not a
 * session, authorizes access. We select only the single invoice matching the
 * token plus its lines and client, and return nothing else. In local file mode
 * there's no service role, so we read the file store directly.
 */

const todayIso = () => new Date().toISOString().slice(0, 10);

export async function getPublicInvoice(
  token: string
): Promise<{ invoice: Invoice; client?: Client } | null> {
  if (!token) return null;

  if (SUPABASE_CONFIGURED) {
    const admin = createAdminClient();
    if (!admin) return null;
    const { data: inv } = await admin
      .from("invoices")
      .select("*")
      .eq("public_token", token)
      .maybeSingle();
    if (!inv) return null;
    const invoiceRow = inv as InvoiceRow;

    const { data: lineData } = await admin
      .from("invoice_lines")
      .select("*")
      .eq("invoice_id", invoiceRow.id);
    const lines = ((lineData ?? []) as InvoiceLineRow[])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(invoiceLineToUi);

    let client: Client | undefined;
    if (invoiceRow.client_id) {
      const { data: cl } = await admin
        .from("clients")
        .select("*")
        .eq("id", invoiceRow.client_id)
        .maybeSingle();
      if (cl) client = clientToUi(cl as ClientRow);
    }
    let paymentAccount: PaymentAccount | null = null;
    if (invoiceRow.payment_account_id) {
      const { data: pa } = await admin
        .from("payment_accounts")
        .select("*")
        .eq("id", invoiceRow.payment_account_id)
        .maybeSingle();
      if (pa) paymentAccount = paymentAccountToUi(pa as PaymentAccountRow);
    }
    return {
      invoice: invoiceToUi(invoiceRow, todayIso(), lines, paymentAccount),
      client,
    };
  }

  // Local file mode (single-user demo).
  const rows = await fileDb.selectWhere("invoices", { public_token: token });
  const invoiceRow = rows[0];
  if (!invoiceRow) return null;
  const lineRows = await fileDb.selectWhere("invoice_lines", {
    invoice_id: invoiceRow.id,
  });
  const lines = lineRows
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(invoiceLineToUi);
  let client: Client | undefined;
  if (invoiceRow.client_id) {
    const c = await fileDb.findById("clients", invoiceRow.client_id);
    if (c) client = clientToUi(c);
  }
  let paymentAccount: PaymentAccount | null = null;
  if (invoiceRow.payment_account_id) {
    const pa = await fileDb.findById(
      "payment_accounts",
      invoiceRow.payment_account_id
    );
    if (pa) paymentAccount = paymentAccountToUi(pa);
  }
  return {
    invoice: invoiceToUi(invoiceRow, todayIso(), lines, paymentAccount),
    client,
  };
}
