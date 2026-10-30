// src/lib/nex-native/music/types.ts
//
// NEX Music · shared type contract.
// Owner-authorised 2026-10-29 · follows DRAFT doctrine v3 §9.1.
// Schema target = migration 235 (authored but not applied).

import type { NexTimestamp, NexUuid } from "../types";

export type NexMusicSourceType =
  | "uploaded_audio"
  | "spotify_url"
  | "youtube_url";

export type NexMusicVisibility = "private" | "shared_live" | "removed";

export type NexMusicRightsDeclaration =
  | "owner_content"
  | "licensed"
  | "public_domain";

export type NexMusicMimeType = "audio/mpeg" | "audio/mp4";

export interface NexMusicTrackRow {
  readonly id: NexUuid;
  readonly owner_account_id: NexUuid;
  readonly business_id: NexUuid | null;
  readonly source_type: NexMusicSourceType;
  readonly title: string;
  readonly artist: string | null;
  readonly album: string | null;
  readonly duration_ms: number | null;
  /** Opaque adapter reference (NOT a signed URL). Only set for
   *  `source_type === "uploaded_audio"`. */
  readonly media_url: string | null;
  /** External URL. Only set for `source_type IN ("spotify_url","youtube_url")`. */
  readonly source_url: string | null;
  /** Opaque adapter reference OR external URL. */
  readonly cover_image_url: string | null;
  readonly background_image_url: string | null;
  readonly byte_size: number | null;
  readonly mime_type: NexMusicMimeType | null;
  readonly bitrate_kbps: number | null;
  readonly rights_declaration: NexMusicRightsDeclaration;
  readonly rights_notes: string | null;
  readonly visibility: NexMusicVisibility;
  readonly created_at: NexTimestamp;
  readonly updated_at: NexTimestamp;
  readonly removed_at: NexTimestamp | null;
  /** Owner-authorised 2026-10-29 (library card metrics) · aggregate
   *  counters bumped by `recordMusicTrackView`/`toggleMusicTrackLike`/
   *  `recordMusicTrackShare`. Views increment on each preview load.
   *  Likes toggle (one per user). Shares increment per share event.
   *  Default 0 for rows persisted before the counters shipped. */
  readonly view_count: number;
  readonly like_count: number;
  readonly share_count: number;
  /** Owner-authorised 2026-10-30 · optional long-form description
   *  (≤ 1500 chars). Rendered in a frosted-glass slide-up sheet on
   *  the preview page. Dev-FS only · the matching DB column is
   *  deferred until a migration is sealed. */
  readonly description: string | null;
}

export interface NexMusicTrackInsert {
  readonly owner_account_id: NexUuid;
  readonly business_id: NexUuid | null;
  readonly source_type: NexMusicSourceType;
  readonly title: string;
  readonly artist: string | null;
  readonly album?: string | null;
  readonly duration_ms: number | null;
  readonly media_url: string | null;
  readonly source_url: string | null;
  readonly cover_image_url: string | null;
  readonly background_image_url?: string | null;
  readonly byte_size: number | null;
  readonly mime_type: NexMusicMimeType | null;
  readonly bitrate_kbps?: number | null;
  readonly rights_declaration: NexMusicRightsDeclaration;
  readonly rights_notes?: string | null;
}

/** Discriminated-union result for every music server action. */
export type NexMusicResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly code:
        | "not-signed-in"
        | "invalid-input"
        | "unsupported-media-type"
        | "too-large"
        | "signature-mismatch"
        | "storage-quota-exceeded"
        | "track-count-exceeded"
        | "service-at-capacity"
        | "rate-limited"
        | "rights-required"
        | "schema-not-provisioned"
        | "storage-write-failed"
        | "not-found"
        | "forbidden"
        | "unknown"
        // Owner-authorised 2026-10-30 (NEX Music Publishing → Live Feed · M-2) ·
        // publish-action error classes mirroring the Migration 236 SQLSTATEs
        // (R8-4). Server action maps function RAISEs 1:1 to these codes, with
        // the single `idempotency-rejected` covering all four idempotency
        // rejection classes (R5-1 non-disclosure).
        | "missing-request-id"
        | "idempotency-rejected"
        | "track-not-found"
        | "not-authorized"
        | "track-removed"
        | "rights-invalid"
        | "eligibility-race"
        | "eligibility-invalid-state"
        | "rights-ack-required"
        | "dev-impersonation-publish-forbidden"
        | "internal-error";
      readonly message: string;
    };

/** NEX Music Publishing → Live Feed (M-2 wiring) · publish-as-mode locked
 *  per sealed design 2026-10-30. */
export type NexMusicPublishAsMode = "cover_audio" | "music_video";

/** Shape returned on a successful publish (M-2). publishGeneration is a
 *  successor-detection baseline, NOT a liveness signal (R4-#6).  */
export interface NexMusicPublishResult {
  readonly requestId: NexUuid;
  readonly trackId: NexUuid;
  readonly publishGeneration: number;
}

/** Row shape of nex_creator_active_music (dev-FS mirror of Migration 236).
 *  One row per creator (owner_account_id is the primary key). */
export interface NexCreatorActiveMusicRow {
  readonly owner_account_id: NexUuid;
  readonly track_id: NexUuid | null;
  readonly publish_as_mode: NexMusicPublishAsMode;
  readonly publish_generation: number;
  readonly rights_declaration_frozen: NexMusicRightsDeclaration;
  readonly published_at: NexTimestamp;
  readonly unpublished_at: NexTimestamp | null;
}

/** Row shape of nex_music_publish_idempotency (dev-FS mirror). PK on
 *  request_id. Expired-but-present rows still honour as dedup hits per
 *  Round 4-#5. */
export interface NexMusicPublishIdempotencyRow {
  readonly request_id: NexUuid;
  readonly account_id: NexUuid;
  readonly track_id: NexUuid;
  readonly publish_as_mode: NexMusicPublishAsMode;
  readonly publish_generation: number;
  readonly observed_at: NexTimestamp;
  readonly expires_at: NexTimestamp;
}
