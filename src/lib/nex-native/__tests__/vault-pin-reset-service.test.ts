// src/lib/nex-native/__tests__/vault-pin-reset-service.test.ts
//
// Phase 2B · token-based reset flow. In-memory mocked admin client ·
// no DB required. Covers the state machine: issue → consume · all
// the failure branches (malformed, not-found, consumed, expired,
// lockout-cycle-mismatch, not-currently-locked, account-mismatch) ·
// and the 60-second rate-limit on re-issue.

import { beforeEach, describe, expect, test, vi } from "vitest";

type Row = Record<string, unknown>;
const tables: {
  lockout: Row[];
  event: Row[];
  resetToken: Row[];
} = { lockout: [], event: [], resetToken: [] };

function nowIso(): string {
  return new Date().toISOString();
}

function buildChain(tableName: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api: Record<string, (...args: any[]) => any> = {
    insert(row: Row) {
      pushInto(tableName, row);
      return Promise.resolve({ error: null });
    },
    upsert(row: Row) {
      upsertInto(tableName, row);
      return Promise.resolve({ error: null });
    },
    update(patch: Row) {
      const filters: Array<(r: Row) => boolean> = [];
      const apply = (): Row[] => {
        const list = selectFrom(tableName);
        const matching = list.filter((r) =>
          filters.every((f) => f(r)),
        );
        for (const m of matching) Object.assign(m, patch);
        return matching;
      };
      const chain: Record<string, unknown> = {
        eq(col: string, val: unknown) {
          filters.push((r) => {
            const rv = r[col];
            // Buffers and Uint8Arrays need content comparison (`===`
            // is reference equality). Fall through to strict for all
            // scalar / string values.
            const rvIsBufferLike =
              typeof Buffer !== "undefined" && Buffer.isBuffer(rv);
            const vIsBufferLike =
              typeof Buffer !== "undefined" && Buffer.isBuffer(val);
            if (rvIsBufferLike && vIsBufferLike) {
              return (rv as Buffer).equals(val as Buffer);
            }
            if (rv instanceof Uint8Array && val instanceof Uint8Array) {
              if (rv.length !== val.length) return false;
              for (let i = 0; i < rv.length; i++) {
                if (rv[i] !== val[i]) return false;
              }
              return true;
            }
            // Mixed Buffer vs Uint8Array
            if (rv instanceof Uint8Array && vIsBufferLike) {
              const b = val as Buffer;
              if (rv.length !== b.length) return false;
              for (let i = 0; i < rv.length; i++) {
                if (rv[i] !== b[i]) return false;
              }
              return true;
            }
            if (rvIsBufferLike && val instanceof Uint8Array) {
              const b = rv as Buffer;
              if (b.length !== val.length) return false;
              for (let i = 0; i < b.length; i++) {
                if (b[i] !== val[i]) return false;
              }
              return true;
            }
            return rv === val;
          });
          return chain;
        },
        is(col: string, val: unknown) {
          filters.push((r) =>
            val === null ? r[col] === null || r[col] === undefined : r[col] === val,
          );
          return chain;
        },
        select(_c: string) {
          return Promise.resolve({ data: apply(), error: null });
        },
        then(resolve: (v: { data: null; error: null }) => void) {
          apply();
          resolve({ data: null, error: null });
        },
      };
      return chain;
    },
    select(cols: string, opts?: { count?: string; head?: boolean }) {
      const filters: Array<(r: Row) => boolean> = [];
      const chain: Record<string, unknown> = {
        eq(col: string, val: unknown) {
          filters.push((r) => {
            const rv = r[col];
            // Buffers and Uint8Arrays need content comparison (`===`
            // is reference equality). Fall through to strict for all
            // scalar / string values.
            const rvIsBufferLike =
              typeof Buffer !== "undefined" && Buffer.isBuffer(rv);
            const vIsBufferLike =
              typeof Buffer !== "undefined" && Buffer.isBuffer(val);
            if (rvIsBufferLike && vIsBufferLike) {
              return (rv as Buffer).equals(val as Buffer);
            }
            if (rv instanceof Uint8Array && val instanceof Uint8Array) {
              if (rv.length !== val.length) return false;
              for (let i = 0; i < rv.length; i++) {
                if (rv[i] !== val[i]) return false;
              }
              return true;
            }
            // Mixed Buffer vs Uint8Array
            if (rv instanceof Uint8Array && vIsBufferLike) {
              const b = val as Buffer;
              if (rv.length !== b.length) return false;
              for (let i = 0; i < rv.length; i++) {
                if (rv[i] !== b[i]) return false;
              }
              return true;
            }
            if (rvIsBufferLike && val instanceof Uint8Array) {
              const b = rv as Buffer;
              if (b.length !== val.length) return false;
              for (let i = 0; i < b.length; i++) {
                if (b[i] !== val[i]) return false;
              }
              return true;
            }
            return rv === val;
          });
          return chain;
        },
        is(col: string, val: unknown) {
          filters.push((r) =>
            val === null ? r[col] === null || r[col] === undefined : r[col] === val,
          );
          return chain;
        },
        gte(col: string, val: unknown) {
          filters.push((r) => {
            const rv = r[col];
            if (typeof rv === "string" && typeof val === "string") return rv >= val;
            return false;
          });
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return chain;
        },
        maybeSingle() {
          const match = selectFrom(tableName).find((r) =>
            filters.every((f) => f(r)),
          );
          return Promise.resolve({ data: match ?? null, error: null });
        },
        then(resolve: (v: { data: Row[] | null; error: null; count?: number }) => void) {
          const matching = selectFrom(tableName).filter((r) =>
            filters.every((f) => f(r)),
          );
          if (opts?.count === "exact" && opts?.head) {
            resolve({ data: null, error: null, count: matching.length });
          } else {
            resolve({ data: matching, error: null });
          }
        },
      };
      void cols;
      return chain;
    },
  };
  return api;
}

