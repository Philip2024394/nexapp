// src/lib/nex-native/__tests__/security-audit-service.test.ts
//
// NEX Security Programme · Item 5 · audit writer regression tests.
// Owner directive 2026-11-08 · complete-build authorises these tests
// alongside the audit writer service.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const SUPABASE_STATE = vi.hoisted(() => ({
  insertResult: {
    data: null as { id: number } | null,
    error: null as { message: string } | null,
  },
  lastInsertedRow: null as Record<string, unknown> | null,
}));

vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(_table: string) {
      return {
        insert(row: Record<string, unknown>) {
          SUPABASE_STATE.lastInsertedRow = row;
          return {
            select(_cols: string) {
              return {
                maybeSingle() {
                  return Promise.resolve({
                    data: SUPABASE_STATE.insertResult.data,
                    error: SUPABASE_STATE.insertResult.error,
                  });
                },
              };
            },
          };
        },
      };
    },
  },
}));

import {
  AuditWriteError,
  SECURITY_AUDIT_EVENTS,
  generateErasedActorIdentity,
  isAuditWriteError,
  recordAuditEvent,
} from "../security-audit-service";

function makeInsertSucceed(id = 1): void {
  SUPABASE_STATE.insertResult = { data: { id }, error: null };
}

function makeInsertFail(message = "connection reset"): void {
  SUPABASE_STATE.insertResult = { data: null, error: { message } };
}

const ACCOUNT_ID = "00000000-0000-0000-0000-000000000042";

describe("SECURITY_AUDIT_EVENTS catalog", () => {
  it("every event has a description, metadata allow-list, and fail policy", () => {
    for (const [event, spec] of Object.entries(SECURITY_AUDIT_EVENTS)) {
      expect(event, `${event} name shape`).toMatch(/^[a-z][a-z0-9_]{2,}\./);
      expect(spec.description.length, `${event} description`).toBeGreaterThan(5);
      expect(Array.isArray(spec.allowedMetadataKeys)).toBe(true);
      expect(
        ["fail-loud", "fail-open"].includes(spec.onWriteFailure),
      ).toBe(true);
    }
  });

  it("sensitive events use fail-loud policy", () => {
    const expectedFailLoud = [
      "security.account.sign_up.attempted",
      "security.account.sign_up.completed",
      "security.password_change.attempted",
      "security.password_change.completed",
      "security.session_revoke_all.attempted",
      "security.session_revoke_all.completed",
      "security.session_revoke_all.failed",
      "security.webauthn.enroll.attempted",
      "security.webauthn.enroll.completed",
      "security.hq.pages.delete_queue.completed",
      "security.account.delete.attempted",
      "security.account.delete.completed",
      "security.account.delete.failed",
    ];
    for (const event of expectedFailLoud) {
      expect(
        SECURITY_AUDIT_EVENTS[event]?.onWriteFailure,
        `${event} should be fail-loud`,
      ).toBe("fail-loud");
    }
  });

  it("denied events use fail-open policy", () => {
    for (const [event, spec] of Object.entries(SECURITY_AUDIT_EVENTS)) {
      if (event.endsWith(".denied")) {
        expect(spec.onWriteFailure, `${event} should be fail-open`).toBe(
          "fail-open",
        );
      }
    }
  });
});

