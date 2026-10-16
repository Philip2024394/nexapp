// src/lib/nex-native/business-media/owner-upload-service.ts
//
// Owner-upload image pipeline · Phase 1 of the real image system.
// Founder-authorised 2026-10-13.
//
// This is the ONLY path by which a business-owner image can be
// written to nex.business_media with source_id='owner_upload'.
// Every write goes through this service · every write records the
// verified ownership chain · every write lands with approved=false
// (admin review required before public display).
//
// Trust chain enforced at the WRITE boundary:
//   1. Authenticated nex_account session (caller passes resolved session)
//   2. VERIFIED business_claim row for (canonical_business_id,
//      claimed_by_account_id = session.account.id)
//   3. canonical_business_id in business_canonical with
//      lifecycle_state IN (OWNER_CLAIMED, OWNER_VERIFIED)
//   4. Image bytes validated · MIME · size cap · min dimensions
//   5. Thumbnail entitlement cap honoured (assertCanAddThumbnail)
//   6. EXIF stripped · reencoded as webp · uploaded to nex-media
//   7. INSERT business_media with source_id='owner_upload',
//      owner_approved=true, approved=false, content_sha256,
//      width_px, height_px, mime_type='image/webp'
//
// The resolver's owner-upload bypass (sealed in media-resolver.ts)
// ONLY surfaces rows written by this service · and only AFTER an
// admin flips approved=true.
//
// What this service does NOT do:
//   · Does NOT bypass the admin approval gate (approved=false always)
//   · Does NOT allow clients to set owner_approved=true directly from
//     untrusted input · the value is hard-coded in this function
//   · Does NOT flip source_registry.can_display · governance stays
//     controlled by the admin tier
//   · Does NOT copy/display images from external sources · that is
//     Priority 2 (licensed-source ingestion) · separate service

import "server-only";
import { createHash, randomUUID } from "node:crypto";
import sharp, { type Metadata as SharpMetadata } from "sharp";
import { withClient } from "@/lib/nex/db";
import { nexSupabaseAdmin } from "../supabase-admin";
import { assertCanAddThumbnail } from "../directory/thumbnail-entitlement";
import { NexTierLimitError } from "../tier-gate";
import type { NexUuid } from "../types";

// ─── sealed constants ─────────────────────────────────────────────

export const OWNER_UPLOAD_MAX_BYTES = 5 * 1024 * 1024; // 5 MB cap on raw upload
export const OWNER_UPLOAD_MAX_EDGE_PX = 2000;
export const OWNER_UPLOAD_WEBP_QUALITY = 85;
export const OWNER_UPLOAD_MIN_EDGE_PX = 200;
export const OWNER_UPLOAD_BUCKET = "nex-media";
export const OWNER_UPLOAD_SOURCE_ID = "owner_upload";

const ALLOWED_INPUT_MIME = [
  "image/webp",
  "image/jpeg",
  "image/jpg",
  "image/png",
] as const;

// ─── public result types ──────────────────────────────────────────

export interface OwnerUploadInput {
  readonly canonicalBusinessId: NexUuid;
  readonly ownerAccountId: NexUuid; // from resolved session · never from body
  readonly file: {
    readonly buffer: Buffer;
    readonly mimeType: string;
    readonly sizeBytes: number;
  };
}

export type OwnerUploadResult =
  | {
      readonly ok: true;
      readonly mediaId: string;
      readonly storageKey: string;
      readonly mimeType: "image/webp";
      readonly widthPx: number;
      readonly heightPx: number;
      readonly bytes: number;
      readonly contentSha256: string;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "not_authenticated"
        | "ownership_not_verified"
        | "canonical_not_claimed"
        | "input_too_large"
        | "input_mime_not_allowed"
        | "input_empty"
        | "image_too_small"
        | "image_too_large"
        | "image_decode_failed"
        | "entitlement_cap_reached"
        | "storage_failed"
        | "db_write_failed";
      readonly message: string;
    };

// ─── pure validation (unit-testable, no I/O) ──────────────────────

export function validateOwnerUploadInput(
  input: Pick<OwnerUploadInput, "file">,
): OwnerUploadResult | null {
  if (!input.file.buffer || input.file.buffer.length === 0) {
    return { ok: false, reason: "input_empty", message: "File buffer is empty." };
  }
  if (input.file.sizeBytes > OWNER_UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      reason: "input_too_large",
      message: `File ${input.file.sizeBytes} bytes exceeds the ${OWNER_UPLOAD_MAX_BYTES}-byte cap.`,
    };
  }
  const lower = input.file.mimeType.toLowerCase();
  if (!(ALLOWED_INPUT_MIME as readonly string[]).includes(lower)) {
    return {
      ok: false,
      reason: "input_mime_not_allowed",
      message: `MIME type "${input.file.mimeType}" is not an allowed image format.`,
    };
  }
  return null;
}

