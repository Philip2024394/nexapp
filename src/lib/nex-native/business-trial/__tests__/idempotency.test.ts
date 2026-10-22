// src/lib/nex-native/business-trial/__tests__/idempotency.test.ts
//
// G1 regression · Q5 verification · account-scoped idempotency wrapper.
// Tests the full preflight → finalize cycle with the existing primitive.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  preflightTrialIdempotency,
  finalizeTrialIdempotency,
} from "../idempotency";

const ACCOUNT_A = "11111111-1111-1111-1111-111111111111";
const ACCOUNT_B = "22222222-2222-2222-2222-222222222222";

let tmpRoot: string;
const originalRoot = process.env.NEX_IDEMPOTENCY_DATA_ROOT;
const originalPepper = process.env.NEX_AUDIT_HASH_PEPPER;

beforeEach(() => {
  // Fresh JSONL store per test
  tmpRoot = mkdtempSync(path.join(tmpdir(), "nex-trial-idem-"));
  process.env.NEX_IDEMPOTENCY_DATA_ROOT = tmpRoot;
  process.env.NEX_AUDIT_HASH_PEPPER = "test-pepper-for-idem-tests";
});

afterEach(() => {
  try {
    rmSync(tmpRoot, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }
  if (originalRoot === undefined) {
    delete process.env.NEX_IDEMPOTENCY_DATA_ROOT;
  } else {
    process.env.NEX_IDEMPOTENCY_DATA_ROOT = originalRoot;
  }
  if (originalPepper === undefined) {
    delete process.env.NEX_AUDIT_HASH_PEPPER;
  } else {
    process.env.NEX_AUDIT_HASH_PEPPER = originalPepper;
  }
});

function makeReq(key: string | null, body = ""): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key !== null) headers["Idempotency-Key"] = key;
  return new Request("https://nex.example/api/nex-native/trial/start", {
    method: "POST",
    headers,
    body: body || undefined,
  });
}

