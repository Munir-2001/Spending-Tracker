"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRIVACY_EVENT, isPrivacyOn, setPrivacy } from "@/lib/privacy";

/**
 * Header switch for "screenshot mode" (blurs every monetary figure). The
 * load-time {@link PrivacyGate} sets the initial state, so this only reflects
 * and flips it — it listens for `privacychange` so its icon stays in sync when
 * the gate (or another tab) changes the setting.
 */
export function PrivacyToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const sync = () => setOn(isPrivacyOn());
    sync();
    window.addEventListener(PRIVACY_EVENT, sync);
    return () => window.removeEventListener(PRIVACY_EVENT, sync);
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9 text-muted-foreground"
      onClick={() => setPrivacy(!isPrivacyOn())}
      aria-label={on ? "Show amounts" : "Hide amounts"}
      title={on ? "Show amounts" : "Hide amounts (screenshot mode)"}
    >
      {on ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
    </Button>
  );
}
