// src/app/nex-native/create-account/pick-theme/__tests__/skip-loop-behaviour.test.ts
//
// R3 behaviour · prove the skip-loop regression stays fixed by
// exercising pick-theme's redirect decision under mocked cookies.
// Owner-authorised Stage 1 behaviour tests · 2026-10-20.
//
// Scope rationale: the existing `skip-redirect.test.ts` pins the
// source-shape (regex over the file). This file adds BEHAVIOUR:
// it imports the actual pick-theme page, feeds it synthetic cookie
// values via mocks, and observes the redirect that fires (or does
// not fire). Together they produce: shape pinned + behaviour
// pinned under mocked backend.
//
// This file does NOT exercise real Supabase, a real browser, or a
// real cookie jar. It proves what the code DOES when given a
// specific input vector · it does NOT prove that a real browser
// visit produces the same cookie vector. End-to-end runtime
// verification remains out of scope until a safe staging target
// exists.

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Hoisted mocks ──────────────────────────────────────────────────

const {
  cookiesMock,
  cookieGetMock,
  cookieDeleteMock,
  redirectMock,
  resolveSessionMock,
  readVerticalIntentMock,
  readVerticalDeclinedMock,
  listLiveWorldsAsBrowserRowsMock,
  getPresetMock,
} = vi.hoisted(() => {
  const cookieGetMock = vi.fn();
  const cookieDeleteMock = vi.fn();
  return {
    cookieGetMock,
    cookieDeleteMock,
    cookiesMock: vi.fn(async () => ({
      get: cookieGetMock,
      delete: cookieDeleteMock,
      set: vi.fn(),
    })),
    redirectMock: vi.fn((url: string) => {
      const err = new Error(`REDIRECT:${url}`);
      (err as unknown as { digest: string }).digest = "NEXT_REDIRECT";
      throw err;
    }),
    resolveSessionMock: vi.fn(),
    readVerticalIntentMock: vi.fn(),
    readVerticalDeclinedMock: vi.fn(),
    listLiveWorldsAsBrowserRowsMock: vi.fn(() => []),
    getPresetMock: vi.fn(() => null),
  };
});

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

// Minimal supabase-admin stub for module graph · pick-theme's
// transitive imports resolve the module without env vars. The
// test never actually hits the DB.
vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: vi.fn(() => ({ select: vi.fn(), update: vi.fn(), insert: vi.fn() })),
  },
  nexSupabaseProjectRef: () => "mock",
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));

// Mock the welcome-intent helpers · we control vertical + declined
// cookie reads directly. The sealed `nex_welcome_intent` cookie is
// read via `cookieGetMock` (next/headers) so pick-theme's existing
// read path is preserved.
vi.mock("../../../welcome/_welcome-intent", async (orig) => {
  const actual = (await orig()) as object;
  return {
    ...actual,
    readVerticalIntent: readVerticalIntentMock,
    readVerticalDeclined: readVerticalDeclinedMock,
  };
});

vi.mock("../../../chat-themes-library/_live-worlds-adapter", () => ({
  listLiveWorldsAsBrowserRows: listLiveWorldsAsBrowserRowsMock,
}));

vi.mock("@/lib/nex-native/vertical-presets", async (orig) => {
  const actual = (await orig()) as object;
  return { ...actual, getPreset: getPresetMock };
});

// Import under test AFTER mocks installed.
import PickThemePage from "../page";

// ─── Fixtures ──────────────────────────────────────────────────────

const USER_ID = "11111111-1111-1111-1111-111111111111";

function installSignedInSession(): void {
  resolveSessionMock.mockResolvedValue({
    account: {
      id: USER_ID,
      nex_handle: "nex-10001",
      display_name: "Buyer",
      tier: "gratis",
    },
  });
}

function installIntentCookie(value: string | null): void {
  cookieGetMock.mockImplementation((name: string) =>
    name === "nex_welcome_intent" && value !== null
      ? { value }
      : undefined,
  );
}

