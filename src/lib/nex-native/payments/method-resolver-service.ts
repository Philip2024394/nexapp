// src/lib/nex-native/payments/method-resolver-service.ts
//
// Owner-sealed 2026-11-10 (REVISED) · payment-gateway orchestration.
// 2026-11-16 · Stream E · added honest per-method readiness reasons
// (platform-env + per-business + schema gates). The three paid-provider
// flags (paypal / qris_dynamic / stripe) stay `false` until EVERY gate
// is green — making an unfinished provider discoverable to buyers is
// worse than leaving it hidden.
//
// NEX never handles the money. This service figures out which shop
// payment gateways a seller has configured, and routes the buyer to
// the correct checkout surface.
//
// AUTHORITATIVE RULES (sealed 2026-11-10 later revision):
//   · Shop-owner commerce · customer-to-shop payments route through
//     PayPal + manual QR + dynamic QRIS only.
//   · Stripe is RESERVED for NEX member subscriptions / renewals /
//     wallet top-ups and MUST NOT appear as a shop checkout option.
//   · NEX does NOT hold funds. Every shop method is merchant-direct.
//   · Gateway "active" state is derived from the seller's own
//     configured surfaces · not a NEX decision.
//   · Reads only. This service never writes to the seller's config.
//
// Stripe Connect code in billing/stripe-connect-service.ts remains
// in-place for reversibility but is NOT read here · the seller's
// Stripe-Connect fields on nex_business are legacy for this surface.
//
// If the seller has configured ZERO gateways, the buyer falls back
// to the existing NEX Chat conversation to arrange payment manually
// with the seller. This is NEX's "no gateway" path, not a failure.

import "server-only";
import { getActiveQrAsset } from "../merchant-qr/qr-asset-service";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";

export type PaymentMethodKey =
  | "paypal"
  | "qr_manual"
  | "qris_dynamic";

export interface SellerActiveMethods {
  readonly paypal: boolean;
  readonly qr_manual: boolean;
  readonly qris_dynamic: boolean;
  readonly configured_count: number;
  readonly any_configured: boolean;
}

export type CheckoutDestinationKind =
  /** Seller has a QR configured · route buyer to the QR /pay page. */
  | "qr"
  /** Seller has PayPal · route buyer to PayPal. */
  | "paypal"
  /** Seller has dynamic QRIS · route buyer to QRIS flow. */
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

/** Centralised URL builders · all routes server-side.
 *  Stripe is deliberately absent · member subscriptions use
 *  /api/nex-native/billing/checkout, not a /pay/* route. */
export const CHECKOUT_URLS = {
  qr: (orderId: NexUuid) => `/nex-native/orders/${orderId}/pay`,
  paypal: (orderId: NexUuid) => `/nex-native/orders/${orderId}/pay/paypal`,
  qris_dynamic: (orderId: NexUuid) => `/nex-native/orders/${orderId}/pay/qris`,
  picker: (orderId: NexUuid) => `/nex-native/orders/${orderId}/pay`,
  chat_only: (orderId: NexUuid) => `/nex-native/orders/${orderId}/pay/chat`,
} as const;

// ---------------------------------------------------------------------------
// Readiness reasons (DEV / ADMIN only · never surfaced to buyers)
// ---------------------------------------------------------------------------

/** Honest machine-readable reason strings for WHY a paid provider is not
 *  yet surfacing. Used by /settings/payments + admin dashboards only. */
export type PaypalReadinessReason =
  | "ready"
  | "schema_pending"
  | "credentials_missing"
  | "seller_not_onboarded";
export type QrisReadinessReason =
  | "ready"
  | "provider_pending"
  | "seller_not_enabled";
export type StripeReadinessReason =
  | "ready"
  | "platform_webhook_secret_missing"
  | "seller_not_onboarded"
  | "reserved_for_subscriptions";
export type QrManualReadinessReason = "ready" | "no_active_qr" | "lookup_failed";

export interface SellerMethodReadiness {
  qr_manual: { ready: boolean; reason: QrManualReadinessReason };
  paypal: { ready: boolean; reason: PaypalReadinessReason };
  qris_dynamic: { ready: boolean; reason: QrisReadinessReason };
  stripe: { ready: boolean; reason: StripeReadinessReason };
}

