// src/lib/nex-native/emergency/__tests__/security-core.test.ts
//
// NEX Emergency Help · security-core unit tests.
// Owner-authorised 2026-10-25 (Phase E of the continuous-build plan).
//
// Covers:
//   · KMS mock adapter · key generation + wrap + unwrap + rotation
//   · AES-256-GCM envelope encryption · roundtrip + tampering + wrong key
//   · Rate limiter · boundary + 21st read + reset + concurrent window
//   · Disclosure gate · all 6 preconditions + fail-closed + scope filter

import { describe, it, expect } from "vitest";
import {
  createMockKmsAdapter,
  type KmsAdapter,
} from "../_kms";
import {
  encryptEmergencyField,
  encryptEmergencyString,
  decryptEmergencyField,
  decryptEmergencyString,
  readEnvelopeMasterKeyVersion,
  EMERGENCY_CRYPTO_VERSION,
} from "../_crypto";
import {
  createInMemoryRateLimiter,
  EMERGENCY_READS_PER_HOUR_LIMIT,
} from "../_rate-limit";
import {
  evaluateDisclosureGate,
  type GateInput,
} from "../_disclosure-gate";
import type { AccountId, IncidentId } from "../_server-action-contract";

// ─── KMS mock adapter ───────────────────────────────────────────────

describe("Mock KMS adapter", () => {
  it("generates a 32-byte plaintext data key and wraps it", async () => {
    const kms = createMockKmsAdapter();
    const dk = await kms.generateDataKey();
    expect(dk.plaintext.length).toBe(32);
    expect(dk.ciphertext.length).toBeGreaterThan(32); // wrapped includes iv+tag+ct
    expect(dk.masterKeyVersion).toBe(1);
  });

  it("unwraps a wrapped data key back to its original plaintext", async () => {
    const kms = createMockKmsAdapter();
    const dk = await kms.generateDataKey();
    const originalCopy = new Uint8Array(dk.plaintext); // copy before zeroise
    const unwrapped = await kms.unwrapDataKey(
      dk.ciphertext,
      dk.masterKeyVersion,
    );
    expect(unwrapped.length).toBe(32);
    expect(Buffer.from(unwrapped).equals(Buffer.from(originalCopy))).toBe(true);
  });

  it("rotates master key · new version wraps new data keys", async () => {
    const kms = createMockKmsAdapter();
    const dkV1 = await kms.generateDataKey();
    expect(dkV1.masterKeyVersion).toBe(1);
    const v2 = await kms.rotateMasterKey();
    expect(v2).toBe(2);
    expect(kms.currentMasterKeyVersion()).toBe(2);
    const dkV2 = await kms.generateDataKey();
    expect(dkV2.masterKeyVersion).toBe(2);
  });

  it("unwraps v1 data keys even after rotation to v2 (backward compat)", async () => {
    const kms = createMockKmsAdapter();
    const dkV1 = await kms.generateDataKey();
    const originalCopy = new Uint8Array(dkV1.plaintext);
    await kms.rotateMasterKey();
    const unwrapped = await kms.unwrapDataKey(
      dkV1.ciphertext,
      dkV1.masterKeyVersion,
    );
    expect(Buffer.from(unwrapped).equals(Buffer.from(originalCopy))).toBe(true);
  });

  it("refuses to unwrap with an unknown master-key version", async () => {
    const kms = createMockKmsAdapter();
    const dk = await kms.generateDataKey();
    await expect(
      kms.unwrapDataKey(dk.ciphertext, 999),
    ).rejects.toThrow(/not available/);
  });

  it("seeded mock is deterministic across instances", async () => {
    const seed = new Uint8Array([1, 2, 3, 4, 5]);
    const kmsA = createMockKmsAdapter(seed);
    const kmsB = createMockKmsAdapter(seed);
    const dkA = await kmsA.generateDataKey();
    const dkB = await kmsB.generateDataKey();
    // Different data keys (random) but same master key under both →
    // kmsB can unwrap kmsA's wrapped data key.
    const unwrapped = await kmsB.unwrapDataKey(
      dkA.ciphertext,
      dkA.masterKeyVersion,
    );
    expect(unwrapped.length).toBe(32);
  });
});

// ─── AES-256-GCM envelope encryption ────────────────────────────────

