// src/lib/nex-native/__tests__/business-service-cover-layout.test.ts
//
// Phase 1 · 2026-10-14 · NEX Bisnis first-entry prerequisite.
// -----------------------------------------------------------------------------
// The sealed `business-service.ts:updateCoverLayoutId` previously carried a
// stale hardcoded VALID list that still contained the 7 old cover IDs
// (restaurant, tradesperson, salon, creator, fashion, street_food,
// premium_business) which were REMOVED from the sealed catalogue on
// 2026-09-30. That list would have REJECTED 7 of the 10 current sealed IDs
// — a BLOCKER for the owner's planned two-step first-time business setup.
//
// This Phase 1 commit replaces the stale list with a call to the canonical
// `isValidCoverLayoutId` helper exported from
// `src/app/nex-native/cover/layout-ids.ts` so there is a single source of
// truth. Owner authorisation 2026-10-14.
//
// Audit evidence:
//   docs/doctrine/nex-bisnis-first-entry-audit-2026-10-14.md §B7
//
// Two layers of coverage:
//
//   (A) Pure predicate truth table · isValidCoverLayoutId
//         · all 10 current sealed IDs → true
//         · each of the 7 removed-2026-09-30 old IDs → false
//         · malformed / adversarial inputs → false
//
//   (B) Source-shape integration on business-service.ts
//         · imports isValidCoverLayoutId from the canonical source
//         · updateCoverLayoutId uses it (not a parallel hardcoded list)
//         · no re-introduction of removed-2026-09-30 old IDs anywhere
//         · persistence ownership unchanged (business-level, via
//           nex_business.cover_layout_id)
//
// This file uses source-shape + pure-function tests only · no Supabase,
// no process.env, no DOM. The service's actual DB write is NOT exercised
// here (that requires the live project and sits outside the authorised
// Phase 1 scope).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  COVER_LAYOUT_IDS,
  isValidCoverLayoutId,
} from "../../../app/nex-native/cover/layout-ids";

const BUSINESS_SERVICE_SRC = readFileSync(
  resolve(__dirname, "..", "business-service.ts"),
  "utf8",
);

/** The seven cover IDs removed from the sealed catalogue on 2026-09-30
 *  (Bridge 98 · ONE NEX IDENTITY). They must NEVER re-appear as
 *  "valid" anywhere in business-service.ts, and must be rejected by
 *  isValidCoverLayoutId. */
const REMOVED_OLD_IDS = [
  "restaurant",
  "tradesperson",
  "salon",
  "creator",
  "fashion",
  "street_food",
  "premium_business",
] as const;

/* ─── A · pure predicate truth table ──────────────────────────── */

describe("isValidCoverLayoutId · accepts every sealed cover ID", () => {
  it("accepts all 11 current sealed IDs from COVER_LAYOUT_IDS", () => {
    // 2026-10-20 · owner directive added "accommodation" as the 11th
    // sealed cover layout (hospitality / homestay / villa / hotel
    // market). See src/app/nex-native/cover/layout-ids.ts.
    expect(COVER_LAYOUT_IDS).toHaveLength(11);
    for (const id of COVER_LAYOUT_IDS) {
      expect(
        isValidCoverLayoutId(id),
        `must accept sealed id "${id}"`,
      ).toBe(true);
    }
  });

  it("accepts each sealed id enumerated explicitly (defence-in-depth)", () => {
    // Lock the exact eleven strings so a silent change to
    // COVER_LAYOUT_IDS can't quietly pass the first test by also
    // removing entries.
    expect(isValidCoverLayoutId("cafe")).toBe(true);
    expect(isValidCoverLayoutId("cafe_landscape")).toBe(true);
    expect(isValidCoverLayoutId("cafe_round")).toBe(true);
    expect(isValidCoverLayoutId("product")).toBe(true);
    expect(isValidCoverLayoutId("product_landscape")).toBe(true);
    expect(isValidCoverLayoutId("product_round")).toBe(true);
    expect(isValidCoverLayoutId("product_landscape_round")).toBe(true);
    expect(isValidCoverLayoutId("personal_brand")).toBe(true);
    expect(isValidCoverLayoutId("personal_brand_landscape")).toBe(true);
    expect(isValidCoverLayoutId("personal_brand_round")).toBe(true);
    expect(isValidCoverLayoutId("accommodation")).toBe(true);
  });
});

