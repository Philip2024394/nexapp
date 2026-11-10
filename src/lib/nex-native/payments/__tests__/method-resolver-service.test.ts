// src/lib/nex-native/payments/__tests__/method-resolver-service.test.ts
//
// Owner-sealed 2026-11-10 · verifies the gateway-orchestration logic
// covers every branch:
//   · 0 methods → chat_only
//   · 1 method → that method
//   · 2+ methods → picker
//   · fail-soft on dependency errors

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readLocalConnectStatusMock = vi.fn();
const getActiveQrAssetMock = vi.fn();

vi.mock("@/lib/nex-native/billing/stripe-connect-service", () => ({
  readLocalConnectStatus: (...args: unknown[]) => readLocalConnectStatusMock(...args),
}));

vi.mock("@/lib/nex-native/merchant-qr/qr-asset-service", () => ({
  getActiveQrAsset: (...args: unknown[]) => getActiveQrAssetMock(...args),
}));

function stripeOn() {
  return { accountId: "acct_x", chargesEnabled: true, payoutsEnabled: true, country: "IE", requirementsCurrentlyDue: [], onboardedAt: new Date().toISOString(), lastWebhookAt: null };
}
function stripeOff() {
  return { accountId: null, chargesEnabled: false, payoutsEnabled: false, country: null, requirementsCurrentlyDue: [], onboardedAt: null, lastWebhookAt: null };
}
function qrOn() {
  return { id: "qr-1", business_id: "biz-1", status: "active", storage_path: "qr/biz-1/x.png" };
}

describe("payment-method-resolver-service · routing", () => {
  beforeEach(() => {
    readLocalConnectStatusMock.mockReset();
    getActiveQrAssetMock.mockReset();
  });
  afterEach(() => vi.resetModules());

  it("no methods active · destination is chat_only", async () => {
    readLocalConnectStatusMock.mockResolvedValueOnce(stripeOff());
    getActiveQrAssetMock.mockResolvedValueOnce(null);
    const { getCheckoutDestinationForBusiness } = await import("../method-resolver-service");
    const { methods, destination } = await getCheckoutDestinationForBusiness("biz-1" as never);
    expect(methods.any_configured).toBe(false);
    expect(methods.configured_count).toBe(0);
    expect(destination.kind).toBe("chat_only");
    expect(destination.url("order-1" as never)).toBe("/nex-native/orders/order-1/pay/chat");
  });

  it("only QR active · destination is qr", async () => {
    readLocalConnectStatusMock.mockResolvedValueOnce(stripeOff());
    getActiveQrAssetMock.mockResolvedValueOnce(qrOn());
    const { getCheckoutDestinationForBusiness } = await import("../method-resolver-service");
    const { methods, destination } = await getCheckoutDestinationForBusiness("biz-1" as never);
    expect(methods.qr_manual).toBe(true);
    expect(methods.configured_count).toBe(1);
    expect(destination.kind).toBe("qr");
    expect(destination.url("order-1" as never)).toBe("/nex-native/orders/order-1/pay");
  });

  it("only Stripe active · destination is stripe", async () => {
    readLocalConnectStatusMock.mockResolvedValueOnce(stripeOn());
    getActiveQrAssetMock.mockResolvedValueOnce(null);
    const { getCheckoutDestinationForBusiness } = await import("../method-resolver-service");
    const { methods, destination } = await getCheckoutDestinationForBusiness("biz-1" as never);
    expect(methods.stripe).toBe(true);
    expect(methods.configured_count).toBe(1);
    expect(destination.kind).toBe("stripe");
    expect(destination.url("order-1" as never)).toBe("/nex-native/orders/order-1/pay/stripe");
  });

  it("Stripe + QR active · destination is picker", async () => {
    readLocalConnectStatusMock.mockResolvedValueOnce(stripeOn());
    getActiveQrAssetMock.mockResolvedValueOnce(qrOn());
    const { getCheckoutDestinationForBusiness } = await import("../method-resolver-service");
    const { methods, destination } = await getCheckoutDestinationForBusiness("biz-1" as never);
    expect(methods.configured_count).toBe(2);
    expect(destination.kind).toBe("picker");
    expect(destination.url("order-1" as never)).toBe("/nex-native/orders/order-1/pay");
  });

  it("Stripe lookup throws · treated as not-active · falls back · no exception", async () => {
    readLocalConnectStatusMock.mockRejectedValueOnce(new Error("db down"));
    getActiveQrAssetMock.mockResolvedValueOnce(null);
    const { getCheckoutDestinationForBusiness } = await import("../method-resolver-service");
    const { methods, destination } = await getCheckoutDestinationForBusiness("biz-1" as never);
    expect(methods.stripe).toBe(false);
    expect(destination.kind).toBe("chat_only");
  });

  it("QR lookup throws · treated as not-active · fail-soft", async () => {
    readLocalConnectStatusMock.mockResolvedValueOnce(stripeOff());
    getActiveQrAssetMock.mockRejectedValueOnce(new Error("relation does not exist"));
    const { getCheckoutDestinationForBusiness } = await import("../method-resolver-service");
    const { methods, destination } = await getCheckoutDestinationForBusiness("biz-1" as never);
    expect(methods.qr_manual).toBe(false);
    expect(destination.kind).toBe("chat_only");
  });

  it("stripe chargesEnabled=false is NOT treated as active", async () => {
    readLocalConnectStatusMock.mockResolvedValueOnce({
      accountId: "acct_pending",
      chargesEnabled: false,
      payoutsEnabled: false,
      country: null,
      requirementsCurrentlyDue: ["business_profile.mcc"],
      onboardedAt: null,
      lastWebhookAt: null,
    });
    getActiveQrAssetMock.mockResolvedValueOnce(null);
    const { getCheckoutDestinationForBusiness } = await import("../method-resolver-service");
    const { methods, destination } = await getCheckoutDestinationForBusiness("biz-1" as never);
    expect(methods.stripe).toBe(false);
    expect(destination.kind).toBe("chat_only");
  });

  it("paypal + qris_dynamic always false today (BLOCKED on credentials)", async () => {
    readLocalConnectStatusMock.mockResolvedValueOnce(stripeOff());
    getActiveQrAssetMock.mockResolvedValueOnce(null);
    const { getSellerActiveMethods } = await import("../method-resolver-service");
    const methods = await getSellerActiveMethods("biz-1" as never);
    expect(methods.paypal).toBe(false);
    expect(methods.qris_dynamic).toBe(false);
  });
});
