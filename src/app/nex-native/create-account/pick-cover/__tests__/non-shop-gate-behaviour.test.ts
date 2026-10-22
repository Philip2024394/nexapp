// src/app/nex-native/create-account/pick-cover/__tests__/non-shop-gate-behaviour.test.ts
//
// R7 behaviour · prove the non-shop intent gate at pick-cover
// fires BEFORE any vertical-cookie read.
// Owner-authorised Stage 1 behaviour tests · 2026-10-20.
//
// This is a behaviour upgrade from the source-shape evidence (which
// only pins the line order of the redirect). Here we actually
// invoke the pick-cover page under mocked cookies and observe
// (a) whether the NON_SHOP_FALLBACK redirect fires, and (b)
// whether readVerticalIntent / readPendingCoverLayoutId are
// consulted before that redirect. If they are, the Phase A1
// vertical pre-select would leak into non-shop flows.
//
// This file does NOT exercise real Supabase, a real browser, or a
// real cookie jar. It proves what the code DOES when given a
// specific input vector · it does NOT prove that a real browser
// visit produces the same cookie vector.

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Hoisted mocks ──────────────────────────────────────────────────

const {
  cookiesMock,
  cookieGetMock,
  redirectMock,
  resolveSessionMock,
  readVerticalIntentMock,
  readPendingCoverLayoutIdMock,
  getPresetMock,
} = vi.hoisted(() => {
  const cookieGetMock = vi.fn();
  return {
    cookieGetMock,
    cookiesMock: vi.fn(async () => ({
      get: cookieGetMock,
      delete: vi.fn(),
      set: vi.fn(),
    })),
    redirectMock: vi.fn((url: string) => {
      const err = new Error(`REDIRECT:${url}`);
      (err as unknown as { digest: string }).digest = "NEXT_REDIRECT";
      throw err;
    }),
    resolveSessionMock: vi.fn(),
    readVerticalIntentMock: vi.fn(),
    readPendingCoverLayoutIdMock: vi.fn(),
    getPresetMock: vi.fn(() => null),
  };
});

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));

vi.mock("../../../welcome/_welcome-intent", async (orig) => {
  const actual = (await orig()) as object;
  return {
    ...actual,
    readVerticalIntent: readVerticalIntentMock,
  };
});

vi.mock("@/lib/nex-native/pending-cover-cookie", () => ({
  readPendingCoverLayoutId: readPendingCoverLayoutIdMock,
}));

vi.mock("@/lib/nex-native/vertical-presets", async (orig) => {
  const actual = (await orig()) as object;
  return { ...actual, getPreset: getPresetMock };
});

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

// Import under test AFTER mocks installed.
import PickCoverPage from "../page";

// ─── Fixtures ──────────────────────────────────────────────────────

const USER_ID = "11111111-1111-1111-1111-111111111111";
const NON_SHOP_FALLBACK = "/nex-native/create-account/welcome";

function installSignedInSession(): void {
  resolveSessionMock.mockResolvedValue({
    account: {
      id: USER_ID,
      nex_handle: "nex-10002",
      display_name: "User",
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

async function runPickCoverPage(): Promise<Error | null> {
  try {
    await PickCoverPage({ searchParams: Promise.resolve({}) });
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

// ─── R7 · non-shop intents exit before vertical-cookie read ─────────

describe("R7 behaviour · non-shop intent gate fires BEFORE vertical-cookie read", () => {
  test("intent=themes → redirect to NON_SHOP_FALLBACK · readVerticalIntent NEVER called", async () => {
    installSignedInSession();
    installIntentCookie("themes");

    const err = await runPickCoverPage();

    expect(err).not.toBeNull();
    expect(err!.message).toContain(`REDIRECT:${NON_SHOP_FALLBACK}`);
    // The critical assertion · vertical cookie must not be
    // consulted when intent is not shop.
    expect(readVerticalIntentMock).not.toHaveBeenCalled();
    expect(readPendingCoverLayoutIdMock).not.toHaveBeenCalled();
  });

  test("intent=personalised → redirect to NON_SHOP_FALLBACK · readVerticalIntent NEVER called", async () => {
    installSignedInSession();
    installIntentCookie("personalised");

    const err = await runPickCoverPage();

    expect(err).not.toBeNull();
    expect(err!.message).toContain(`REDIRECT:${NON_SHOP_FALLBACK}`);
    expect(readVerticalIntentMock).not.toHaveBeenCalled();
    expect(readPendingCoverLayoutIdMock).not.toHaveBeenCalled();
  });

  test("no intent cookie → redirect to NON_SHOP_FALLBACK · readVerticalIntent NEVER called", async () => {
    installSignedInSession();
    installIntentCookie(null);

    const err = await runPickCoverPage();

    expect(err).not.toBeNull();
    expect(err!.message).toContain(`REDIRECT:${NON_SHOP_FALLBACK}`);
    expect(readVerticalIntentMock).not.toHaveBeenCalled();
    expect(readPendingCoverLayoutIdMock).not.toHaveBeenCalled();
  });

  test("intent=bogus-value → treated as non-shop · redirect to NON_SHOP_FALLBACK", async () => {
    installSignedInSession();
    installIntentCookie("bogus-tampered-value");

    const err = await runPickCoverPage();

    expect(err).not.toBeNull();
    expect(err!.message).toContain(`REDIRECT:${NON_SHOP_FALLBACK}`);
    expect(readVerticalIntentMock).not.toHaveBeenCalled();
  });
});

// ─── R7 · shop intent reaches the vertical read (positive control) ──

describe("R7 positive control · shop intent allows vertical-cookie read", () => {
  test("intent=shop → readVerticalIntent IS called (gate did not fire)", async () => {
    installSignedInSession();
    installIntentCookie("shop");
    readVerticalIntentMock.mockResolvedValue(null);
    readPendingCoverLayoutIdMock.mockResolvedValue(null);

    await runPickCoverPage();

    // Shop intent must NOT trigger NON_SHOP_FALLBACK
    const nonShopCalls = redirectMock.mock.calls.filter((c) =>
      typeof c[0] === "string" && c[0] === NON_SHOP_FALLBACK,
    );
    expect(nonShopCalls).toHaveLength(0);
    // And the vertical cookie read SHOULD happen
    expect(readVerticalIntentMock).toHaveBeenCalled();
  });
});

// ─── R7 · session gate upstream of intent gate ──────────────────────

describe("R7 upstream gate · session gate fires before intent gate", () => {
  test("null session → redirect to sign-in · intent cookie NEVER consulted", async () => {
    resolveSessionMock.mockResolvedValue(null);
    installIntentCookie("themes");

    const err = await runPickCoverPage();

    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/REDIRECT:.*\/sign-in/);
    expect(cookieGetMock).not.toHaveBeenCalled();
    expect(readVerticalIntentMock).not.toHaveBeenCalled();
  });
});
