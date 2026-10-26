// src/lib/nex-native/live-broadcast/uploaded-video-service.ts
//
// Phase 2 · Uploaded video service · pairs with Migration 223.
// -----------------------------------------------------------------------------
// Owner directive 2026-10-24 · uploaded videos appear in the TBD
// "Recorded videos" slot of the Live feed as a DISTINCT content type.
// They are NEVER labelled as currently Live.
//
// Scope
//   · publishUploadedVideo · insert a `nex_uploaded_video` row with
//     required rights declaration; byte transfer to storage is a
//     separate step the caller handles with the Supabase storage
//     client. The service does not read the file.
//   · listPublishedUploadedVideos · fail-open · public-visibility
//     rows ordered newest-first.
//   · getUploadedVideoById · fail-open · returns the row OR null.
//   · softRemoveUploadedVideo · flips visibility to 'removed'.
//
// What this service does NOT do:
//   · Does NOT upload bytes to Supabase storage · bytes must be
//     uploaded separately via a signed upload URL (storage write) ·
//     the service inserts/updates the DB row only.
//   · Does NOT handle moderation workflows · a future admin surface
//     will set visibility='removed' via service-role.
//   · Does NOT emit a public URL · callers resolve
//     `supabase.storage.from(bucket).getPublicUrl(object_path)` or
//     a signed URL depending on the visibility rule.
//
// Fail posture
//   · Writes · FAIL-CLOSED (throw). The caller surfaces to the UI.
//   · Reads · FAIL-OPEN. The feed renders empty rather than 500.

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { getAccountById } from "@/lib/nex-native/account-service";
import * as businessService from "@/lib/nex-native/business-service";
import { resolveLiveEligibility } from "@/lib/nex-native/live-broadcast/live-eligibility";

export type NexUuid = string;

export type UploadedVideoVisibility =
  | "draft"
  | "public"
  | "unlisted"
  | "removed";

export type UploadedVideoRightsDeclaration =
  | "owner_content"
  | "licensed"
  | "public_domain";

export type UploadedVideoSource = "owner_upload" | "imported";

export type UploadedVideoMimeType =
  | "video/mp4"
  | "video/webm"
  | "video/quicktime";

export interface UploadedVideoRow {
  readonly id: NexUuid;
  readonly owner_account_id: NexUuid;
  readonly business_id: NexUuid | null;
  readonly title: string;
  readonly caption: string | null;
  readonly storage_bucket: string;
  readonly storage_object_path: string;
  readonly duration_seconds: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly byte_size: number | null;
  readonly mime_type: UploadedVideoMimeType;
  readonly rights_declaration: UploadedVideoRightsDeclaration;
  /** ISO-3166 alpha-2 uppercase. Required · powers the country-
   *  weighted feed ranking (70/20/10). Migration 223 CHECK pins the
   *  shape. */
  readonly country_of_origin: string;
  /** Freeform topic tags · lowercase · up to 10 entries. Powers the
   *  20% "same-topic" slice when the viewer shows in-session
   *  interest. Default empty array. */
  readonly topic_tags: readonly string[];
  readonly source: UploadedVideoSource;
  readonly visibility: UploadedVideoVisibility;
  readonly created_at: string;
  readonly published_at: string | null;
  /** Owner directive 2026-10-25 · Migration 221 · when true the
   *  viewer header renders a visible red "(AI)" label immediately
   *  after the "Broadcasted {date}" text. NEX makes NO claim about
   *  unlabelled videos being human-authored · absence of the label
   *  does NOT imply human origin. Pre-migration rows read this as
   *  `undefined` from PostgREST; call-sites that render the chip
   *  MUST default to false (`is_ai_generated ?? false`). */
  readonly is_ai_generated: boolean;
}

