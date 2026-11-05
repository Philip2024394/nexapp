// src/lib/nex-native/payment-connection-service.ts
//
// Direct-to-seller payment connection service · Phase V · P9 scaffold
// 2026-11-05.
// --------------------------------------------------------------------
// Prepares the ARCHITECTURE for seller-owned gateway connections
// without wiring any live gateway API. When the sealed doctrine D1
// (Social Commerce 2026-11-01) is re-opened to allow multi-gateway
// AND the D4 legal brief covering Ireland + Indonesia + DAC7 / PSD2
// / DSA / consumer protection / GDPR is complete, this module becomes
// the authority for:
//
//   · which providers a business has connected
//   · what each connection's status is
//   · whether a business is checkout-ready
//   · which provider should be used for a given transaction
//
// Sealed rules enforced at the type level:
//   · NEX takes 0% commission on shop sales
//   · NEX never holds customer-to-seller funds
//   · The seller owns the merchant relationship with the provider
//   · The external_account_id is OPAQUE to NEX (we store a reference,
//     the provider owns KYC + payouts)
//   · NEX membership billing is separate (not represented here)
//
// What this module does NOT do yet (deliberately · deferred pending
// doctrine re-open):
//   · Create / revoke gateway accounts (Stripe Connect Express
//     account-link, PayPal Partner Referrals, Xendit account, Midtrans
//     merchant account)
//   · Handle gateway webhooks
//   · Build buyer checkout sessions
//   · Record transaction state (orders + ledger table exist on main
//     per migrations 005 + 006 but this service does not write to
//     them · that belongs to the buyer-checkout layer which is
//     sealed-doctrine-gated)
//
// The current implementation returns empty / "not ready" for every
// query because the backing table does not yet exist. This is HONEST:
// no shop can accept live buyer payments through NEX yet, and this
// service tells callers that truthfully.

import "server-only";

export const PAYMENT_PROVIDER_IDS = [
  "stripe",
  "paypal",
  "xendit",
  "midtrans",
] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDER_IDS)[number];

export function isPaymentProviderId(id: string): id is PaymentProviderId {
  return (PAYMENT_PROVIDER_IDS as readonly string[]).includes(id);
}

export const PAYMENT_CONNECTION_STATUSES = [
  // Seller has expressed interest · no provider account exists yet ·
  // this is the honest default state surfaced on
  // /nex-native/settings/shop-payments today.
  "beta_waitlist",
  // Seller has started the provider-hosted onboarding (e.g. clicked
  // Stripe Connect Express onboarding, redirected to Stripe) but has
  // not finished · transient.
  "connecting",
  // Provider has confirmed the seller's merchant account is active
  // and payments can route · this is the only state where a shop
  // should be considered checkout-ready for its connected provider.
  "connected",
  // Seller or provider disabled the connection · funds no longer
  // route · kept as a record for audit.
  "disabled",
] as const;
export type PaymentConnectionStatus =
  (typeof PAYMENT_CONNECTION_STATUSES)[number];

/**
 * One row per (business, provider) pair · unique composite key.
 *
 * `external_account_id` is the OPAQUE reference provided by the
 * gateway (e.g. Stripe `acct_…`, PayPal merchant id, Xendit business
 * id). NEX treats it as an opaque string. Payouts never flow through
 * NEX · they settle to the seller's own balance at the provider.
 */
export interface PaymentConnection {
  readonly businessId: string;
  readonly providerId: PaymentProviderId;
  readonly externalAccountId: string | null;
  readonly status: PaymentConnectionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * List every payment-connection row for a business · includes
 * disabled rows so the seller can see the historical state.
 *
 * Current behaviour: returns an empty array. The backing table
 * `nex_business_payment_connection` is intentionally NOT created yet
 * because migration numbering collides with concurrent payment work
 * on another branch (phase-u 2026-11-04). The migration lands in the
 * authorised next stage along with the live gateway wiring.
 */
export async function listPaymentConnectionsForBusiness(
  _businessId: string,
): Promise<readonly PaymentConnection[]> {
  // Scaffold · intentionally empty until the next authorised stage.
  // Callers that want to show "not connected" chips can rely on
  // isBusinessCheckoutReady returning false.
  return [];
}

/**
 * Convenience: does the business currently have at least one
 * "connected" provider? Shop-page + /manage/shop + checkout surfaces
 * all read this · ONE source of truth for "ready to accept payments".
 *
 * Current behaviour: returns `{ ready: false, reason: "no-provider-wired" }`.
 * Honest: no shop can accept live buyer payments through NEX yet.
 */
export async function isBusinessCheckoutReady(
  businessId: string,
): Promise<
  | { ready: true; providers: readonly PaymentProviderId[] }
  | {
      ready: false;
      reason: "no-provider-wired" | "no-provider-connected" | "all-disabled";
    }
> {
  const connections = await listPaymentConnectionsForBusiness(businessId);
  if (connections.length === 0) {
    return { ready: false, reason: "no-provider-wired" };
  }
  const connectedProviders = connections
    .filter((c) => c.status === "connected")
    .map((c) => c.providerId);
  if (connectedProviders.length === 0) {
    const allDisabled = connections.every((c) => c.status === "disabled");
    return {
      ready: false,
      reason: allDisabled ? "all-disabled" : "no-provider-connected",
    };
  }
  return { ready: true, providers: connectedProviders };
}

/**
 * Pick which provider a checkout session should use for a given
 * business · when only one is connected the choice is trivial; when
 * multiple are connected the seller's default (stored on the row ·
 * TODO when the table lands) wins; otherwise the first by connection
 * date. Current behaviour: returns null because no business has a
 * connected provider yet.
 */
export async function pickCheckoutProvider(
  businessId: string,
): Promise<PaymentProviderId | null> {
  const ready = await isBusinessCheckoutReady(businessId);
  if (!ready.ready) return null;
  return ready.providers[0] ?? null;
}

/**
 * Display meta for each provider · kept in service code (not the
 * public settings page) so other surfaces (checkout button copy,
 * buyer receipts, ops dashboards) can share one authoritative map.
 */
export const PAYMENT_PROVIDER_META: Readonly<
  Record<
    PaymentProviderId,
    {
      readonly name: string;
      readonly host: string;
      readonly countriesServed: readonly ("IE" | "ID")[];
    }
  >
> = {
  stripe: {
    name: "Stripe",
    host: "stripe.com",
    countriesServed: ["IE", "ID"],
  },
  paypal: {
    name: "PayPal",
    host: "paypal.com",
    countriesServed: ["IE", "ID"],
  },
  xendit: {
    name: "Xendit",
    host: "xendit.co",
    countriesServed: ["ID"],
  },
  midtrans: {
    name: "Midtrans",
    host: "midtrans.com",
    countriesServed: ["ID"],
  },
};
