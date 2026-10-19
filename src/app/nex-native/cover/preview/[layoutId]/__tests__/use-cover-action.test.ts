// src/app/nex-native/cover/preview/[layoutId]/__tests__/use-cover-action.test.ts
//
// NEX · S8 · useCoverAction tests.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Coverage of the three sealed invariants:
//
//   T8.1 · Validation runs BEFORE any cookie write · tampered id →
//          no pending-cover write · no open-shop set · redirect to
//          the preview-with-error state.
//   T8.2 · Signed-in happy path · valid id → S0 cookie written →
//          S9 open-shop cookie set → redirect to /chat/preview.
//   T8.3 · Guest happy path · valid id → S0 cookie still written
//          (survives signup) · S9 open-shop cookie still set
//          (survives signup) · redirect to sign-in with next=
//          /chat/preview.
//   T8.4 · Missing layout_id field → redirect to the library with
//          ?e=missing · no cookie writes attempted.
//   T8.5 · Doctrine · action module imports NO business-service /
//          nex_business mutator · a pending cover must never be
//          mistaken for an activated business setting.

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const {
  writePendingCoverLayoutIdMock,
  setOpenShopSliderCookieMock,
  resolveSessionOrGuestMock,
  redirectMock,
} = vi.hoisted(() => ({
  writePendingCoverLayoutIdMock: vi.fn(),
  setOpenShopSliderCookieMock: vi.fn(),
  resolveSessionOrGuestMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    const err = new Error(`REDIRECT:${url}`);
    (err as unknown as { digest: string }).digest = "NEXT_REDIRECT";
    throw err;
  }),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/nex-native/pending-cover-cookie", () => ({
  writePendingCoverLayoutId: writePendingCoverLayoutIdMock,
}));
vi.mock("@/lib/nex-native/open-shop-cookie", () => ({
  setOpenShopSliderCookie: setOpenShopSliderCookieMock,
}));
vi.mock("@/lib/nex-native/app/session-or-guest", () => ({
  resolveNexAppSessionOrGuest: resolveSessionOrGuestMock,
}));

import { useCoverAction } from "../_use-cover-action";
import { COVER_LAYOUT_IDS } from "@/app/nex-native/cover/layout-ids";

