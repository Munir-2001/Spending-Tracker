import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

// Served at /llms.txt — the emerging convention for giving LLMs a concise,
// curated map of the site (https://llmstxt.org). Static; regenerated per deploy.
export const dynamic = "force-static";

export function GET() {
  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_NAME} helps people track spending, accounts, assets, budgets, goals and net worth with accounting-grade correctness. It is multi-currency with live exchange rates, tracks live gold (per tola / gram / karat) and crypto holdings with per-purchase cost-basis and profit/loss, and includes recurring bills, reimbursements, insights, reports and a monthly spending recap. Sensitive financial text is encrypted at rest and every row is isolated per user.

## Pages
- [Home](${SITE_URL}/): Product overview and sign-in.
- [Privacy Policy](${SITE_URL}/privacy): What is stored, how it is encrypted, and user rights.
- [Terms of Service](${SITE_URL}/terms): Terms of use.

## Features
- Double-entry transactions with split line items and reconciliation
- Multi-currency accounts rolled up with live mid-market FX rates
- Live gold (tola / gram / karat) and crypto holdings with per-purchase lots and dual-currency P/L
- Budgets, savings goals, recurring bills, and subscription detection
- Net worth, insights, reports, and a monthly "wrapped" spending recap
- Google sign-in, per-user row-level security, AES-256-GCM encryption of sensitive text

## Notes
- The application dashboard requires authentication and is intentionally not crawlable.
- Feedback is collected through the in-app form.
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