describe("Emergency crypto · envelope encryption", () => {
  async function freshKms(): Promise<KmsAdapter> {
    return createMockKmsAdapter(new Uint8Array([42]));
  }

  it("roundtrips a string through encrypt + decrypt", async () => {
    const kms = await freshKms();
    const plaintext = "Jane Doe · DOB 2019-05-18 · Jl. Malioboro 12";
    const envelope = await encryptEmergencyString(plaintext, kms);
    const decoded = await decryptEmergencyString(envelope, kms);
    expect(decoded).toBe(plaintext);
  });

  it("produces a self-describing envelope (version byte + lengths)", async () => {
    const kms = await freshKms();
    const envelope = await encryptEmergencyString("hi", kms);
    expect(envelope[0]).toBe(EMERGENCY_CRYPTO_VERSION);
    expect(readEnvelopeMasterKeyVersion(envelope)).toBe(1);
  });

  it("rejects a tampered ciphertext (auth tag integrity)", async () => {
    const kms = await freshKms();
    const envelope = await encryptEmergencyString("secret", kms);
    // Flip a byte somewhere in the ciphertext region (post-IV/tag).
    const tampered = new Uint8Array(envelope);
    tampered[tampered.length - 1] ^= 0x01;
    await expect(decryptEmergencyField(tampered, kms)).rejects.toThrow();
  });

  it("rejects an envelope with a tampered auth tag", async () => {
    const kms = await freshKms();
    const envelope = await encryptEmergencyString("secret", kms);
    const tampered = new Uint8Array(envelope);
    // Header is 5 bytes · wrapped_key_length tells us how far wrapped
    // key goes · tag follows IV (12 bytes). We just flip whatever is
    // around the middle · auth-tag OR wrapped-key tamper both should
    // fail integrity.
    const mid = Math.floor(tampered.length / 2);
    tampered[mid] ^= 0xff;
    await expect(decryptEmergencyField(tampered, kms)).rejects.toThrow();
  });

  it("rejects an envelope with an unsupported version byte", async () => {
    const kms = await freshKms();
    const envelope = await encryptEmergencyString("secret", kms);
    const bad = new Uint8Array(envelope);
    bad[0] = 0xff;
    await expect(decryptEmergencyField(bad, kms)).rejects.toThrow(
      /unsupported version/,
    );
  });

  it("decrypts a v1 envelope after a key rotation (master-key version in header)", async () => {
    const kms = createMockKmsAdapter(new Uint8Array([7]));
    const envelope = await encryptEmergencyString("before rotation", kms);
    await kms.rotateMasterKey();
    const decoded = await decryptEmergencyString(envelope, kms);
    expect(decoded).toBe("before rotation");
  });

  it("fails under a KMS that doesn't have the needed master-key version", async () => {
    // Different seed → different master key → cannot unwrap.
    const kmsA = createMockKmsAdapter(new Uint8Array([1]));
    const kmsB = createMockKmsAdapter(new Uint8Array([2]));
    const envelope = await encryptEmergencyString("secret", kmsA);
    await expect(decryptEmergencyField(envelope, kmsB)).rejects.toThrow();
  });

  it("binary roundtrip preserves raw bytes exactly", async () => {
    const kms = await freshKms();
    const raw = new Uint8Array([0, 1, 2, 255, 128, 64, 0xde, 0xad, 0xbe, 0xef]);
    const envelope = await encryptEmergencyField(raw, kms);
    const back = await decryptEmergencyField(envelope, kms);
    expect(Array.from(back)).toEqual(Array.from(raw));
  });

  it("two encryptions of the same plaintext produce different envelopes (fresh IV + data key)", async () => {
    const kms = await freshKms();
    const a = await encryptEmergencyString("same", kms);
    const b = await encryptEmergencyString("same", kms);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });
});

// ─── Rate limiter ───────────────────────────────────────────────────

