// src/app/nex-native/manage/shop/setup/__tests__/c-name-owner-scope.test.ts
//
// Lane C · C-NAME-OWNER source-shape regression · round 18 · 2026-11-19.
//
// The two seller-setup actions that persist `nex_business.display_name`
// MUST route the write through `updateBusinessDisplayName` in
// `@/lib/nex-native/business-service`, not through a direct
// `nexSupabaseAdmin.from("nex_business").update(...)`. That service
// helper is the single owner-scope enforcement point (refuses to
// execute without ownerAccountId · scopes `.eq("owner_account_id",
// ownerAccountId)` · throws `owner-mismatch` on zero rows).
//
// Round 17 inlined the owner clause at the ACTION layer. Round 18
// (this file) moves the write behind the service helper so BOTH
// actions share one enforcement surface and future callers cannot
// forget the owner clause.
//
// These are source-shape assertions (no mocked Supabase client
// involved) · the runtime behaviour must still be verified against
// the sandbox under BROWSER + PERSISTENCE tiers when the Shared
// Live-Auth Verification Gate opens.
//
// Why source-shape and not functional:
//   The server action imports `server-only`, `revalidatePath`, the
//   nexSupabaseAdmin singleton, the session resolver, and the
//   business-service. Mocking all of those just to assert the
//   call-shape is fragile · reading the file is the honest
//   low-ceiling check. A paired SERVICE-LEVEL functional test at
//   `src/lib/nex-native/__tests__/update-business-display-name.test.ts`
//   exercises `updateBusinessDisplayName` directly with a stubbed
//   Supabase client.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ACTIONS_SRC = readFileSync(
  resolve(__dirname, "..", "_actions.ts"),
  "utf8",
);

describe("Lane C · C-NAME-OWNER · _actions imports updateBusinessDisplayName", () => {
  it("imports updateBusinessDisplayName from business-service", () => {
    // The service helper is the owner-scope enforcement point · both
    // actions must import it rather than go direct through
    // nexSupabaseAdmin for display_name.
    expect(ACTIONS_SRC).toMatch(
      /updateBusinessDisplayName,?\s*\n[\s\S]{0,400}?from "@\/lib\/nex-native\/business-service"/,
    );
  });

  it("no direct nex_business display_name update remains in _actions.ts", () => {
    // If someone reintroduces the inline direct-update, this fails.
    // We look for the exact shape round 17 used
    // (`.update({ display_name: displayName })`) and expect zero hits.
    expect(ACTIONS_SRC).not.toMatch(
      /\.update\(\{\s*display_name:\s*displayName\s*\}\)/,
    );
  });
});

describe("Lane C · C-NAME-OWNER · saveShopIdentityAction (legacy 8-step)", () => {
  it("calls updateBusinessDisplayName with (businessId, accountId, displayName)", () => {
    const callBlock = ACTIONS_SRC.match(
      /saveShopIdentityAction[\s\S]{0,2500}?updateBusinessDisplayName\(\s*biz\.businessId,\s*biz\.accountId,\s*displayName\s*\)/,
    );
    expect(callBlock, "updateBusinessDisplayName call not found in saveShopIdentityAction").not.toBeNull();
  });

  it("converts service-layer owner-mismatch into the owner-scope-denied wire code", () => {
    const convertBlock = ACTIONS_SRC.match(
      /saveShopIdentityAction[\s\S]{0,3000}?updateBusinessDisplayName\([\s\S]{0,400}?catch \(nameErr\)[\s\S]{0,500}?\/owner-mismatch\/[\s\S]{0,300}?return \{ ok: false, error: "owner-scope-denied" \}/,
    );
    expect(convertBlock, "owner-mismatch → owner-scope-denied conversion not found in saveShopIdentityAction").not.toBeNull();
  });
});

describe("Lane C · C-NAME-OWNER · saveShopBusinessDetailsAction (4-step flow)", () => {
  it("calls updateBusinessDisplayName with (businessId, accountId, displayName)", () => {
    const callBlock = ACTIONS_SRC.match(
      /saveShopBusinessDetailsAction[\s\S]{0,3500}?updateBusinessDisplayName\(\s*biz\.businessId,\s*biz\.accountId,\s*displayName\s*\)/,
    );
    expect(callBlock, "updateBusinessDisplayName call not found in saveShopBusinessDetailsAction").not.toBeNull();
  });

  it("converts service-layer owner-mismatch into the owner-scope-denied wire code", () => {
    const convertBlock = ACTIONS_SRC.match(
      /saveShopBusinessDetailsAction[\s\S]{0,4000}?updateBusinessDisplayName\([\s\S]{0,400}?catch \(nameErr\)[\s\S]{0,500}?\/owner-mismatch\/[\s\S]{0,300}?return \{ ok: false, error: "owner-scope-denied" \}/,
    );
    expect(convertBlock, "owner-mismatch → owner-scope-denied conversion not found in saveShopBusinessDetailsAction").not.toBeNull();
  });
});

describe("Lane C · C-NAME-OWNER · regression floor", () => {
  it("every updateBusinessDisplayName call passes (businessId, accountId, displayName) in that order", () => {
    // If someone ever adds a third caller, assert the call-shape
    // uniformly. The helper's third argument is the string to persist.
    const calls = ACTIONS_SRC.match(/updateBusinessDisplayName\([^)]+\)/g) ?? [];
    expect(calls.length, "expected at least two updateBusinessDisplayName calls").toBeGreaterThanOrEqual(2);
    for (const occurrence of calls) {
      expect(occurrence).toMatch(
        /updateBusinessDisplayName\(\s*biz\.businessId,\s*biz\.accountId,\s*displayName\s*\)/,
      );
    }
  });
});
