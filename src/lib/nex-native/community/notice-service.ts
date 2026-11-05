// src/lib/nex-native/community/notice-service.ts
//
// NEX Community Noticeboard · notice CRUD + lifecycle + corroboration + report.
//
// Every write enforces membership + rate limits server-side. The service
// never trusts a client-supplied zone id — it reads the author's
// membership and uses that zone. (A future "post from a different zone"
// flow would be a separate call with explicit auth.)

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";
import {
  NEX_COMMUNITY_DEFAULT_NOTICE_EXPIRY_HOURS,
  NexCommunityMembershipRequiredError,
  type NexCommunityNoticeCategory,
  type NexCommunityNoticeConfirmationRow,
  type NexCommunityNoticeReportRow,
  type NexCommunityNoticeRow,
  type NexCommunityNoticeStatus,
  type NexCommunityNoticeUpdateRow,
  type NexCommunityReportReason,
  type NexCommunityUrgencyLevel,
} from "./types";
import { getMembershipForAccount } from "./membership-service";
import { recordIfAllowed } from "./rate-limit";

/** List active + resolved notices scoped to a zone level.
 *  - level="hyperlocal": matches notices whose hyperlocal_zone_id = zoneId
 *  - level="district":   matches notices whose district_zone_id   = zoneId
 */
export async function listNotices(input: {
  zoneId: NexUuid;
  level: "hyperlocal" | "district";
  limit?: number;
  offset?: number;
  includeResolved?: boolean;
}): Promise<NexCommunityNoticeRow[]> {
  const limit = Math.min(100, Math.max(1, input.limit ?? 30));
  const offset = Math.max(0, input.offset ?? 0);
  const column =
    input.level === "hyperlocal" ? "hyperlocal_zone_id" : "district_zone_id";
  const statusList = input.includeResolved
    ? ["active", "resolved"]
    : ["active"];

  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_notice")
    .select("*")
    .eq(column, input.zoneId)
    .in("status", statusList)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    throw new Error(
      `community-notice-service.listNotices(${input.level}=${input.zoneId}) · ${error.message}`,
    );
  }
  return (data as NexCommunityNoticeRow[]) ?? [];
}

export async function getNoticeById(
  noticeId: NexUuid,
): Promise<NexCommunityNoticeRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_notice")
    .select("*")
    .eq("id", noticeId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `community-notice-service.getNoticeById(${noticeId}) · ${error.message}`,
    );
  }
  return (data as NexCommunityNoticeRow) ?? null;
}

/** Create a notice. The author's membership determines the zone — we
 *  do NOT accept a client-supplied zone id to prevent cross-zone posting.
 */
export async function createNotice(input: {
  accountId: NexUuid;
  category: NexCommunityNoticeCategory;
  urgencyLevel?: NexCommunityUrgencyLevel;
  title: string;
  body?: string | null;
  affectedAreaText?: string | null;
  expiresAt?: string | null;
}): Promise<NexCommunityNoticeRow> {
  const membership = await getMembershipForAccount(input.accountId);
  if (!membership) {
    throw new NexCommunityMembershipRequiredError(input.accountId);
  }
  await recordIfAllowed(input.accountId, "notice_create");

  const expiresAt =
    input.expiresAt ??
    new Date(
      Date.now() + NEX_COMMUNITY_DEFAULT_NOTICE_EXPIRY_HOURS * 3_600_000,
    ).toISOString();

  const payload = {
    hyperlocal_zone_id: membership.hyperlocal_zone_id,
    district_zone_id: membership.district_zone_id,
    author_account_id: input.accountId,
    category: input.category,
    urgency_level: input.urgencyLevel ?? "moderate",
    title: input.title.trim(),
    body: input.body?.trim() || null,
    status: "active" as NexCommunityNoticeStatus,
    affected_area_text: input.affectedAreaText?.trim() || null,
    expires_at: expiresAt,
  };

  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_notice")
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    throw new Error(
      `community-notice-service.createNotice · ${error.message}`,
    );
  }
  return data as NexCommunityNoticeRow;
}

/** Append an update entry on a notice (optionally transitioning status
 *  to 'resolved'). Only the author can mutate the notice in Phase 1;
 *  moderators remove via a separate path. */
