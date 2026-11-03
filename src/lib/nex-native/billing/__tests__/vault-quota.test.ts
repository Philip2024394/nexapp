// src/lib/nex-native/billing/__tests__/vault-quota.test.ts
//
// NEX Billing · [in-memory] Vault quota reservation tests.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT).
//
// Covers:
//   · reserveVaultCap · correct cap decisions per tier
//   · withVaultCapReservation · SUM + INSERT inside same lock window
//   · Rejects non-positive addingBytes
//   · Rejects unknown + 'gratis' tiers
//   · SQL sequence · BEGIN → SELECT FOR UPDATE → SUM → (INSERT) → COMMIT
//
// GATE-1 PENDING · R-12 (lock serialisation), R-13 (SUM aggregate shape).
// These tests prove the sequence we SEND; they don't prove PostgreSQL
// serialises · that remains Gate-1.

import { describe, it, expect } from "vitest";
import type { Pool, QueryResult } from "pg";
import { SupabaseBillingStore } from "../supabase-store";
import { reserveVaultCap, withVaultCapReservation } from "../vault-quota";

interface Call {
  readonly text: string;
  readonly values: readonly unknown[];
}

class FakePool {
  readonly calls: Call[] = [];
  private responses: Array<QueryResult<Record<string, unknown>> | Error> = [];

  queueOk<T extends Record<string, unknown>>(rows: T[]): void {
    this.responses.push({
      command: "",
      rowCount: rows.length,
      oid: 0,
      fields: [],
      rows,
    } as unknown as QueryResult<Record<string, unknown>>);
  }
  queueError(err: Error): void {
    this.responses.push(err);
  }
  async query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    this.calls.push({ text, values: values ?? [] });
    if (this.responses.length === 0) {
      throw new Error(`FakePool · no response queued for: ${text.slice(0, 50)}`);
    }
    const next = this.responses.shift()!;
    if (next instanceof Error) throw next;
    return next as QueryResult<T>;
  }
  async connect() {
    return {
      query: this.query.bind(this),
      release: () => {},
    };
  }
  async end(): Promise<void> {}
}

function makeStore(fake: FakePool): SupabaseBillingStore {
  return new SupabaseBillingStore({ source: fake as unknown as Pool });
}

// ---------------------------------------------------------------------------
// reserveVaultCap · validation
// ---------------------------------------------------------------------------

describe("[in-memory] reserveVaultCap · validation", () => {
  it("rejects non-positive addingBytes", async () => {
    const fake = new FakePool();
    const store = makeStore(fake);
    const r = await reserveVaultCap(
      { nexAccountId: "acct_1", addingBytes: 0, tier: "5gb" },
      store,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("value_out_of_range");
    expect(fake.calls).toHaveLength(0);
  });

  it("rejects unknown tier", async () => {
    const fake = new FakePool();
    const store = makeStore(fake);
    const r = await reserveVaultCap(
      {
        nexAccountId: "acct_1",
        addingBytes: 1_000_000,
        tier: "9999gb" as "5gb",
      },
      store,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("unsupported_tier");
  });

  it("rejects 'gratis' tier (no storage entitlement)", async () => {
    const fake = new FakePool();
    const store = makeStore(fake);
    const r = await reserveVaultCap(
      {
        nexAccountId: "acct_1",
        addingBytes: 1_000_000,
        tier: "gratis" as "5gb",
      },
      store,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("no_entitlement");
  });
});

// ---------------------------------------------------------------------------
// reserveVaultCap · SQL sequence
// ---------------------------------------------------------------------------

describe("[in-memory] reserveVaultCap · SQL sequence inside lock", () => {
  it("emits BEGIN → SELECT FOR UPDATE → SUM → COMMIT when within cap", async () => {
    const fake = new FakePool();
    fake.queueOk([]); // BEGIN
    fake.queueOk([{ id: "acct_1" }]); // SELECT ... FOR UPDATE
    fake.queueOk([{ sum: "1000000000" }]); // SUM = 1 GB
    fake.queueOk([]); // COMMIT
    const store = makeStore(fake);

    const r = await reserveVaultCap(
      {
        nexAccountId: "acct_1",
        addingBytes: 500_000_000, // 500 MB · fits within 5 GB
        tier: "5gb",
      },
      store,
    );

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.currentUsedBytes).toBe(1_000_000_000);
      expect(r.projectedBytes).toBe(1_500_000_000);
      expect(r.capBytes).toBe(5_000_000_000);
    }
    expect(fake.calls.map((c) => c.text.split(/\s+/)[0])).toEqual([
      "BEGIN",
      "SELECT",
      "SELECT",
      "COMMIT",
    ]);
    expect(fake.calls[1].text).toMatch(
      /SELECT id FROM nex_account WHERE id = \$1 FOR UPDATE/,
    );
    expect(fake.calls[2].text).toMatch(/SUM\(byte_size\)/);
    expect(fake.calls[2].text).toMatch(/FROM nex_vault_file WHERE account_id = \$1/);
  });

  it("returns cap_exceeded when SUM + addingBytes > tier cap", async () => {
    const fake = new FakePool();
    fake.queueOk([]); // BEGIN
    fake.queueOk([{ id: "acct_1" }]); // FOR UPDATE
    fake.queueOk([{ sum: "4999000000" }]); // 4.999 GB
    fake.queueOk([]); // COMMIT
    const store = makeStore(fake);

    const r = await reserveVaultCap(
      {
        nexAccountId: "acct_1",
        addingBytes: 2_000_000, // 2 MB · would push over 5 GB
        tier: "5gb",
      },
      store,
    );

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("cap_exceeded");
      expect(r.capBytes).toBe(5_000_000_000);
      expect(r.currentUsedBytes).toBe(4_999_000_000);
    }
  });

  it("ROLLBACKs on missing account row", async () => {
    const fake = new FakePool();
    fake.queueOk([]); // BEGIN
    fake.queueOk([]); // FOR UPDATE · zero rows
    fake.queueOk([]); // ROLLBACK
    const store = makeStore(fake);

    await expect(
      reserveVaultCap(
        {
          nexAccountId: "acct_missing",
          addingBytes: 1_000,
          tier: "5gb",
        },
        store,
      ),
    ).rejects.toThrow(/does not exist/);
    expect(fake.calls[fake.calls.length - 1].text).toBe("ROLLBACK");
  });

  it("treats numeric string SUM as number (bigint-safe)", async () => {
    const fake = new FakePool();
    fake.queueOk([]);
    fake.queueOk([{ id: "a" }]);
    fake.queueOk([{ sum: "4000000000" }]); // string from pg bigint
    fake.queueOk([]);
    const store = makeStore(fake);
    const r = await reserveVaultCap(
      { nexAccountId: "a", addingBytes: 500_000_000, tier: "5gb" },
      store,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.currentUsedBytes).toBe(4_000_000_000);
  });

  it("handles null SUM (empty vault) as 0", async () => {
    const fake = new FakePool();
    fake.queueOk([]);
    fake.queueOk([{ id: "a" }]);
    fake.queueOk([{ sum: 0 }]); // COALESCE already returns 0
    fake.queueOk([]);
    const store = makeStore(fake);
    const r = await reserveVaultCap(
      { nexAccountId: "a", addingBytes: 1_000_000, tier: "5gb" },
      store,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.currentUsedBytes).toBe(0);
      expect(r.projectedBytes).toBe(1_000_000);
    }
  });
});

