// src/lib/nex-native/manage-orders/dispatch-service.ts
//
// Seller dispatch · server-side operation layer · PROPOSAL ARTEFACT · 2026-11-17
// -----------------------------------------------------------------------------
// Pairs with:
//   · nex-supabase/migrations/349_nex_order_dispatch_PROPOSAL.sql (not applied)
//   · src/lib/nex-native/manage-orders/dispatch-eta.ts (pure math)
//   · src/lib/nex-native/manage-orders/dispatch-feature-flag.ts (env gate)
//
// SEALED INVARIANTS honoured here
//   1. Session identity is derived from the VERIFIED Next.js server-action
//      session (resolveSessionWithDevOverride). Never from a client-supplied
//      value. Seller-identity spoofing via POSTed form fields is rejected
//      because the caller cannot influence session.account.id.
//   2. Ownership is re-verified against nex_business.owner_account_id for
//      the exact order being modified — single-seller boundary — BEFORE the
//      RPC is called. The RPC re-verifies as defence in depth.
//   3. Payment vs fulfilment are independent. This path NEVER changes
//      nex_order.state (payment state machine). It only writes dispatch_*
//      columns via the narrow RPC. Terminal payment states (cancelled /
//      refunded) short-circuit with a typed rejection.
//   4. Feature-flag gated. When NEX_DISPATCH_TRACKING_ENABLED !== "true"
//      every public entrypoint returns {ok:false, reason:"feature_disabled"}
//      WITHOUT reading dispatch_* columns · schema-safe under disabled.
//   5. No fake success. If migration 349 has not been applied, the RPC
//      call will return a Postgres error and this layer surfaces it
//      truthfully to the caller — no silent swallow, no mock persistence.
//   6. Notifications: on success we fire a buyer shipment_update push via
//      the existing privacy-safe copy (identical lock-screen body for every
//      sub-event). Push subscription + dedupe stays owned by the push layer.
//   7. Multi-seller boundary: nex_order.business_id is a single FK and
//      nex_business.owner_account_id is single. One order ↔ one fulfilling
//      seller. Any attempt by another account to invoke this service for
//      someone else's order is rejected with forbidden_not_fulfilling_seller.

import "server-only";

import {
  computeDispatchEta,
  type EtaResult,
  type TransitUnit,
} from "./dispatch-eta";
import { isDispatchFeatureEnabled } from "./dispatch-feature-flag";
import { notifyBuyerShipmentUpdate } from "./order-notification-service";
import { nexSupabaseAdmin } from "../supabase-admin";
import { resolveSessionWithDevOverride } from "../app/dev-impersonation";
import type { NexOrderRow, NexUuid } from "../types";

/** Carrier categories recognised today. Keep in sync with the DB CHECK
 *  constraint in migration 349 (`dispatch_provider`). */
export type DispatchProvider =
  | "dhl"
  | "ups"
  | "fedex"
  | "postal"
  | "sea_freight"
  | "other";

/** Seller-reported fulfilment state. NEVER inferred from elapsed time or
 *  from the illustrative buyer-side animation. Delivered is seller-
 *  attributed (no carrier-verified source wired). */
export type DispatchState =
  | "not_dispatched"
  | "preparing"
  | "dispatched"
  | "delivered";

/** Explicit action verbs accepted by the RPC. "save" never flips state. */
export type DispatchAction =
  | "save"
  | "mark_preparing"
  | "mark_dispatched"
  | "mark_delivered";

export interface DispatchSaveInput {
  readonly order_id: NexUuid;
  readonly provider: DispatchProvider | null;
  readonly provider_custom: string | null;
  readonly tracking_number: string | null;
  readonly tracking_url: string | null;
  readonly estimated_transit_qty: number | null;
  readonly estimated_transit_unit: TransitUnit | null;
  readonly action: DispatchAction;
}

export interface DispatchSaveOk {
  readonly ok: true;
  readonly order_id: NexUuid;
  readonly dispatch_state: DispatchState;
  readonly dispatched_at: string | null;
  readonly delivered_at: string | null;
  readonly dispatch_provider: DispatchProvider | null;
  readonly dispatch_provider_custom: string | null;
  readonly dispatch_tracking_number: string | null;
  readonly dispatch_tracking_url: string | null;
  readonly estimated_transit_qty: number | null;
  readonly estimated_transit_unit: TransitUnit | null;
  readonly tracking_updated_at: string | null;
  readonly eta: EtaResult;
  readonly notified_buyer: boolean;
}