describe("In-memory rate limiter", () => {
  const key = {
    readerAccountId: "reader-1",
    profileAccountId: "profile-1",
  };

  it("allows up to the limit and blocks the one after", async () => {
    const limiter = createInMemoryRateLimiter();
    for (let i = 1; i <= EMERGENCY_READS_PER_HOUR_LIMIT; i++) {
      const r = await limiter.recordAttempt(key);
      expect(r.allowed).toBe(true);
      expect(r.readsSoFarInWindow).toBe(i);
    }
    const over = await limiter.recordAttempt(key);
    expect(over.allowed).toBe(false);
    expect(over.readsSoFarInWindow).toBe(EMERGENCY_READS_PER_HOUR_LIMIT);
  });

  it("peek does not increment", async () => {
    const limiter = createInMemoryRateLimiter();
    await limiter.recordAttempt(key);
    const peek1 = await limiter.peek(key);
    const peek2 = await limiter.peek(key);
    expect(peek1).toBe(1);
    expect(peek2).toBe(1);
  });

  it("different reader/profile pairs do not interfere", async () => {
    const limiter = createInMemoryRateLimiter({ limit: 2 });
    const a = { readerAccountId: "r1", profileAccountId: "p1" };
    const b = { readerAccountId: "r1", profileAccountId: "p2" };
    const c = { readerAccountId: "r2", profileAccountId: "p1" };
    await limiter.recordAttempt(a);
    await limiter.recordAttempt(a);
    expect((await limiter.recordAttempt(a)).allowed).toBe(false);
    expect((await limiter.recordAttempt(b)).allowed).toBe(true);
    expect((await limiter.recordAttempt(c)).allowed).toBe(true);
  });

  it("rolls to a fresh window on the next hour boundary", async () => {
    const limiter = createInMemoryRateLimiter({ limit: 2 });
    const base = 1_700_000_000_000; // arbitrary ms past epoch
    await limiter.recordAttempt(key, base);
    await limiter.recordAttempt(key, base);
    expect((await limiter.recordAttempt(key, base)).allowed).toBe(false);
    // Next hour window
    const next = base + 3_600_000;
    const after = await limiter.recordAttempt(key, next);
    expect(after.allowed).toBe(true);
    expect(after.readsSoFarInWindow).toBe(1);
  });

  it("reset clears the counter for a key", async () => {
    const limiter = createInMemoryRateLimiter({ limit: 1 });
    await limiter.recordAttempt(key);
    expect((await limiter.recordAttempt(key)).allowed).toBe(false);
    await limiter.reset(key);
    const r = await limiter.recordAttempt(key);
    expect(r.allowed).toBe(true);
  });
});

// ─── Disclosure gate ────────────────────────────────────────────────

