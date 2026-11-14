// src/app/api/nex-native/attachment/standard/route.ts
//
// P1.T06 · private standard-send attachment upload · owner-authorised
// 2026-11-13.
// -----------------------------------------------------------------------------
// Companion to /api/nex-native/attachment/encrypted. This route handles
// the SENDER-OPT-IN plaintext path ("Send as standard") that used to
// land in the public `nex-peer-chat-attachments` bucket. P1.T06 routes
// those same bytes into the sealed PRIVATE bucket
// (`nex-peer-chat-ciphertext`, reused as a private-byte store) under
// the `std/` prefix. Retrieval is participant-gated via the sealed
// signed-URL mint at /api/nex-native/attachment/encrypted/signed.
//
// What this route does NOT do:
//   · It does NOT silently encrypt the bytes. The sender explicitly
//     chose plaintext via the block-prompt "Send as standard" button
//     (or by using NEX1 Official which is plaintext by doctrine ·
//     NEX1 continues to use the PUBLIC path separately).
//   · It does NOT weaken access control. The bucket is private · the
//     ONLY retrieval path is the participant-gated signed URL mint.
//   · It does NOT touch the public `nex-peer-chat-attachments` bucket
//     or any historical URLs stored on existing message rows.
//
// Request:
//   · POST, session cookie required.
//   · Body: raw plaintext bytes (image/video/audio/document).
//   · Headers:
//       content-type: the file's original MIME · echoed back to the
//                     client so composer + recipient can render
//                     appropriately. Persisted as attachment_meta
//                     `.content_type` on the message row.
//       x-nex-enc-ext: short extension hint · defence-in-depth, same
//                      allowlist as the encrypted route.
//
// Response:
//   { ok, storage_path, bucket, size_bytes, content_type }
// On failure: { ok: false, error } with a conventional HTTP status.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { NEX_PEER_ATTACHMENT_MAX_BYTES } from "@/lib/nex-native/peer-message-service";
import {
  PRIVATE_CIPHERTEXT_BUCKET,
  ensurePrivateBucketReady,
} from "@/lib/nex-native/attachment/bucket-config";
// Stage 6 · P0 safety net · item 3 · 2026-11-14 · rate-limit the
// standard-send upload BEFORE buffering 25 MB of request body. Both
// per-account AND per-IP keys to resist both flood-from-single-session
// and distributed-session floods. Uses the sealed "chat_message"
// policy (60 per hour) since this is part of the chat send pipeline.
import {
  accountRateLimitKey,
  ipRateLimitKey,
  isSecurityRateLimitError,
  isSecurityUnavailableError,
  recordIfAllowed,
} from "@/lib/nex-native/security-rate-limit";
import { readClientIp } from "@/lib/nex-native/app/security-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = NEX_PEER_ATTACHMENT_MAX_BYTES + 1024;
const STANDARD_PREFIX = "std";

// MIME allowlist mirrors the plaintext peer-message pipeline (images,
// video, audio, documents). Anything outside this set is rejected so
// an attacker can't smuggle an executable or exotic MIME into the
// private bucket under the standard-send route.
const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"];
const ALLOWED_DOC_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/csv",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);

function isAllowedMime(mime: string): boolean {
  const m = mime.toLowerCase();
  if (ALLOWED_MIME_PREFIXES.some((p) => m.startsWith(p))) return true;
  return ALLOWED_DOC_MIMES.has(m);
}

function safeExt(raw: string | null): string {
  if (!raw) return "bin";
  const cleaned = raw.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (cleaned.length === 0 || cleaned.length > 6) return "bin";
  const whitelist = new Set([
    "bin",
    "png", "jpg", "jpeg", "webp", "gif", "avif",
    "mp4", "webm", "mov",
    "m4a", "mp3", "ogg", "wav", "opus",
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "txt", "csv", "zip",
  ]);
  return whitelist.has(cleaned) ? cleaned : "bin";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "not_signed_in" },
      { status: 401 },
    );
  }

  // Stage 6 · P0 safety net · item 3 · 2026-11-14 · rate-limit the
  // upload BEFORE buffering 25 MB of request body. Belt + braces:
  //   · Per-account key catches a compromised session spamming uploads.
  //   · Per-IP key catches an attacker rotating sessions.
  // The sealed "chat_message" policy is 60 per hour · same cap the
  // encrypted send route rides.  429 (rate_limited) on throttle · 503
  // (service_unavailable) when the limiter is down. Both responses
  // include retry_after_seconds so the client can back off cleanly.
  const clientIp = readClientIp(req);
  try {
    await recordIfAllowed(accountRateLimitKey(session.account.id), "chat_message");
    await recordIfAllowed(ipRateLimitKey(clientIp), "chat_message");
  } catch (e) {
    if (isSecurityUnavailableError(e)) {
      return NextResponse.json(
        {
          ok: false,
          error: "service_unavailable",
          retry_after_seconds: e.retryAfterSeconds,
        },
        {
          status: 503,
          headers: { "Retry-After": String(e.retryAfterSeconds) },
        },
      );
    }
    if (isSecurityRateLimitError(e)) {
      return NextResponse.json(
        {
          ok: false,
          error: "rate_limited",
          retry_after_seconds: e.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(e.retryAfterSeconds) },
        },
      );
    }
    throw e;
  }

  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  // Strip any charset suffix for the MIME check (e.g., "text/plain;charset=utf-8").
  const mimeOnly = contentType.split(";")[0]!.trim();
  if (!mimeOnly || !isAllowedMime(mimeOnly)) {
    return NextResponse.json(
      { ok: false, error: "unsupported_mime" },
      { status: 415 },
    );
  }

  const ext = safeExt(req.headers.get("x-nex-enc-ext"));

  let bytes: Uint8Array;
  try {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, error: "too_large" },
        { status: 413 },
      );
    }
    if (buf.byteLength === 0) {
      return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
    }
    bytes = new Uint8Array(buf);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const objectPath = `${STANDARD_PREFIX}/${session.account.id}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  // Reuse the sealed private bucket. If it isn't provisioned, we
  // FAIL SAFE with 503 rather than falling back to the public bucket ·
  // the user sees an error and retries after the bucket is ready.
  const privateReady = await ensurePrivateBucketReady();
  if (!privateReady) {
    return NextResponse.json(
      {
        ok: false,
        error: "private_bucket_unavailable",
        detail:
          "the private attachment bucket is not available in this " +
          "environment · plaintext uploads are refused rather than " +
          "stored publicly · retry after the bucket is provisioned",
      },
      { status: 503, headers: { "Retry-After": "60" } },
    );
  }

  const bucket = nexSupabaseAdmin.storage.from(PRIVATE_CIPHERTEXT_BUCKET);
  // Upload with `application/octet-stream` so the bucket's sealed MIME
  // policy accepts the bytes · the real content-type is returned in
  // the response + stored on the message row so the recipient renders
  // the file correctly.
  const { error } = await bucket.upload(objectPath, bytes, {
    contentType: "application/octet-stream",
    upsert: false,
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: `storage_upload: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    storage_path: objectPath,
    bucket: PRIVATE_CIPHERTEXT_BUCKET,
    private: true,
    size_bytes: bytes.byteLength,
    content_type: mimeOnly,
  });
}
