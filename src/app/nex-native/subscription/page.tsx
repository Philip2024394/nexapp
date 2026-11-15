// src/app/nex-native/subscription/page.tsx
//
// NEX subscription root · honest redirect to the actual billing hub.
// -----------------------------------------------------------------
// Owner-authorised 2026-11-16 (Stream C · B4 gap-closure).
//
// Why this file exists
// -----------------------------------------------------------------
// Prior to this pass there was NO page.tsx at `/nex-native/subscription`.
// Any request to that bare folder path fell through the Next.js route
// tree and resolved against the sibling `/[businessSlug]` catch-all
// segment · which called `notFound()` because no shop owns the slug
// "subscription". Result: a legitimate billing bookmark produced a
// 404. The audit logged this as gap B4.
//
// Chosen fix · option (b) · server redirect
// -----------------------------------------------------------------
// The real billing hub lives at `/nex-native/settings/tier` (the
// sealed Package & billing surface · see src/app/nex-native/settings/
// tier/page.tsx). The complementary surfaces at
// `/nex-native/subscription/cancel` and `/nex-native/subscription/
// return` are post-Stripe-Checkout redirects that MUST stay intact ·
// this file does NOT touch them.
//
// Instead of hand-building a thin landing page that would duplicate
// the honest-cancel / no-hidden-fees TrustBlocks already shown by the
// tier page, the root does a 307 redirect so there is exactly one
// authoritative surface for current-plan status. A 307 (not 308) is
// used because the tier page has side-effects (reads the account row
// + may seed trial state on first view) so caches must re-resolve.
//
// What this preserves
// -----------------------------------------------------------------
//   · /nex-native/subscription/cancel  unchanged · Stripe cancel URL
//   · /nex-native/subscription/return  unchanged · Stripe success URL
//   · Every /nex-native/settings/tier contract stays intact
//
// What callers see
// -----------------------------------------------------------------
//   GET /nex-native/subscription  → 307 → /nex-native/settings/tier
//
// Tested manually via `curl -I http://localhost:3008/nex-native/subscription`
// should emit `HTTP/1.1 307` + `location: /nex-native/settings/tier`.

import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SubscriptionRootPage(): Promise<never> {
  // Next's `redirect()` throws · control never returns · the return
  // type is Promise<never>. Not a permanentRedirect because the
  // destination page is itself dynamic (session-gated, DB-read).
  redirect("/nex-native/settings/tier");
}
