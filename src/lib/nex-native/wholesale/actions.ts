// src/lib/nex-native/wholesale/actions.ts
//
// Authored 2026-11-18 · Phase W follow-up (W21)
//
// Server actions for the wholesale flow:
//
//   · Buyer side
//       requestWholesaleAccessAction          · idempotent INSERT
//       buyerAcceptQuoteAction                · explicit accept
//       buyerRejectQuoteAction                · explicit reject
//
//   · Seller side
//       approveWholesaleAccessAction          · status pending → approved
//       revokeWholesaleAccessAction           · status * → revoked
//       createWholesaleQuoteAction            · bind + INSERT
//       cancelWholesaleQuoteAction            · status quoted → cancelled
//
// Every action:
//   · Resolves the viewer via `resolveSessionWithDevOverride` (no
//     buyer-supplied IDs are trusted).
//   · Re-checks ownership / approval against the sealed server source
//     of truth · never trusts client state.
//   · Writes using `nexSupabaseAdmin` after the authority check.
//   · Returns a structured envelope `{ ok, ... }` rather than throwing.
//   · Fails closed with `reason: "migration_not_applied"` when the
//     backing table does not exist. Never silently falls through to
//     success · sealed DB-wired rule 2026-11-12.

"use server";

import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  resolveWholesaleApproval,
  type WholesaleAccessDecision,
} from "./approval-service";
import {
  bindQuoteFromDraft,
  canBuyerAccept,
  hasSameMaterialTerms,
  isPaymentEligible,
  type BoundQuote,
  type QuoteDraft,
  type QuoteRow,
} from "./quote-service";

// ─── Shared envelope ─────────────────────────────────────────────────

export type WholesaleActionReason =
  | "not_authenticated"
  | "business_not_found"
  | "product_not_found"
  | "forbidden"
  | "not_your_quote"
  | "quote_not_found"
  | "not_approved_buyer"
  | "already_pending"
  | "already_approved"
  | "already_revoked"
  | "invalid_input"
  | "quantity_invalid"
  | "quantity_below_moq"
  | "no_applicable_tier"
  | "product_not_wholesale"
  | "currency_invalid"
  | "freight_invalid"
  | "freight_missing"
  | "transit_range_invalid"
  | "terms_note_invalid"
  | "duties_invalid"
  | "wrong_status"
  | "expired"
  | "stale_snapshot"
  | "migration_not_applied"
  | "db_unavailable"
  | "server_error";

export type WholesaleActionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: WholesaleActionReason };

function ok<T>(value: T): WholesaleActionResult<T> {
  return { ok: true, value };
}
function fail<T>(reason: WholesaleActionReason): WholesaleActionResult<T> {
  return { ok: false, reason };
}

function isUndefinedTable(err: { code?: string } | null): boolean {
  // 2026-11-18 · browser probe revealed PostgREST returns `PGRST205`
  // ("Could not find the table '<schema>.<name>' in the schema cache")
  // when the table is missing, not the raw Postgres `42P01`. Detection
  // must honour both so migration-not-applied fail-closed actually fires
  // through the supabase-js client used by every server action here.
  return !!err && (err.code === "42P01" || err.code === "PGRST205");
}

// ─── Business + session resolution ───────────────────────────────────

async function resolveBusiness(businessId: string): Promise<
  | { readonly kind: "ok"; readonly ownerAccountId: string }
  | { readonly kind: "not_found" }
  | { readonly kind: "db" }
> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_business")
      .select("owner_account_id")
      .eq("id", businessId)
      .maybeSingle();
    if (error) return { kind: "db" };
    if (!data) return { kind: "not_found" };
    return {
      kind: "ok",
      ownerAccountId: (data as { owner_account_id: string }).owner_account_id,
    };
  } catch {
    return { kind: "db" };
  }
}

async function resolveProduct(productId: string): Promise<
  | {
      readonly kind: "ok";
      readonly businessId: string;
      readonly currency: string;
      readonly wholesaleSpecRaw: unknown;
    }
  | { readonly kind: "not_found" }
  | { readonly kind: "db" }
> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_product")
      .select("business_id, currency, spec")
      .eq("id", productId)
      .maybeSingle();
    if (error) return { kind: "db" };
    if (!data) return { kind: "not_found" };
    const d = data as { business_id: string; currency: string; spec: unknown };
    const spec = d.spec && typeof d.spec === "object" ? d.spec : null;
    const wholesale =
      spec !== null
        ? (spec as Record<string, unknown>).__wholesale
        : null;
    return {
      kind: "ok",
      businessId: d.business_id,
      currency: d.currency,
      wholesaleSpecRaw: wholesale ?? null,
    };
  } catch {
    return { kind: "db" };
  }
}

