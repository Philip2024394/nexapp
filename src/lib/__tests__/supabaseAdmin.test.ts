// src/lib/__tests__/supabaseAdmin.test.ts
//
// R1 fail-closed test suite · 2026-10-27.
// --------------------------------------------------
// Verifies the throw-at-use Proxy at src/lib/supabaseAdmin.ts
// behaves as documented. See:
//   · src/lib/supabaseAdmin.ts (the shim)
//   · docs/doctrine/nex-legacy-throw-shim-pattern-2026-10-27.md
//
// These tests exist to make the fail-closed invariant regression-safe:
// if anyone later edits the shim to silently return a real client (or
// to swallow the error), these tests fail loudly. That matters because
// the shim's whole purpose is to prevent accidental cross-DB access by
// the 109 legacy callers under src/lib/nex/*.

import { describe, expect, it } from "vitest";
import { supabaseAdmin } from "../supabaseAdmin";

// Guidance-string fragment all throws should include. If the shim's
// doctrine anchor path is ever renamed, update this fragment AND the
// corresponding reference in docs/doctrine/.
const SEALED_GUIDANCE_FRAGMENT = "legacy sibling-product module";
const DOCTRINE_ANCHOR_FRAGMENT = "nex-legacy-throw-shim-pattern-2026-10-27";
const DO_NOT_CROSS_FRAGMENT = "must NOT silently fall through to the NEX-native Supabase client";

describe("src/lib/supabaseAdmin · throw-at-use Proxy", () => {
  it("exports a non-undefined `supabaseAdmin` symbol", () => {
    // Note: typeof is 'object' because the Proxy wraps `{}`.
    expect(supabaseAdmin).toBeDefined();
    expect(typeof supabaseAdmin).toBe("object");
  });

  it("throws on any property access (e.g. .from)", () => {
    expect(() => {
      // Accessing a property on the Proxy fires the `get` trap.
      (supabaseAdmin as unknown as Record<string, unknown>).from;
    }).toThrow();
  });

  it("throws on access via a Supabase-style method chain (.from('x').select())", () => {
    expect(() => {
      // Even starting the chain fires the `get` trap on `.from`.
      (supabaseAdmin as unknown as Record<string, (arg: string) => unknown>).from("test");
    }).toThrow();
  });

  it("throws on access to .auth, .storage, .rpc (every documented SupabaseClient surface)", () => {
    const surfaces = ["auth", "storage", "rpc", "channel", "removeChannel", "functions"];
    for (const surface of surfaces) {
      expect(() => {
        (supabaseAdmin as unknown as Record<string, unknown>)[surface];
      }, `access to supabaseAdmin.${surface} must throw`).toThrow();
    }
  });

  it("thrown error includes the sealed-guidance fragment", () => {
    let captured: unknown = null;
    try {
      (supabaseAdmin as unknown as Record<string, unknown>).from;
    } catch (e) {
      captured = e;
    }
    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).message).toContain(SEALED_GUIDANCE_FRAGMENT);
  });

  it("thrown error includes the doctrine-anchor fragment (so operators can find the doc)", () => {
    let captured: unknown = null;
    try {
      (supabaseAdmin as unknown as Record<string, unknown>).from;
    } catch (e) {
      captured = e;
    }
    expect((captured as Error).message).toContain(DOCTRINE_ANCHOR_FRAGMENT);
  });

  it("thrown error includes the cross-DB separation warning", () => {
    let captured: unknown = null;
    try {
      (supabaseAdmin as unknown as Record<string, unknown>).from;
    } catch (e) {
      captured = e;
    }
    expect((captured as Error).message).toContain(DO_NOT_CROSS_FRAGMENT);
  });

  it("throws CONSISTENTLY · subsequent accesses continue to throw (no silent recovery)", () => {
    // Access property 3 times · each access should throw independently.
    const accessOnce = () => (supabaseAdmin as unknown as Record<string, unknown>).from;
    expect(accessOnce).toThrow();
    expect(accessOnce).toThrow();
    expect(accessOnce).toThrow();
  });

  it("different property names all throw with the same guidance (uniform fail-closed)", () => {
    const captureMessage = (prop: string): string | null => {
      try {
        (supabaseAdmin as unknown as Record<string, unknown>)[prop];
      } catch (e) {
        return e instanceof Error ? e.message : null;
      }
      return null;
    };
    const msgFrom = captureMessage("from");
    const msgRpc = captureMessage("rpc");
    const msgAuth = captureMessage("auth");
    expect(msgFrom).not.toBeNull();
    expect(msgRpc).not.toBeNull();
    expect(msgAuth).not.toBeNull();
    // All three must contain the same sealed guidance.
    expect(msgFrom).toContain(SEALED_GUIDANCE_FRAGMENT);
    expect(msgRpc).toContain(SEALED_GUIDANCE_FRAGMENT);
    expect(msgAuth).toContain(SEALED_GUIDANCE_FRAGMENT);
  });
});