// ─── private · ownership verification against the two tables ──────

async function verifyOwnershipChain(
  canonicalBusinessId: NexUuid,
  ownerAccountId: NexUuid,
): Promise<
  | { ok: true; lifecycleState: string }
  | { ok: false; reason: "ownership_not_verified" | "canonical_not_claimed"; message: string }
> {
  const r = await withClient(async (client) => {
    const claim = await client.query(
      `SELECT 1
         FROM nex.business_claim
        WHERE canonical_business_id = $1
          AND claimed_by_account_id = $2
          AND state = 'VERIFIED'
        LIMIT 1`,
      [canonicalBusinessId, ownerAccountId],
    );
    const canonical = await client.query(
      `SELECT lifecycle_state
         FROM nex.business_canonical
        WHERE canonical_business_id = $1
        LIMIT 1`,
      [canonicalBusinessId],
    );
    return {
      hasClaim: claim.rowCount && claim.rowCount > 0,
      lifecycleState:
        canonical.rowCount && canonical.rowCount > 0
          ? ((canonical.rows[0] as { lifecycle_state?: unknown }).lifecycle_state as string | undefined) ?? null
          : null,
    };
  });
  if (r === null) {
    return {
      ok: false,
      reason: "ownership_not_verified",
      message: "Database unreachable · cannot verify ownership.",
    };
  }
  if (!r.hasClaim) {
    return {
      ok: false,
      reason: "ownership_not_verified",
      message:
        "No VERIFIED business_claim row for this account + canonical business id.",
    };
  }
  if (
    r.lifecycleState !== "OWNER_CLAIMED" &&
    r.lifecycleState !== "OWNER_VERIFIED"
  ) {
    return {
      ok: false,
      reason: "canonical_not_claimed",
      message: `Canonical row lifecycle_state is "${r.lifecycleState ?? "null"}" · expected OWNER_CLAIMED or OWNER_VERIFIED.`,
    };
  }
  return { ok: true, lifecycleState: r.lifecycleState };
}

// ─── private · image processing (strip EXIF, resize, encode webp) ─

async function processImage(buffer: Buffer): Promise<
  | {
      ok: true;
      data: Buffer;
      widthPx: number;
      heightPx: number;
      contentSha256: string;
    }
  | {
      ok: false;
      reason: "image_decode_failed" | "image_too_small" | "image_too_large";
      message: string;
    }
> {
  let meta: SharpMetadata;
  try {
    // .rotate() with no arg bakes EXIF orientation into pixels · subsequent
    // encoding drops EXIF so GPS / camera tags cannot leak out of NEX.
    const image = sharp(buffer).rotate();
    meta = await image.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w === 0 || h === 0) {
      return {
        ok: false,
        reason: "image_decode_failed",
        message: "Image dimensions could not be read.",
      };
    }
    if (w < OWNER_UPLOAD_MIN_EDGE_PX || h < OWNER_UPLOAD_MIN_EDGE_PX) {
      return {
        ok: false,
        reason: "image_too_small",
        message: `Image ${w}×${h} is smaller than ${OWNER_UPLOAD_MIN_EDGE_PX}px minimum edge.`,
      };
    }
    const needsResize = Math.max(w, h) > OWNER_UPLOAD_MAX_EDGE_PX;
    const sized = needsResize
      ? image.resize({
          width: OWNER_UPLOAD_MAX_EDGE_PX,
          height: OWNER_UPLOAD_MAX_EDGE_PX,
          fit: "inside",
          withoutEnlargement: true,
        })
      : image;
    const output = await sized
      .webp({ quality: OWNER_UPLOAD_WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    if (output.data.length > OWNER_UPLOAD_MAX_BYTES) {
      return {
        ok: false,
        reason: "image_too_large",
        message: `Encoded image ${output.data.length} bytes exceeds the ${OWNER_UPLOAD_MAX_BYTES}-byte cap after resize.`,
      };
    }
    const contentSha256 = createHash("sha256").update(output.data).digest("hex");
    return {
      ok: true,
      data: output.data,
      widthPx: output.info.width,
      heightPx: output.info.height,
      contentSha256,
    };
  } catch (e) {
    return {
      ok: false,
      reason: "image_decode_failed",
      message: e instanceof Error ? e.message : "Unknown decode error.",
    };
  }
}

// ─── private · storage upload ─────────────────────────────────────

async function uploadToStorage(
  canonicalBusinessId: NexUuid,
  data: Buffer,
): Promise<{ ok: true; storageKey: string } | { ok: false; message: string }> {
  const storageKey = `business/${canonicalBusinessId}/owner-upload/${randomUUID()}.webp`;
  const { error } = await nexSupabaseAdmin.storage
    .from(OWNER_UPLOAD_BUCKET)
    .upload(storageKey, data, {
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
      upsert: false,
    });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, storageKey };
}

