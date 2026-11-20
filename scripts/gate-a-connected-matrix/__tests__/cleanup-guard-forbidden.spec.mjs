// scripts/gate-a-connected-matrix/__tests__/cleanup-guard-forbidden.spec.mjs
//
// §16.48.19 · Agent 2 · cleanup last-mile guard tests.
// Authored by Agent CLEANUP · Lane G Gate A · 2026-11-20.
//
// Proves — all pure, in-memory, zero network / fs / child process:
//   Happy path
//     1. A well-formed in-manifest ID with a correct provenance_tag is
//        accepted (`ok: true`).
//   Protected-account refusal (Hammerex + Rosa) · direct, mirror, poisoned
//     2. Hammerex UUID passed in directly → FORBIDDEN_IDENTITY.
//     3. Rosa UUID passed in directly → FORBIDDEN_IDENTITY.
//     4. Hammerex appearing IN the manifest is still refused — denylist is
//        checked BEFORE the manifest lookup, so a poisoned manifest cannot
//        promote a protected ID.
//     5. Rosa appearing IN the manifest is still refused (mirror of #4).
//   Shape refusals
//     6. Non-UUID string → BAD_USER_ID.
//     7. Empty-string ID → BAD_USER_ID.
//     8. null / undefined ID → BAD_USER_ID.
//   Manifest refusals
//     9. ID not present in the manifest → NOT_IN_MANIFEST.
//    10. Empty manifest array → MANIFEST_EMPTY.
//    11. null manifestRows → MANIFEST_EMPTY.
//    12. Non-array manifestRows (object, string) → MANIFEST_EMPTY.
//   Provenance refusals
//    13. Matching manifest row missing provenance_tag →
//        MISSING_OR_FOREIGN_PROVENANCE_TAG.
//    14. Matching manifest row with a provenance_tag that does NOT
//        start with "gate-a-" → MISSING_OR_FOREIGN_PROVENANCE_TAG.
//   Denylist discipline
//    15. Empty forbiddenIdentities array → DENYLIST_EMPTY (an empty
//        denylist is itself a refusal — same invariant as validateCleanupPlan).
//    16. Default forbiddenIdentities (omit param) protects Hammerex.
//    17. Default forbiddenIdentities (omit param) protects Rosa.
//   Case tolerance
//    18. Uppercase input ID matches a lowercase manifest row (and vice-versa).
//   Secret hygiene
//    19. Refusal result objects never carry anything shaped like a token,
//        password, key, or JWT.
//
// Strategy: import `assertIdentityDeletable` directly from 90_cleanup.mjs
// and drive it with hand-built arguments. No live supabase or pg.

import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID, randomBytes } from "node:crypto";

const HAMMEREX = "11111111-1111-4111-8111-111111111111";
const ROSA = "11111111-1111-4111-8111-111111111113";

function mkTag(runId = randomUUID()) {
  return `gate-a-${runId}-${randomBytes(4).toString("hex")}`;
}

function mkRow(supabaseUserId, { tag = mkTag(), label = "A", omitTag = false, foreignTag = false } = {}) {
  const row = {
    label,
    supabase_user_id: supabaseUserId,
    dependent_rows: [],
  };
  if (omitTag) return row;
  row.provenance_tag = foreignTag ? "not-a-gate-a-tag" : tag;
  return row;
}

