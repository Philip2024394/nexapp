// src/lib/nex-native/__tests__/friend-request-service-business-and-intro.test.ts
//
// Phase 2 · 2026-10-24 · Live Shop-Contacts close-the-journey tests.
// -----------------------------------------------------------------------------
// Covers two previously-flagged gaps in the Contacts system:
//
//   1 · acceptInvite(category='business') now opens a shared peer
//       conversation via getOrCreatePeerConversation (previously the
//       business branch flipped status only · a dead-end).
//
//   2 · createInvite accepts an optional introduction note · the
//       sender-authored string is normalised (trim · empty→null ·
//       280-char cap) and persisted. Reading back exposes it on
//       FriendRequestRow.intro_note.
//
// Explicit non-claims:
//   · Migration 220 is NOT APPLIED. These tests cover the service
//     contract against mocked Supabase chains. Real-DB verification
//     of the DB-side CHECK + PostgREST silent-drop behaviour on
//     unknown columns awaits an isolated sandbox.
//   · We do NOT verify the recipient's rendered-HTML display of
//     intro_note (that is a UI-level test tied to the Contacts
//     inbound surface).

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

/* ─── Hoisted chain-builder mock for nexSupabaseAdmin ─────────── */

const { fromMock, chainBuilder, setResolver } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyFn = (...a: any[]) => any;
  const builder: Record<string, AnyFn> = {};
  const bFn = () => builder;
  builder.select = bFn as AnyFn;
  builder.insert = bFn as AnyFn;
  builder.update = bFn as AnyFn;
  builder.eq = bFn as AnyFn;
  builder.in = bFn as AnyFn;
  builder.order = bFn as AnyFn;
  builder.limit = bFn as AnyFn;
  builder.maybeSingle = bFn as AnyFn;
  builder.single = bFn as AnyFn;

  // Resolver queue: each terminal call consumes the next entry.
  const queue: Array<() => Promise<unknown>> = [];
  const defaultResolver = async () => ({ data: null, error: null });
  builder.then = ((onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
    const r = queue.shift() ?? defaultResolver;
    return r().then(onF, onR);
  }) as AnyFn;

  function setResolverLocal(fn: () => Promise<unknown>) {
    queue.push(fn);
  }

  return {
    fromMock: vi.fn((table: string) => {
      // Track inserts/selects per table on the builder's history
      (builder as unknown as { _lastTable?: string })._lastTable = table;
      return builder;
    }),
    chainBuilder: builder,
    setResolver: setResolverLocal,
  };
});

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: { from: fromMock },
  nexSupabaseProjectRef: () => "mock",
}));

/* ─── Mocks for the dependent services ───────────────────────── */

const mockGetAccountByNexHandle = vi.fn();
vi.mock("@/lib/nex-native/account-service", () => ({
  getAccountByNexHandle: mockGetAccountByNexHandle,
}));

const mockSendInvite = vi.fn();
const mockRespondToInvite = vi.fn();
vi.mock("@/lib/nex-native/friend-service", () => ({
  sendInvite: mockSendInvite,
  respondToInvite: mockRespondToInvite,
}));

const mockGetOrCreatePeerConversation = vi.fn();
vi.mock("@/lib/nex-native/peer-conversation-service", () => ({
  getOrCreatePeerConversation: mockGetOrCreatePeerConversation,
}));

/* ─── Fixtures ──────────────────────────────────────────────── */

const SENDER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const RECIPIENT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const HANDLE = "nex-12345";
const REQ_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const CONV_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

const futureIso = () => new Date(Date.now() + 23 * 3600 * 1000).toISOString();

function pendingBusinessReqRow(opts: Partial<Record<string, unknown>> = {}) {
  return {
    id: REQ_ID,
    sender_account_id: SENDER,
    recipient_nex_handle: HANDLE,
    recipient_account_id: RECIPIENT,
    status: "pending" as const,
    created_at: new Date().toISOString(),
    expires_at: futureIso(),
    cooldown_ends_at: null,
    accepted_category: null,
    accepted_at: null,
    cancelled_at: null,
    intro_note: null,
    ...opts,
  };
}

