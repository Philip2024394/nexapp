// src/app/nex-native/business-setup/__tests__/activation-cookie-clear-behaviour.test.ts
//
// R4 + R5 behaviour · exercise saveBusinessActivationAction with
// mocked Supabase to prove the cookie-clear logic.
// Owner-authorised Stage 1 behaviour tests · 2026-10-20.
//
// R4 asks: failed persistence must NOT report success or clear the
//          vertical-selection cookie.
// R5 asks: successful persistence clears the relevant cookies;
//          failed persistence preserves them.
//
// Both target the same code path · the clear block inside
// saveBusinessActivationAction's success path. This behaviour
// suite mocks Supabase at the module boundary, calls the action,
// and observes whether clearVerticalIntent / clearVerticalDeclined
// were invoked.
//
// What this suite proves:
//   · When Supabase returns success → both clear functions ARE called
//   · When Supabase returns an error → NEITHER clear function is called
//   · When Supabase succeeds but the clear itself throws → the
//     success response still returns (soft-fail wrap)
//   · The action returns { ok: true } on success, { ok: false } on
//     DB error
//
// What this suite does NOT prove:
//   · That a real cookie in a real browser is actually gone after
//     the action runs (that requires runtime + browser)
//   · That the real `nex_business.profile` row received the write
//     (that requires a safe DB)

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

const BUSINESS_ID = "22222222-2222-2222-2222-222222222222";
const USER_ID = "11111111-1111-1111-1111-111111111111";

function installSignedInSession(): void {
  resolveSessionMock.mockResolvedValue({
    account: {
      id: USER_ID,
      nex_handle: "nex-20001",
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

function validAccommodationInput() {
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── R5 · success path · BOTH clears fire ───────────────────────────

describe("R5 behaviour · successful persistence CLEARS both vertical cookies", () => {
  test("Supabase update returns null error → clearVerticalIntent + clearVerticalDeclined BOTH called", async () => {
    installSignedInSession();
    installExistingBusiness();
    // Supabase atomic update returns success.
    eqMock.mockResolvedValue({ data: null, error: null });

    const result = await saveBusinessActivationAction(validAccommodationInput());

    expect(result.ok).toBe(true);
    // The critical assertion for R5
    expect(clearVerticalIntentMock).toHaveBeenCalledTimes(1);
    expect(clearVerticalDeclinedMock).toHaveBeenCalledTimes(1);
  });

  test("the clear block runs AFTER revalidatePath (lifecycle check)", async () => {
    installSignedInSession();
    installExistingBusiness();
    eqMock.mockResolvedValue({ data: null, error: null });

    await saveBusinessActivationAction(validAccommodationInput());

    // revalidatePath must have been called before the clear
    // (demonstrates we reached the SUCCESS path, not just the clear
    // in isolation).
    expect(revalidatePathMock).toHaveBeenCalled();
    const revalidateCallOrder = revalidatePathMock.mock.invocationCallOrder[0];
    const clearIntentCallOrder = clearVerticalIntentMock.mock.invocationCallOrder[0];
    expect(revalidateCallOrder).toBeLessThan(clearIntentCallOrder);
  });
});

// ─── R4 · failure path · NEITHER clear fires ────────────────────────

describe("R4 behaviour · failed persistence PRESERVES both vertical cookies", () => {
  test("Supabase update returns error → NEITHER clearVerticalIntent nor clearVerticalDeclined is called", async () => {
    installSignedInSession();
    installExistingBusiness();
    // Supabase atomic update returns a DB error.
    eqMock.mockResolvedValue({
      data: null,
      error: { message: "simulated DB write failure" },
    });

    const result = await saveBusinessActivationAction(validAccommodationInput());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error?.code).toBe("db_write_failed");
    }
    // The critical assertion for R4
    expect(clearVerticalIntentMock).not.toHaveBeenCalled();
    expect(clearVerticalDeclinedMock).not.toHaveBeenCalled();
  });

  test("the action returns ok=false and does NOT falsely report success", async () => {
    installSignedInSession();
    installExistingBusiness();
    eqMock.mockResolvedValue({
      data: null,
      error: { message: "simulated DB write failure" },
    });

    const result = await saveBusinessActivationAction(validAccommodationInput());

    expect(result.ok).toBe(false);
  });

  test("Supabase business-row fetch error → NEITHER clear is called", async () => {
    installSignedInSession();
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "simulated fetch failure" },
    });

    const result = await saveBusinessActivationAction(validAccommodationInput());

    expect(result.ok).toBe(false);
    expect(clearVerticalIntentMock).not.toHaveBeenCalled();
    expect(clearVerticalDeclinedMock).not.toHaveBeenCalled();
  });

  test("unauthenticated session → NEITHER clear is called", async () => {
    resolveSessionMock.mockResolvedValue(null);

    const result = await saveBusinessActivationAction(validAccommodationInput());

    expect(result.ok).toBe(false);
    expect(clearVerticalIntentMock).not.toHaveBeenCalled();
    expect(clearVerticalDeclinedMock).not.toHaveBeenCalled();
  });

  test("invalid profile → NEITHER clear is called", async () => {
    installSignedInSession();
    installExistingBusiness();

    const result = await saveBusinessActivationAction({
      ...validAccommodationInput(),
      profile: {
        primary: { category: "food" as const, subtype: "villa" as unknown as never },
        secondary: [],
      },
    });

    expect(result.ok).toBe(false);
    expect(clearVerticalIntentMock).not.toHaveBeenCalled();
    expect(clearVerticalDeclinedMock).not.toHaveBeenCalled();
  });
});

