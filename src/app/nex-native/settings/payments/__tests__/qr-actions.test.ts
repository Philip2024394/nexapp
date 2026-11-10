// src/app/nex-native/settings/payments/__tests__/qr-actions.test.ts
//
// P5 · QR server actions · ownership, rate-limit, dedup, validation
// propagation. Does NOT hit the network · all boundaries mocked.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";

const resolveSessionMock = vi.fn();
const listBusinessesByOwnerMock = vi.fn();
const hasReachedUploadLimitMock = vi.fn();
const findDuplicateAssetMock = vi.fn();
const insertPendingPreviewMock = vi.fn();
const getAssetByIdMock = vi.fn();
const activateQrAssetMock = vi.fn();
const getActiveQrAssetMock = vi.fn();
const retireActiveQrAssetMock = vi.fn();
const mintForSellerPreviewMock = vi.fn();
const storageUploadMock = vi.fn();
const dispatchPushNotificationMock = vi.fn();

vi.mock("@/lib/nex-native/app/dev-impersonation", () => ({
  resolveSessionWithDevOverride: () => resolveSessionMock(),
}));

vi.mock("@/lib/nex-native/business-service", () => ({
  listBusinessesByOwner: (...args: unknown[]) => listBusinessesByOwnerMock(...args),
}));

vi.mock("@/lib/nex-native/merchant-qr/qr-asset-service", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "@/lib/nex-native/merchant-qr/qr-asset-service",
  );
  return {
    ...actual,
    hasReachedUploadLimit: (...args: unknown[]) => hasReachedUploadLimitMock(...args),
    findDuplicateAsset: (...args: unknown[]) => findDuplicateAssetMock(...args),
    insertPendingPreview: (...args: unknown[]) => insertPendingPreviewMock(...args),
    getAssetById: (...args: unknown[]) => getAssetByIdMock(...args),
    activateQrAsset: (...args: unknown[]) => activateQrAssetMock(...args),
    getActiveQrAsset: (...args: unknown[]) => getActiveQrAssetMock(...args),
    retireActiveQrAsset: (...args: unknown[]) => retireActiveQrAssetMock(...args),
  };
});

vi.mock("@/lib/nex-native/merchant-qr/signed-url-service", () => ({
  mintForSellerPreview: (...args: unknown[]) => mintForSellerPreviewMock(...args),
  mintForBuyerPay: vi.fn(),
  mintSignedUrl: vi.fn(),
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => storageUploadMock(...args),
      }),
    },
  },
}));

vi.mock("@/lib/nex-native/notification-dispatch-service", () => ({
  dispatchPushNotification: (...args: unknown[]) => dispatchPushNotificationMock(...args),
}));

async function makeRealQrDataUrl(payload: string, size = 400): Promise<string> {
  const buf = await QRCode.toBuffer(payload, { type: "png", width: size });
  return `data:image/png;base64,${buf.toString("base64")}`;
}