// ─── Buyer · request access (idempotent) ─────────────────────────────

export async function requestWholesaleAccessAction(input: {
  readonly businessId: string;
  readonly buyerNote?: string | null;
}): Promise<
  WholesaleActionResult<{ readonly status: "pending" | "approved" | "revoked" }>
> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return fail("not_authenticated");

  const biz = await resolveBusiness(input.businessId);
  if (biz.kind === "not_found") return fail("business_not_found");
  if (biz.kind === "db") return fail("db_unavailable");

  // A seller cannot "request access" on their own shop · it's a no-op
  // that would also fail the RLS WITH CHECK. Return a sensible envelope.
  if (biz.ownerAccountId === session.account.id) {
    return fail("forbidden");
  }

  const buyerNote =
    typeof input.buyerNote === "string"
      ? input.buyerNote.trim().slice(0, 400)
      : null;
  if (buyerNote !== null && buyerNote.length === 0) {
    // All-whitespace is treated as "no note" — do not persist empty.
  }

  // Pre-check whether a row already exists so the caller sees an honest
  // status, and so we can treat repeat taps as idempotent reads.
  try {
    const existing = await nexSupabaseAdmin
      .from("nex_wholesale_buyer_approval")
      .select("status")
      .eq("business_id", input.businessId)
      .eq("buyer_account_id", session.account.id)
      .maybeSingle();

    if (existing.error) {
      if (isUndefinedTable(existing.error)) return fail("migration_not_applied");
      return fail("db_unavailable");
    }

    if (existing.data) {
      const status = (existing.data as { status: "pending" | "approved" | "revoked" }).status;
      return ok({ status });
    }

    const { error: insErr } = await nexSupabaseAdmin
      .from("nex_wholesale_buyer_approval")
      .insert({
        business_id: input.businessId,
        buyer_account_id: session.account.id,
        status: "pending",
        requested_at: new Date().toISOString(),
        buyer_note: buyerNote && buyerNote.length > 0 ? buyerNote : null,
      });

    if (insErr) {
      if (isUndefinedTable(insErr)) return fail("migration_not_applied");
      // UNIQUE collision (race) · re-read.
      if ((insErr as { code?: string }).code === "23505") {
        return ok({ status: "pending" });
      }
      return fail("db_unavailable");
    }
    return ok({ status: "pending" });
  } catch {
    return fail("server_error");
  }
}

// ─── Seller · approve + revoke ───────────────────────────────────────

async function sellerStatusTransition(args: {
  readonly businessId: string;
  readonly buyerAccountId: string;
  readonly target: "approved" | "revoked";
}): Promise<WholesaleActionResult<{ readonly status: "approved" | "revoked" }>> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return fail("not_authenticated");

  const biz = await resolveBusiness(args.businessId);
  if (biz.kind === "not_found") return fail("business_not_found");
  if (biz.kind === "db") return fail("db_unavailable");
  if (biz.ownerAccountId !== session.account.id) return fail("forbidden");

  const nowIso = new Date().toISOString();
  const patch =
    args.target === "approved"
      ? { status: "approved" as const, decided_at: nowIso, revoked_at: null }
      : { status: "revoked" as const, revoked_at: nowIso };

  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_wholesale_buyer_approval")
      .update(patch)
      .eq("business_id", args.businessId)
      .eq("buyer_account_id", args.buyerAccountId)
      .select("status")
      .maybeSingle();

    if (error) {
      if (isUndefinedTable(error)) return fail("migration_not_applied");
      return fail("db_unavailable");
    }
    if (!data) return fail("quote_not_found"); // reuse "not_found" family
    return ok({ status: (data as { status: "approved" | "revoked" }).status });
  } catch {
    return fail("server_error");
  }
}

export async function approveWholesaleAccessAction(input: {
  readonly businessId: string;
  readonly buyerAccountId: string;
}) {
  return sellerStatusTransition({
    businessId: input.businessId,
    buyerAccountId: input.buyerAccountId,
    target: "approved",
  });
}

export async function revokeWholesaleAccessAction(input: {
  readonly businessId: string;
  readonly buyerAccountId: string;
}) {
  return sellerStatusTransition({
    businessId: input.businessId,
    buyerAccountId: input.buyerAccountId,
    target: "revoked",
  });
}

