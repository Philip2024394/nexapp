// src/lib/nex-native/calls/__tests__/send-cart-order-transactional-candidate.test.ts
//
// Lane E · 2026-11-19 (§16.35) · UNAPPLIED transactional candidate.
//
// Anchors the TypeScript wrapper's error-code mapping for the
// unapplied `nex_create_cart_order_tx` RPC. SPECIFICATION of how the
// wrapper should translate the RPC's error / data shapes into the
// CreateCartOrderTxResult contract.
//
// Explicit limits of this coverage
// --------------------------------
// · These are mocked RPC round-trips · they prove the TypeScript
//   mapping. They do NOT prove the database's transactional rollback
//   semantics, concurrency safety, or that the function exists in any
//   target DB.
// · The real transactional acceptance tests (listed in ledger §16.35.X)
//   must later run in the sandbox against a deployed function, using
//   disposable accounts via the supported registration path, and must
//   observe the ACTUAL post-failure DB state (no orphan nex_order row
//   when the message INSERT raises, no orphan nex_peer_message row
//   when the order INSERT raises for a product cart, etc).

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createCartOrderTransactionalCandidate } from "../send-cart-order.transactional-candidate";

function okRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    out_message_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    out_order_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    out_skipped: null,
    ...overrides,
  };
}

function makeAdmin(
  response:
    | { data: unknown; error: null }
    | { data: null; error: { message: string; code?: string } },
) {
  return {
    rpc: vi.fn().mockResolvedValue(response),
  };
}

const BASE_INPUT = {
  selfSupabaseUserId: "11111111-1111-1111-1111-111111111111",
  senderAccountId: "22222222-2222-2222-2222-222222222222",
  conversationId: "33333333-3333-3333-3333-333333333333",
  messageBody: "🛒 Cart order",
  attachmentMeta: { cart: { order_id: "44444444-4444-4444-4444-444444444444" } },
  sendIntentId: "55555555-5555-5555-5555-555555555555",
  orderId: "44444444-4444-4444-4444-444444444444",
  primaryProductId: "66666666-6666-6666-6666-666666666666",
  idempotencyKey: "55555555-5555-5555-5555-555555555555",
  customerNote: "buzz for upstairs",
};