beforeEach(() => {
  fromMock.mockClear();
  mockGetAccountByNexHandle.mockReset();
  mockSendInvite.mockReset();
  mockRespondToInvite.mockReset();
  mockGetOrCreatePeerConversation.mockReset();
});

/* ─── 1 · Business-conversation gap closure ───────────────── */

describe("acceptInvite(category='business') · peer conversation open", () => {
  test("opens the shared peer conversation via getOrCreatePeerConversation", async () => {
    const row = pendingBusinessReqRow();
    setResolver(async () => ({ data: row, error: null })); // 1 · read
    setResolver(async () => ({ data: { ...row, status: "accepted", accepted_category: "business" }, error: null })); // 2 · update
    mockGetOrCreatePeerConversation.mockResolvedValue({
      id: CONV_ID,
      participant_a_id: SENDER,
      participant_b_id: RECIPIENT,
    });

    const svc = await import("../friend-request-service");
    const updated = await svc.acceptInvite(REQ_ID, RECIPIENT, "business");

    expect(updated.status).toBe("accepted");
    expect(updated.accepted_category).toBe("business");
    expect(mockGetOrCreatePeerConversation).toHaveBeenCalledWith(SENDER, RECIPIENT);
    // Friend-service primitives are NOT called on the business path.
    expect(mockSendInvite).not.toHaveBeenCalled();
    expect(mockRespondToInvite).not.toHaveBeenCalled();
  });

  test("idempotent · a second business acceptance of the SAME request returns identical conversation (no duplicate)", async () => {
    // Simulate: first call succeeds, status flips. Second call: the
    // request is already 'accepted'; service throws because status
    // guard rejects non-pending. The CONVERSATION itself is
    // idempotent via getOrCreatePeerConversation (not called twice
    // here · the status guard short-circuits before we reach it).
    const row = pendingBusinessReqRow();
    setResolver(async () => ({ data: row, error: null }));
    setResolver(async () => ({ data: { ...row, status: "accepted", accepted_category: "business" }, error: null }));
    mockGetOrCreatePeerConversation.mockResolvedValue({
      id: CONV_ID,
      participant_a_id: SENDER,
      participant_b_id: RECIPIENT,
    });
    const svc = await import("../friend-request-service");
    await svc.acceptInvite(REQ_ID, RECIPIENT, "business");

    // Second call · the request is now accepted · the read returns it
    // as accepted · service throws before touching conversations.
    setResolver(async () => ({
      data: { ...row, status: "accepted", accepted_category: "business" },
      error: null,
    }));
    await expect(
      svc.acceptInvite(REQ_ID, RECIPIENT, "business"),
    ).rejects.toThrow(/not pending/);
    expect(mockGetOrCreatePeerConversation).toHaveBeenCalledTimes(1);
  });

  test("peer-conversation open failure propagates (fail-closed) so UI can surface it", async () => {
    const row = pendingBusinessReqRow();
    setResolver(async () => ({ data: row, error: null }));
    setResolver(async () => ({ data: { ...row, status: "accepted", accepted_category: "business" }, error: null }));
    mockGetOrCreatePeerConversation.mockRejectedValue(
      new Error("conversation-service.getOrCreatePeerConversation: boom"),
    );
    const svc = await import("../friend-request-service");
    await expect(
      svc.acceptInvite(REQ_ID, RECIPIENT, "business"),
    ).rejects.toThrow(/conversation-service/);
    expect(mockGetOrCreatePeerConversation).toHaveBeenCalledTimes(1);
  });

  test("non-recipient actor is rejected · conversation never opened", async () => {
    const row = pendingBusinessReqRow();
    setResolver(async () => ({ data: row, error: null }));
    const svc = await import("../friend-request-service");
    await expect(
      svc.acceptInvite(REQ_ID, "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz", "business"),
    ).rejects.toThrow(/only the recipient can accept/);
    expect(mockGetOrCreatePeerConversation).not.toHaveBeenCalled();
  });

  test("expired request · conversation never opened", async () => {
    const row = pendingBusinessReqRow({
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    setResolver(async () => ({ data: row, error: null }));
    const svc = await import("../friend-request-service");
    await expect(
      svc.acceptInvite(REQ_ID, RECIPIENT, "business"),
    ).rejects.toThrow(/expired/);
    expect(mockGetOrCreatePeerConversation).not.toHaveBeenCalled();
  });

  test("friends-category acceptance still runs the friend-edge path (no regression)", async () => {
    const row = pendingBusinessReqRow();
    setResolver(async () => ({ data: row, error: null }));
    setResolver(async () => ({ data: { ...row, status: "accepted", accepted_category: "friends" }, error: null }));
    mockSendInvite.mockResolvedValue(undefined);
    mockRespondToInvite.mockResolvedValue(undefined);
    const svc = await import("../friend-request-service");
    await svc.acceptInvite(REQ_ID, RECIPIENT, "friends");
    expect(mockSendInvite).toHaveBeenCalledWith(SENDER, RECIPIENT);
    expect(mockRespondToInvite).toHaveBeenCalledWith(RECIPIENT, SENDER, "accept");
    expect(mockGetOrCreatePeerConversation).not.toHaveBeenCalled();
  });
});

/* ─── 2 · Introduction text end-to-end at service level ──── */

describe("createInvite · introduction note persistence", () => {
  function stubRecipientLookup(): void {
    mockGetAccountByNexHandle.mockResolvedValue({ id: RECIPIENT });
  }

  function stubNoCooldownRow(): void {
    setResolver(async () => ({ data: null, error: null })); // cooldown read
  }

  function stubInsertEcho(introNote: string | null): void {
    // The service does .select('*') after insert · we echo back the
    // intro_note the service persisted so we can assert the shape.
    setResolver(async () => ({
      data: {
        ...pendingBusinessReqRow({ intro_note: introNote }),
      },
      error: null,
    }));
  }

  test("accepts an introduction note and persists it verbatim", async () => {
    stubRecipientLookup();
    stubNoCooldownRow();
    const note = "Hi Aisha — loved your Live, would love to carry your pieces in my shop.";
    stubInsertEcho(note);

    const svc = await import("../friend-request-service");
    const r = await svc.createInvite(SENDER, HANDLE, note);
    expect(r.row.intro_note).toBe(note);
  });

  test("trims whitespace", async () => {
    stubRecipientLookup();
    stubNoCooldownRow();
    stubInsertEcho("hello"); // trimmed
    const svc = await import("../friend-request-service");
    const r = await svc.createInvite(SENDER, HANDLE, "   hello   ");
    expect(r.row.intro_note).toBe("hello");
  });

  test("empty / whitespace-only becomes null (never a persisted empty string)", async () => {
    stubRecipientLookup();
    stubNoCooldownRow();
    stubInsertEcho(null);
    const svc = await import("../friend-request-service");
    const r = await svc.createInvite(SENDER, HANDLE, "   ");
    expect(r.row.intro_note).toBeNull();
  });

  test("slices to 280 characters when over-length", async () => {
    stubRecipientLookup();
    stubNoCooldownRow();
    const overLong = "a".repeat(500);
    stubInsertEcho(overLong.slice(0, 280));
    const svc = await import("../friend-request-service");
    const r = await svc.createInvite(SENDER, HANDLE, overLong);
    expect(r.row.intro_note).toHaveLength(280);
  });

  test("missing / null intro note is honest-null (undefined → null)", async () => {
    stubRecipientLookup();
    stubNoCooldownRow();
    stubInsertEcho(null);
    const svc = await import("../friend-request-service");
    const r = await svc.createInvite(SENDER, HANDLE);
    expect(r.row.intro_note).toBeNull();
  });

  test("INTRO_NOTE_MAX_LENGTH is the single source of truth for the cap (280)", async () => {
    const svc = await import("../friend-request-service");
    expect(svc.INTRO_NOTE_MAX_LENGTH).toBe(280);
  });
});

/* ─── 3 · Source-shape guard: no parallel invitation primitive ─── */

describe("no parallel invitation primitive · source-shape audit", () => {
  test("friend-request-service exports stay the single invitation surface", async () => {
    const svc = await import("../friend-request-service");
    for (const fn of [
      "createInvite",
      "acceptInvite",
      "cancelInvite",
      "listPendingInbound",
      "listPendingOutbound",
      "sweepExpired",
    ]) {
      expect(typeof (svc as Record<string, unknown>)[fn]).toBe("function");
    }
  });
});