export interface PublishUploadedVideoInput {
  readonly ownerAccountId: NexUuid;
  readonly businessId?: NexUuid | null;
  readonly title: string;
  readonly caption?: string | null;
  readonly storageBucket?: string;
  readonly storageObjectPath: string;
  readonly durationSeconds?: number | null;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly byteSize?: number | null;
  readonly mimeType?: UploadedVideoMimeType;
  readonly rightsDeclaration: UploadedVideoRightsDeclaration;
  /** ISO-3166 alpha-2 uppercase. Required. Powers the feed ranking's
   *  home-country slice. The service normalises `"id"` → `"ID"`. */
  readonly countryOfOrigin: string;
  /** Up to 10 topic tags · lowercase · 1..32 chars each. Service
   *  normalises by trim + lowercase + dedup + drop empties + slice
   *  to 10. */
  readonly topicTags?: readonly string[];
  readonly visibility?: Exclude<UploadedVideoVisibility, "removed">;
  /** Owner directive 2026-10-25 · Migration 221 · when true the
   *  viewer header renders a red "(AI)" label after the broadcast
   *  date. The service normalises `=== true` so a misbehaving
   *  client cannot persist truthy-but-not-boolean values. Default
   *  false when omitted. */
  readonly isAiGenerated?: boolean;
}

/** Insert a new uploaded-video row. Fail-closed. The caller MUST
 *  have already uploaded (or committed to uploading) the file to
 *  the named `storage_bucket`/`storage_object_path`; the service
 *  does NOT verify the file exists. */
export async function publishUploadedVideo(
  input: PublishUploadedVideoInput,
): Promise<UploadedVideoRow> {
  const title = input.title.trim();
  if (title.length === 0 || title.length > 120) {
    throw new Error(
      `uploaded-video-service.publishUploadedVideo: title must be 1..120 chars (got ${title.length})`,
    );
  }

  /* Owner directive 2026-10-27 (R9 · Live-eligibility contract) ·
     Public seller video uploads are a Shop member benefit.
     We gate at the SERVICE boundary so every caller — current and
     future — must pass the check, regardless of client-side UI.
     Drafts and unlisted videos remain unrestricted so an unpaid
     account can prepare content before upgrading; only `public`
     is the public-feed surface the Shop entitlement guards.
     Business attachment is additionally validated against the
     signed-in account's ownership · a caller cannot attribute a
     video to a business they do not own. */
  const requestedVisibility: UploadedVideoVisibility =
    input.visibility ?? "draft";
  if (requestedVisibility === "public") {
    const account = await getAccountById(input.ownerAccountId).catch(
      () => null,
    );
    const eligibility = resolveLiveEligibility(account);
    if (!eligibility.ok) {
      throw new Error(
        `uploaded-video-service.publishUploadedVideo: not-eligible:${eligibility.reason}`,
      );
    }
    if (input.businessId) {
      const owned = await businessService
        .listBusinessesByOwner(input.ownerAccountId)
        .catch(() => []);
      const owns = owned.some((b) => b.id === input.businessId);
      if (!owns) {
        throw new Error(
          "uploaded-video-service.publishUploadedVideo: business_id does not belong to owner_account_id",
        );
      }
    }
  }
  const caption = (() => {
    if (typeof input.caption !== "string") return null;
    const trimmed = input.caption.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > 500) return trimmed.slice(0, 500);
    return trimmed;
  })();
  const visibility: UploadedVideoVisibility = requestedVisibility;
  const publishedAt = visibility === "public" || visibility === "unlisted"
    ? new Date().toISOString()
    : null;

  // Country normalisation · ISO-3166 alpha-2 uppercase.
  const countryIso = input.countryOfOrigin.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryIso)) {
    throw new Error(
      `uploaded-video-service.publishUploadedVideo: countryOfOrigin must match ISO-3166 alpha-2 (got "${input.countryOfOrigin}")`,
    );
  }

  // Topic-tag normalisation · trim · lowercase · drop empties · drop
  // > 32-char tags · dedup · cap at 10.
  const topicTags = (() => {
    if (!input.topicTags) return [] as string[];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of input.topicTags) {
      if (typeof raw !== "string") continue;
      const t = raw.trim().toLowerCase();
      if (t.length === 0 || t.length > 32) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
      if (out.length >= 10) break;
    }
    return out;
  })();

  const { data, error } = await nexSupabaseAdmin
    .from("nex_uploaded_video")
    .insert({
      owner_account_id: input.ownerAccountId,
      business_id: input.businessId ?? null,
      title,
      caption,
      storage_bucket: input.storageBucket ?? "nex-live-uploaded",
      storage_object_path: input.storageObjectPath,
      duration_seconds: input.durationSeconds ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      byte_size: input.byteSize ?? null,
      mime_type: input.mimeType ?? "video/mp4",
      rights_declaration: input.rightsDeclaration,
      country_of_origin: countryIso,
      topic_tags: topicTags,
      source: "owner_upload",
      visibility,
      published_at: publishedAt,
      // Owner directive 2026-10-25 · Migration 221 · explicit boolean
      // normalisation guards against truthy-but-not-boolean values
      // from a misbehaving client. Default false when omitted.
      is_ai_generated: input.isAiGenerated === true,
    })
    .select("*")
    .single<UploadedVideoRow>();
  if (error || !data) {
    throw new Error(
      `uploaded-video-service.publishUploadedVideo: ${error?.code ?? "unknown"}: ${error?.message ?? "no row"}`,
    );
  }
  return data;
}

