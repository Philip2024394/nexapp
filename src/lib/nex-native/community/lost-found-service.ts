// src/lib/nex-native/community/lost-found-service.ts
//
// NEX Community Noticeboard · Phase 2A · Lost & Found CRUD + photos.
//
// Reads/writes nex_community_card (super-table) + nex_community_lost_found_detail
// + nex_community_card_photo. All writes enforce membership + rate limits.
// Author identity sealed server-side (never trusts a client-supplied id).
//
// Phase 2A invariants:
//   · Only `nex_chat` contact_mode (card detail page exposes a "Message
//     about this card" button that opens the existing peer chat flow).
//   · 2 photos max per card, 2MB max per photo.
//   · Default expiry 60 days · author can resolve/renew early.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";
import {
  NEX_COMMUNITY_LOST_FOUND_DEFAULT_EXPIRY_DAYS,
  NEX_COMMUNITY_PHOTO_BUCKET,
  NEX_COMMUNITY_PHOTO_MAX_BYTES,
  NEX_COMMUNITY_PHOTO_MAX_PER_CARD,
  NexCommunityMembershipRequiredError,
  type NexCommunityCardPhotoRow,
  type NexCommunityCardRow,
  type NexCommunityLostFoundCard,
  type NexCommunityLostFoundDetailRow,
  type NexCommunityLostFoundSubject,
  type NexCommunityLostOrFound,
  type NexCommunityReportReason,
} from "./types";
import { getMembershipForAccount } from "./membership-service";
import { recordIfAllowed } from "./rate-limit";

const DEFAULT_EXPIRY_MS =
  NEX_COMMUNITY_LOST_FOUND_DEFAULT_EXPIRY_DAYS * 24 * 3_600_000;

/** List Lost & Found cards in a zone. Returns the card + detail + photos
 *  joined, newest first. Does not include confirmations count by default
 *  (list view uses a lighter projection). */
export async function listLostFoundCards(input: {
  zoneId: NexUuid;
  level: "hyperlocal" | "district";
  limit?: number;
  offset?: number;
  includeResolved?: boolean;
}): Promise<NexCommunityLostFoundCard[]> {
  const limit = Math.min(100, Math.max(1, input.limit ?? 30));
  const offset = Math.max(0, input.offset ?? 0);
  const column =
    input.level === "hyperlocal" ? "hyperlocal_zone_id" : "district_zone_id";
  const statuses = input.includeResolved
    ? ["active", "resolved"]
    : ["active"];

  const { data: cards, error } = await nexSupabaseAdmin
    .from("nex_community_card")
    .select("*")
    .eq("kind", "lost_found")
    .eq(column, input.zoneId)
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    throw new Error(
      `lost-found-service.listLostFoundCards · ${error.message}`,
    );
  }
  const cardRows = (cards as NexCommunityCardRow[]) ?? [];
  if (cardRows.length === 0) return [];

  const ids = cardRows.map((c) => c.id);
  const [{ data: details }, { data: photos }] = await Promise.all([
    nexSupabaseAdmin
      .from("nex_community_lost_found_detail")
      .select("*")
      .in("card_id", ids),
    nexSupabaseAdmin
      .from("nex_community_card_photo")
      .select("*")
      .in("card_id", ids)
      .order("display_order", { ascending: true }),
  ]);
  const detailById = new Map<string, NexCommunityLostFoundDetailRow>(
    ((details as NexCommunityLostFoundDetailRow[]) ?? []).map((d) => [d.card_id, d]),
  );
  const photosById = new Map<string, NexCommunityCardPhotoRow[]>();
  for (const p of (photos as NexCommunityCardPhotoRow[]) ?? []) {
    const arr = photosById.get(p.card_id) ?? [];
    arr.push(p);
    photosById.set(p.card_id, arr);
  }

  return cardRows.map((card) => ({
    card,
    detail: detailById.get(card.id) ?? {
      card_id: card.id,
      lost_or_found: "lost",
      subject_kind: "other",
      approximate_area_text: null,
      seen_at: null,
      contact_mode: "nex_chat",
    },
    photos: photosById.get(card.id) ?? [],
    confirmations_count: 0,
  }));
}