export type DispatchSaveFailureReason =
  | "feature_disabled"
  | "not_signed_in"
  | "order_not_found"
  | "forbidden_not_fulfilling_seller"
  | "order_terminal_payment_state"
  | "invalid_input"
  | "tracking_url_must_be_https"
  | "invalid_dispatch_transition"
  | "invalid_action"
  | "db_error";

export interface DispatchSaveFailure {
  readonly ok: false;
  readonly reason: DispatchSaveFailureReason;
  readonly message?: string;
}

export type DispatchSaveResult = DispatchSaveOk | DispatchSaveFailure;

// ----- validation --------------------------------------------------------

const MAX_URL = 1024;
const MAX_TRACKING_NUMBER = 128;
const MAX_PROVIDER_CUSTOM = 80;

/** Pre-RPC input validation. Mirrors the DB CHECK constraints so the
 *  typical bad-input case fails fast without a network round-trip. The
 *  RPC still validates authoritatively. */
function validateInput(input: DispatchSaveInput): DispatchSaveFailure | null {
  if (input.provider != null &&
      !["dhl", "ups", "fedex", "postal", "sea_freight", "other"]
        .includes(input.provider)) {
    return { ok: false, reason: "invalid_input", message: "invalid provider" };
  }
  if (input.provider_custom != null) {
    const t = input.provider_custom.trim();
    if (t.length === 0 || t.length > MAX_PROVIDER_CUSTOM) {
      return { ok: false, reason: "invalid_input", message: "provider_custom length" };
    }
    if (!["postal", "sea_freight", "other"].includes(input.provider ?? "")) {
      return { ok: false, reason: "invalid_input", message: "provider_custom requires postal/sea_freight/other" };
    }
  }
  if (input.tracking_number != null) {
    const t = input.tracking_number.trim();
    if (t.length === 0 || t.length > MAX_TRACKING_NUMBER) {
      return { ok: false, reason: "invalid_input", message: "tracking_number length" };
    }
  }
  if (input.tracking_url != null) {
    const u = input.tracking_url.trim();
    if (u.length === 0 || u.length > MAX_URL) {
      return { ok: false, reason: "invalid_input", message: "tracking_url length" };
    }
    if (!/^https:\/\//i.test(u)) {
      return { ok: false, reason: "tracking_url_must_be_https" };
    }
  }
  // qty + unit paired:
  const qtyNull = input.estimated_transit_qty == null;
  const unitNull = input.estimated_transit_unit == null;
  if (qtyNull !== unitNull) {
    return { ok: false, reason: "invalid_input", message: "qty and unit must be set together" };
  }
  if (!qtyNull) {
    const q = input.estimated_transit_qty as number;
    if (!Number.isInteger(q) || q <= 0) {
      return { ok: false, reason: "invalid_input", message: "qty must be positive integer" };
    }
    // Practical unit-specific upper bounds · days 1..365, months 1..12
    if (input.estimated_transit_unit === "days" && q > 365) {
      return { ok: false, reason: "invalid_input", message: "days qty 1..365" };
    }
    if (input.estimated_transit_unit === "months" && q > 12) {
      return { ok: false, reason: "invalid_input", message: "months qty 1..12" };
    }
  }
  if (!["save", "mark_preparing", "mark_dispatched", "mark_delivered"]
      .includes(input.action)) {
    return { ok: false, reason: "invalid_action" };
  }
  return null;
}

/** Map a Postgres error from the RPC into our typed failure reason. */
function mapPgError(message: string): DispatchSaveFailureReason {
  if (message.includes("order_not_found")) return "order_not_found";
  if (message.includes("forbidden_not_fulfilling_seller"))
    return "forbidden_not_fulfilling_seller";
  if (message.includes("order_terminal_payment_state"))
    return "order_terminal_payment_state";
  if (message.includes("tracking_url_must_be_https"))
    return "tracking_url_must_be_https";
  if (message.includes("invalid_dispatch_transition"))
    return "invalid_dispatch_transition";
  if (message.includes("invalid_action")) return "invalid_action";
  if (message.includes("invalid_provider")
      || message.includes("invalid_estimated_unit")
      || message.includes("estimated_qty_without_unit")
      || message.includes("estimated_unit_without_qty")
      || message.includes("invalid_arguments")) {
    return "invalid_input";
  }
  return "db_error";
}

// ----- public entrypoint --------------------------------------------------

