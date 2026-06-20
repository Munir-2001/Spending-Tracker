"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Screenshot mode" — blurs every monetary figure by toggling a `privacy`
 * class on <html>. Pure CSS (see globals.css); preference is remembered.
 */
export function PrivacyToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem("privacy") === "1";
    setOn(v);
    document.documentElement.classList.toggle("privacy", v);
  }, []);

  function toggle() {
    setOn((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("privacy", next);
      localStorage.setItem("privacy", next ? "1" : "0");
      return next;
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9 text-muted-foreground"
      onClick={toggle}
      aria-label={on ? "Show amounts" : "Hide amounts"}
      title={on ? "Show amounts" : "Hide amounts (screenshot mode)"}
    >
      {on ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
    </Button>
  );
}
