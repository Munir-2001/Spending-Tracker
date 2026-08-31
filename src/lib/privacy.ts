/**
 * Privacy ("screenshot") mode — blurs every monetary figure by toggling the
 * `privacy` class on <html> (styles live in globals.css). Centralised here so
 * the load-time gate and the header toggle share one source of truth and stay
 * in sync via the `privacychange` event.
 */

export const PRIVACY_EVENT = "privacychange";
const KEY = "privacy";

/** Blur (on=true) or reveal (on=false) all amounts app-wide, and remember it. */
export function setPrivacy(on: boolean) {
  document.documentElement.classList.toggle(KEY, on);
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // Private browsing / storage disabled — the class still applies this session.
  }
  window.dispatchEvent(new Event(PRIVACY_EVENT));
}

/** Whether amounts are currently blurred. */
export function isPrivacyOn(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains(KEY)
  );
}
