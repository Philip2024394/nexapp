// src/lib/nex-native/billing/stripe-connect-service.ts
//
// NEX seller Stripe Connect · owner-authorised 2026-11-09 Round 31a.
// -----------------------------------------------------------------------------
// Shared helpers for creating and reading Stripe Connect Express
// accounts for NEX shop sellers.
//
// Design rules (sealed 2026-11-09 Owner Direction Round 31):
//   · NEX takes 0% application fee on seller transactions.
//   · NEX never holds seller funds · AccountLinks + Checkout Sessions
//     route payments directly to the seller's connected account.
//   · Seller's Stripe account is theirs · NEX stores only the
//     opaque account ID + mirrored status flags.
//   · 0 raw card numbers · 0 CVCs · 0 payment credentials stored
//     anywhere in the NEX codebase.
//
// This module is CALLED by route handlers at:
//   · /api/nex-native/billing/connect/stripe/create
//   · /api/nex-native/billing/connect/stripe/status
//   · /api/nex-native/billing/connect/stripe/refresh
//
// And by the webhook processor on `account.updated` events.

import "server-only";
import Stripe from "stripe";
import { nexSupabaseAdmin } from "../supabase-admin";

export interface StripeConnectCreateInput {
  readonly businessId: string;
  readonly ownerAccountId: string;
  readonly ownerEmail?: string | null;
  readonly returnUrl: string; // where Stripe sends the seller back
  readonly refreshUrl: string; // where Stripe sends the seller if the link expires
  readonly countryCode?: string | null; // optional ISO alpha-2 hint
}

export interface StripeConnectAccountStatus {
  readonly accountId: string | null;
  readonly chargesEnabled: boolean;
  readonly payoutsEnabled: boolean;
  readonly country: string | null;
  readonly requirementsCurrentlyDue: ReadonlyArray<string>;
  readonly onboardedAt: string | null;
  readonly lastWebhookAt: string | null;
}

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, {
    apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  });
}

/** Detect whether the sealed migration 311 columns exist. Returns
 *  false in a dev DB that hasn't had 311 applied yet · callers can
 *  then short-circuit with a clear error instead of SQL-crashing.
 *
 *  Payment audit 2026-11-14 · bug fix. The prior implementation
 *  queried `information_schema.columns` via the Supabase REST
 *  client, but PostgREST does NOT expose the information_schema
 *  by default. The call always errored → detectConnectColumns
 *  returned false even on a DB where migration 311 was fully
 *  applied. Downstream endpoints (`/billing/connect/stripe/create`,
 *  `/disconnect`, webhook state updates) shed-faulted with
 *  `columns_not_applied` 422 despite correct schema. Reproduced
 *  against sandbox `kdstoyyeygcopkogqsyv` which has all 7 columns.
 *
 *  New probe · select ONE migration-311 column directly from
 *  `nex_business` with `limit(0)` so no rows are returned. Postgres
 *  signals a missing column with code `42703`; the REST client
 *  surfaces it on `error.code` or in `error.message`. Any other
 *  error is treated as transient and fails OPEN · Stripe downstream
 *  will surface the real failure. */
export async function detectConnectColumns(): Promise<boolean> {
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_business")
      .select("stripe_connect_account_id")
      .limit(0);
    if (!error) return true;
    const code = (error as { code?: string } | null)?.code;
    const message = (error as { message?: string } | null)?.message ?? "";
    if (code === "42703" || /does not exist/i.test(message)) return false;
    // Transient blip · fail OPEN so a Supabase hiccup doesn't block
    // a sandbox dev or a real shop owner when the columns are
    // present. Any real downstream failure is surfaced by the
    // Stripe or pg update that runs after this probe.
    return true;
  } catch {
    return false;
  }
}

/** Load the current Stripe Connect status for a business, directly
 *  from the DB (no Stripe API call). Fail-soft when migration 311
 *  columns don't exist yet. */
export async function readLocalConnectStatus(
  businessId: string,
): Promise<StripeConnectAccountStatus> {
  const empty: StripeConnectAccountStatus = {
    accountId: null,
    chargesEnabled: false,
    payoutsEnabled: false,
    country: null,
    requirementsCurrentlyDue: [],
    onboardedAt: null,
    lastWebhookAt: null,
  };
  if (!UUID_SHAPE.test(businessId)) return empty;
  const available = await detectConnectColumns();
  if (!available) return empty;
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_business")
      .select(
        "stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_country, stripe_connect_requirements_currently_due, stripe_connect_onboarded_at, stripe_connect_last_webhook_at",
      )
      .eq("id", businessId)
      .maybeSingle();
    if (error || !data) return empty;
    const row = data as unknown as {
      stripe_connect_account_id: string | null;
      stripe_connect_charges_enabled: boolean | null;
      stripe_connect_payouts_enabled: boolean | null;
      stripe_connect_country: string | null;
      stripe_connect_requirements_currently_due: string[] | null;
      stripe_connect_onboarded_at: string | null;
      stripe_connect_last_webhook_at: string | null;
    };
    return {
      accountId: row.stripe_connect_account_id ?? null,
      chargesEnabled: row.stripe_connect_charges_enabled ?? false,
      payoutsEnabled: row.stripe_connect_payouts_enabled ?? false,
      country: row.stripe_connect_country ?? null,
      requirementsCurrentlyDue:
        row.stripe_connect_requirements_currently_due ?? [],
      onboardedAt: row.stripe_connect_onboarded_at ?? null,
      lastWebhookAt: row.stripe_connect_last_webhook_at ?? null,
    };
  } catch {
    return empty;
  }
}

