import "server-only";

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

import type { Client, Invoice } from "@/lib/data";
import { amountDue, lineTax } from "@/lib/invoice";
import { formatMoney, formatFullDate } from "@/lib/format";

/**
 * Server-rendered PDF of an invoice. Mirrors the on-brand HTML
 * <InvoiceDocument> layout; the shared `@/lib/invoice` math + `formatMoney`
 * guarantee the figures match exactly. Brand fonts (Fraunces / Geist Mono) come
 * from next/font and aren't available as TTFs here, so we use react-pdf's
 * built-in Helvetica for text and Courier for money figures — mirroring the
 * app's sans/mono split. To upgrade: register the TTFs via Font.register and
 * swap the `sans`/`mono` families below.
 */

const INK = "#1c1a17";
const MUTED = "#78716c";
const BORDER = "#e7e5e4";
const INCOME = "#0f7a5a";

const S = StyleSheet.create({
  page: {
    paddingVertical: 48,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: INK,
    lineHeight: 1.5,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  eyebrow: {
    fontSize: 8,
    letterSpacing: 1,
    color: MUTED,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  number: { fontSize: 22, marginTop: 2, fontFamily: "Helvetica-Bold" },
  totalBig: {
    fontSize: 18,
    fontFamily: "Courier-Bold",
    textAlign: "right",
    marginTop: 4,
  },
  status: {
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  metaRow: { flexDirection: "row", gap: 24, marginTop: 28 },
  metaCol: { flex: 1 },
  metaValue: { marginTop: 2 },
  small: { fontSize: 8, color: MUTED },
  tHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 4,
    marginTop: 28,
  },
  tRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 6,
  },
  cDesc: { flex: 1 },
  cNum: { width: 70, textAlign: "right", fontFamily: "Courier" },
  cAmt: { width: 80, textAlign: "right", fontFamily: "Courier-Bold" },
  th: { fontSize: 8, letterSpacing: 1, color: MUTED, textTransform: "uppercase" },
  totalsWrap: { marginTop: 16, flexDirection: "row", justifyContent: "flex-end" },
  totals: { width: 200 },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
    marginTop: 4,
  },
  money: { fontFamily: "Courier" },
  moneyBold: { fontFamily: "Courier-Bold" },
  footer: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 16,
    color: MUTED,
  },
  payBox: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    padding: 12,
  },
  payGrid: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  payField: { width: "33%", marginBottom: 6, paddingRight: 8 },
});

function PdfField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={S.payField}>
      <Text style={S.small}>{label}</Text>
      <Text style={mono ? { fontFamily: "Courier" } : undefined}>{value}</Text>
    </View>
  );
}