describe("Lane E · createCartOrderTransactionalCandidate · error mapping specification (§16.35)", () => {
  it("E-OK-1 · product cart success · returns message id + order id", async () => {
    const admin = makeAdmin({ data: [okRow()], error: null });
    const r = await createCartOrderTransactionalCandidate(admin, BASE_INPUT);
    expect(r.ok).toBe(true);
    expect(r.messageId).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(r.orderId).toBe("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    expect(r.skipped).toBeUndefined();
    expect(admin.rpc).toHaveBeenCalledWith("nex_create_cart_order_tx", expect.objectContaining({
      p_self_supabase_user_id: BASE_INPUT.selfSupabaseUserId,
      p_sender_account_id: BASE_INPUT.senderAccountId,
      p_order_id: BASE_INPUT.orderId,
      p_primary_product_id: BASE_INPUT.primaryProductId,
    }));
  });

  it("E-OK-2 · pure menu_item cart · product id NULL · skipped='no_product_item' · order id null", async () => {
    const admin = makeAdmin({
      data: [okRow({ out_order_id: null, out_skipped: "no_product_item" })],
      error: null,
    });
    const r = await createCartOrderTransactionalCandidate(admin, {
      ...BASE_INPUT,
      primaryProductId: null,
      idempotencyKey: null,
    });
    expect(r.ok).toBe(true);
    expect(r.messageId).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(r.orderId).toBeNull();
    expect(r.skipped).toBe("no_product_item");
  });

  it("E-DUP-1 · idempotency_key already present · skipped='order_dedup_hit' with existing order id", async () => {
    const admin = makeAdmin({
      data: [okRow({ out_skipped: "order_dedup_hit" })],
      error: null,
    });
    const r = await createCartOrderTransactionalCandidate(admin, BASE_INPUT);
    expect(r.ok).toBe(true);
    expect(r.messageId).toBeDefined();
    expect(r.orderId).toBe("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    expect(r.skipped).toBe("order_dedup_hit");
  });

  it("E-DUP-2 · idempotency_key raced after dedup SELECT · skipped='order_dedup_race'", async () => {
    const admin = makeAdmin({
      data: [okRow({ out_skipped: "order_dedup_race" })],
      error: null,
    });
    const r = await createCartOrderTransactionalCandidate(admin, BASE_INPUT);
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe("order_dedup_race");
  });

  it("E-ERR-RPC-MISSING · function does not exist · mapped to rpc_unavailable for fallback routing", async () => {
    const admin = makeAdmin({
      data: null,
      error: { message: "function nex_create_cart_order_tx(...) does not exist", code: "42883" },
    });
    const r = await createCartOrderTransactionalCandidate(admin, BASE_INPUT);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("rpc_unavailable");
  });

  it("E-ERR-IDENTITY · caller_identity_mismatch RAISE mapped", async () => {
    const admin = makeAdmin({
      data: null,
      error: { message: "caller_identity_mismatch · auth.uid != p_self_supabase_user_id" },
    });
    const r = await createCartOrderTransactionalCandidate(admin, BASE_INPUT);
    expect(r.error).toBe("caller_identity_mismatch");
  });

  it("E-ERR-ACCOUNT · caller_account_not_found RAISE mapped", async () => {
    const admin = makeAdmin({
      data: null,
      error: { message: "caller_account_not_found" },
    });
    const r = await createCartOrderTransactionalCandidate(admin, BASE_INPUT);
    expect(r.error).toBe("caller_account_not_found");
  });

  it("E-ERR-CONV-MISSING · conversation_not_found RAISE mapped", async () => {
    const admin = makeAdmin({
      data: null,
      error: { message: "conversation_not_found" },
    });
    const r = await createCartOrderTransactionalCandidate(admin, BASE_INPUT);
    expect(r.error).toBe("conversation_not_found");
  });

  it("E-ERR-CONV-NONPART · conversation_not_participant RAISE mapped", async () => {
    const admin = makeAdmin({
      data: null,
      error: { message: "conversation_not_participant" },
    });
    const r = await createCartOrderTransactionalCandidate(admin, BASE_INPUT);
    expect(r.error).toBe("conversation_not_participant");
  });

  it("E-ERR-MSG-DEDUP · message_dedup_not_resolved RAISE mapped", async () => {
    const admin = makeAdmin({
      data: null,
      error: { message: "message_dedup_not_resolved" },
    });
    const r = await createCartOrderTransactionalCandidate(admin, BASE_INPUT);
    expect(r.error).toBe("message_dedup_not_resolved");
  });

  it("E-ERR-PRODUCT · product_not_found RAISE mapped", async () => {
    const admin = makeAdmin({
      data: null,
      error: { message: "product_not_found" },
    });
    const r = await createCartOrderTransactionalCandidate(admin, BASE_INPUT);
    expect(r.error).toBe("product_not_found");
  });

  it("E-ERR-ORDER-DEDUP · order_dedup_not_resolved RAISE mapped", async () => {
    const admin = makeAdmin({
      data: null,
      error: { message: "order_dedup_not_resolved" },
    });
    const r = await createCartOrderTransactionalCandidate(admin, BASE_INPUT);
    expect(r.error).toBe("order_dedup_not_resolved");
  });

  it("E-ERR-SHAPE-EMPTY · RPC returns empty array · mapped to rpc_shape_error", async () => {
    const admin = makeAdmin({ data: [], error: null });
    const r = await createCartOrderTransactionalCandidate(admin, BASE_INPUT);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("rpc_shape_error");
  });

  it("E-ERR-SHAPE-NON-ARRAY · RPC returns object · mapped to rpc_shape_error", async () => {
    const admin = makeAdmin({ data: { ok: true }, error: null });
    const r = await createCartOrderTransactionalCandidate(admin, BASE_INPUT);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("rpc_shape_error");
  });

  it("E-PARAM-EMPTY-INTENT · null send_intent_id serialises as empty string so NULLIF triggers", async () => {
    const admin = makeAdmin({ data: [okRow()], error: null });
    await createCartOrderTransactionalCandidate(admin, { ...BASE_INPUT, sendIntentId: null });
    expect(admin.rpc).toHaveBeenCalledWith(
      "nex_create_cart_order_tx",
      expect.objectContaining({ p_send_intent_id: "" }),
    );
  });

  it("E-PARAM-EMPTY-NOTE · null customerNote serialises as empty string so NULLIF triggers", async () => {
    const admin = makeAdmin({ data: [okRow()], error: null });
    await createCartOrderTransactionalCandidate(admin, { ...BASE_INPUT, customerNote: null });
    expect(admin.rpc).toHaveBeenCalledWith(
      "nex_create_cart_order_tx",
      expect.objectContaining({ p_customer_note: "" }),
    );
  });
});
