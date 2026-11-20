// src/lib/nex-native/__tests__/account-deletion-lane-i-route-anchor.test.ts
//
// Lane I · route-level owner-isolation anchor. Split from
// `account-deletion-lane-i-anchors.test.ts` so this file can safely
// `vi.mock("@/lib/nex-native/account-deletion-service")` without
// clobbering the retry/reality tests that need the REAL service.
//
// Locks in the "cross-account denial" shape: the POST /security/
// account/delete route does NOT accept a target account in its body ·
// it ALWAYS uses `session.account.id` + `session.supabaseUserId`.
// A caller that smuggles `account_id` / `supabase_user_id` fields
// into the JSON body must see them IGNORED.
//
// OFFLINE ONLY · DB, Auth, rate-limit, audit service all mocked. This
// test does not prove a live attacker could not bypass the route
// through other means (CSRF, session-token theft, etc.) · it anchors
// the route's own target-selection invariant.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const ACCOUNT_OWN = "11111111-1111-1111-1111-111111111111";
const SUPA_USER_OWN = "22222222-2222-2222-2222-222222222222";

const MOCKS = vi.hoisted(() => ({
  deleteCalls: [] as Array<{ ownerAccountId: string; supabaseUserId: string }>,
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: () =>
    Promise.resolve({
      supabaseUserId: "22222222-2222-2222-2222-222222222222",
      email: "owner@example.com",
      account: { id: "11111111-1111-1111-1111-111111111111" },
    }),
}));

vi.mock("@/lib/nex-native/security-rate-limit", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/nex-native/security-rate-limit")
  >("@/lib/nex-native/security-rate-limit");
  return { ...actual, recordIfAllowed: () => Promise.resolve() };
});

vi.mock("@/lib/nex-native/security-audit-service", () => ({
  recordAuditEvent: () => Promise.resolve({ ok: true, logId: 1 }),
  isAuditWriteError: () => false,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: () =>
        Promise.resolve({
          data: { user: { id: "22222222-2222-2222-2222-222222222222" } },
          error: null,
        }),
    },
  }),
}));

vi.mock("@/lib/nex-native/account-deletion-service", () => ({
  deleteOwnAccount: (input: {
    ownerAccountId: string;
    supabaseUserId: string;
  }) => {
    MOCKS.deleteCalls.push({
      ownerAccountId: input.ownerAccountId,
      supabaseUserId: input.supabaseUserId,
    });
    return Promise.resolve({ ok: true, deleted: true });
  },
}));

const { POST } = await import(
  "@/app/api/nex-native/security/account/delete/route"
);

describe("Lane I · POST /security/account/delete · cross-account denial via session-scoping", () => {
  beforeEach(() => {
    MOCKS.deleteCalls = [];
  });

  it("I-OWNER · body-level account_id / supabase_user_id fields are IGNORED · service is always called with the SESSION's own IDs", async () => {
    const req = new Request(
      "http://localhost/api/nex-native/security/account/delete",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          current_password: "pw123456",
          // Smuggled attacker payload · all three must be IGNORED.
          account_id: "99999999-9999-9999-9999-999999999999",
          ownerAccountId: "88888888-8888-8888-8888-888888888888",
          supabase_user_id: "77777777-7777-7777-7777-777777777777",
        }),
      },
    );
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(MOCKS.deleteCalls).toHaveLength(1);
    expect(MOCKS.deleteCalls[0]!.ownerAccountId).toBe(ACCOUNT_OWN);
    expect(MOCKS.deleteCalls[0]!.supabaseUserId).toBe(SUPA_USER_OWN);
  });
});
