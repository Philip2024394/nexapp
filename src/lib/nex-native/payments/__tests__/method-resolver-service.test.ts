// src/lib/nex-native/payments/__tests__/method-resolver-service.test.ts
//
// Owner-sealed 2026-11-10 (REVISED) · verifies the shop-gateway
// orchestration logic covers every branch under the authoritative
// rule: Stripe is NEVER a shop checkout option. Shop methods are
// PayPal + QR manual + QRIS dynamic only.
//
//   · 0 methods → chat_only
//   · 1 method  → that method
//   · 2+ methods → picker
//   · fail-soft on dependency errors

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getActiveQrAssetMock = vi.fn();

vi.mock("@/lib/nex-native/merchant-qr/qr-asset-service", () => ({
  getActiveQrAsset: (...args: unknown[]) => getActiveQrAssetMock(...args),
}));

function qrOn() {
  return { id: "qr-1", business_id: "biz-1", status: "active", storage_path: "qr/biz-1/x.png" };
}

describe("payment-method-resolver-service · routing (Stripe removed from shop paths)", () => {
  beforeEach(() => {
    getActiveQrAssetMock.mockReset();
  });
  afterEach(() => vi.resetModules());

  it("no methods active · destination is chat_only", async () => {
    getActiveQrAssetMock.mockResolvedValueOnce(null);
    const { getCheckoutDestinationForBusiness } = await import("../method-resolver-service");
    const { methods, destination } = await getCheckoutDestinationForBusiness("biz-1" as never);
    expect(methods.any_configured).toBe(false);
    expect(methods.configured_count).toBe(0);
    expect(destination.kind).toBe("chat_only");
    expect(destination.url("order-1" as never)).toBe("/nex-native/orders/order-1/pay/chat");
  });

  it("only QR active · destination is qr", async () => {
    getActiveQrAssetMock.mockResolvedValueOnce(qrOn());
    const { getCheckoutDestinationForBusiness } = await import("../method-resolver-service");
    const { methods, destination } = await getCheckoutDestinationForBusiness("biz-1" as never);
    expect(methods.qr_manual).toBe(true);
    expect(methods.configured_count).toBe(1);
    expect(destination.kind).toBe("qr");
    expect(destination.url("order-1" as never)).toBe("/nex-native/orders/order-1/pay");
  });

  it("QR lookup throws · treated as not-active · fail-soft", async () => {
    getActiveQrAssetMock.mockRejectedValueOnce(new Error("relation does not exist"));
    const { getCheckoutDestinationForBusiness } = await import("../method-resolver-service");
    const { methods, destination } = await getCheckoutDestinationForBusiness("biz-1" as never);
    expect(methods.qr_manual).toBe(false);
    expect(destination.kind).toBe("chat_only");
  });

  it("paypal + qris_dynamic always false today (BLOCKED on credentials)", async () => {
    getActiveQrAssetMock.mockResolvedValueOnce(null);
    const { getSellerActiveMethods } = await import("../method-resolver-service");
    const methods = await getSellerActiveMethods("biz-1" as never);
    expect(methods.paypal).toBe(false);
    expect(methods.qris_dynamic).toBe(false);
  });

  it("SellerActiveMethods type no longer carries a `stripe` field", async () => {
    getActiveQrAssetMock.mockResolvedValueOnce(null);
    const { getSellerActiveMethods } = await import("../method-resolver-service");
    const methods = await getSellerActiveMethods("biz-1" as never);
    // Shape assertion · explicit on the three authoritative fields
    expect(Object.keys(methods).sort()).toEqual(
      ["any_configured", "configured_count", "paypal", "qr_manual", "qris_dynamic"],
    );
  });

  it("CHECKOUT_URLS has no `stripe` key (reserved for billing, not shop)", async () => {
    const mod = await import("../method-resolver-service");
    expect(Object.keys(mod.CHECKOUT_URLS)).toEqual(
      expect.arrayContaining(["qr", "paypal", "qris_dynamic", "picker", "chat_only"]),
    );
    expect(Object.keys(mod.CHECKOUT_URLS)).not.toContain("stripe");
  });
});
