import "server-only";

import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Rect,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

import type { Client, Invoice } from "@/lib/data";
import { amountDue } from "@/lib/invoice";
import { formatMoney, formatFullDate } from "@/lib/format";

/**
 * Print-ready PDF — mirrors the on-brand <InvoiceDocument>: centered Ledger
 * letterhead, ruled table, aligned bank-details grid. ONE type family
 * (Helvetica; its figures are fixed-width so amount columns align) — no second
 * mono font, so every block is typographically consistent. Shared
 * `@/lib/invoice` math + `formatMoney` keep figures identical to the app.
 */

const INK = "#1c1a17";
const MUTED = "#78716c";
const BORDER = "#e7e5e4";
const INCOME = "#0f7a5a";

const S = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: INK,
    lineHeight: 1.5,
  },
  // Letterhead — serif wordmark (Times) echoes the app's Fraunces letterhead.
  head: { alignItems: "center", marginBottom: 30 },
  markBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  wordmark: {
    fontSize: 25,
    fontFamily: "Times-Roman",
    letterSpacing: 6,
    marginLeft: 6,
    lineHeight: 1,
    marginBottom: 9,
  },
  eyebrow: { fontSize: 9, letterSpacing: 1.5, color: MUTED, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  rule: { borderBottomWidth: 1, borderBottomColor: BORDER },

  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 26 },
  bill: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 5 },
  small: { fontSize: 10, color: MUTED, marginTop: 1 },
  right: { textAlign: "right" },
  number: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 5, textAlign: "right" },
  metaLine: { flexDirection: "row", justifyContent: "flex-end", gap: 16, marginTop: 3 },

  // Table
  tHead: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: INK, paddingBottom: 7, marginTop: 30 },
  tRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 10 },
  cDesc: { flex: 1, paddingRight: 8 },
  cUnit: { width: 90, textAlign: "right" },
  cQty: { width: 46, textAlign: "right" },
  cTax: { width: 48, textAlign: "right", color: MUTED },
  cAmt: { width: 94, textAlign: "right", fontFamily: "Helvetica-Bold" },
  th: { fontSize: 9, letterSpacing: 1, color: MUTED, textTransform: "uppercase" },

  // Totals
  totalsWrap: { marginTop: 18, flexDirection: "row", justifyContent: "flex-end" },
  totals: { width: 230 },
  totalLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1.5,
    borderTopColor: INK,
    paddingTop: 9,
    marginTop: 6,
  },
  grandLabel: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  grandValue: { fontSize: 19, fontFamily: "Helvetica-Bold" },

  // Note + footer
  noteBox: { marginTop: 26, borderLeftWidth: 2, borderLeftColor: BORDER, paddingLeft: 12, maxWidth: 380 },
  footer: {
    marginTop: 44,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  bankRow: { flexDirection: "row", marginTop: 3.5 },
  bankLabel: { width: 104, color: MUTED },
  bankValue: { width: 268, color: INK },
  thanks: { fontSize: 24, fontFamily: "Times-Italic", color: MUTED },
});

function Mark() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Rect x={2} y={3.5} width={12} height={2.2} rx={1.1} fill="#ffffff" />
      <Rect x={2} y={7.4} width={8} height={2.2} rx={1.1} fill="#ffffff" opacity={0.7} />
      <Rect x={2} y={11.3} width={10.5} height={2.2} rx={1.1} fill="#ffffff" opacity={0.45} />
    </Svg>
  );
}

function Bank({ label, value }: { label: string; value: string }) {
  return (
    <View style={S.bankRow} wrap={false}>
      <Text style={S.bankLabel}>{label}</Text>
      <Text style={S.bankValue}>{value}</Text>
    </View>
  );
}

