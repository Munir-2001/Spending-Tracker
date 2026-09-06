"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Kicks off Stripe Checkout for the $0.99 trial (or the annual plan). Posts to
 * `/api/billing/checkout` (Phase 3) and redirects to the returned Checkout URL.
 */
export function StartTrialButton({
  plan,
  children,
  variant,
  className,
}: {
  plan: "trial" | "annual";
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error("checkout unavailable");
      const { url } = (await res.json()) as { url?: string };
      if (!url) throw new Error("no url");
      window.location.href = url;
    } catch {
      toast.error("Checkout isn't available yet. Please try again shortly.");
      setLoading(false);
    }
  }

  return (
    <Button
      size="lg"
      variant={variant}
      className={className}
      onClick={go}
      disabled={loading}
    >
      {loading ? "Starting…" : children}
    </Button>
  );
}
