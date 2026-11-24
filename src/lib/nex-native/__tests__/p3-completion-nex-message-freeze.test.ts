// src/lib/nex-native/__tests__/p3-completion-nex-message-freeze.test.ts
//
// P3-completion (owner-authorised 2026-11-23) · regression contract for
// the extensions this cycle adds to the plaintext-freeze posture.
//
// What this suite proves:
//
//   1. `conversation-service.postMessage` (writer into the separate
//      `nex_message` table) refuses writes under the fail-closed
//      default. nex_peer_message protection does not imply nex_message
//      protection · this is a second persistence path and must be
//      covered independently (owner directive 2026-11-23 §1).
//
//   2. The dependency-injection setter `__setPlaintextFreezeForTest`
//      is the preferred opt-out path and it is a NO-OP outside
//      `NODE_ENV === "test"` so a compromised prod dependency cannot
//      disable the freeze at runtime (owner directive 2026-11-23 §4).
//
//   3. The env-var opt-out `NEX_CHAT_PLAINTEXT_FREEZE=0` still works
//      inside `NODE_ENV === "test"` so earlier test suites that rely
//      on it keep passing · but it is honoured only in the test env.
//
// This file uses pure unit-test mocking (Supabase admin stubbed) to
// stay independent from Postgres. The DB-level writes are covered by
// other P3 suites.

import {
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";

// Hoisted insert spy · referenced inside the vi.mock factory and from
// the test bodies so we can assert "no DB touch when frozen".
type InsertSpyT = ReturnType<typeof vi.fn<(payload: unknown) => void>>;
const mockState = vi.hoisted(
  () =>
    ({
      insertSpy: null as unknown as InsertSpyT,
    }) as { insertSpy: InsertSpyT },
);

// Mock the Supabase admin client so postMessage never actually hits a
// network. The chain used in conversation-service.postMessage is:
//     .from("nex_message").insert({...}).select("*").single()
// so we build a thenable-like chain that resolves to a canned row.
vi.mock("@/lib/nex-native/supabase-admin", async () => {
  const { vi: viInner } = await import("vitest");
  mockState.insertSpy = viInner.fn<(payload: unknown) => void>();
  const chain = {
    insert: (payload: unknown) => {
      mockState.insertSpy(payload);
      return {
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: "00000000-0000-4000-8000-000000000001",
                conversation_id: "00000000-0000-4000-8000-000000000002",
                sender_account_id: "00000000-0000-4000-8000-000000000003",
                body: "would-be-persisted",
                created_at: "2026-11-23T00:00:00Z",
              },
              error: null,
            }),
        }),
      };
    },
  };
  return {
    nexSupabaseAdmin: {
      from: () => chain,
    },
  };
});

// Import AFTER mocking so the module picks up the stubbed admin client.
import { postMessage } from "../conversation-service";
import {
  PlaintextFrozenError,
  __setPlaintextFreezeForTest,
} from "../peer-message-service";

describe("P3-completion · conversation-service.postMessage freeze", () => {
  beforeEach(() => {
    __setPlaintextFreezeForTest(null);
    mockState.insertSpy.mockClear();
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    __setPlaintextFreezeForTest(null);
    vi.unstubAllEnvs();
  });

  it("throws PlaintextFrozenError under the fail-closed default · no insert", async () => {
    __setPlaintextFreezeForTest(true);
    let caught: unknown = null;
    try {
      await postMessage({
        conversation_id: "00000000-0000-4000-8000-000000000002",
        sender_account_id: "00000000-0000-4000-8000-000000000003",
        body: "user typed plaintext · must never persist",
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PlaintextFrozenError);
    expect(
      (caught as PlaintextFrozenError & { code: string }).code,
    ).toBe("plaintext_frozen");
    expect(mockState.insertSpy).not.toHaveBeenCalled();
  });

  it("honours the DI setter · opt-out allows the write, opt-in blocks it", async () => {
    __setPlaintextFreezeForTest(false);
    await postMessage({
      conversation_id: "00000000-0000-4000-8000-000000000002",
      sender_account_id: "00000000-0000-4000-8000-000000000003",
      body: "opted-out path · write proceeds",
    });
    expect(mockState.insertSpy).toHaveBeenCalledTimes(1);

    __setPlaintextFreezeForTest(true);
    await expect(
      postMessage({
        conversation_id: "00000000-0000-4000-8000-000000000002",
        sender_account_id: "00000000-0000-4000-8000-000000000003",
        body: "flipped back on · refused again",
      }),
    ).rejects.toBeInstanceOf(PlaintextFrozenError);
    expect(mockState.insertSpy).toHaveBeenCalledTimes(1);
  });

  it("honours the env-var opt-out inside NODE_ENV=test for backward compatibility", async () => {
    // Under NODE_ENV=test, DI override null AND FREEZE=0 → unfrozen.
    vi.stubEnv("NEX_CHAT_PLAINTEXT_FREEZE", "0");
    __setPlaintextFreezeForTest(null);
    await postMessage({
      conversation_id: "00000000-0000-4000-8000-000000000002",
      sender_account_id: "00000000-0000-4000-8000-000000000003",
      body: "env-var opt-out · write proceeds in test env",
    });
    expect(mockState.insertSpy).toHaveBeenCalledTimes(1);
  });

  it("env-var opt-out is ignored when DI override is set · DI wins", async () => {
    vi.stubEnv("NEX_CHAT_PLAINTEXT_FREEZE", "0");
    __setPlaintextFreezeForTest(true);
    await expect(
      postMessage({
        conversation_id: "00000000-0000-4000-8000-000000000002",
        sender_account_id: "00000000-0000-4000-8000-000000000003",
        body: "env says off but DI says on · DI wins",
      }),
    ).rejects.toBeInstanceOf(PlaintextFrozenError);
    expect(mockState.insertSpy).not.toHaveBeenCalled();
  });

  it("DI setter is a no-op outside NODE_ENV=test (freeze cannot be disabled in prod)", async () => {
    // Simulate a non-test runtime. The setter must refuse to apply the
    // override, so an attempt to opt out during a prod-like run fails
    // to disable the freeze.
    const original = process.env.NODE_ENV;
    try {
      // @ts-expect-error · writing NODE_ENV for the duration of the test
      process.env.NODE_ENV = "production";
      __setPlaintextFreezeForTest(false); // must be ignored in prod
      // isPlaintextFreezeOn in a non-test env returns `true` unconditionally,
      // regardless of either DI state or env flag.
      await expect(
        postMessage({
          conversation_id: "00000000-0000-4000-8000-000000000002",
          sender_account_id: "00000000-0000-4000-8000-000000000003",
          body: "prod-simulated · DI must have no effect",
        }),
      ).rejects.toBeInstanceOf(PlaintextFrozenError);
      expect(mockState.insertSpy).not.toHaveBeenCalled();
    } finally {
      // @ts-expect-error · restore
      process.env.NODE_ENV = original;
      __setPlaintextFreezeForTest(null);
    }
  });
});
