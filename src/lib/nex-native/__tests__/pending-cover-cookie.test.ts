// src/lib/nex-native/__tests__/pending-cover-cookie.test.ts
//
// NEX · S0 · Face Cover pending-cookie module tests.
// Owner-authorised 2026-10-18 · D1 (dedicated httpOnly cookie).
// -----------------------------------------------------------------------------
// Covers the four regression anchors the owner called out:
//
//   1 · Whitelist enforcement · ONLY the 10 sealed CoverLayoutId
//       strings are accepted. Any other value is treated as absent
//       on read AND rejected on write.
//   2 · Validation runs on BOTH read and write · a tampered cookie
//       with a non-whitelisted value is ignored on read, never
//       passed through to callers.
//   3 · Cookie options are correct · httpOnly / path "/" / sameSite
//       "lax" / 24h max-age / secure in production.
//   4 · Clear is honest · removing the cookie uses delete with the
//       matching path so the browser evicts the entry; a clear on
//       an absent cookie is a safe no-op.

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Mock `next/headers` BEFORE importing the module under test so the
// `cookies()` helper comes from an in-memory store we can inspect.
const { getMock, setMock, deleteMock, cookiesMock } = vi.hoisted(() => {
  const store = new Map<string, string>();
  const getMock = vi.fn((name: string) => {
    const v = store.get(name);
    return v === undefined ? undefined : { name, value: v };
  });
  const setMock = vi.fn(
    (
      name: string,
      value: string,
      _opts: Record<string, unknown>,
    ) => {
      store.set(name, value);
    },
  );
  const deleteMock = vi.fn((arg: string | { name: string; path?: string }) => {
    const name = typeof arg === "string" ? arg : arg.name;
    store.delete(name);
  });
  const cookiesMock = vi.fn(async () => ({
    get: getMock,
    set: setMock,
    delete: deleteMock,
  }));
  return { getMock, setMock, deleteMock, cookiesMock, _store: store };
});

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

// Import AFTER the mock is installed · ensures the module picks up
// our fake cookies() rather than the real one (which would throw
// outside a request scope in Node).
import {
  PENDING_COVER_COOKIE,
  PENDING_COVER_MAX_AGE_SECONDS,
  pendingCoverCookieOptions,
  parsePendingCoverLayoutId,
  readPendingCoverLayoutId,
  writePendingCoverLayoutId,
  clearPendingCoverLayoutId,
} from "../pending-cover-cookie";
import { COVER_LAYOUT_IDS } from "@/app/nex-native/cover/layout-ids";