export async function getLostFoundCardById(
  cardId: NexUuid,
): Promise<NexCommunityLostFoundCard | null> {
  const { data: card, error } = await nexSupabaseAdmin
    .from("nex_community_card")
    .select("*")
    .eq("id", cardId)
    .eq("kind", "lost_found")
    .maybeSingle();
  if (error) {
    throw new Error(
      `lost-found-service.getLostFoundCardById · ${error.message}`,
    );
  }
  if (!card) return null;

  const [{ data: detail }, { data: photos }, { count }] = await Promise.all([
    nexSupabaseAdmin
      .from("nex_community_lost_found_detail")
      .select("*")
      .eq("card_id", cardId)
      .maybeSingle(),
    nexSupabaseAdmin
      .from("nex_community_card_photo")
      .select("*")
      .eq("card_id", cardId)
      .order("display_order", { ascending: true }),
    nexSupabaseAdmin
      .from("nex_community_card_confirmation")
      .select("*", { count: "exact", head: true })
      .eq("card_id", cardId),
  ]);

  return {
    card: card as NexCommunityCardRow,
    detail: (detail as NexCommunityLostFoundDetailRow) ?? {
      card_id: cardId,
      lost_or_found: "lost",
      subject_kind: "other",
      approximate_area_text: null,
      seen_at: null,
      contact_mode: "nex_chat",
    },
    photos: (photos as NexCommunityCardPhotoRow[]) ?? [],
    confirmations_count: count ?? 0,
  };
}

/** Create a Lost & Found card. Zone taken from author's confirmed
 *  membership · never from client input. */