/** Refresh the DB's mirrored view of a Connect account by calling
 *  Stripe's Accounts API. Fail-soft on API errors. */
export async function refreshAccountStatusFromStripe(
  businessId: string,
): Promise<{ ok: boolean; status: StripeConnectAccountStatus; reason?: string }> {
  if (!UUID_SHAPE.test(businessId)) {
    return {
      ok: false,
      status: await readLocalConnectStatus(businessId),
      reason: "invalid_business_id",
    };
  }
  const columnsAvailable = await detectConnectColumns();
  if (!columnsAvailable) {
    return {
      ok: false,
      status: await readLocalConnectStatus(businessId),
      reason: "columns_not_applied",
    };
  }
  const local = await readLocalConnectStatus(businessId);
  if (!local.accountId) {
    return { ok: true, status: local }; // nothing to refresh
  }
  let stripe: Stripe;
  try {
    stripe = makeStripeClient();
  } catch (e) {
    return {
      ok: false,
      status: local,
      reason: e instanceof Error ? e.message : "stripe_init_failed",
    };
  }
  try {
    const acct = await stripe.accounts.retrieve(local.accountId);
    const requirements = (acct.requirements?.currently_due ?? []) as string[];
    const chargesEnabled = acct.charges_enabled ?? false;
    const payoutsEnabled = acct.payouts_enabled ?? false;
    const country = acct.country ?? null;
    // Set onboarded_at only once (the first time charges_enabled flips TRUE).
    const onboardedAt =
      local.onboardedAt ??
      (chargesEnabled ? new Date().toISOString() : null);
    const nowIso = new Date().toISOString();
    const { error } = await nexSupabaseAdmin
      .from("nex_business")
      .update({
        stripe_connect_charges_enabled: chargesEnabled,
        stripe_connect_payouts_enabled: payoutsEnabled,
        stripe_connect_country: country,
        stripe_connect_requirements_currently_due: requirements,
        stripe_connect_onboarded_at: onboardedAt,
        stripe_connect_last_webhook_at: nowIso,
      })
      .eq("id", businessId);
    if (error) {
      return {
        ok: false,
        status: local,
        reason: `db_update_failed · ${error.message}`,
      };
    }
    return {
      ok: true,
      status: {
        accountId: local.accountId,
        chargesEnabled,
        payoutsEnabled,
        country,
        requirementsCurrentlyDue: requirements,
        onboardedAt,
        lastWebhookAt: nowIso,
      },
    };
  } catch (e) {
    const err = e as { message?: string; code?: string; statusCode?: number };
    return {
      ok: false,
      status: local,
      reason: err.code ?? err.message ?? "stripe_api_failed",
    };
  }
}

/** Disconnect a seller's Stripe Connect account from NEX. Clears the
 *  mapping on the NEX side · the Stripe account continues to exist
 *  on Stripe's side (seller keeps their own record and can reconnect
 *  later). Fail-soft when the column isn't present or the business
 *  isn't found. */
export async function disconnectConnectAccount(
  businessId: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!UUID_SHAPE.test(businessId)) {
    return { ok: false, reason: "invalid_business_id" };
  }
  const columnsAvailable = await detectConnectColumns();
  if (!columnsAvailable) {
    return { ok: false, reason: "columns_not_applied" };
  }
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_business")
      .update({
        stripe_connect_account_id: null,
        stripe_connect_charges_enabled: false,
        stripe_connect_payouts_enabled: false,
        stripe_connect_requirements_currently_due: [],
        stripe_connect_country: null,
        stripe_connect_onboarded_at: null,
        stripe_connect_last_webhook_at: new Date().toISOString(),
      })
      .eq("id", businessId);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "db_update_failed",
    };
  }
}

/** Shape of the `account` object inside a `account.updated` Stripe
 *  webhook event · narrow projection of the fields we actually
 *  persist to nex_business. */
interface StripeAccountUpdatedPayload {
  readonly id: string;
  readonly charges_enabled?: boolean;
  readonly payouts_enabled?: boolean;
  readonly country?: string | null;
  readonly requirements?: {
    readonly currently_due?: string[];
  } | null;
}

/** Process a Stripe `account.updated` webhook event · updates the
 *  nex_business row that owns the account_id. Fail-soft when the
 *  account is not mapped to any NEX business (common during onboarding
 *  retries · just log + skip). Caller MUST have verified the webhook
 *  signature already · this helper trusts its input. */
export async function handleConnectAccountUpdatedEvent(
  accountPayload: StripeAccountUpdatedPayload,
): Promise<
  | { ok: true; businessId: string; charges_enabled: boolean }
  | { ok: false; reason: string }
