// src/lib/nex-native/incident/__tests__/incident-recurrence.test.ts
//
// A22 · Scenario 13 · Incident recurrence after resolution.
// ---------------------------------------------------------
// The sealed dedup rule is: for a signal with stable dedup_key K,
// `findOpenIncidentByDedupKey` matches OPEN rows only (status NOT IN
// (CLOSED, VERIFIED)). So when a previously resolved incident
// re-fires, the caller should see no match and a NEW row must be
// inserted · recurrence creates a new incident, never reopens the
// terminal one.
//
// This test exercises the recurrence-vs-reopen boundary:
//   · incident#1 is created with dedup_key K
//   · incident#1 is closed (status = CLOSED)
//   · findOpenIncidentByDedupKey(K) returns null
//   · createIncident with same dedup_key K yields a NEW incident id

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

interface IncidentRow {
  readonly id: string;
  readonly dedup_key: string | null;
  readonly country: string;
  status: string;
}

const STATE = vi.hoisted(() => ({
  rows: [] as IncidentRow[],
  events: [] as Array<Record<string, unknown>>,
  nextIdSeq: 1,
}));

vi.mock("../../supabase-admin", () => {
  // Minimal in-memory store that keeps the sealed dedup semantics:
  // findOpenIncidentByDedupKey filters status NOT IN (CLOSED, VERIFIED).
  function makeSelectChain(table: string): Record<string, unknown> {
    const filters: Array<(r: IncidentRow) => boolean> = [];
    const chain: Record<string, unknown> = {};
    chain.limit = () => chain;
    chain.eq = (col: string, val: unknown) => {
      filters.push((r) => (r as unknown as Record<string, unknown>)[col] === val);
      return chain;
    };
    chain.not = (col: string, _op: string, listExpr: string) => {
      // Shape: ("status", "in", "(CLOSED,VERIFIED)")
      const values = listExpr
        .replace(/^\(|\)$/g, "")
        .split(",")
        .map((s) => s.trim());
      filters.push((r) => {
        const v = (r as unknown as Record<string, unknown>)[col];
        return !values.includes(String(v));
      });
      return chain;
    };
    chain.order = () => chain;
    chain.gte = () => chain;
    chain.lt = () => chain;
    chain.maybeSingle = () => {
      if (table !== "nex_incident") return Promise.resolve({ data: null, error: null });
      const hit = STATE.rows.find((r) => filters.every((f) => f(r)));
      return Promise.resolve({ data: hit ?? null, error: null });
    };
    (chain as Record<string, unknown>).then = (
      resolve?: ((v: unknown) => unknown) | null,
      reject?: ((r: unknown) => unknown) | null,
    ) => Promise.resolve({ data: [], error: null }).then(resolve ?? undefined, reject ?? undefined);
    return chain;
  }

  return {
    nexSupabaseAdmin: {
      from(table: string) {
        return {
          select: () => makeSelectChain(table),
          insert(row: Record<string, unknown> | Record<string, unknown>[]) {
            const rows = Array.isArray(row) ? row : [row];
            if (table === "nex_incident") {
              const newId = `incident-${STATE.nextIdSeq++}`;
              for (const r of rows) {
                STATE.rows.push({
                  id: newId,
                  dedup_key: (r.dedup_key as string | null) ?? null,
                  country: String(r.country),
                  status: "DETECTED",
                });
              }
              return {
                select: () => ({
                  maybeSingle: () => Promise.resolve({ data: { id: newId }, error: null }),
                }),
              };
            }
            for (const r of rows) STATE.events.push({ table, ...r });
            return {
              select: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
            };
          },
          update: (patch: Record<string, unknown>) => {
            const updChain: Record<string, unknown> = {};
            let idKey: string | null = null;
            let fromStatus: string | null = null;
            updChain.eq = (col: string, val: unknown) => {
              if (col === "id") idKey = String(val);
              if (col === "status") fromStatus = String(val);
              const second: Record<string, unknown> = {};
              second.eq = (c2: string, v2: unknown) => {
                if (c2 === "status") fromStatus = String(v2);
                if (table === "nex_incident" && idKey) {
                  const row = STATE.rows.find((r) => r.id === idKey);
                  if (row && (fromStatus === null || row.status === fromStatus)) {
                    if (typeof patch.status === "string") row.status = patch.status;
                  }
                }
                return Promise.resolve({ error: null });
              };
              (second as Record<string, unknown>).then = (
                resolve?: ((v: unknown) => unknown) | null,
                reject?: ((r: unknown) => unknown) | null,
              ) => {
                if (table === "nex_incident" && idKey) {
                  const row = STATE.rows.find((r) => r.id === idKey);
                  if (row && typeof patch.status === "string") row.status = patch.status;
                }
                return Promise.resolve({ error: null }).then(
                  resolve ?? undefined,
                  reject ?? undefined,
                );
              };
              return second;
            };
            return updChain;
          },
        };
      },
    },
  };
});