describe("recordAuditEvent · happy path", () => {
  beforeEach(() => {
    SUPABASE_STATE.lastInsertedRow = null;
    makeInsertSucceed(42);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("inserts a well-formed row + returns ok=true with logId", async () => {
    const r = await recordAuditEvent({
      event: "security.password_change.completed",
      outcome: "completed",
      actorAccountId: ACCOUNT_ID,
      actorIdentity: `acct:${ACCOUNT_ID}`,
      targetType: "nex_account",
      targetId: ACCOUNT_ID,
      metadata: { sessions_invalidated_at: "2026-11-08T07:00:00Z" },
    });
    expect(r.ok).toBe(true);
    expect(r.logId).toBe(42);
    expect(SUPABASE_STATE.lastInsertedRow).toMatchObject({
      event: "security.password_change.completed",
      outcome: "completed",
      actor_account_id: ACCOUNT_ID,
      actor_identity: `acct:${ACCOUNT_ID}`,
      target_type: "nex_account",
      target_id: ACCOUNT_ID,
    });
    expect(
      (SUPABASE_STATE.lastInsertedRow!.metadata as Record<string, unknown>)
        .sessions_invalidated_at,
    ).toBe("2026-11-08T07:00:00Z");
  });

  it("denied events accept retry_after_seconds in metadata", async () => {
    const r = await recordAuditEvent({
      event: "security.password_change.denied",
      outcome: "denied",
      actorAccountId: ACCOUNT_ID,
      metadata: { reason: "rate_limited" },
    });
    expect(r.ok).toBe(true);
  });
});

describe("recordAuditEvent · metadata sanitisation", () => {
  beforeEach(() => {
    SUPABASE_STATE.lastInsertedRow = null;
    makeInsertSucceed();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("strips prohibited keys (passwords, tokens, IPs) even if the allow-list contained them", async () => {
    await recordAuditEvent({
      event: "security.password_change.failed",
      outcome: "failed",
      actorAccountId: ACCOUNT_ID,
      // error_code is in the allow-list. The password/token/ip keys
      // are PROHIBITED categorically.
      metadata: {
        error_code: "invalid_input",
        password: "supersecret",
        access_token: "eyJhbGci...",
        raw_ip: "198.51.100.1",
      },
    });
    const meta = SUPABASE_STATE.lastInsertedRow!.metadata as Record<string, unknown>;
    expect(meta.error_code).toBe("invalid_input");
    expect(meta.password).toBeUndefined();
    expect(meta.access_token).toBeUndefined();
    expect(meta.raw_ip).toBeUndefined();
  });

  it("strips keys not in the event's allow-list", async () => {
    await recordAuditEvent({
      event: "security.password_change.completed",
      outcome: "completed",
      actorAccountId: ACCOUNT_ID,
      metadata: {
        sessions_invalidated_at: "2026-11-08T07:00:00Z",
        unexpected_key: "should be stripped",
      },
    });
    const meta = SUPABASE_STATE.lastInsertedRow!.metadata as Record<string, unknown>;
    expect(meta.sessions_invalidated_at).toBe("2026-11-08T07:00:00Z");
    expect(meta.unexpected_key).toBeUndefined();
  });

  it("empty metadata stays empty · defaults to {}", async () => {
    await recordAuditEvent({
      event: "security.session_revoke.completed",
      outcome: "completed",
      actorAccountId: ACCOUNT_ID,
    });
    expect(SUPABASE_STATE.lastInsertedRow!.metadata).toEqual({});
  });
});

describe("recordAuditEvent · input validation", () => {
  beforeEach(() => {
    SUPABASE_STATE.lastInsertedRow = null;
    makeInsertSucceed();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("unknown event → returns ok=false with skipped='catalog_miss' (no insert)", async () => {
    const r = await recordAuditEvent({
      event: "security.unknown.event",
      outcome: "completed",
    });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("catalog_miss");
    expect(SUPABASE_STATE.lastInsertedRow).toBeNull();
  });

  it("malformed actorAccountId → throws", async () => {
    await expect(
      recordAuditEvent({
        event: "security.password_change.completed",
        outcome: "completed",
        actorAccountId: "not-a-uuid",
      }),
    ).rejects.toThrow(/actorAccountId must be a UUID/);
  });

  it("malformed actorIdentity → throws", async () => {
    await expect(
      recordAuditEvent({
        event: "security.account.sign_up.attempted",
        outcome: "attempted",
        actorIdentity: "garbage-not-colon-shape",
      }),
    ).rejects.toThrow(/actorIdentity must match/);
  });

  it("accepts erased: identity shape (post-GDPR deletion)", async () => {
    const erased = generateErasedActorIdentity();
    expect(erased).toMatch(/^erased:[a-f0-9]{32}$/);
    const r = await recordAuditEvent({
      event: "security.account.sign_up.completed",
      outcome: "completed",
      actorIdentity: erased,
    });
    expect(r.ok).toBe(true);
  });

  it("invalid outcome → throws", async () => {
    await expect(
      recordAuditEvent({
        event: "security.password_change.completed",
        // @ts-expect-error · deliberate invalid outcome
        outcome: "maybe_worked",
      }),
    ).rejects.toThrow(/invalid outcome/);
  });
});

describe("recordAuditEvent · fail-loud vs fail-open", () => {
  beforeEach(() => {
    SUPABASE_STATE.lastInsertedRow = null;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("fail-loud event + DB error → throws AuditWriteError", async () => {
    makeInsertFail("statement timeout");
    try {
      await recordAuditEvent({
        event: "security.password_change.completed",
        outcome: "completed",
        actorAccountId: ACCOUNT_ID,
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(isAuditWriteError(err)).toBe(true);
      const e = err as AuditWriteError;
      expect(e.event).toBe("security.password_change.completed");
      expect(e.phase).toBe("completion");
    }
  });

  it("fail-loud attempted event + DB error → throws with phase='attempted'", async () => {
    makeInsertFail();
    try {
      await recordAuditEvent({
        event: "security.password_change.attempted",
        outcome: "attempted",
        actorAccountId: ACCOUNT_ID,
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(isAuditWriteError(err)).toBe(true);
      const e = err as AuditWriteError;
      expect(e.phase).toBe("attempted");
    }
  });

  it("fail-open event + DB error → returns { ok: false, skipped: 'write_failed_fail_open' }", async () => {
    makeInsertFail();
    const r = await recordAuditEvent({
      event: "security.password_change.denied",
      outcome: "denied",
      actorAccountId: ACCOUNT_ID,
      metadata: { reason: "rate_limited" },
    });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("write_failed_fail_open");
  });
});

describe("generateErasedActorIdentity", () => {
  it("produces a unique erased:<random> identity each call", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = generateErasedActorIdentity();
      expect(id).toMatch(/^erased:[a-f0-9]{32}$/);
      seen.add(id);
    }
    expect(seen.size).toBe(100);
  });
});
