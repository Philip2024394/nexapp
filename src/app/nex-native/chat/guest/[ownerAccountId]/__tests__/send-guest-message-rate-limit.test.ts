// Unit tests · guest-chat follow-up rate-limit behaviour.
//
// Stage 1.1 (2026-10-14) · closes design-contract gap G1 across every
// guest-chat caller. These tests exercise the sendGuestMessageAction
// branch that wraps the sealed community rate-limit primitive.
//
// Scope of these tests:
//   · config entry is present (type-level + runtime)
//   · result enum carries the new `rate_limited` branch
//   · NexCommunityRateLimitError is translated to `{ ok: false,
//     reason: "rate_limited", ... }` with the window + cap surfaced
//     for honest UI copy
//   · non-rate-limit primitive failures fall through (fail-open)
//     until migration 197 applies
//   · behavioural tests (injected primitive) prove the three primary
//     branches of sendGuestMessageAction · added 2026-10-14 following
//     the Stage 1.1 safety review that flagged the previous suite as
//     structural-only (no behaviour under injection)
//
// NOT covered here (deferred):
//   · gap G2 fingerprint re-check · requires extending the action
//     signature with sealed §7A client signals · separate design pass
//   · live adversarial burst test · requires a Postgres schema harness
//     (migration 197 applied to an ephemeral database · still blocked
//     by Docker not being installed on this host)
//   · UI consumer rendering of the `rate_limited` reason in
//     _guest-chat-client.tsx · pending its own PR
//
// Mocking posture:
//   · The behavioural describe block mocks `recordIfAllowed` to inject
//     each failure/success mode. A green test run therefore proves the
//     action's dispatch logic given each primitive outcome · it does
//     NOT prove the primitive itself behaves correctly against a real
//     database and does NOT prove concurrency safety. Treat the green
//     count as "the two branches we wired up behave as asserted when
//     the primitive returns/throws what we injected", nothing more.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `community/types.ts` imports "server-only" (line 14) which refuses
// to load in a vitest context. Same escape hatch the sibling
// community/__tests__/types.test.ts uses · must be declared BEFORE
// the imports it governs.
vi.mock("server-only", () => ({}));

// ─── Hoisted mock bodies for every module boundary the action touches ──
// Pattern mirrors src/lib/nex-native/__tests__/vault-entry-service.test.ts.
// vitest auto-hoists both vi.hoisted and vi.mock so H is defined by the
// time the vi.mock factories execute.
const H = vi.hoisted(() => ({
  recordIfAllowed: vi.fn(),
  resolveSession: vi.fn(),
  getOrCreateConversation: vi.fn(),
  insert: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/nex-native/community/rate-limit", () => ({
  recordIfAllowed: H.recordIfAllowed,
}));

vi.mock("@/lib/nex-native/first-conversation/provisional-session", () => ({
  resolveNexAppOrProvisionalSession: H.resolveSession,
}));

vi.mock("@/lib/nex-native/peer-conversation-service", () => ({
  getOrCreatePeerConversation: H.getOrCreateConversation,
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: (_tableName: string) => ({
      insert: H.insert,
    }),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: H.revalidatePath,
}));

import {
  NEX_COMMUNITY_RATE_LIMITS,
  NexCommunityRateLimitError,
  type NexCommunityRateLimitAction,
} from "@/lib/nex-native/community/types";

// Imported AFTER the vi.mock calls above so its own imports resolve to
// the mocks. The "use server" directive at the top of _actions.ts is a
// Next.js server-components hint · vitest treats it as a no-op string
// expression and the exported function is callable directly.
import { sendGuestMessageAction } from "../_actions";

