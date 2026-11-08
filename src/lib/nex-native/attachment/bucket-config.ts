// src/lib/nex-native/attachment/bucket-config.ts
//
// NEX Chat Attachment Phase A · bucket configuration + probe.
// Owner-authorised 2026-11-08 · implementation mode.
// -----------------------------------------------------------------------------
// NEX runs two attachment buckets:
//   · PUBLIC_BUCKET   · nex-peer-chat-attachments · public read · hosts
//     venue + business-logo images + LEGACY plaintext attachments.
//     DO NOT upload new ciphertext here.
//   · PRIVATE_BUCKET  · nex-peer-chat-ciphertext · private · hosts all
//     new encrypted ciphertext · readable only via SECURITY DEFINER
//     signed-URL generation gated by conversation participation.
//
// Compatibility · the signed-access endpoint falls back to returning
// the direct PUBLIC_BUCKET URL for envelopes written BEFORE the
// migration · those still have `envelope.storage_url` pointing at the
// public bucket. New envelopes use `envelope.storage_path` only.
//
// Pre-bucket-creation compat · if the private bucket does not yet
// exist in Supabase Storage, the upload route logs a loud warning
// and falls back to the public bucket · identical safety pattern to
// the audit writer's AUDIT_TABLE_READY probe.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";

export const PUBLIC_ATTACHMENT_BUCKET = "nex-peer-chat-attachments";
export const PRIVATE_CIPHERTEXT_BUCKET = "nex-peer-chat-ciphertext";

/** Signed-URL TTL · 900 seconds per the owner-authorised Phase B plan. */
export const SIGNED_URL_TTL_SECONDS = 900;

// Probe cache for the lifetime of the process.
let PRIVATE_BUCKET_READY: boolean | null = null;

export async function ensurePrivateBucketReady(): Promise<boolean> {
  if (PRIVATE_BUCKET_READY !== null) return PRIVATE_BUCKET_READY;
  try {
    const { data, error } = await nexSupabaseAdmin.storage.getBucket(
      PRIVATE_CIPHERTEXT_BUCKET,
    );
    PRIVATE_BUCKET_READY = !error && !!data;
    if (!PRIVATE_BUCKET_READY) {
      // eslint-disable-next-line no-console
      console.warn(
        "[attachment-bucket] private ciphertext bucket not available · " +
          "new uploads fall back to the public bucket until the private " +
          "bucket is created (see migration 295 for the bucket config SQL).",
        { bucket: PRIVATE_CIPHERTEXT_BUCKET, error: error?.message ?? null },
      );
    }
    return PRIVATE_BUCKET_READY;
  } catch {
    PRIVATE_BUCKET_READY = false;
    return false;
  }
}

/** Exposed for tests. */
export function _resetBucketProbeForTests(): void {
  PRIVATE_BUCKET_READY = null;
}
