"use server";

// src/app/nex-native/_visitor-session-action.ts
//
// Owner-authorised 2026-11-05 iter 27 · commit 1 of the visitor
// identity model. On every /nex-native/* page, a tiny client bootstrap
// invokes this action. If the viewer already has a valid nex_session
// cookie, we no-op. Otherwise we mint a provisional nex_account
// (claimed_at = null) + a nex_session_registry row + a signed cookie.
//
// Reuses the sealed Bridge 99 session primitives:
//   · createAccount (account-service.ts) · zero new fields
//   · createSession (session-registry-service.ts)
//   · writeNexSessionCookie (session-cookie.ts)
//
// Honours Bridge 99 §7 doctrine:
//   · Accounts are created here (a server action), NEVER in the
//     resolver. The resolver stays READ-ONLY.
//   · `claimed_at` default (null) is the single source of truth for
//     "not yet upgraded to real account." No new column.
//   · Cookie attributes come verbatim from
//     loadNexSessionCookieConfigFromEnv (Secure in prod · HttpOnly ·
//     SameSite=Lax · explicit max-age).
//
// Owner directives honoured 2026-11-05:
//   · "No visitor expiry" → we DO use Bridge 99's rolling expiry
//     because that's the sealed cookie contract · but no DB-side
//     purge of the provisional account itself. Cookie lifecycle and
//     account lifecycle are decoupled: cookie can expire (user gets
//     a new one on next visit) · account persists until signup claims
//     it or it's deleted.
//   · "User can view but must create account to interact" → this
//     action creates ONLY the identity. All write-gates (invites,
//     chats, uploads) continue to check for a REAL session (Supabase
//     `auth.users` link via `supabase_user_id`). Visitor accounts
//     have `supabase_user_id = null` so they fail those checks.

import { createAccount } from "@/lib/nex-native/account-service";
import {
  createSession,
  checkSessionValidity,
} from "@/lib/nex-native/first-conversation/session-registry-service";
import {
  writeNexSessionCookie,
  readAndVerifyNexSessionCookie,
  loadNexSessionCookieConfigFromEnv,
  loadNexSessionCryptoConfigFromEnv,
  nextCookieAdapter,
} from "@/lib/nex-native/first-conversation/session-cookie";
import { getAccountById } from "@/lib/nex-native/account-service";

export interface VisitorSessionResult {
  readonly ok: boolean;
  /** Provisional (or already-minted) nex_account id tied to this
   *  visitor's cookie. Empty string on hard failure. */
  readonly accountId: string;
  /** Short handle like "nex-123456" (sealed account format) · empty
   *  string when the account has no nex_handle yet. */
  readonly nexHandle: string;
  /** True when a fresh cookie was minted on this call · false when the
   *  viewer already had a valid session. Used by the UI toast "Welcome
   *  to NEX · you're visiting as nex-xxxxxx" only on first visit. */
  readonly minted: boolean;
}

const EMPTY_RESULT: VisitorSessionResult = {
  ok: false,
  accountId: "",
  nexHandle: "",
  minted: false,
};

export async function ensureVisitorSession(): Promise<VisitorSessionResult> {
  let cryptoCfg;
  let cookieCfg;
  try {
    cryptoCfg = loadNexSessionCryptoConfigFromEnv();
    cookieCfg = loadNexSessionCookieConfigFromEnv();
  } catch {
    // Dev-env missing signing keys · fail silently · the UI just
    // continues to render as unauthenticated-guest (sealed behaviour).
    return EMPTY_RESULT;
  }

  const adapter = await nextCookieAdapter();

  // 1 · Fast path · existing cookie still valid?
  const verified = readAndVerifyNexSessionCookie(adapter, cryptoCfg);
  if (verified && verified.verify.ok) {
    const payload = verified.verify.payload;
    try {
      const validity = await checkSessionValidity(
        payload.session_id,
        Date.now(),
      );
      if (validity.valid) {
        const acct = await getAccountById(payload.account_id);
        return {
          ok: true,
          accountId: payload.account_id,
          nexHandle: acct?.nex_handle ?? "",
          minted: false,
        };
      }
    } catch {
      /* fall through to mint a fresh session */
    }
  }

  // 2 · Mint a fresh provisional account + session + cookie
  let accountId = "";
  let nexHandle = "";
  try {
    const row = await createAccount({
      display_name: "Visitor",
      supabase_user_id: null,
      phone_country_code: null,
      phone_national_number: null,
      chosen_handle: null,
    });
    accountId = row.id;
    nexHandle = row.nex_handle ?? "";
  } catch {
    // DB hiccup · leave the viewer in sealed unauthenticated-guest
    // state · they can still browse (view-only is the sealed default).
    return EMPTY_RESULT;
  }

  try {
    const now = Date.now();
    const session = await createSession({
      account_id: accountId,
      now_ms: now,
    });
    writeNexSessionCookie(
      adapter,
      {
        account_id: accountId,
        session_id: session.session_id,
        issued_at_ms: session.issued_at_ms,
        expires_at_ms: session.expires_at_ms,
      },
      cryptoCfg,
      cookieCfg,
      now,
    );
  } catch {
    // Session/cookie failure · the provisional account row exists in
    // DB but the viewer can't be stamped with it · worst case they
    // get a fresh provisional on next page load. Not fatal.
    return { ok: false, accountId, nexHandle, minted: false };
  }

  return { ok: true, accountId, nexHandle, minted: true };
}
