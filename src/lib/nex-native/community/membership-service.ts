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
  NexCommunityEventsPref,
  NexCommunityLifeNewsPref,
  NexCommunityMembershipRow,
  NexCommunityNotificationPref,
  NexCommunityVotingPref,
} from "./types";

/** Phase 2A · partial per-section preference input used by the
 *  settings page to patch any subset of the five section columns. */
export interface NexCommunityPreferencePatch {
  safety_pref?: NexCommunityNotificationPref;
  lost_found_pref?: NexCommunityNotificationPref;
  events_pref?: NexCommunityEventsPref;
  voting_pref?: NexCommunityVotingPref;
  life_news_pref?: NexCommunityLifeNewsPref;
}
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
 *  zone is derived from the hyperlocal zone's ancestor chain.
 *
 *  Phase 2A · writes both the legacy single-column `notification_preference`
 *  AND the per-section safety_pref/lost_found_pref so the data is
 *  consistent while legacy readers remain. Other sections (events,
 *  voting, life_news) default 'off'. */
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
    safety_pref: notificationPreference,
    lost_found_pref: notificationPreference,
    events_pref: "off" as NexCommunityEventsPref,
    voting_pref: "off" as NexCommunityVotingPref,
    life_news_pref: "off" as NexCommunityLifeNewsPref,
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

/** Legacy single-column preference update · writes both the legacy
 *  column AND the two active-section columns (safety + lost_found) so
 *  the per-section data remains consistent for old callers.
 *  Reserved sections (events/voting/life_news) are NOT touched. */
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
      safety_pref: input.preference,
      lost_found_pref: input.preference,
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

/** Phase 2A · patch any subset of the per-section preference columns.
 *  Does not touch the deprecated single-column notification_preference. */
export async function patchSectionPreferences(input: {
  accountId: NexUuid;
  patch: NexCommunityPreferencePatch;
}): Promise<NexCommunityMembershipRow> {
  const existing = await getMembershipForAccount(input.accountId);
  if (!existing) {
    throw new Error(
      `community-membership-service.patchSectionPreferences · no membership for ${input.accountId}`,
    );
  }
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.patch.safety_pref !== undefined) update.safety_pref = input.patch.safety_pref;
  if (input.patch.lost_found_pref !== undefined) update.lost_found_pref = input.patch.lost_found_pref;
  if (input.patch.events_pref !== undefined) update.events_pref = input.patch.events_pref;
  if (input.patch.voting_pref !== undefined) update.voting_pref = input.patch.voting_pref;
  if (input.patch.life_news_pref !== undefined) update.life_news_pref = input.patch.life_news_pref;

  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .update(update)
    .eq("account_id", input.accountId)
    .select("*")
    .single();
  if (error) {
    throw new Error(
      `community-membership-service.patchSectionPreferences · ${error.message}`,
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
