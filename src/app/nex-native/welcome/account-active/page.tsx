// src/app/nex-native/welcome/account-active/page.tsx
//
// Signup-flow celebration · the user chose "Skip for now" on the
// shop onboarding landing (/manage/shop/start?from=signup).
// Owner directive 2026-11-12.
//
// NEX-024 · owner-sealed 2026-11-24 · one-time onboarding semantics
// added. The celebration screen must render ONCE for a newly-activated
// account on this device, then step aside on every subsequent sign-in.
//
// Honest-state guarantees:
//   · Authentication is required · unauthenticated visits still bounce
//     to /sign-in (existing behaviour · preserved).
//   · "Actual activation state" is proven by the Supabase session
//     itself · email+password accounts do not receive a session until
//     the confirmation link has been followed, so `resolveSessionWith
//     DevOverride() !== null` already proves email-confirmed + active.
//     We do NOT invent a separate "activation state" check here that
//     could pass or fail out of step with the session.
//   · One-time gate is an HttpOnly cookie (30d). A user re-signing in
//     on the same device inside the window gets redirected straight to
//     contacts. First-ever hit on this device paints the celebration,
//     records the cookie, and continues to work when the user taps
//     "Enter NEX →" on the WelcomeShell.
//   · Device-local semantics acknowledged · a new device or cleared
//     site data will show the celebration again. That is correct for
//     today · promoting to account-level persistence requires a new
//     `nex_account.onboarding_seen_at` column which has NOT been
//     applied and is NOT authorised for this work.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  hasSeenAccountActive,
  markAccountActiveSeen,
} from "@/lib/nex-native/onboarding/account-active-seen";
import { WelcomeShell } from "../_welcome-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AccountActiveWelcomePage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");

  // NEX-024 · one-time semantics. If the celebration was already shown
  // on this device inside the 30-day window, step aside to the normal
  // signed-in landing (contacts) · identical to the sign-in bounce.
  if (await hasSeenAccountActive()) {
    redirect("/nex-native/contacts");
  }

  // First visit · record the "seen" marker before rendering so a
  // reload does NOT re-paint the celebration. Cookie is HttpOnly so
  // client JS cannot forge it.
  await markAccountActiveSeen();

  return (
    <WelcomeShell
      headline="Congratulations · your NEX account is active"
      subtitle="You can open a shop any time from the drawer · for now, the NEX chat world is yours to explore."
    />
  );
}
