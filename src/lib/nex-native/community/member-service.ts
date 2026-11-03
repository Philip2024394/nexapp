// src/lib/nex-native/community/member-service.ts
//
// NEX Community · member operations (add, remove, flag).
// Owner-authorised 2026-11-03.
//
// Backs the add-contact-to-community flow + the flag-member flow:
//   · addMemberByContact · one NEX user adds another to a community
//     (contact must have NO existing membership in that specific zone)
//   · removeMemberIfAuthorised · only the adder (or an HQ action after
//     an upheld flag) can remove · self-removal from an added-only
//     membership would strand the community in weird state
//   · flagMember · any community peer can flag · reason text required
//     (10-500 chars) · HQ receives pending flag · can direct-chat
//     either party
//
// Server-only. Uses the sealed nexSupabaseAdmin service-role client.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";

export type MemberStatus = "active" | "flagged" | "suspended" | "removed";

export interface NexCommunityMembershipFull {
  readonly id: NexUuid;
  readonly account_id: NexUuid;
  readonly hyperlocal_zone_id: NexUuid;
  readonly district_zone_id: NexUuid;
  readonly status: MemberStatus;
  readonly added_by_account_id: NexUuid | null;
  readonly confirmed_at: string;
}

export interface NexCommunityMemberFlagRow {
  readonly id: NexUuid;
  readonly community_zone_id: NexUuid;
  readonly flagged_account_id: NexUuid;
  readonly flagger_account_id: NexUuid;
  readonly reason: string;
  readonly status: "pending" | "reviewed" | "upheld" | "dismissed";
  readonly reviewed_by_account_id: NexUuid | null;
  readonly reviewed_at: string | null;
  readonly admin_note: string | null;
  readonly created_at: string;
}

/** Add a NEX contact to a community the ADDER already belongs to.
 *  Preconditions enforced server-side:
 *    1. Adder has an ACTIVE membership in the community
 *    2. Target has NO existing membership in THAT community
 *    3. Both accounts exist
 *  The new row records added_by_account_id = adderAccountId so only
 *  the adder (or HQ) can later remove the target. */
export async function addMemberByContact(input: {
  readonly adderAccountId: NexUuid;
  readonly contactAccountId: NexUuid;
  readonly communityZoneId: NexUuid;
}): Promise<
  | { readonly ok: true; readonly membershipId: NexUuid }
  | {
      readonly ok: false;
      readonly reason:
        | "self_add"
        | "adder_not_member"
        | "contact_already_member"
        | "contact_not_found"
        | "zone_not_found";
    }
> {
  if (input.adderAccountId === input.contactAccountId) {
    return { ok: false, reason: "self_add" };
  }

  // Adder must have active membership
  const { data: adderMembership, error: adderErr } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .select("id, status")
    .eq("account_id", input.adderAccountId)
    .eq("hyperlocal_zone_id", input.communityZoneId)
    .maybeSingle();
  if (adderErr) {
    throw new Error(`member-service.addMemberByContact.adderCheck · ${adderErr.message}`);
  }
  if (!adderMembership || adderMembership.status !== "active") {
    return { ok: false, reason: "adder_not_member" };
  }

  // Contact must exist
  const { data: contact, error: contactErr } = await nexSupabaseAdmin
    .from("nex_account")
    .select("id")
    .eq("id", input.contactAccountId)
    .maybeSingle();
  if (contactErr) {
    throw new Error(`member-service.addMemberByContact.contactCheck · ${contactErr.message}`);
  }
  if (!contact) return { ok: false, reason: "contact_not_found" };

  // Contact must NOT already be in THIS community
  const { data: existing, error: existingErr } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .select("id")
    .eq("account_id", input.contactAccountId)
    .eq("hyperlocal_zone_id", input.communityZoneId)
    .maybeSingle();
  if (existingErr) {
    throw new Error(`member-service.addMemberByContact.existingCheck · ${existingErr.message}`);
  }
  if (existing) return { ok: false, reason: "contact_already_member" };

  // Resolve district (zone chain · reuse zone-service)
  const { getZoneById, resolveDistrictFor } = await import("./zone-service");
  const zone = await getZoneById(input.communityZoneId);
  if (!zone) return { ok: false, reason: "zone_not_found" };
  const district = await resolveDistrictFor(zone);

  const now = new Date().toISOString();
  const { data: inserted, error: insErr } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .insert({
      account_id: input.contactAccountId,
      hyperlocal_zone_id: zone.id,
      district_zone_id: district.id,
      confirmed_at: now,
      notification_preference: "urgent_only",
      safety_pref: "urgent_only",
      lost_found_pref: "urgent_only",
      events_pref: "off",
      voting_pref: "off",
      life_news_pref: "off",
      updated_at: now,
      added_by_account_id: input.adderAccountId,
      status: "active",
    })
    .select("id")
    .single();
  if (insErr) {
    throw new Error(`member-service.addMemberByContact.insert · ${insErr.message}`);
  }
  return { ok: true, membershipId: inserted.id as NexUuid };
}

/** Remove a member from a community. Only the ADDER (or an HQ action
 *  after an upheld flag) can remove · owner directive 2026-11-03.
 *  Self-removal is a separate action (future · leave community). */
export async function removeMemberIfAuthorised(input: {
  readonly actorAccountId: NexUuid;
  readonly memberAccountId: NexUuid;
  readonly communityZoneId: NexUuid;
}): Promise<
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "not_authorised"
        | "member_not_found";
    }
