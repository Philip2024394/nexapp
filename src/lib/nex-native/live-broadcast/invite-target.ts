// src/lib/nex-native/live-broadcast/invite-target.ts
//
// NEX Live · broadcaster invite-target resolver.
// -----------------------------------------------------------------------------
// Owner directive 2026-10-25 · the Live Message action must initiate the
// existing NEX connection-invitation process (nex_friend_request + the
// contacts page's _friend-request-actions). To do that the viewer needs
// the broadcaster's PUBLIC NEX identity, specifically:
//   · nex_handle · the handle the invitation service accepts (createInvite
//     takes a nex-\d+ string, not a UUID · it resolves to recipient_account_id
//     internally)
//   · display_name · for the panel's profile card
//   · avatar_url · for the panel's profile image (null → initial fallback)
//   · country · for the subtitle under the display name (best-effort from
//     locale or phone_country_code · null when unknown)
//
// This file does NOT:
//   · Create any new table.
//   · Change the invitation service, its 24h/72h rules, or its RLS.
//   · Introduce a parallel invitation pipeline.

import "server-only";
import { getAccountById } from "../account-service";
import { getProfileByAccountId } from "../account-profile-service";
import type { NexUuid } from "../types";

/** The minimum identity surface the MessagePanel needs to render a profile
 *  card AND submit a `createFriendRequestAction(nexHandle, intro)`. */
export interface InviteTarget {
  readonly accountId: NexUuid;
  readonly nexHandle: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  /** Best-effort country tag · ISO 3166 alpha-2 uppercase when derivable
   *  from `nex_account.phone_country_code` or `nex_account.locale` ·
   *  null when unknown. We never fabricate a country · an unknown value
   *  is rendered as absent in the UI. */
  readonly country: string | null;
}

const PHONE_CC_TO_COUNTRY: Readonly<Record<string, string>> = {
  // Minimal · the most common NEX markets. Extend as needed. The service
  // falls back to `null` for any CC not listed here · never guesses.
  "+62": "ID",
  "+60": "MY",
  "+65": "SG",
  "+66": "TH",
  "+63": "PH",
  "+84": "VN",
  "+1": "US",
  "+44": "GB",
  "+61": "AU",
  "+91": "IN",
  "+81": "JP",
  "+82": "KR",
  "+86": "CN",
};

function coerceCountry(opts: {
  readonly phoneCountryCode: string | null;
  readonly locale: string | null;
}): string | null {
  if (opts.phoneCountryCode && PHONE_CC_TO_COUNTRY[opts.phoneCountryCode]) {
    return PHONE_CC_TO_COUNTRY[opts.phoneCountryCode]!;
  }
  // locale like "en-ID" or "id-ID" · take the region tag after the hyphen.
  if (opts.locale) {
    const parts = opts.locale.split("-");
    if (parts.length === 2 && /^[A-Z]{2}$/i.test(parts[1]!)) {
      return parts[1]!.toUpperCase();
    }
  }
  return null;
}

/**
 * Resolve an account into an invite-target the Live Message panel can
 * render. Returns `null` when the account has no public `nex_handle`
 * (invitation would be impossible · caller should disable the Message
 * CTA) OR when the account does not exist.
 *
 * Fail-closed: throws on database errors so the caller surfaces the
 * failure honestly rather than silently rendering a stale card.
 */
export async function resolveInviteTarget(
  accountId: NexUuid,
): Promise<InviteTarget | null> {
  const account = await getAccountById(accountId);
  if (!account) return null;
  if (typeof account.nex_handle !== "string" || account.nex_handle.length === 0) {
    // No public handle · the viewer cannot send an invite via
    // `createFriendRequestAction(nex_handle, ...)` because the handle
    // doesn't exist. Caller should disable the Message pill.
    return null;
  }

  // Profile is OPTIONAL · a brand-new account has nex_account but no
  // nex_account_profile yet. We fail-open to null fields in that case.
  const profile = await getProfileByAccountId(accountId).catch(() => null);

  return {
    accountId: account.id,
    nexHandle: account.nex_handle,
    displayName: account.display_name,
    avatarUrl: profile?.avatar_url ?? null,
    country: coerceCountry({
      phoneCountryCode: account.phone_country_code,
      locale: account.locale,
    }),
  };
}
