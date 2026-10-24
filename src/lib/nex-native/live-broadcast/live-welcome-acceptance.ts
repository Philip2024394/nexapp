// src/lib/nex-native/live-broadcast/live-welcome-acceptance.ts
//
// Owner directive 2026-10-24 · device-local persistence helpers for
// the "Welcome to NEX LIVE" page acceptance.
//
// Scope · HONEST:
//   · This is a `localStorage` flag · it is device-scoped, not
//     account-scoped. Clearing site data, using a different browser,
//     or opening the app on another device re-shows the welcome page.
//   · Final per-account persistence (so the agreement travels with
//     the user and can be enforced server-side) requires a nex_account
//     column + a server action · out of scope at this moment.
//
// Separated from the UI so the route component + the LiveViewerFooter
// click interceptor can both check acceptance without a React import.

export const LIVE_WELCOME_STORAGE_KEY = "nex-live-welcome-seen";

export function hasAcceptedLiveWelcome(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LIVE_WELCOME_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markLiveWelcomeAccepted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LIVE_WELCOME_STORAGE_KEY, "1");
  } catch {
    /* storage disabled · silent · the welcome page will reappear */
  }
}

export function clearLiveWelcomeAcceptance(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LIVE_WELCOME_STORAGE_KEY);
  } catch {
    /* silent */
  }
}
