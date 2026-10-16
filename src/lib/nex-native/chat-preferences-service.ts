// src/lib/nex-native/chat-preferences-service.ts
//
// R9 Stage 4 · Chat privacy preferences service · 2026-10-15.
// --------------------------------------------------------------
// Reads chat privacy preferences from nex_account (columns added by
// migration 199 · NOT YET APPLIED to the live database as of this
// commit). The sealed message/typing/presence services call into this
// module to decide whether to persist, broadcast, or expose signals.
//
// Doctrine (owner-approved 2026-10-15):
//   · Reciprocal read receipts · OFF on either side suppresses the
//     signal both ways. Implemented by gating on BOTH sender and
//     recipient at the write + expose paths.
//   · Fail-closed · a database error here falls through to the
//     PRIVACY-MAXIMUM shape (receipts=false · typing=false ·
//     last_seen='nobody' · online='nobody'). An unreachable prefs
//     service must never relax a user's saved intent. Same fail-closed
//     discipline as R8 Notifications dispatch.
//   · Row absence · when the live database does not yet have migration
//     199 applied, every column read will produce `null`. We treat
//     every null column as the SEALED DEFAULT (receipts=true ·
//     typing=true · last_seen='nobody' · online='nobody'). This keeps
//     the service callable from Day 1 of the application and migration-
//     ready for Day 2.
//
// Authorisation lives at the caller (session resolution happens in
// the server action or the realtime channel entry point). This service
// trusts the caller to pass the correct account_id · same discipline
// as sealed friend-service + notification-preferences-service.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export type VisibilityLevel = "everyone" | "contacts" | "nobody";

export interface ChatPreferences {
  readonly read_receipts_enabled: boolean;
  readonly typing_indicator_enabled: boolean;
  readonly last_seen_visibility: VisibilityLevel;
  readonly online_status_visibility: VisibilityLevel;
}

/** Sealed defaults applied when migration 199 columns are absent OR
 *  when a service-layer read error forces fail-closed. These defaults
 *  were approved by owner directive 2026-10-15 · changing them
 *  requires a sealed doctrine revision. */
export const DEFAULT_CHAT_PREFS: ChatPreferences = {
  read_receipts_enabled: true,
  typing_indicator_enabled: true,
  last_seen_visibility: "nobody",
  online_status_visibility: "nobody",
};

/** Privacy-maximum shape returned on service-layer read failures.
 *  Different from DEFAULT_CHAT_PREFS: this treats every signal as
 *  suppressed. Fail-closed means an unreachable service must never
 *  broadcast a signal the user may have opted out of. */
const PRIVACY_MAXIMUM_PREFS: ChatPreferences = {
  read_receipts_enabled: false,
  typing_indicator_enabled: false,
  last_seen_visibility: "nobody",
  online_status_visibility: "nobody",
};

function narrowVisibility(raw: unknown): VisibilityLevel {
  if (raw === "everyone" || raw === "contacts" || raw === "nobody") {
    return raw;
  }
  return "nobody";
}

function rowToPrefs(row: {
  read_receipts_enabled: unknown;
  typing_indicator_enabled: unknown;
  last_seen_visibility: unknown;
  online_status_visibility: unknown;
}): ChatPreferences {
  return {
    read_receipts_enabled:
      typeof row.read_receipts_enabled === "boolean"
        ? row.read_receipts_enabled
        : DEFAULT_CHAT_PREFS.read_receipts_enabled,
    typing_indicator_enabled:
      typeof row.typing_indicator_enabled === "boolean"
        ? row.typing_indicator_enabled
        : DEFAULT_CHAT_PREFS.typing_indicator_enabled,
    last_seen_visibility: narrowVisibility(row.last_seen_visibility),
    online_status_visibility: narrowVisibility(row.online_status_visibility),
  };
}