import {
  _resetIncidentProbeForTests,
  createIncident,
  findOpenIncidentByDedupKey,
  transitionIncident,
} from "../incident-service";

describe("Scenario 13 · incident recurrence after resolution", () => {
  beforeEach(() => {
    _resetIncidentProbeForTests();
    STATE.rows = [];
    STATE.events = [];
    STATE.nextIdSeq = 1;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it(
    "same dedup_key refires after CLOSED · inserts a brand new incident, never reopens the terminal one",
    async () => {
      const DEDUP = "chat.realtime.reconnect_storm";

      // Step 1 · create the first incident with the shared dedup key
      const first = await createIncident({
        category: "service",
        severity: "warn",
        scope: "chat",
        country: "ireland",
        summary: "burst 1",
        dedupKey: DEDUP,
      });
      expect(first.ok).toBe(true);
      const firstId = first.incidentId!;

      // Step 2 · while still DETECTED, dedup lookup matches firstId
      const whileOpen = await findOpenIncidentByDedupKey({
        dedupKey: DEDUP,
        country: "ireland",
      });
      expect(whileOpen.incidentId).toBe(firstId);

      // Step 3 · resolve → CLOSED
      const closed = await transitionIncident({
        incidentId: firstId,
        toStatus: "CLOSED",
        note: "operator dismissed",
      });
      expect(closed.ok).toBe(true);

      // Step 4 · dedup lookup now returns null · CLOSED is excluded
      const afterClose = await findOpenIncidentByDedupKey({
        dedupKey: DEDUP,
        country: "ireland",
      });
      expect(afterClose.incidentId).toBeNull();

      // Step 5 · re-fire with same dedup_key → new incident, distinct id
      const second = await createIncident({
        category: "service",
        severity: "warn",
        scope: "chat",
        country: "ireland",
        summary: "burst 2",
        dedupKey: DEDUP,
      });
      expect(second.ok).toBe(true);
      expect(second.incidentId).not.toBe(firstId);

      // The store holds BOTH rows · the first in CLOSED, the second
      // in DETECTED · recurrence never reopens the terminal row.
      expect(STATE.rows).toHaveLength(2);
      const row1 = STATE.rows.find((r) => r.id === firstId)!;
      const row2 = STATE.rows.find((r) => r.id === second.incidentId)!;
      expect(row1.status).toBe("CLOSED");
      expect(row2.status).toBe("DETECTED");
    },
  );

  it(
    "same dedup_key in a DIFFERENT country · never collides with the ireland incident",
    async () => {
      const DEDUP = "auth.rate_limit.tripped";
      const irl = await createIncident({
        category: "service",
        severity: "warn",
        scope: "auth",
        country: "ireland",
        summary: "x",
        dedupKey: DEDUP,
      });
      expect(irl.ok).toBe(true);

      // Open dedup lookup in INDONESIA finds no open incident, because
      // dedup is country-scoped.
      const idnLookup = await findOpenIncidentByDedupKey({
        dedupKey: DEDUP,
        country: "indonesia",
      });
      expect(idnLookup.incidentId).toBeNull();

      const idn = await createIncident({
        category: "service",
        severity: "warn",
        scope: "auth",
        country: "indonesia",
        summary: "y",
        dedupKey: DEDUP,
      });
      expect(idn.ok).toBe(true);
      expect(idn.incidentId).not.toBe(irl.incidentId);
      expect(STATE.rows).toHaveLength(2);
    },
  );
});