> {
  const accountId = accountPayload.id;
  if (!accountId || !accountId.startsWith("acct_")) {
    return { ok: false, reason: "invalid_account_id" };
  }
  const columnsAvailable = await detectConnectColumns();
  if (!columnsAvailable) {
    return { ok: false, reason: "columns_not_applied" };
  }
  // Find the NEX business mapped to this account
  const lookup = await nexSupabaseAdmin
    .from("nex_business")
    .select(
      "id, stripe_connect_onboarded_at, stripe_connect_charges_enabled",
    )
    .eq("stripe_connect_account_id", accountId)
    .maybeSingle();
  if (lookup.error) {
    return { ok: false, reason: `lookup_failed · ${lookup.error.message}` };
  }
  if (!lookup.data) {
    // Common during onboarding retries + accounts created outside NEX ·
    // not a failure, just a no-op.
    return { ok: false, reason: "no_business_for_account" };
  }
  const row = lookup.data as {
    id: string;
    stripe_connect_onboarded_at: string | null;
    stripe_connect_charges_enabled: boolean | null;
  };

  const chargesEnabled = accountPayload.charges_enabled ?? false;
  const payoutsEnabled = accountPayload.payouts_enabled ?? false;
  const country = accountPayload.country ?? null;
  const requirements = accountPayload.requirements?.currently_due ?? [];

  // onboarded_at is set-once at the FIRST transition to charges_enabled
  const onboardedAt =
    row.stripe_connect_onboarded_at ??
    (chargesEnabled ? new Date().toISOString() : null);

  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({
      stripe_connect_charges_enabled: chargesEnabled,
      stripe_connect_payouts_enabled: payoutsEnabled,
      stripe_connect_country: country,
      stripe_connect_requirements_currently_due: requirements,
      stripe_connect_onboarded_at: onboardedAt,
      stripe_connect_last_webhook_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (error) {
    return { ok: false, reason: `db_update_failed · ${error.message}` };
  }
  return { ok: true, businessId: row.id, charges_enabled: chargesEnabled };
}

/** Create a new Stripe Connect Express account for the seller and
 *  generate an AccountLink that redirects them into Stripe's hosted
 *  onboarding. Idempotent · if the seller already has an account_id,
 *  reuses it and just issues a fresh AccountLink. */
export async function createOrRefreshOnboardingLink(
  input: StripeConnectCreateInput,
): Promise<
  | {
      ok: true;
      url: string;
      accountId: string;
      reused: boolean;
    }
  | { ok: false; code: string; reason?: string }
> {
  if (!UUID_SHAPE.test(input.businessId)) {
    return { ok: false, code: "invalid_business_id" };
  }
  if (!UUID_SHAPE.test(input.ownerAccountId)) {
    return { ok: false, code: "invalid_owner_id" };
  }
  const columnsAvailable = await detectConnectColumns();
  if (!columnsAvailable) {
    return { ok: false, code: "columns_not_applied" };
  }

  let stripe: Stripe;
  try {
    stripe = makeStripeClient();
  } catch (e) {
    return {
      ok: false,
      code: "stripe_init_failed",
      reason: e instanceof Error ? e.message : undefined,
    };
  }

  const existing = await readLocalConnectStatus(input.businessId);
  let accountId = existing.accountId;
  let reused = false;

  if (!accountId) {
    // Create a new Express account. `type: 'express'` gives Stripe-
    // hosted onboarding + minimal NEX-side account surface. Country
    // is a hint — Stripe will prompt seller to confirm/change.
    try {
      const created = await stripe.accounts.create(
        {
          type: "express",
          email: input.ownerEmail ?? undefined,
          country: input.countryCode ?? undefined,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: "individual",
          metadata: {
            nex_business_id: input.businessId,
            nex_owner_account_id: input.ownerAccountId,
          },
        },
        {
          idempotencyKey: `nex-connect-create-${input.businessId}-${input.ownerAccountId}`,
        },
      );
      accountId = created.id;
      const { error } = await nexSupabaseAdmin
        .from("nex_business")
        .update({
          stripe_connect_account_id: accountId,
        })
        .eq("id", input.businessId);
      if (error) {
        return {
          ok: false,
          code: "db_write_failed",
          reason: error.message,
        };
      }
    } catch (e) {
      const err = e as { message?: string; code?: string; type?: string };
      return {
        ok: false,
        code: "stripe_account_create_failed",
        reason: err.code ?? err.type ?? err.message ?? "unknown",
      };
    }
  } else {
    reused = true;
  }

  // AccountLink · one-time URL (short-lived) that redirects the seller
  // into Stripe's hosted onboarding. The seller comes back to
  // input.returnUrl on completion or input.refreshUrl if the link
  // expired.
  try {
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: input.refreshUrl,
      return_url: input.returnUrl,
      type: "account_onboarding",
    });
    if (!link.url) {
      return {
        ok: false,
        code: "stripe_link_no_url",
      };
    }
    return { ok: true, url: link.url, accountId, reused };
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return {
      ok: false,
      code: "stripe_link_create_failed",
      reason: err.code ?? err.message ?? "unknown",
    };
  }
}