/**
 * Read chat preferences for `accountId`. Defaults applied when columns
 * are absent (migration 199 not yet applied) or when the row has null
 * values. Throws on database error so the caller can fail-closed.
 */
export async function getChatPreferences(
  accountId: NexUuid,
): Promise<ChatPreferences> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select(
      "read_receipts_enabled, typing_indicator_enabled, last_seen_visibility, online_status_visibility",
    )
    .eq("id", accountId)
    .maybeSingle();
  if (error) {
    throw new Error(`chat-preferences-service.get: ${error.message}`);
  }
  if (!data) {
    return DEFAULT_CHAT_PREFS;
  }
  return rowToPrefs(data as Parameters<typeof rowToPrefs>[0]);
}

/**
 * Read-only "safe" variant that NEVER throws. On any error returns
 * the PRIVACY-MAXIMUM shape. Call this from service-layer enforcement
 * paths where an exception would otherwise block the primary operation
 * (e.g., sending a message) · the caller still gets a decision, just
 * biased toward privacy.
 *
 * Use `getChatPreferences` for the Settings UI (where the error should
 * surface honestly). Use `getChatPreferencesSafe` for enforcement
 * paths where fail-closed is the correct behaviour.
 */
export async function getChatPreferencesSafe(
  accountId: NexUuid,
): Promise<ChatPreferences> {
  try {
    return await getChatPreferences(accountId);
  } catch {
    return PRIVACY_MAXIMUM_PREFS;
  }
}

/**
 * Patch one or more chat preference fields. Writes directly to
 * nex_account. Caller session-check happens in the server action.
 * Throws on database error · the UI surfaces the error honestly.
 */
export async function updateChatPreferences(
  accountId: NexUuid,
  patch: Partial<ChatPreferences>,
): Promise<ChatPreferences> {
  const current = await getChatPreferences(accountId);
  const next: ChatPreferences = {
    read_receipts_enabled:
      patch.read_receipts_enabled ?? current.read_receipts_enabled,
    typing_indicator_enabled:
      patch.typing_indicator_enabled ?? current.typing_indicator_enabled,
    last_seen_visibility:
      patch.last_seen_visibility ?? current.last_seen_visibility,
    online_status_visibility:
      patch.online_status_visibility ?? current.online_status_visibility,
  };
  const { error } = await nexSupabaseAdmin
    .from("nex_account")
    .update(next)
    .eq("id", accountId);
  if (error) {
    throw new Error(`chat-preferences-service.update: ${error.message}`);
  }
  return next;
}

/**
 * Convenience · are `viewer` and `other` accepted friends? Reads
 * nex_friend_edge via the canonical pair order. Returns false on any
 * error or when no accepted edge exists. Used by "contacts" visibility
 * level enforcement.
 */
export async function areContacts(
  viewer: NexUuid,
  other: NexUuid,
): Promise<boolean> {
  if (viewer === other) return true;
  const [a, b] = viewer < other ? [viewer, other] : [other, viewer];
  const { data, error } = await nexSupabaseAdmin
    .from("nex_friend_edge")
    .select("status")
    .eq("a_account_id", a)
    .eq("b_account_id", b)
    .maybeSingle();
  if (error || !data) return false;
  return (data as { status?: string }).status === "accepted";
}

/**
 * Resolve whether the `viewer` is permitted to see a signal controlled
 * by the owner's `level`. Pure boolean logic:
 *   level='everyone'  → true (any viewer)
 *   level='contacts'  → true iff viewer is an accepted friend
 *   level='nobody'    → false (never visible to any viewer, including
 *                              the owner's own cross-device view)
 */
export async function isVisibleTo(
  ownerAccountId: NexUuid,
  viewerAccountId: NexUuid,
  level: VisibilityLevel,
): Promise<boolean> {
  if (level === "nobody") return false;
  if (level === "everyone") return true;
  // level === "contacts"
  return areContacts(ownerAccountId, viewerAccountId);
}
