// src/lib/nex-native/__tests__/sync-shop-install-prefs.test.ts
//
// Unit tests for the pure merge rule in
// src/lib/nex-native/shop-install/sync-shop-install-prefs.ts.
//
// Scope:
//   · mergeShopInstallRecords · pure · no I/O · exhaustively exercised
//     against the "most-advanced wins" contract documented in
//     migration 369's forward header and the Spec §C state machine.
//
// NOT in scope (require migration 369 applied to a sandbox Supabase):
//   · syncShopInstallPrefs end-to-end against a real DB.
//   · RLS isolation (one account cannot read / write another's row).
//   · Monotonicity under concurrent upserts from two sessions.
// Those live at tests/integration/nex-account-shop-install-prefs-rls.spec.ts
// (authored in the same cycle · NOT EXECUTED pending sandbox-apply
// approval phrase).

import { describe, test, expect } from "vitest";

import {
  mergeShopInstallRecords,
  type ShopInstallClientRecord,
} from "../shop-install/merge-shop-install-records";

const SLUG = "example-shop";

function client(
  overrides: Partial<ShopInstallClientRecord> = {},
): ShopInstallClientRecord {
  return {
    shopSlug: SLUG,
    dismissals: 0,
    firstDismissAt: null,
    suppressed: false,
    installed: false,
    ...overrides,
  };
}

describe("mergeShopInstallRecords · most-advanced wins", () => {
  test("no server row · client echoes unchanged", () => {
    const c = client({ dismissals: 1, firstDismissAt: 1_000 });
    expect(mergeShopInstallRecords(c, null)).toEqual(c);
  });

  test("server has higher dismissals · merged dismissals rises", () => {
    const merged = mergeShopInstallRecords(
      client({ dismissals: 1, firstDismissAt: 2_000 }),
      {
        dismissals: 2,
        first_dismiss_at: new Date(1_500).toISOString(),
        suppressed: true,
        installed: false,
      },
    );
    expect(merged.dismissals).toBe(2);
    expect(merged.suppressed).toBe(true);
    expect(merged.firstDismissAt).toBe(1_500);
  });

  test("client has higher dismissals · server does not regress it", () => {
    const merged = mergeShopInstallRecords(
      client({ dismissals: 2, firstDismissAt: 2_000, suppressed: true }),
      {
        dismissals: 0,
        first_dismiss_at: null,
        suppressed: false,
        installed: false,
      },
    );
    expect(merged.dismissals).toBe(2);
    expect(merged.suppressed).toBe(true);
    expect(merged.firstDismissAt).toBe(2_000);
  });

  test("first_dismiss_at · earlier of two non-null timestamps wins", () => {
    const merged = mergeShopInstallRecords(
      client({ dismissals: 1, firstDismissAt: 5_000 }),
      {
        dismissals: 1,
        first_dismiss_at: new Date(3_000).toISOString(),
        suppressed: false,
        installed: false,
      },
    );
    expect(merged.firstDismissAt).toBe(3_000);
  });

  test("first_dismiss_at · null on one side uses the non-null", () => {
    const merged = mergeShopInstallRecords(
      client({ dismissals: 1, firstDismissAt: 5_000 }),
      {
        dismissals: 0,
        first_dismiss_at: null,
        suppressed: false,
        installed: false,
      },
    );
    expect(merged.firstDismissAt).toBe(5_000);
  });

  test("dismissals=0 on both sides · firstDismissAt stays null", () => {
    const merged = mergeShopInstallRecords(client(), {
      dismissals: 0,
      first_dismiss_at: null,
      suppressed: false,
      installed: false,
    });
    expect(merged.firstDismissAt).toBeNull();
  });

  test("suppressed is OR · set on either side wins", () => {
    const merged = mergeShopInstallRecords(
      client({ dismissals: 1, firstDismissAt: 1_000, suppressed: false }),
      {
        dismissals: 1,
        first_dismiss_at: new Date(1_000).toISOString(),
        suppressed: true,
        installed: false,
      },
    );
    expect(merged.suppressed).toBe(true);
  });

  test("installed is OR · set on either side wins", () => {
    const merged = mergeShopInstallRecords(
      client({ installed: false }),
      {
        dismissals: 0,
        first_dismiss_at: null,
        suppressed: false,
        installed: true,
      },
    );
    expect(merged.installed).toBe(true);
  });

  test("monotonicity invariant · merge is idempotent", () => {
    const c = client({
      dismissals: 2,
      firstDismissAt: 1_000,
      suppressed: true,
      installed: true,
    });
    const server = {
      dismissals: 2 as const,
      first_dismiss_at: new Date(1_000).toISOString(),
      suppressed: true,
      installed: true,
    };
    const once = mergeShopInstallRecords(c, server);
    const twice = mergeShopInstallRecords(once, server);
    expect(twice).toEqual(once);
  });

  test("invariant repair · dismissals ≥ 1 with both sides null gets a stamp", () => {
    // Impossible under the CHECK constraint, but if somehow a corrupt
    // server row reached us, the merge must not return a record that
    // violates the Spec §C state machine (non-null firstDismissAt for
    // dismissals≥1). We fall forward by stamping now().
    const merged = mergeShopInstallRecords(
      client({ dismissals: 1, firstDismissAt: null as unknown as number }),
      {
        dismissals: 2,
        first_dismiss_at: null,
        suppressed: false,
        installed: false,
      },
    );
    expect(merged.dismissals).toBe(2);
    expect(merged.firstDismissAt).not.toBeNull();
  });

  test("dismissals==0 after merge · firstDismissAt is forced null", () => {
    const merged = mergeShopInstallRecords(
      client({ dismissals: 0, firstDismissAt: null }),
      {
        dismissals: 0,
        first_dismiss_at: null,
        suppressed: false,
        installed: false,
      },
    );
    expect(merged.firstDismissAt).toBeNull();
  });
});