describe("§16.48.19 · assertIdentityDeletable — cleanup last-mile guard", () => {
  let assertIdentityDeletable;
  beforeAll(async () => {
    const mod = await import("../90_cleanup.mjs");
    assertIdentityDeletable = mod.assertIdentityDeletable;
    expect(typeof assertIdentityDeletable).toBe("function");
  });

  // ─── Happy path ──────────────────────────────────────────────────────────
  it("1 · accepts a well-formed in-manifest ID with correct provenance_tag", () => {
    const uid = randomUUID();
    const tag = mkTag();
    const r = assertIdentityDeletable({
      supabaseUserId: uid,
      manifestRows: [mkRow(uid, { tag })],
    });
    expect(r.ok).toBe(true);
  });

  // ─── Protected-account refusal · direct + mirror + poisoned ──────────────
  it("2 · refuses Hammerex passed directly (FORBIDDEN_IDENTITY)", () => {
    const r = assertIdentityDeletable({
      supabaseUserId: HAMMEREX,
      manifestRows: [mkRow(randomUUID())],
    });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("FORBIDDEN_IDENTITY");
  });

  it("3 · refuses Rosa passed directly (FORBIDDEN_IDENTITY)", () => {
    const r = assertIdentityDeletable({
      supabaseUserId: ROSA,
      manifestRows: [mkRow(randomUUID())],
    });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("FORBIDDEN_IDENTITY");
  });

  it("4 · poisoned manifest: Hammerex IN manifest is still refused (denylist checked first)", () => {
    // If a malicious / buggy caller slips Hammerex into manifestRows,
    // assertIdentityDeletable must still refuse — the denylist is
    // evaluated BEFORE any manifest membership check.
    const tag = mkTag();
    const r = assertIdentityDeletable({
      supabaseUserId: HAMMEREX,
      manifestRows: [mkRow(HAMMEREX, { tag })],
    });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("FORBIDDEN_IDENTITY");
  });

  it("5 · poisoned manifest: Rosa IN manifest is still refused (mirror of #4)", () => {
    const tag = mkTag();
    const r = assertIdentityDeletable({
      supabaseUserId: ROSA,
      manifestRows: [mkRow(ROSA, { tag })],
    });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("FORBIDDEN_IDENTITY");
  });

  // ─── Shape refusals ──────────────────────────────────────────────────────
  it("6 · refuses non-UUID string (BAD_USER_ID)", () => {
    const r = assertIdentityDeletable({
      supabaseUserId: "not-a-uuid",
      manifestRows: [mkRow(randomUUID())],
    });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("BAD_USER_ID");
  });

  it("7 · refuses empty-string ID (BAD_USER_ID)", () => {
    const r = assertIdentityDeletable({
      supabaseUserId: "",
      manifestRows: [mkRow(randomUUID())],
    });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("BAD_USER_ID");
  });

  it("8 · refuses null / undefined ID (BAD_USER_ID)", () => {
    for (const bad of [null, undefined, 42, {}, []]) {
      const r = assertIdentityDeletable({
        supabaseUserId: bad,
        manifestRows: [mkRow(randomUUID())],
      });
      expect(r.ok).toBe(false);
      expect(r.refusalCode).toBe("BAD_USER_ID");
    }
  });

  // ─── Manifest refusals ───────────────────────────────────────────────────
  it("9 · refuses ID absent from manifest (NOT_IN_MANIFEST)", () => {
    const stranger = randomUUID();
    const r = assertIdentityDeletable({
      supabaseUserId: stranger,
      manifestRows: [mkRow(randomUUID())], // some other ID
    });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("NOT_IN_MANIFEST");
  });

  it("10 · refuses empty manifest array (MANIFEST_EMPTY)", () => {
    const r = assertIdentityDeletable({
      supabaseUserId: randomUUID(),
      manifestRows: [],
    });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("MANIFEST_EMPTY");
  });

  it("11 · refuses null / undefined manifestRows (MANIFEST_EMPTY)", () => {
    for (const bad of [null, undefined]) {
      const r = assertIdentityDeletable({
        supabaseUserId: randomUUID(),
        manifestRows: bad,
      });
      expect(r.ok).toBe(false);
      expect(r.refusalCode).toBe("MANIFEST_EMPTY");
    }
  });

  it("12 · refuses non-array manifestRows (MANIFEST_EMPTY)", () => {
    for (const bad of [{ supabase_user_id: randomUUID() }, "a-string", 123]) {
      const r = assertIdentityDeletable({
        supabaseUserId: randomUUID(),
        manifestRows: bad,
      });
      expect(r.ok).toBe(false);
      expect(r.refusalCode).toBe("MANIFEST_EMPTY");
    }
  });

  // ─── Provenance refusals ─────────────────────────────────────────────────
  it("13 · refuses matching row that is missing provenance_tag (MISSING_OR_FOREIGN_PROVENANCE_TAG)", () => {
    const uid = randomUUID();
    const r = assertIdentityDeletable({
      supabaseUserId: uid,
      manifestRows: [mkRow(uid, { omitTag: true })],
    });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("MISSING_OR_FOREIGN_PROVENANCE_TAG");
  });

  it("14 · refuses matching row with a provenance_tag that does not start with 'gate-a-'", () => {
    const uid = randomUUID();
    const r = assertIdentityDeletable({
      supabaseUserId: uid,
      manifestRows: [mkRow(uid, { foreignTag: true })],
    });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("MISSING_OR_FOREIGN_PROVENANCE_TAG");
  });

  // ─── Denylist discipline ─────────────────────────────────────────────────
  it("15 · empty forbiddenIdentities → DENYLIST_EMPTY (no silent bypass)", () => {
    const uid = randomUUID();
    const r = assertIdentityDeletable({
      supabaseUserId: uid,
      manifestRows: [mkRow(uid)],
      forbiddenIdentities: [],
    });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("DENYLIST_EMPTY");
  });

  it("16 · default forbiddenIdentities (omit param) protects Hammerex", () => {
    // Omitting forbiddenIdentities should fall back to HARD_DENYLIST.
    // We assert the default protects the two sealed identities even when
    // the caller did not supply their own list.
    const r = assertIdentityDeletable({
      supabaseUserId: HAMMEREX,
      manifestRows: [mkRow(randomUUID())],
      // forbiddenIdentities deliberately omitted
    });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("FORBIDDEN_IDENTITY");
  });

  it("17 · default forbiddenIdentities (omit param) protects Rosa", () => {
    const r = assertIdentityDeletable({
      supabaseUserId: ROSA,
      manifestRows: [mkRow(randomUUID())],
    });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("FORBIDDEN_IDENTITY");
  });

  // ─── Case tolerance ──────────────────────────────────────────────────────
  it("18 · UUID matching is case-insensitive in both directions", () => {
    const uidLower = "abcdef12-3456-4789-8abc-def012345678";
    const uidUpper = uidLower.toUpperCase();
    const tag = mkTag();
    // Lowercase manifest row, uppercase input
    const r1 = assertIdentityDeletable({
      supabaseUserId: uidUpper,
      manifestRows: [mkRow(uidLower, { tag })],
    });
    expect(r1.ok).toBe(true);
    // Uppercase manifest row, lowercase input
    const r2 = assertIdentityDeletable({
      supabaseUserId: uidLower,
      manifestRows: [mkRow(uidUpper, { tag })],
    });
    expect(r2.ok).toBe(true);
  });

  // ─── Secret hygiene ──────────────────────────────────────────────────────
  it("19 · refusal results never carry token / password / key / jwt shapes", () => {
    const uid = randomUUID();
    const results = [
      assertIdentityDeletable({ supabaseUserId: HAMMEREX, manifestRows: [mkRow(uid)] }),
      assertIdentityDeletable({ supabaseUserId: "bad",     manifestRows: [mkRow(uid)] }),
      assertIdentityDeletable({ supabaseUserId: uid,       manifestRows: [] }),
      assertIdentityDeletable({ supabaseUserId: uid,       manifestRows: [mkRow(uid, { foreignTag: true })] }),
      assertIdentityDeletable({ supabaseUserId: uid,       manifestRows: [mkRow(uid)], forbiddenIdentities: [] }),
    ];
    for (const r of results) {
      const text = JSON.stringify(r).toLowerCase();
      expect(text).not.toMatch(/\bpassword\b/);
      expect(text).not.toMatch(/\btoken\b/);
      expect(text).not.toMatch(/\bjwt\b/);
      expect(text).not.toMatch(/\baccess_token\b/);
      expect(text).not.toMatch(/\brefresh_token\b/);
      expect(text).not.toMatch(/\bservice[_-]?role\b/);
      expect(text).not.toMatch(/\bsecret\b/);
      expect(text).not.toMatch(/\bapi[_-]?key\b/);
    }
  });
});
