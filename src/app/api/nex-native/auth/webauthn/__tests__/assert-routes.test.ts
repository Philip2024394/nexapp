// src/app/api/nex-native/auth/webauthn/__tests__/assert-routes.test.ts
//
// NEX Security Programme · WebAuthn assertion route tests.
// Owner directive 2026-11-08 · "complete build" authorises focused
// route tests for the four WebAuthn handlers.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const mocks = vi.hoisted(() => ({
  storedCredential: null as null | {
    credential_id: string;
    credential_public_key: string;
    counter: number;
    transports: string[] | null;
    account_id: string;
  },
  cookieStore: new Map<string, string>(),
  shouldThrottleAssert: false,
  verifyShouldSucceed: true,
  accountLookupResult: {
    data: null as null | { supabase_user_id: string | null; display_name: string | null },
    error: null as null | { message: string },
  },
  authGetUserResult: {
    data: { user: null as null | { email: string | null } },
    error: null as null | { message: string },
  },
}));

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const value = mocks.cookieStore.get(name);
        return value ? { name, value } : undefined;
      },
    }),
}));

vi.mock("@/lib/nex-native/webauthn-service", () => ({
  getCredentialById: (id: string) => {
    if (mocks.storedCredential && mocks.storedCredential.credential_id === id) {
      return Promise.resolve(mocks.storedCredential);
    }
    return Promise.resolve(null);
  },
  listCredentialsForAccount: () => Promise.resolve([]),
  markCredentialUsed: () => Promise.resolve(),
}));

vi.mock("@/lib/nex-native/webauthn-config", () => ({
  resolveWebauthnConfig: () => ({
    rpID: "localhost",
    rpName: "NEX",
    origin: "http://localhost:3008",
  }),
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  nexAppSsrServerClient: () =>
    Promise.resolve({
      auth: {
        verifyOtp: () =>
          Promise.resolve({
            data: { session: { access_token: "a", refresh_token: "r" } },
            error: null,
          }),
      },
    }),
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: mocks.accountLookupResult.data,
              error: mocks.accountLookupResult.error,
            }),
        }),
      }),
    }),
    auth: {
      admin: {
        getUserById: () => Promise.resolve(mocks.authGetUserResult),
        generateLink: () =>
          Promise.resolve({
            data: { properties: { hashed_token: "hashed-token-xyz" } },
            error: null,
          }),
        listUsers: () =>
          Promise.resolve({ data: { users: [] }, error: null }),
      },
    },
  },
}));

vi.mock("@simplewebauthn/server", () => ({
  generateAuthenticationOptions: () =>
    Promise.resolve({
      challenge: "mock-challenge-assert",
      allowCredentials: [],
      userVerification: "required",
      timeout: 60_000,
    }),
  verifyAuthenticationResponse: () =>
    mocks.verifyShouldSucceed
      ? Promise.resolve({
          verified: true,
          authenticationInfo: { newCounter: 42 },
        })
      : Promise.resolve({ verified: false }),
}));

vi.mock("@/lib/nex-native/security-rate-limit", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/nex-native/security-rate-limit")
  >("@/lib/nex-native/security-rate-limit");
  return {
    ...actual,
    recordIfAllowed: (_key: string, action: string) => {
      if (mocks.shouldThrottleAssert && action === "webauthn_assert") {
        return Promise.reject(new actual.SecurityRateLimitError(action as never, 200));
      }
      return Promise.resolve();
    },
  };
});

function startRequest(body: unknown = {}) {
  return new Request(
    "http://localhost/api/nex-native/auth/webauthn/assert-start",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function finishRequest(body: unknown) {
  return new Request(
    "http://localhost/api/nex-native/auth/webauthn/assert-finish",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

const { POST: assertStart } = await import("../assert-start/route");
const { POST: assertFinish } = await import("../assert-finish/route");

describe("POST /api/nex-native/auth/webauthn/assert-start", () => {
  beforeEach(() => {
    mocks.cookieStore.clear();
    mocks.shouldThrottleAssert = false;
  });

  it("rate-limited → 429 + Retry-After header", async () => {
    mocks.shouldThrottleAssert = true;
    const res = await assertStart(startRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("200");
  });

  it("empty body → 200 + options + challenge cookie", async () => {
    const res = await assertStart(startRequest({}));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; options: { challenge: string } };
    expect(body.ok).toBe(true);
    expect(body.options.challenge).toBe("mock-challenge-assert");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("nex-webauthn-assert-challenge=mock-challenge-assert");
  });

  it("email hint resolves no credentials → still 200 (empty allowList)", async () => {
    const res = await assertStart(startRequest({ email: "nobody@example.com" }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/nex-native/auth/webauthn/assert-finish", () => {
  beforeEach(() => {
    mocks.cookieStore.clear();
    mocks.shouldThrottleAssert = false;
    mocks.verifyShouldSucceed = true;
    mocks.storedCredential = null;
    mocks.accountLookupResult = {
      data: { supabase_user_id: "sb-user-1", display_name: "T" },
      error: null,
    };
    mocks.authGetUserResult = {
      data: { user: { email: "owner@example.com" } },
      error: null,
    };
  });

  it("rate-limited → 429", async () => {
    mocks.shouldThrottleAssert = true;
    const res = await assertFinish(finishRequest({ response: { id: "x" } }));
    expect(res.status).toBe(429);
  });

  it("missing challenge cookie → 400", async () => {
    const res = await assertFinish(finishRequest({ response: { id: "x" } }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("missing_challenge");
  });

  it("missing response in body → 400", async () => {
    mocks.cookieStore.set(
      "nex-webauthn-assert-challenge",
      "mock-challenge-assert",
    );
    const res = await assertFinish(finishRequest({}));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("missing_response");
  });

  it("unknown credential → 404", async () => {
    mocks.cookieStore.set(
      "nex-webauthn-assert-challenge",
      "mock-challenge-assert",
    );
    // storedCredential is null · getCredentialById always returns null.
    const res = await assertFinish(
      finishRequest({ response: { id: "unknown-cred-id" } }),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unknown_credential");
  });

  it("verification returns verified=false → 400 not_verified", async () => {
    mocks.cookieStore.set(
      "nex-webauthn-assert-challenge",
      "mock-challenge-assert",
    );
    mocks.storedCredential = {
      credential_id: "cred-1",
      credential_public_key: Buffer.from([1, 2, 3, 4]).toString("base64url"),
      counter: 0,
      transports: null,
      account_id: "22222222-2222-2222-2222-222222222222",
    };
    mocks.verifyShouldSucceed = false;
    const res = await assertFinish(
      finishRequest({ response: { id: "cred-1" } }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not_verified");
  });
});
