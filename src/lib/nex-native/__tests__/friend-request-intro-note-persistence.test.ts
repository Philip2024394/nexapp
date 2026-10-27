// src/lib/nex-native/__tests__/friend-request-intro-note-persistence.test.ts
//
// REGRESSION TEST · would fail if any step in the Live Shop-Contacts
// → Contacts invite journey silently dropped the introduction note.
//
// Why this is a dedicated test file:
//   The createInvite path crosses layers (server action → service →
//   DB insert → DB read-back). Each layer could discard intro_note
//   without changing the shape of the overall success path · and
//   the user would see "invite sent" even though their note never
//   reached the recipient.
//
// Guards:
//   1 · the service's INSERT payload MUST include an `intro_note`
//       field (even when null) so a future schema matrix is honest.
//   2 · when a non-empty note is supplied, the inserted row's
//       intro_note MUST match verbatim after service normalisation
//       (trim · cap).
//   3 · the service's RETURNING `*` MUST surface the stored
//       intro_note value back to the caller (so the chip in the
//       sender's outbox + the recipient's inbound card both see
//       the real string).

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { fromMock, lastInsertPayload, setResolver } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyFn = (...a: any[]) => any;
  const state: {
    resolver: () => Promise<unknown>;
    insertPayload: unknown;
  } = {
    resolver: async () => ({ data: null, error: null }),
    insertPayload: null,
  };
  const b: Record<string, AnyFn> = {};
  const bFn = () => b;
  b.select = bFn as AnyFn;
  b.eq = bFn as AnyFn;
  b.order = bFn as AnyFn;
  b.limit = bFn as AnyFn;
  b.maybeSingle = bFn as AnyFn;
  b.single = bFn as AnyFn;
  b.insert = ((payload: unknown) => {
    state.insertPayload = payload;
    return b;
  }) as AnyFn;
  b.then = ((onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
    state.resolver().then(onF, onR)) as AnyFn;
  return {
    fromMock: vi.fn(() => b),
    lastInsertPayload: () => state.insertPayload,
    setResolver: (fn: () => Promise<unknown>) => {
      state.resolver = fn;
    },
  };
});

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: { from: fromMock },
  nexSupabaseProjectRef: () => "mock",
}));

const mockGetAccountByNexHandle = vi.fn();
vi.mock("@/lib/nex-native/account-service", () => ({
  getAccountByNexHandle: mockGetAccountByNexHandle,
}));

const SENDER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const RECIPIENT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const HANDLE = "nex-12345";

const futureIso = () => new Date(Date.now() + 23 * 3600 * 1000).toISOString();

function stubPipeline(insertedIntroNote: string | null): void {
  mockGetAccountByNexHandle.mockResolvedValue({ id: RECIPIENT });
  // The service does: cooldown read (maybeSingle, data=null) THEN
  // insert().select('*').single(). Both go through our builder; we
  // return null first (no prior row) then the full inserted row.
  const queue: Array<() => Promise<unknown>> = [
    async () => ({ data: null, error: null }), // cooldown read
    async () => ({
      data: {
        id: "req-1",
        sender_account_id: SENDER,
        recipient_nex_handle: HANDLE,
        recipient_account_id: RECIPIENT,
        status: "pending",
        created_at: new Date().toISOString(),
        expires_at: futureIso(),
        cooldown_ends_at: null,
        accepted_category: null,
        accepted_at: null,
        cancelled_at: null,
        intro_note: insertedIntroNote,
      },
      error: null,
    }),
  ];
  setResolver(() => {
    const next = queue.shift();
    return next ? next() : Promise.resolve({ data: null, error: null });
  });
}

beforeEach(() => {
  fromMock.mockClear();
  mockGetAccountByNexHandle.mockReset();
});

describe("REGRESSION · intro_note never silently dropped", () => {
  test("GUARD 1 · INSERT payload always includes an intro_note key (null when absent)", async () => {
    stubPipeline(null);
    const { createInvite } = await import("../friend-request-service");
    await createInvite(SENDER, HANDLE);
    const payload = lastInsertPayload() as Record<string, unknown>;
    expect(payload).toHaveProperty("intro_note");
    expect(payload.intro_note).toBeNull();
  });

  test("GUARD 2 · non-empty note trimmed + persisted verbatim in INSERT payload", async () => {
    stubPipeline("Thanks for watching · would love to carry your pieces.");
    const { createInvite } = await import("../friend-request-service");
    await createInvite(
      SENDER,
      HANDLE,
      "   Thanks for watching · would love to carry your pieces.   ",
    );
    const payload = lastInsertPayload() as { intro_note: string };
    expect(payload.intro_note).toBe(
      "Thanks for watching · would love to carry your pieces.",
    );
  });

  test("GUARD 2b · over-280 note sliced BEFORE insert · what's inserted matches what's returned", async () => {
    const over = "x".repeat(500);
    const expectedCapped = over.slice(0, 280);
    stubPipeline(expectedCapped);
    const { createInvite } = await import("../friend-request-service");
    const r = await createInvite(SENDER, HANDLE, over);
    const payload = lastInsertPayload() as { intro_note: string };
    expect(payload.intro_note).toHaveLength(280);
    // And the service returns the stored value back to the caller.
    expect(r.row.intro_note).toHaveLength(280);
    expect(r.row.intro_note).toBe(expectedCapped);
  });

  test("GUARD 3 · returned row's intro_note matches what was inserted (round-trip)", async () => {
    const note = "Hi · let's work together.";
    stubPipeline(note);
    const { createInvite } = await import("../friend-request-service");
    const r = await createInvite(SENDER, HANDLE, note);
    expect(r.row.intro_note).toBe(note);
  });

  test("GUARD 4 · whitespace-only note persists as null · not an empty string", async () => {
    stubPipeline(null);
    const { createInvite } = await import("../friend-request-service");
    await createInvite(SENDER, HANDLE, "   \n\t   ");
    const payload = lastInsertPayload() as { intro_note: unknown };
    expect(payload.intro_note).toBeNull();
    // Explicitly NOT the empty string · the service MUST normalise
    // whitespace-only to null so the DB CHECK boundary stays clean.
    expect(payload.intro_note).not.toBe("");
  });

  test("GUARD 5 · the FriendRequestRow type exposes intro_note so UI readers can see it", async () => {
    // Compile-time guard · if a future refactor removes the field
    // from the type, this file stops compiling. Runtime assert too.
    stubPipeline("roundtrip");
    const { createInvite } = await import("../friend-request-service");
    const r = await createInvite(SENDER, HANDLE, "roundtrip");
    // Accessing `.intro_note` compiles ONLY if the field exists on
    // the readonly type · deletion would surface here.
    const stored: string | null = r.row.intro_note;
    expect(stored).toBe("roundtrip");
  });
});