describe("isValidCoverLayoutId · rejects everything else", () => {
  it("rejects each of the 7 removed-2026-09-30 old IDs", () => {
    for (const id of REMOVED_OLD_IDS) {
      expect(
        isValidCoverLayoutId(id),
        `must reject removed id "${id}"`,
      ).toBe(false);
    }
  });

  it("rejects empty string + undefined (predicate narrows via truthiness)", () => {
    expect(isValidCoverLayoutId("")).toBe(false);
    expect(isValidCoverLayoutId(undefined)).toBe(false);
  });

  it("rejects adversarial / malformed strings", () => {
    const adversarial = [
      "CAFE",
      "Cafe",
      " cafe",
      "cafe ",
      "cafe\n",
      "cafe;",
      "cafe/*",
      "../cafe",
      "cafe_landscape_round",
      "nex-flat",
      "theme-0",
      "cafe_restaurant",
      "cafe-landscape",
      "cafélandscape",
      "..",
    ];
    for (const id of adversarial) {
      expect(
        isValidCoverLayoutId(id),
        `must reject adversarial id "${id}"`,
      ).toBe(false);
    }
  });
});

/* ─── B · business-service source shape ───────────────────────── */

describe("business-service.ts · updateCoverLayoutId uses the canonical validator", () => {
  it("imports isValidCoverLayoutId from the canonical layout-ids module", () => {
    expect(BUSINESS_SERVICE_SRC).toMatch(
      /import\s*\{\s*isValidCoverLayoutId\s*\}\s*from\s*["']@\/app\/nex-native\/cover\/layout-ids["']/,
    );
  });

  it("updateCoverLayoutId guards with isValidCoverLayoutId · no parallel list", () => {
    expect(BUSINESS_SERVICE_SRC).toMatch(
      /if\s*\(\s*layoutId\s*!==\s*null\s*&&\s*!isValidCoverLayoutId\(\s*layoutId\s*\)\s*\)/,
    );
  });

  it("does NOT re-introduce the removed-2026-09-30 old IDs as cover-layout literals", () => {
    // The sealed concern is that the 7 removed COVER-LAYOUT ids
    // (restaurant, tradesperson, salon, creator, fashion, street_food,
    // premium_business) must not appear as a VALID-list literal
    // guarding updateCoverLayoutId. 2026-11-07 Phase B legitimately
    // re-introduced several of those strings as BUSINESS-CATEGORY
    // slugs in REV6_SUBTYPE_TO_LEGACY_SLUG (a different domain
    // entirely · maps subtype → legacy business_category column).
    // So we scope this scan to the updateCoverLayoutId function body
    // ONLY · the rest of the file is allowed to use the strings in
    // other contexts.
    const match = BUSINESS_SERVICE_SRC.match(
      /export async function updateCoverLayoutId\([\s\S]*?\n\}/,
    );
    expect(match, "updateCoverLayoutId function body not found").not.toBeNull();
    const fnBody = match![0];
    const stripComments = (src: string) =>
      src
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const code = stripComments(fnBody);
    for (const removed of REMOVED_OLD_IDS) {
      expect(
        code.includes(`"${removed}"`),
        `updateCoverLayoutId body must not contain quoted literal "${removed}" (comments ok, other functions ok)`,
      ).toBe(false);
    }
  });

  it("preserves persistence ownership · writes to nex_business.cover_layout_id", () => {
    expect(BUSINESS_SERVICE_SRC).toMatch(
      /\.from\(\s*["']nex_business["']\s*\)/,
    );
    expect(BUSINESS_SERVICE_SRC).toMatch(
      /\.update\(\s*\{\s*cover_layout_id:\s*layoutId\s*\}\s*\)/,
    );
  });

  it("preserves the signature · null still clears the layout", () => {
    expect(BUSINESS_SERVICE_SRC).toMatch(
      /export async function updateCoverLayoutId\(\s*businessId:\s*NexUuid\s*,\s*layoutId:\s*string\s*\|\s*null\s*,?\s*\)/,
    );
  });

  it("throws a structured error on invalid layoutId (shape pin)", () => {
    expect(BUSINESS_SERVICE_SRC).toContain(
      'business-service.updateCoverLayoutId: invalid layoutId "',
    );
  });
});
