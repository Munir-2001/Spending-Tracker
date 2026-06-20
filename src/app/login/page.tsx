"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success the browser is redirected to Google, so no further code runs.
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Mark />
          </span>
          <h1 className="display mt-5 text-3xl tracking-tight">Ledger</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Accounting-grade spending, beautifully simple. Sign in to continue.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-border/60 bg-card p-6">
          <Button
            onClick={signInWithGoogle}
            disabled={loading}
            variant="outline"
            className="h-11 w-full gap-2.5 text-sm"
          >
            <GoogleIcon />
            {loading ? "Redirecting…" : "Continue with Google"}
          </Button>
          {error && (
            <p className="mt-3 text-center text-xs text-expense">{error}</p>
          )}
          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
            By continuing you agree this is your personal finance workspace.
          </p>
        </div>
      </div>
    </main>
  );
}

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="2" y="7.4" width="8" height="2.2" rx="1.1" fill="currentColor" opacity="0.7" />
      <rect x="2" y="11.3" width="10.5" height="2.2" rx="1.1" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}
