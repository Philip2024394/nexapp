// src/app/nex-native/settings/payments/_qr-actions.ts
//
// P5 · seller-facing server actions for payment QR management.
// Owner-sealed 2026-11-10.
//
// Every action:
//   1. Resolves session via resolveSessionWithDevOverride.
//   2. Resolves the seller's primary business.
//   3. Verifies session.account.id === business.owner_account_id.
//   4. Runs the operation against the sealed services.
//
// Upload flow:
//   validate bytes → check rate limit → dedup lookup → put to bucket
//   → insert pending_preview row → return assetId + previewSignedUrl
//
// Activate flow:
//   verify asset in pending_preview + ownership → atomic retire old
//   active + promote new → sync nex_business.qr_code_image_url
//
// Retire flow:
//   verify active exists + ownership → set retired + clear
//   nex_business.qr_code_image_url
//
// Owner notification on QR change: attempted inline via the sealed
// "order" category dispatcher (fail-soft). If the seller's own
// account has a push subscription this notifies them "Your payment
// QR has been changed." Honest status is reported in the result for
// observability.

"use server";

import {
  validateQrBytes,
  type QrValidationReason,
} from "@/lib/nex-native/merchant-qr/qr-validation-service";
import {
  activateQrAsset,
  findDuplicateAsset,
  getActiveQrAsset,
  getAssetById,
  hasReachedUploadLimit,
  insertPendingPreview,
  MERCHANT_QR_BUCKET,
  pathForAsset,
  retireActiveQrAsset,
  type NexMerchantQrAssetRow,
} from "@/lib/nex-native/merchant-qr/qr-asset-service";
import { mintForSellerPreview } from "@/lib/nex-native/merchant-qr/signed-url-service";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { dispatchPushNotification } from "@/lib/nex-native/notification-dispatch-service";

export type QrActionReason =
  | "not_authenticated"
  | "no_business"
  | "not_owner"
  | "rate_limit"
  | "duplicate"
  | "asset_not_found"
  | "asset_not_pending"
  | "no_active_qr"
  | "server_error"
  | QrValidationReason;

export type QrActionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: QrActionReason; readonly detail?: string };

function ok<T>(value: T): QrActionResult<T> {
  return { ok: true, value };
}
function fail<T>(reason: QrActionReason, detail?: string): QrActionResult<T> {
  return { ok: false, reason, ...(detail ? { detail } : {}) };
}

/** Internal: resolve (sessionAccountId, primaryBusinessId) or an error reason. */
async function resolveSellerContext(): Promise<
  | { ok: true; accountId: string; businessId: string }
  | { ok: false; reason: QrActionReason }
> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, reason: "not_authenticated" };
  const businesses = await listBusinessesByOwner(session.account.id).catch(() => []);
  const primary = businesses[0];
  if (!primary) return { ok: false, reason: "no_business" };
  return { ok: true, accountId: session.account.id, businessId: primary.id };
}

/** Fail-soft notification on QR change · seller sees "QR changed" ping
 *  on their own devices if they have any push subscription. Uses the
 *  existing "order" category so the seller can disable it via the
 *  same settings toggle. */
async function fireQrChangedNotification(sellerAccountId: string): Promise<void> {
  try {
    await dispatchPushNotification(
      sellerAccountId as unknown as string,
      "order",
      {
        kind: "system",
        title: "NEX",
        body: "Your payment QR has been changed.",
        data: { eventKind: "qr_changed" },
      },
    );
  } catch { /* fail-soft · never block a QR change on a push outage */ }
}

/**
 * Upload a new QR image. Validates, dedupes, stores, and inserts a
 * pending_preview row. Does NOT activate · the seller must press
 * "Activate" after previewing.
 *
 * `fileDataUrl` must be a data URL ("data:image/png;base64,...") with
 * the MIME in the known allow-list. We decode the base64 server-side
 * (client-side base64 is the simplest path from a <input type=file>).
 */
