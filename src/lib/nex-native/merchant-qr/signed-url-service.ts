// src/lib/nex-native/merchant-qr/signed-url-service.ts
//
// P5 · mint short-lived signed URLs for private merchant QR assets.
// Owner-sealed 2026-11-10 · reads via service-role only · bucket is
// private (mig 321) · no uncontrolled public URL ever leaves this
// module.
//
// Access rules (enforced by callers):
//   · Seller preview: seller must own the business that owns the asset.
//   · Buyer payment page: buyer must own the order AND the order must
//     be in a state that implies payment is expected (created or
//     pending) AND the order's seller must have an active QR.
//
// Expiry defaults are deliberately short · the buyer /pay page is
// re-rendered server-side on every navigation and re-mints the URL.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import { MERCHANT_QR_BUCKET } from "./qr-asset-service";

/** Signed URL lifetimes (seconds). */
export const SELLER_PREVIEW_EXPIRY_SECONDS = 300;   // 5 minutes
export const BUYER_PAY_EXPIRY_SECONDS = 180;        // 3 minutes

export type SignedUrlFailureReason =
  | "not_found"
  | "storage_error";

export type SignedUrlResult =
  | { readonly ok: true; readonly url: string; readonly expiresInSec: number }
  | { readonly ok: false; readonly reason: SignedUrlFailureReason; readonly detail?: string };

export async function mintSignedUrl(
  storagePath: string,
  expiresInSec: number,
): Promise<SignedUrlResult> {
  const { data, error } = await nexSupabaseAdmin
    .storage
    .from(MERCHANT_QR_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error) {
    return {
      ok: false,
      reason: /not.*found|does not exist/i.test(error.message)
        ? "not_found"
        : "storage_error",
      detail: error.message,
    };
  }
  if (!data?.signedUrl) {
    return { ok: false, reason: "not_found", detail: "no signedUrl in response" };
  }
  return { ok: true, url: data.signedUrl, expiresInSec };
}

export function mintForSellerPreview(storagePath: string): Promise<SignedUrlResult> {
  return mintSignedUrl(storagePath, SELLER_PREVIEW_EXPIRY_SECONDS);
}

export function mintForBuyerPay(storagePath: string): Promise<SignedUrlResult> {
  return mintSignedUrl(storagePath, BUYER_PAY_EXPIRY_SECONDS);
}
