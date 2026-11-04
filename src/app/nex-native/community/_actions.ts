"use server";

// src/app/nex-native/community/_actions.ts
//
// Server actions for Community Noticeboard forms. All actions resolve the
// session, call the service, and redirect / revalidate.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
// Owner fix 2026-11-05 · select-page uses resolveSessionWithDevOverride
// for its page-level session (matches contacts/free-chat/etc). The
// action must honour the same dev-impersonation path · otherwise forms
// submitted from the page throw "unauthenticated" even though the page
// itself rendered with a resolved session.
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  confirmMembership,
  leaveCommunity,
  updateNotificationPreference,
} from "@/lib/nex-native/community/membership-service";
import {
  appendUpdate,
  confirmNotice,
  createNotice,
  reportNotice,
} from "@/lib/nex-native/community/notice-service";
import {
  NEX_COMMUNITY_NOTICE_CATEGORIES,
  NEX_COMMUNITY_REPORT_REASONS,
  NexCommunityMembershipRequiredError,
  NexCommunityRateLimitError,
  type NexCommunityNoticeCategory,
  type NexCommunityNotificationPref,
  type NexCommunityReportReason,
} from "@/lib/nex-native/community/types";

type ActionResult = { status: "ok" } | { status: "error"; code: string; message?: string };

async function requireAccountId(): Promise<string> {
  const session = await resolveSessionWithDevOverride();
  if (!session) throw new Error("unauthenticated");
  return session.account.id;
}

function toBanner(action: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params);
  return `/nex-native/community/${action}?${qs.toString()}`;
}

export async function confirmMembershipAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  const hyperlocalZoneId = String(formData.get("hyperlocal_zone_id") ?? "");
  const prefRaw = String(formData.get("notification_preference") ?? "urgent_only");
  const pref: NexCommunityNotificationPref =
    prefRaw === "quiet" || prefRaw === "all" || prefRaw === "urgent_only"
      ? prefRaw
      : "urgent_only";
  if (hyperlocalZoneId.length < 10) {
    redirect("/nex-native/community/select?e=bad_zone");
  }
  await confirmMembership({
    accountId,
    hyperlocalZoneId,
    notificationPreference: pref,
  });
  revalidatePath("/nex-native/community", "layout");
  redirect("/nex-native/community/feed");
}

export async function updatePreferenceAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  const prefRaw = String(formData.get("notification_preference") ?? "");
  if (prefRaw !== "quiet" && prefRaw !== "urgent_only" && prefRaw !== "all") {
    redirect("/nex-native/community/settings?e=bad_pref");
  }
  await updateNotificationPreference({
    accountId,
    preference: prefRaw as NexCommunityNotificationPref,
  });
  revalidatePath("/nex-native/community/settings");
  redirect("/nex-native/community/settings?m=preference_saved");
}

export async function leaveCommunityAction(): Promise<void> {
  const accountId = await requireAccountId();
  await leaveCommunity(accountId);
  revalidatePath("/nex-native/community", "layout");
  redirect("/nex-native/community/select?m=left_community");
}

export async function createNoticeAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  const categoryRaw = String(formData.get("category") ?? "");
  const urgencyRaw = String(formData.get("urgency_level") ?? "moderate");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const affectedAreaText = String(formData.get("affected_area_text") ?? "").trim();

  if (!(NEX_COMMUNITY_NOTICE_CATEGORIES as readonly string[]).includes(categoryRaw)) {
    redirect("/nex-native/community/compose?e=bad_category");
  }
  const urgencyLevel: "low" | "moderate" | "urgent" =
    urgencyRaw === "low" || urgencyRaw === "urgent" ? urgencyRaw : "moderate";
  if (title.length === 0 || title.length > 120) {
    redirect("/nex-native/community/compose?e=bad_title");
  }
  if (body.length > 2000) {
    redirect("/nex-native/community/compose?e=bad_body");
  }
  if (affectedAreaText.length > 200) {
    redirect("/nex-native/community/compose?e=bad_area");
  }

  try {
    const notice = await createNotice({
      accountId,
      category: categoryRaw as NexCommunityNoticeCategory,
      urgencyLevel,
      title,
      body: body.length > 0 ? body : null,
      affectedAreaText: affectedAreaText.length > 0 ? affectedAreaText : null,
    });
    revalidatePath("/nex-native/community/feed");
    redirect(`/nex-native/community/notices/${notice.id}`);
  } catch (err) {
    if (err instanceof NexCommunityMembershipRequiredError) {
      redirect("/nex-native/community/select?e=no_membership");
    }
    if (err instanceof NexCommunityRateLimitError) {
      redirect(
        toBanner("compose", {
          e: "rate_limited",
          m: `Max ${err.maxPerWindow} notices per ${err.windowMinutes} min`,
        }),
      );
    }
    throw err;
  }
}