// ─── Seller · create quote ───────────────────────────────────────────

export async function createWholesaleQuoteAction(
  draft: QuoteDraft,
): Promise<WholesaleActionResult<{ readonly quoteId: string; readonly bound: BoundQuote }>> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return fail("not_authenticated");

  const biz = await resolveBusiness(draft.businessId);
  if (biz.kind === "not_found") return fail("business_not_found");
  if (biz.kind === "db") return fail("db_unavailable");
  if (biz.ownerAccountId !== session.account.id) return fail("forbidden");

  const prod = await resolveProduct(draft.productId);
  if (prod.kind === "not_found") return fail("product_not_found");
  if (prod.kind === "db") return fail("db_unavailable");
  if (prod.businessId !== draft.businessId) return fail("forbidden");

  // Re-check that the buyer is approved on this specific shop · a seller
  // cannot send a quote to a stranger.
  const decision = await resolveWholesaleApproval({
    viewerAccountId: draft.buyerAccountId,
    businessId: draft.businessId,
    businessOwnerAccountId: biz.ownerAccountId,
  });
  if (decision.kind === "db_unavailable" && decision.reason === "migration_not_applied") {
    return fail("migration_not_applied");
  }
  if (decision.kind !== "approved") return fail("not_approved_buyer");

  const bound = bindQuoteFromDraft(draft, {
    productId: draft.productId,
    productCurrency: prod.currency,
    wholesaleSpecRaw: prod.wholesaleSpecRaw,
  });
  if (!bound.ok) return fail(mapBindReason(bound.reason));

  const nowIso = new Date().toISOString();
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_wholesale_quote")
      .insert({
        business_id: bound.bound.businessId,
        buyer_account_id: bound.bound.buyerAccountId,
        product_id: bound.bound.productId,
        quantity: bound.bound.quantity,
        currency: bound.bound.currency,
        goods_unit_price_pence: bound.bound.goodsUnitPricePence,
        goods_subtotal_pence: bound.bound.goodsSubtotalPence,
        freight_pence: bound.bound.freightPence,
        freight_method: bound.bound.freightMethod,
        transit_days_min: bound.bound.transitDaysMin,
        transit_days_max: bound.bound.transitDaysMax,
        duties_disposition: bound.bound.dutiesDisposition,
        terms_note: bound.bound.termsNote,
        status: "quoted",
        quoted_at: nowIso,
        expires_at: bound.bound.expiresAt,
      })
      .select("id")
      .single();

    if (error) {
      if (isUndefinedTable(error)) return fail("migration_not_applied");
      return fail("db_unavailable");
    }
    return ok({ quoteId: (data as { id: string }).id, bound: bound.bound });
  } catch {
    return fail("server_error");
  }
}

type BindFailReason =
  | "quantity_invalid"
  | "quantity_below_moq"
  | "no_applicable_tier"
  | "product_not_wholesale"
  | "currency_invalid"
  | "freight_invalid"
  | "transit_range_invalid"
  | "terms_note_invalid"
  | "duties_invalid";

function mapBindReason(reason: BindFailReason): WholesaleActionReason {
  return reason;
}

// ─── Seller · cancel quote ───────────────────────────────────────────

export async function cancelWholesaleQuoteAction(input: {
  readonly quoteId: string;
}): Promise<WholesaleActionResult<{ readonly status: "cancelled" }>> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return fail("not_authenticated");

  try {
    const read = await nexSupabaseAdmin
      .from("nex_wholesale_quote")
      .select("business_id, status")
      .eq("id", input.quoteId)
      .maybeSingle();
    if (read.error) {
      if (isUndefinedTable(read.error)) return fail("migration_not_applied");
      return fail("db_unavailable");
    }
    if (!read.data) return fail("quote_not_found");
    const row = read.data as { business_id: string; status: QuoteRow["status"] };

    const biz = await resolveBusiness(row.business_id);
    if (biz.kind !== "ok") return fail("business_not_found");
    if (biz.ownerAccountId !== session.account.id) return fail("forbidden");

    if (row.status === "accepted") return fail("wrong_status"); // terminal
    if (row.status === "cancelled") return ok({ status: "cancelled" });
    if (row.status === "rejected" || row.status === "expired") {
      return fail("wrong_status");
    }

    const nowIso = new Date().toISOString();
    const { error } = await nexSupabaseAdmin
      .from("nex_wholesale_quote")
      .update({ status: "cancelled", cancelled_at: nowIso })
      .eq("id", input.quoteId);
    if (error) {
      if (isUndefinedTable(error)) return fail("migration_not_applied");
      return fail("db_unavailable");
    }
    return ok({ status: "cancelled" });
  } catch {
    return fail("server_error");
  }
}

