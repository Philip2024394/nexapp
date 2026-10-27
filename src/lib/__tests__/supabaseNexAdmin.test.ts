// src/lib/__tests__/supabaseNexAdmin.test.ts
//
// R2-D-γ fail-closed test suite · 2026-10-27.
// --------------------------------------------------
// Verifies the throw-at-use Proxy at src/lib/supabaseNexAdmin.ts
// behaves as documented. See:
//   · src/lib/supabaseNexAdmin.ts (the shim)
//   · src/lib/supabaseAdmin.ts (R1 companion shim)
//   · docs/doctrine/nex-legacy-throw-shim-pattern-2026-10-27.md
//
// These tests exist to make the fail-closed invariant regression-safe:
// if anyone later edits the shim to silently re-export the nex-native
// client (or to swallow the error), these tests fail loudly. That
// matters because the whole point of the shim is to preserve the
// sealed cross-DB separation doctrine at
// `src/lib/nex-native/supabase-admin.ts` lines 11-14, which forbids
// silent cross-DB access.

import { describe, expect, it } from "vitest";
import { supabaseNexAdmin } from "../supabaseNexAdmin";

// Guidance-string fragments every throw should include. If any of
// these are ever renamed, update BOTH the shim and this test suite,
// AND the corresponding reference in docs/doctrine/.
const LEGACY_PATH_FRAGMENT = "src/lib/supabaseNexAdmin · legacy import path unavailable";
const REAL_CLIENT_FRAGMENT = "src/lib/nex-native/supabase-admin.ts";
const DOCTRINE_ANCHOR_FRAGMENT = "nex-legacy-throw-shim-pattern-2026-10-27";
const DO_NOT_SILENT_FALLTHROUGH_FRAGMENT = "must NOT silently fall through";
const NOT_MECHANICAL_FRAGMENT = "NOT a mechanical find-and-replace";

describe("src/lib/supabaseNexAdmin · throw-at-use Proxy", () => {
  it("exports a non-undefined `supabaseNexAdmin` symbol", () => {
    // Note: typeof is 'object' because the Proxy wraps `{}`.
    expect(supabaseNexAdmin).toBeDefined();
    expect(typeof supabaseNexAdmin).toBe("object");
  });

  it("throws on any property access (e.g. .from)", () => {
    expect(() => {
      // Accessing a property on the Proxy fires the `get` trap.
      (supabaseNexAdmin as unknown as Record<string, unknown>).from;
    }).toThrow();
  });

  it("throws on access via a Supabase-style method chain (.from('x').select())", () => {
    expect(() => {
      // Even starting the chain fires the `get` trap on `.from`.
      (supabaseNexAdmin as unknown as Record<string, (arg: string) => unknown>).from("test");
    }).toThrow();
  });

  it("throws on access to .auth, .storage, .rpc (every documented SupabaseClient surface)", () => {
    const surfaces = ["auth", "storage", "rpc", "channel", "removeChannel", "functions"];
    for (const surface of surfaces) {
      expect(() => {
        (supabaseNexAdmin as unknown as Record<string, unknown>)[surface];
      }, `access to supabaseNexAdmin.${surface} must throw`).toThrow();
    }
  });

  it("thrown error identifies the unavailable legacy import path", () => {
    let captured: unknown = null;
    try {
      (supabaseNexAdmin as unknown as Record<string, unknown>).from;
    } catch (e) {
      captured = e;
    }
    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).message).toContain(LEGACY_PATH_FRAGMENT);
  });

  it("thrown error names the real supported NEX-native client", () => {
    let captured: unknown = null;
    try {
      (supabaseNexAdmin as unknown as Record<string, unknown>).from;
    } catch (e) {
      captured = e;
    }
    expect((captured as Error).message).toContain(REAL_CLIENT_FRAGMENT);
  });

  it("thrown error includes the doctrine-anchor fragment (so operators can find the doc)", () => {
    let captured: unknown = null;
    try {
      (supabaseNexAdmin as unknown as Record<string, unknown>).from;
    } catch (e) {
      captured = e;
    }
    expect((captured as Error).message).toContain(DOCTRINE_ANCHOR_FRAGMENT);
  });

  it("thrown error includes the no-silent-fallthrough warning", () => {
    let captured: unknown = null;
    try {
      (supabaseNexAdmin as unknown as Record<string, unknown>).from;
    } catch (e) {
      captured = e;
    }
    expect((captured as Error).message).toContain(DO_NOT_SILENT_FALLTHROUGH_FRAGMENT);
  });

  it("thrown error explicitly disclaims that migration is a mechanical find-and-replace", () => {
    // Founder-sealed constraint (2026-10-27, R2-D-γ authorisation): the
    // shim must NOT suggest find-and-replace is safe. This test anchors
    // that guard; if the shim's error message is ever edited to recommend
    // mechanical migration, this test fails loudly.
    let captured: unknown = null;
    try {
      (supabaseNexAdmin as unknown as Record<string, unknown>).from;
    } catch (e) {
      captured = e;
    }
    expect((captured as Error).message).toContain(NOT_MECHANICAL_FRAGMENT);
  });

  it("thrown error documents the per-caller review constraints (schema / RLS / server-only)", () => {
    // The shim must document WHY mechanical migration isn't safe. If a
    // future edit removes these reasons and leaves only the generic warning,
    // this test fails. Each constraint is independently verified so a
    // partial strip-down also fails.
    let captured: unknown = null;
    try {
      (supabaseNexAdmin as unknown as Record<string, unknown>).from;
    } catch (e) {
      captured = e;
    }
    const msg = (captured as Error).message;
    expect(msg).toContain("RLS");
    expect(msg).toContain("schema");
    expect(msg).toContain("server-only");
  });

  it("throws CONSISTENTLY · subsequent accesses continue to throw (no silent recovery)", () => {
    // Access property 3 times · each access should throw independently.
    const accessOnce = () => (supabaseNexAdmin as unknown as Record<string, unknown>).from;
    expect(accessOnce).toThrow();
    expect(accessOnce).toThrow();
    expect(accessOnce).toThrow();
  });

  it("different property names all throw with the same guidance (uniform fail-closed)", () => {
    const captureMessage = (prop: string): string | null => {
      try {
        (supabaseNexAdmin as unknown as Record<string, unknown>)[prop];
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
    // All three must contain the same legacy-path identifier.
    expect(msgFrom).toContain(LEGACY_PATH_FRAGMENT);
    expect(msgRpc).toContain(LEGACY_PATH_FRAGMENT);
    expect(msgAuth).toContain(LEGACY_PATH_FRAGMENT);
  });
});
