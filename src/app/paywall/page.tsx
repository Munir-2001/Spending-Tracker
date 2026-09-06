import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";

import { getCurrentUser, getEntitlement, signOut } from "@/server/actions";
import { StartTrialButton } from "@/components/paywall/start-trial-button";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PERKS = [
  "Every account, card & currency in one calm place",
  "Beautiful invoices — PDF export & shareable pay-links",
  "Gold, crypto & assets priced live, with real P/L",
  "Net-worth history, budgets, goals & Zakat",
  "Privacy blur, and encryption on everything sensitive",
];

/** Mark — three stacked balanced bars. */
function Mark() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-5">
      <rect x="2" y="3.5" width="12" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="2" y="7.4" width="8" height="2.2" rx="1.1" fill="currentColor" opacity="0.7" />
      <rect x="2" y="11.3" width="10.5" height="2.2" rx="1.1" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export default async function PaywallPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const devPreview = process.env.NODE_ENV !== "production" && preview === "1";

  if (!devPreview) {
    const user = await getCurrentUser();
    if (!user) redirect("/"); // not signed in
    const { pro } = await getEntitlement();
    if (pro) redirect("/dashboard"); // already subscribed
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Mark />
        </span>
        <span className="display text-lg tracking-tight">Ledger</span>
      </div>

      {/* Offer */}
      <h1 className="display mt-10 text-4xl leading-[1.05] tracking-tight">
        Start your 7-day trial
        <br />
        for <span className="num">$0.99</span>
      </h1>
      <p className="mt-3 text-muted-foreground">
        Then <span className="num font-medium text-foreground">$12/month</span>.
        Cancel anytime, in a tap.
      </p>

      {/* Perks */}
      <ul className="mt-8 space-y-3">
        {PERKS.map((p) => (
          <li key={p} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-income/12 text-income">
              <Check className="size-3.5" />
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>

      {/* CTAs */}
      <div className="mt-10 space-y-3">
        <StartTrialButton plan="trial" className="w-full gap-1.5 text-base">
          Start for $0.99
        </StartTrialButton>
        <StartTrialButton
          plan="annual"
          variant="ghost"
          className="w-full text-sm text-muted-foreground"
        >
          or pay annually — $99/year (2 months free)
        </StartTrialButton>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        $0.99 for the first 7 days, then $12/month. Cancel anytime in Settings.
      </p>

      {/* Wrong account escape */}
      <form action={signOut} className="mt-8 text-center">
        <button
          type="submit"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Sign in with a different account
        </button>
      </form>
    </main>
  );
}
