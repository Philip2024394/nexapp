// src/lib/nex-native/__tests__/vault-security-service.test.ts
//
// Phase 1 of the Vault escrow + lockout + notifications system.
// Pure in-memory test of the service layer's lockout state machine
// and attempt/event recording · no DB required. Uses a mocked
// nexSupabaseAdmin that captures writes and replays reads.

import { beforeEach, describe, expect, test, vi } from "vitest";

// ---- Mock the admin client before the service imports it. ----
type Row = Record<string, unknown>;
const tables: {
  pinAttempt: Row[];
  lockout: Row[];
  event: Row[];
} = { pinAttempt: [], lockout: [], event: [] };

function buildChain(tableName: string) {
  // Lazy chain object · returns thenable-style results as the service
  // expects. We implement just the subset used: .from().insert(),
  // .select().eq().maybeSingle(), .upsert({ onConflict }), .update().eq()
  // .is().select(), .select({count, head}).eq().is().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api: Record<string, (...args: any[]) => any> = {
    insert(row: Row) {
      pushInto(tableName, row);
      return Promise.resolve({ error: null });
    },
    upsert(row: Row, _opts: { onConflict?: string }) {
      upsertInto(tableName, row);
      return Promise.resolve({ error: null });
    },
    update(patch: Row) {
      // Return a chain that collects `.eq`/`.is` filters then applies.
      const filters: Array<(r: Row) => boolean> = [];
      const chain: Record<string, unknown> = {
        eq(col: string, val: unknown) {
          filters.push((r) => r[col] === val);
          return chain;
        },
        is(col: string, val: unknown) {
          // Postgres `IS NULL` matches both missing and explicit null.
          filters.push((r) =>
            val === null ? r[col] === null || r[col] === undefined : r[col] === val,
          );
          return chain;
        },
        select(_: string) {
          const list = selectFrom(tableName);
          const matching = list.filter((r) =>
            filters.every((f) => f(r)),
          );
          for (const m of matching) {
            Object.assign(m, patch);
          }
          return Promise.resolve({ data: matching, error: null });
        },
        then(resolve: (v: { data: null; error: null }) => void) {
          // Service-code variant that awaits .update().eq().eq() without
          // calling .select() · just apply the patch and resolve.
          const list = selectFrom(tableName);
          const matching = list.filter((r) =>
            filters.every((f) => f(r)),
          );
          for (const m of matching) Object.assign(m, patch);
          resolve({ data: null, error: null });
        },
      };
      return chain;
    },
    select(cols: string, opts?: { count?: string; head?: boolean }) {
      const filters: Array<(r: Row) => boolean> = [];
      const chain: Record<string, unknown> = {
        eq(col: string, val: unknown) {
          filters.push((r) => r[col] === val);
          return chain;
        },
        is(col: string, val: unknown) {
          // Postgres `IS NULL` matches both missing and explicit null.
          filters.push((r) =>
            val === null ? r[col] === null || r[col] === undefined : r[col] === val,
          );
          return chain;
        },
        order(_col: string, _o: { ascending: boolean }) {
          return chain;
        },
        limit(_: number) {
          return chain;
        },
        maybeSingle() {
          const match = selectFrom(tableName).find((r) =>
            filters.every((f) => f(r)),
          );
          return Promise.resolve({ data: match ?? null, error: null });
        },
        then(resolve: (v: { data: Row[] | null; error: null; count?: number }) => void) {
          // Act as a thenable when the service awaits the chain directly
          // (used by the list + count paths).
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
  list.push({
    id: `${tableName}-${list.length + 1}`,
    occurred_at: row.occurred_at ?? new Date().toISOString(),
    ...row,
  });
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
    // Preserve existing first_failure_at if the patch sets it to
    // undefined (service layer uses this pattern to mean "don't touch").
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
    case "nex_vault_pin_attempt":
      return tables.pinAttempt;
    case "nex_vault_pin_lockout":
      return tables.lockout;
    case "nex_vault_security_event":
      return tables.event;
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
  VAULT_PIN_LOCKOUT_THRESHOLD,
  annotatePinAttemptContext,
  bumpLockoutOnFailure,
  clearLockoutAfterReset,
  clearLockoutOnSuccess,
  countUnreadSecurityEvents,
  createSecurityEvent,
  emitPinAttemptEvent,
  getLockoutStatus,
  listRecentSecurityEvents,
  markAllSecurityEventsRead,
} from "@/lib/nex-native/vault/security-service";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const DEVICE = "device-abc12345";
const NET = {
  ipAddress: "203.0.113.42",
  ipCountry: "IE",
  userAgentFamily: "Chrome",
};

beforeEach(() => {
  tables.pinAttempt.length = 0;
  tables.lockout.length = 0;
  tables.event.length = 0;
});

// ---------------------------------------------------------------------------
// A · threshold
// ---------------------------------------------------------------------------

test("threshold is sealed at 3 strikes", () => {
  expect(VAULT_PIN_LOCKOUT_THRESHOLD).toBe(3);
});

// ---------------------------------------------------------------------------
// B · lockout counter
// ---------------------------------------------------------------------------

describe("lockout state machine", () => {
  test("starts clean · no row · 3 attempts remaining", async () => {
    const status = await getLockoutStatus(ACCOUNT);
    expect(status).toEqual({
      consecutiveFailures: 0,
      attemptsRemaining: 3,
      locked: false,
      resetRequired: false,
      lockedAt: null,
      lastFailureAt: null,
    });
  });

  test("first failure · counter 1 · 2 remaining · not locked", async () => {
    const status = await bumpLockoutOnFailure({
      accountId: ACCOUNT,
      network: NET,
    });
    expect(status.consecutiveFailures).toBe(1);
    expect(status.attemptsRemaining).toBe(2);
    expect(status.locked).toBe(false);
    expect(status.resetRequired).toBe(false);
  });

  test("third consecutive failure locks the account AND emits lockout_triggered", async () => {
    await bumpLockoutOnFailure({ accountId: ACCOUNT, network: NET });
    await bumpLockoutOnFailure({ accountId: ACCOUNT, network: NET });
    const status = await bumpLockoutOnFailure({
      accountId: ACCOUNT,
      network: NET,
    });
    expect(status.consecutiveFailures).toBe(3);
    expect(status.attemptsRemaining).toBe(0);
    expect(status.locked).toBe(true);
    expect(status.resetRequired).toBe(true);
    expect(status.lockedAt).not.toBeNull();

    const events = tables.event.filter(
      (e) => e.event_type === "lockout_triggered",
    );
    expect(events.length).toBe(1);
    expect(events[0]!.account_id).toBe(ACCOUNT);
  });

  test("lockout_triggered is NOT re-emitted on further failures past the threshold", async () => {
    for (let i = 0; i < 5; i++) {
      await bumpLockoutOnFailure({ accountId: ACCOUNT, network: NET });
    }
    const events = tables.event.filter(
      (e) => e.event_type === "lockout_triggered",
    );
    expect(events.length).toBe(1);
  });

  test("clearLockoutOnSuccess zeros the counter but preserves reset_required if already set", async () => {
    for (let i = 0; i < 3; i++) {
      await bumpLockoutOnFailure({ accountId: ACCOUNT, network: NET });
    }
    await clearLockoutOnSuccess(ACCOUNT);
    const status = await getLockoutStatus(ACCOUNT);
    expect(status.consecutiveFailures).toBe(0);
    expect(status.resetRequired).toBe(true);
    expect(status.locked).toBe(true); // still locked via reset_required
  });

  test("clearLockoutAfterReset frees both counter AND reset_required", async () => {
    for (let i = 0; i < 3; i++) {
      await bumpLockoutOnFailure({ accountId: ACCOUNT, network: NET });
    }
    await clearLockoutAfterReset(ACCOUNT);
    const status = await getLockoutStatus(ACCOUNT);
    expect(status.consecutiveFailures).toBe(0);
    expect(status.resetRequired).toBe(false);
    expect(status.locked).toBe(false);
    expect(status.attemptsRemaining).toBe(3);
  });

  test("account scoping · one account's failures do not affect another", async () => {
    const OTHER = "22222222-2222-4222-8222-222222222222";
    await bumpLockoutOnFailure({ accountId: ACCOUNT, network: NET });
    await bumpLockoutOnFailure({ accountId: ACCOUNT, network: NET });
    const sameAccount = await getLockoutStatus(ACCOUNT);
    const otherAccount = await getLockoutStatus(OTHER);
    expect(sameAccount.consecutiveFailures).toBe(2);
    expect(otherAccount.consecutiveFailures).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// C · attempt recording + drawer events
// ---------------------------------------------------------------------------

describe("emitPinAttemptEvent + annotatePinAttemptContext", () => {
  test("failed attempt emits pin_attempt_failed drawer event", async () => {
    await emitPinAttemptEvent({
      accountId: ACCOUNT,
      deviceId: DEVICE,
      success: false,
      source: "device_pin",
      network: NET,
    });
    expect(tables.event.length).toBe(1);
    expect(tables.event[0]!.event_type).toBe("pin_attempt_failed");
    expect(tables.event[0]!.ip_country).toBe("IE");
  });

  test("successful attempt on known device emits NOTHING (no drawer spam)", async () => {
    await emitPinAttemptEvent({
      accountId: ACCOUNT,
      deviceId: DEVICE,
      success: true,
      source: "device_pin",
      network: NET,
      isNewDevice: false,
    });
    expect(tables.event.length).toBe(0);
  });

  test("successful attempt on NEW device emits pin_attempt_success_new_device", async () => {
    await emitPinAttemptEvent({
      accountId: ACCOUNT,
      deviceId: DEVICE,
      success: true,
      source: "account_pin_escrow",
      network: NET,
      isNewDevice: true,
    });
    expect(tables.event.length).toBe(1);
    expect(tables.event[0]!.event_type).toBe(
      "pin_attempt_success_new_device",
    );
  });

  test("annotatePinAttemptContext patches the most-recent uncontextualised row", async () => {
    // Simulate the sealed recordPinAttempt having already inserted a bare row.
    tables.pinAttempt.push({
      id: "attempt-1",
      account_id: ACCOUNT,
      device_id: DEVICE,
      success: false,
      attempted_at: new Date().toISOString(),
    });
    await annotatePinAttemptContext({
      accountId: ACCOUNT,
      deviceId: DEVICE,
      success: false,
      source: "account_pin_escrow",
      network: NET,
    });
    const row = tables.pinAttempt[0]!;
    expect(row.ip_country).toBe("IE");
    expect(row.user_agent_family).toBe("Chrome");
    expect(row.attempt_source).toBe("account_pin_escrow");
  });
});

// ---------------------------------------------------------------------------
// D · security event feed
// ---------------------------------------------------------------------------

describe("security event feed", () => {
  test("list + count + markAllRead happy path · scoped to account", async () => {
    await createSecurityEvent({
      accountId: ACCOUNT,
      type: "device_approved",
      network: NET,
      deviceId: DEVICE,
    });
    await createSecurityEvent({
      accountId: ACCOUNT,
      type: "pin_reset_requested",
      network: NET,
    });

    const unreadBefore = await countUnreadSecurityEvents({ accountId: ACCOUNT });
    expect(unreadBefore).toBe(2);

    const list = await listRecentSecurityEvents({ accountId: ACCOUNT });
    expect(list.length).toBe(2);
    for (const row of list) {
      expect(row.readAt).toBeNull();
    }

    const marked = await markAllSecurityEventsRead({ accountId: ACCOUNT });
    expect(marked).toBe(2);

    const unreadAfter = await countUnreadSecurityEvents({ accountId: ACCOUNT });
    expect(unreadAfter).toBe(0);
  });

  test("cross-account isolation · markRead on account A does not touch account B", async () => {
    const OTHER = "22222222-2222-4222-8222-222222222222";
    await createSecurityEvent({
      accountId: ACCOUNT,
      type: "device_approved",
      network: NET,
    });
    await createSecurityEvent({
      accountId: OTHER,
      type: "device_approved",
      network: NET,
    });
    await markAllSecurityEventsRead({ accountId: ACCOUNT });
    const unreadOther = await countUnreadSecurityEvents({
      accountId: OTHER,
    });
    expect(unreadOther).toBe(1);
  });
});