export async function appendUpdate(input: {
  accountId: NexUuid;
  noticeId: NexUuid;
  updateText: string;
  markResolved?: boolean;
  resolutionNote?: string | null;
}): Promise<NexCommunityNoticeUpdateRow> {
  const notice = await getNoticeById(input.noticeId);
  if (!notice) {
    throw new Error(
      `community-notice-service.appendUpdate · notice ${input.noticeId} not found`,
    );
  }
  if (notice.author_account_id !== input.accountId) {
    throw new Error(
      `community-notice-service.appendUpdate · only the author can update this notice`,
    );
  }
  if (notice.status === "removed") {
    throw new Error(
      `community-notice-service.appendUpdate · notice is removed`,
    );
  }

  await recordIfAllowed(
    input.accountId,
    input.markResolved ? "notice_resolve" : "notice_update",
  );

  // Insert the history row first.
  const { data: updateRow, error: insErr } = await nexSupabaseAdmin
    .from("nex_community_notice_update")
    .insert({
      notice_id: input.noticeId,
      author_account_id: input.accountId,
      update_text: input.updateText.trim(),
      status_change: input.markResolved ? "resolved" : null,
    })
    .select("*")
    .single();
  if (insErr) {
    throw new Error(
      `community-notice-service.appendUpdate · insert · ${insErr.message}`,
    );
  }

  // If resolving, mutate the notice row.
  if (input.markResolved && notice.status === "active") {
    const now = new Date().toISOString();
    const { error: updErr } = await nexSupabaseAdmin
      .from("nex_community_notice")
      .update({
        status: "resolved",
        resolved_at: now,
        resolved_by_account_id: input.accountId,
        resolution_note: input.resolutionNote?.trim() || null,
        updated_at: now,
      })
      .eq("id", input.noticeId);
    if (updErr) {
      throw new Error(
        `community-notice-service.appendUpdate · resolve · ${updErr.message}`,
      );
    }
  }

  return updateRow as NexCommunityNoticeUpdateRow;
}

/** Record a "me too" confirmation. Idempotent: duplicate confirmations
 *  by the same account on the same notice are silently absorbed. */
export async function confirmNotice(input: {
  accountId: NexUuid;
  noticeId: NexUuid;
}): Promise<void> {
  const notice = await getNoticeById(input.noticeId);
  if (!notice) {
    throw new Error(
      `community-notice-service.confirmNotice · notice ${input.noticeId} not found`,
    );
  }
  if (notice.author_account_id === input.accountId) {
    // Authors can't "confirm" their own notice.
    throw new Error(
      `community-notice-service.confirmNotice · author cannot confirm own notice`,
    );
  }
  if (notice.status !== "active") {
    throw new Error(
      `community-notice-service.confirmNotice · notice is ${notice.status}, not active`,
    );
  }
  await recordIfAllowed(input.accountId, "notice_confirm");

  const { error } = await nexSupabaseAdmin
    .from("nex_community_notice_confirmation")
    .upsert(
      {
        notice_id: input.noticeId,
        account_id: input.accountId,
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: "notice_id,account_id", ignoreDuplicates: true },
    );
  if (error) {
    throw new Error(
      `community-notice-service.confirmNotice · ${error.message}`,
    );
  }
}

/** Count confirmations on a notice. */
export async function countConfirmations(noticeId: NexUuid): Promise<number> {
  const { count, error } = await nexSupabaseAdmin
    .from("nex_community_notice_confirmation")
    .select("*", { count: "exact", head: true })
    .eq("notice_id", noticeId);
  if (error) {
    throw new Error(
      `community-notice-service.countConfirmations · ${error.message}`,
    );
  }
  return count ?? 0;
}

/** Fetch the update history for a notice (newest first). */
export async function listUpdates(
  noticeId: NexUuid,
): Promise<NexCommunityNoticeUpdateRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_notice_update")
    .select("*")
    .eq("notice_id", noticeId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    throw new Error(
      `community-notice-service.listUpdates · ${error.message}`,
    );
  }
  return (data as NexCommunityNoticeUpdateRow[]) ?? [];
}

/** File a moderation report against a notice. Snapshots the current
 *  notice content per the sealed report-primitive doctrine. */
export async function reportNotice(input: {
  reporterAccountId: NexUuid;
  noticeId: NexUuid;
  reason: NexCommunityReportReason;
  note?: string | null;
}): Promise<NexCommunityNoticeReportRow> {
  const notice = await getNoticeById(input.noticeId);
  if (!notice) {
    throw new Error(
      `community-notice-service.reportNotice · notice ${input.noticeId} not found`,
    );
  }
  if (notice.author_account_id === input.reporterAccountId) {
    throw new Error(
      `community-notice-service.reportNotice · cannot report own notice`,
    );
  }
  await recordIfAllowed(input.reporterAccountId, "notice_report");

  const snapshot = {
    notice_id: notice.id,
    title: notice.title,
    body: notice.body,
    category: notice.category,
    affected_area_text: notice.affected_area_text,
    status: notice.status,
    author_account_id: notice.author_account_id,
    hyperlocal_zone_id: notice.hyperlocal_zone_id,
    district_zone_id: notice.district_zone_id,
    created_at: notice.created_at,
  };

  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_notice_report")
    .insert({
      notice_id: notice.id,
      reporter_account_id: input.reporterAccountId,
      reason: input.reason,
      note: input.note?.trim() || null,
      notice_snapshot: snapshot,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) {
    throw new Error(
      `community-notice-service.reportNotice · ${error.message}`,
    );
  }
  return data as NexCommunityNoticeReportRow;
}
