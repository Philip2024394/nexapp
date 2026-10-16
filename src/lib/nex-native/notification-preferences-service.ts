// src/lib/nex-native/notification-preferences-service.ts
//
// Stage 3 · Notification preferences service · sealed 2026-10-15.
// --------------------------------------------------------------
// Reads and writes nex_account_notification_prefs (migration 198).
// Companion to the sealed push-subscription-service (migration 098):
// subscription-service tracks WHICH devices to deliver to; this
// service tracks WHETHER to deliver per category.
//
// Doctrine (owner-approved 2026-10-15):
//   · Categories: message · call · reaction · mention · marketing
//   · Defaults: ON for the first four · OFF for marketing (opt-IN consent)
//   · Row absence = all defaults applied here · first explicit toggle
//     INSERTs the row with the full default set plus the patch applied
//   · Service failure is NOT silently defaulted · the service THROWS
//     and the dispatch service fails CLOSED (saved OFF always wins)
//
// Authorisation lives in the server action (session-check happens in
// updateNotificationPrefsAction) · this service trusts the caller to
// pass the correct account_id. Same pattern as sealed friend-service.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export type NotificationCategory =
  | "message"
  | "call"
  | "reaction"
  | "mention"
  | "marketing";

export interface NotificationPrefs {
  readonly message_enabled: boolean;
  readonly call_enabled: boolean;
  readonly reaction_enabled: boolean;
  readonly mention_enabled: boolean;
  readonly marketing_enabled: boolean;
}

/** Sealed defaults applied when a row does not yet exist for the
 *  account. Changing these requires an owner-signed consent-doctrine
 *  revision (migration 198 doctrine comment is the regression anchor). */
export const DEFAULT_PREFS: NotificationPrefs = {
  message_enabled: true,
  call_enabled: true,
  reaction_enabled: true,
  mention_enabled: true,
  marketing_enabled: false,
};

/** Field name per category. Prevents the dispatch service from
 *  constructing field names from untrusted strings. */
export function categoryField(
  category: NotificationCategory,
): keyof NotificationPrefs {
  switch (category) {
    case "message":
      return "message_enabled";
    case "call":
      return "call_enabled";
    case "reaction":
      return "reaction_enabled";
    case "mention":
      return "mention_enabled";
    case "marketing":
      return "marketing_enabled";
  }
}

interface NotificationPrefsRow {
  account_id: NexUuid;
  message_enabled: boolean;
  call_enabled: boolean;
  reaction_enabled: boolean;
  mention_enabled: boolean;
  marketing_enabled: boolean;
  updated_at: string;
}

/**
 * Read the preferences for `accountId`. Row absence returns
 * `DEFAULT_PREFS` · database errors THROW so the dispatch service can
 * fail closed. Pure of session · session-check belongs in the action.
 */
export async function getNotificationPrefs(
  accountId: NexUuid,
): Promise<NotificationPrefs> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account_notification_prefs")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `notification-preferences-service.getNotificationPrefs: ${error.message}`,
    );
  }
  if (!data) {
    return DEFAULT_PREFS;
  }
  const row = data as NotificationPrefsRow;
  return {
    message_enabled: row.message_enabled,
    call_enabled: row.call_enabled,
    reaction_enabled: row.reaction_enabled,
    mention_enabled: row.mention_enabled,
    marketing_enabled: row.marketing_enabled,
  };
}

/**
 * Convenience: is this specific category enabled? Row absence falls
 * through to defaults · database errors propagate.
 */
export async function isCategoryEnabled(
  accountId: NexUuid,
  category: NotificationCategory,
): Promise<boolean> {
  const prefs = await getNotificationPrefs(accountId);
  return prefs[categoryField(category)];
}

/**
 * Patch one or more preference fields. Upserts the row · first write
 * materialises the full default set plus the patch. Database errors
 * throw. Returns the full updated preferences.
 */
export async function updateNotificationPrefs(
  accountId: NexUuid,
  patch: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  const current = await getNotificationPrefs(accountId);
  const next: NotificationPrefs = {
    message_enabled: patch.message_enabled ?? current.message_enabled,
    call_enabled: patch.call_enabled ?? current.call_enabled,
    reaction_enabled: patch.reaction_enabled ?? current.reaction_enabled,
    mention_enabled: patch.mention_enabled ?? current.mention_enabled,
    marketing_enabled: patch.marketing_enabled ?? current.marketing_enabled,
  };
  const { error } = await nexSupabaseAdmin
    .from("nex_account_notification_prefs")
    .upsert(
      {
        account_id: accountId,
        message_enabled: next.message_enabled,
        call_enabled: next.call_enabled,
        reaction_enabled: next.reaction_enabled,
        mention_enabled: next.mention_enabled,
        marketing_enabled: next.marketing_enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id" },
    );
  if (error) {
    throw new Error(
      `notification-preferences-service.updateNotificationPrefs: ${error.message}`,
    );
  }
  return next;
}