export async function createLostFoundCard(input: {
  accountId: NexUuid;
  lostOrFound: NexCommunityLostOrFound;
  subjectKind: NexCommunityLostFoundSubject;
  title: string;
  body?: string | null;
  approximateAreaText?: string | null;
  seenAt?: string | null;
}): Promise<NexCommunityLostFoundCard> {
  const membership = await getMembershipForAccount(input.accountId);
  if (!membership) {
    throw new NexCommunityMembershipRequiredError(input.accountId);
  }
  await recordIfAllowed(input.accountId, "card_create");

  const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_MS).toISOString();

  const { data: card, error: cErr } = await nexSupabaseAdmin
    .from("nex_community_card")
    .insert({
      kind: "lost_found",
      hyperlocal_zone_id: membership.hyperlocal_zone_id,
      district_zone_id: membership.district_zone_id,
      author_account_id: input.accountId,
      title: input.title.trim(),
      body: input.body?.trim() || null,
      status: "active",
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (cErr) {
    throw new Error(`lost-found-service.createLostFoundCard · card · ${cErr.message}`);
  }

  const { data: detail, error: dErr } = await nexSupabaseAdmin
    .from("nex_community_lost_found_detail")
    .insert({
      card_id: card.id,
      lost_or_found: input.lostOrFound,
      subject_kind: input.subjectKind,
      approximate_area_text: input.approximateAreaText?.trim() || null,
      seen_at: input.seenAt ?? null,
      contact_mode: "nex_chat",
    })
    .select("*")
    .single();
  if (dErr) {
    // best-effort rollback: delete the card row we just inserted
    await nexSupabaseAdmin.from("nex_community_card").delete().eq("id", card.id);
    throw new Error(`lost-found-service.createLostFoundCard · detail · ${dErr.message}`);
  }

  return {
    card: card as NexCommunityCardRow,
    detail: detail as NexCommunityLostFoundDetailRow,
    photos: [],
    confirmations_count: 0,
  };
}

/** Author-only · append an update + optionally transition status to resolved. */
export async function appendLostFoundUpdate(input: {
  accountId: NexUuid;
  cardId: NexUuid;
  updateText: string;
  markResolved?: boolean;
  resolutionNote?: string | null;
}): Promise<void> {
  const card = await getLostFoundCardById(input.cardId);
  if (!card) throw new Error(`lost-found-service.appendUpdate · card ${input.cardId} not found`);
  if (card.card.author_account_id !== input.accountId) {
    throw new Error("lost-found-service.appendUpdate · only the author can update this card");
  }
  if (card.card.status === "removed") {
    throw new Error("lost-found-service.appendUpdate · card is removed");
  }

  await recordIfAllowed(
    input.accountId,
    input.markResolved ? "card_resolve" : "card_update",
  );

  const { error } = await nexSupabaseAdmin
    .from("nex_community_card_update")
    .insert({
      card_id: input.cardId,
      author_account_id: input.accountId,
      update_text: input.updateText.trim(),
      status_change: input.markResolved ? "resolved" : null,
    });
  if (error) throw new Error(`lost-found-service.appendUpdate · ${error.message}`);

  if (input.markResolved && card.card.status === "active") {
    const now = new Date().toISOString();
    const { error: uErr } = await nexSupabaseAdmin
      .from("nex_community_card")
      .update({
        status: "resolved",
        resolved_at: now,
        resolved_by_account_id: input.accountId,
        resolution_note: input.resolutionNote?.trim() || null,
        updated_at: now,
      })
      .eq("id", input.cardId);
    if (uErr) throw new Error(`lost-found-service.appendUpdate · resolve · ${uErr.message}`);
  }
}

/** Non-author · corroboration ("I saw this too" / "I may have found this"). */
export async function confirmLostFoundCard(input: {
  accountId: NexUuid;
  cardId: NexUuid;
}): Promise<void> {
  const card = await getLostFoundCardById(input.cardId);
  if (!card) throw new Error(`lost-found-service.confirm · card ${input.cardId} not found`);
  if (card.card.author_account_id === input.accountId) {
    throw new Error("lost-found-service.confirm · author cannot confirm own card");
  }
  if (card.card.status !== "active") {
    throw new Error(`lost-found-service.confirm · card is ${card.card.status}, not active`);
  }
  await recordIfAllowed(input.accountId, "card_confirm");

  const { error } = await nexSupabaseAdmin
    .from("nex_community_card_confirmation")
    .upsert(
      { card_id: input.cardId, account_id: input.accountId, confirmed_at: new Date().toISOString() },
      { onConflict: "card_id,account_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(`lost-found-service.confirm · ${error.message}`);
}

/** Non-author · file a moderation report with full card snapshot. */
export async function reportLostFoundCard(input: {
  reporterAccountId: NexUuid;
  cardId: NexUuid;
  reason: NexCommunityReportReason;
  note?: string | null;
}): Promise<void> {
  const card = await getLostFoundCardById(input.cardId);
  if (!card) throw new Error(`lost-found-service.report · card ${input.cardId} not found`);
  if (card.card.author_account_id === input.reporterAccountId) {
    throw new Error("lost-found-service.report · cannot report own card");
  }
  await recordIfAllowed(input.reporterAccountId, "card_report");

  const snapshot = {
    card_id: card.card.id,
    kind: card.card.kind,
    title: card.card.title,
    body: card.card.body,
    status: card.card.status,
    author_account_id: card.card.author_account_id,
    hyperlocal_zone_id: card.card.hyperlocal_zone_id,
    district_zone_id: card.card.district_zone_id,
    lost_or_found: card.detail.lost_or_found,
    subject_kind: card.detail.subject_kind,
    approximate_area_text: card.detail.approximate_area_text,
    photo_count: card.photos.length,
    created_at: card.card.created_at,
  };

  const { error } = await nexSupabaseAdmin
    .from("nex_community_card_report")
    .insert({
      card_id: input.cardId,
      reporter_account_id: input.reporterAccountId,
      reason: input.reason,
      note: input.note?.trim() || null,
      card_snapshot: snapshot,
      status: "pending",
    });
  if (error) throw new Error(`lost-found-service.report · ${error.message}`);
}

/** Author-only · attach a photo already uploaded to the storage bucket.
 *  Caller is responsible for performing the actual upload (via
 *  photo-upload-service.ts) and passing the resulting `storage_path`.
 *  This function only records the row + enforces the 2-per-card cap. */
export async function attachLostFoundPhoto(input: {
  accountId: NexUuid;
  cardId: NexUuid;
  storagePath: string;
  bytes: number;
  widthPx?: number | null;
  heightPx?: number | null;
}): Promise<NexCommunityCardPhotoRow> {
  const card = await getLostFoundCardById(input.cardId);
  if (!card) throw new Error(`lost-found-service.attachPhoto · card ${input.cardId} not found`);
  if (card.card.author_account_id !== input.accountId) {
    throw new Error("lost-found-service.attachPhoto · only the author can attach photos");
  }
  if (card.photos.length >= NEX_COMMUNITY_PHOTO_MAX_PER_CARD) {
    throw new Error(
      `lost-found-service.attachPhoto · max ${NEX_COMMUNITY_PHOTO_MAX_PER_CARD} photos per card already reached`,
    );
  }
  if (input.bytes < 1 || input.bytes > NEX_COMMUNITY_PHOTO_MAX_BYTES) {
    throw new Error(
      `lost-found-service.attachPhoto · bytes ${input.bytes} outside 1..${NEX_COMMUNITY_PHOTO_MAX_BYTES}`,
    );
  }
  await recordIfAllowed(input.accountId, "card_photo_upload");

  const displayOrder: 0 | 1 = card.photos.length === 0 ? 0 : 1;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_card_photo")
    .insert({
      card_id: input.cardId,
      storage_path: input.storagePath,
      display_order: displayOrder,
      bytes: input.bytes,
      width_px: input.widthPx ?? null,
      height_px: input.heightPx ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`lost-found-service.attachPhoto · ${error.message}`);
  return data as NexCommunityCardPhotoRow;
}

/** Build a Supabase storage path with per-card scoping. */
export function buildPhotoStoragePath(cardId: NexUuid, displayOrder: 0 | 1): string {
  // Convention: <card_id>/<display_order>-<timestamp>.webp
  //   · bucket scoping = card_id prefix
  //   · display_order lets the first photo be the primary
  //   · timestamp prevents accidental overwrite on re-upload
  return `${cardId}/${displayOrder}-${Date.now()}.webp`;
}

/** Export the bucket name so callers can reach it without hard-coding. */
export const PHOTO_BUCKET = NEX_COMMUNITY_PHOTO_BUCKET;