> {
  const { data: mem, error: readErr } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .select("id, added_by_account_id, status")
    .eq("account_id", input.memberAccountId)
    .eq("hyperlocal_zone_id", input.communityZoneId)
    .maybeSingle();
  if (readErr) {
    throw new Error(`member-service.removeMember.read · ${readErr.message}`);
  }
  if (!mem) return { ok: false, reason: "member_not_found" };

  // Authorisation: either the adder, or the actor IS the member (self-leave).
  // HQ-driven removal happens via a separate HQ action path.
  const isAdder =
    mem.added_by_account_id !== null &&
    mem.added_by_account_id === input.actorAccountId;
  const isSelf = input.actorAccountId === input.memberAccountId;
  if (!isAdder && !isSelf) {
    return { ok: false, reason: "not_authorised" };
  }

  const { error: delErr } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .delete()
    .eq("id", mem.id);
  if (delErr) {
    throw new Error(`member-service.removeMember.delete · ${delErr.message}`);
  }
  return { ok: true };
}

/** Flag a member in a community. Reason text REQUIRED (10-500 chars).
 *  Flagger identity is PRIVATE to NEX staff per sealed Community
 *  doctrine 2026-10-23. Flag transitions the member's status to
 *  'flagged' until HQ action. */
export async function flagMember(input: {
  readonly flaggerAccountId: NexUuid;
  readonly flaggedAccountId: NexUuid;
  readonly communityZoneId: NexUuid;
  readonly reason: string;
}): Promise<
  | { readonly ok: true; readonly flagId: NexUuid }
  | {
      readonly ok: false;
      readonly reason:
        | "self_flag"
        | "flagger_not_member"
        | "flagged_not_member"
        | "reason_too_short"
        | "reason_too_long";
    }
> {
  if (input.flaggerAccountId === input.flaggedAccountId) {
    return { ok: false, reason: "self_flag" };
  }
  const reasonTrimmed = input.reason.trim();
  if (reasonTrimmed.length < 10) return { ok: false, reason: "reason_too_short" };
  if (reasonTrimmed.length > 500) return { ok: false, reason: "reason_too_long" };

  // Both parties must be members of the community
  const { data: both, error: bothErr } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .select("account_id, status")
    .eq("hyperlocal_zone_id", input.communityZoneId)
    .in("account_id", [input.flaggerAccountId, input.flaggedAccountId]);
  if (bothErr) {
    throw new Error(`member-service.flagMember.membershipCheck · ${bothErr.message}`);
  }
  const flaggerRow = both?.find((r) => r.account_id === input.flaggerAccountId);
  const flaggedRow = both?.find((r) => r.account_id === input.flaggedAccountId);
  if (!flaggerRow || flaggerRow.status !== "active") {
    return { ok: false, reason: "flagger_not_member" };
  }
  if (!flaggedRow) return { ok: false, reason: "flagged_not_member" };

  // Insert flag
  const { data: flag, error: insErr } = await nexSupabaseAdmin
    .from("nex_community_member_flag")
    .insert({
      community_zone_id: input.communityZoneId,
      flagged_account_id: input.flaggedAccountId,
      flagger_account_id: input.flaggerAccountId,
      reason: reasonTrimmed,
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr) {
    throw new Error(`member-service.flagMember.insert · ${insErr.message}`);
  }

  // Transition membership status to 'flagged' (pending HQ review)
  await nexSupabaseAdmin
    .from("nex_community_membership")
    .update({ status: "flagged", updated_at: new Date().toISOString() })
    .eq("account_id", input.flaggedAccountId)
    .eq("hyperlocal_zone_id", input.communityZoneId);

  return { ok: true, flagId: flag.id as NexUuid };
}

/** List pending flags across all communities · HQ pill count source. */
export async function listPendingFlags(): Promise<NexCommunityMemberFlagRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_member_flag")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`member-service.listPendingFlags · ${error.message}`);
  }
  return (data as NexCommunityMemberFlagRow[]) ?? [];
}

/** Pending-flag count · for HQ pill badge. */
export async function countPendingFlags(): Promise<number> {
  const { count, error } = await nexSupabaseAdmin
    .from("nex_community_member_flag")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) {
    throw new Error(`member-service.countPendingFlags · ${error.message}`);
  }
  return count ?? 0;
}

/** HQ review action · upheld (remove member) OR dismissed (clear flag). */
export async function reviewFlag(input: {
  readonly flagId: NexUuid;
  readonly reviewerAccountId: NexUuid;
  readonly decision: "upheld" | "dismissed";
  readonly adminNote?: string | null;
}): Promise<
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "flag_not_found" | "already_reviewed" }
> {
  const { data: flag, error: readErr } = await nexSupabaseAdmin
    .from("nex_community_member_flag")
    .select("id, status, flagged_account_id, community_zone_id")
    .eq("id", input.flagId)
    .maybeSingle();
  if (readErr) {
    throw new Error(`member-service.reviewFlag.read · ${readErr.message}`);
  }
  if (!flag) return { ok: false, reason: "flag_not_found" };
  if (flag.status !== "pending") return { ok: false, reason: "already_reviewed" };

  const now = new Date().toISOString();
  await nexSupabaseAdmin
    .from("nex_community_member_flag")
    .update({
      status: input.decision,
      reviewed_by_account_id: input.reviewerAccountId,
      reviewed_at: now,
      admin_note: input.adminNote ?? null,
    })
    .eq("id", flag.id);

  // Transition membership status based on decision
  if (input.decision === "upheld") {
    // Remove member from community
    await nexSupabaseAdmin
      .from("nex_community_membership")
      .delete()
      .eq("account_id", flag.flagged_account_id)
      .eq("hyperlocal_zone_id", flag.community_zone_id);
  } else {
    // Dismissed · clear the 'flagged' status back to 'active'
    await nexSupabaseAdmin
      .from("nex_community_membership")
      .update({ status: "active", updated_at: now })
      .eq("account_id", flag.flagged_account_id)
      .eq("hyperlocal_zone_id", flag.community_zone_id);
  }

  return { ok: true };
}
