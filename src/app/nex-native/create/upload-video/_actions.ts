"use server";

// src/app/nex-native/create/upload-video/_actions.ts
//
// Owner-authorised 2026-11-05 iter 24 · server action for the Create
// → Video journey. Receives the FormData posted by _upload-client:
//   · video        · File · the uploaded video blob
//   · title        · string (required)
//   · caption      · string (optional)
//   · duration     · number (seconds · client-probed)
//   · width        · number (optional · client-probed)
//   · height       · number (optional · client-probed)
//   · rights       · "owner_content" (currently the only accepted
//     value · follow-up expands to licensed / public_domain).
//   · country      · ISO-3166 alpha-2 · defaults "IE"
//
// Flow:
//   1. Resolve viewer session (server-side) · reject if guest.
//   2. Validate file metadata (size, duration).
//   3. Upload to Supabase storage bucket `nex-live-uploaded` at path
//      `<account-id>/<uuid>.<ext>`.
//   4. Call publishUploadedVideo with the stored path + metadata.
//   5. Redirect to /nex-native/nex-feed on success so the user
//      lands on the feed where their video will appear (feed sort
//      honours most-recent for same-day uploads).
//
// Never trusts the client's claim of ownerAccountId · pulled from
// session server-side.

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  publishUploadedVideo,
  type UploadedVideoMimeType,
  type UploadedVideoRightsDeclaration,
} from "@/lib/nex-native/live-broadcast/uploaded-video-service";
import { SHOP_VIDEO_MAX_SECONDS } from "@/lib/nex-native/billing/enforcement";

const BUCKET = "nex-live-uploaded";
const MAX_BYTES = 100 * 1024 * 1024;

const ACCEPTED_MIMES: ReadonlyArray<UploadedVideoMimeType> = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
];

export type UploadVideoActionResult =
  | { readonly ok: true; readonly videoId: string }
  | {
      readonly ok: false;
      readonly reason:
        | "no-session"
        | "no-file"
        | "file-too-large"
        | "duration-too-long"
        | "duration-missing"
        | "bad-mime"
        | "empty-title"
        | "storage-failed"
        | "publish-failed";
      readonly detail?: string;
    };

export async function uploadVideoAction(
  formData: FormData,
): Promise<UploadVideoActionResult> {
  const session = await resolveSessionWithDevOverride().catch(() => null);
  if (!session) return { ok: false, reason: "no-session" };

  const file = formData.get("video");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, reason: "no-file" };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      reason: "file-too-large",
      detail: `${file.size} bytes · limit ${MAX_BYTES}`,
    };
  }
  const mime = file.type as UploadedVideoMimeType;
  if (!ACCEPTED_MIMES.includes(mime)) {
    return { ok: false, reason: "bad-mime", detail: file.type };
  }

  const title = (formData.get("title") ?? "").toString().trim();
  if (title.length === 0) return { ok: false, reason: "empty-title" };
  const caption = (formData.get("caption") ?? "").toString().trim() || null;

  const durationRaw = Number(formData.get("duration"));
  if (!Number.isFinite(durationRaw) || durationRaw <= 0) {
    return { ok: false, reason: "duration-missing" };
  }
  const duration = Math.round(durationRaw);
  if (duration > SHOP_VIDEO_MAX_SECONDS) {
    return {
      ok: false,
      reason: "duration-too-long",
      detail: `${duration}s · limit ${SHOP_VIDEO_MAX_SECONDS}s`,
    };
  }
  const widthRaw = Number(formData.get("width"));
  const heightRaw = Number(formData.get("height"));
  const width = Number.isFinite(widthRaw) && widthRaw > 0 ? Math.round(widthRaw) : null;
  const height = Number.isFinite(heightRaw) && heightRaw > 0 ? Math.round(heightRaw) : null;

  const country = ((formData.get("country") ?? "IE").toString().trim() || "IE")
    .slice(0, 2)
    .toUpperCase();
  const rights = ((formData.get("rights") ?? "owner_content")
    .toString()
    .trim() || "owner_content") as UploadedVideoRightsDeclaration;

  // Storage path · <owner-id>/<uuid>.<ext>. Extension derived from
  // the MIME (not the client-supplied filename, to avoid path-
  // traversal / exotic extensions).
  const ext =
    mime === "video/mp4"
      ? "mp4"
      : mime === "video/quicktime"
        ? "mov"
        : "webm";
  const objectPath = `${session.account.id}/${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await nexSupabaseAdmin.storage
    .from(BUCKET)
    .upload(objectPath, buffer, {
      contentType: mime,
      upsert: false,
    });
  if (uploadErr) {
    return {
      ok: false,
      reason: "storage-failed",
      detail: uploadErr.message,
    };
  }

  let publishedId: string;
  try {
    const row = await publishUploadedVideo({
      ownerAccountId: session.account.id,
      title,
      caption,
      storageBucket: BUCKET,
      storageObjectPath: objectPath,
      durationSeconds: duration,
      width,
      height,
      byteSize: file.size,
      mimeType: mime,
      rightsDeclaration: rights,
      countryOfOrigin: country,
      visibility: "public",
      isAiGenerated: false,
    });
    publishedId = row.id;
  } catch (err) {
    // Best-effort cleanup · orphan storage objects accumulate when
    // the DB insert fails · remove so storage stays tidy.
    try {
      await nexSupabaseAdmin.storage.from(BUCKET).remove([objectPath]);
    } catch {
      /* ignore cleanup failures */
    }
    const msg =
      err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "publish-failed", detail: msg };
  }
  // Redirect OUTSIDE the try so Next's NEXT_REDIRECT throw isn't
  // caught by the publish-failed handler.
  redirect(`/nex-native/nex-feed/${publishedId}`);
}