/** Fail-open · public, newest-first. */
export async function listPublishedUploadedVideos(opts: {
  readonly limit?: number;
} = {}): Promise<readonly UploadedVideoRow[]> {
  const limit = Math.max(1, Math.min(50, opts.limit ?? 20));
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_uploaded_video")
      .select("*")
      .eq("visibility", "public")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []) as readonly UploadedVideoRow[];
  } catch {
    return [];
  }
}

/** Fail-open · null when absent. */
export async function getUploadedVideoById(
  id: NexUuid,
): Promise<UploadedVideoRow | null> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_uploaded_video")
      .select("*")
      .eq("id", id)
      .maybeSingle<UploadedVideoRow>();
    if (error) return null;
    return data ?? null;
  } catch {
    return null;
  }
}

/** Soft-remove · flip visibility to 'removed'. Service-role only
 *  by RLS · the UPDATE policy requires owner_account_id match, so
 *  the service-layer caller is the authoritative gate. */
export async function softRemoveUploadedVideo(
  id: NexUuid,
  ownerAccountId: NexUuid,
): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_uploaded_video")
    .update({ visibility: "removed", published_at: null })
    .eq("id", id)
    .eq("owner_account_id", ownerAccountId);
  if (error) {
    throw new Error(
      `uploaded-video-service.softRemoveUploadedVideo: ${error.code ?? "unknown"}: ${error.message}`,
    );
  }
}

/** Owner directive 2026-10-26 · Broadcaster Library sheet · list
 *  every video the broadcaster has posted that is still live
 *  (visibility != 'removed'), newest first. Fail-open. The
 *  broadcaster-only gate is applied at the server-action layer,
 *  NOT here · this service primitive is used by any caller that
 *  needs an owner's full catalogue (admin tooling, moderation,
 *  the library sheet). */
export async function listMyUploadedVideos(
  ownerAccountId: NexUuid,
  opts: { readonly limit?: number } = {},
): Promise<readonly UploadedVideoRow[]> {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 50));
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_uploaded_video")
      .select("*")
      .eq("owner_account_id", ownerAccountId)
      .neq("visibility", "removed")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []) as readonly UploadedVideoRow[];
  } catch {
    return [];
  }
}

/** Owner directive 2026-10-26 · 5-sec undo window for the Library
 *  sheet. Reverse a soft-remove by restoring the row to its prior
 *  visibility. The caller passes the visibility snapshot it took
 *  before the delete (NOT trusted to infer the right value here).
 *  Fail-closed. */
export async function restoreUploadedVideo(
  id: NexUuid,
  ownerAccountId: NexUuid,
  previousVisibility: Exclude<UploadedVideoVisibility, "removed">,
): Promise<void> {
  const publishedAt = previousVisibility === "public" || previousVisibility === "unlisted"
    ? new Date().toISOString()
    : null;
  const { error } = await nexSupabaseAdmin
    .from("nex_uploaded_video")
    .update({ visibility: previousVisibility, published_at: publishedAt })
    .eq("id", id)
    .eq("owner_account_id", ownerAccountId);
  if (error) {
    throw new Error(
      `uploaded-video-service.restoreUploadedVideo: ${error.code ?? "unknown"}: ${error.message}`,
    );
  }
}
