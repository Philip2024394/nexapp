// src/lib/nex-native/app/session-or-guest.ts
//
// NEX guest-mode foundation · Phase 0 of the first-time experience.
// -----------------------------------------------------------------
// Sibling of `resolveNexAppSessionFromContext()` that explicitly models
// the two states a visitor can be in — authenticated or guest — rather
// than conflating "no session" with "redirect". Pages opt into guest-
// mode by calling THIS helper instead of the redirecting one.
//
// Load-bearing rules:
//   · The underlying session resolution is UNCHANGED. We delegate to
//     the sealed `resolveNexAppSessionFromContext()` and only widen the
//     return shape. There is no second authentication path.
//   · Pages that must stay sealed (Vault · Chat · Settings · Contacts ·
//     Calls · Onboarding · Manage) continue to call the redirecting
//     helper. Opening those up to guests is NOT a goal of Phase 0.
//   · `kind` is a string literal so TypeScript narrows exhaustively
//     inside server components — guards against the "forgot to check
//     kind" bug that lets guest data slip past.
//   · The guest branch carries NO account data. Any server-only
//     personalisation (industry hint, zone hint, preferred language)
//     must come from cookies or geo hints, not from `account`.
//
// Doctrine references:
//   · Identity Doctrine · UUID-only session anchor.
//   · Wave 3 §7 · service-role never leaves the server.

import "server-only";
import {
  resolveNexAppSessionFromContext,
  type NexAppSession,
} from "./session";

export type NexAppSessionOrGuest =
  | { kind: "session"; session: NexAppSession }
  | { kind: "guest" };

/** Resolve the current viewer as EITHER an authenticated session OR a
 *  guest. Call this from any page that is willing to render for both.
 *
 *  Server components can switch render based on `result.kind`:
 *
 *      const viewer = await resolveNexAppSessionOrGuest();
 *      if (viewer.kind === "session") {
 *        // authenticated · load personal data
 *      } else {
 *        // guest · public preview
 *      }
 *
 *  Pages that must stay sealed continue to use
 *  `resolveNexAppSessionFromContext()` + a `redirect("/sign-in")`. */
export async function resolveNexAppSessionOrGuest(): Promise<NexAppSessionOrGuest> {
  const session = await resolveNexAppSessionFromContext();
  if (session) return { kind: "session", session };
  return { kind: "guest" };
}

/** Convenience · returns true when the current viewer is NOT signed in.
 *  Equivalent to `(await resolveNexAppSessionOrGuest()).kind === "guest"`
 *  but reads nicer at call sites that only care about one branch. */
export async function isGuestViewer(): Promise<boolean> {
  const v = await resolveNexAppSessionOrGuest();
  return v.kind === "guest";
}