describe("Stage 1.1 · peer_message_guest · rate-limit config", () => {
  it("is a member of the sealed NexCommunityRateLimitAction union", () => {
    // Type-level check masquerading as a runtime assertion: if the
    // union loses `peer_message_guest` in a future refactor, this
    // assignment errors at compile time.
    const key: NexCommunityRateLimitAction = "peer_message_guest";
    expect(key).toBe("peer_message_guest");
  });

  it("has a config entry at NEX_COMMUNITY_RATE_LIMITS", () => {
    expect(NEX_COMMUNITY_RATE_LIMITS.peer_message_guest).toBeDefined();
  });

  it("configures 10 messages per rolling 60-minute window · starting hypothesis per design contract §4.2", () => {
    expect(NEX_COMMUNITY_RATE_LIMITS.peer_message_guest).toEqual({
      windowMinutes: 60,
      maxPerWindow: 10,
    });
  });

  it("window + cap values are positive integers · guards against a future zero/negative misconfig", () => {
    const cfg = NEX_COMMUNITY_RATE_LIMITS.peer_message_guest;
    expect(Number.isInteger(cfg.windowMinutes)).toBe(true);
    expect(Number.isInteger(cfg.maxPerWindow)).toBe(true);
    expect(cfg.windowMinutes).toBeGreaterThan(0);
    expect(cfg.maxPerWindow).toBeGreaterThan(0);
  });

  it("coexists with every pre-existing action key · exhaustive-matrix guard", () => {
    const expected: readonly NexCommunityRateLimitAction[] = [
      "notice_create",
      "notice_update",
      "notice_confirm",
      "notice_resolve",
      "notice_report",
      "card_create",
      "card_update",
      "card_confirm",
      "card_resolve",
      "card_report",
      "card_photo_upload",
      "business_welcome_publish",
      "business_welcome_retract",
      "peer_message_guest",
    ];
    for (const k of expected) {
      expect(
        NEX_COMMUNITY_RATE_LIMITS[k],
        `missing config for action key: ${k}`,
      ).toBeDefined();
    }
    expect(Object.keys(NEX_COMMUNITY_RATE_LIMITS).sort()).toEqual(
      [...expected].sort(),
    );
  });
});

describe("Stage 1.1 · NexCommunityRateLimitError · translation to SendGuestMessageResult", () => {
  // Pure translation logic · the action maps the sealed error into
  // the result enum with the config surfaced. These tests pin that
  // contract without touching the live DB or the primitive.

  it("constructor stores action + window + cap verbatim", () => {
    const err = new NexCommunityRateLimitError("peer_message_guest", 60, 10);
    expect(err.action).toBe("peer_message_guest");
    expect(err.windowMinutes).toBe(60);
    expect(err.maxPerWindow).toBe(10);
    expect(err.code).toBe("rate_limited");
    expect(err.name).toBe("NexCommunityRateLimitError");
  });

  it("message is honest · action name + numeric limits · no PII · no fingerprint hash leaked", () => {
    const err = new NexCommunityRateLimitError("peer_message_guest", 60, 10);
    expect(err.message).toContain("peer_message_guest");
    expect(err.message).toContain("10");
    expect(err.message).toContain("60");
    expect(err.message).not.toMatch(/fingerprint/i);
    expect(err.message).not.toMatch(/ip|address/i);
    expect(err.message).not.toMatch(/user|email|phone/i);
  });

  it("is distinguishable from a generic Error via instanceof · the action's catch depends on this", () => {
    const err = new NexCommunityRateLimitError("peer_message_guest", 60, 10);
    expect(err instanceof NexCommunityRateLimitError).toBe(true);
    expect(err instanceof Error).toBe(true);
    const notRL: unknown = new Error("some other failure");
    expect(notRL instanceof NexCommunityRateLimitError).toBe(false);
  });
});

describe("Stage 1.1 · guest-chat action · source-shape invariants", () => {
  // The action imports the primitive + translates the sealed error.
  // We assert the source text contains the invariants that the
  // behaviour depends on · catches a regression that silently
  // reverts the fail-open posture or drops the rate_limited branch.
  //
  // Static source test (same pattern as welcome-honesty.test.ts +
  // the universal-header-icons-overlay content tests). These guards
  // DO NOT prove runtime behaviour · the behavioural describe block
  // below is the authority on branch dispatch.

  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");

  const ACTION_PATH = path.resolve(
    __dirname,
    "..",
    "_actions.ts",
  );
  const SOURCE = readFileSync(ACTION_PATH, "utf8");

  it("imports recordIfAllowed from the sealed community primitive", () => {
    expect(SOURCE).toContain(
      'import { recordIfAllowed } from "@/lib/nex-native/community/rate-limit";',
    );
  });

  it("imports NexCommunityRateLimitError for sealed-error translation", () => {
    expect(SOURCE).toContain(
      'import { NexCommunityRateLimitError } from "@/lib/nex-native/community/types";',
    );
  });

  it("calls the primitive on the provisional guestAccount.id with action 'peer_message_guest'", () => {
    expect(SOURCE).toContain(
      'await recordIfAllowed(guestAccount.id, "peer_message_guest");',
    );
  });

  it("rate-limit call sits BEFORE the DB insert · an over-cap sender never writes a nex_peer_message row", () => {
    const rateIdx = SOURCE.indexOf("recordIfAllowed(guestAccount.id");
    const insertIdx = SOURCE.indexOf(
      'from("nex_peer_message").insert',
    );
    expect(rateIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(-1);
    expect(rateIdx).toBeLessThan(insertIdx);
  });

  it("translates NexCommunityRateLimitError into { ok: false, reason: 'rate_limited' } with window + cap surfaced", () => {
    expect(SOURCE).toMatch(/err instanceof NexCommunityRateLimitError/);
    expect(SOURCE).toContain('reason: "rate_limited"');
    expect(SOURCE).toContain("rate_limited_window_minutes:");
    expect(SOURCE).toContain("rate_limited_max_per_window:");
  });

  it("fails open on non-rate-limit errors (preserves current behaviour pre-migration-197)", () => {
    // The catch block must warn-and-fall-through for any error that
    // is NOT a NexCommunityRateLimitError · otherwise the live DB
    // CHECK violation would break guest-chat during the deploy
    // window between code ship and migration apply.
    expect(SOURCE).toContain("console.warn(");
    // Guard against a future refactor that silently reverts to
    // fail-closed by throwing / returning db_error from the catch.
    const catchIdx = SOURCE.indexOf(
      "if (err instanceof NexCommunityRateLimitError)",
    );
    const afterCatch = SOURCE.slice(catchIdx);
    expect(afterCatch).not.toMatch(/return[^;]*reason:\s*"db_error"[^;]*;[^}]*}\s*catch/);
  });

  it("rate-limit branch is honestly scoped · the sealed §7A fingerprint re-check is NOT silently claimed as implemented", () => {
    // Must not import the fingerprint helpers here · G2 is deferred
    // to a separate design pass. If a future PR adds the fingerprint
    // re-check in this file, this test and the companion doctrine
    // notes must both be updated.
    expect(SOURCE).not.toMatch(/verifyProvisionalFingerprint/);
    expect(SOURCE).not.toMatch(/computeProvisionalFingerprint/);
    expect(SOURCE).not.toMatch(/assessRisk\(/);
  });
});

