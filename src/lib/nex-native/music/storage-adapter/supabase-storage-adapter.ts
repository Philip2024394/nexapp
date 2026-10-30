// src/lib/nex-native/music/storage-adapter/supabase-storage-adapter.ts
//
// Owner-authorised 2026-10-31 (music-upload-audit · Phase B draft) ·
// production storage adapter against Supabase Storage.
//
// STATUS: DRAFT · NOT ENABLED by default. The factory in `index.ts`
// still returns the FS dev adapter in dev and THROWS in prod. This
// file is wired in only when:
//   1. H2 is sealed (sealed memory 2026-10-30 · "production storage
//      adapter · recommended Supabase Storage behind NEX proxy") AND
//   2. Env `NEX_MUSIC_STORAGE=supabase` is explicitly set AND
//   3. The owner has verified the bucket exists with the correct
//      policies.
//
// Design points (match the MusicMediaStorage contract · types.ts)
// ----------------------------------------------------------------
//   · One bucket `nex-music-media`. Objects live at
//     `{ownerAccountId}/{objectKey}` so RLS policies can gate on path
//     prefix if the bucket is ever opened up.
//   · `reference` is an opaque `sb://{ownerAccountId}/{objectKey}`
//     string. Callers never see Supabase URLs directly; the proxy
//     route `/api/nex-native/music/stream` continues to mint signed
//     reads, matching the fs-dev-adapter contract.
//   · Signed URLs are produced by `supabase.storage.createSignedUrl`
//     with a short TTL (<= 3600s per the type contract). Caller holds
//     ownership · we double-check ownership on every signed-URL
//     request.
//   · All methods use the service_role admin client (`nexSupabaseAdmin`).
//     Never a client-side anon key.
//
// NOT included · still owner decisions (unsealed)
//   · Bucket creation/migration (one-time ops task).
//   · RLS policies on storage.objects for this bucket.
//   · CDN / proxy / cache strategy.
//   · Lifecycle rules (expiry of orphan uploads).
//   · V7 verification against staging before enabling in prod.

import "server-only";
import type {
  MusicMediaStorage,
  PutObjectArgs,
  SignedReadUrlArgs,
  SignedReadUrlResult,
} from "./types";
import { nexSupabaseAdmin } from "../../supabase-admin";

const BUCKET = "nex-music-media";

function sanitiseKeyPart(part: string): string {
  // Match the dev adapter's sanitiser so an owner_account_id or
  // object_key from the DB layer is accepted identically.
  return part.replace(/[^A-Za-z0-9._-]/g, "_");
}

function pathFor(ownerAccountId: string, objectKey: string): string {
  return `${sanitiseKeyPart(ownerAccountId)}/${sanitiseKeyPart(objectKey)}`;
}

function referenceFor(ownerAccountId: string, objectKey: string): string {
  return `sb://${sanitiseKeyPart(ownerAccountId)}/${sanitiseKeyPart(objectKey)}`;
}

function parseReference(
  ref: string,
): { ownerAccountId: string; objectKey: string } | null {
  if (!ref.startsWith("sb://")) return null;
  const rest = ref.slice(5);
  const parts = rest.split("/");
  if (parts.length !== 2) return null;
  const [owner, key] = parts;
  if (!owner || !key) return null;
  return {
    ownerAccountId: sanitiseKeyPart(owner),
    objectKey: sanitiseKeyPart(key),
  };
}

/** Owner-authorised 2026-10-31 · DRAFT · not enabled until H2 seal. */
export const supabaseMusicStorageAdapter: MusicMediaStorage = {
  async putObject(args: PutObjectArgs): Promise<{ reference: string }> {
    const objectPath = pathFor(args.ownerAccountId, args.objectKey);
    const { error } = await nexSupabaseAdmin.storage
      .from(BUCKET)
      .upload(objectPath, args.bytes, {
        contentType: args.contentType,
        upsert: false, // owner_account_id/object_key is already unique
        cacheControl: "no-store", // signed URLs enforce freshness
      });
    if (error) {
      throw new Error(
        `supabase-music-storage.putObject(${objectPath}): ${error.message}`,
      );
    }
    return { reference: referenceFor(args.ownerAccountId, args.objectKey) };
  },

  async getSignedReadUrl(
    args: SignedReadUrlArgs,
  ): Promise<SignedReadUrlResult> {
    const parsed = parseReference(args.reference);
    if (!parsed) {
      throw new Error(
        `supabase-music-storage.getSignedReadUrl: bad reference ${args.reference}`,
      );
    }
    // Ownership double-check at the adapter boundary. Caller is also
    // expected to gate — this is defence-in-depth so a leaked
    // reference can't be read by an unrelated account_id.
    if (parsed.ownerAccountId !== sanitiseKeyPart(args.ownerAccountId)) {
      throw new Error(
        `supabase-music-storage.getSignedReadUrl: reference owner mismatch`,
      );
    }
    const ttl = Math.min(Math.max(args.expiresInSeconds, 1), 3600);
    const objectPath = `${parsed.ownerAccountId}/${parsed.objectKey}`;
    const { data, error } = await nexSupabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(objectPath, ttl);
    if (error || !data) {
      throw new Error(
        `supabase-music-storage.createSignedUrl(${objectPath}): ${error?.message ?? "no url returned"}`,
      );
    }
    return {
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + ttl * 1000),
    };
  },

  async deleteObject(args: { reference: string }): Promise<{
    deleted: boolean;
  }> {
    const parsed = parseReference(args.reference);
    if (!parsed) return { deleted: false };
    const objectPath = `${parsed.ownerAccountId}/${parsed.objectKey}`;
    const { error } = await nexSupabaseAdmin.storage
      .from(BUCKET)
      .remove([objectPath]);
    if (error) {
      // Storage API returns success for non-existent paths · a real
      // error here (network, auth) is honest-to-report.
      return { deleted: false };
    }
    return { deleted: true };
  },

  async objectExists(args: {
    reference: string;
  }): Promise<{ exists: boolean; byteLength?: number }> {
    const parsed = parseReference(args.reference);
    if (!parsed) return { exists: false };
    // list() under the owner prefix with the exact key as a search is
    // the standard Supabase pattern (there is no direct `stat`).
    const { data, error } = await nexSupabaseAdmin.storage
      .from(BUCKET)
      .list(parsed.ownerAccountId, { search: parsed.objectKey, limit: 1 });
    if (error || !data || data.length === 0) return { exists: false };
    const match = data.find((o) => o.name === parsed.objectKey);
    if (!match) return { exists: false };
    const size = (match.metadata as { size?: number } | null)?.size;
    return typeof size === "number"
      ? { exists: true, byteLength: size }
      : { exists: true };
  },
};