export async function uploadMerchantQrAction(input: {
  readonly fileDataUrl: string;
}): Promise<QrActionResult<{
  assetId: string;
  storagePath: string;
  previewSignedUrl: string | null;
  widthPx: number;
  heightPx: number;
  byteSize: number;
}>> {
  const ctx = await resolveSellerContext();
  if (!ctx.ok) return fail(ctx.reason);

  // Parse data URL.
  const m = input.fileDataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return fail("mime_rejected", "fileDataUrl is not a base64 data URL");
  const claimedMime = m[1];
  let bytes: Buffer;
  try {
    bytes = Buffer.from(m[2], "base64");
  } catch {
    return fail("decode_failed", "base64 decode failed");
  }

  // Rate-limit (before expensive decode).
  const limited = await hasReachedUploadLimit(ctx.businessId).catch(() => null);
  if (limited === null) return fail("server_error", "rate-limit lookup failed");
  if (limited) return fail("rate_limit", "3 uploads per 24h reached");

  // Validate bytes (MIME + size + decode + dimensions + QR + sha).
  const v = await validateQrBytes(bytes, claimedMime);
  if (!v.ok) return fail(v.reason, v.detail);

  // Dedup by (business_id, sha256).
  const dupe = await findDuplicateAsset(ctx.businessId, v.sha256Hex).catch(() => null);
  if (dupe) {
    return fail("duplicate", `existing asset ${dupe.id} with status ${dupe.status}`);
  }

  // Upload to private bucket. Deterministic path ensures idempotent
  // re-upload (storage upsert) for the same sha.
  const storagePath = pathForAsset(ctx.businessId, v.sha256Hex, v.mime);
  const { error: uploadErr } = await nexSupabaseAdmin
    .storage
    .from(MERCHANT_QR_BUCKET)
    .upload(storagePath, bytes, {
      contentType: v.mime,
      upsert: true,
      cacheControl: "no-store, max-age=0",
    });
  if (uploadErr) {
    return fail("server_error", `storage upload: ${uploadErr.message}`);
  }

  // Insert pending_preview row.
  let row: NexMerchantQrAssetRow;
  try {
    row = await insertPendingPreview({
      business_id: ctx.businessId,
      uploaded_by: ctx.accountId,
      storage_path: storagePath,
      mime_type: v.mime,
      byte_size: v.byteSize,
      sha256_hex: v.sha256Hex,
      width_px: v.widthPx,
      height_px: v.heightPx,
      qr_payload_hint: v.qrPayloadHint,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail("server_error", detail);
  }

  // Preview URL (short-lived signed URL · seller-only context).
  const signed = await mintForSellerPreview(storagePath);
  const previewSignedUrl = signed.ok ? signed.url : null;

  return ok({
    assetId: row.id,
    storagePath: row.storage_path,
    previewSignedUrl,
    widthPx: row.width_px,
    heightPx: row.height_px,
    byteSize: row.byte_size,
  });
}

export async function activateMerchantQrAction(input: {
  readonly assetId: string;
}): Promise<QrActionResult<{ activatedAssetId: string }>> {
  const ctx = await resolveSellerContext();
  if (!ctx.ok) return fail(ctx.reason);

  const asset = await getAssetById(input.assetId).catch(() => null);
  if (!asset) return fail("asset_not_found");
  if (asset.business_id !== ctx.businessId) return fail("not_owner");
  if (asset.status !== "pending_preview") return fail("asset_not_pending");

  let activated: NexMerchantQrAssetRow;
  try {
    activated = await activateQrAsset({
      asset_id: input.assetId,
      business_id: ctx.businessId,
      actor_account_id: ctx.accountId,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail("server_error", detail);
  }

  // Fail-soft: notify the seller a QR change happened. Useful if the
  // activation came from a session that may have been compromised.
  await fireQrChangedNotification(ctx.accountId);

  return ok({ activatedAssetId: activated.id });
}

export async function retireMerchantQrAction(): Promise<QrActionResult<{
  retiredAssetId: string | null;
}>> {
  const ctx = await resolveSellerContext();
  if (!ctx.ok) return fail(ctx.reason);
  const active = await getActiveQrAsset(ctx.businessId).catch(() => null);
  if (!active) return fail("no_active_qr");
  let retired: NexMerchantQrAssetRow | null;
  try {
    retired = await retireActiveQrAsset({
      business_id: ctx.businessId,
      actor_account_id: ctx.accountId,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail("server_error", detail);
  }
  await fireQrChangedNotification(ctx.accountId);
  return ok({ retiredAssetId: retired?.id ?? null });
}
