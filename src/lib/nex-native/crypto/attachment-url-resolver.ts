// src/lib/nex-native/crypto/attachment-url-resolver.ts
//
// P1.T05 · private-attachment signed-URL resolver · owner-authorised
// 2026-11-13.
// -----------------------------------------------------------------------------
// New encrypted attachments live in the private `nex-peer-chat-ciphertext`
// bucket with no public URL. The envelope carries `storage_path`; the
// recipient must mint a short-lived signed URL via
//   GET /api/nex-native/attachment/encrypted/signed?path=<storage_path>
// before it can fetch and decrypt the ciphertext.
//
// This helper centralises that mint call. Both the image/video/audio
// decryptor path (`fetchAndDecryptAttachment`) and the document
// chip path (`fetchAndDecryptDocument`) call it before doing a
// ciphertext fetch.
//
// Legacy envelopes (written BEFORE the sealed private-bucket
// migration) carry `storage_url` and NO `storage_path`. Those are
// public URLs · we return them as-is so historical attachments keep
// working.
//
// Failure modes (resolver returns null):
//   · Envelope has neither storage_path nor storage_url.
//   · Mint endpoint non-2xx (401 not signed in, 404 not participant
//     or object not found, 503 bucket unavailable, 500 sign failed).
//   · Mint endpoint returns malformed JSON.
//   · Fetch throws (network error, abort).
//
// The resolver NEVER silently falls back to a plaintext URL. It also
// NEVER logs the signed URL or the storage path in production code.

"use client";

export interface ResolveCiphertextFetchUrlInput {
  /** Either or both of these may be set. Resolver prefers
   *  `storage_path` (new private-bucket path) and falls back to
   *  `storage_url` (legacy public-bucket URL) only if path is absent. */
  readonly storage_path?: string;
  readonly storage_url?: string;
}

export interface ResolverOptions {
  /** Overrideable fetcher · tests pass a mock. Defaults to the
   *  global fetch. */
  readonly fetchFn?: typeof fetch;
  /** Optional abort signal · caller can cancel slow mint requests. */
  readonly signal?: AbortSignal;
  /** Path of the signed-URL mint route. Overridable for tests · in
   *  production this stays the sealed endpoint. */
  readonly signedUrlEndpoint?: string;
}

const DEFAULT_SIGNED_URL_ENDPOINT = "/api/nex-native/attachment/encrypted/signed";

/** Resolve an encrypted attachment envelope to a fetchable URL.
 *  Returns null on any failure · callers surface that to the user as
 *  "couldn't retrieve attachment". The resolver NEVER throws into
 *  the caller. */
export async function resolveCiphertextFetchUrl(
  envelope: ResolveCiphertextFetchUrlInput,
  options?: ResolverOptions,
): Promise<string | null> {
  const fetchFn = options?.fetchFn ?? fetch;
  const endpoint = options?.signedUrlEndpoint ?? DEFAULT_SIGNED_URL_ENDPOINT;

  // Prefer private-bucket path (new) over legacy public URL.
  if (envelope.storage_path && envelope.storage_path.length > 0) {
    try {
      const url = `${endpoint}?path=${encodeURIComponent(envelope.storage_path)}`;
      const resp = await fetchFn(url, {
        method: "GET",
        credentials: "include",
        signal: options?.signal,
      });
      if (!resp.ok) return null;
      const json = (await resp.json()) as {
        ok?: boolean;
        signed_url?: string;
        error?: string;
      };
      if (!json.ok || typeof json.signed_url !== "string" || json.signed_url.length === 0) {
        return null;
      }
      return json.signed_url;
    } catch {
      return null;
    }
  }
  // Legacy fallback · public-bucket URL · used by envelopes written
  // before the private-bucket migration. Direct fetch of this URL
  // succeeds without any auth check, but the content is already
  // ciphertext so decryption still requires the content key.
  if (envelope.storage_url && envelope.storage_url.length > 0) {
    return envelope.storage_url;
  }
  return null;
}