function InvoicePdfDoc({
  invoice,
  client,
  from,
}: {
  invoice: Invoice;
  client?: Client;
  from?: string;
}) {
  const { currency } = invoice;
  const lines = invoice.lines ?? [];
  const due = amountDue(invoice.total, invoice.amountPaid);
  const money = (m: number) => formatMoney(m, { currency });

  return (
    <Document title={`Invoice ${invoice.number}`}>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.headerRow}>
          <View>
            <Text style={S.eyebrow}>Invoice</Text>
            <Text style={S.number}>{invoice.number}</Text>
          </View>
          <View>
            <Text
              style={[
                S.status,
                { color: invoice.overdue ? "#b91c1c" : MUTED },
              ]}
            >
              {invoice.overdue ? "Overdue" : invoice.status}
            </Text>
            <Text style={S.totalBig}>{money(invoice.total)}</Text>
            {invoice.amountPaid > 0 && due > 0 && (
              <Text style={[S.small, { textAlign: "right" }]}>
                {money(due)} due
              </Text>
            )}
          </View>
        </View>

        {/* Parties + dates */}
        <View style={S.metaRow}>
          {from ? (
            <View style={S.metaCol}>
              <Text style={S.eyebrow}>From</Text>
              <Text style={S.metaValue}>{from}</Text>
            </View>
          ) : null}
          <View style={S.metaCol}>
            <Text style={S.eyebrow}>Bill to</Text>
            <Text style={S.metaValue}>{client?.name ?? "—"}</Text>
            {client?.email ? <Text style={S.small}>{client.email}</Text> : null}
            {client?.address ? (
              <Text style={S.small}>{client.address}</Text>
            ) : null}
            {client?.taxId ? (
              <Text style={S.small}>Tax ID {client.taxId}</Text>
            ) : null}
          </View>
          <View style={S.metaCol}>
            <Text style={S.eyebrow}>Issued</Text>
            <Text style={S.metaValue}>{formatFullDate(invoice.issueDate)}</Text>
          </View>
          <View style={S.metaCol}>
            <Text style={S.eyebrow}>Due</Text>
            <Text style={S.metaValue}>{formatFullDate(invoice.dueDate)}</Text>
          </View>
        </View>

        {/* Line items */}
        <View style={S.tHead}>
          <Text style={[S.cDesc, S.th]}>Description</Text>
          <Text style={[S.cNum, S.th]}>Qty</Text>
          <Text style={[S.cNum, S.th]}>Price</Text>
          <Text style={[S.cNum, S.th]}>Tax</Text>
          <Text style={[S.cAmt, S.th]}>Amount</Text>
        </View>
        {lines.map((l) => (
          <View style={S.tRow} key={l.id} wrap={false}>
            <Text style={S.cDesc}>{l.description}</Text>
            <Text style={S.cNum}>{l.quantity}</Text>
            <Text style={S.cNum}>{money(l.unitPrice)}</Text>
            <Text style={S.cNum}>{l.taxRate ? `${l.taxRate}%` : "—"}</Text>
            <Text style={S.cAmt}>{money(l.amount + lineTax(l))}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={S.totalsWrap}>
          <View style={S.totals}>
            <View style={S.totalLine}>
              <Text style={{ color: MUTED }}>Subtotal</Text>
              <Text style={S.money}>{money(invoice.subtotal)}</Text>
            </View>
            {invoice.discountTotal > 0 && (
              <View style={S.totalLine}>
                <Text style={{ color: MUTED }}>Discount</Text>
                <Text style={S.money}>−{money(invoice.discountTotal)}</Text>
              </View>
            )}
            <View style={S.totalLine}>
              <Text style={{ color: MUTED }}>Tax</Text>
              <Text style={S.money}>{money(invoice.taxTotal)}</Text>
            </View>
            <View style={S.totalGrand}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Total</Text>
              <Text style={S.moneyBold}>{money(invoice.total)}</Text>
            </View>
            {invoice.amountPaid > 0 && (
              <>
                <View style={S.totalLine}>
                  <Text style={{ color: INCOME }}>Paid</Text>
                  <Text style={[S.money, { color: INCOME }]}>
                    {money(invoice.amountPaid)}
                  </Text>
                </View>
                <View style={S.totalLine}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>Due</Text>
                  <Text style={S.moneyBold}>{money(due)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Payment details */}
        {invoice.paymentAccount && (
          <View style={S.payBox}>
            <Text style={S.eyebrow}>Payment details</Text>
            <View style={S.payGrid}>
              {invoice.paymentAccount.bankName ? (
                <PdfField label="Bank" value={invoice.paymentAccount.bankName} />
              ) : null}
              <PdfField
                label="Account name"
                value={invoice.paymentAccount.accountName}
              />
              {invoice.paymentAccount.accountNumber ? (
                <PdfField
                  label="Account no."
                  value={invoice.paymentAccount.accountNumber}
                  mono
                />
              ) : null}
              {invoice.paymentAccount.iban ? (
                <PdfField label="IBAN" value={invoice.paymentAccount.iban} mono />
              ) : null}
              {invoice.paymentAccount.swift ? (
                <PdfField
                  label="SWIFT / BIC"
                  value={invoice.paymentAccount.swift}
                  mono
                />
              ) : null}
              {invoice.paymentAccount.branchCode ? (
                <PdfField
                  label="Branch code"
                  value={invoice.paymentAccount.branchCode}
                  mono
                />
              ) : null}
            </View>
            {invoice.paymentAccount.notes ? (
              <Text style={[S.small, { marginTop: 6 }]}>
                {invoice.paymentAccount.notes}
              </Text>
            ) : null}
          </View>
        )}

        {/* Notes + terms */}
        {(invoice.notes || invoice.terms) && (
          <View style={S.footer}>
            {invoice.notes ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={S.eyebrow}>Notes</Text>
                <Text>{invoice.notes}</Text>
              </View>
            ) : null}
            {invoice.terms ? (
              <View>
                <Text style={S.eyebrow}>Terms</Text>
                <Text>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
        )}
      </Page>
    </Document>
  );
}

/** Render an invoice to a PDF byte buffer. */
export async function renderInvoicePdf(
  invoice: Invoice,
  client?: Client,
  from?: string
): Promise<Buffer> {
  return renderToBuffer(
    <InvoicePdfDoc invoice={invoice} client={client} from={from} />
  );
}
