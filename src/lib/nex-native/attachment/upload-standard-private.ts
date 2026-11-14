// src/lib/nex-native/attachment/upload-standard-private.ts
//
// P1.T06 · client-side helper for private standard-send uploads.
// Owner-authorised 2026-11-13.
// -----------------------------------------------------------------------------
// Wraps POST /api/nex-native/attachment/standard. The bytes are
// plaintext (not encrypted) · the sender has explicitly opted into
// plaintext via the block-prompt "Send as standard" button. The
// server lands them in the sealed PRIVATE bucket (not the public
// chat-attachments bucket) under the `std/` prefix. Retrieval is
// participant-gated via the sealed signed-URL mint.
//
// Why a separate helper from uploadEncryptedAttachment:
//   · No crypto layer · the bytes go on the wire as-is.
//   · No per-device wrapped keys · the message row doesn't carry an
//     encryption envelope · access control is 100% participant-gated
//     signed URL.
//   · Different error surface · "unsupported_mime" / "too_large" /
//     "private_bucket_unavailable" rather than crypto-derived errors.

"use client";

export interface UploadStandardPrivateResult {
  readonly ok: true;
  readonly storagePath: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

export interface UploadStandardPrivateFailure {
  readonly ok: false;
  readonly error:
    | "not_signed_in"
    | "unsupported_mime"
    | "too_large"
    | "empty"
    | "private_bucket_unavailable"
    | "storage_upload"
    | "network"
    | "unknown";
  readonly message?: string;
}

export type UploadStandardPrivateOutcome =
  | UploadStandardPrivateResult
  | UploadStandardPrivateFailure;

export interface UploadStandardPrivateOptions {
  readonly file: File;
  /** Short safe extension hint · defence-in-depth. The server allowlist
   *  still filters · caller only has to try. */
  readonly extHint?: string | null;
}

const ENDPOINT = "/api/nex-native/attachment/standard";

export async function uploadStandardPrivate(
  opts: UploadStandardPrivateOptions,
): Promise<UploadStandardPrivateOutcome> {
  const file = opts.file;
  const contentType = file.type || "application/octet-stream";
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch (e) {
    return {
      ok: false,
      error: "unknown",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  let resp: Response;
  try {
    resp = await fetch(ENDPOINT, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": contentType,
        ...(opts.extHint ? { "x-nex-enc-ext": opts.extHint } : {}),
      },
      body: bytes as unknown as BodyInit,
    });
  } catch (e) {
    return {
      ok: false,
      error: "network",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  if (!resp.ok) {
    let errorCode: UploadStandardPrivateFailure["error"] = "unknown";
    let message: string | undefined;
    try {
      const body = (await resp.json()) as { error?: string; detail?: string };
      message = body.detail ?? body.error;
      const e = body.error ?? "";
      if (
        e === "not_signed_in" ||
        e === "unsupported_mime" ||
        e === "too_large" ||
        e === "empty" ||
        e === "private_bucket_unavailable"
      ) {
        errorCode = e;
      } else if (e.startsWith("storage_upload")) {
        errorCode = "storage_upload";
      }
    } catch {
      // Non-JSON body · keep unknown.
    }
    if (resp.status === 401) errorCode = "not_signed_in";
    if (resp.status === 413) errorCode = "too_large";
    if (resp.status === 415) errorCode = "unsupported_mime";
    if (resp.status === 503) errorCode = "private_bucket_unavailable";
    return { ok: false, error: errorCode, message };
  }

  const json = (await resp.json()) as {
    ok?: boolean;
    storage_path?: string;
    content_type?: string;
    size_bytes?: number;
  };
  if (
    !json.ok ||
    typeof json.storage_path !== "string" ||
    typeof json.content_type !== "string" ||
    typeof json.size_bytes !== "number"
  ) {
    return { ok: false, error: "unknown", message: "malformed_response" };
  }
  return {
    ok: true,
    storagePath: json.storage_path,
    contentType: json.content_type,
    sizeBytes: json.size_bytes,
  };
}
