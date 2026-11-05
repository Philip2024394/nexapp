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
// Owner-authorised 2026-11-05 iter 27 · commit 2 of the visitor
// identity model. Resolves provisional nex_session cookie set by
// ensureVisitorSession() (commit 1) into a typed `kind: "visitor"`
// state so the drawer identity bar + future CONNECT-gate split
// (commit 4) can read the provisional nex-id.
import {
  readAndVerifyNexSessionCookie,
  loadNexSessionCookieConfigFromEnv,
  loadNexSessionCryptoConfigFromEnv,
  nextCookieAdapter,
} from "../first-conversation/session-cookie";
import { checkSessionValidity } from "../first-conversation/session-registry-service";
import { getAccountById } from "../account-service";

/** Owner-authorised 2026-11-05 iter 27 · minimal visitor identity.
 *  Carries the provisional nex_account id + handle · nothing more.
 *  All write-gates continue to require a real `kind: "session"`.
 *  This state exists between `kind: "guest"` (no cookie, no identity)
 *  and `kind: "session"` (signed-in with Supabase auth link). */
export interface NexVisitorInfo {
  readonly accountId: string;
  /** Sealed nex-NNNNNN handle · may be empty if the DB hasn't yet
   *  allocated one (handles are allocated by a sealed post-insert
   *  trigger · see migration 013). */
  readonly nexHandle: string;
  /** Display name · defaults to "Visitor" for freshly-minted rows. */
  readonly displayName: string;
}

export type NexAppSessionOrGuest =
  | { kind: "session"; session: NexAppSession }
  | { kind: "visitor"; visitor: NexVisitorInfo }
  | { kind: "guest" };

/** Resolve the current viewer as a real session OR a provisional
 *  visitor (cookie-identified but no Supabase auth link) OR a pure
 *  guest (no cookie at all).
 *
 *  Precedence: session > visitor > guest. If the viewer has BOTH a
 *  Supabase auth session AND a legacy visitor cookie, the real
 *  session wins (the visitor cookie is stale pre-signup state).
 *
 *  Server components can switch render based on `result.kind`:
 *
 *      const viewer = await resolveNexAppSessionOrGuest();
 *      if (viewer.kind === "session") {
 *        // authenticated · load personal data
 *      } else if (viewer.kind === "visitor") {
 *        // provisional · show "You're on NEX as nex-xxxxxx"
 *      } else {
 *        // true guest · no cookie yet · bootstrap will mint one
 *      }
 *
 *  Pages that must stay sealed (chat · vault · settings · etc.)
 *  continue to use `resolveNexAppSessionFromContext()` +
 *  `redirect("/sign-in")`. Those routes TREAT visitors as guests
 *  (they're not signed in with a real account), so the redirect
 *  behaviour is unchanged by this commit. */
export async function resolveNexAppSessionOrGuest(): Promise<NexAppSessionOrGuest> {
  const session = await resolveNexAppSessionFromContext();
  if (session) return { kind: "session", session };

  // No real session · try the provisional visitor cookie.
  try {
    const cryptoCfg = loadNexSessionCryptoConfigFromEnv();
    const adapter = await nextCookieAdapter();
    const verified = readAndVerifyNexSessionCookie(adapter, cryptoCfg);
    if (verified && verified.verify.ok) {
      const payload = verified.verify.payload;
      const validity = await checkSessionValidity(
        payload.session_id,
        Date.now(),
      );
      if (validity.valid) {
        const acct = await getAccountById(payload.account_id);
        // Only treat as visitor when the row is UNCLAIMED
        // (supabase_user_id === null) · a claimed row means the user
        // already has a real session elsewhere and we shouldn't
        // silently downgrade them.
        if (acct && acct.supabase_user_id === null) {
          return {
            kind: "visitor",
            visitor: {
              accountId: acct.id,
              nexHandle: acct.nex_handle ?? "",
              displayName: acct.display_name,
            },
          };
        }
      }
    }
  } catch {
    // Any failure in the visitor path falls through to pure guest ·
    // honest · the sealed behaviour for callers before this commit.
  }

  return { kind: "guest" };
}

/** Convenience · returns true when the current viewer is NOT signed
 *  in with a real session. BOTH `kind: "visitor"` and `kind: "guest"`
 *  return true (neither is a real account). Call sites that need to
 *  distinguish should use `resolveNexAppSessionOrGuest()` directly. */
export async function isGuestViewer(): Promise<boolean> {
  const v = await resolveNexAppSessionOrGuest();
  return v.kind !== "session";
}