function InvoicePdfDoc({
  invoice,
  client,
}: {
  invoice: Invoice;
  client?: Client;
}) {
  const { currency } = invoice;
  const lines = invoice.lines ?? [];
  const prefs = invoice.fieldPrefs;
  const pa = invoice.paymentAccount;
  const due = amountDue(invoice.total, invoice.amountPaid);
  // react-pdf's built-in Helvetica has broken metrics for some currency glyphs
  // (e.g. €) that overlap the digits — render the ISO code (letters only)
  // instead so amounts always render cleanly. PDF-only; app HTML keeps the symbol.
  const money = (m: number) =>
    formatMoney(m, { currency }).replace(/^[^\d\s.,-]+/, currency + " ");

  return (
    <Document title={`Invoice ${invoice.number}`}>
      <Page size="A4" style={S.page}>
        {/* Letterhead */}
        <View style={S.head}>
          <View style={S.markBox}>
            <Mark />
          </View>
          <Text style={S.wordmark}>LEDGER</Text>
          <Text style={S.eyebrow}>Invoice</Text>
        </View>

        <View style={S.rule} />

        {/* Parties + meta */}
        <View style={S.metaRow}>
          <View style={{ maxWidth: "58%" }}>
            <Text style={S.eyebrow}>Issued to</Text>
            <Text style={S.bill}>{client?.name ?? "—"}</Text>
            {client?.email ? <Text style={S.small}>{client.email}</Text> : null}
            {client?.address ? <Text style={S.small}>{client.address}</Text> : null}
            {client?.taxId ? <Text style={S.small}>Tax ID {client.taxId}</Text> : null}
          </View>
          <View>
            <Text style={[S.eyebrow, S.right]}>
              Invoice no.{invoice.overdue ? "  ·  OVERDUE" : ""}
            </Text>
            <Text style={S.number}>{invoice.number}</Text>
            <View style={S.metaLine}>
              <Text style={S.small}>Issued</Text>
              <Text>{formatFullDate(invoice.issueDate)}</Text>
            </View>
            <View style={S.metaLine}>
              <Text style={S.small}>Due</Text>
              <Text>{formatFullDate(invoice.dueDate)}</Text>
            </View>
          </View>
        </View>

        {/* Line items */}
        <View style={S.tHead}>
          <Text style={[S.cDesc, S.th]}>Description</Text>
          <Text style={[S.cUnit, S.th]}>Unit price</Text>
          {prefs.quantity ? <Text style={[S.cQty, S.th]}>Qty</Text> : null}
          {prefs.tax ? <Text style={[S.cTax, S.th]}>Tax</Text> : null}
          <Text style={[S.cAmt, S.th, { fontFamily: "Helvetica" }]}>Amount</Text>
        </View>
        {lines.map((l) => (
          <View style={S.tRow} key={l.id} wrap={false}>
            <Text style={S.cDesc}>{l.description}</Text>
            <Text style={S.cUnit}>{money(l.unitPrice)}</Text>
            {prefs.quantity ? <Text style={S.cQty}>{l.quantity}</Text> : null}
            {prefs.tax ? (
              <Text style={S.cTax}>{l.taxRate ? `${l.taxRate}%` : "—"}</Text>
            ) : null}
            {/* pre-tax line total */}
            <Text style={S.cAmt}>{money(l.amount)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={S.totalsWrap}>
          <View style={S.totals}>
            <View style={S.totalLine}>
              <Text style={{ color: MUTED }}>Subtotal</Text>
              <Text>{money(invoice.subtotal)}</Text>
            </View>
            {invoice.discountTotal > 0 && (
              <View style={S.totalLine}>
                <Text style={{ color: MUTED }}>Discount</Text>
                <Text>−{money(invoice.discountTotal)}</Text>
              </View>
            )}
            {prefs.tax ? (
              <View style={S.totalLine}>
                <Text style={{ color: MUTED }}>Tax</Text>
                <Text>{money(invoice.taxTotal)}</Text>
              </View>
            ) : null}
            {invoice.amountPaid > 0 && (
              <View style={S.totalLine}>
                <Text style={{ color: INCOME }}>Paid</Text>
                <Text style={{ color: INCOME }}>{money(invoice.amountPaid)}</Text>
              </View>
            )}
            <View style={S.grand}>
              <Text style={S.grandLabel}>
                {invoice.amountPaid > 0 ? "Amount due" : "Total"}
              </Text>
              <Text style={S.grandValue}>
                {money(invoice.amountPaid > 0 ? due : invoice.total)}
              </Text>
            </View>
          </View>
        </View>

        {/* Note */}
        {prefs.notes && invoice.notes ? (
          <View style={S.noteBox}>
            <Text style={S.eyebrow}>Note</Text>
            <Text style={{ color: MUTED, marginTop: 2 }}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* Footer: bank details + thank you */}
        <View style={S.footer}>
          <View style={{ width: 380 }}>
            {prefs.paymentDetails && pa ? (
              <View>
                <Text style={S.eyebrow}>Bank details</Text>
                <View style={{ marginTop: 4 }}>
                  {pa.bankName ? <Bank label="Bank" value={pa.bankName} /> : null}
                  <Bank label="Account title" value={pa.accountName} />
                  {pa.accountNumber ? (
                    <Bank label="Account no." value={pa.accountNumber} />
                  ) : null}
                  {pa.iban ? <Bank label="IBAN" value={pa.iban} /> : null}
                  {pa.swift ? <Bank label="SWIFT / BIC" value={pa.swift} /> : null}
                  {pa.branchCode ? <Bank label="Branch" value={pa.branchCode} /> : null}
                </View>
              </View>
            ) : null}
            {prefs.terms && invoice.terms ? (
              <View style={{ marginTop: prefs.paymentDetails && pa ? 12 : 0 }}>
                <Text style={S.eyebrow}>Terms</Text>
                <Text style={{ color: MUTED, marginTop: 2 }}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
          <Text style={S.thanks}>Thank you</Text>
        </View>
      </Page>
    </Document>
  );
}

/** Render an invoice to a PDF byte buffer. */
export async function renderInvoicePdf(
  invoice: Invoice,
  client?: Client
): Promise<Buffer> {
  return renderToBuffer(<InvoicePdfDoc invoice={invoice} client={client} />);
}
