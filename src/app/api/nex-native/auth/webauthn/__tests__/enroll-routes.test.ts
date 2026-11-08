// src/app/api/nex-native/auth/webauthn/__tests__/enroll-routes.test.ts
//
// NEX Security Programme · WebAuthn enrollment route tests.
// Owner directive 2026-11-08 · "complete build" authorises focused
// route tests for the four WebAuthn handlers.
//
// Scope · HTTP envelope + auth + rate-limit + challenge-cookie
// semantics. The underlying @simplewebauthn verification is not
// exercised with real cryptographic material · we assert only the
// gate behaviour and the response shape that the handlers wrap
// around whatever the library returns.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Env vars read at module load · supabase-admin fails without these.
vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

// ─── Hoisted mock state ──────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  session: null as null | {
    account: { id: string; display_name: string | null; nex_handle: string | null };
  },
  existingCreds: [] as Array<{ credential_id: string; transports: string[] | null }>,
  cookieStore: new Map<string, string>(),
  shouldThrottleWebauthnEnroll: false,
  shouldVerifyRegistrationSucceed: true,
  insertedCredential: null as unknown,
  insertShouldFail: false,
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

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSession: () => Promise.resolve(mocks.session),
}));

vi.mock("@/lib/nex-native/webauthn-service", () => ({
  listCredentialsForAccount: () => Promise.resolve(mocks.existingCreds),
  saveCredential: (row: unknown) => {
    if (mocks.insertShouldFail) {
      return Promise.reject(new Error("db-insert-failed"));
    }
    mocks.insertedCredential = row;
    return Promise.resolve();
  },
}));

vi.mock("@/lib/nex-native/webauthn-config", () => ({
  resolveWebauthnConfig: () => ({
    rpID: "localhost",
    rpName: "NEX",
    origin: "http://localhost:3008",
  }),
}));

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: () =>
    Promise.resolve({
      challenge: "mock-challenge-enroll",
      rp: { id: "localhost", name: "NEX" },
      user: { id: "mock-user-id", name: "mock", displayName: "Mock" },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
    }),
  verifyRegistrationResponse: () =>
    mocks.shouldVerifyRegistrationSucceed
      ? Promise.resolve({
          verified: true,
          registrationInfo: {
            credential: {
              id: "mock-cred-id",
              publicKey: new Uint8Array([1, 2, 3, 4]),
              counter: 0,
              transports: ["internal"],
            },
          },
        })
      : Promise.resolve({ verified: false }),
}));

vi.mock("@/lib/nex-native/security-rate-limit", async () => {
  // Pass-through to the real module but with a kill-switch so each
  // test can force the throttle path.
  const actual = await vi.importActual<
    typeof import("@/lib/nex-native/security-rate-limit")
  >("@/lib/nex-native/security-rate-limit");
  return {
    ...actual,
    recordIfAllowed: (key: string, action: string) => {
      if (mocks.shouldThrottleWebauthnEnroll && action === "webauthn_enroll") {
        return Promise.reject(new actual.SecurityRateLimitError(action as never, 300));
      }
      return Promise.resolve();
    },
  };
});

const SESSION_ID = "11111111-1111-1111-1111-111111111111";

function startRequest() {
  return new Request("http://localhost/api/nex-native/auth/webauthn/enroll-start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
}

function finishRequest(body: unknown) {
  return new Request("http://localhost/api/nex-native/auth/webauthn/enroll-finish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Import AFTER mocks.
const { POST: enrollStart } = await import("../enroll-start/route");
const { POST: enrollFinish } = await import("../enroll-finish/route");

// ─── Tests ────────────────────────────────────────────────────────────

describe("POST /api/nex-native/auth/webauthn/enroll-start", () => {
  beforeEach(() => {
    mocks.session = {
      account: { id: SESSION_ID, display_name: "T", nex_handle: null },
    };
    mocks.existingCreds = [];
    mocks.cookieStore.clear();
    mocks.shouldThrottleWebauthnEnroll = false;
    mocks.shouldVerifyRegistrationSucceed = true;
    mocks.insertShouldFail = false;
  });

  it("unauthenticated → 401", async () => {
    mocks.session = null;
    const res = await enrollStart(startRequest());
    expect(res.status).toBe(401);
  });

  it("rate-limited → 429 + Retry-After header", async () => {
    mocks.shouldThrottleWebauthnEnroll = true;
    const res = await enrollStart(startRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("300");
  });

  it("happy path → 200 + options + challenge cookie set on response", async () => {
    const res = await enrollStart(startRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; options: { challenge: string } };
    expect(body.ok).toBe(true);
    expect(body.options.challenge).toBe("mock-challenge-enroll");
    // Cookie Set-Cookie header on the response must carry the challenge.
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("nex-webauthn-enroll-challenge=mock-challenge-enroll");
    expect(setCookie.toLowerCase()).toContain("httponly");
  });
});

describe("POST /api/nex-native/auth/webauthn/enroll-finish", () => {
  beforeEach(() => {
    mocks.session = {
      account: { id: SESSION_ID, display_name: "T", nex_handle: null },
    };
    mocks.cookieStore.clear();
    mocks.shouldThrottleWebauthnEnroll = false;
    mocks.shouldVerifyRegistrationSucceed = true;
    mocks.insertShouldFail = false;
    mocks.insertedCredential = null;
  });

  it("unauthenticated → 401", async () => {
    mocks.session = null;
    const res = await enrollFinish(finishRequest({ response: {} }));
    expect(res.status).toBe(401);
  });

  it("rate-limited → 429", async () => {
    mocks.shouldThrottleWebauthnEnroll = true;
    const res = await enrollFinish(finishRequest({ response: {} }));
    expect(res.status).toBe(429);
  });

  it("missing challenge cookie → 400", async () => {
    // Cookie store is empty on purpose · no challenge was set by start.
    const res = await enrollFinish(finishRequest({ response: {} }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("missing_challenge");
  });

  it("missing response in body → 400", async () => {
    mocks.cookieStore.set("nex-webauthn-enroll-challenge", "mock-challenge-enroll");
    const res = await enrollFinish(finishRequest({}));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("missing_response");
  });

  it("verification returns verified=false → 400", async () => {
    mocks.cookieStore.set("nex-webauthn-enroll-challenge", "mock-challenge-enroll");
    mocks.shouldVerifyRegistrationSucceed = false;
    const res = await enrollFinish(
      finishRequest({ response: { id: "credential-id", rawId: "credential-id" } }),
    );
    expect(res.status).toBe(400);
  });
});
