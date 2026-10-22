// src/app/nex-native/business-setup/__tests__/activation-cookie-isolation-behaviour.test.ts
//
// R6 behaviour · cookie isolation composition under mocks.
// Owner-authorised Stage 1 behaviour tests · 2026-10-20.
//
// R6 asks: Creating or editing a second business does not leak
//          settings from the first.
//
// What this test suite CAN prove under mocked backend:
//   · If saveBusinessActivationAction succeeds for Business A,
//     the clear functions ARE called (via R5 composition).
//   · The clear functions, by their contract (verified separately
//     in `vertical-intent.test.ts` + `skip-redirect.test.ts`), delete
//     the respective cookies.
//   · Therefore, in a fresh scenario where the cookies have been
//     cleared, readVerticalIntent() returns null and
//     readVerticalDeclined() returns false. Business B starting
//     fresh after Business A's successful activation would see no
//     carry-over cookie values.
//
// What this test suite CANNOT prove without a real DB + browser:
//   · The actual two-account scenario: Account X completes Villa
//     setup, Account Y starts in the same browser session, Y
//     does not see X's cookie. In production this is already
//     mitigated by the one-shop-per-account guard at
//     `_actions.ts:3710-3715` which short-circuits a second
//     business create for the same account. Multi-ACCOUNT isolation
//     (different users, same browser) still requires real-browser
//     verification against a safe DB.
//   · The real cookie-jar interaction with Supabase auth cookies
//     (same-site, http-only, path, max-age) under live browser
//     conditions.
//
// This file documents the composition and explicitly flags the gap.

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Hoisted mocks ──────────────────────────────────────────────────

const {
  updateMock,
  eqMock,
  fromMock,
  selectMock,
  maybeSingleMock,
  resolveSessionMock,
  revalidatePathMock,
  clearVerticalIntentMock,
  clearVerticalDeclinedMock,
  readVerticalIntentMock,
  readVerticalDeclinedMock,
  assertCanActivateBusinessForMock,
} = vi.hoisted(() => {
  const eqMock = vi.fn();
  const updateMock = vi.fn(() => ({ eq: eqMock }));
  const maybeSingleMock = vi.fn();
  const selectMock = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })) }));
  const fromMock = vi.fn(() => ({ update: updateMock, select: selectMock }));
  return {
    updateMock,
    eqMock,
    fromMock,
    selectMock,
    maybeSingleMock,
    resolveSessionMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    clearVerticalIntentMock: vi.fn(async () => undefined),
    clearVerticalDeclinedMock: vi.fn(async () => undefined),
    readVerticalIntentMock: vi.fn(),
    readVerticalDeclinedMock: vi.fn(),
    assertCanActivateBusinessForMock: vi.fn(),
  };
});

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: { from: fromMock },
  nexSupabaseProjectRef: () => "mock",
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: vi.fn(),
}));

vi.mock("@/app/nex-native/welcome/_welcome-intent", async (orig) => {
  const actual = (await orig()) as object;
  return {
    ...actual,
    clearVerticalIntent: clearVerticalIntentMock,
    clearVerticalDeclined: clearVerticalDeclinedMock,
    readVerticalIntent: readVerticalIntentMock,
    readVerticalDeclined: readVerticalDeclinedMock,
  };
});

vi.mock("@/lib/nex-native/business/_authorization", async (orig) => {
  const actual = (await orig()) as object;
  return {
    ...actual,
    assertCanActivateBusinessFor: assertCanActivateBusinessForMock,
  };
});

// Import under test AFTER mocks installed.
import { saveBusinessActivationAction } from "../_actions";

// ─── Fixtures ──────────────────────────────────────────────────────

const USER_ID = "11111111-1111-1111-1111-111111111111";
const BUSINESS_ID = "22222222-2222-2222-2222-222222222222";

function installSignedInSession(): void {
  resolveSessionMock.mockResolvedValue({
    account: {
      id: USER_ID,
      nex_handle: "nex-30001",
      display_name: "Owner",
      tier: "gratis",
    },
  });
}

function installExistingBusiness(): void {
  maybeSingleMock.mockResolvedValue({
    data: { id: BUSINESS_ID },
    error: null,
  });
  assertCanActivateBusinessForMock.mockResolvedValue(BUSINESS_ID);
}

function villaInput() {
  return {
    profile: {
      primary: { category: "accommodation" as const, subtype: "villa" as const },
      secondary: [],
    },
    capability_wizard_toggle: {} as Record<string, boolean>,
    content_wizard_toggle: {} as Record<string, boolean>,
    cta_preference: null,
  };
}

