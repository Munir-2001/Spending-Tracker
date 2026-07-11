import Link from "next/link";

import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata = {
  title: "Privacy Policy · Ledger",
  description: "How Ledger stores, protects, and lets you control your data.",
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

export default function PublicPrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">Last updated {UPDATED}</p>
        </div>

        <div className="mt-8 space-y-8">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ledger is a personal finance tracker. Your financial data is yours —
            this policy explains what we store, how we protect it, and the control
            you have over it. We do not sell your data, and we do not show you
            ads.
          </p>

          <Section title="What we collect">
            <p>
              <strong>Account info:</strong> your name and email address, provided
              by Google when you sign in.
            </p>
            <p>
              <strong>Financial data you enter:</strong> the accounts,
              transactions, balances, categories, budgets, goals, assets, and
              notes you create. We only ever store what you choose to add.
            </p>
          </Section>

          <Section title="How your data is protected">
            <p>
              <strong>Isolation:</strong> every row is scoped to your user account
              and enforced by database Row-Level Security, so no other user — and
              no unauthenticated request — can read your data.
            </p>
            <p>
              <strong>Encryption at rest:</strong> sensitive text — account
              numbers and names, institutions, merchant descriptions, people, and
              notes — is encrypted with AES-256-GCM before it is stored. The
              encryption key lives only in the application environment and is never
              kept in the database, so a database dump alone reveals nothing
              readable.
            </p>
            <p>
              <strong>In transit:</strong> all traffic is served over HTTPS with
              strict transport security.
            </p>
          </Section>

          <Section title="Authentication">
            <p>
              Sign-in is handled through Google OAuth. We never see or store your
              Google password — only the name and email Google shares after you
              approve.
            </p>
          </Section>

          <Section title="Service providers">
            <p>We rely on a small set of processors to run the app:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <strong>Supabase</strong> — database and authentication.
              </li>
              <li>
                <strong>Google</strong> — sign-in (OAuth).
              </li>
              <li>
                <strong>Vercel</strong> — application hosting.
              </li>
              <li>
                <strong>GoldAPI</strong> — live gold prices. No personal or
                financial data is sent; only the metal and currency are requested.
              </li>
            </ul>
            <p>We do not share your data with anyone else, and we never sell it.</p>
          </Section>

          <Section title="Cookies">
            <p>
              We use a single secure session cookie to keep you signed in. There
              are no advertising or third-party tracking cookies.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              You can view and edit all of your data in the app at any time. You
              may request a full export or permanent deletion of your account and
              its data by emailing us — deletion is irreversible.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about privacy? Reach us at{" "}
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
          <Link href="/terms" className="underline-offset-4 hover:underline">
            Terms
          </Link>{" "}
          ·{" "}
          <Link href="/" className="underline-offset-4 hover:underline">
            Sign in
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