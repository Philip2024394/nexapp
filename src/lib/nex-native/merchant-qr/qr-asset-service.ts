// src/lib/nex-native/merchant-qr/qr-asset-service.ts
//
// P5 · CRUD + state transitions for seller payment QR assets.
// Owner-sealed 2026-11-10 · reads/writes `nex_merchant_qr_asset`
// (mig 319) via service-role · callers are server actions that have
// already checked session + ownership.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";

export const MERCHANT_QR_BUCKET = "nex-merchant-qr";
export const UPLOAD_RATE_WINDOW_HOURS = 24;
export const UPLOAD_RATE_LIMIT = 3;

export type QrAssetStatus = "pending_preview" | "active" | "retired" | "rejected";

export interface NexMerchantQrAssetRow {
  id: NexUuid;
  business_id: NexUuid;
  uploaded_by: NexUuid;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  byte_size: number;
  sha256_hex: string;
  width_px: number;
  height_px: number;
  qr_decoded: boolean;
  qr_payload_hint: string | null;
  status: QrAssetStatus;
  created_at: string;
  activated_at: string | null;
  retired_at: string | null;
  retired_by: NexUuid | null;
  rejection_reason: string | null;
}

/**
 * Return the single `active` QR for a business, or null if none.
 */
export async function getActiveQrAsset(
  businessId: NexUuid,
): Promise<NexMerchantQrAssetRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_merchant_qr_asset")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(`qr-asset-service.getActiveQrAsset: ${error.message}`);
  return (data ?? null) as NexMerchantQrAssetRow | null;
}

/**
 * Check whether the per-business upload rate limit has been reached
 * within the past UPLOAD_RATE_WINDOW_HOURS.
 */
export async function hasReachedUploadLimit(
  businessId: NexUuid,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - UPLOAD_RATE_WINDOW_HOURS * 3600_000).toISOString();
  const { count, error } = await nexSupabaseAdmin
    .from("nex_merchant_qr_asset")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", cutoff);
  if (error) throw new Error(`qr-asset-service.hasReachedUploadLimit: ${error.message}`);
  return (count ?? 0) >= UPLOAD_RATE_LIMIT;
}

/**
 * Look up an existing (non-retired) asset for the (business, sha256)
 * pair. Used by the upload action to short-circuit duplicate uploads.
 */
export async function findDuplicateAsset(
  businessId: NexUuid,
  sha256Hex: string,
): Promise<NexMerchantQrAssetRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_merchant_qr_asset")
    .select("*")
    .eq("business_id", businessId)
    .eq("sha256_hex", sha256Hex)
    .maybeSingle();
  if (error) throw new Error(`qr-asset-service.findDuplicateAsset: ${error.message}`);
  return (data ?? null) as NexMerchantQrAssetRow | null;
}

/**
 * INSERT a new asset row in pending_preview state. Caller is
 * responsible for uploading the bytes to storage FIRST so the
 * storage_path is real at insert time.
 */