describe("Stage 1.1 · result enum completeness", () => {
  // The SendGuestMessageResult.reason union gained `rate_limited`.
  // This test is a tiny guard that the caller code path handles the
  // new branch · the client-side `_guest-chat-client.tsx` consumer
  // was NOT inspected in Stage 1.1 and may need its own PR to render
  // the honest "try again in N minutes" copy. Flag with the test
  // name so a future consumer-UI PR can find it.
  it("documents that `_guest-chat-client.tsx` UI copy for rate_limited is PENDING a separate consumer PR", () => {
    // No assertion against the client UI · this test exists for
    // discoverability. If a consumer PR lands and renders rate_limited
    // honestly, flip this test to assert that behaviour instead.
    expect(true).toBe(true);
  });
});

describe("Stage 1.1 · guest-chat action · behavioural tests · mocked primitive", () => {
  // These tests prove the ACTION'S DISPATCH LOGIC given each primitive
  // outcome. They inject recordIfAllowed via vi.mock and assert on
  // observable results (return value, whether the DB insert path was
  // called). They do NOT prove the primitive itself behaves correctly
  // against a real database and do NOT prove concurrency safety —
  // those remain open items (see Stage 1.1 safety review §Q4-Q7).

  const GUEST_ID = "11111111-1111-4111-8111-111111111111";
  const OWNER_ID = "22222222-2222-4222-8222-222222222222";
  const CONVERSATION_ROW = {
    id: "33333333-3333-4333-8333-333333333333",
    participant_a_id: GUEST_ID,
    participant_b_id: OWNER_ID,
  };

  beforeEach(() => {
    H.recordIfAllowed.mockReset();
    H.resolveSession.mockReset();
    H.getOrCreateConversation.mockReset();
    H.insert.mockReset();
    H.revalidatePath.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allowed request · proceeds to nex_peer_message.insert and returns { ok: true }", async () => {
    H.resolveSession.mockResolvedValue({
      kind: "provisional",
      account: { id: GUEST_ID },
    });
    H.recordIfAllowed.mockResolvedValue(undefined);
    H.getOrCreateConversation.mockResolvedValue(CONVERSATION_ROW);
    H.insert.mockResolvedValue({ error: null });

    const result = await sendGuestMessageAction(OWNER_ID, "hello");

    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(typeof result.message_id).toBe("string");

    // Primitive called exactly once with the sealed action key on the
    // provisional account id.
    expect(H.recordIfAllowed).toHaveBeenCalledTimes(1);
    expect(H.recordIfAllowed).toHaveBeenCalledWith(
      GUEST_ID,
      "peer_message_guest",
    );

    // DB insert reached · evidence the allowed branch dispatches to
    // the message-send path.
    expect(H.insert).toHaveBeenCalledTimes(1);
    const insertArg = H.insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArg).toMatchObject({
      conversation_id: CONVERSATION_ROW.id,
      sender_account_id: GUEST_ID,
      body: "hello",
      encrypted: false,
    });

    // Ordering · primitive invoked strictly before insert.
    const rateCallOrder = H.recordIfAllowed.mock.invocationCallOrder[0];
    const insertCallOrder = H.insert.mock.invocationCallOrder[0];
    expect(rateCallOrder).toBeDefined();
    expect(insertCallOrder).toBeDefined();
    expect(rateCallOrder!).toBeLessThan(insertCallOrder!);
  });

  it("rate-limit rejection · returns { ok: false, reason: 'rate_limited' } · NO DB write, NO revalidate", async () => {
    H.resolveSession.mockResolvedValue({
      kind: "provisional",
      account: { id: GUEST_ID },
    });
    // Inject the sealed error class · the only error type the action's
    // catch should translate to `rate_limited`.
    H.recordIfAllowed.mockRejectedValueOnce(
      new NexCommunityRateLimitError("peer_message_guest", 60, 10),
    );

    const result = await sendGuestMessageAction(OWNER_ID, "hello");

    expect(result).toEqual({
      ok: false,
      reason: "rate_limited",
      rate_limited_window_minutes: 60,
      rate_limited_max_per_window: 10,
    });

    // Hard proof that no message was written and no cache nudged.
    expect(H.getOrCreateConversation).not.toHaveBeenCalled();
    expect(H.insert).not.toHaveBeenCalled();
    expect(H.revalidatePath).not.toHaveBeenCalled();
  });

  it("non-rate-limit infrastructure error · documented fail-open · message IS inserted (BYPASS of the limit)", async () => {
    // Flagged honestly in the test name: this is the fail-open bypass
    // path that the Stage 1.1 safety review identified as a residual
    // risk after migration 197 applies. The test ASSERTS the current
    // policy (fail-open) exactly so a future policy change (fail-
    // closed) will show up as a failing test and force a review of
    // the sibling comment in _actions.ts.
    H.resolveSession.mockResolvedValue({
      kind: "provisional",
      account: { id: GUEST_ID },
    });
    const infraErr = new Error(
      "community-rate-limit.read · simulated pooler timeout",
    );
    H.recordIfAllowed.mockRejectedValueOnce(infraErr);
    H.getOrCreateConversation.mockResolvedValue(CONVERSATION_ROW);
    H.insert.mockResolvedValue({ error: null });

    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const result = await sendGuestMessageAction(OWNER_ID, "hello");

    // Current policy: non-rate-limit error → fall-through → insert
    // happens. This is the BYPASS the review flagged. A green test
    // here is NOT evidence that the bypass is acceptable; it is
    // evidence that the behaviour matches the documented policy.
    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(H.insert).toHaveBeenCalledTimes(1);

    // Observability check · the fail-open path at least logs a warn
    // containing the primitive-failure phrase so an operator grep can
    // find it. (Metric/alert on this warn is item 8 in review §Q7.)
    expect(warnSpy).toHaveBeenCalled();
    const warnArgs = warnSpy.mock.calls[0];
    expect(String(warnArgs?.[0])).toContain(
      "rate-limit primitive failed",
    );

    warnSpy.mockRestore();
  });

  it("non-provisional session short-circuits · rate-limit primitive NOT called · no DB writes", async () => {
    // Guard against a future refactor that moves the primitive call
    // ahead of the session check · doing so would consume limiter
    // budget on unauthenticated callers.
    H.resolveSession.mockResolvedValue({ kind: "none" });

    const result = await sendGuestMessageAction(OWNER_ID, "hello");

    expect(result).toEqual({ ok: false, reason: "unauthenticated" });
    expect(H.recordIfAllowed).not.toHaveBeenCalled();
    expect(H.getOrCreateConversation).not.toHaveBeenCalled();
    expect(H.insert).not.toHaveBeenCalled();
  });

  it("empty message short-circuits · rate-limit primitive NOT called · no budget consumed on empty submits", async () => {
    // Guard against a future refactor that moves the empty check
    // below the primitive call · doing so would let an attacker
    // exhaust the limiter by submitting whitespace-only strings.
    H.resolveSession.mockResolvedValue({
      kind: "provisional",
      account: { id: GUEST_ID },
    });

    const result = await sendGuestMessageAction(OWNER_ID, "   ");

    expect(result).toEqual({ ok: false, reason: "empty" });
    expect(H.recordIfAllowed).not.toHaveBeenCalled();
    expect(H.getOrCreateConversation).not.toHaveBeenCalled();
    expect(H.insert).not.toHaveBeenCalled();
  });
});
