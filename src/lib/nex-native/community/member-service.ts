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

/** HQ review action · upheld (remove member) OR dismissed (clear flag).
 *  Also writes to nex_hq_action_log (migration 254) for audit trail
 *  per owner-sealed admin discipline. */
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
    .select("id, status, flagged_account_id, community_zone_id, flagger_account_id")
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

  if (input.decision === "upheld") {
    await nexSupabaseAdmin
      .from("nex_community_membership")
      .delete()
      .eq("account_id", flag.flagged_account_id)
      .eq("hyperlocal_zone_id", flag.community_zone_id);
  } else {
    await nexSupabaseAdmin
      .from("nex_community_membership")
      .update({ status: "active", updated_at: now })
      .eq("account_id", flag.flagged_account_id)
      .eq("hyperlocal_zone_id", flag.community_zone_id);
  }

  // Audit log · best-effort, non-fatal
  await writeHqActionLog({
    actorAccountId: input.reviewerAccountId,
    action:
      input.decision === "upheld"
        ? "community_member_flag_upheld"
        : "community_member_flag_dismissed",
    subjectAccountId: flag.flagged_account_id,
    communityZoneId: flag.community_zone_id,
    note: input.adminNote ?? null,
  }).catch(() => {
    /* non-fatal · review already committed */
  });

  return { ok: true };
}

/** HQ-direct remove · admin can remove a member without a pending flag.
 *  Logs to nex_hq_action_log with the admin note (required · explains why). */
export async function hqRemoveMember(input: {
  readonly actorAccountId: NexUuid;
  readonly memberAccountId: NexUuid;
  readonly communityZoneId: NexUuid;
  readonly note: string;
}): Promise<
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "member_not_found" | "note_too_short" }
> {
  const trimmed = input.note.trim();
  if (trimmed.length < 10) return { ok: false, reason: "note_too_short" };

  const { data: mem, error: readErr } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .select("id")
    .eq("account_id", input.memberAccountId)
    .eq("hyperlocal_zone_id", input.communityZoneId)
    .maybeSingle();
  if (readErr) throw new Error(`member-service.hqRemoveMember.read · ${readErr.message}`);
  if (!mem) return { ok: false, reason: "member_not_found" };

  await nexSupabaseAdmin
    .from("nex_community_membership")
    .delete()
    .eq("id", mem.id);

  await writeHqActionLog({
    actorAccountId: input.actorAccountId,
    action: "community_member_removed_by_hq",
    subjectAccountId: input.memberAccountId,
    communityZoneId: input.communityZoneId,
    note: trimmed,
  }).catch(() => {
    /* non-fatal */
  });

  return { ok: true };
}

/** HQ-direct delete community · soft action · just removes the zone
 *  row (seeded reference data stays protected via FK RESTRICT when
 *  members exist · HQ must remove all members first OR a future
 *  cascade-safe variant). For now hard-DELETE only if member count is 0. */
export async function hqDeleteCommunity(input: {
  readonly actorAccountId: NexUuid;
  readonly communityZoneId: NexUuid;
  readonly note: string;
}): Promise<
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "zone_not_found" | "has_members" | "note_too_short" }
> {
  const trimmed = input.note.trim();
  if (trimmed.length < 10) return { ok: false, reason: "note_too_short" };

  const { count, error: countErr } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .select("*", { count: "exact", head: true })
    .eq("hyperlocal_zone_id", input.communityZoneId);
  if (countErr) throw new Error(`member-service.hqDeleteCommunity.count · ${countErr.message}`);
  if ((count ?? 0) > 0) return { ok: false, reason: "has_members" };

  // Soft-archive · set archived_at rather than DELETE so audit joins
  // can still resolve the zone name post-removal.
  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await nexSupabaseAdmin
    .from("nex_community_zone")
    .update({ archived_at: now })
    .eq("id", input.communityZoneId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (updateErr) throw new Error(`member-service.hqDeleteCommunity.update · ${updateErr.message}`);
  if (!updated) return { ok: false, reason: "zone_not_found" };

  await writeHqActionLog({
    actorAccountId: input.actorAccountId,
    action: "community_zone_archived_by_hq",
    communityZoneId: input.communityZoneId,
    note: trimmed,
  }).catch(() => {
    /* non-fatal */
  });

  return { ok: true };
}

/** HQ-direct create community · admin can add a new zone (future scope
 *  for user-defined pods · currently just creates a hyperlocal under
 *  Ireland country). */
export async function hqCreateCommunity(input: {
  readonly actorAccountId: NexUuid;
  readonly name: string;
  readonly parentZoneId: NexUuid;
  readonly level: "district" | "neighbourhood" | "ward";
}): Promise<
  | { readonly ok: true; readonly zoneId: NexUuid }
  | { readonly ok: false; readonly reason: "parent_not_found" | "name_too_short" | "name_too_long" }
> {
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, reason: "name_too_short" };
  if (name.length > 80) return { ok: false, reason: "name_too_long" };

  const { data: parent, error: parentErr } = await nexSupabaseAdmin
    .from("nex_community_zone")
    .select("id, country")
    .eq("id", input.parentZoneId)
    .is("archived_at", null)
    .maybeSingle();
  if (parentErr) throw new Error(`member-service.hqCreateCommunity.parent · ${parentErr.message}`);
  if (!parent) return { ok: false, reason: "parent_not_found" };

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  const { data: inserted, error: insErr } = await nexSupabaseAdmin
    .from("nex_community_zone")
    .insert({
      parent_zone_id: input.parentZoneId,
      country: (parent as { country: string }).country,
      level: input.level,
      name,
      slug,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(`member-service.hqCreateCommunity.insert · ${insErr.message}`);

  await writeHqActionLog({
    actorAccountId: input.actorAccountId,
    action: "community_zone_created_by_hq",
    communityZoneId: inserted.id as NexUuid,
    note: `created "${name}" under parent ${input.parentZoneId} (level=${input.level})`,
  }).catch(() => {
    /* non-fatal */
  });

  return { ok: true, zoneId: inserted.id as NexUuid };
}

// ─── nex_hq_action_log writer · owner-sealed audit trail ─────────────
// Uses the actual migration 254 schema:
//   actor_account_id · action · reason · metadata (jsonb) · created_at
// Fire-and-forget · a missing table (254 unapplied) or CHECK violation
// (269 action enum unapplied) logs a warn but never propagates up to
// break the primary action.
async function writeHqActionLog(input: {
  readonly actorAccountId: NexUuid;
  readonly action: string;
  readonly subjectAccountId?: NexUuid | null;
  readonly communityZoneId?: NexUuid | null;
  readonly note?: string | null;
}): Promise<void> {
  const payload = {
    actor_account_id: input.actorAccountId,
    action: input.action,
    reason: input.note ?? null,
    metadata: {
      subject_account_id: input.subjectAccountId ?? null,
      community_zone_id: input.communityZoneId ?? null,
    },
  };
  const { error } = await nexSupabaseAdmin
    .from("nex_hq_action_log")
    .insert(payload);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `[hq-action-log] write failed · non-fatal · ${error.message}`,
    );
  }
}
