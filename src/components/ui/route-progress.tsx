"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { loader } from "@/lib/loader";
import { cn } from "@/lib/utils";

/**
 * A slim top-of-page progress bar (our own — no dependency). It runs on route
 * navigations (link click → trickle, pathname change → finish) and on any
 * `loader.start()/done()` from a major async operation.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (trickle.current) clearInterval(trickle.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (safety.current) clearTimeout(safety.current);
    trickle.current = hideTimer.current = safety.current = null;
  };

  const finish = useCallback(() => {
    clearTimers();
    setProgress(100);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 260);
  }, []);

  const begin = useCallback(() => {
    clearTimers();
    setVisible(true);
    setProgress((p) => (p > 0 && p < 90 ? p : 8));
    // Ease toward 90% while we wait, never quite reaching it.
    trickle.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + (90 - p) * 0.14 : p));
    }, 180);
    // Safety: never leave the bar stuck if a nav never completes.
    safety.current = setTimeout(() => finish(), 8000);
  }, [finish]);

  // Major operations (import, transfer, …) drive the bar via the loader store.
  useEffect(
    () => loader.subscribe((active) => (active ? begin() : finish())),
    [begin, finish]
  );

  // Start on internal link clicks (left-click, no modifier, same-tab).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const anchor = (e.target as HTMLElement)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        !href.startsWith("/") ||
        anchor.getAttribute("target") === "_blank" ||
        href === pathname
      )
        return;
      begin();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, begin]);

  // Finish whenever the path actually changes.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    finish();
  }, [pathname, finish]);

  useEffect(() => clearTimers, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[2.5px]"
      role="progressbar"
      aria-label="Loading"
    >
      <div
        className={cn(
          "h-full bg-primary transition-[width,opacity] duration-200 ease-out",
          "shadow-[0_0_10px_var(--primary),0_0_5px_var(--primary)]"
        )}
        style={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }}
      />
    </div>
  );
}