describe("Disclosure gate · 6-point fail-closed enforcement", () => {
  const requester = "req-1" as AccountId;
  const caller = "caller-1" as AccountId;
  const incidentId = "incident-1" as IncidentId;

  function baseAllowedInput(): GateInput {
    const now = 1_700_000_000_000;
    return {
      nowMs: now,
      flagLive: true,
      incident: {
        incidentId,
        state: "active",
        startedAtMs: now - 60_000, // 1 min ago
        requesterAccountId: requester,
      },
      profile: {
        profileAccountId: requester,
        ownerAccountId: requester,
        isGuardianManaged: false,
        guardianAccountId: null,
      },
      caller: {
        callerAccountId: caller,
        layer: "trusted",
      },
      requestedScope: "trusted",
      rateLimitAllowed: true,
      auditInsertAllowed: true,
    };
  }

  it("allows when every precondition passes", () => {
    const d = evaluateDisclosureGate(baseAllowedInput());
    expect(d.outcome).toBe("allow");
    if (d.outcome === "allow") expect(d.scope).toBe("trusted");
  });

  it("denies when the feature flag is off (nothing else matters)", () => {
    const base = baseAllowedInput();
    const d = evaluateDisclosureGate({ ...base, flagLive: false });
    expect(d.outcome).toBe("deny");
    if (d.outcome === "deny") expect(d.reason).toBe("feature_not_live");
  });

  it("denies when incident is not active", () => {
    const base = baseAllowedInput();
    const d = evaluateDisclosureGate({
      ...base,
      incident: { ...base.incident, state: "resolved" },
    });
    expect(d.outcome).toBe("deny");
    if (d.outcome === "deny") expect(d.reason).toBe("incident_not_active");
  });

  it("denies when incident is older than 24h", () => {
    const base = baseAllowedInput();
    const d = evaluateDisclosureGate({
      ...base,
      incident: {
        ...base.incident,
        startedAtMs: base.nowMs - 25 * 60 * 60 * 1000,
      },
    });
    expect(d.outcome).toBe("deny");
    if (d.outcome === "deny") expect(d.reason).toBe("incident_outside_window");
  });

  it("denies when the profile owner is not the incident requester", () => {
    const base = baseAllowedInput();
    const d = evaluateDisclosureGate({
      ...base,
      profile: {
        ...base.profile,
        ownerAccountId: "someone-else" as AccountId,
      },
    });
    expect(d.outcome).toBe("deny");
    if (d.outcome === "deny") expect(d.reason).toBe("profile_owner_mismatch");
  });

  it("allows for a Model-A minor when the guardian is the requester", () => {
    const base = baseAllowedInput();
    const guardian = "guardian-1" as AccountId;
    const child = "child-1" as AccountId;
    const d = evaluateDisclosureGate({
      ...base,
      incident: { ...base.incident, requesterAccountId: guardian },
      profile: {
        profileAccountId: child,
        ownerAccountId: child,
        isGuardianManaged: true,
        guardianAccountId: guardian,
      },
    });
    expect(d.outcome).toBe("allow");
  });

  it("denies when caller has no entitlement layer", () => {
    const base = baseAllowedInput();
    const d = evaluateDisclosureGate({
      ...base,
      caller: { ...base.caller, layer: "none" },
    });
    expect(d.outcome).toBe("deny");
    if (d.outcome === "deny") expect(d.reason).toBe("caller_not_entitled");
  });

  it("denies when the requested scope exceeds the caller's layer", () => {
    const base = baseAllowedInput();
    const d = evaluateDisclosureGate({
      ...base,
      caller: { ...base.caller, layer: "near_responder" },
      requestedScope: "trusted",
    });
    expect(d.outcome).toBe("deny");
    if (d.outcome === "deny")
      expect(d.reason).toBe("scope_not_permitted_for_layer");
  });

  it("allows public_alert for a public_alert layer caller", () => {
    const base = baseAllowedInput();
    const d = evaluateDisclosureGate({
      ...base,
      caller: { ...base.caller, layer: "public_alert" },
      requestedScope: "public_alert",
    });
    expect(d.outcome).toBe("allow");
  });

  it("denies when rate limit is exceeded", () => {
    const base = baseAllowedInput();
    const d = evaluateDisclosureGate({ ...base, rateLimitAllowed: false });
    expect(d.outcome).toBe("deny");
    if (d.outcome === "deny") expect(d.reason).toBe("rate_limit_exceeded");
  });

  it("denies when the atomic audit insert fails (fail-closed)", () => {
    const base = baseAllowedInput();
    const d = evaluateDisclosureGate({ ...base, auditInsertAllowed: false });
    expect(d.outcome).toBe("deny");
    if (d.outcome === "deny") expect(d.reason).toBe("audit_insert_failed");
  });

  it("reports the first failing precondition in sealed order", () => {
    // Multiple failures: incident expired AND rate-limit over · the
    // sealed order checks the flag → active → in-window first, so
    // the reason returned is the window check, not the rate limit.
    const base = baseAllowedInput();
    const d = evaluateDisclosureGate({
      ...base,
      incident: {
        ...base.incident,
        startedAtMs: base.nowMs - 48 * 60 * 60 * 1000,
      },
      rateLimitAllowed: false,
    });
    expect(d.outcome).toBe("deny");
    if (d.outcome === "deny") {
      expect(d.reason).toBe("incident_outside_window");
      expect(d.checksFailed).toContain("incidentInWindow");
      expect(d.checksFailed).toContain("rateLimitOk");
    }
  });

  it("denies a child-initiated read for a guardian-managed profile (sealed carve-out)", () => {
    // Model A sealed decision #1: "A child cannot independently
    // activate or manage the profile unless NEX later explicitly
    // approves that capability." Until that approval lands, the
    // gate denies.
    const base = baseAllowedInput();
    const guardian = "guardian-1" as AccountId;
    const child = "child-1" as AccountId;
    const d = evaluateDisclosureGate({
      ...base,
      incident: { ...base.incident, requesterAccountId: child }, // child-initiated
      profile: {
        profileAccountId: child,
        ownerAccountId: child,
        isGuardianManaged: true,
        guardianAccountId: guardian,
      },
    });
    expect(d.outcome).toBe("deny");
    if (d.outcome === "deny") expect(d.reason).toBe("profile_owner_mismatch");
  });
});
