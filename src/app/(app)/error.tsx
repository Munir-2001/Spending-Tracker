"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the authenticated app. Next redacts the real error message
 * on the client in production (only a `digest` survives) and logs the detail
 * server-side — so we intentionally never render `error.message`/`error.stack`,
 * just a generic message + retry.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in the browser console only as Next's redacted value in prod.
    console.error("App error", error.digest);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="display text-2xl tracking-tight">Something went wrong</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        We hit an unexpected error. It&apos;s been logged on our side — please try
        again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