/**
 * Seller writes dispatch / tracking state for an order.
 *
 * Caller contract: this is a server-only helper. The server-action
 * wrapper (sellerSaveOrderDispatchAction) must NOT accept a
 * seller_account_id from the browser form — identity is derived here
 * from the verified session.
 *
 * Flow:
 *   1. Feature flag check → feature_disabled (schema-safe, no column reads)
 *   2. Session resolve → not_signed_in
 *   3. Order load (business_id + payment state + customer_account_id)
 *   4. Fulfilling-seller ownership check against nex_business.owner_account_id
 *   5. Pre-RPC input validation (mirror of DB CHECKs)
 *   6. RPC call via service-role client
 *   7. Compute ETA for return payload (pure math; does not touch DB)
 *   8. On a seller-driven state change, fire buyer shipment_update push
 */
export async function sellerSaveOrderDispatch(
  input: DispatchSaveInput,
): Promise<DispatchSaveResult> {
  // Gate 1 · feature flag.
  if (!isDispatchFeatureEnabled()) {
    return { ok: false, reason: "feature_disabled" };
  }

  // Gate 2 · verified session identity.
  const session = await resolveSessionWithDevOverride();
  const sellerAccountId = session?.account?.id ?? null;
  if (!sellerAccountId) {
    return { ok: false, reason: "not_signed_in" };
  }

  // Gate 3 · load the order (pre-349 columns only · schema-safe lookup).
  const { data: orderRow, error: loadErr } = await nexSupabaseAdmin
    .from("nex_order")
    .select("id, business_id, state, customer_account_id, price_pence, currency, product_id")
    .eq("id", input.order_id)
    .maybeSingle();
  if (loadErr) {
    return { ok: false, reason: "db_error", message: loadErr.message };
  }
  if (!orderRow) {
    return { ok: false, reason: "order_not_found" };
  }
  if (["cancelled", "refunded"].includes(orderRow.state as string)) {
    return { ok: false, reason: "order_terminal_payment_state" };
  }

  // Gate 4 · fulfilling-seller ownership · pre-RPC defence.
  const { data: biz } = await nexSupabaseAdmin
    .from("nex_business")
    .select("owner_account_id")
    .eq("id", orderRow.business_id)
    .maybeSingle();
  if (!biz || biz.owner_account_id !== sellerAccountId) {
    return { ok: false, reason: "forbidden_not_fulfilling_seller" };
  }

  // Gate 5 · validate inputs locally (before any schema-dependent call).
  const inputErr = validateInput(input);
  if (inputErr) return inputErr;

  // Gate 6 · RPC call via service-role.
  //   The service-role client has no JWT — we pass the session-derived
  //   seller id explicitly. The RPC re-verifies ownership as defence
  //   in depth.
  const { data: rpcData, error: rpcErr } = await nexSupabaseAdmin.rpc(
    "nex_order_seller_save_dispatch",
    {
      p_order_id: input.order_id,
      p_seller_account_id: sellerAccountId,
      p_provider: input.provider,
      p_provider_custom: input.provider_custom,
      p_tracking_number: input.tracking_number,
      p_tracking_url: input.tracking_url,
      p_estimated_qty: input.estimated_transit_qty,
      p_estimated_unit: input.estimated_transit_unit,
      p_action: input.action,
    },
  );
  if (rpcErr) {
    return {
      ok: false,
      reason: mapPgError(rpcErr.message ?? ""),
      message: rpcErr.message,
    };
  }

  // RPC returns a single row · supabase-js wraps it in an array.
  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  if (!row) {
    return { ok: false, reason: "db_error", message: "rpc_returned_no_row" };
  }

  // Gate 7 · compute ETA for the response (pure).
  const eta = computeDispatchEta({
    dispatched_at: row.dispatched_at ?? null,
    estimated_transit_qty: row.estimated_transit_qty ?? null,
    estimated_transit_unit: (row.estimated_transit_unit ?? null) as TransitUnit | null,
  });

  // Gate 8 · notify buyer on a state-changing action. "save" does NOT
  // change state · no push. Explicit mapping prevents accidental fan-
  // out on noise edits.
  let notified = false;
  const subKind =
    input.action === "mark_preparing"
      ? "preparing"
      : input.action === "mark_dispatched"
        ? "dispatched"
        : input.action === "mark_delivered"
          ? "delivered_by_seller"
          : null;
  if (subKind) {
    // notifyBuyerShipmentUpdate performs its own second-layer flag
    // check (schema-safe when disabled) and resolves the push
    // subscription via the existing dispatch layer. Failure here must
    // not undo the DB write — we log via the return shape only.
    const buyerOrder: NexOrderRow = {
      ...(orderRow as unknown as NexOrderRow),
      id: input.order_id,
      customer_account_id: orderRow.customer_account_id as NexUuid,
    };
    const pushResult = await notifyBuyerShipmentUpdate(buyerOrder, subKind);
    notified = pushResult.delivered > 0;
  }

  return {
    ok: true,
    order_id: input.order_id,
    dispatch_state: row.dispatch_state as DispatchState,
    dispatched_at: row.dispatched_at ?? null,
    delivered_at: row.delivered_at ?? null,
    dispatch_provider: (row.dispatch_provider ?? null) as DispatchProvider | null,
    dispatch_provider_custom: row.dispatch_provider_custom ?? null,
    dispatch_tracking_number: row.dispatch_tracking_number ?? null,
    dispatch_tracking_url: row.dispatch_tracking_url ?? null,
    estimated_transit_qty: row.estimated_transit_qty ?? null,
    estimated_transit_unit: (row.estimated_transit_unit ?? null) as TransitUnit | null,
    tracking_updated_at: row.tracking_updated_at ?? null,
    eta,
    notified_buyer: notified,
  };
}

