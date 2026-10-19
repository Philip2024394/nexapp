// src/app/nex-native/create-account/pick-cover/__tests__/pick-cover-action.test.ts
//
// NEX · S1 · pick-cover server-action tests.
// Owner-authorised 2026-10-18 · safeguard #5 (test the actual action
// logic, not just helpers).
// -----------------------------------------------------------------------------
// Coverage:
//
//   T1.1 · valid layout id → cookie written · redirect to the next
//          step of the Shop-intent chain
//   T1.2 · tampered layout id → cookie NOT written · redirect back
//          to pick-cover with ?e=invalid
//   T1.3 · missing / empty layout id → cookie NOT written · redirect
//          back to pick-cover with ?e=missing
//   T1.4 · all 10 sealed layout ids round-trip · each writes its own
//          value with the sealed options
//   T1.5 · unauthenticated viewer → redirect to sign-in · cookie NEVER
//          written
//   T1.6 · action NEVER touches any business-service primitive
//          (regression anchor for the sealed "Shop intent must not
//          auto-create a business" rule)

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Hoisted mocks ──────────────────────────────────────────────────

const {
  resolveSessionMock,
  writePendingCoverLayoutIdMock,
  redirectMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  writePendingCoverLayoutIdMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    const err = new Error(`REDIRECT:${url}`);
    (err as unknown as { digest: string }).digest = "NEXT_REDIRECT";
    throw err;
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));

vi.mock("@/lib/nex-native/pending-cover-cookie", () => ({
  writePendingCoverLayoutId: writePendingCoverLayoutIdMock,
}));

// Import under test AFTER mocks are installed.
import { pickCoverAction } from "../_actions";
import { COVER_LAYOUT_IDS } from "@/app/nex-native/cover/layout-ids";

// ─── Fixtures ──────────────────────────────────────────────────────

const BUYER_ID = "11111111-1111-1111-1111-111111111111";

function installHappyPath(): void {
  resolveSessionMock.mockReset();
  writePendingCoverLayoutIdMock.mockReset();
  redirectMock.mockClear();

  resolveSessionMock.mockResolvedValue({
    account: {
      id: BUYER_ID,
      nex_handle: "nex-10001",
      display_name: "Buyer",
      tier: "gratis",
    },
  });
  // Default: validator mirrors S0 · echoes the input unchanged when
  // it's one of the 10 sealed ids, returns null otherwise.
  writePendingCoverLayoutIdMock.mockImplementation(
    async (value: string | null | undefined) => {
      if (typeof value !== "string") return null;
      return (COVER_LAYOUT_IDS as readonly string[]).includes(value)
        ? value
        : null;
    },
  );
}

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

async function runPickCover(fd: FormData): Promise<Error> {
  try {
    await pickCoverAction(fd);
    throw new Error("pickCoverAction did not redirect");
  } catch (e) {
    return e as Error;
  }
}

// ─── Reset mocks between tests ──────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── T1.1 · valid id · redirect to next step ────────────────────────

describe("pickCoverAction · valid selection", () => {
  test("T1.1 · a sealed layout id writes the cookie and redirects to welcome", async () => {
    installHappyPath();

    const err = await runPickCover(makeFormData({ layout_id: "cafe" }));

    expect(writePendingCoverLayoutIdMock).toHaveBeenCalledTimes(1);
    expect(writePendingCoverLayoutIdMock).toHaveBeenCalledWith("cafe");
    expect(err.message).toContain(
      "REDIRECT:/nex-native/create-account/building",
    );
    expect(err.message).not.toContain("?e=");
  });
});

// ─── T1.2 · tampered id · reject + redirect back ────────────────────

describe("pickCoverAction · tampered layout id", () => {
  test("T1.2 · a non-whitelisted id is rejected and redirects back with ?e=invalid", async () => {
    installHappyPath();

    const err = await runPickCover(
      makeFormData({ layout_id: "evil_destination" }),
    );

    // writePendingCoverLayoutId IS called (because it's where
    // validation lives) but returns null · the action must treat
    // that null as "tampered" and redirect to the error state.
    expect(writePendingCoverLayoutIdMock).toHaveBeenCalledTimes(1);
    expect(err.message).toContain(
      "REDIRECT:/nex-native/create-account/pick-cover?e=invalid",
    );
  });

  test("T1.2b · retired layout id (`salon`) is rejected", async () => {
    installHappyPath();

    const err = await runPickCover(makeFormData({ layout_id: "salon" }));

    expect(err.message).toContain("?e=invalid");
  });

  test("T1.2c · path-escape attempt is rejected", async () => {
    installHappyPath();

    const err = await runPickCover(
      makeFormData({ layout_id: "../cafe" }),
    );

    expect(err.message).toContain("?e=invalid");
  });

  test("T1.2d · case-drift is rejected · lowercase whitelist only", async () => {
    installHappyPath();

    const err = await runPickCover(makeFormData({ layout_id: "CAFE" }));

    expect(err.message).toContain("?e=invalid");
  });
});

