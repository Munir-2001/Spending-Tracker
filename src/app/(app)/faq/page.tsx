"use client";

import { ChevronDown, HelpCircle } from "lucide-react";

import { Reveal } from "@/components/reveal";

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is my financial data secure?",
    a: (
      <>
        Yes. Every account is isolated by database-level Row-Level Security, so
        only you can ever read your data. Sensitive fields — account numbers and
        names, institutions, merchant names, and notes — are encrypted at rest
        with AES-256-GCM <em>before</em> they reach the database, using a key
        that is never stored alongside your data.
      </>
    ),
  },
  {
    q: "Is Ledger free?",
    a: (
      <>
        Ledger is free for personal use. A paid tier for small businesses (shared
        workspaces, roles, and accountant-ready exports) is on the roadmap —
        individuals stay free.
      </>
    ),
  },
  {
    q: 'What\'s the difference between "starting balance" and my current balance?',
    a: (
      <>
        Your <strong>starting balance</strong> is what an account held{" "}
        <em>before</em> you logged any transactions. Ledger then adds every
        transaction you record to compute the live current balance. If the number
        ever drifts from reality, open{" "}
        <strong>Accounts → ⋯ → Reconcile balance</strong> and type the real
        figure — it posts a one-line adjustment that never counts as income or
        spending.
      </>
    ),
  },
  {
    q: "A refund or repayment appeared — why isn't it counted as income?",
    a: (
      <>
        Money that comes <em>back</em> to you (a friend repaying you, a refund)
        isn&apos;t earnings, so Ledger flags it as a reimbursement and excludes it
        from income, spending, budgets, and reports. It still updates the
        account&apos;s balance.
      </>
    ),
  },
  {
    q: "How do transfers work?",
    a: (
      <>
        A transfer moves money between your own accounts, or into an asset (e.g.
        buying gold with your Revolut balance). Both sides are excluded from
        income and expense — it&apos;s your money changing pockets, not spending.
      </>
    ),
  },
  {
    q: "How does live gold pricing work?",
    a: (
      <>
        Add a gold holding in tola or grams at a karat, plus what you paid.
        Ledger fetches the live spot price, converts it to your currency, and
        shows your real-time profit or loss. Prices refresh automatically (cached
        daily) and on demand from the Assets page.
      </>
    ),
  },
  {
    q: "What are recurring transactions and bill reminders?",
    a: (
      <>
        Set up rent, salary, or a subscription once. <strong>Auto-post</strong>{" "}
        rules create the transaction automatically when it&apos;s due;{" "}
        <strong>reminder-only</strong> rules surface on your dashboard as upcoming
        bills for you to confirm.
      </>
    ),
  },
  {
    q: "How are subscriptions detected?",
    a: (
      <>
        Ledger scans your transactions for the same merchant charging a steady
        amount across two or more months, then lists them with your monthly and
        yearly totals — so you can catch the ones you forgot about.
      </>
    ),
  },
  {
    q: "Can I track multiple currencies?",
    a: (
      <>
        Yes. Record transactions in any currency; Ledger converts everything to
        your base currency for totals and net worth using an FX rate table you
        control in Settings.
      </>
    ),
  },
  {
    q: "How do I import my history?",
    a: (
      <>
        Go to <strong>Transactions → Import</strong> to upload a CSV or Excel /
        bank-statement file and map the columns in.
      </>
    ),
  },
  {
    q: "Can anyone else see my data?",
    a: (
      <>
        No. Access is enforced per user at the database level, and your sensitive
        fields are encrypted — they can&apos;t be read without your key.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-col gap-1.5">
          <span className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-surface text-muted-foreground">
            <HelpCircle className="size-5" />
          </span>
          <h1 className="display mt-3 text-3xl tracking-tight md:text-4xl">
            Frequently asked questions
          </h1>
          <p className="text-sm text-muted-foreground">
            The essentials on how Ledger handles your money and your privacy.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-8 divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card">
          {FAQS.map((f, i) => (
            <details key={i} className="group px-5 [&_summary]:list-none">
              <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-sm font-medium">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Still stuck?{" "}
          <a
            href="/support"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Contact support
          </a>
          .
        </p>
      </Reveal>
    </div>
  );
}