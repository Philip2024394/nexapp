// src/lib/nex-native/__tests__/security-service-bump-invalidation.test.ts
//
// Regression tests for the password-change mass-invalidation path.
// Owner directive 2026-11-07 · Item 2.
// -----------------------------------------------------------------------------
// Two invariants under test:
//   1. `bumpSessionsInvalidatedAtForOwner(accountId)` writes a fresh ISO
//      timestamp to `nex_account.sessions_invalidated_at` for the given
//      account and returns the same timestamp.
//   2. The session resolver's rejection comparison (now exported as
//      `isJwtInvalidatedByMassInvalidation`) returns TRUE when a JWT's
//      iat precedes the invalidation timestamp · and FALSE otherwise.
//
// Together these prove that a successful password change invalidates
// previously issued sessions (owner's acceptance criterion: "updating
// a timestamp is not enough unless existing sessions are demonstrably
// rejected afterwards").

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Record what the service writes to nex_account so we can assert on it.
const updateCalls: Array<{ table: string; payload: Record<string, unknown>; eqArgs: [string, unknown] | null }> = [];

vi.mock("../supabase-admin", () => {
  function from(table: string) {
    return {
      update(payload: Record<string, unknown>) {
        const entry: {
          table: string;
          payload: Record<string, unknown>;
          eqArgs: [string, unknown] | null;
        } = { table, payload, eqArgs: null };
        updateCalls.push(entry);
        return {
          eq(column: string, value: unknown) {
            entry.eqArgs = [column, value];
            return Promise.resolve({ error: null });
          },
        };
      },
    };
  }
  return { nexSupabaseAdmin: { from } };
});

import { bumpSessionsInvalidatedAtForOwner } from "../security-service";
import {
  extractJwtIssuedAt,
  isJwtInvalidatedByMassInvalidation,
} from "../app/session-invalidation";

/** Build a well-formed JWT with the given iat (seconds since epoch).
 *  Signature + header are intentionally bogus · `extractJwtIssuedAt`
 *  only cares about the payload shape. */
function buildJwtWithIat(iatSec: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iat: iatSec, sub: "test" }))
    .toString("base64url");
  const signature = "AAAA";
  return `${header}.${payload}.${signature}`;
}

describe("bumpSessionsInvalidatedAtForOwner · writes the timestamp (Item 2)", () => {
  beforeEach(() => {
    updateCalls.length = 0;
  });

  it("writes an ISO timestamp to nex_account.sessions_invalidated_at and returns it", async () => {
    const result = await bumpSessionsInvalidatedAtForOwner(
      "00000000-0000-0000-0000-000000000042",
    );

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]!.table).toBe("nex_account");
    expect(updateCalls[0]!.eqArgs).toEqual([
      "id",
      "00000000-0000-0000-0000-000000000042",
    ]);
    const written = updateCalls[0]!.payload.sessions_invalidated_at as string;
    expect(written).toBe(result.invalidated_at);
    // ISO-8601 shape sanity (parseable, not in the future by > 1min).
    const writtenMs = Date.parse(written);
    expect(Number.isFinite(writtenMs)).toBe(true);
    expect(writtenMs).toBeLessThanOrEqual(Date.now() + 1000);
    expect(writtenMs).toBeGreaterThan(Date.now() - 60_000);
  });

  it("surfaces supabase errors instead of silently succeeding", async () => {
    // Override the mock to return an error for this test only.
    const { nexSupabaseAdmin } = (await import("../supabase-admin")) as {
      nexSupabaseAdmin: { from: typeof import("../supabase-admin").nexSupabaseAdmin.from };
    };
    const original = nexSupabaseAdmin.from;
    (nexSupabaseAdmin as unknown as { from: unknown }).from = () => ({
      update() {
        return {
          eq() {
            return Promise.resolve({ error: { message: "simulated-failure" } });
          },
        };
      },
    });
    try {
      await expect(
        bumpSessionsInvalidatedAtForOwner(
          "00000000-0000-0000-0000-000000000099",
        ),
      ).rejects.toThrow(/simulated-failure/);
    } finally {
      (nexSupabaseAdmin as unknown as { from: unknown }).from = original;
    }
  });
});