/**
 * Read-only loader used by both the seller dispatch panel and the
 * buyer tracking bottom sheet. Behind the feature flag this returns
 * a disabled-shaped null without touching any dispatch_* column.
 */
export async function loadOrderDispatchSnapshot(
  orderId: NexUuid,
  viewerAccountId: NexUuid,
): Promise<
  | { ok: true; snapshot: DispatchSnapshot }
  | { ok: false; reason: "feature_disabled" | "not_found" | "forbidden" | "db_error"; message?: string }
> {
  if (!isDispatchFeatureEnabled()) {
    return { ok: false, reason: "feature_disabled" };
  }

  // Schema-dependent SELECT — only reached when the flag is on.
  const { data, error } = await nexSupabaseAdmin
    .from("nex_order")
    .select(
      "id, state, customer_account_id, business_id, dispatch_state, dispatched_at, delivered_at, dispatch_provider, dispatch_provider_custom, dispatch_tracking_number, dispatch_tracking_url, estimated_transit_qty, estimated_transit_unit, tracking_updated_at",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) return { ok: false, reason: "db_error", message: error.message };
  if (!data) return { ok: false, reason: "not_found" };

  // Access rule: either the buyer on the order OR the owner of the
  // business. Nothing else. (RLS already restricts to these; this is
  // a defence-in-depth check for a service-role path.)
  const isBuyer = data.customer_account_id === viewerAccountId;
  let isSeller = false;
  if (!isBuyer) {
    const { data: biz } = await nexSupabaseAdmin
      .from("nex_business")
      .select("owner_account_id")
      .eq("id", data.business_id)
      .maybeSingle();
    isSeller = biz?.owner_account_id === viewerAccountId;
  }
  if (!isBuyer && !isSeller) return { ok: false, reason: "forbidden" };

  const eta = computeDispatchEta({
    dispatched_at: data.dispatched_at ?? null,
    estimated_transit_qty: data.estimated_transit_qty ?? null,
    estimated_transit_unit: (data.estimated_transit_unit ?? null) as TransitUnit | null,
  });

  return {
    ok: true,
    snapshot: {
      order_id: data.id as NexUuid,
      payment_state: data.state as string,
      dispatch_state: (data.dispatch_state ?? "not_dispatched") as DispatchState,
      dispatched_at: data.dispatched_at ?? null,
      delivered_at: data.delivered_at ?? null,
      dispatch_provider: (data.dispatch_provider ?? null) as DispatchProvider | null,
      dispatch_provider_custom: data.dispatch_provider_custom ?? null,
      dispatch_tracking_number: data.dispatch_tracking_number ?? null,
      dispatch_tracking_url: data.dispatch_tracking_url ?? null,
      estimated_transit_qty: data.estimated_transit_qty ?? null,
      estimated_transit_unit: (data.estimated_transit_unit ?? null) as TransitUnit | null,
      tracking_updated_at: data.tracking_updated_at ?? null,
      eta,
      viewer_role: isBuyer ? "buyer" : "seller",
    },
  };
}

export interface DispatchSnapshot {
  readonly order_id: NexUuid;
  readonly payment_state: string;
  readonly dispatch_state: DispatchState;
  readonly dispatched_at: string | null;
  readonly delivered_at: string | null;
  readonly dispatch_provider: DispatchProvider | null;
  readonly dispatch_provider_custom: string | null;
  readonly dispatch_tracking_number: string | null;
  readonly dispatch_tracking_url: string | null;
  readonly estimated_transit_qty: number | null;
  readonly estimated_transit_unit: TransitUnit | null;
  readonly tracking_updated_at: string | null;
  readonly eta: EtaResult;
  readonly viewer_role: "buyer" | "seller";
}