// ---------------------------------------------------------------------------
// Per-method readiness probes
// ---------------------------------------------------------------------------
// Each probe has two halves:
//   a) PLATFORM readiness (env vars, schema applied, webhook secret set)
//   b) PER-BUSINESS readiness (seller finished onboarding, has credential row)
// A provider is "ready to show" only when BOTH halves hold.
// Any failure fails SOFT — the buyer never gets blocked from checkout
// because a dependency is temporarily unavailable or misconfigured.

async function probeQrManual(
  businessId: NexUuid,
): Promise<{ ready: boolean; reason: QrManualReadinessReason }> {
  try {
    const asset = await getActiveQrAsset(businessId);
    if (asset) return { ready: true, reason: "ready" };
    return { ready: false, reason: "no_active_qr" };
  } catch {
    // Any lookup failure ⇒ not-active (fail-soft).
    return { ready: false, reason: "lookup_failed" };
  }
}

/** PayPal readiness.
 *  Requires ALL (checked in dependency order):
 *   1 · Platform credentials present (PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET)
 *   2 · Migration 336 applied (adds nex_business.paypal_merchant_id)
 *   3 · Seller row has non-null paypal_merchant_id AND paypal_charges_enabled=true
 *
 *  As of 2026-11-16: audit says PayPal creds NOT set AND mig 336 NOT
 *  applied in sandbox or prod. The first failing gate is credentials,
 *  so this returns `credentials_missing` fast-path without hitting
 *  the DB.
 */
async function probePaypal(
  businessId: NexUuid,
): Promise<{ ready: boolean; reason: PaypalReadinessReason }> {
  const clientId = (process.env.PAYPAL_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.PAYPAL_CLIENT_SECRET ?? "").trim();
  const platformCreds = clientId.length > 0 && clientSecret.length > 0;

  // Schema probe · we attempt the per-business read directly. If
  // mig 336 has not been applied, the `paypal_merchant_id` /
  // `paypal_charges_enabled` columns do not exist and Supabase will
  // return a column-does-not-exist error (status 42703). We treat
  // that as the authoritative `schema_pending` signal — more
  // reliable than hardcoding a flag because it stays accurate after
  // the migration is applied without needing a code change.
  //
  // Short-circuit · if platform credentials are missing OR the schema
  // probe has never succeeded in this process, we can skip the DB call
  // entirely. In practice today (audit 2026-11-16) PayPal creds are
  // unset, so this fast-path makes every call return `credentials_missing`
  // without a Supabase round-trip — important for tests that don't mock
  // supabase-admin + buyer-facing calls that would otherwise block on
  // network timeouts.
  if (!platformCreds) {
    return { ready: false, reason: "credentials_missing" };
  }

  let schemaOk = true;
  let sellerOnboarded = false;
  try {
    // Guard · the paypal_merchant_id + paypal_charges_enabled columns
    // are added by mig 336. Fail-soft on ANY error (undefined column,
    // network timeout, auth) · a failed probe is honest `schema_pending`.
    const probe = nexSupabaseAdmin
      .from("nex_business")
      .select("paypal_merchant_id, paypal_charges_enabled")
      .eq("id", businessId)
      .maybeSingle();
    // Hard 2.5s cap · the resolver must never hang a buyer checkout on
    // an upstream Supabase outage.
    const timeout = new Promise<{ data: null; error: { message: string } }>(
      (resolve) =>
        setTimeout(
          () => resolve({ data: null, error: { message: "probe_timeout" } }),
          2500,
        ),
    );
    const { data, error } = (await Promise.race([probe, timeout])) as {
      data: unknown;
      error: unknown;
    };
    if (error) {
      // Postgres undefined-column (42703), network, auth, or the
      // timeout above · the only safe interpretation is "we cannot
      // prove readiness". Column-missing is by far the most common
      // cause pre-mig-336.
      schemaOk = false;
    } else if (data) {
      const row = data as {
        paypal_merchant_id?: string | null;
        paypal_charges_enabled?: boolean | null;
      };
      sellerOnboarded =
        typeof row.paypal_merchant_id === "string" &&
        row.paypal_merchant_id.trim().length > 0 &&
        row.paypal_charges_enabled === true;
    }
  } catch {
    schemaOk = false;
  }

  if (!schemaOk) return { ready: false, reason: "schema_pending" };
  if (!platformCreds) return { ready: false, reason: "credentials_missing" };
  if (!sellerOnboarded) return { ready: false, reason: "seller_not_onboarded" };
  return { ready: true, reason: "ready" };
}

