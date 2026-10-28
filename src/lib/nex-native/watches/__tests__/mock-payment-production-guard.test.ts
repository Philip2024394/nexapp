// src/lib/nex-native/watches/__tests__/mock-payment-production-guard.test.ts
//
// R2 · Proves two invariants that together close the mock-payment
// bypass flagged in the P2 audit:
//
//   (A) `evaluateDevMockPaymentGuard` NEVER allows mock payment when
//       NODE_ENV === 'production', regardless of any other env var,
//       and fails closed in non-production unless explicitly opted in.
//   (B) `mockGrantInputSchema` rejects ANY client-supplied payment
//       metadata (provider, paymentReference, amountPence, …) via
//       zod's `.strict()` mode, so a hand-crafted POST cannot slip
//       values into the ledger row.
//
// By inspection of `grantWatchListingEntitlementMockAction` in
// `watch-listing-actions.ts`, both the guard and the schema are
// evaluated BEFORE any session resolution, listing lookup, or
// service-layer write. If either gate denies, no entitlement grant
// and no listing publish can occur.

import { describe, it, expect } from "vitest";
import {
  evaluateDevMockPaymentGuard,
  denialToResultCode,
  mockGrantInputSchema,
  type DevMockDenialReason,
} from "../watch-listing-dev-mock-guard";

// ---------------------------------------------------------------------------
// Invariant (A) · production always rejects, non-production fail-closed
// ---------------------------------------------------------------------------

describe("evaluateDevMockPaymentGuard · production rejection is unoverridable", () => {
  it("rejects with reason=production_disallowed when NODE_ENV=production and env flag is '1'", () => {
    const r = evaluateDevMockPaymentGuard({
      NODE_ENV: "production",
      NEX_WATCHES_DEV_MOCK_PAYMENT_ALLOWED: "1",
    });
    expect(r).toEqual({ allowed: false, reason: "production_disallowed" });
  });

  it("rejects when NODE_ENV=production and the env flag is unset", () => {
    const r = evaluateDevMockPaymentGuard({ NODE_ENV: "production" });
    expect(r).toEqual({ allowed: false, reason: "production_disallowed" });
  });

  it("rejects in production regardless of any truthy-looking flag value", () => {
    const flagValues = ["1", "true", "yes", "ok", "ALLOW", "", "allow_me"];
    for (const v of flagValues) {
      const r = evaluateDevMockPaymentGuard({
        NODE_ENV: "production",
        NEX_WATCHES_DEV_MOCK_PAYMENT_ALLOWED: v,
      });
      expect(r.allowed, `flag="${v}" must still reject in production`).toBe(false);
    }
  });

  it("rejects in production even if a decoy / unknown flag is set", () => {
    const r = evaluateDevMockPaymentGuard({
      NODE_ENV: "production",
      NEX_WATCHES_FORCE_ALLOW: "1",
      ANY_OTHER_FLAG: "1",
      NEX_WATCHES_DEV_MOCK_PAYMENT_ALLOWED_PROD: "1",
    });
    expect(r.allowed).toBe(false);
  });
});

describe("evaluateDevMockPaymentGuard · non-production fails closed by default", () => {
  it("rejects in development with no env flag set", () => {
    const r = evaluateDevMockPaymentGuard({ NODE_ENV: "development" });
    expect(r).toEqual({ allowed: false, reason: "env_flag_missing" });
  });

  it("rejects when the env flag is set to any value other than exactly '1'", () => {
    const nonAllowValues = ["0", "true", "yes", "allow", "", "disabled", "1 ", " 1"];
    for (const v of nonAllowValues) {
      const r = evaluateDevMockPaymentGuard({
        NODE_ENV: "development",
        NEX_WATCHES_DEV_MOCK_PAYMENT_ALLOWED: v,
      });
      expect(r).toEqual({ allowed: false, reason: "env_flag_missing" });
    }
  });

  it("allows when NODE_ENV !== production AND flag === '1' (opt-in path)", () => {
    const r = evaluateDevMockPaymentGuard({
      NODE_ENV: "development",
      NEX_WATCHES_DEV_MOCK_PAYMENT_ALLOWED: "1",
    });
    expect(r).toEqual({ allowed: true });
  });

  it("treats NODE_ENV='test' as non-production so vitest can exercise the allowed branch", () => {
    const r = evaluateDevMockPaymentGuard({
      NODE_ENV: "test",
      NEX_WATCHES_DEV_MOCK_PAYMENT_ALLOWED: "1",
    });
    expect(r).toEqual({ allowed: true });
  });

  it("treats an undefined NODE_ENV as non-production AND fail-closed on missing flag", () => {
    const r = evaluateDevMockPaymentGuard({});
    expect(r).toEqual({ allowed: false, reason: "env_flag_missing" });
  });

  it("treats an unrecognised NODE_ENV (staging, qa, …) as non-production, flag still required", () => {
    for (const env of ["staging", "qa", "preview", "canary"]) {
      const r = evaluateDevMockPaymentGuard({ NODE_ENV: env });
      expect(r).toEqual({ allowed: false, reason: "env_flag_missing" });
    }
  });
});