export async function appendUpdateAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  const noticeId = String(formData.get("notice_id") ?? "");
  const updateText = String(formData.get("update_text") ?? "").trim();
  const markResolved = String(formData.get("mark_resolved") ?? "") === "on";
  if (updateText.length === 0 || updateText.length > 1000) {
    redirect(`/nex-native/community/notices/${noticeId}?e=bad_update`);
  }
  try {
    await appendUpdate({
      accountId,
      noticeId,
      updateText,
      markResolved,
      resolutionNote: null,
    });
    revalidatePath(`/nex-native/community/notices/${noticeId}`);
    redirect(`/nex-native/community/notices/${noticeId}`);
  } catch (err) {
    if (err instanceof NexCommunityRateLimitError) {
      redirect(`/nex-native/community/notices/${noticeId}?e=rate_limited`);
    }
    throw err;
  }
}

export async function confirmNoticeAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  const noticeId = String(formData.get("notice_id") ?? "");
  try {
    await confirmNotice({ accountId, noticeId });
    revalidatePath(`/nex-native/community/notices/${noticeId}`);
    redirect(`/nex-native/community/notices/${noticeId}?m=confirmed`);
  } catch (err) {
    if (err instanceof NexCommunityRateLimitError) {
      redirect(`/nex-native/community/notices/${noticeId}?e=rate_limited`);
    }
    const msg = err instanceof Error ? err.message : "unknown";
    if (/author cannot confirm/i.test(msg)) {
      redirect(`/nex-native/community/notices/${noticeId}?e=own_notice`);
    }
    throw err;
  }
}

export async function reportNoticeAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  const noticeId = String(formData.get("notice_id") ?? "");
  const reasonRaw = String(formData.get("reason") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!(NEX_COMMUNITY_REPORT_REASONS as readonly string[]).includes(reasonRaw)) {
    redirect(`/nex-native/community/notices/${noticeId}?e=bad_reason`);
  }
  if (note.length > 500) {
    redirect(`/nex-native/community/notices/${noticeId}?e=bad_note`);
  }
  try {
    await reportNotice({
      reporterAccountId: accountId,
      noticeId,
      reason: reasonRaw as NexCommunityReportReason,
      note: note.length > 0 ? note : null,
    });
    revalidatePath(`/nex-native/community/notices/${noticeId}`);
    redirect(`/nex-native/community/notices/${noticeId}?m=reported`);
  } catch (err) {
    if (err instanceof NexCommunityRateLimitError) {
      redirect(`/nex-native/community/notices/${noticeId}?e=rate_limited`);
    }
    throw err;
  }
}

// ─── Owner directive 2026-11-03 · member-level flow ────────────────
//   addContactToCommunityAction · adds a NEX contact to this user's
//                                 community (contact must have no
//                                 existing membership in THIS zone)
//   removeContactFromCommunityAction · adder-only · unless flagged
//   flagMemberAction · mandatory reason text (10-500 chars)
//   reviewMemberFlagAction · HQ-only · upheld (remove) or dismissed

import {
  addMemberByContact,
  removeMemberIfAuthorised,
  flagMember,
  reviewFlag,
} from "@/lib/nex-native/community/member-service";
import { requireHqAdmin, HqAuthorizationError } from "@/lib/nex-native/hq-authorization";
import {
  createPendingArea,
  approvePendingArea,
  rejectPendingArea,
  mergePendingArea,
} from "@/lib/nex-native/community/zone-service";

export async function addContactToCommunityAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  const contactAccountId = String(formData.get("contact_account_id") ?? "").trim();
  const communityZoneId = String(formData.get("community_zone_id") ?? "").trim();
  if (!contactAccountId || !communityZoneId) {
    redirect("/nex-native/contacts?tab=groups&e=bad_input");
  }

  const result = await addMemberByContact({
    adderAccountId: accountId,
    contactAccountId,
    communityZoneId,
  });
  if (!result.ok) {
    redirect(`/nex-native/contacts?tab=groups&e=${result.reason}`);
  }
  revalidatePath("/nex-native/contacts");
  revalidatePath("/nex-native/community/chat");
  redirect("/nex-native/contacts?tab=groups&m=contact_added");
}

