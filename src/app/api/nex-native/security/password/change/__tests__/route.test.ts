// src/app/api/nex-native/security/password/change/__tests__/route.test.ts
//
// Regression tests for the password-change endpoint · owner directive
// 2026-11-07 · Item 2. Verifies:
//   · successful change calls bumpSessionsInvalidatedAtForOwner
//   · failed change (wrong current password) does NOT call the bump
//   · wrong-session returns 401 without calling the bump
//   · admin.updateUserById error bubbles + does not bump
//
// Everything downstream of the handler is mocked · we're testing the
// control flow, not Supabase itself.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// --- Hoisted mock state ---------------------------------------------------
const mocks = vi.hoisted(() => {
  return {
    sessionResult: null as null | {
      supabaseUserId: string;
      email: string | null;
      account: { id: string };
    },
    verifyShouldSucceed: true,
    updateShouldSucceed: true,
    bumpCalls: [] as string[],
    logSignInCalls: [] as Array<{
      event_type: string;
      success: boolean;
      account_id: string;
    }>,
    clearStepUpCalls: [] as string[],
  };
});

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: () => mocks.sessionResult,
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    auth: {
      admin: {
        updateUserById: () =>
          mocks.updateShouldSucceed
            ? Promise.resolve({ data: { user: { id: "u1" } }, error: null })
            : Promise.resolve({
                data: { user: null },
                error: { message: "admin-update-failed" },
              }),
      },
    },
  },
}));

vi.mock("@/lib/nex-native/security-service", () => ({
  logSignInEvent: (input: {
    event_type: string;
    success: boolean;
    account_id: string;
  }) => {
    mocks.logSignInCalls.push(input);
    return Promise.resolve();
  },
  bumpSessionsInvalidatedAtForOwner: (accountId: string) => {
    mocks.bumpCalls.push(accountId);
    return Promise.resolve({ invalidated_at: "2026-11-07T20:00:00.000Z" });
  },
}));

vi.mock("@/lib/nex-native/app/security-request", () => ({
  readClientIp: () => "127.0.0.1",
  readUserAgent: () => "vitest",
}));

vi.mock("@/lib/nex-native/vault/step-up-service", () => ({
  clearAllStepUpForAccount: (accountId: string) => {
    mocks.clearStepUpCalls.push(accountId);
    return Promise.resolve();
  },
}));

// Supabase createClient returned by the verifier (inside the route). We
// swap the behaviour of the inner signInWithPassword per test via
// `mocks.verifyShouldSucceed`.
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: () =>
        mocks.verifyShouldSucceed
          ? Promise.resolve({
              data: { user: { id: "u1" } },
              error: null,
            })
          : Promise.resolve({
              data: { user: null },
              error: { message: "invalid credentials" },
            }),
    },
  }),
}));

// Env vars read at module load.
vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "anon-key");

// Import AFTER mocks are in place so the module graph picks them up.
const { POST } = await import("../route");

// Minimal Request builder that satisfies the handler's req.json().
function makeRequest(body: unknown) {
  return new Request("http://localhost/api/nex-native/security/password/change", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/nex-native/security/password/change · Item 2", () => {
  beforeEach(() => {
    mocks.sessionResult = {
      supabaseUserId: "u1",
      email: "owner@example.com",
      account: { id: "00000000-0000-0000-0000-000000000042" },
    };
    mocks.verifyShouldSucceed = true;
    mocks.updateShouldSucceed = true;
    mocks.bumpCalls.length = 0;
    mocks.logSignInCalls.length = 0;
    mocks.clearStepUpCalls.length = 0;
  });

  it("successful change calls bumpSessionsInvalidatedAtForOwner + returns the new timestamp", async () => {
    const res = await POST(
      makeRequest({ current: "oldpass123", new: "newpass123" }) as never,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      sessions_invalidated_at?: string;
    };
    expect(body.ok).toBe(true);
    expect(body.sessions_invalidated_at).toBe("2026-11-07T20:00:00.000Z");

    // The whole point of Item 2:
    expect(mocks.bumpCalls).toEqual([
      "00000000-0000-0000-0000-000000000042",
    ]);
    // Audit log written as a password_change · success=true.
    expect(mocks.logSignInCalls).toHaveLength(1);
    expect(mocks.logSignInCalls[0]!.event_type).toBe("password_change");
    expect(mocks.logSignInCalls[0]!.success).toBe(true);
    // Vault step-up freshness cleared (Phase A §G.1 pre-existing behaviour).
    expect(mocks.clearStepUpCalls).toEqual([
      "00000000-0000-0000-0000-000000000042",
    ]);
  });

  it("wrong current password does NOT call the bump", async () => {
    mocks.verifyShouldSucceed = false;
    const res = await POST(
      makeRequest({ current: "wrongpass", new: "newpass123" }) as never,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("wrong_current_password");
    expect(mocks.bumpCalls).toEqual([]);
    expect(mocks.clearStepUpCalls).toEqual([]);
    // Audit · failure event written.
    expect(mocks.logSignInCalls).toHaveLength(1);
    expect(mocks.logSignInCalls[0]!.event_type).toBe("failure");
    expect(mocks.logSignInCalls[0]!.success).toBe(false);
  });

  it("admin.updateUserById failure does NOT call the bump", async () => {
    mocks.updateShouldSucceed = false;
    const res = await POST(
      makeRequest({ current: "oldpass123", new: "newpass123" }) as never,
    );
    expect(res.status).toBe(400);
    expect(mocks.bumpCalls).toEqual([]);
    expect(mocks.clearStepUpCalls).toEqual([]);
    expect(mocks.logSignInCalls[0]!.event_type).toBe("failure");
  });

  it("no session returns 401 and never calls the bump", async () => {
    mocks.sessionResult = null;
    const res = await POST(
      makeRequest({ current: "oldpass123", new: "newpass123" }) as never,
    );
    expect(res.status).toBe(401);
    expect(mocks.bumpCalls).toEqual([]);
    expect(mocks.logSignInCalls).toEqual([]);
  });

  it("weak new password (< 8 chars) is rejected before any mutation", async () => {
    const res = await POST(
      makeRequest({ current: "oldpass123", new: "short" }) as never,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toBe("weak_password");
    expect(mocks.bumpCalls).toEqual([]);
  });

  it("same old/new password is rejected before any mutation", async () => {
    const res = await POST(
      makeRequest({ current: "samepass1", new: "samepass1" }) as never,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toBe("same_password");
    expect(mocks.bumpCalls).toEqual([]);
  });
});