describe("qr-actions · P5 ownership + rate-limit + dedup", () => {
  beforeEach(() => {
    resolveSessionMock.mockReset();
    listBusinessesByOwnerMock.mockReset();
    hasReachedUploadLimitMock.mockReset();
    findDuplicateAssetMock.mockReset();
    insertPendingPreviewMock.mockReset();
    getAssetByIdMock.mockReset();
    activateQrAssetMock.mockReset();
    getActiveQrAssetMock.mockReset();
    retireActiveQrAssetMock.mockReset();
    mintForSellerPreviewMock.mockReset();
    storageUploadMock.mockReset();
    dispatchPushNotificationMock.mockReset();

    resolveSessionMock.mockResolvedValue({ account: { id: "seller-1" } });
    listBusinessesByOwnerMock.mockResolvedValue([{ id: "biz-1", owner_account_id: "seller-1" }]);
    hasReachedUploadLimitMock.mockResolvedValue(false);
    findDuplicateAssetMock.mockResolvedValue(null);
    storageUploadMock.mockResolvedValue({ error: null });
    mintForSellerPreviewMock.mockResolvedValue({ ok: true, url: "https://signed/", expiresInSec: 300 });
    dispatchPushNotificationMock.mockResolvedValue({ attempted: 0, delivered: 0, failed: 0, pruned: 0 });
  });
  afterEach(() => vi.resetModules());

  it("unauthenticated · fails with not_authenticated · no DB touch", async () => {
    resolveSessionMock.mockResolvedValueOnce(null);
    const { uploadMerchantQrAction } = await import("../_qr-actions");
    const res = await uploadMerchantQrAction({ fileDataUrl: "data:image/png;base64,AA" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_authenticated");
    expect(storageUploadMock).not.toHaveBeenCalled();
    expect(insertPendingPreviewMock).not.toHaveBeenCalled();
  });

  it("no business · fails · no DB touch", async () => {
    listBusinessesByOwnerMock.mockResolvedValueOnce([]);
    const { uploadMerchantQrAction } = await import("../_qr-actions");
    const res = await uploadMerchantQrAction({ fileDataUrl: "data:image/png;base64,AA" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("no_business");
    expect(storageUploadMock).not.toHaveBeenCalled();
  });

  it("rate-limited · fails · no upload · no insert", async () => {
    hasReachedUploadLimitMock.mockResolvedValueOnce(true);
    const dataUrl = await makeRealQrDataUrl("https://pay.example/x");
    const { uploadMerchantQrAction } = await import("../_qr-actions");
    const res = await uploadMerchantQrAction({ fileDataUrl: dataUrl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("rate_limit");
    expect(storageUploadMock).not.toHaveBeenCalled();
    expect(insertPendingPreviewMock).not.toHaveBeenCalled();
  });

  it("duplicate · fails without re-upload or re-insert", async () => {
    findDuplicateAssetMock.mockResolvedValueOnce({ id: "existing-asset-1", status: "active" });
    const dataUrl = await makeRealQrDataUrl("https://pay.example/dup");
    const { uploadMerchantQrAction } = await import("../_qr-actions");
    const res = await uploadMerchantQrAction({ fileDataUrl: dataUrl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("duplicate");
    expect(storageUploadMock).not.toHaveBeenCalled();
    expect(insertPendingPreviewMock).not.toHaveBeenCalled();
  });

  it("valid upload · bytes written to storage · pending_preview row inserted · preview URL minted", async () => {
    insertPendingPreviewMock.mockResolvedValueOnce({
      id: "asset-new",
      business_id: "biz-1",
      storage_path: "qr/biz-1/hash.png",
      width_px: 400,
      height_px: 400,
      byte_size: 500,
    });
    const dataUrl = await makeRealQrDataUrl("https://pay.example/ok");
    const { uploadMerchantQrAction } = await import("../_qr-actions");
    const res = await uploadMerchantQrAction({ fileDataUrl: dataUrl });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.assetId).toBe("asset-new");
    expect(res.value.previewSignedUrl).toBe("https://signed/");
    expect(storageUploadMock).toHaveBeenCalledTimes(1);
    expect(insertPendingPreviewMock).toHaveBeenCalledTimes(1);
  });

  it("activate · asset owned by different business · not_owner · no DB mutation", async () => {
    getAssetByIdMock.mockResolvedValueOnce({ id: "asset-x", business_id: "other-biz", status: "pending_preview" });
    const { activateMerchantQrAction } = await import("../_qr-actions");
    const res = await activateMerchantQrAction({ assetId: "asset-x" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_owner");
    expect(activateQrAssetMock).not.toHaveBeenCalled();
  });

  it("activate · asset already active · asset_not_pending", async () => {
    getAssetByIdMock.mockResolvedValueOnce({ id: "asset-x", business_id: "biz-1", status: "active" });
    const { activateMerchantQrAction } = await import("../_qr-actions");
    const res = await activateMerchantQrAction({ assetId: "asset-x" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("asset_not_pending");
    expect(activateQrAssetMock).not.toHaveBeenCalled();
  });

  it("activate · valid · activates + fires fail-soft QR-changed notification", async () => {
    getAssetByIdMock.mockResolvedValueOnce({ id: "asset-x", business_id: "biz-1", status: "pending_preview" });
    activateQrAssetMock.mockResolvedValueOnce({ id: "asset-x" });
    const { activateMerchantQrAction } = await import("../_qr-actions");
    const res = await activateMerchantQrAction({ assetId: "asset-x" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.activatedAssetId).toBe("asset-x");
    expect(activateQrAssetMock).toHaveBeenCalledTimes(1);
    expect(dispatchPushNotificationMock).toHaveBeenCalledTimes(1);
    const [, category, payload] = dispatchPushNotificationMock.mock.calls[0];
    expect(category).toBe("order");
    expect(payload.kind).toBe("system");
    expect(payload.body).toBe("Your payment QR has been changed.");
  });

  it("retire · no active QR · no_active_qr · no DB mutation", async () => {
    getActiveQrAssetMock.mockResolvedValueOnce(null);
    const { retireMerchantQrAction } = await import("../_qr-actions");
    const res = await retireMerchantQrAction();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("no_active_qr");
    expect(retireActiveQrAssetMock).not.toHaveBeenCalled();
  });
});