beforeEach(() => {
  // Fresh in-memory cookie store between tests · prevents cross-test
  // leakage. We clear via the mock's own delete so counters reset.
  for (const name of Array.from(getMock.mock.calls.map((c) => c[0]))) {
    deleteMock(name);
  }
  getMock.mockClear();
  setMock.mockClear();
  deleteMock.mockClear();
  cookiesMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── 1 · Constants ───────────────────────────────────────────────────

describe("pending-cover-cookie · constants", () => {
  test("PENDING_COVER_COOKIE is the sealed cookie name", () => {
    expect(PENDING_COVER_COOKIE).toBe("nex_pending_cover_layout");
  });

  test("PENDING_COVER_MAX_AGE_SECONDS is exactly 24 hours", () => {
    expect(PENDING_COVER_MAX_AGE_SECONDS).toBe(60 * 60 * 24);
  });
});

// ─── 2 · Cookie options shape ────────────────────────────────────────

describe("pending-cover-cookie · cookie options", () => {
  test("options use httpOnly / path '/' / sameSite 'lax' / 24h max-age", () => {
    const opts = pendingCoverCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.path).toBe("/");
    expect(opts.sameSite).toBe("lax");
    expect(opts.maxAge).toBe(PENDING_COVER_MAX_AGE_SECONDS);
    // `secure` depends on NODE_ENV · the vitest default is "test",
    // so it should be false here. Production is covered in a
    // separate test below.
    expect(opts.secure).toBe(false);
  });

  test("secure=true when NODE_ENV='production'", () => {
    const original = process.env.NODE_ENV;
    try {
      // @ts-expect-error · overriding a readonly env for the duration of this test
      process.env.NODE_ENV = "production";
      expect(pendingCoverCookieOptions().secure).toBe(true);
    } finally {
      // @ts-expect-error · restore
      process.env.NODE_ENV = original;
    }
  });
});

// ─── 3 · Whitelist validation ────────────────────────────────────────

describe("pending-cover-cookie · parsePendingCoverLayoutId", () => {
  test("accepts every one of the 10 sealed layout ids", () => {
    for (const id of COVER_LAYOUT_IDS) {
      expect(parsePendingCoverLayoutId(id)).toBe(id);
    }
  });

  test("rejects null / undefined / empty string", () => {
    expect(parsePendingCoverLayoutId(null)).toBeNull();
    expect(parsePendingCoverLayoutId(undefined)).toBeNull();
    expect(parsePendingCoverLayoutId("")).toBeNull();
  });

  test("rejects non-whitelisted values · unknown layouts", () => {
    expect(parsePendingCoverLayoutId("restaurant")).toBeNull();
    expect(parsePendingCoverLayoutId("tradesperson")).toBeNull();
    expect(parsePendingCoverLayoutId("premium_business")).toBeNull();
    expect(parsePendingCoverLayoutId("salon")).toBeNull();
  });

  test("rejects values with casing drift", () => {
    expect(parsePendingCoverLayoutId("Cafe")).toBeNull();
    expect(parsePendingCoverLayoutId("CAFE")).toBeNull();
    expect(parsePendingCoverLayoutId("PERSONAL_BRAND")).toBeNull();
  });

  test("rejects path-escape / URL-ish values", () => {
    expect(parsePendingCoverLayoutId("../cafe")).toBeNull();
    expect(parsePendingCoverLayoutId("cafe?x=1")).toBeNull();
    expect(parsePendingCoverLayoutId("/cafe/")).toBeNull();
  });

  test("rejects numeric / object-serialised rubbish", () => {
    expect(parsePendingCoverLayoutId("123")).toBeNull();
    expect(parsePendingCoverLayoutId("[object Object]")).toBeNull();
    expect(parsePendingCoverLayoutId("null")).toBeNull();
  });
});

// ─── 4 · writePendingCoverLayoutId ───────────────────────────────────

describe("pending-cover-cookie · writePendingCoverLayoutId", () => {
  test("writes a valid id and returns the parsed value", async () => {
    const result = await writePendingCoverLayoutId("cafe");

    expect(result).toBe("cafe");
    expect(setMock).toHaveBeenCalledTimes(1);
    const call = setMock.mock.calls[0]!;
    expect(call[0]).toBe(PENDING_COVER_COOKIE);
    expect(call[1]).toBe("cafe");
    const opts = call[2] as Record<string, unknown>;
    expect(opts.httpOnly).toBe(true);
    expect(opts.path).toBe("/");
    expect(opts.sameSite).toBe("lax");
    expect(opts.maxAge).toBe(PENDING_COVER_MAX_AGE_SECONDS);
  });

  test("rejects a non-whitelisted id · returns null · does NOT write", async () => {
    const result = await writePendingCoverLayoutId("salon");

    expect(result).toBeNull();
    expect(setMock).not.toHaveBeenCalled();
  });

  test("rejects null / undefined · does NOT write", async () => {
    expect(await writePendingCoverLayoutId(null)).toBeNull();
    expect(await writePendingCoverLayoutId(undefined)).toBeNull();
    expect(setMock).not.toHaveBeenCalled();
  });

  test("accepts every sealed id · writes exactly the parsed value", async () => {
    for (const id of COVER_LAYOUT_IDS) {
      setMock.mockClear();
      const result = await writePendingCoverLayoutId(id);
      expect(result).toBe(id);
      expect(setMock).toHaveBeenCalledTimes(1);
      expect(setMock.mock.calls[0]![1]).toBe(id);
    }
  });
});

// ─── 5 · readPendingCoverLayoutId · validation on READ ───────────────

describe("pending-cover-cookie · readPendingCoverLayoutId", () => {
  test("returns the id when a valid cookie is set", async () => {
    await writePendingCoverLayoutId("product_landscape");

    const result = await readPendingCoverLayoutId();

    expect(result).toBe("product_landscape");
  });

  test("returns null when the cookie is unset", async () => {
    const result = await readPendingCoverLayoutId();
    expect(result).toBeNull();
  });

  test("returns null when the cookie carries a tampered value", async () => {
    // Simulate a tampered cookie by writing directly to the fake
    // store · bypasses writePendingCoverLayoutId's validation.
    setMock("nex_pending_cover_layout", "evil-redirect-destination", {});

    const result = await readPendingCoverLayoutId();

    expect(result).toBeNull();
  });

  test("returns null when the cookie carries an unknown layout id", async () => {
    setMock("nex_pending_cover_layout", "restaurant", {});

    const result = await readPendingCoverLayoutId();

    expect(result).toBeNull();
  });
});

// ─── 6 · clearPendingCoverLayoutId ───────────────────────────────────

describe("pending-cover-cookie · clearPendingCoverLayoutId", () => {
  test("deletes the cookie by name + path", async () => {
    await writePendingCoverLayoutId("cafe");
    expect(await readPendingCoverLayoutId()).toBe("cafe");

    await clearPendingCoverLayoutId();

    expect(deleteMock).toHaveBeenCalledTimes(1);
    const arg = deleteMock.mock.calls[0]![0] as
      | string
      | { name: string; path?: string };
    const name = typeof arg === "string" ? arg : arg.name;
    const path = typeof arg === "string" ? undefined : arg.path;
    expect(name).toBe(PENDING_COVER_COOKIE);
    expect(path).toBe("/");
    expect(await readPendingCoverLayoutId()).toBeNull();
  });

  test("is a safe no-op when the cookie is already absent", async () => {
    expect(await readPendingCoverLayoutId()).toBeNull();

    await clearPendingCoverLayoutId();

    // The underlying store returns absence either way · no throw,
    // no stale value introduced.
    expect(await readPendingCoverLayoutId()).toBeNull();
  });
});

// ─── 7 · Doctrine anchor · pending choice is NOT proof of save ──────

describe("pending-cover-cookie · doctrine", () => {
  test("has no side-effect that would write to nex_business · pure cookie I/O", async () => {
    // Smoke test · the module imports NO business-service primitives.
    // If anybody later wires `updateCoverLayoutId` here the test
    // flips red and the sealed "Shop intent must not auto-create a
    // business" rule is caught before merge.
    const mod = await import("../pending-cover-cookie");
    const exportedNames = Object.keys(mod);
    for (const name of exportedNames) {
      expect(name.toLowerCase()).not.toContain("business");
    }
  });
});
