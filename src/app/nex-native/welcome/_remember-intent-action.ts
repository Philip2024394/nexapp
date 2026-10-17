"use server";

// src/app/nex-native/welcome/_remember-intent-action.ts
//
// NEX welcome · remember-intent · 2026-10-15.
// -----------------------------------------------------------------------------
// Owner-authorised intent persistence · the fix for the previous
// acceptance-item-3 limitation ("Selected option persists through
// account creation").
//
// Flow:
//   1. A guest viewing /nex-native/welcome taps one of the three
//      chat-NEX landscape cards (Chat Themes · Chat Themes Shop ·
//      Personalised Chat).
//   2. The card is a <form action={rememberWelcomeIntentAction}>
//      with hidden `intent` and `redirect_to` inputs. Submitting
//      POSTs here.
//   3. This action sets a short-lived HTTP-only cookie
//      `nex_welcome_intent` with the intent value, then redirects
//      the viewer to the whitelisted `redirect_to` destination
//      (currently /nex-native/chat-themes-library for all three
//      cards · the only guest-safe destination).
//   4. The cookie survives the subsequent /create-account signup
//      chain · `createNexAccountAction` doesn't clear app cookies,
//      and Supabase auth cookies are separate.
//   5. After signup, `/create-account/pick-theme` reads the cookie,
//      surfaces the intent to the user (banner + no pre-selection
//      bypass of the existing picker), and CLEARS the cookie so it
//      doesn't apply twice.
//
// Guardrails this module respects:
//   · No DB column, no migration, no completion flag.
//   · Cookie is HTTP-only · not readable from client JS · not a
//     tracking identifier · only carries the single-value intent.
//   · Max-Age 24h · cookie self-expires if the user abandons signup.
//   · Path = "/" so the cookie survives the /create-account subtree
//     where pick-theme reads it.
//   · The redirect_to whitelist matches the welcome-honesty.test.ts
//     allowlist · no open-redirect surface.
//
// Constants and the pure guard live in _welcome-intent.ts (plain
// module) because a "use server" file can only export async
// functions. Both files are consumed by welcome/page.tsx AND
// create-account/pick-theme/page.tsx.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  WELCOME_INTENT_COOKIE,
  isWelcomeIntent,
} from "./_welcome-intent";

/** Server Action bound in each welcome-card form.
 *
 *  Reads two FormData keys:
 *   · `intent`      · one of the WELCOME_INTENT_TOKENS
 *   · `redirect_to` · must match the welcome-honesty allowlist
 *
 *  Both inputs are server-whitelisted · adversarial values redirect
 *  safely to /chat-themes-library without setting the cookie. */
export async function rememberWelcomeIntentAction(
  formData: FormData,
): Promise<never> {
  const rawIntent = String(formData.get("intent") ?? "").trim();
  const rawRedirect = String(formData.get("redirect_to") ?? "").trim();

  // Whitelist · mirrors the sealed welcome-honesty allowlist. Any
  // other value is treated as "no persistence" and the user still
  // lands on the themes library (the overwhelming guest-safe default).
  //
  // Canonical-directory doctrine 2026-10-17 · the competing
  // /nex-native/discover surface is retired · its intent persistence
  // slot is replaced by /nex-native/directory/landing (the one
  // canonical NEX Directory entry). The /discover URL continues to
  // work via server-side redirect, but the welcome allowlist points
  // directly at the canonical destination to avoid an unnecessary hop.
  const safeRedirects: readonly string[] = [
    "/nex-native/chat-themes-library",
    "/nex-native/directory/landing",
    "/nex-native/community/feed",
  ] as const;
  const redirectTo = safeRedirects.includes(rawRedirect)
    ? rawRedirect
    : "/nex-native/chat-themes-library";

  if (isWelcomeIntent(rawIntent)) {
    const cookieJar = await cookies();
    cookieJar.set({
      name: WELCOME_INTENT_COOKIE,
      value: rawIntent,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours · auto-expires if signup abandoned
    });
  }

  redirect(redirectTo);
}