describe("resolver gate · isJwtInvalidatedByMassInvalidation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects sessions whose JWT iat precedes the invalidation moment", () => {
    // JWT issued at T = 1,700,000,000 seconds (≈ Nov 2023).
    // Invalidation at ISO equivalent of T + 60s.
    const iatSec = 1_700_000_000;
    const invalidatedAtIso = new Date((iatSec + 60) * 1000).toISOString();

    const token = buildJwtWithIat(iatSec);
    expect(isJwtInvalidatedByMassInvalidation(token, invalidatedAtIso)).toBe(
      true,
    );
  });

  it("accepts sessions whose JWT iat is equal to or after the invalidation moment", () => {
    // iat exactly at the invalidation moment (not strictly before) → accept.
    const iatSec = 1_700_000_000;
    const invalidatedAtIso = new Date(iatSec * 1000).toISOString();

    const token = buildJwtWithIat(iatSec);
    expect(isJwtInvalidatedByMassInvalidation(token, invalidatedAtIso)).toBe(
      false,
    );

    // iat strictly after the invalidation moment → accept.
    const laterIat = iatSec + 10;
    const laterToken = buildJwtWithIat(laterIat);
    expect(isJwtInvalidatedByMassInvalidation(laterToken, invalidatedAtIso)).toBe(
      false,
    );
  });

  it("fails open (no rejection) when the invalidation timestamp is null", () => {
    const token = buildJwtWithIat(1_700_000_000);
    expect(isJwtInvalidatedByMassInvalidation(token, null)).toBe(false);
  });

  it("fails open when the JWT iat cannot be extracted (malformed token)", () => {
    const invalidatedAtIso = new Date().toISOString();
    expect(
      isJwtInvalidatedByMassInvalidation("not.a.valid", invalidatedAtIso),
    ).toBe(false);
    expect(isJwtInvalidatedByMassInvalidation("", invalidatedAtIso)).toBe(false);
    expect(
      isJwtInvalidatedByMassInvalidation("one-chunk-only", invalidatedAtIso),
    ).toBe(false);
  });

  it("fails open when the invalidation ISO is unparseable", () => {
    const token = buildJwtWithIat(1_700_000_000);
    expect(isJwtInvalidatedByMassInvalidation(token, "not-a-date")).toBe(false);
  });
});

describe("extractJwtIssuedAt · helper used by the gate above", () => {
  it("extracts the iat claim from a well-formed JWT", () => {
    expect(extractJwtIssuedAt(buildJwtWithIat(1234567890))).toBe(1234567890);
  });

  it("returns null when iat is missing", () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
      .toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "no-iat" }))
      .toString("base64url");
    expect(extractJwtIssuedAt(`${header}.${payload}.AAAA`)).toBeNull();
  });

  it("returns null for malformed tokens", () => {
    expect(extractJwtIssuedAt("")).toBeNull();
    expect(extractJwtIssuedAt("a.b")).toBeNull();
    expect(extractJwtIssuedAt("a.b.c.d")).toBeNull();
    expect(extractJwtIssuedAt("not-base64url.!!!.sig")).toBeNull();
  });
});

describe("end-to-end invariant · bump + gate (Item 2 acceptance)", () => {
  it("a token issued before the bump is rejected by the gate", async () => {
    // Simulate: user holds a session issued at T. Owner triggers a
    // password change, bumpSessionsInvalidatedAtForOwner writes
    // sessions_invalidated_at = NOW() where NOW > T. On the user's
    // next request, the resolver reads the account row with the new
    // timestamp, extracts the JWT iat, compares · and rejects.
    const iatSec = Math.floor(Date.now() / 1000) - 60; // issued 60s ago
    const token = buildJwtWithIat(iatSec);

    const { invalidated_at } = await bumpSessionsInvalidatedAtForOwner(
      "00000000-0000-0000-0000-000000000100",
    );
    expect(isJwtInvalidatedByMassInvalidation(token, invalidated_at)).toBe(true);
  });

  it("a token issued AFTER the bump passes the gate", async () => {
    const { invalidated_at } = await bumpSessionsInvalidatedAtForOwner(
      "00000000-0000-0000-0000-000000000101",
    );
    // Build a token with iat 10 seconds after the bump.
    const bumpSec = Math.floor(Date.parse(invalidated_at) / 1000);
    const token = buildJwtWithIat(bumpSec + 10);
    expect(isJwtInvalidatedByMassInvalidation(token, invalidated_at)).toBe(
      false,
    );
  });
});
