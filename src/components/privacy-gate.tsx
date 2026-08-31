"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setPrivacy } from "@/lib/privacy";

/**
 * Load-time privacy gate. Renders OPEN by default (so it's in the server HTML
 * and covers the app from the very first paint — amounts are never exposed on
 * load), and asks whether to blur amounts before revealing anything. Because the
 * layout persists across client navigations, it appears once per full app load,
 * which is exactly "whenever the app loads."
 */
export function PrivacyGate() {
  const [open, setOpen] = useState(true);

  // Defence-in-depth: while the choice is pending, keep amounts blurred behind
  // the (already opaque) overlay in case anything peeks through during hydration.
  useEffect(() => {
    if (open) document.documentElement.classList.add("privacy");
  }, [open]);

  if (!open) return null;

  function choose(blur: boolean) {
    setPrivacy(blur);
    setOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6"
    >
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground">
          <ShieldCheck className="size-6" />
        </div>
        <div className="space-y-2">
          <h2 id="privacy-gate-title" className="display text-2xl">
            Hide your numbers?
          </h2>
          <p className="text-sm text-muted-foreground">
            Blur every balance and amount so nobody nearby can read your finances.
            You can switch it any time with the eye icon in the top bar.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button size="lg" className="w-full gap-2" onClick={() => choose(true)}>
            <EyeOff className="size-[18px]" />
            Blur amounts
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="w-full gap-2 text-muted-foreground"
            onClick={() => choose(false)}
          >
            <Eye className="size-[18px]" />
            Show amounts
          </Button>
        </div>
      </div>
    </div>
  );
}