// ─── T1.3 · missing layout id ───────────────────────────────────────

describe("pickCoverAction · missing layout id", () => {
  test("T1.3 · empty form value redirects back with ?e=missing · no cookie write attempted", async () => {
    installHappyPath();

    const err = await runPickCover(makeFormData({ layout_id: "" }));

    expect(writePendingCoverLayoutIdMock).not.toHaveBeenCalled();
    expect(err.message).toContain(
      "REDIRECT:/nex-native/create-account/pick-cover?e=missing",
    );
  });

  test("T1.3b · absent layout_id key redirects back with ?e=missing", async () => {
    installHappyPath();

    const err = await runPickCover(makeFormData({}));

    expect(writePendingCoverLayoutIdMock).not.toHaveBeenCalled();
    expect(err.message).toContain("?e=missing");
  });

  test("T1.3c · whitespace-only value redirects back with ?e=missing", async () => {
    installHappyPath();

    const err = await runPickCover(makeFormData({ layout_id: "   " }));

    expect(writePendingCoverLayoutIdMock).not.toHaveBeenCalled();
    expect(err.message).toContain("?e=missing");
  });
});

// ─── T1.4 · every sealed id round-trips ─────────────────────────────

describe("pickCoverAction · all 10 sealed layouts round-trip", () => {
  test.each(COVER_LAYOUT_IDS)(
    "T1.4 · %s · cookie written + redirect to next step",
    async (layoutId) => {
      installHappyPath();

      const err = await runPickCover(
        makeFormData({ layout_id: layoutId }),
      );

      expect(writePendingCoverLayoutIdMock).toHaveBeenCalledWith(
        layoutId,
      );
      expect(err.message).toContain(
        "REDIRECT:/nex-native/create-account/building",
      );
    },
  );
});

// ─── T1.5 · unauthenticated viewer ──────────────────────────────────

describe("pickCoverAction · unauthenticated", () => {
  test("T1.5 · null session redirects to sign-in · cookie NEVER written", async () => {
    installHappyPath();
    resolveSessionMock.mockResolvedValueOnce(null);

    const err = await runPickCover(makeFormData({ layout_id: "cafe" }));

    expect(err.message).toContain("REDIRECT:/nex-native/sign-in");
    // The sign-in `next` param follows the sealed convention · bare
    // same-origin paths are passed unencoded (see e.g.
    // _actions.ts:2023 for cart). Assert both the host-relative
    // path and that it starts with /nex-native/.
    expect(err.message).toContain(
      "next=/nex-native/create-account/pick-cover",
    );
    expect(writePendingCoverLayoutIdMock).not.toHaveBeenCalled();
  });
});

// ─── T1.6 · doctrine anchor · no business-service primitive used ────

describe("pickCoverAction · doctrine", () => {
  test("T1.6 · the action module never imports or calls a business-service primitive", async () => {
    // Regression guard · the sealed "Shop intent must not auto-create
    // a business" rule. If anybody later wires `updateCoverLayoutId`
    // or `createBusinessAction` here, this check flips red before
    // merge.
    //
    // Shape of the check: strip comments FIRST, then verify no
    // business-service import or call survives. Plain prose
    // references like "Does NOT write nex_business.cover_layout_id"
    // in doctrine comments must not false-positive · the comments
    // are the honest documentation of what the module avoids.

    const mod = await import("../_actions");
    for (const name of Object.keys(mod)) {
      expect(name.toLowerCase()).not.toContain("business");
    }

    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const srcRaw = await fs.readFile(
      path.resolve(
        process.cwd(),
        "src/app/nex-native/create-account/pick-cover/_actions.ts",
      ),
      "utf8",
    );
    // Strip `// line comments` and `/* block comments */`.
    const srcCode = srcRaw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    // Any import from business-service (either path) is forbidden.
    expect(srcCode).not.toMatch(/from\s+["'][^"']*business-service[^"']*["']/);
    // Any direct call of the two forbidden primitives is forbidden.
    expect(srcCode).not.toMatch(/\bupdateCoverLayoutId\s*\(/);
    expect(srcCode).not.toMatch(/\bcreateBusinessAction\s*\(/);
    // Any Supabase insert/update targeting nex_business is forbidden.
    expect(srcCode).not.toMatch(/\.(from|rpc)\s*\(\s*["']nex_business/);
  });
});