// ─── private · DB insert ──────────────────────────────────────────

async function insertBusinessMediaRow(args: {
  readonly canonicalBusinessId: NexUuid;
  readonly storageKey: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly contentSha256: string;
}): Promise<{ ok: true; mediaId: string } | { ok: false; message: string }> {
  try {
    const r = await withClient(async (client) =>
      client.query(
        `INSERT INTO nex.business_media
           (canonical_business_id, media_kind, source_id, storage_key,
            mime_type, width_px, height_px, content_sha256,
            owner_approved, approved)
         VALUES ($1, 'owner_image', $2, $3,
                 'image/webp', $4, $5, $6,
                 true, false)
         RETURNING media_id`,
        [
          args.canonicalBusinessId,
          OWNER_UPLOAD_SOURCE_ID,
          args.storageKey,
          args.widthPx,
          args.heightPx,
          args.contentSha256,
        ],
      ),
    );
    if (r === null || r.rows.length === 0) {
      return { ok: false, message: "INSERT returned no rows." };
    }
    const row = r.rows[0] as { media_id?: unknown };
    const mediaId = typeof row.media_id === "string" ? row.media_id : null;
    if (!mediaId) {
      return { ok: false, message: "INSERT returned no media_id." };
    }
    return { ok: true, mediaId };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Unknown DB error.",
    };
  }
}

// ─── public · the one entry point ─────────────────────────────────

/**
 * Perform an owner-upload. Returns a tagged result · never throws
 * (except NexTierLimitError from the entitlement guard, which the
 * caller surfaces as an HTTP 429 or 403).
 */
export async function performOwnerUpload(
  input: OwnerUploadInput,
): Promise<OwnerUploadResult> {
  // Step 1 · input validation (pure, no I/O).
  const inputProblem = validateOwnerUploadInput(input);
  if (inputProblem !== null) return inputProblem;

  // Step 2 · ownership chain (DB).
  const ownership = await verifyOwnershipChain(
    input.canonicalBusinessId,
    input.ownerAccountId,
  );
  if (!ownership.ok) return ownership;

  // Step 3 · entitlement cap (DB). Reuses the thumbnail-entitlement
  // module built in Phase 2b-prep. Throws NexTierLimitError when at
  // or over the cap · we convert to a tagged result.
  try {
    await assertCanAddThumbnail(input.canonicalBusinessId);
  } catch (e) {
    if (e instanceof NexTierLimitError) {
      return {
        ok: false,
        reason: "entitlement_cap_reached",
        message: e.message,
      };
    }
    throw e;
  }

  // Step 4 · image processing (CPU, no I/O).
  const processed = await processImage(input.file.buffer);
  if (!processed.ok) return processed;

  // Step 5 · storage upload.
  const stored = await uploadToStorage(input.canonicalBusinessId, processed.data);
  if (!stored.ok) {
    return { ok: false, reason: "storage_failed", message: stored.message };
  }

  // Step 6 · DB insert.
  const inserted = await insertBusinessMediaRow({
    canonicalBusinessId: input.canonicalBusinessId,
    storageKey: stored.storageKey,
    widthPx: processed.widthPx,
    heightPx: processed.heightPx,
    contentSha256: processed.contentSha256,
  });
  if (!inserted.ok) {
    // Best-effort cleanup of the orphan storage object. We don't fail
    // on cleanup errors · the row never landed so the orphan is just
    // bytes without a referrer.
    void nexSupabaseAdmin.storage
      .from(OWNER_UPLOAD_BUCKET)
      .remove([stored.storageKey])
      .catch(() => {
        /* swallow */
      });
    return { ok: false, reason: "db_write_failed", message: inserted.message };
  }

  return {
    ok: true,
    mediaId: inserted.mediaId,
    storageKey: stored.storageKey,
    mimeType: "image/webp",
    widthPx: processed.widthPx,
    heightPx: processed.heightPx,
    bytes: processed.data.length,
    contentSha256: processed.contentSha256,
  };
}