export async function removeContactFromCommunityAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  const memberAccountId = String(formData.get("member_account_id") ?? "").trim();
  const communityZoneId = String(formData.get("community_zone_id") ?? "").trim();
  if (!memberAccountId || !communityZoneId) {
    redirect("/nex-native/contacts?tab=groups&e=bad_input");
  }

  const result = await removeMemberIfAuthorised({
    actorAccountId: accountId,
    memberAccountId,
    communityZoneId,
  });
  if (!result.ok) {
    redirect(`/nex-native/contacts?tab=groups&e=${result.reason}`);
  }
  revalidatePath("/nex-native/contacts");
  revalidatePath("/nex-native/community/chat");
  redirect("/nex-native/contacts?tab=groups&m=contact_removed");
}

export async function flagMemberAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  const flaggedAccountId = String(formData.get("flagged_account_id") ?? "").trim();
  const communityZoneId = String(formData.get("community_zone_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "");
  if (!flaggedAccountId || !communityZoneId) {
    redirect("/nex-native/community/chat?e=bad_input");
  }

  const result = await flagMember({
    flaggerAccountId: accountId,
    flaggedAccountId,
    communityZoneId,
    reason,
  });
  if (!result.ok) {
    redirect(`/nex-native/community/chat?e=${result.reason}`);
  }
  revalidatePath("/nex-native/community/chat");
  redirect("/nex-native/community/chat?m=flag_submitted");
}

export async function reviewMemberFlagAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  try {
    await requireHqAdmin(accountId);
  } catch (err) {
    if (err instanceof HqAuthorizationError) {
      redirect("/nex-native?e=not_hq");
    }
    throw err;
  }

  const flagId = String(formData.get("flag_id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim() as "upheld" | "dismissed";
  const adminNote = String(formData.get("admin_note") ?? "").trim();
  if (!flagId || (decision !== "upheld" && decision !== "dismissed")) {
    redirect("/nex-native/hq/communities?e=bad_input");
  }

  const result = await reviewFlag({
    flagId,
    reviewerAccountId: accountId,
    decision,
    adminNote: adminNote.length > 0 ? adminNote : null,
  });
  if (!result.ok) {
    redirect(`/nex-native/hq/communities?e=${result.reason}`);
  }
  revalidatePath("/nex-native/hq/communities");
  redirect(`/nex-native/hq/communities?m=flag_${decision}`);
}

// ─── HQ-direct community operations (owner directive 2026-11-03) ─────
import {
  hqRemoveMember,
  hqDeleteCommunity,
  hqCreateCommunity,
} from "@/lib/nex-native/community/member-service";

export async function hqRemoveMemberAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  try {
    await requireHqAdmin(accountId);
  } catch (err) {
    if (err instanceof HqAuthorizationError) redirect("/nex-native?e=not_hq");
    throw err;
  }

  const memberAccountId = String(formData.get("member_account_id") ?? "").trim();
  const communityZoneId = String(formData.get("community_zone_id") ?? "").trim();
  const note = String(formData.get("note") ?? "");
  if (!memberAccountId || !communityZoneId) {
    redirect("/nex-native/hq/communities?e=bad_input");
  }

  const result = await hqRemoveMember({
    actorAccountId: accountId,
    memberAccountId,
    communityZoneId,
    note,
  });
  if (!result.ok) {
    redirect(`/nex-native/hq/communities/${communityZoneId}?e=${result.reason}`);
  }
  revalidatePath(`/nex-native/hq/communities/${communityZoneId}`);
  revalidatePath("/nex-native/hq/communities");
  redirect(`/nex-native/hq/communities/${communityZoneId}?m=member_removed`);
}

export async function hqDeleteCommunityAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  try {
    await requireHqAdmin(accountId);
  } catch (err) {
    if (err instanceof HqAuthorizationError) redirect("/nex-native?e=not_hq");
    throw err;
  }

  const communityZoneId = String(formData.get("community_zone_id") ?? "").trim();
  const note = String(formData.get("note") ?? "");
  if (!communityZoneId) redirect("/nex-native/hq/communities?e=bad_input");

  const result = await hqDeleteCommunity({
    actorAccountId: accountId,
    communityZoneId,
    note,
  });
  if (!result.ok) {
    redirect(`/nex-native/hq/communities?e=${result.reason}`);
  }
  revalidatePath("/nex-native/hq/communities");
  redirect("/nex-native/hq/communities?m=community_archived");
}

