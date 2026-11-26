// src/lib/nex-native/account-wall/consume-and-apply.ts
//
// CYCLE 14 · GAP-C14-002 · shared server-only pending-account-wall
// consumer · 2026-11-25 · owner-approved Fix A with shared implementation.
// ---------------------------------------------------------------------------
// Three callers share this module so the pick-theme (and any future
// account-wall) replay logic lives in exactly ONE place:
//
//   · `createNexAccountAction`  (`src/app/nex-native/_actions.ts`)
//       Invoked immediately after a successful Supabase signUp AND
//       after `accountService.createAccount` has provisioned a
//       `nex_account` row for the new user.
//   · `signInAction`            (`src/app/nex-native/_actions.ts`)
//       Invoked immediately after a successful signInWithPassword so an
//       EXISTING user who arrived at the wall via a guest-mode modal is
//       routed back to their intended action.
//   · `/nex-native/post-signup-apply/route.ts`
//       Retained Cycle-13 Route Handler. Used for direct browser
//       navigation (bookmark · back-nav · stale cookie replay attempts)
//       and the Sec-Fetch-Site / Origin cross-origin defences.
//
// Why a shared module (owner directive 2026-11-25 Cycle-14):
//   · Avoids duplicated security logic (theme-id shape guard · premium
//     entitlement defence-in-depth · one-shot cookie clear).
//   · Guarantees signup, sign-in, AND direct navigation consume the
//     cookie in exactly the same way so race conditions between the
//     paths resolve to the same final theme / destination.
//   · Lets the Cycle-13 Route Handler stay intact as the direct-nav
//     surface while the server-action path no longer needs to redirect
//     to a Route Handler URL (the Next.js 16 client-router treats such
//     a redirect as an RSC navigation that stalls · GAP-C14-002).
//
// One-shot behaviour notes:
//   · `consumePendingAccountWall` reads AND clears the cookie in one
//     call. A failed theme apply still consumes the cookie · the cookie
//     is CLEARED on both success and failure so an attacker cannot
//     replay a stale pick-theme after a transient DB failure.
//   · A failed theme apply NEVER produces an `?applied=1` destination.
//     On failure the caller is told to redirect to a safe non-applied
//     URL (`/nex-native/contacts`) so the authenticated viewer does not
//     render a misleading "Theme applied" toast.
//   · Concurrent duplicate submits (e.g. the user double-taps the
//     signup button) land on separate server-action invocations · the
//     first winner consumes the cookie · the second sees no cookie and
//     returns `null` from this function · the caller continues its
//     normal post-auth flow (contacts). Idempotent at the DB level
//     because `updateChatTheme` is a plain UPDATE on the same account.
//
// Scope sealed by Founder 2026-11-25:
//   · Handles `pick-theme` only. Other registered actions redirect-only
//     (future expansion path: carry their replay logic into this module
//     rather than growing another parallel implementation).
//   · Premium-theme entitlement gate mirrors `updateChatThemeAction`
//     and the Route Handler.
//   · No cookie is consumed before successful authentication · callers
//     invoke this ONLY after their auth check has passed and they have
//     a valid `accountId`.

import "server-only";
import { consumePendingAccountWall } from "./pending-action";
import * as accountService from "@/lib/nex-native/account-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import {
  canAccessChatTheme,
  loadThemesPlusUntil,
} from "@/lib/nex-native/library/entitlement-service";

/** Outcome returned to the caller. The caller is responsible for the
 *  actual `redirect(...)` because that must happen in the caller's
 *  server-action scope to get the proper Set-Cookie + action-redirect
 *  semantics on the single HTTP response. */
export interface AccountWallConsumeResult {
  /** Local path the caller should redirect to (always starts with
   *  `/nex-native/`). Validated via `isAllowedNextUrl` upstream at
   *  cookie-set time, re-validated here via `consumePendingAccountWall`'s
   *  decode step. */
  redirectTo: string;
  /** True when the authoritative theme write succeeded. The caller uses
   *  this to decide whether the destination URL should carry
   *  `?applied=1`. False when the apply failed, the payload was
   *  invalid, the entitlement gate rejected, or the action was not
   *  `pick-theme`. */
  applied: boolean;
}

/** Minimum-shape guard for a theme id payload. Mirrors the 200-char cap
 *  enforced by the cookie encoder and the regex in the Route Handler.
 *  Authoritative validation of theme membership happens inside
 *  `accountService.updateChatTheme`. */
function isPlausibleThemeId(payload: string | null | undefined): payload is string {
  if (typeof payload !== "string") return false;
  if (payload.length < 1 || payload.length > 64) return false;
  return /^[a-z0-9][a-z0-9\-_]*$/.test(payload);
}

/** Read + consume the pending-account-wall cookie, apply the recorded
 *  action authoritatively against `accountId`, and return the
 *  validated destination URL (plus whether an apply actually happened,
 *  so the caller can decide on `?applied=1`).
 *
 *  Returns `null` when no pending cookie is present. Callers must
 *  continue their normal post-auth flow in that case.
 *
 *  Callers MUST invoke this only AFTER authentication has succeeded
 *  and only with a real `accountId` · this function never checks
 *  auth itself.
 */
export async function consumeAndApplyPendingAccountWall(
  accountId: string,
): Promise<AccountWallConsumeResult | null> {
  // One-shot consume. Cookie is cleared from the browser on this
  // response regardless of what comes next (defence against stale
  // replay even on apply failure).
  const pending = await consumePendingAccountWall();
  if (!pending) return null;

  // Non-pick-theme actions are redirect-only · nothing to apply, just
  // forward to the validated destination. Keep cookie cleared.
  if (pending.action !== "pick-theme") {
    return { redirectTo: pending.nextUrl, applied: false };
  }

  const themeId = pending.payload;
  if (!isPlausibleThemeId(themeId)) {
    // Tampered / truncated payload · safe fallback, no apply happened
    // so no `?applied=1` on the destination.
    return { redirectTo: "/nex-native/contacts", applied: false };
  }

  // Premium-entitlement gate · defence-in-depth against a tampered
  // cookie carrying a premium theme id. Matches the Route Handler's
  // identical check so direct-nav AND server-action flows reject
  // in the same way.
  try {
    const row = await chatThemeService.getThemeById(themeId);
    if (row && row.tier !== "gratis") {
      const themesPlusUntil = await loadThemesPlusUntil(accountId);
      const decision = await canAccessChatTheme(
        { id: row.id, tier: row.tier as "gratis" | "bisnis" | "pro" },
        { id: accountId, themes_plus_until: themesPlusUntil },
      );
      if (!decision.allow) {
        const qs = new URLSearchParams({
          e: "premium_required",
          m: `${row.name} requires NEX Themes Plus`,
        });
        return {
          redirectTo: `/nex-native/chat-themes-library?${qs.toString()}`,
          applied: false,
        };
      }
    }
  } catch {
    // Unknown id · `updateChatTheme` is authoritative below · fall
    // through so the apply attempt itself decides.
  }

  // Authoritative apply. If this throws, DO NOT return an
  // `?applied=1` destination · the user must never see a misleading
  // toast after a silent write failure.
  try {
    await accountService.updateChatTheme(accountId, themeId);
  } catch {
    return { redirectTo: "/nex-native/contacts", applied: false };
  }

  return { redirectTo: pending.nextUrl, applied: true };
}