// ─── Buyer · accept + reject ─────────────────────────────────────────

/** Snapshot the buyer renders alongside the Accept button. The server
 *  rejects acceptance if the row's material terms have moved since this
 *  snapshot was taken. */
export type BuyerSnapshot = Pick<
  QuoteRow,
  | "id"
  | "business_id"
  | "buyer_account_id"
  | "product_id"
  | "quantity"
  | "currency"
  | "goods_unit_price_pence"
  | "goods_subtotal_pence"
  | "freight_pence"
  | "freight_method"
  | "transit_days_min"
  | "transit_days_max"
  | "duties_disposition"
  | "terms_note"
  | "status"
  | "quoted_at"
  | "buyer_accepted_at"
  | "buyer_rejected_at"
  | "cancelled_at"
  | "expires_at"
>;

export async function buyerAcceptQuoteAction(input: {
  readonly quoteId: string;
  readonly clientSnapshot: BuyerSnapshot | null;
}): Promise<WholesaleActionResult<{ readonly status: "accepted" }>> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return fail("not_authenticated");

  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_wholesale_quote")
      .select("*")
      .eq("id", input.quoteId)
      .maybeSingle();
    if (error) {
      if (isUndefinedTable(error)) return fail("migration_not_applied");
      return fail("db_unavailable");
    }
    if (!data) return fail("quote_not_found");
    const current = data as QuoteRow;

    const decision = canBuyerAccept({
      viewerAccountId: session.account.id,
      current,
      clientSnapshot: input.clientSnapshot
        ? ({ ...input.clientSnapshot, business_id: current.business_id } as QuoteRow)
        : null,
      now: new Date(),
    });
    if (!decision.ok) return fail(decision.reason);

    const nowIso = new Date().toISOString();
    const { error: upErr } = await nexSupabaseAdmin
      .from("nex_wholesale_quote")
      .update({ status: "accepted", buyer_accepted_at: nowIso })
      .eq("id", input.quoteId)
      .eq("buyer_account_id", session.account.id)
      .eq("status", "quoted");
    if (upErr) {
      if (isUndefinedTable(upErr)) return fail("migration_not_applied");
      return fail("db_unavailable");
    }
    return ok({ status: "accepted" });
  } catch {
    return fail("server_error");
  }
}

export async function buyerRejectQuoteAction(input: {
  readonly quoteId: string;
}): Promise<WholesaleActionResult<{ readonly status: "rejected" }>> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return fail("not_authenticated");

  try {
    const read = await nexSupabaseAdmin
      .from("nex_wholesale_quote")
      .select("buyer_account_id, status")
      .eq("id", input.quoteId)
      .maybeSingle();
    if (read.error) {
      if (isUndefinedTable(read.error)) return fail("migration_not_applied");
      return fail("db_unavailable");
    }
    if (!read.data) return fail("quote_not_found");
    const row = read.data as { buyer_account_id: string; status: QuoteRow["status"] };
    if (row.buyer_account_id !== session.account.id) return fail("not_your_quote");
    if (row.status !== "quoted") return fail("wrong_status");

    const nowIso = new Date().toISOString();
    const { error } = await nexSupabaseAdmin
      .from("nex_wholesale_quote")
      .update({ status: "rejected", buyer_rejected_at: nowIso })
      .eq("id", input.quoteId)
      .eq("buyer_account_id", session.account.id)
      .eq("status", "quoted");
    if (error) {
      if (isUndefinedTable(error)) return fail("migration_not_applied");
      return fail("db_unavailable");
    }
    return ok({ status: "rejected" });
  } catch {
    return fail("server_error");
  }
}

