import type { Metadata } from "next";
import Link from "next/link";

import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service · Ledger",
  description: "The terms that govern your use of Ledger.",
};

const UPDATED = "July 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="display text-lg tracking-tight">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 md:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Mark />
            </span>
            <span className="display text-lg leading-none tracking-tight">
              Ledger
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
        <div className="flex flex-col gap-1.5">
          <h1 className="display text-3xl tracking-tight md:text-4xl">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">Last updated {UPDATED}</p>
        </div>

        <div className="mt-8 space-y-8">
          <p className="text-sm leading-relaxed text-muted-foreground">
            These terms govern your use of Ledger. By signing in and using the
            app, you agree to them. Please read them alongside our{" "}
            <Link
              href="/privacy"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>

          <Section title="The service">
            <p>
              Ledger is a personal finance tracker: you log accounts,
              transactions, budgets, assets, and view insights about your money.
              It is provided for personal, non-commercial use (a separate tier
              may be offered for businesses). We may add, change, or remove
              features over time.
            </p>
          </Section>

          <Section title="Eligibility & your account">
            <p>
              You must be at least 16 (or the age of majority where you live) and
              sign in with a Google account you control. You are responsible for
              the activity under your account and for keeping your access secure.
            </p>
          </Section>

          <Section title="Your data">
            <p>
              You own the financial data you enter. We store and protect it as
              described in the Privacy Policy, and you can export or permanently
              delete it at any time.
            </p>
          </Section>

          <Section title="Not financial advice">
            <p>
              Ledger is a tool for tracking and organizing your money — it is{" "}
              <strong>not</strong> a financial, investment, tax, or accounting
              advisor. Figures such as currency conversions and live prices (for
              example, gold) may be estimated or delayed and can differ from your
              bank or the market. Always verify against official statements
              before making decisions.
            </p>
          </Section>

          <Section title="Acceptable use">
            <p>
              Don&apos;t use Ledger to break the law, infringe others&apos;
              rights, or for fraud or money laundering. Don&apos;t attempt to
              disrupt, reverse-engineer, scrape, overload, or gain unauthorized
              access to the service or to other users&apos; data.
            </p>
          </Section>

          <Section title="Availability & warranties">
            <p>
              We work hard to keep Ledger available and accurate, but it is
              provided on an <strong>&quot;as is&quot;</strong> and{" "}
              <strong>&quot;as available&quot;</strong> basis, without warranties
              of any kind. There may be downtime, and data or third-party prices
              may occasionally be incorrect.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              To the fullest extent permitted by law, Ledger and its maker are
              not liable for any indirect or consequential losses, or for
              decisions you make based on the app. Ledger is a tool to help you
              understand your money — not a guarantee of any outcome.
            </p>
          </Section>

          <Section title="Termination">
            <p>
              You may stop using Ledger and delete your account at any time. We
              may suspend or terminate access if these terms are broken or where
              necessary to protect the service or its users.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these terms from time to time. Material changes will
              be reflected in the &quot;last updated&quot; date above. Continuing
              to use Ledger after an update means you accept the revised terms.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms? Reach us at{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>

        <footer className="mt-12 border-t border-border/60 pt-6 text-xs text-muted-foreground">
          © {UPDATED.split(" ")[1]} Ledger.{" "}
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            Privacy
          </Link>
        </footer>
      </main>
    </div>
  );
}

/** Minimal geometric ledger mark. */
function Mark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="2" y="7.4" width="8" height="2.2" rx="1.1" fill="currentColor" opacity="0.7" />
      <rect x="2" y="11.3" width="10.5" height="2.2" rx="1.1" fill="currentColor" opacity="0.45" />
    </svg>
  );
}