// ─── R4/R5 · soft-fail on cookie-clear itself ───────────────────────

describe("R4/R5 soft-fail · a thrown clear does NOT corrupt the success response", () => {
  test("clearVerticalIntent throws → success response still returns ok=true (soft-fail wrap)", async () => {
    installSignedInSession();
    installExistingBusiness();
    eqMock.mockResolvedValue({ data: null, error: null });
    clearVerticalIntentMock.mockRejectedValueOnce(new Error("cookie delete failed"));

    const result = await saveBusinessActivationAction(validAccommodationInput());

    // DB write succeeded · the cookie-clear hiccup is swallowed
    expect(result.ok).toBe(true);
  });
});

// ─── R4/R5 · Check-C EXTENSION to saveBusinessActivationAction ──────

describe("R4/R5 · Check-C extension · activation path clears are INDEPENDENT (owner-authorised 2026-10-20)", () => {
  test("REGRESSION FIX · clearVerticalIntent throws → clearVerticalDeclined IS STILL ATTEMPTED", async () => {
    // Owner-authorised Check-C extension (2026-10-20):
    //
    // Previously `saveBusinessActivationAction` wrapped BOTH clear
    // calls in a single try/catch · a throw in the first clear
    // left the decline sentinel behind. This asymmetry with
    // `createBusinessAction` (which was Check-C-hardened in the
    // Phase A1 corrective patch) was surfaced by the first
    // version of this behaviour test on 2026-10-20 and
    // explicitly authorised for correction by the owner.
    //
    // The fix mirrors the sealed pattern in createBusinessAction:
    // each clear has its OWN try/catch · one failure soft-fails
    // in isolation and does NOT block the other.
    installSignedInSession();
    installExistingBusiness();
    eqMock.mockResolvedValue({ data: null, error: null });
    clearVerticalIntentMock.mockRejectedValueOnce(new Error("first clear failed"));

    const result = await saveBusinessActivationAction(validAccommodationInput());

    // Success response still returns (per-clear soft-fail preserved)
    expect(result.ok).toBe(true);
    // Both clears were attempted · the first threw, the second
    // ran independently.
    expect(clearVerticalIntentMock).toHaveBeenCalledTimes(1);
    expect(clearVerticalDeclinedMock).toHaveBeenCalledTimes(1);
  });

  test("inverse · clearVerticalDeclined throws → clearVerticalIntent STILL fires (symmetrical independence)", async () => {
    installSignedInSession();
    installExistingBusiness();
    eqMock.mockResolvedValue({ data: null, error: null });
    clearVerticalDeclinedMock.mockRejectedValueOnce(new Error("second clear failed"));

    const result = await saveBusinessActivationAction(validAccommodationInput());

    expect(result.ok).toBe(true);
    expect(clearVerticalIntentMock).toHaveBeenCalledTimes(1);
    expect(clearVerticalDeclinedMock).toHaveBeenCalledTimes(1);
  });

  test("negative control · neither throws → both still called (sequential cleanup intact)", async () => {
    installSignedInSession();
    installExistingBusiness();
    eqMock.mockResolvedValue({ data: null, error: null });

    await saveBusinessActivationAction(validAccommodationInput());

    expect(clearVerticalIntentMock).toHaveBeenCalledTimes(1);
    expect(clearVerticalDeclinedMock).toHaveBeenCalledTimes(1);
  });

  test("both throw · success still returned · each soft-fail logged independently", async () => {
    installSignedInSession();
    installExistingBusiness();
    eqMock.mockResolvedValue({ data: null, error: null });
    clearVerticalIntentMock.mockRejectedValueOnce(new Error("first clear failed"));
    clearVerticalDeclinedMock.mockRejectedValueOnce(new Error("second clear failed"));

    const result = await saveBusinessActivationAction(validAccommodationInput());

    expect(result.ok).toBe(true);
    expect(clearVerticalIntentMock).toHaveBeenCalledTimes(1);
    expect(clearVerticalDeclinedMock).toHaveBeenCalledTimes(1);
  });
});
