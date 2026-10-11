// src/lib/nex-native/community/membership-service.ts
//
// NEX Community Noticeboard · membership + notification preference service.
//
// A membership is one row per nex_account. It links the account to a
// confirmed hyperlocal zone + its district zone, and records the user's
// notification preference. The directive requires explicit confirmation
// — this service only writes on an explicit call from the UI's "Confirm"
// action, never auto-provisions.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";
import type {
  NexCommunityMembershipRow,
  NexCommunityNotificationPref,
} from "./types";
import { getZoneById, resolveDistrictFor } from "./zone-service";

/** Load the current account's membership row, or null if the user has
 *  not yet confirmed a zone. */
export async function getMembershipForAccount(
  accountId: NexUuid,
): Promise<NexCommunityMembershipRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `community-membership-service.getMembershipForAccount(${accountId}) · ${error.message}`,
    );
  }
  return (data as NexCommunityMembershipRow) ?? null;
}

/** Confirm (or re-confirm) the account's membership. Idempotent per
 *  (account_id); re-calling updates hyperlocal_zone_id. The district
 *  zone is derived from the hyperlocal zone's ancestor chain. */
export async function confirmMembership(input: {
  accountId: NexUuid;
  hyperlocalZoneId: NexUuid;
  notificationPreference?: NexCommunityNotificationPref;
}): Promise<NexCommunityMembershipRow> {
  const zone = await getZoneById(input.hyperlocalZoneId);
  if (!zone) {
    throw new Error(
      `community-membership-service.confirmMembership · hyperlocal zone ${input.hyperlocalZoneId} not found`,
    );
  }
  const district = await resolveDistrictFor(zone);
  const notificationPreference = input.notificationPreference ?? "urgent_only";

  const now = new Date().toISOString();
  const payload = {
    account_id: input.accountId,
    hyperlocal_zone_id: zone.id,
    district_zone_id: district.id,
    confirmed_at: now,
    notification_preference: notificationPreference,
    updated_at: now,
  };

  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .upsert(payload, { onConflict: "account_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `community-membership-service.confirmMembership · ${error.message}`,
    );
  }
  return data as NexCommunityMembershipRow;
}

/** Update only the notification preference for an existing membership.
 *  Throws if no membership exists (caller must confirmMembership first). */
export async function updateNotificationPreference(input: {
  accountId: NexUuid;
  preference: NexCommunityNotificationPref;
}): Promise<NexCommunityMembershipRow> {
  const existing = await getMembershipForAccount(input.accountId);
  if (!existing) {
    throw new Error(
      `community-membership-service.updateNotificationPreference · no membership for ${input.accountId}`,
    );
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .update({
      notification_preference: input.preference,
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", input.accountId)
    .select("*")
    .single();
  if (error) {
    throw new Error(
      `community-membership-service.updateNotificationPreference · ${error.message}`,
    );
  }
  return data as NexCommunityMembershipRow;
}

/** Delete the membership entirely. Used by "leave community". Does not
 *  delete the user's authored notices (they stay authored by the account).
 */
export async function leaveCommunity(accountId: NexUuid): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .delete()
    .eq("account_id", accountId);
  if (error) {
    throw new Error(
      `community-membership-service.leaveCommunity · ${error.message}`,
    );
  }
}