// ─── Buyer · payment initiation gate ─────────────────────────────────
//
// Authored 2026-11-18 · Phase W follow-up (payment-gate wiring).
//
// Purpose
//   Authoritative server-side gate that every wholesale payment / order
//   initiation path MUST call BEFORE charging or persisting any order.
//   Returns `{ ok: true, value: { ... total ... } }` only when all five
//   sealed preconditions still hold against a freshly re-read quote row:
//
//     1 · approval — the buyer still has an `approved` row against this
//         business in `nex_wholesale_buyer_approval` (not pending, not
//         revoked).
//     2 · ownership — the resolved viewer is the row's buyer (the row
//         itself distinguishes wholesale from retail; wholesale lives in
//         `nex_wholesale_quote`, retail does not · server-persisted
//         context, not a caller-controlled boolean).
//     3 · explicit acceptance — `status = 'accepted'` with a non-null
//         `buyer_accepted_at`. A `quoted` row is not payable, and an
//         `expired`/`rejected`/`cancelled` row is not payable.
//     4 · unexpired terms — `expires_at` is null or still in the future.
//     5 · material-snapshot consistency — if the caller passed the
//         snapshot the buyer last saw rendered, the fresh server row
//         must still match on quantity, currency, goods unit price,
//         goods subtotal, freight (amount + method), transit range,
//         duties disposition, terms note, product/buyer/business ids.
//
// Freight
//   "Unknown freight is not zero." If the fresh row has `freight_pence =
//   null`, the gate fails `freight_missing` · no inference, no default.
//   Only when freight is a non-null integer does the gate add it to the
//   goods subtotal to derive the authoritative total.
//
// Fail-closed
//   42P01 (undefined_table) against `nex_wholesale_quote` or the
//   approval table returns `migration_not_applied` · any other DB error
//   returns `db_unavailable`. The gate NEVER promotes either state to
//   `ok`. Sealed DB-wired rule (2026-11-12).
//
// Not in scope
//   This action does NOT charge Stripe, write an order row, or emit any
//   side effect beyond the single SELECT required to re-verify the row.
//   It is a pure gate · downstream order-persisting / payment-initiating
//   code must call it, honour its envelope, and derive totals from the
//   returned value (never from caller-supplied numbers).

export interface WholesalePaymentGateValue {
  readonly quoteId: string;
  readonly businessId: string;
  readonly buyerAccountId: string;
  readonly productId: string;
  readonly currency: string;
  readonly quantity: number;
  readonly goodsSubtotalPence: number;
  readonly freightPence: number;
  readonly freightMethod: string | null;
  readonly totalPence: number;
  readonly acceptedAt: string;
}

export async function evaluateWholesalePaymentGateAction(input: {
  readonly quoteId: string;
  /** Optional · the snapshot the buyer last saw rendered. When present,
   *  any material divergence between the fresh row and this snapshot
   *  rejects the initiation. Omit only for server-internal recheck
   *  paths that already hold the latest row. */
  readonly clientSnapshot: BuyerSnapshot | null;
}): Promise<WholesaleActionResult<WholesalePaymentGateValue>> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return fail("not_authenticated");

  try {
    // Re-read the quote row freshly · never trust client state.
    const { data, error } = await nexSupabaseAdmin
      .from("nex_wholesale_quote")
      .select("*")
      .eq("id", input.quoteId)
      .maybeSingle();
    if (error) {
      if (isUndefinedTable(error)) return fail("migration_not_applied");
      return fail("db_unavailable");
    }
    if (!data) return fail("quote_not_found");
    const current = data as QuoteRow;

    // Ownership — wholesale/retail discriminator is server-persisted:
    // only wholesale orders live in `nex_wholesale_quote`.
    if (current.buyer_account_id !== session.account.id) {
      return fail("not_your_quote");
    }

    // Freshness — material-snapshot consistency.
    if (input.clientSnapshot !== null) {
      const snapshotRow = {
        ...input.clientSnapshot,
        business_id: current.business_id,
      } as QuoteRow;
      if (!hasSameMaterialTerms(current, snapshotRow)) {
        return fail("stale_snapshot");
      }
    }

    // Approval — must still be approved RIGHT NOW. A revoke or pending
    // flip between acceptance and payment must abort initiation.
    const biz = await resolveBusiness(current.business_id);
    if (biz.kind === "db") return fail("db_unavailable");
    if (biz.kind === "not_found") return fail("business_not_found");

    const decision: WholesaleAccessDecision = await resolveWholesaleApproval({
      viewerAccountId: session.account.id,
      businessId: current.business_id,
      businessOwnerAccountId: biz.ownerAccountId,
    });
    if (decision.kind === "db_unavailable") {
      return fail(
        decision.reason === "migration_not_applied"
          ? "migration_not_applied"
          : "db_unavailable",
      );
    }
    if (decision.kind !== "approved") {
      return fail("not_approved_buyer");
    }

    // Payment-eligibility — status=accepted, freight known, not expired.
    const now = new Date();
    if (!isPaymentEligible(current, now)) {
      if (current.freight_pence === null) return fail("freight_missing");
      if (current.status !== "accepted") return fail("wrong_status");
      if (current.buyer_accepted_at === null) return fail("wrong_status");
      if (current.expires_at !== null) {
        const expiresMs = Date.parse(current.expires_at);
        if (Number.isFinite(expiresMs) && expiresMs <= now.getTime()) {
          return fail("expired");
        }
      }
      // All specific reasons ruled out · treat as wrong_status rather
      // than silently succeeding. Belt-and-braces · isPaymentEligible
      // returned false for a reason we did not map.
      return fail("wrong_status");
    }

    // Freight was non-null (isPaymentEligible would have returned false
    // otherwise). Narrow for the arithmetic.
    const freightPence = current.freight_pence;
    if (freightPence === null) {
      // Defensive · cannot happen after isPaymentEligible === true.
      return fail("freight_missing");
    }
    const acceptedAt = current.buyer_accepted_at;
    if (acceptedAt === null) {
      // Defensive · isPaymentEligible already required a non-null
      // buyer_accepted_at.
      return fail("wrong_status");
    }

    return ok({
      quoteId: current.id,
      businessId: current.business_id,
      buyerAccountId: current.buyer_account_id,
      productId: current.product_id,
      currency: current.currency,
      quantity: current.quantity,
      goodsSubtotalPence: current.goods_subtotal_pence,
      freightPence,
      freightMethod: current.freight_method,
      totalPence: current.goods_subtotal_pence + freightPence,
      acceptedAt,
    });
  } catch {
    return fail("server_error");
  }
}