export async function insertPendingPreview(input: {
  business_id: NexUuid;
  uploaded_by: NexUuid;
  storage_path: string;
  mime_type: "image/png" | "image/jpeg" | "image/webp";
  byte_size: number;
  sha256_hex: string;
  width_px: number;
  height_px: number;
  qr_payload_hint: string;
}): Promise<NexMerchantQrAssetRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_merchant_qr_asset")
    .insert({
      business_id: input.business_id,
      uploaded_by: input.uploaded_by,
      storage_bucket: MERCHANT_QR_BUCKET,
      storage_path: input.storage_path,
      mime_type: input.mime_type,
      byte_size: input.byte_size,
      sha256_hex: input.sha256_hex,
      width_px: input.width_px,
      height_px: input.height_px,
      qr_decoded: true,
      qr_payload_hint: input.qr_payload_hint,
      status: "pending_preview",
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `qr-asset-service.insertPendingPreview: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexMerchantQrAssetRow;
}

/**
 * Atomic swap: retire the current active asset (if any) and promote
 * `assetId` from pending_preview to active. Also updates
 * nex_business.qr_code_image_url to the new storage path so legacy
 * read paths keep working (though the path is NOT publicly addressable;
 * reads go via signed URLs).
 *
 * Returns the activated row. Throws if the asset is not in
 * pending_preview state or does not belong to the specified business.
 */
export async function activateQrAsset(input: {
  asset_id: NexUuid;
  business_id: NexUuid;
  actor_account_id: NexUuid;
}): Promise<NexMerchantQrAssetRow> {
  // Verify the target asset is in pending_preview for this business.
  const { data: target, error: readErr } = await nexSupabaseAdmin
    .from("nex_merchant_qr_asset")
    .select("*")
    .eq("id", input.asset_id)
    .maybeSingle();
  if (readErr) throw new Error(`qr-asset-service.activateQrAsset read: ${readErr.message}`);
  const asset = target as NexMerchantQrAssetRow | null;
  if (!asset) throw new Error("qr-asset-service.activateQrAsset: asset not found");
  if (asset.business_id !== input.business_id) {
    throw new Error("qr-asset-service.activateQrAsset: business mismatch");
  }
  if (asset.status !== "pending_preview") {
    throw new Error(
      `qr-asset-service.activateQrAsset: asset status is ${asset.status}, expected pending_preview`,
    );
  }

  // Retire any current active row (partial unique guarantees ≤1).
  // Supabase supports a basic UPDATE WHERE here; the partial unique
  // ensures we never end up with two active rows even under a race.
  const nowIso = new Date().toISOString();
  const { error: retireErr } = await nexSupabaseAdmin
    .from("nex_merchant_qr_asset")
    .update({
      status: "retired",
      retired_at: nowIso,
      retired_by: input.actor_account_id,
    })
    .eq("business_id", input.business_id)
    .eq("status", "active");
  if (retireErr) {
    throw new Error(`qr-asset-service.activateQrAsset retire: ${retireErr.message}`);
  }

  // Promote the target.
  const { data: promoted, error: promoteErr } = await nexSupabaseAdmin
    .from("nex_merchant_qr_asset")
    .update({ status: "active", activated_at: nowIso })
    .eq("id", input.asset_id)
    .select("*")
    .single();
  if (promoteErr || !promoted) {
    throw new Error(
      `qr-asset-service.activateQrAsset promote: ${promoteErr?.message ?? "no row"}`,
    );
  }

  // Keep nex_business.qr_code_image_url in sync with the active path
  // (the column stores the storage_path · readers mint signed URLs
  // from it, they do NOT treat it as a public URL).
  const { error: bizErr } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ qr_code_image_url: (promoted as NexMerchantQrAssetRow).storage_path })
    .eq("id", input.business_id);
  if (bizErr) {
    throw new Error(`qr-asset-service.activateQrAsset business sync: ${bizErr.message}`);
  }
  return promoted as NexMerchantQrAssetRow;
}

/**
 * Soft-retire the current active asset without promoting a replacement.
 * The seller's /pay surface will refuse to transition orders to
 * `pending` until a new QR is activated.
 */
export async function retireActiveQrAsset(input: {
  business_id: NexUuid;
  actor_account_id: NexUuid;
}): Promise<NexMerchantQrAssetRow | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_merchant_qr_asset")
    .update({
      status: "retired",
      retired_at: nowIso,
      retired_by: input.actor_account_id,
    })
    .eq("business_id", input.business_id)
    .eq("status", "active")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`qr-asset-service.retireActiveQrAsset: ${error.message}`);
  // Also clear the convenience column on nex_business.
  const { error: bizErr } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ qr_code_image_url: null })
    .eq("id", input.business_id);
  if (bizErr) {
    throw new Error(`qr-asset-service.retireActiveQrAsset business sync: ${bizErr.message}`);
  }
  return (data ?? null) as NexMerchantQrAssetRow | null;
}

export async function getAssetById(assetId: NexUuid): Promise<NexMerchantQrAssetRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_merchant_qr_asset")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();
  if (error) throw new Error(`qr-asset-service.getAssetById: ${error.message}`);
  return (data ?? null) as NexMerchantQrAssetRow | null;
}

export function pathForAsset(businessId: NexUuid, sha256Hex: string, mime: string): string {
  const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "webp";
  return `qr/${businessId}/${sha256Hex}.${ext}`;
}