// ---------------------------------------------------------------------------
// withVaultCapReservation · INSERT inside same lock window
// ---------------------------------------------------------------------------

describe("[in-memory] withVaultCapReservation", () => {
  it("runs INSERT callback inside the same lock · commits atomically", async () => {
    const fake = new FakePool();
    fake.queueOk([]); // BEGIN
    fake.queueOk([{ id: "acct_1" }]); // FOR UPDATE
    fake.queueOk([{ sum: "0" }]); // SUM = 0
    fake.queueOk([{ id: "file_1" }]); // user INSERT returns row
    fake.queueOk([]); // COMMIT
    const store = makeStore(fake);

    let insertCalled = 0;
    const r = await withVaultCapReservation(
      {
        nexAccountId: "acct_1",
        addingBytes: 1_000_000,
        tier: "5gb",
      },
      store,
      async (tx) => {
        insertCalled += 1;
        await (
          tx as unknown as {
            _rawQuery: (
              text: string,
              values: readonly unknown[],
            ) => Promise<{ rows: unknown[]; rowCount: number }>;
          }
        )._rawQuery(
          "INSERT INTO nex_vault_file(account_id, byte_size) VALUES ($1,$2) RETURNING id",
          ["acct_1", 1_000_000],
        );
        return "file_1";
      },
    );

    expect(insertCalled).toBe(1);
    expect(r.ok).toBe(true);
    if (r.ok && "insertResult" in r) {
      expect(r.insertResult).toBe("file_1");
    }
    // Confirm INSERT ran AFTER FOR UPDATE and BEFORE COMMIT
    const kinds = fake.calls.map((c) => c.text.split(/\s+/)[0]);
    expect(kinds).toEqual(["BEGIN", "SELECT", "SELECT", "INSERT", "COMMIT"]);
  });

  it("does NOT call the INSERT callback when cap exceeded", async () => {
    const fake = new FakePool();
    fake.queueOk([]);
    fake.queueOk([{ id: "acct_1" }]);
    fake.queueOk([{ sum: "5000000000" }]); // already at cap
    fake.queueOk([]); // COMMIT (we still COMMIT inside txn even on cap_exceeded return)
    const store = makeStore(fake);

    let insertCalled = 0;
    const r = await withVaultCapReservation(
      { nexAccountId: "acct_1", addingBytes: 1_000, tier: "5gb" },
      store,
      async () => {
        insertCalled += 1;
        return "nope";
      },
    );

    expect(insertCalled).toBe(0);
    expect(r.ok).toBe(false);
  });
});