/** Dynamic QRIS readiness.
 *  Requires ALL:
 *   1 · Platform provider credential set (MIDTRANS_SERVER_KEY OR
 *       XENDIT_WEBHOOK_TOKEN / XENDIT_SECRET_KEY)
 *   2 · Per-business QRIS-enabled flag · no column exists today, so
 *       this always evaluates FALSE until the owner authorises a schema
 *       addition (`seller_not_enabled`).
 *
 *  As of 2026-11-16: audit says neither provider env is set, so this
 *  returns `provider_pending` (the first failing gate).
 */
async function probeQrisDynamic(
  _businessId: NexUuid,
): Promise<{ ready: boolean; reason: QrisReadinessReason }> {
  const midtrans = (process.env.MIDTRANS_SERVER_KEY ?? "").trim();
  const xenditCb = (process.env.XENDIT_WEBHOOK_TOKEN ?? "").trim();
  const xenditSk = (process.env.XENDIT_SECRET_KEY ?? "").trim();
  const providerCreds =
    midtrans.length > 0 || xenditCb.length > 0 || xenditSk.length > 0;

  if (!providerCreds) return { ready: false, reason: "provider_pending" };

  // No per-business QRIS-enabled column exists today. Until one is
  // added, treat every seller as NOT opted in · documented honestly.
  return { ready: false, reason: "seller_not_enabled" };
}

/** Stripe readiness — for FUTURE / RESERVED use.
 *  The sealed 2026-11-10 doctrine keeps Stripe RESERVED for NEX member
 *  subscriptions · it must NOT appear as a shop checkout option. This
 *  probe always returns `reserved_for_subscriptions` for shop-method
 *  purposes. The platform-webhook-secret and seller-onboarding checks
 *  are included for admin diagnostics only.
 */
async function probeStripe(
  _businessId: NexUuid,
): Promise<{ ready: boolean; reason: StripeReadinessReason }> {
  // Doctrine · Stripe is NOT a shop payment method. Always false here.
  // We still surface the SPECIFIC reason that would otherwise block
  // the integration so the admin surface shows the honest ordering.
  const secret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (secret.length === 0) {
    return { ready: false, reason: "platform_webhook_secret_missing" };
  }
  // Platform could serve Stripe, but doctrine reserves it for subs.
  return { ready: false, reason: "reserved_for_subscriptions" };
}

/**
 * Admin / dev-only · return each provider's granular readiness with
 * a machine-readable reason string. NEVER surface to buyers · the
 * per-provider reason strings are debugging aids only.
 */
export async function getSellerMethodReadiness(
  businessId: NexUuid,
): Promise<SellerMethodReadiness> {
  const [qr, paypal, qris, stripe] = await Promise.all([
    probeQrManual(businessId),
    probePaypal(businessId),
    probeQrisDynamic(businessId),
    probeStripe(businessId),
  ]);
  return {
    qr_manual: qr,
    paypal,
    qris_dynamic: qris,
    stripe,
  };
}

/**
 * Report which payment methods a given seller has activated.
 *
 * Fail-soft: any single lookup failure yields that method = false
 * rather than throwing; the buyer never gets blocked from checkout
 * because a dependency is temporarily unavailable.
 *
 * Buyer-facing contract — a method flips to `true` only when the
 * dedicated probe reports BOTH platform + per-business readiness.
 * This is deliberate: making an unfinished provider discoverable is
 * worse than leaving it hidden.
 */
export async function getSellerActiveMethods(
  businessId: NexUuid,
): Promise<SellerActiveMethods> {
  // Use the granular readiness as the single source of truth so the
  // dev dashboard and the buyer-facing picker cannot drift apart.
  const readiness = await getSellerMethodReadiness(businessId);
  const qr_manual = readiness.qr_manual.ready;
  const paypal = readiness.paypal.ready;
  const qris_dynamic = readiness.qris_dynamic.ready;
  const flags = [paypal, qr_manual, qris_dynamic];
  const configured_count = flags.filter(Boolean).length;
  return {
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