// ─── Buyer · wholesale order initiation (single entry point) ─────────
//
// Authored 2026-11-18 · Round-4 payment-gate wiring.
//
// Purpose
//   The ONE server action every wholesale UI / client path calls when
//   the buyer taps "Pay" (or any future equivalent affordance). It
//   wraps `evaluateWholesalePaymentGateAction`, re-verifies every seal,
//   and returns an order-draft envelope the caller can hand to a
//   downstream payment-initiation step (Stripe Checkout session mint,
//   PayPal order creation, bank-transfer instruction page, etc.).
//
//   This action DOES NOT:
//     · write a `nex_order` row (migrations 350 + 351 add the
//       required wholesale-aware columns · unapplied at time of
//       authoring),
//     · call Stripe / PayPal / any live payment API,
//     · persist any audit trail beyond the SELECT performed by the
//       gate itself.
//
//   Retail checkout paths (`sendCartOrderAction`, `placeOrderAction`,
//   `sellerMarkOrderPaidAction`, webhook routes) stay unchanged · they
//   never touch `nex_wholesale_quote` and the wholesale/retail
//   discriminator is server-persisted (row's existence in that table).
//
// Downstream caller contract
//   Callers MUST derive totals / currency / quantity from
//   `value.gate.totalPence` (and siblings) · NEVER from client-supplied
//   numbers. If the caller wants to display the total it must render
//   the returned envelope · it may not recompute from a prior snapshot.
//
// Safety envelope
//   · No DB write today — mig 350/351 unapplied.
//   · No Stripe/PayPal/live call.
//   · No commit, push, deploy.
//   · Fails closed on `migration_not_applied` and `db_unavailable`
//     (inherited from the gate).

export interface WholesaleOrderDraft {
  /** Opaque idempotency hint the caller MAY pass to a downstream
   *  payment provider. Deterministic from the accepted quote +
   *  acceptance timestamp · survives retries without creating a
   *  duplicate Stripe session. */
  readonly idempotencyKey: string;
  /** The verified gate result · callers derive totals from here. */
  readonly gate: WholesalePaymentGateValue;
}

export async function initiateWholesaleOrderAction(input: {
  readonly quoteId: string;
  readonly clientSnapshot: BuyerSnapshot | null;
}): Promise<WholesaleActionResult<WholesaleOrderDraft>> {
  const gateResult = await evaluateWholesalePaymentGateAction({
    quoteId: input.quoteId,
    clientSnapshot: input.clientSnapshot,
  });
  if (!gateResult.ok) return gateResult;
  const gate = gateResult.value;

  // Deterministic idempotency key · same accepted quote + same
  // acceptance moment → same key. A re-accept (which bumps
  // buyer_accepted_at) produces a fresh key. Downstream providers
  // can pass this as their idempotency header.
  const idempotencyKey = `nex-wholesale-${gate.quoteId}-${gate.acceptedAt}`;

  return ok({
    idempotencyKey,
    gate,
  });
}
