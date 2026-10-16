// src/lib/nex-native/__tests__/notification-dispatch-service.test.ts
//
// R8 Stage 3b · unit tests for the sealed `dispatchPushNotification`
// helper. These prove the fail-closed guarantees that owner authorised
// before any Stage 3b caller wires in: preference gate, Vault boundary,
// subscription lifecycle (prune on 410/404), and honest reporting of
// delivered / failed / pruned counts.
//
// Everything that touches Supabase is mocked at module boundaries ·
// no DB is reached · no network is reached · no VAPID env is required.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The service under test imports `server-only` which throws under test.
// Shim it to a no-op; the rest of the Supabase surface is mocked below.
vi.mock("server-only", () => ({}));

// ─── Hoisted mocks for every collaborator the service imports ──────────

const {
  getNotificationPrefsMock,
  listPushSubscriptionsMock,
  prunePushSubscriptionMock,
  listVaultedConversationIdsMock,
  adapterSendMock,
  getNotificationsMock,
} = vi.hoisted(() => ({
  getNotificationPrefsMock: vi.fn(),
  listPushSubscriptionsMock: vi.fn(),
  prunePushSubscriptionMock: vi.fn(),
  listVaultedConversationIdsMock: vi.fn(),
  adapterSendMock: vi.fn(),
  getNotificationsMock: vi.fn(),
}));

vi.mock("../notification-preferences-service", () => ({
  getNotificationPrefs: getNotificationPrefsMock,
  categoryField: (c: string) => `${c}_enabled`,
}));

vi.mock("../push-subscription-service", () => ({
  listPushSubscriptions: listPushSubscriptionsMock,
  prunePushSubscription: prunePushSubscriptionMock,
}));

vi.mock("../vault-entry-service", () => ({
  listVaultedConversationIds: listVaultedConversationIdsMock,
}));

vi.mock("@/lib/nex/notifications/registry", () => ({
  getNotifications: getNotificationsMock,
}));

// Import under test AFTER mocks are registered.
import { dispatchPushNotification } from "../notification-dispatch-service";

const RECIPIENT = "acct-recipient-00000000";
const CONV_VAULTED = "conv-vaulted-00000000";
const CONV_OPEN = "conv-open-00000000";

const SUB_ONE = {
  id: "sub-1",
  account_id: RECIPIENT,
  endpoint: "https://push.example/one",
  p256dh: "p1",
  auth: "a1",
  user_agent: null,
  created_at: "2026-01-01T00:00:00Z",
  last_seen_at: "2026-01-01T00:00:00Z",
};
const SUB_TWO = {
  ...SUB_ONE,
  id: "sub-2",
  endpoint: "https://push.example/two",
  p256dh: "p2",
  auth: "a2",
};

function allPrefsEnabled() {
  return {
    message_enabled: true,
    call_enabled: true,
    reaction_enabled: true,
    mention_enabled: true,
    marketing_enabled: true,
  };
}

beforeEach(() => {
  getNotificationPrefsMock.mockReset();
  listPushSubscriptionsMock.mockReset();
  prunePushSubscriptionMock.mockReset();
  listVaultedConversationIdsMock.mockReset();
  adapterSendMock.mockReset();
  getNotificationsMock.mockReset();
  getNotificationsMock.mockReturnValue({ send: adapterSendMock });
});

afterEach(() => vi.clearAllMocks());

// ─── Fail-closed guarantees ────────────────────────────────────────────

describe("dispatchPushNotification · preference gate", () => {
  it("returns skipped=disabled when the recipient has the category OFF", async () => {
    getNotificationPrefsMock.mockResolvedValue({
      ...allPrefsEnabled(),
      message_enabled: false,
    });

    const result = await dispatchPushNotification(RECIPIENT, "message", {
      kind: "conversation",
      conversationId: CONV_OPEN,
      title: "Alice",
      body: "Sent you a message",
    });

    expect(result).toEqual({
      attempted: 0,
      delivered: 0,
      failed: 0,
      pruned: 0,
      skipped_reason: "disabled",
    });
    expect(listPushSubscriptionsMock).not.toHaveBeenCalled();
    expect(adapterSendMock).not.toHaveBeenCalled();
  });

  it("returns skipped=prefs_unavailable when the prefs service throws (fail-closed)", async () => {
    getNotificationPrefsMock.mockRejectedValue(new Error("db unreachable"));

    const result = await dispatchPushNotification(RECIPIENT, "message", {
      kind: "system",
      title: "NEX",
      body: "You have a Vault message",
    });

    expect(result.skipped_reason).toBe("prefs_unavailable");
    expect(result.attempted).toBe(0);
    expect(adapterSendMock).not.toHaveBeenCalled();
  });
});

