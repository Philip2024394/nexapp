// src/lib/nex-native/calls/send-cart-order.transactional-candidate.ts
//
// UNACTIVATED candidate wrapper · REVIEW REQUIRED · 2026-11-19 (§16.35)
// -----------------------------------------------------------------------------
// Production code does NOT import this file. It is a reviewable
// candidate for the TypeScript side of the sendCartOrderAction
// atomicity fix (§16.13 / §16.27 gap). The paired database object
// (SECURITY DEFINER PL/pgSQL function `nex_create_cart_order_tx`)
// lives at
// `nex-supabase/candidate-migrations/C002_nex_cart_order_create_transactional.sql`
// and is UNAPPLIED. The apply-ready sibling lives beside it as
// `354_nex_cart_order_create_transactional_PREVIEW.sql`.
//
// Activation requires (see candidate-migrations/README-UNAPPLIED.md):
//   1. Owner authorisation naming the target DB (sandbox
//      kdstoyyeygcopkogqsyv or prod ijvqdvsvwtwxzcqmoqit).
//   2. The candidate SQL moved to `nex-supabase/migrations/` with a
//      real numeric prefix + matching rollback + a dedicated
//      `apply-migration-354-sandbox.mjs` script (the PREVIEW already
//      exists beside the SQL).
//   3. A feature flag (planned: `NEX_CART_ORDER_TX=1`) that routes
//      the existing `sendCartOrderAction` through this wrapper · the
//      existing direct-write + fail-soft path stays as a fallback
//      until BROWSER-tier verification passes on the sandbox.
//
// Lives under `calls/` to reuse the same quarantine folder as the
// first transactional candidate (`invite-service.transactional-candidate.ts`).
// The name `calls/` is historical · not a claim this file participates
// in the realtime call-invite flow.
//
// This file intentionally has no `server-only` import so it can be
// imported into vitest mocked tests without a side-effect. Production
// callers will route through the shared cart-order server action (not
// this file) once the feature flag is live · at which point
// `server-only` will be added.
//
// What this wrapper does NOT do (stays in `sendCartOrderAction`)
//   · Session resolution + sender identity · still the server action's
//     responsibility.
//   · Cart snapshot assembly (per-item price lookup, delivery-quote
//     shaping, UUID minting for `attachment_meta.cart.order_id`) ·
//     stays in the server action.
//   · Conversation resolution · the RPC accepts a conversation_id;
//     the server action is still the place that calls
//     `getOrCreatePeerConversationAsSender` with the contacts-only
//     gate.
//   · Discovery-signal emission (`cart_sent`) · stays post-RPC
//     fail-soft in the server action.
//   · Cart cleanup (removeCartItem) · stays post-RPC.
//   · Seller notification (`notifySellerNewOrder`) · stays post-RPC
//     fail-soft with the `seller_notified` event-marker dedup added
//     round 17.

// Minimal SupabaseAdmin shape · we only need `.rpc()` for the
// error-mapping branches. The real client is injected at activation
// time; this candidate accepts it as an argument so the tests can
// hand in a stub.
interface AdminLike {
  rpc(
    name: string,
    params: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
}

export interface CreateCartOrderTxInput {
  readonly selfSupabaseUserId: string;
  readonly senderAccountId: string;
  readonly conversationId: string;
  readonly messageBody: string;
  readonly attachmentMeta: Record<string, unknown>;
  readonly sendIntentId: string | null;
  readonly orderId: string;
  /** NULL for pure menu_item carts · function then writes message only. */
  readonly primaryProductId: string | null;
  /** When set, both nex_peer_message AND nex_order dedup against it. */
  readonly idempotencyKey: string | null;
  readonly customerNote: string | null;
}

export type CreateCartOrderTxErrorCode =
  | "caller_identity_mismatch"
  | "caller_account_not_found"
  | "conversation_not_found"
  | "conversation_not_participant"
  | "message_dedup_not_resolved"
  | "product_not_found"
  | "order_dedup_not_resolved"
  | "rpc_shape_error"
  | "rpc_unavailable";

export type CreateCartOrderTxSkipped =
  | "no_product_item"
  | "order_dedup_hit"
  | "order_dedup_race";

export interface CreateCartOrderTxResult {
  readonly ok: boolean;
  readonly messageId?: string;
  readonly orderId?: string | null;
  readonly skipped?: CreateCartOrderTxSkipped;
  readonly error?: CreateCartOrderTxErrorCode;
}

interface RpcRow {
  readonly out_message_id: string | null;
  readonly out_order_id: string | null;
  readonly out_skipped: string | null;
}

/** CANDIDATE wrapper · routes the cart-snapshot peer message AND the
 *  representative-product nex_order row through a single PL/pgSQL
 *  function so both land atomically or neither does. Not imported by
 *  production code. */
export async function createCartOrderTransactionalCandidate(
  admin: AdminLike,
  input: CreateCartOrderTxInput,
): Promise<CreateCartOrderTxResult> {
  const { data, error } = await admin.rpc("nex_create_cart_order_tx", {
    p_self_supabase_user_id: input.selfSupabaseUserId,
    p_sender_account_id: input.senderAccountId,
    p_conversation_id: input.conversationId,
    p_message_body: input.messageBody,
    p_attachment_meta: input.attachmentMeta,
    p_send_intent_id: input.sendIntentId ?? "",
    p_order_id: input.orderId,
    p_primary_product_id: input.primaryProductId,
    p_idempotency_key: input.idempotencyKey ?? "",
    p_customer_note: input.customerNote ?? "",
  });

  if (error) {
    const msg = error.message ?? "";
    // Function missing · the RPC has not been applied to this DB. The
    // TypeScript caller is expected to fall back to the legacy direct-
    // write path when it receives this code (controlled by the
    // planned feature flag).
    if (/function.*does not exist|42883/i.test(msg)) {
      return { ok: false, error: "rpc_unavailable" };
    }
    if (/caller_identity_mismatch/.test(msg)) {
      return { ok: false, error: "caller_identity_mismatch" };
    }
    if (/caller_account_not_found/.test(msg)) {
      return { ok: false, error: "caller_account_not_found" };
    }
    if (/conversation_not_found/.test(msg)) {
      return { ok: false, error: "conversation_not_found" };
    }
    if (/conversation_not_participant/.test(msg)) {
      return { ok: false, error: "conversation_not_participant" };
    }
    if (/message_dedup_not_resolved/.test(msg)) {
      return { ok: false, error: "message_dedup_not_resolved" };
    }
    if (/product_not_found/.test(msg)) {
      return { ok: false, error: "product_not_found" };
    }
    if (/order_dedup_not_resolved/.test(msg)) {
      return { ok: false, error: "order_dedup_not_resolved" };
    }
    return { ok: false, error: "rpc_shape_error" };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "rpc_shape_error" };
  }
  const row = data[0] as RpcRow;

  if (!row.out_message_id) {
    return { ok: false, error: "rpc_shape_error" };
  }

  if (row.out_skipped === "no_product_item") {
    return {
      ok: true,
      messageId: row.out_message_id,
      orderId: null,
      skipped: "no_product_item",
    };
  }

  if (row.out_skipped === "order_dedup_hit" || row.out_skipped === "order_dedup_race") {
    return {
      ok: true,
      messageId: row.out_message_id,
      orderId: row.out_order_id ?? undefined,
      skipped: row.out_skipped,
    };
  }

  return {
    ok: true,
    messageId: row.out_message_id,
    orderId: row.out_order_id ?? undefined,
  };
}
