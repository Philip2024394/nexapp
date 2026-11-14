// src/app/api/nex-native/attachment/encrypted/signed/route.ts
//
// NEX Chat Attachment · signed-access endpoint for encrypted
// ciphertext in the private bucket. Owner-authorised 2026-11-08.
// -----------------------------------------------------------------------------
// Flow
//   1. Client (recipient device) has decoded an envelope with a
//      `storage_path` field.
//   2. Client calls GET /api/nex-native/attachment/encrypted/signed?path=
//      <storage_path> with the session cookie.
//   3. Server verifies session · verifies path shape · looks up the
//      owning peer message · verifies the caller is a participant of
//      the owning conversation · generates a short-lived signed URL
//      (SIGNED_URL_TTL_SECONDS, default 900s).
//   4. Client fetches the signed URL directly to download the
//      ciphertext · decrypts locally with the content key it already
//      unwrapped.
//
// Security invariants
//   · Participant check is server-side and keyed to the authenticated
//     session's account id · the path alone is not sufficient.
//   · Non-participant callers get 404 (not 403) to avoid leaking
//     existence of the object to an attacker enumerating paths.
//   · Signed URLs are time-limited to SIGNED_URL_TTL_SECONDS · a
//     leaked URL expires on its own.
//   · The route never returns ciphertext bytes · only the signed URL.
//     Plaintext is never seen by the server.
//
// Backward compatibility
//   · Legacy envelopes with `storage_url` pointing at the public
//     bucket continue to work · the client fetches that URL directly
//     without calling this endpoint.
//   · This endpoint only services objects in the PRIVATE_CIPHERTEXT_BUCKET.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  PRIVATE_CIPHERTEXT_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  ensurePrivateBucketReady,
} from "@/lib/nex-native/attachment/bucket-config";
import {
  isValidPrivateAttachmentPath,
  verifyParticipantForCiphertext,
} from "@/lib/nex-native/attachment/attachment-participant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "not_signed_in" },
      { status: 401 },
    );
  }
  const url = new URL(req.url);
  const path = url.searchParams.get("path") ?? "";
  if (!isValidPrivateAttachmentPath(path)) {
    // Non-revealing · malformed input treated like not-found.
    // P1.T06 2026-11-13 · accepts both `enc/` (encrypted) and `std/`
    // (standard-send private plaintext · explicit sender opt-in)
    // path shapes. Both are participant-gated server-side.
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  }

  const participant = await verifyParticipantForCiphertext(
    session.account.id,
    path,
  );
  if (participant === "not-found" || participant === "not-participant") {
    // Collapse both to 404 · we do not leak whether the object exists
    // when the caller is not a participant.
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  }

  // Bucket must be live · if not, the upload would have fallen back
  // to the public bucket and the envelope would have storage_url not
  // storage_path. Returning 503 here surfaces the config gap honestly.
  const bucketReady = await ensurePrivateBucketReady();
  if (!bucketReady) {
    return NextResponse.json(
      { ok: false, error: "private_bucket_unavailable" },
      { status: 503, headers: { "Retry-After": "60" } },
    );
  }

  const { data, error } = await nexSupabaseAdmin.storage
    .from(PRIVATE_CIPHERTEXT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: "sign_failed",
        detail: error?.message ?? "no signed url returned",
      },
      { status: 500 },
    );
  }

  const expiresAt = new Date(
    Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  ).toISOString();
  return NextResponse.json({
    ok: true,
    signed_url: data.signedUrl,
    expires_at: expiresAt,
    ttl_seconds: SIGNED_URL_TTL_SECONDS,
  });
}