describe("dispatchPushNotification · Vault boundary", () => {
  it("REJECTS a conversation payload when the conversation is in the recipient's vault", async () => {
    getNotificationPrefsMock.mockResolvedValue(allPrefsEnabled());
    listVaultedConversationIdsMock.mockResolvedValue(new Set([CONV_VAULTED]));

    const result = await dispatchPushNotification(RECIPIENT, "message", {
      kind: "conversation",
      conversationId: CONV_VAULTED,
      title: "Alice",
      body: "Sent you a message",
    });

    expect(result.skipped_reason).toBe("vault_rejected");
    expect(result.attempted).toBe(0);
    expect(listPushSubscriptionsMock).not.toHaveBeenCalled();
    expect(adapterSendMock).not.toHaveBeenCalled();
  });

  it("FAILS CLOSED when the vault check itself throws", async () => {
    getNotificationPrefsMock.mockResolvedValue(allPrefsEnabled());
    listVaultedConversationIdsMock.mockRejectedValue(new Error("supabase down"));

    const result = await dispatchPushNotification(RECIPIENT, "message", {
      kind: "conversation",
      conversationId: CONV_OPEN,
      title: "Alice",
      body: "Sent you a message",
    });

    expect(result.skipped_reason).toBe("vault_check_failed");
    expect(result.attempted).toBe(0);
    expect(adapterSendMock).not.toHaveBeenCalled();
  });

  it("BYPASSES the vault check for `kind: system` payloads (type-system guarantees no conversationId)", async () => {
    getNotificationPrefsMock.mockResolvedValue(allPrefsEnabled());
    listPushSubscriptionsMock.mockResolvedValue([SUB_ONE]);
    adapterSendMock.mockResolvedValue({ ok: true });

    const result = await dispatchPushNotification(RECIPIENT, "message", {
      kind: "system",
      title: "NEX",
      body: "You have a Vault message",
    });

    expect(result.delivered).toBe(1);
    expect(listVaultedConversationIdsMock).not.toHaveBeenCalled();
  });

  it("proceeds past the Vault check when the conversation is NOT vaulted", async () => {
    getNotificationPrefsMock.mockResolvedValue(allPrefsEnabled());
    listVaultedConversationIdsMock.mockResolvedValue(new Set([CONV_VAULTED]));
    listPushSubscriptionsMock.mockResolvedValue([SUB_ONE]);
    adapterSendMock.mockResolvedValue({ ok: true });

    const result = await dispatchPushNotification(RECIPIENT, "message", {
      kind: "conversation",
      conversationId: CONV_OPEN,
      title: "Alice",
      body: "Sent you a message",
    });

    expect(result.delivered).toBe(1);
    expect(result.skipped_reason).toBeUndefined();
  });
});

// ─── Subscription store ────────────────────────────────────────────────

describe("dispatchPushNotification · subscription store", () => {
  it("reports skipped=no_subscriptions when the recipient has none", async () => {
    getNotificationPrefsMock.mockResolvedValue(allPrefsEnabled());
    listPushSubscriptionsMock.mockResolvedValue([]);

    const result = await dispatchPushNotification(RECIPIENT, "message", {
      kind: "system",
      title: "NEX",
      body: "hello",
    });

    expect(result.skipped_reason).toBe("no_subscriptions");
    expect(result.attempted).toBe(0);
  });

  it("fails closed when the subscription store throws", async () => {
    getNotificationPrefsMock.mockResolvedValue(allPrefsEnabled());
    listPushSubscriptionsMock.mockRejectedValue(new Error("db unreachable"));

    const result = await dispatchPushNotification(RECIPIENT, "message", {
      kind: "system",
      title: "NEX",
      body: "hello",
    });

    expect(result.skipped_reason).toBe("prefs_unavailable");
    expect(result.attempted).toBe(0);
  });
});

// ─── Fan-out, delivery accounting, pruning ─────────────────────────────

