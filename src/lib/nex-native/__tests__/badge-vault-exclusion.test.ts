// src/lib/nex-native/__tests__/badge-vault-exclusion.test.ts
//
// Owner directive 2026-10-16 (corrective pass B) · the home-screen
// badge aggregate MUST NOT count unread messages belonging to Vault
// conversations. Vault is a private Business-package surface · its
// activity must not inflate a notification displayed outside the
// protected Vault experience.
//
// Approach · mock the Supabase admin client's chained builder + the
// sealed `listVaultedConversationIds` function, then invoke the
// `countTotalUnreadPeerMessages` service and assert the final count
// query receives only the NON-vaulted conversation ids.
//
// Also covers the corrective-pass A invariant for the service itself ·
// a DB error must THROW (not silently return 0) so the API boundary
// can respond with a non-2xx and the client can preserve its badge.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  nexSupabaseAdminMock,
  listVaultedConversationIdsMock,
} = vi.hoisted(() => ({
  nexSupabaseAdminMock: { from: vi.fn() },
  listVaultedConversationIdsMock: vi.fn(),
}));

vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: nexSupabaseAdminMock,
}));
vi.mock("../vault-entry-service", () => ({
  listVaultedConversationIds: listVaultedConversationIdsMock,
}));
// The service module pulls in many unrelated helpers; stub the ones
// the pathway under test does NOT exercise so vi.mock resolution is
// clean. We only exercise countTotalUnreadPeerMessages here.
vi.mock("../peer-conversation-service", () => ({
  getPeerConversationById: vi.fn(),
  touchPeerConversation: vi.fn(),
}));
vi.mock("../safechat/feature-flag", () => ({
  isSafeChatPhase1LoggingEnabled: () => false,
}));
vi.mock("../safechat/_hook", () => ({
  safechatClassifyAndLog: vi.fn(),
}));

import { countTotalUnreadPeerMessages } from "../peer-message-service";

const VIEWER = "acct-viewer-00000000";
const CONV_OPEN_A = "conv-open-aaaaaaaa";
const CONV_OPEN_B = "conv-open-bbbbbbbb";
const CONV_VAULTED = "conv-vaulted-c";

// Minimal fluent-chain stub that mirrors the Supabase query-builder
// surface the service uses: .from().select().or() for the
// conversations query, and
// .from().select({count}).in().neq().is() for the message count.
function buildMockClient(opts: {
  convsResult: { data?: Array<{ id: string }>; error?: Error | null };
  messagesResult?: { count?: number; error?: Error | null };
}) {
  const messagesChain: {
    _conversationIds: string[] | null;
    select: (...a: unknown[]) => typeof messagesChain;
    in: (col: string, ids: string[]) => typeof messagesChain;
    neq: (...a: unknown[]) => typeof messagesChain;
    is: (...a: unknown[]) => Promise<{ count?: number; error?: Error | null }>;
  } = {
    _conversationIds: null,
    select() {
      return messagesChain;
    },
    in(_col, ids) {
      this._conversationIds = ids;
      return this;
    },
    neq() {
      return this;
    },
    is() {
      return Promise.resolve(opts.messagesResult ?? { count: 0, error: null });
    },
  };

  const convsChain = {
    select() {
      return this;
    },
    or() {
      return Promise.resolve(opts.convsResult);
    },
  };

  nexSupabaseAdminMock.from.mockReset();
  nexSupabaseAdminMock.from.mockImplementation((table: string) => {
    if (table === "nex_peer_conversation") return convsChain;
    if (table === "nex_peer_message") return messagesChain;
    throw new Error(`unexpected table: ${table}`);
  });

  return { messagesChain };
}

beforeEach(() => {
  listVaultedConversationIdsMock.mockReset();
  nexSupabaseAdminMock.from.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("countTotalUnreadPeerMessages · corrective pass B · Vault exclusion", () => {
  it("excludes vaulted conversation ids from the count query", async () => {
    listVaultedConversationIdsMock.mockResolvedValue(
      new Set([CONV_VAULTED]),
    );
    const { messagesChain } = buildMockClient({
      convsResult: {
        data: [{ id: CONV_OPEN_A }, { id: CONV_VAULTED }, { id: CONV_OPEN_B }],
        error: null,
      },
      messagesResult: { count: 3, error: null },
    });

    const total = await countTotalUnreadPeerMessages(VIEWER);

    // The service queried the viewer's vault entries exactly once.
    expect(listVaultedConversationIdsMock).toHaveBeenCalledTimes(1);
    expect(listVaultedConversationIdsMock).toHaveBeenCalledWith(VIEWER);

    // The messages query was passed ONLY the non-vaulted ids. If this
    // ever regresses, a vaulted-conversation unread would be counted
    // in the badge · breaking the owner's doctrine.
    expect(messagesChain._conversationIds).toEqual([CONV_OPEN_A, CONV_OPEN_B]);
    expect(messagesChain._conversationIds).not.toContain(CONV_VAULTED);
    expect(total).toBe(3);
  });

  it("returns 0 when ALL conversations are vaulted (no non-vault ids remain)", async () => {
    listVaultedConversationIdsMock.mockResolvedValue(
      new Set([CONV_OPEN_A, CONV_VAULTED]),
    );
    const { messagesChain } = buildMockClient({
      convsResult: {
        data: [{ id: CONV_OPEN_A }, { id: CONV_VAULTED }],
        error: null,
      },
      // messagesResult shouldn't matter · the service should
      // short-circuit without hitting the count query.
      messagesResult: { count: 42, error: null },
    });

    const total = await countTotalUnreadPeerMessages(VIEWER);

    expect(total).toBe(0);
    // Short-circuit · the count query was never invoked, so no ids
    // ever hit the messages chain.
    expect(messagesChain._conversationIds).toBeNull();
  });

  it("returns 0 when viewer has no conversations · correct genuine zero", async () => {
    listVaultedConversationIdsMock.mockResolvedValue(new Set());
    buildMockClient({
      convsResult: { data: [], error: null },
    });

    const total = await countTotalUnreadPeerMessages(VIEWER);
    expect(total).toBe(0);
    // No conversations · no reason to look up Vault entries either.
    expect(listVaultedConversationIdsMock).not.toHaveBeenCalled();
  });
});

describe("countTotalUnreadPeerMessages · corrective pass A · error propagation", () => {
  it("THROWS when the conversations query fails · does NOT silently return 0", async () => {
    buildMockClient({
      convsResult: { error: new Error("db-outage-1") },
    });
    await expect(countTotalUnreadPeerMessages(VIEWER)).rejects.toThrow(
      /conversations.*db-outage-1/,
    );
  });

  it("THROWS when listVaultedConversationIds fails · caller must preserve badge", async () => {
    listVaultedConversationIdsMock.mockRejectedValue(new Error("vault-db-blip"));
    buildMockClient({
      convsResult: { data: [{ id: CONV_OPEN_A }], error: null },
    });
    await expect(countTotalUnreadPeerMessages(VIEWER)).rejects.toThrow(
      /vault-db-blip/,
    );
  });

  it("THROWS when the message count query fails · does NOT silently return 0", async () => {
    listVaultedConversationIdsMock.mockResolvedValue(new Set());
    buildMockClient({
      convsResult: { data: [{ id: CONV_OPEN_A }], error: null },
      messagesResult: { error: new Error("db-outage-2") },
    });
    await expect(countTotalUnreadPeerMessages(VIEWER)).rejects.toThrow(
      /count.*db-outage-2/,
    );
  });
});