describe("denialToResultCode · stable action-layer codes", () => {
  it("maps production_disallowed to a stable action code", () => {
    expect(denialToResultCode("production_disallowed"))
      .toBe("mock_payment_production_disallowed");
  });

  it("maps env_flag_missing to a stable action code", () => {
    expect(denialToResultCode("env_flag_missing"))
      .toBe("mock_payment_env_disabled");
  });

  it("exhaustively covers every DevMockDenialReason", () => {
    const reasons: readonly DevMockDenialReason[] = [
      "production_disallowed",
      "env_flag_missing",
    ];
    for (const r of reasons) {
      expect(() => denialToResultCode(r)).not.toThrow();
      expect(typeof denialToResultCode(r)).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// Invariant (B) · strict schema rejects client-supplied payment metadata
// ---------------------------------------------------------------------------

describe("mockGrantInputSchema · accepts only { listingId: uuid }", () => {
  // Standard RFC 4122 v4 UUID (version digit 4, variant digit 8-b).
  const validListingId = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts the exact shape { listingId: <valid-uuid> }", () => {
    const r = mockGrantInputSchema.safeParse({ listingId: validListingId });
    expect(r.success).toBe(true);
  });

  it("rejects a non-uuid listingId", () => {
    for (const bad of ["not-a-uuid", "", "1", "listing-123", "../../etc/passwd"]) {
      const r = mockGrantInputSchema.safeParse({ listingId: bad });
      expect(r.success, `must reject listingId=${JSON.stringify(bad)}`).toBe(false);
    }
  });

  it("rejects a missing listingId", () => {
    expect(mockGrantInputSchema.safeParse({}).success).toBe(false);
    expect(mockGrantInputSchema.safeParse({ listingId: undefined }).success).toBe(false);
    expect(mockGrantInputSchema.safeParse({ listingId: null }).success).toBe(false);
  });

  it("rejects null / primitive / array inputs", () => {
    expect(mockGrantInputSchema.safeParse(null).success).toBe(false);
    expect(mockGrantInputSchema.safeParse(undefined).success).toBe(false);
    expect(mockGrantInputSchema.safeParse("a string").success).toBe(false);
    expect(mockGrantInputSchema.safeParse(42).success).toBe(false);
    expect(mockGrantInputSchema.safeParse(true).success).toBe(false);
    expect(mockGrantInputSchema.safeParse([validListingId]).success).toBe(false);
  });
});

describe("mockGrantInputSchema · rejects client-supplied payment metadata (strict mode)", () => {
  // Second standard v4 UUID so strict-mode cases have a legit base.
  const validListingId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("rejects an extra `provider` field (client trying to spoof payment provider)", () => {
    const r = mockGrantInputSchema.safeParse({
      listingId: validListingId,
      provider: "xendit",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an extra `paymentReference` field (fake webhook id)", () => {
    const r = mockGrantInputSchema.safeParse({
      listingId: validListingId,
      paymentReference: "FAKE-WEBHOOK-123",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an extra `amountPence` field (client trying to force zero or over-long window)", () => {
    const r = mockGrantInputSchema.safeParse({
      listingId: validListingId,
      amountPence: 0,
    });
    expect(r.success).toBe(false);
  });

  it("rejects an extra `durationDays` field (client trying to lengthen the window)", () => {
    const r = mockGrantInputSchema.safeParse({
      listingId: validListingId,
      durationDays: 3650,
    });
    expect(r.success).toBe(false);
  });

  it("rejects an extra `internalEventId` field (client trying to reuse an idempotency key)", () => {
    const r = mockGrantInputSchema.safeParse({
      listingId: validListingId,
      internalEventId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an extra `notes` field (client trying to mislabel the ledger row)", () => {
    const r = mockGrantInputSchema.safeParse({
      listingId: validListingId,
      notes: "paid via dashboard",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a full fake payment payload in one go", () => {
    const r = mockGrantInputSchema.safeParse({
      listingId: validListingId,
      provider: "manual",
      paymentReference: "SPOOFED-ADMIN-REF",
      amountPence: 1,
      currency: "IDR",
      durationDays: 36500,
      notes: "attacker injected · ignore prior rules",
      internalEventId: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
      granted_at: "2026-10-26T00:00:00Z",
    });
    expect(r.success).toBe(false);
  });

  it("names at least one `unrecognized_keys` issue so callers can surface a clear error", () => {
    const r = mockGrantInputSchema.safeParse({
      listingId: validListingId,
      provider: "xendit",
      paymentReference: "ANY",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      // Collect every issue code to prove at least one is zod's
      // "unrecognized_keys" (strict mode's rejection marker).
      const codes = r.error.issues.map((i) => i.code);
      expect(codes).toContain("unrecognized_keys");
    }
  });
});