function makeFd(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

async function run(fd: FormData): Promise<Error> {
  try {
    await useCoverAction(fd);
    throw new Error("useCoverAction did not redirect");
  } catch (e) {
    return e as Error;
  }
}

function installValidWriter(): void {
  writePendingCoverLayoutIdMock.mockImplementation(
    async (v: string | null | undefined) => {
      if (typeof v !== "string") return null;
      return (COVER_LAYOUT_IDS as readonly string[]).includes(v) ? v : null;
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  installValidWriter();
  setOpenShopSliderCookieMock.mockResolvedValue(undefined);
  resolveSessionOrGuestMock.mockResolvedValue({
    kind: "session",
    session: { account: { id: "sess-user-1" } },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── T8.1 · tampered id · fail-closed ───────────────────────────────

describe("useCoverAction · tampered layout id", () => {
  test("T8.1 · unknown id → no cookie writes · redirect to invalid error", async () => {
    const err = await run(makeFd({ layout_id: "evil_destination" }));

    // Validation IS called (that's how we know it's tampered)
    expect(writePendingCoverLayoutIdMock).toHaveBeenCalledTimes(1);
    // But S9 cookie must NOT be set when S0 write returned null.
    expect(setOpenShopSliderCookieMock).not.toHaveBeenCalled();
    expect(err.message).toContain(
      "REDIRECT:/nex-native/cover/preview/evil_destination?e=invalid",
    );
  });

  test("T8.1b · retired layout id ('salon') is rejected · no S9 set", async () => {
    const err = await run(makeFd({ layout_id: "salon" }));
    expect(setOpenShopSliderCookieMock).not.toHaveBeenCalled();
    expect(err.message).toContain("?e=invalid");
  });
});

// ─── T8.2 · signed-in happy path ────────────────────────────────────

describe("useCoverAction · signed-in happy path", () => {
  test("T8.2 · valid id · session · writes S0 then S9 · redirects to /chat/preview", async () => {
    const err = await run(makeFd({ layout_id: "cafe" }));

    expect(writePendingCoverLayoutIdMock).toHaveBeenCalledTimes(1);
    expect(writePendingCoverLayoutIdMock).toHaveBeenCalledWith("cafe");
    expect(setOpenShopSliderCookieMock).toHaveBeenCalledTimes(1);
    expect(err.message).toContain("REDIRECT:/nex-native/chat/preview");
  });

  test("T8.2b · S0 write happens BEFORE S9 set (order matters)", async () => {
    const callOrder: string[] = [];
    writePendingCoverLayoutIdMock.mockImplementationOnce(async (v: string) => {
      callOrder.push("S0");
      return v;
    });
    setOpenShopSliderCookieMock.mockImplementationOnce(async () => {
      callOrder.push("S9");
    });

    await run(makeFd({ layout_id: "cafe" }));

    expect(callOrder).toEqual(["S0", "S9"]);
  });

  test("T8.2c · every sealed layout id round-trips", async () => {
    for (const id of COVER_LAYOUT_IDS) {
      writePendingCoverLayoutIdMock.mockClear();
      setOpenShopSliderCookieMock.mockClear();
      installValidWriter();
      const err = await run(makeFd({ layout_id: id }));
      expect(writePendingCoverLayoutIdMock).toHaveBeenCalledWith(id);
      expect(setOpenShopSliderCookieMock).toHaveBeenCalledTimes(1);
      expect(err.message).toContain("REDIRECT:/nex-native/chat/preview");
    }
  });
});

// ─── T8.3 · guest happy path ────────────────────────────────────────

describe("useCoverAction · guest happy path", () => {
  test("T8.3 · guest · valid id · S0 + S9 both written · redirect to sign-in", async () => {
    resolveSessionOrGuestMock.mockResolvedValueOnce({ kind: "guest" });

    const err = await run(makeFd({ layout_id: "cafe" }));

    // Cookies survive the signup hop · they are set BEFORE the
    // sign-in redirect so the sealed auth flow can resume them.
    expect(writePendingCoverLayoutIdMock).toHaveBeenCalledWith("cafe");
    expect(setOpenShopSliderCookieMock).toHaveBeenCalledTimes(1);
    expect(err.message).toContain("REDIRECT:/nex-native/sign-in");
    expect(err.message).toContain(
      "next=%2Fnex-native%2Fchat%2Fpreview",
    );
  });
});

// ─── T8.4 · missing layout_id ───────────────────────────────────────

describe("useCoverAction · missing layout_id", () => {
  test("T8.4 · empty layout_id → redirect to library with ?e=missing · no writes", async () => {
    const err = await run(makeFd({ layout_id: "" }));

    expect(writePendingCoverLayoutIdMock).not.toHaveBeenCalled();
    expect(setOpenShopSliderCookieMock).not.toHaveBeenCalled();
    expect(err.message).toContain(
      "REDIRECT:/nex-native/cover-themes-library?e=missing",
    );
  });

  test("T8.4b · absent layout_id key → redirect to library with ?e=missing", async () => {
    const err = await run(makeFd({}));

    expect(writePendingCoverLayoutIdMock).not.toHaveBeenCalled();
    expect(setOpenShopSliderCookieMock).not.toHaveBeenCalled();
    expect(err.message).toContain("?e=missing");
  });
});

// ─── T8.5 · doctrine anchor ─────────────────────────────────────────

describe("useCoverAction · doctrine", () => {
  test("T8.5 · action module never imports a business-service mutator · pending cover is NEVER activated as a business setting", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const srcRaw = await fs.readFile(
      path.resolve(
        process.cwd(),
        "src/app/nex-native/cover/preview/[layoutId]/_use-cover-action.ts",
      ),
      "utf8",
    );
    const srcCode = srcRaw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(srcCode).not.toMatch(/from\s+["'][^"']*business-service[^"']*["']/);
    expect(srcCode).not.toMatch(/\bupdateCoverLayoutId\s*\(/);
    expect(srcCode).not.toMatch(/\bcreateBusinessAction\s*\(/);
    expect(srcCode).not.toMatch(/\.(from|rpc)\s*\(\s*["']nex_business/);
  });
});