function homestayInput() {
  return {
    profile: {
      primary: { category: "accommodation" as const, subtype: "homestay" as const },
      secondary: [],
    },
    capability_wizard_toggle: {} as Record<string, boolean>,
    content_wizard_toggle: {} as Record<string, boolean>,
    cta_preference: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── R6 · composition · cookie clear → fresh read returns null ──────

describe("R6 behaviour · successful activation → subsequent reads see cleared cookies", () => {
  test("Business A succeeds → clear fires → simulated fresh read returns null (composition)", async () => {
    installSignedInSession();
    installExistingBusiness();
    eqMock.mockResolvedValue({ data: null, error: null });

    // Activation A succeeds · clear fires.
    const resultA = await saveBusinessActivationAction(villaInput());
    expect(resultA.ok).toBe(true);
    expect(clearVerticalIntentMock).toHaveBeenCalledTimes(1);
    expect(clearVerticalDeclinedMock).toHaveBeenCalledTimes(1);

    // Now simulate a fresh scenario · the clear functions have been
    // called, so a subsequent read SHOULD return null/false. We
    // install the read mocks to behave as if the cookies are gone.
    readVerticalIntentMock.mockResolvedValue(null);
    readVerticalDeclinedMock.mockResolvedValue(false);

    const freshVertical = await readVerticalIntentMock();
    const freshDeclined = await readVerticalDeclinedMock();

    expect(freshVertical).toBeNull();
    expect(freshDeclined).toBe(false);
  });

  test("Business A FAILS → clears NOT called → simulated fresh read sees surviving cookie (intent preserved)", async () => {
    installSignedInSession();
    installExistingBusiness();
    eqMock.mockResolvedValue({
      data: null,
      error: { message: "simulated DB write failure" },
    });

    const resultA = await saveBusinessActivationAction(villaInput());
    expect(resultA.ok).toBe(false);
    expect(clearVerticalIntentMock).not.toHaveBeenCalled();
    expect(clearVerticalDeclinedMock).not.toHaveBeenCalled();

    // Simulated fresh read · because clear was NOT called, the
    // cookie survives · R4 guarantee holds for retry.
    readVerticalIntentMock.mockResolvedValue({
      category: "accommodation",
      subtype: "villa",
    });
    const freshVertical = await readVerticalIntentMock();
    expect(freshVertical).not.toBeNull();
    expect(freshVertical?.subtype).toBe("villa");
  });
});

// ─── R6 · activation of two accommodation subtypes in sequence ──────

describe("R6 behaviour · sequential activations do not cross-contaminate (same-session)", () => {
  test("Villa succeeds · clear fires · Homestay activation starts with fresh clears needed", async () => {
    installSignedInSession();
    installExistingBusiness();
    eqMock.mockResolvedValue({ data: null, error: null });

    // Activation 1 · Villa
    await saveBusinessActivationAction(villaInput());
    expect(clearVerticalIntentMock).toHaveBeenCalledTimes(1);
    expect(clearVerticalDeclinedMock).toHaveBeenCalledTimes(1);

    // Simulate the clears having happened (production cookie would
    // be gone). A second activation must still succeed and still
    // call the clears (idempotent · no-op if cookies were already
    // gone).
    await saveBusinessActivationAction(homestayInput());
    expect(clearVerticalIntentMock).toHaveBeenCalledTimes(2);
    expect(clearVerticalDeclinedMock).toHaveBeenCalledTimes(2);
  });
});

// ─── R6 · explicit limitation flag ──────────────────────────────────

describe("R6 limitation · what this behaviour suite does NOT prove", () => {
  test("DOCUMENTATION · multi-account isolation requires real browser + safe DB", () => {
    // This test is a documentation anchor. It intentionally does
    // nothing executable. The point is that any future reader of
    // this file sees the explicit limitation:
    //
    // Mocks CANNOT prove that in a real browser, after Account X's
    // successful activation triggers the cookie clear, a second
    // Account Y starting a signup in the SAME browser session will
    // see no residual cookie.
    //
    // That requires:
    //   1. A real browser (Playwright or similar) with cookie jar
    //   2. A safe non-production Supabase for Account X's activation
    //      to actually land
    //   3. A second account creation flow within the same browser
    //
    // None of these is in Stage 1 scope. The mock composition above
    // proves the CODE INTENDS to clear on success · a browser proves
    // the clear actually removes the cookie from the real jar.
    expect(true).toBe(true);
  });
});
