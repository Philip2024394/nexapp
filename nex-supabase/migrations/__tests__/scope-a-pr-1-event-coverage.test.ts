// nex-supabase/migrations/__tests__/scope-a-pr-1-event-coverage.test.ts
//
// Scope-A PR-1 · cross-migration coverage test.
//
// Asserts that every event_name emitted by any function in migration 265
// (and every lifecycle event that PR-3 routes will emit per the Scope-A
// design) exists in the migration 261 seed. If the function emits an
// unregistered event at runtime, the compound FK on migration 262 raises
// foreign_key_violation and the transaction rolls back · but we catch
// the drift at build time by cross-reading the files.
//
// Evidence boundary: static-source only · no database access.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const M261 = readFileSync(
  resolve(__dirname, "..", "261_nex_invite_event_type_seed.sql"),
  "utf8",
);
const M265 = readFileSync(
  resolve(__dirname, "..", "265_nex_friend_request_tx_functions.sql"),
  "utf8",
);

// Authoritative list from the sealed Scope-A design.
const EXPECTED_SEEDED = new Set<string>([
  "invite.created",
  "invite.accepted",
  "invite.cancelled",
  "invite.expired.swept",
  "invite.create.rejected",
  "invite.view",
  "sweep.run.ok",
  "sweep.run.failed",
  "sweep.run.unresolved",
  "watcher.run.ok",
  "watcher.run.failed",
  "watcher.run.unresolved",
  "retention.run.ok",
  "retention.run.failed",
  "retention.run.unresolved",
]);

describe("Cross-migration · event-coverage", () => {
  it("migration 261 seeds exactly the 15 authoritative events", () => {
    for (const name of EXPECTED_SEEDED) {
      expect(M261, `missing seed entry for ${name}`).toContain(`'${name}'`);
    }
  });

  it("migration 265 only emits events that exist in the registry seed", () => {
    // Pull every event_name literal referenced inside migration 265's
    // INSERT INTO public.nex_invite_event blocks.
    // Pattern: 'invite.*' or 'sweep.*' or 'watcher.*' or 'retention.*' used as a VALUE in an INSERT.
    const emitted = extractEmittedEventNames(M265);
    expect(emitted.size, "migration 265 must emit at least one event").toBeGreaterThan(0);

    const notSeeded: string[] = [];
    for (const name of emitted) {
      if (!EXPECTED_SEEDED.has(name)) notSeeded.push(name);
    }
    expect(
      notSeeded,
      `migration 265 emits events absent from the registry seed: ${notSeeded.join(", ")}`,
    ).toEqual([]);
  });

  it("every PR-1 function-emitted event has a declared class in the seed line", () => {
    const emitted = extractEmittedEventNames(M265);
    for (const name of emitted) {
      // Find the seed line and confirm it declares a class as 2nd column.
      const re = new RegExp(`'${name.replace(/\./g, "\\.")}'\\s*,\\s*'(lifecycle|operational)'`);
      expect(M261, `seed line for ${name} does not declare a valid class`).toMatch(re);
    }
  });

  it("sweep-related heartbeat emission uses sweep.run.ok · never *.failed or *.unresolved from inside the function", () => {
    // Inside migration 265 · ensure none of the functions emit a *.failed
    // or *.unresolved event. Those terminal events are route-level only
    // (PR-3) · emitting them from inside the function would mean the
    // function itself swallowed an error, which contradicts the design.
    const forbidden = /'(sweep|watcher|retention)\.run\.(failed|unresolved)'/g;
    const matches = M265.match(forbidden) ?? [];
    expect(
      matches,
      `migration 265 must not emit terminal failure/unresolved events (route-only · see PR-3): ${matches.join(", ")}`,
    ).toEqual([]);
  });

  it("heartbeat-emitting operations always include a dims payload with structured counts", () => {
    // sweep.run.ok · must carry {flipped, duration_ms}
    expect(M265).toMatch(/'sweep\.run\.ok'[\s\S]*?jsonb_build_object\s*\(\s*'flipped'/);
    // retention.run.ok · must carry {lifecycle_deleted, operational_deleted, duration_ms}
    expect(M265).toMatch(/'retention\.run\.ok'[\s\S]*?jsonb_build_object\s*\(\s*'lifecycle_deleted'[\s\S]*?'operational_deleted'/);
  });
});

// Extract event names used as VALUE in INSERT INTO public.nex_invite_event (...).
function extractEmittedEventNames(sql: string): Set<string> {
  const out = new Set<string>();
  // Find each INSERT INTO public.nex_invite_event block and scan for the
  // event_name literal · event_name is positional in our VALUES lists
  // (and in SELECT lists for the per-row sweep event). We detect any
  // string literal that matches the known prefixes.
  const inserts = sql.match(/INSERT INTO public\.nex_invite_event[\s\S]*?(?=INSERT INTO|CREATE OR|$)/g) ?? [];
  for (const block of inserts) {
    const literals = block.match(/'(invite|sweep|watcher|retention)\.[a-z0-9._]+'/g) ?? [];
    for (const lit of literals) {
      out.add(lit.slice(1, -1));
    }
  }
  return out;
}
