// src/lib/nex-native/payments/method-resolver-service.ts
//
// Owner-sealed 2026-11-10 · payment-gateway orchestration.
// NEX never handles the money. This service figures out which
// payment gateways a seller has configured, and routes the buyer
// to the correct checkout surface.
//
// If the seller has configured ZERO gateways, the buyer falls back
// to the existing NEX Chat conversation to arrange payment manually
// with the seller. This is NEX's "no gateway" path, not a failure.
//
// Doctrine:
//   · NEX does NOT hold funds. Every method is merchant-direct.
//   · Gateway "active" state is derived from the seller's own
//     configured surfaces · not a NEX decision.
//   · Reads only. This service never writes to the seller's config.

import "server-only";
import { readLocalConnectStatus } from "../billing/stripe-connect-service";
import { getActiveQrAsset } from "../merchant-qr/qr-asset-service";
import type { NexUuid } from "../types";

export type PaymentMethodKey =
  | "stripe"
  | "paypal"
  | "qr_manual"
  | "qris_dynamic";

export interface SellerActiveMethods {
  readonly stripe: boolean;
  readonly paypal: boolean;
  readonly qr_manual: boolean;
  readonly qris_dynamic: boolean;
  readonly configured_count: number;
  readonly any_configured: boolean;
}

export type CheckoutDestinationKind =
  /** Seller has a QR configured · route buyer to the QR /pay page. */
  | "qr"
  /** Seller has Stripe Connect active · route buyer to Stripe. */
  | "stripe"
  /** Seller has PayPal · route buyer to PayPal. (Not built yet.) */
  | "paypal"
  /** Seller has dynamic QRIS · route buyer to QRIS flow. (Not built yet.) */
  | "qris_dynamic"
  /** Seller has multiple gateways active · buyer picks on /pay. */
  | "picker"
  /** Seller has no gateway configured · fall back to existing chat
   *  conversation · buyer and seller arrange payment there. */
  | "chat_only";

export interface CheckoutDestination {
  readonly kind: CheckoutDestinationKind;
  /** Server-side route to redirect the buyer to after order creation. */
  readonly url: (orderId: NexUuid) => string;
  /** Short label for logs / telemetry. */
  readonly label: string;
}

/** Centralised URL builders · all routes server-side. */
export const CHECKOUT_URLS = {
  qr: (orderId: NexUuid) => `/nex-native/orders/${orderId}/pay`,
  stripe: (orderId: NexUuid) => `/nex-native/orders/${orderId}/pay/stripe`,
  paypal: (orderId: NexUuid) => `/nex-native/orders/${orderId}/pay/paypal`,
  qris_dynamic: (orderId: NexUuid) => `/nex-native/orders/${orderId}/pay/qris`,
  picker: (orderId: NexUuid) => `/nex-native/orders/${orderId}/pay`,
  chat_only: (orderId: NexUuid) => `/nex-native/orders/${orderId}/pay/chat`,
} as const;

/**
 * Report which payment methods a given seller has activated.
 * Fail-soft: any single lookup failure yields that method = false
 * rather than throwing; the buyer never gets blocked from checkout
 * because a dependency is temporarily unavailable.
 */
export async function getSellerActiveMethods(
  businessId: NexUuid,
): Promise<SellerActiveMethods> {
  const [stripeStatus, qrAsset] = await Promise.all([
    readLocalConnectStatus(businessId).catch(() => null),
    getActiveQrAsset(businessId).catch(() => null),
  ]);
  const stripe = Boolean(stripeStatus && stripeStatus.chargesEnabled);
  const qr_manual = Boolean(qrAsset);
  // PayPal + dynamic QRIS not yet wired · BLOCKED on credentials.
  const paypal = false;
  const qris_dynamic = false;
  const flags = [stripe, paypal, qr_manual, qris_dynamic];
  const configured_count = flags.filter(Boolean).length;
  return {
    stripe,
    paypal,
    qr_manual,
    qris_dynamic,
    configured_count,
    any_configured: configured_count > 0,
  };
}

/**
 * Decide where the buyer should go after an order is created.
 *
 *   · 0 methods active   → chat_only  (buyer messages seller in chat)
 *   · 1 method  active   → that method's surface
 *   · 2+ methods active  → picker  (buyer chooses on /pay)
 */
export function resolveCheckoutDestination(
  methods: SellerActiveMethods,
): CheckoutDestination {
  if (methods.configured_count === 0) {
    return {
      kind: "chat_only",
      url: CHECKOUT_URLS.chat_only,
      label: "chat_only",
    };
  }
  if (methods.configured_count > 1) {
    return {
      kind: "picker",
      url: CHECKOUT_URLS.picker,
      label: "picker",
    };
  }
  // Exactly one method is active · route directly.
  if (methods.stripe) {
    return { kind: "stripe", url: CHECKOUT_URLS.stripe, label: "stripe" };
  }
  if (methods.qr_manual) {
    return { kind: "qr", url: CHECKOUT_URLS.qr, label: "qr" };
  }
  if (methods.paypal) {
    return { kind: "paypal", url: CHECKOUT_URLS.paypal, label: "paypal" };
  }
  // qris_dynamic is the only remaining option when configured_count === 1.
  return { kind: "qris_dynamic", url: CHECKOUT_URLS.qris_dynamic, label: "qris_dynamic" };
}

/** Convenience: resolve + destination in one call. */
export async function getCheckoutDestinationForBusiness(
  businessId: NexUuid,
): Promise<{ methods: SellerActiveMethods; destination: CheckoutDestination }> {
  const methods = await getSellerActiveMethods(businessId);
  const destination = resolveCheckoutDestination(methods);
  return { methods, destination };
}
