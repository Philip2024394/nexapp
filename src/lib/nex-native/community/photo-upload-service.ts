// src/lib/nex-native/community/photo-upload-service.ts
//
// NEX Community Noticeboard · Phase 2A.5 · photo upload pipeline.
//
// Responsibilities:
//   1. Accept a raw image buffer (<= 2 MB)
//   2. Strip EXIF (prevents GPS leak), normalise orientation
//   3. Resize so the longest edge is <= 1600 px
//   4. Encode as WebP (quality 82)
//   5. Upload to Supabase storage bucket `nex-community-photos`
//   6. Return storage_path for insertion into nex_community_card_photo
//
// Load-bearing invariants:
//   · All uploads flow through this module on the server. Clients
//     never get direct bucket write access (Phase 2A.5 sealed).
//   · The sealed 2 MB cap matches the DB CHECK on photo.bytes.
//   · Returned storage_path is the OBJECT KEY, NOT a signed URL.
//     The bucket is public-read, so callers can concatenate the
//     public URL prefix when rendering.

import "server-only";
import sharp from "sharp";
import { nexSupabaseAdmin } from "../supabase-admin";
import {
  NEX_COMMUNITY_PHOTO_BUCKET,
  NEX_COMMUNITY_PHOTO_MAX_BYTES,
} from "./types";

const MAX_EDGE_PX = 1600;
const WEBP_QUALITY = 82;

export interface ProcessedPhoto {
  storage_path: string;
  bytes: number;
  width_px: number;
  height_px: number;
}

/** Process + upload a single image. Caller must have already verified
 *  the user is authorised to attach a photo to this card (author only). */
export async function uploadLostFoundPhoto(input: {
  cardId: string;
  displayOrder: 0 | 1;
  file: { buffer: Buffer; mimeType: string; sizeBytes: number };
}): Promise<ProcessedPhoto> {
  // Input validation.
  if (!input.file.buffer || input.file.buffer.length === 0) {
    throw new Error("photo-upload-service · empty file buffer");
  }
  if (input.file.sizeBytes > NEX_COMMUNITY_PHOTO_MAX_BYTES) {
    throw new Error(
      `photo-upload-service · file ${input.file.sizeBytes}B exceeds ${NEX_COMMUNITY_PHOTO_MAX_BYTES}B cap`,
    );
  }
  if (
    !["image/webp", "image/jpeg", "image/png", "image/jpg"].includes(
      input.file.mimeType.toLowerCase(),
    )
  ) {
    throw new Error(
      `photo-upload-service · mime ${input.file.mimeType} not allowed`,
    );
  }

  // Strip EXIF + resize + encode webp. sharp's `.rotate()` with no arg
  // reads EXIF orientation and bakes it into the pixels, then subsequent
  // encoding drops metadata so GPS/camera tags cannot leak.
  const image = sharp(input.file.buffer).rotate();
  const meta = await image.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 32 || h < 32) {
    throw new Error(`photo-upload-service · image too small (${w}x${h})`);
  }

  const needsResize = Math.max(w, h) > MAX_EDGE_PX;
  const output = await (needsResize
    ? image.resize({ width: MAX_EDGE_PX, height: MAX_EDGE_PX, fit: "inside" })
    : image
  )
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  // Enforce the 2 MB cap AFTER encoding (strongest guarantee).
  if (output.data.length > NEX_COMMUNITY_PHOTO_MAX_BYTES) {
    throw new Error(
      `photo-upload-service · encoded ${output.data.length}B still exceeds ${NEX_COMMUNITY_PHOTO_MAX_BYTES}B cap`,
    );
  }

  const storagePath = `${input.cardId}/${input.displayOrder}-${Date.now()}.webp`;

  const { error } = await nexSupabaseAdmin.storage
    .from(NEX_COMMUNITY_PHOTO_BUCKET)
    .upload(storagePath, output.data, {
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
      upsert: false,
    });

  if (error) {
    throw new Error(`photo-upload-service · storage upload · ${error.message}`);
  }

  return {
    storage_path: storagePath,
    bytes: output.data.length,
    width_px: output.info.width,
    height_px: output.info.height,
  };
}

/** Build the public URL for a storage object. The bucket is public-read
 *  so no signed URL is needed. */
export function publicUrlFor(storagePath: string, supabaseUrl: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${NEX_COMMUNITY_PHOTO_BUCKET}/${storagePath}`;
}