describe("dispatchPushNotification · fan-out + delivery accounting", () => {
  it("delivers to every subscription when the adapter returns ok", async () => {
    getNotificationPrefsMock.mockResolvedValue(allPrefsEnabled());
    listPushSubscriptionsMock.mockResolvedValue([SUB_ONE, SUB_TWO]);
    adapterSendMock.mockResolvedValue({ ok: true });

    const result = await dispatchPushNotification(RECIPIENT, "message", {
      kind: "system",
      title: "NEX",
      body: "hello",
    });

    expect(result).toEqual({
      attempted: 2,
      delivered: 2,
      failed: 0,
      pruned: 0,
    });
    expect(adapterSendMock).toHaveBeenCalledTimes(2);
    // Each dispatch wraps the subscription in message.data.subscription
    const firstCall = adapterSendMock.mock.calls[0][0];
    expect(firstCall.channel).toBe("push");
    expect(firstCall.data.subscription.endpoint).toBe(SUB_ONE.endpoint);
    expect(firstCall.subject).toBe("NEX");
    expect(firstCall.body).toBe("hello");
    expect(firstCall.kind).toBe("transactional");
  });

  it("flags marketing category as kind=marketing on the adapter message", async () => {
    getNotificationPrefsMock.mockResolvedValue(allPrefsEnabled());
    listPushSubscriptionsMock.mockResolvedValue([SUB_ONE]);
    adapterSendMock.mockResolvedValue({ ok: true });

    await dispatchPushNotification(RECIPIENT, "marketing", {
      kind: "system",
      title: "NEX",
      body: "promo",
    });

    expect(adapterSendMock.mock.calls[0][0].kind).toBe("marketing");
  });

  it("prunes a dead endpoint when the adapter returns a 410 reason", async () => {
    getNotificationPrefsMock.mockResolvedValue(allPrefsEnabled());
    listPushSubscriptionsMock.mockResolvedValue([SUB_ONE, SUB_TWO]);
    adapterSendMock.mockImplementation(async (msg) => {
      const sub = (msg.data as { subscription: { endpoint: string } }).subscription;
      if (sub.endpoint === SUB_ONE.endpoint) return { ok: true };
      return {
        ok: false,
        reason: "push endpoint returned 410: subscription gone",
      };
    });
    prunePushSubscriptionMock.mockResolvedValue(undefined);

    const result = await dispatchPushNotification(RECIPIENT, "message", {
      kind: "system",
      title: "NEX",
      body: "hello",
    });

    expect(result.delivered).toBe(1);
    expect(result.pruned).toBe(1);
    expect(result.failed).toBe(0);
    expect(prunePushSubscriptionMock).toHaveBeenCalledWith(SUB_TWO.endpoint);
  });

  it("counts a 500 as failed (not pruned) · retryable server error", async () => {
    getNotificationPrefsMock.mockResolvedValue(allPrefsEnabled());
    listPushSubscriptionsMock.mockResolvedValue([SUB_ONE]);
    adapterSendMock.mockResolvedValue({
      ok: false,
      reason: "push endpoint returned 500: internal error",
    });

    const result = await dispatchPushNotification(RECIPIENT, "message", {
      kind: "system",
      title: "NEX",
      body: "hello",
    });

    expect(result.failed).toBe(1);
    expect(result.pruned).toBe(0);
    expect(prunePushSubscriptionMock).not.toHaveBeenCalled();
  });

  it("counts an adapter throw as failed (no prune)", async () => {
    getNotificationPrefsMock.mockResolvedValue(allPrefsEnabled());
    listPushSubscriptionsMock.mockResolvedValue([SUB_ONE]);
    adapterSendMock.mockRejectedValue(new Error("network blew up"));

    const result = await dispatchPushNotification(RECIPIENT, "message", {
      kind: "system",
      title: "NEX",
      body: "hello",
    });

    expect(result.failed).toBe(1);
    expect(result.delivered).toBe(0);
  });

  it("falls back to failed when the prune itself throws", async () => {
    getNotificationPrefsMock.mockResolvedValue(allPrefsEnabled());
    listPushSubscriptionsMock.mockResolvedValue([SUB_ONE]);
    adapterSendMock.mockResolvedValue({
      ok: false,
      reason: "push endpoint returned 404: not found",
    });
    prunePushSubscriptionMock.mockRejectedValue(new Error("db write failed"));

    const result = await dispatchPushNotification(RECIPIENT, "message", {
      kind: "system",
      title: "NEX",
      body: "hello",
    });

    expect(result.pruned).toBe(0);
    expect(result.failed).toBe(1);
  });
});