export async function hqCreateCommunityAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  try {
    await requireHqAdmin(accountId);
  } catch (err) {
    if (err instanceof HqAuthorizationError) redirect("/nex-native?e=not_hq");
    throw err;
  }

  const name = String(formData.get("name") ?? "").trim();
  const parentZoneId = String(formData.get("parent_zone_id") ?? "").trim();
  const levelRaw = String(formData.get("level") ?? "district").trim();
  const level =
    levelRaw === "neighbourhood" || levelRaw === "ward" || levelRaw === "district"
      ? (levelRaw as "district" | "neighbourhood" | "ward")
      : "district";
  if (!name || !parentZoneId) {
    redirect("/nex-native/hq/communities?e=bad_input");
  }

  const result = await hqCreateCommunity({
    actorAccountId: accountId,
    name,
    parentZoneId,
    level,
  });
  if (!result.ok) {
    redirect(`/nex-native/hq/communities?e=${result.reason}`);
  }
  revalidatePath("/nex-native/hq/communities");
  redirect(`/nex-native/hq/communities?m=community_created`);
}

// ─────────────────────────────────────────────────────────────────────
// User-created community moderation surface · migration 270.
// Owner-authorised 2026-11-03 (D3b flow).
// ─────────────────────────────────────────────────────────────────────

/** User submits a new community name under their county.
 *  Auto-joins the submitter so they can post straight away ·
 *  the row is 'pending' until HQ approves/rejects/merges. */
export async function createUserCommunityAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  const countyZoneId = String(formData.get("county_zone_id") ?? "").trim();
  const rawName = String(formData.get("name") ?? "").trim();

  if (!countyZoneId || !rawName) {
    redirect(toBanner("create", { county: countyZoneId, e: "bad_input" }));
  }

  const result = await createPendingArea({
    countyZoneId,
    creatorAccountId: accountId,
    rawName,
  });

  if (!result.ok) {
    redirect(toBanner("create", { county: countyZoneId, e: result.kind }));
  }

  // Auto-join the creator to their new pending community so they can
  // post immediately · they still have their county membership too.
  try {
    await confirmMembership({
      accountId,
      hyperlocalZoneId: result.zone.id,
      notificationPreference: "all",
    });
  } catch (err) {
    // Non-fatal · the zone exists · user can join from discover.
    console.warn(
      `[create-community] auto-join failed · ${err instanceof Error ? err.message : "unknown"}`,
    );
  }

  revalidatePath("/nex-native/community/discover");
  revalidatePath("/nex-native/hq/communities");
  redirect("/nex-native/community/discover?m=submitted_for_review");
}

export async function hqApprovePendingAreaAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  try {
    await requireHqAdmin(accountId);
  } catch (err) {
    if (err instanceof HqAuthorizationError) redirect("/nex-native?e=not_hq");
    throw err;
  }
  const pendingZoneId = String(formData.get("pending_zone_id") ?? "").trim();
  if (!pendingZoneId) redirect("/nex-native/hq/communities?e=bad_input");

  const result = await approvePendingArea(pendingZoneId);
  if (!result.ok) {
    redirect(`/nex-native/hq/communities?e=approve_failed`);
  }
  revalidatePath("/nex-native/hq/communities");
  redirect("/nex-native/hq/communities?m=community_approved");
}

export async function hqRejectPendingAreaAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  try {
    await requireHqAdmin(accountId);
  } catch (err) {
    if (err instanceof HqAuthorizationError) redirect("/nex-native?e=not_hq");
    throw err;
  }
  const pendingZoneId = String(formData.get("pending_zone_id") ?? "").trim();
  // Reason is captured but currently only logged · the user's creator
  // membership on this pending zone is removed by rejectPendingArea.
  if (!pendingZoneId) redirect("/nex-native/hq/communities?e=bad_input");

  const result = await rejectPendingArea(pendingZoneId);
  if (!result.ok) {
    redirect(`/nex-native/hq/communities?e=reject_failed`);
  }
  revalidatePath("/nex-native/hq/communities");
  redirect("/nex-native/hq/communities?m=community_rejected");
}

export async function hqMergePendingAreaAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  try {
    await requireHqAdmin(accountId);
  } catch (err) {
    if (err instanceof HqAuthorizationError) redirect("/nex-native?e=not_hq");
    throw err;
  }
  const pendingZoneId = String(formData.get("pending_zone_id") ?? "").trim();
  const targetZoneId = String(formData.get("target_zone_id") ?? "").trim();
  if (!pendingZoneId || !targetZoneId) {
    redirect("/nex-native/hq/communities?e=bad_input");
  }

  const result = await mergePendingArea({ pendingZoneId, targetZoneId });
  if (!result.ok) {
    redirect(`/nex-native/hq/communities?e=merge_failed`);
  }
  revalidatePath("/nex-native/hq/communities");
  redirect("/nex-native/hq/communities?m=community_merged");
}