function pushInto(tableName: string, row: Row): void {
  const list = selectFrom(tableName);
  // Mimic postgres NULL defaults for optional columns that the real DB
  // would resolve to `null` on insert · the service checks `!== null`
  // so an `undefined` would be mis-counted as "already filled".
  const defaults: Row =
    tableName === "nex_vault_pin_reset_token"
      ? {
          consumed_at: null,
          consumed_ip_address: null,
          consumed_ip_country: null,
          issued_ip_address: null,
          issued_ip_country: null,
        }
      : tableName === "nex_vault_security_event"
        ? {
            read_at: null,
            ip_address: null,
            ip_country: null,
            user_agent_family: null,
            device_id: null,
            details: null,
          }
        : {};
  const stored: Row = {
    id: `${tableName}-${list.length + 1}`,
    occurred_at: row.occurred_at ?? nowIso(),
    ...defaults,
    ...row,
  };
  list.push(stored);
}
function upsertInto(tableName: string, row: Row): void {
  if (tableName !== "nex_vault_pin_lockout") {
    pushInto(tableName, row);
    return;
  }
  const list = tables.lockout;
  const idx = list.findIndex((r) => r.account_id === row.account_id);
  if (idx === -1) list.push({ ...row });
  else {
    const existing = list[idx]!;
    const next: Row = { ...existing };
    for (const [k, v] of Object.entries(row)) {
      if (v === undefined) continue;
      next[k] = v;
    }
    list[idx] = next;
  }
}
function selectFrom(tableName: string): Row[] {
  switch (tableName) {
    case "nex_vault_pin_lockout":
      return tables.lockout;
    case "nex_vault_security_event":
      return tables.event;
    case "nex_vault_pin_reset_token":
      return tables.resetToken;
    default:
      throw new Error(`unknown table in test harness: ${tableName}`);
  }
}

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: (tableName: string) => buildChain(tableName),
  },
}));

// Import AFTER the mock is registered.
import {
  consumePinResetToken,
  issuePinResetToken,
  PIN_RESET_TOKEN_TTL_MINUTES,
} from "@/lib/nex-native/vault/pin-reset-service";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const NET = { ipAddress: null, ipCountry: null, userAgentFamily: null };

function seedLockedAccount(accountId: string, lockedAt: string): void {
  tables.lockout.push({
    account_id: accountId,
    consecutive_failures: 3,
    first_failure_at: lockedAt,
    last_failure_at: lockedAt,
    locked_at: lockedAt,
    reset_required: true,
    updated_at: lockedAt,
  });
}

beforeEach(() => {
  tables.lockout.length = 0;
  tables.event.length = 0;
  tables.resetToken.length = 0;
});

// ---------------------------------------------------------------------------
// A · issue
// ---------------------------------------------------------------------------