describe("preflightTrialIdempotency · account-scoped integration", () => {
  it("first call with a well-formed key returns proceed", async () => {
    const req = makeReq("abcd1234abcd1234abcd1234");
    const result = await preflightTrialIdempotency(
      "",
      req,
      ACCOUNT_A,
      "/api/nex-native/trial/start",
    );
    expect(result.kind).toBe("proceed");
  });

  it("missing header falls back to ephemeral proceed (require_header:false)", async () => {
    const req = makeReq(null);
    const result = await preflightTrialIdempotency(
      "",
      req,
      ACCOUNT_A,
      "/api/nex-native/trial/start",
    );
    expect(result.kind).toBe("proceed");
    if (result.kind === "proceed") {
      expect(result.key.startsWith("ephemeral_")).toBe(true);
    }
  });

  it("second call with same key same account same body → cached", async () => {
    const req1 = makeReq("abcd1234abcd1234abcd1234");
    const pre1 = await preflightTrialIdempotency("", req1, ACCOUNT_A, "/api/nex-native/trial/start");
    expect(pre1.kind).toBe("proceed");
    if (pre1.kind !== "proceed") return;
    await finalizeTrialIdempotency(pre1.key, 200, { status: "active", start_at: "x", end_at: "y" });

    const req2 = makeReq("abcd1234abcd1234abcd1234");
    const pre2 = await preflightTrialIdempotency("", req2, ACCOUNT_A, "/api/nex-native/trial/start");
    expect(pre2.kind).toBe("cached");
    if (pre2.kind === "cached") {
      expect(pre2.status_code).toBe(200);
      expect((pre2.body as { status: string }).status).toBe("active");
    }
  });

  it("ACCOUNT ISOLATION · same raw key from DIFFERENT accounts does NOT collide", async () => {
    const req1 = makeReq("sharedkey111111111111");
    const pre1 = await preflightTrialIdempotency("", req1, ACCOUNT_A, "/api/nex-native/trial/start");
    expect(pre1.kind).toBe("proceed");
    if (pre1.kind !== "proceed") return;
    await finalizeTrialIdempotency(pre1.key, 200, {
      status: "active-for-A",
      marker: "ACCOUNT_A_RESPONSE",
    });

    // Different account, same raw key, same body
    const req2 = makeReq("sharedkey111111111111");
    const pre2 = await preflightTrialIdempotency("", req2, ACCOUNT_B, "/api/nex-native/trial/start");
    // Must NOT be cached · must proceed fresh because scope prefix is per-account
    expect(pre2.kind).toBe("proceed");
    if (pre2.kind === "proceed") {
      // Verify the two accounts' idempotency keys are distinct strings
      // Can't inspect the composed key directly (it's opaque), but the fact
      // that we got "proceed" rather than "cached" proves scope isolation.
      expect(pre2.key).not.toBe(pre1.key);
    }
  });

  it("same key same account DIFFERENT body → 422 different_request_conflict", async () => {
    const req1 = makeReq("samekeyXXXXXXXXXXXXX", JSON.stringify({ a: 1 }));
    const pre1 = await preflightTrialIdempotency(JSON.stringify({ a: 1 }), req1, ACCOUNT_A, "/api/nex-native/trial/start");
    expect(pre1.kind).toBe("proceed");
    if (pre1.kind !== "proceed") return;
    await finalizeTrialIdempotency(pre1.key, 200, { ok: true });

    const req2 = makeReq("samekeyXXXXXXXXXXXXX", JSON.stringify({ a: 2 }));
    const pre2 = await preflightTrialIdempotency(JSON.stringify({ a: 2 }), req2, ACCOUNT_A, "/api/nex-native/trial/start");
    expect(pre2.kind).toBe("different_request_conflict");
    if (pre2.kind === "different_request_conflict") {
      expect(pre2.status_code).toBe(422);
    }
  });

  it("ENDPOINT ISOLATION · same key for /start vs /opt-out-conversion do NOT share cache", async () => {
    // Verifies the wrapper's scope prefix includes both account AND route.
    // A client that reuses the same raw Idempotency-Key across two trial
    // endpoints must receive two independent idempotency scopes · the second
    // endpoint sees `proceed`, not a stale cache from the first.
    const req1 = makeReq("eptkey1234567890abcde");
    const pre1 = await preflightTrialIdempotency("", req1, ACCOUNT_A, "/api/nex-native/trial/start");
    expect(pre1.kind).toBe("proceed");
    if (pre1.kind !== "proceed") return;
    await finalizeTrialIdempotency(pre1.key, 200, { from_endpoint: "start" });

    const req2 = makeReq("eptkey1234567890abcde");
    const pre2 = await preflightTrialIdempotency(
      "",
      req2,
      ACCOUNT_A,
      "/api/nex-native/trial/opt-out-conversion",
    );
    // Scope prefix differs by route · must proceed fresh, not return cached.
    expect(pre2.kind).toBe("proceed");
    if (pre2.kind === "proceed") {
      expect(pre2.key).not.toBe(pre1.key);
    }
  });

  it("missing header falls through fresh each time (ephemeral keys never cache)", async () => {
    const pre1 = await preflightTrialIdempotency(
      "",
      makeReq(null),
      ACCOUNT_A,
      "/api/nex-native/trial/start",
    );
    const pre2 = await preflightTrialIdempotency(
      "",
      makeReq(null),
      ACCOUNT_A,
      "/api/nex-native/trial/start",
    );
    expect(pre1.kind).toBe("proceed");
    expect(pre2.kind).toBe("proceed");
    if (pre1.kind === "proceed" && pre2.kind === "proceed") {
      expect(pre1.key).not.toBe(pre2.key);
      expect(pre1.key.startsWith("ephemeral_")).toBe(true);
      expect(pre2.key.startsWith("ephemeral_")).toBe(true);
    }
  });
});
