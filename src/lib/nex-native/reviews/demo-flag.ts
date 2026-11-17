// src/lib/nex-native/reviews/demo-flag.ts
//
// NEX · Reviews demo · flag detection.
// Owner-authorised 2026-11-16 · MOCK-ONLY checkpoint.
// -----------------------------------------------------------------
// The review-demo mock store is explicitly off in production.
// Two activation paths · both require explicit opt-in:
//
//   1. URL query param   ?reviewDemo=1   (per-visit · survives
//      navigation via sessionStorage once seen).
//   2. Build-time env var NEXT_PUBLIC_NEX_REVIEW_DEMO=1 (always-on
//      in that build · intentionally unset in production).
//
// Invariant · when neither is set the store exports a sealed
// no-op adapter (count: 0, listForProduct: []) so no mock rows or
// mock orders ever reach a real user.

export const REVIEW_DEMO_QUERY_KEY = "reviewDemo";
export const REVIEW_DEMO_SESSION_KEY = "nex.reviewDemo.enabled";
const ENV_REVIEW_DEMO = "NEXT_PUBLIC_NEX_REVIEW_DEMO";

/** Server-side / initial render default · always safe (off). The
 *  client-side effect in `ReviewStoreProvider` promotes it to true
 *  when the query param or sessionStorage flag is set. */
export function initialDemoFlag(): boolean {
  // Build-time env bake — `process.env` is replaced at compile time
  // for NEXT_PUBLIC_* in the Next.js bundler so this works in both
  // server and client runtimes. Guard against the undefined case
  // (prod builds without the var set).
  if (typeof process !== "undefined") {
    const v = process.env[ENV_REVIEW_DEMO];
    if (v === "1" || v === "true") return true;
  }
  return false;
}

/** Client-only · inspects the current URL + sessionStorage. Call
 *  from inside a React effect — never during render. */
export function detectClientDemoFlag(): boolean {
  if (typeof window === "undefined") return false;

  // Honour the env override first so a QA build is always on.
  if (initialDemoFlag()) return true;

  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get(REVIEW_DEMO_QUERY_KEY);
    if (q === "1" || q === "true") {
      // Persist for the rest of the tab session so navigating to a
      // product page from the drawer doesn't lose the flag.
      window.sessionStorage.setItem(REVIEW_DEMO_SESSION_KEY, "1");
      return true;
    }
    const s = window.sessionStorage.getItem(REVIEW_DEMO_SESSION_KEY);
    if (s === "1") return true;
  } catch {
    // Storage disabled · fall through to off.
  }
  return false;
}

/** The product preview route always ships with the demo on so the
 *  sealed layout mock stays truthful. Called by the preview page. */
export function forcePreviewDemoFlag(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(REVIEW_DEMO_SESSION_KEY, "1");
  } catch {
    // No-op · preview survives without persistence too.
  }
}
