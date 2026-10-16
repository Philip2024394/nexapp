// src/lib/nex-native/privacy-preferences-service.ts
//
// R10 Stage 5 · Privacy preferences service · 2026-10-15.
// --------------------------------------------------------------
// Reads privacy preferences from nex_account (columns added by
// migration 200 · NOT YET APPLIED). The sealed peer-conversation-
// service and future profile-reader surfaces consult this module to
// decide whether to permit conversation creation or expose profile
// data.
//
// Doctrine (owner-approved 2026-10-15):
//   · profile_visibility default 'public' · matches existing product
//     behaviour · do NOT silently restrict existing users
//   · who_can_message default 'everyone' · matches existing behaviour
//   · Fail-closed · a service-layer error falls through to the
//     PRIVACY-MAXIMUM shape (private + contacts). Same discipline as
//     chat-preferences-service.
//   · Row absence · when columns are not yet applied, reads return
//     the SEALED DEFAULTS (public + everyone). This keeps the
//     application running against today's schema and ready for
//     migration 200.
//   · is_discoverable stays SEPARATE on nex_account_profile
//     (migration 134) · this service does NOT read or write it.
//
// Enforcement caveats surfaced honestly:
//   · who_can_message · fully enforceable today via
//     peer-conversation-service.getOrCreatePeerConversation gate
//   · profile_visibility · enforceable at the specific account-reader
//     paths that pass a viewer identity. Public directory/search
//     surfaces that do not identify a viewer rely on
//     is_discoverable (nex_account_profile RLS) · profile_visibility
//     is additive privacy for signed-in viewers.
//
// Authorisation lives at the caller · session-check happens in the
// server action · this service trusts the caller.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import { areContacts } from "./chat-preferences-service";
import type { NexUuid } from "./types";

export type ProfileVisibility = "public" | "contacts" | "private";
export type WhoCanMessage = "everyone" | "contacts";

export interface PrivacyPreferences {
  readonly profile_visibility: ProfileVisibility;
  readonly who_can_message: WhoCanMessage;
}

/** Sealed defaults · match existing product behaviour · owner directive
 *  2026-10-15. Changing these defaults requires a sealed doctrine
 *  revision + explicit migration-of-existing-users plan. */
export const DEFAULT_PRIVACY_PREFS: PrivacyPreferences = {
  profile_visibility: "public",
  who_can_message: "everyone",
};

/** Privacy-maximum shape returned on fail-closed. An unreachable
 *  service must never relax a user's saved intent. */
const PRIVACY_MAXIMUM_PREFS: PrivacyPreferences = {
  profile_visibility: "private",
  who_can_message: "contacts",
};

function narrowVisibility(raw: unknown): ProfileVisibility {
  if (raw === "public" || raw === "contacts" || raw === "private") {
    return raw;
  }
  return DEFAULT_PRIVACY_PREFS.profile_visibility;
}

function narrowWhoCanMessage(raw: unknown): WhoCanMessage {
  if (raw === "everyone" || raw === "contacts") {
    return raw;
  }
  return DEFAULT_PRIVACY_PREFS.who_can_message;
}

export async function getPrivacyPreferences(
  accountId: NexUuid,
): Promise<PrivacyPreferences> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select("profile_visibility, who_can_message")
    .eq("id", accountId)
    .maybeSingle();
  if (error) {
    throw new Error(`privacy-preferences-service.get: ${error.message}`);
  }
  if (!data) {
    return DEFAULT_PRIVACY_PREFS;
  }
  const row = data as { profile_visibility: unknown; who_can_message: unknown };
  return {
    profile_visibility: narrowVisibility(row.profile_visibility),
    who_can_message: narrowWhoCanMessage(row.who_can_message),
  };
}

/**
 * Fail-closed variant for enforcement paths · never throws · falls
 * through to PRIVACY-MAXIMUM on service-layer error. Use this from
 * peer-conversation-service and profile-reader paths.
 */
export async function getPrivacyPreferencesSafe(
  accountId: NexUuid,
): Promise<PrivacyPreferences> {
  try {
    return await getPrivacyPreferences(accountId);
  } catch {
    return PRIVACY_MAXIMUM_PREFS;
  }
}

export async function updatePrivacyPreferences(
  accountId: NexUuid,
  patch: Partial<PrivacyPreferences>,
): Promise<PrivacyPreferences> {
  const current = await getPrivacyPreferences(accountId);
  const next: PrivacyPreferences = {
    profile_visibility: patch.profile_visibility ?? current.profile_visibility,
    who_can_message: patch.who_can_message ?? current.who_can_message,
  };
  const { error } = await nexSupabaseAdmin
    .from("nex_account")
    .update(next)
    .eq("id", accountId);
  if (error) {
    throw new Error(`privacy-preferences-service.update: ${error.message}`);
  }
  return next;
}

/**
 * Enforcement helper for peer-conversation-service.
 *
 * Decides whether `sender` is permitted to initiate (or re-open) a
 * conversation with `recipient` based on the recipient's
 * `who_can_message` preference.
 *
 * Returns a discriminated result:
 *   { allowed: true } → caller may proceed
 *   { allowed: false, reason: "recipient_contacts_only" } → caller
 *     must surface this to the sender UI (localised copy)
 *
 * The sender's own preferences are not consulted · it is the
 * recipient's choice that gates inbound conversations.
 */
export async function canSenderInitiateConversation(
  senderAccountId: NexUuid,
  recipientAccountId: NexUuid,
): Promise<{ allowed: true } | { allowed: false; reason: "recipient_contacts_only" }> {
  if (senderAccountId === recipientAccountId) return { allowed: true };
  const prefs = await getPrivacyPreferencesSafe(recipientAccountId);
  if (prefs.who_can_message === "everyone") return { allowed: true };
  // 'contacts' · require accepted friend edge
  const isContact = await areContacts(senderAccountId, recipientAccountId);
  if (isContact) return { allowed: true };
  return { allowed: false, reason: "recipient_contacts_only" };
}

/**
 * Enforcement helper for profile-reader paths.
 *
 * Resolves whether `viewer` is permitted to read `profileOwner`'s
 * profile data based on the owner's `profile_visibility`.
 *
 * Returns a 3-way result so the caller can respond correctly:
 *   { visible: true } → caller may expose the profile
 *   { visible: false, response: "404" } → private profile · the
 *     caller MUST return 404 (not 403) to prevent enumeration
 *   { visible: false, response: "limited" } → contacts-only visibility
 *     and viewer is not a contact · the caller should return a
 *     minimal profile (no sensitive fields) · exact shape is defined
 *     by the caller
 */
export async function resolveProfileVisibilityForViewer(
  viewerAccountId: NexUuid | null,
  profileOwnerAccountId: NexUuid,
): Promise<
  | { visible: true }
  | { visible: false; response: "404" }
  | { visible: false; response: "limited" }
> {
  // Owner can always see their own profile.
  if (viewerAccountId === profileOwnerAccountId) return { visible: true };

  const prefs = await getPrivacyPreferencesSafe(profileOwnerAccountId);
  if (prefs.profile_visibility === "public") return { visible: true };

  if (prefs.profile_visibility === "private") {
    // 404 for all non-owners · owner directive to prevent enumeration.
    return { visible: false, response: "404" };
  }

  // 'contacts' · check viewer-is-contact relationship (requires an
  // authenticated viewer; null viewers can never be a contact).
  if (!viewerAccountId) return { visible: false, response: "limited" };
  const isContact = await areContacts(viewerAccountId, profileOwnerAccountId);
  return isContact ? { visible: true } : { visible: false, response: "limited" };
}
