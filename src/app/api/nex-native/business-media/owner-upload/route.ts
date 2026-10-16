// src/app/api/nex-native/business-media/owner-upload/route.ts
//
// POST · authenticated business-owner image upload.
// Founder-authorised 2026-10-13 · Priority 1 of the image pipeline.
//
// Request shape:
//   Content-Type: multipart/form-data
//   fields:
//     canonical_business_id (uuid)
//     file (image/webp | jpeg | png · max 5 MB)
//
// Response shape:
//   200 {ok:true, media_id, storage_key, mime_type, width_px, height_px, bytes}
//   400 {ok:false, reason, message}   · validation errors
//   401 {ok:false, reason:"not_authenticated"}
//   403 {ok:false, reason:"ownership_not_verified"|"canonical_not_claimed"}
//   413 {ok:false, reason:"input_too_large"|"image_too_large"}
//   415 {ok:false, reason:"input_mime_not_allowed"|"image_decode_failed"}
//   429 {ok:false, reason:"entitlement_cap_reached"}
//   500 {ok:false, reason:"storage_failed"|"db_write_failed"}
//
// This route is THE ONLY entry point into performOwnerUpload. The
// service is server-only and refuses to run from any other path.

import { NextResponse } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import {
  performOwnerUpload,
  type OwnerUploadResult,
} from "@/lib/nex-native/business-media/owner-upload-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Maps the service's tagged `reason` to HTTP status. */
function statusForReason(reason: Extract<OwnerUploadResult, { ok: false }>["reason"]): number {
  switch (reason) {
    case "not_authenticated":
      return 401;
    case "ownership_not_verified":
    case "canonical_not_claimed":
      return 403;
    case "input_too_large":
    case "image_too_large":
      return 413;
    case "input_mime_not_allowed":
    case "image_decode_failed":
      return 415;
    case "entitlement_cap_reached":
      return 429;
    case "input_empty":
    case "image_too_small":
      return 400;
    case "storage_failed":
    case "db_write_failed":
      return 500;
    default: {
      // Exhaustive via TS never-check.
      const _exhaustive: never = reason;
      void _exhaustive;
      return 500;
    }
  }
}

export async function POST(req: Request): Promise<Response> {
  // ─── auth ───────────────────────────────────────────────────────
  const session = await resolveNexAppSession(req);
  if (session === null) {
    return NextResponse.json(
      { ok: false, reason: "not_authenticated", message: "Sign-in required." },
      { status: 401 },
    );
  }

  // ─── parse multipart form ───────────────────────────────────────
  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        reason: "input_empty",
        message:
          e instanceof Error
            ? `Could not parse multipart body: ${e.message}`
            : "Could not parse multipart body.",
      },
      { status: 400 },
    );
  }

  const canonicalBusinessId = form.get("canonical_business_id");
  const file = form.get("file");

  if (typeof canonicalBusinessId !== "string" || canonicalBusinessId.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        reason: "input_empty",
        message: "canonical_business_id form field is missing or empty.",
      },
      { status: 400 },
    );
  }
  // Defensive UUID shape check · the service will fail on the DB side too
  // but failing fast here keeps bad input out of the heavier path.
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      canonicalBusinessId,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        reason: "input_empty",
        message: "canonical_business_id is not a valid UUID.",
      },
      { status: 400 },
    );
  }
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      {
        ok: false,
        reason: "input_empty",
        message: "file form field is missing or not a file.",
      },
      { status: 400 },
    );
  }

  // ─── buffer the file (bounded by the service's size cap) ────────
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ─── delegate to the service ────────────────────────────────────
  const result = await performOwnerUpload({
    canonicalBusinessId,
    ownerAccountId: session.account.id,
    file: {
      buffer,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: buffer.length,
    },
  });

  if (result.ok) {
    return NextResponse.json(
      {
        ok: true,
        media_id: result.mediaId,
        storage_key: result.storageKey,
        mime_type: result.mimeType,
        width_px: result.widthPx,
        height_px: result.heightPx,
        bytes: result.bytes,
        content_sha256: result.contentSha256,
        approved: false,
        owner_approved: true,
        display_pending_admin_approval: true,
      },
      { status: 201 },
    );
  }

  return NextResponse.json(
    { ok: false, reason: result.reason, message: result.message },
    { status: statusForReason(result.reason) },
  );
}