async function runPickThemePage(): Promise<Error | null> {
  try {
    await PickThemePage();
    return null;
  } catch (e) {
    return e as Error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── R3 · the four decision cells ───────────────────────────────────

describe("R3 behaviour · pick-theme redirect decision under mocked cookies", () => {
  test("CELL A · intent=shop + no vertical + no declined → redirect TO /business-kind (the business-first journey, unchanged)", async () => {
    installSignedInSession();
    installIntentCookie("shop");
    readVerticalIntentMock.mockResolvedValue(null);
    readVerticalDeclinedMock.mockResolvedValue(false);

    const err = await runPickThemePage();

    expect(err).not.toBeNull();
    expect(err!.message).toContain(
      "REDIRECT:/nex-native/create-account/business-kind",
    );
  });

  test("CELL B · intent=shop + no vertical + DECLINED → does NOT redirect to /business-kind (SKIP-LOOP REGRESSION FIX)", async () => {
    installSignedInSession();
    installIntentCookie("shop");
    readVerticalIntentMock.mockResolvedValue(null);
    readVerticalDeclinedMock.mockResolvedValue(true);

    const err = await runPickThemePage();

    // If a redirect fires, it must NOT be to /business-kind. A
    // null error means the page rendered through without redirect
    // (expected for the skip path). If an error IS thrown, it
    // must not be the business-kind redirect.
    if (err !== null) {
      expect(err.message).not.toContain(
        "REDIRECT:/nex-native/create-account/business-kind",
      );
    }
    // The business-kind redirect was definitely not fired.
    const businessKindCalls = redirectMock.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("/create-account/business-kind"),
    );
    expect(businessKindCalls).toHaveLength(0);
  });

  test("CELL C · intent=shop + vertical PRESENT → does NOT redirect to /business-kind", async () => {
    installSignedInSession();
    installIntentCookie("shop");
    readVerticalIntentMock.mockResolvedValue({
      category: "accommodation",
      subtype: "villa",
    });
    readVerticalDeclinedMock.mockResolvedValue(false);

    await runPickThemePage();

    const businessKindCalls = redirectMock.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("/create-account/business-kind"),
    );
    expect(businessKindCalls).toHaveLength(0);
  });

  test("CELL D · intent≠shop → does NOT redirect to /business-kind regardless of vertical/declined", async () => {
    installSignedInSession();
    installIntentCookie("themes");
    readVerticalIntentMock.mockResolvedValue(null);
    readVerticalDeclinedMock.mockResolvedValue(false);

    await runPickThemePage();

    const businessKindCalls = redirectMock.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("/create-account/business-kind"),
    );
    expect(businessKindCalls).toHaveLength(0);
  });

  test("CELL E · no intent cookie at all → does NOT redirect to /business-kind", async () => {
    installSignedInSession();
    installIntentCookie(null);
    readVerticalIntentMock.mockResolvedValue(null);
    readVerticalDeclinedMock.mockResolvedValue(false);

    await runPickThemePage();

    const businessKindCalls = redirectMock.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("/create-account/business-kind"),
    );
    expect(businessKindCalls).toHaveLength(0);
  });
});

// ─── R3 · session gate still fires first ────────────────────────────

describe("R3 behaviour · session gate is upstream of the vertical gate", () => {
  test("GATE · null session → redirect to /sign-in · never reaches vertical read", async () => {
    resolveSessionMock.mockResolvedValue(null);
    installIntentCookie("shop");
    readVerticalIntentMock.mockResolvedValue(null);
    readVerticalDeclinedMock.mockResolvedValue(false);

    const err = await runPickThemePage();

    expect(err).not.toBeNull();
    expect(err!.message).toContain("REDIRECT:/nex-native/sign-in");
    // The vertical cookie must never be consulted when there's no
    // session · the sign-in redirect is upstream.
    expect(readVerticalIntentMock).not.toHaveBeenCalled();
    expect(readVerticalDeclinedMock).not.toHaveBeenCalled();
  });
});

// ─── R3 · regression anchor · the decline sentinel is the exact fix ─

describe("R3 regression anchor · decline sentinel is load-bearing", () => {
  test("REGRESSION · the ONLY difference between CELL A (redirect) and CELL B (no redirect) is the declined flag", async () => {
    // Run CELL A inputs, record the redirect.
    installSignedInSession();
    installIntentCookie("shop");
    readVerticalIntentMock.mockResolvedValue(null);
    readVerticalDeclinedMock.mockResolvedValue(false);
    const errA = await runPickThemePage();
    expect(errA?.message).toContain(
      "REDIRECT:/nex-native/create-account/business-kind",
    );

    // Reset mocks, flip ONLY the declined flag, re-run.
    vi.clearAllMocks();
    installSignedInSession();
    installIntentCookie("shop");
    readVerticalIntentMock.mockResolvedValue(null);
    readVerticalDeclinedMock.mockResolvedValue(true);
    await runPickThemePage();
    const businessKindCalls = redirectMock.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("/create-account/business-kind"),
    );
    expect(businessKindCalls).toHaveLength(0);
  });
});
