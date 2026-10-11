"use server";

// src/app/nex-native/community/_actions.ts
//
// Server actions for Community Noticeboard forms. All actions resolve the
// session, call the service, and redirect / revalidate.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
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
  const session = await resolveNexAppSessionFromContext();
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
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const affectedAreaText = String(formData.get("affected_area_text") ?? "").trim();

  if (!(NEX_COMMUNITY_NOTICE_CATEGORIES as readonly string[]).includes(categoryRaw)) {
    redirect("/nex-native/community/compose?e=bad_category");
  }
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