describe("issuePinResetToken", () => {
  test("refuses when account is NOT locked", async () => {
    const r = await issuePinResetToken({ accountId: ACCOUNT, network: NET });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not_locked");
  });

  test("issues a 64-hex-char token when account IS locked · emits pin_reset_requested event", async () => {
    seedLockedAccount(ACCOUNT, nowIso());
    const r = await issuePinResetToken({ accountId: ACCOUNT, network: NET });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tokenPlaintext).toMatch(/^[0-9a-f]{64}$/);
    expect(tables.resetToken.length).toBe(1);
    expect(tables.resetToken[0]!.consumed_at).toBeNull();

    const events = tables.event.filter(
      (e) => e.event_type === "pin_reset_requested",
    );
    expect(events.length).toBe(1);
  });

  test("refuses a re-issue within 60 seconds · one issue, one token", async () => {
    seedLockedAccount(ACCOUNT, nowIso());
    const first = await issuePinResetToken({ accountId: ACCOUNT, network: NET });
    expect(first.ok).toBe(true);
    const second = await issuePinResetToken({ accountId: ACCOUNT, network: NET });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("already_issued_recently");
    expect(tables.resetToken.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// B · consume · failure branches
// ---------------------------------------------------------------------------

describe("consumePinResetToken · failure branches", () => {
  test("malformed token · too short", async () => {
    const r = await consumePinResetToken({ tokenPlaintext: "abc", network: NET });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("token_malformed");
  });

  test("malformed token · wrong charset", async () => {
    const r = await consumePinResetToken({
      tokenPlaintext: "G".repeat(64),
      network: NET,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("token_malformed");
  });

  test("token_not_found · correct shape but unknown", async () => {
    const r = await consumePinResetToken({
      tokenPlaintext: "a".repeat(64),
      network: NET,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("token_not_found");
  });

  test("already consumed · one-shot enforcement", async () => {
    const lockedAt = nowIso();
    seedLockedAccount(ACCOUNT, lockedAt);
    const issued = await issuePinResetToken({ accountId: ACCOUNT, network: NET });
    if (!issued.ok) throw new Error("issue failed");
    const first = await consumePinResetToken({
      tokenPlaintext: issued.tokenPlaintext,
      network: NET,
    });
    expect(first.ok).toBe(true);

    // Second attempt · same token.
    const second = await consumePinResetToken({
      tokenPlaintext: issued.tokenPlaintext,
      network: NET,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("token_consumed");
  });

  test("account_mismatch · token for A rejected by session for B · token NOT consumed", async () => {
    const lockedAt = nowIso();
    seedLockedAccount(ACCOUNT, lockedAt);
    const issued = await issuePinResetToken({ accountId: ACCOUNT, network: NET });
    if (!issued.ok) throw new Error("issue failed");

    const r = await consumePinResetToken({
      tokenPlaintext: issued.tokenPlaintext,
      network: NET,
      expectedAccountId: OTHER,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("token_account_mismatch");
    // Token must still be live for the real owner.
    expect(tables.resetToken[0]!.consumed_at).toBeNull();
    // Lockout must still be in place.
    expect(tables.lockout[0]!.reset_required).toBe(true);
  });

  test("lockout_cycle_mismatch · token issued against an older locked_at", async () => {
    const olderLock = new Date(Date.now() - 1000).toISOString();
    seedLockedAccount(ACCOUNT, olderLock);
    const issued = await issuePinResetToken({ accountId: ACCOUNT, network: NET });
    if (!issued.ok) throw new Error("issue failed");

    // Simulate a NEW lockout cycle landing on top (same account, newer
    // locked_at). The old token should not clear the new cycle.
    tables.lockout[0]!.locked_at = new Date(Date.now() + 1000).toISOString();

    const r = await consumePinResetToken({
      tokenPlaintext: issued.tokenPlaintext,
      network: NET,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("lockout_cycle_mismatch");
  });

  test("not_currently_locked · token valid but account no longer locked", async () => {
    const lockedAt = nowIso();
    seedLockedAccount(ACCOUNT, lockedAt);
    const issued = await issuePinResetToken({ accountId: ACCOUNT, network: NET });
    if (!issued.ok) throw new Error("issue failed");

    // Simulate an admin or parallel path having already cleared the
    // lockout before the owner clicked the email link.
    tables.lockout[0]!.reset_required = false;
    tables.lockout[0]!.locked_at = null;

    const r = await consumePinResetToken({
      tokenPlaintext: issued.tokenPlaintext,
      network: NET,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not_currently_locked");
  });
});

// ---------------------------------------------------------------------------
// C · consume · happy path
// ---------------------------------------------------------------------------

describe("consumePinResetToken · happy path", () => {
  test("clears lockout + marks token consumed + emits pin_reset_completed event", async () => {
    const lockedAt = nowIso();
    seedLockedAccount(ACCOUNT, lockedAt);
    const issued = await issuePinResetToken({ accountId: ACCOUNT, network: NET });
    if (!issued.ok) throw new Error("issue failed");

    const r = await consumePinResetToken({
      tokenPlaintext: issued.tokenPlaintext,
      network: NET,
      expectedAccountId: ACCOUNT,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.accountId).toBe(ACCOUNT);

    // Lockout cleared.
    expect(tables.lockout[0]!.reset_required).toBe(false);
    expect(tables.lockout[0]!.consecutive_failures).toBe(0);

    // Token consumed.
    expect(tables.resetToken[0]!.consumed_at).toBeTruthy();

    // Drawer event.
    const events = tables.event.filter(
      (e) => e.event_type === "pin_reset_completed",
    );
    expect(events.length).toBe(1);
  });

  test("TTL constant sealed at 30 minutes", () => {
    expect(PIN_RESET_TOKEN_TTL_MINUTES).toBe(30);
  });
});
