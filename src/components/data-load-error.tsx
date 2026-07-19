"use client";

import { useRouter } from "next/navigation";
import { CloudOff } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shown when the initial server-side data load fails — so a backend error reads
 * as a clear error (with retry), never as an empty account.
 */
export function DataLoadError() {
  const router = useRouter();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CloudOff className="size-6" />
      </span>
      <div>
        <h2 className="display text-2xl tracking-tight">Couldn&apos;t load your data</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          We couldn&apos;t reach the server. Your data is safe — this is just a
          loading problem. Please try again.
        </p>
      </div>
      <Button onClick={() => router.refresh()}>Try again</Button>
    </div>
  );
}
