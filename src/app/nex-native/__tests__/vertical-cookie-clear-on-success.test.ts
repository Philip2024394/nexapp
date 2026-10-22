// src/app/nex-native/__tests__/vertical-cookie-clear-on-success.test.ts
//
// NEX · I1 regression · prove createBusinessAction clears the
// vertical-intent + decline-sentinel cookies ONLY after a confirmed
// subtype persistence.
// Owner-authorised corrective patch 2026-10-20.
// -----------------------------------------------------------------------------
// Original bug · the vertical cookie survived business creation
// because clearing was deferred to saveBusinessActivationAction
// (a MANUAL /business-setup page). If an owner abandoned the
// activation step, the 24h cookie could carry a vertical intent
// into another business creation.
//
// Fix contract (owner's required order of operations):
//   1. Read + validate the selected vertical.
//   2. Persist subtype + cover/profile.
//   3. Confirm the writes succeeded.
//   4. Clear the vertical-intent cookie ONLY after successful
//      persistence. A failed write preserves intent for retry.
//
// Scope note · the sealed `createBusinessAction` is a 400-line
// server action that executes real Supabase writes. Mocking it
// end-to-end would reinvent Playwright. Instead, these tests pin
// the EXACT source shape that enforces the ordering · tampering
// with the order or skipping the confirmation flag fails the suite.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ACTIONS_SRC = readFileSync(
  resolve(__dirname, "../_actions.ts"),
  "utf8",
);
const ACTIVATION_SRC = readFileSync(
  resolve(__dirname, "../business-setup/_actions.ts"),
  "utf8",
);

/** Narrow to the slice of _actions.ts that contains createBusinessAction.
 *  Starts at the export, ends at the next top-level `export async function`
 *  (createFirstProductAction). This keeps regex scopes tight. */
function sliceCreateBusinessAction(src: string): string {
  const start = src.indexOf("export async function createBusinessAction");
  const nextExport = src.indexOf(
    "export async function",
    start + "export async function createBusinessAction".length,
  );
  return src.slice(start, nextExport === -1 ? src.length : nextExport);
}

const CREATE_BUSINESS = sliceCreateBusinessAction(ACTIONS_SRC);

describe("I1 · ordering · verticalSubtypePersisted flag", () => {
  it("declares `let verticalSubtypePersisted = false` BEFORE the outer try block (hoisted)", () => {
    // Hoisting is load-bearing · if the declaration lives INSIDE the
    // outer try, the success-path cookie-clear block (which runs
    // AFTER the try/catch) can't read the flag. The regex pins
    // declaration-before-try · and the initial value is false
    // because a cookie-less creation must not clear anything.
    expect(CREATE_BUSINESS).toMatch(
      /let\s+verticalSubtypePersisted\s*=\s*false[\s\S]{0,400}?let\s+business[\s\S]{0,200}?try\s*\{/,
    );
  });

  it("flips the flag to true ONLY after a null-error AND confirmed-row Supabase update", () => {
    // After the Check B hardening the pattern destructures BOTH
    // data and error, chains `.select("id").single()`, throws on
    // null error, throws on zero affected rows, and only then
    // flips the flag. The regex pins the full ordered chain.
    expect(CREATE_BUSINESS).toMatch(
      /const\s*\{\s*data:\s*profileUpdateRow\s*,\s*error:\s*profileUpdateErr\s*\}\s*=\s*await\s+nexSupabaseAdmin[\s\S]{0,400}?\.update\(\{\s*profile:\s*nextProfile\s*\}\)[\s\S]{0,100}?\.eq\(\s*"id"\s*,\s*business\.id\s*\)[\s\S]{0,100}?\.select\(\s*"id"\s*\)[\s\S]{0,100}?\.single\(\)/,
    );
    // And the flag flip only happens after BOTH guards throw-check.
    expect(CREATE_BUSINESS).toMatch(
      /if\s*\(\s*profileUpdateErr\s*\)\s*\{[\s\S]{0,160}?throw[\s\S]{0,80}?\}[\s\S]{0,200}?if\s*\(\s*!profileUpdateRow[\s\S]{0,200}?throw[\s\S]{0,200}?\}[\s\S]{0,200}?verticalSubtypePersisted\s*=\s*true/,
    );
  });

  it("the flip to true happens INSIDE the try/catch for the subtype write (soft-fail preserved)", () => {
    // Pins: a catch block captures the error AFTER the flip would
    // happen · so a thrown error prevents the flip. The flag stays
    // false and the cookie survives.
    expect(CREATE_BUSINESS).toMatch(
      /verticalSubtypePersisted\s*=\s*true[\s\S]{0,200}?\}\s*catch\s*\(\s*profileErr\s*\)\s*\{/,
    );
  });
});

describe("I1 · clear-on-success · runs AFTER the outer try/catch", () => {
  it("the clear block reads `if (verticalSubtypePersisted)` AFTER the outer try/catch exits", () => {
    // The outer `catch (e)` of createBusinessAction (identified by
    // its SLUG-COLLISION redirect branch which only exists in this
    // function) must appear BEFORE the clear block · the clear
    // block runs on the success path only.
    const outerCatchIdx = CREATE_BUSINESS.search(
      /\}\s*catch\s*\(\s*e\s*\)\s*\{[\s\S]*?looksLikeSlugCollision/,
    );
    const clearBlockIdx = CREATE_BUSINESS.search(
      /if\s*\(\s*verticalSubtypePersisted\s*\)\s*\{/,
    );
    expect(outerCatchIdx).toBeGreaterThan(-1);
    expect(clearBlockIdx).toBeGreaterThan(-1);
    expect(clearBlockIdx).toBeGreaterThan(outerCatchIdx);
  });

  it("clears BOTH `nex_welcome_vertical` AND the decline sentinel on success", () => {
    // After the Check C hardening the two clears live in separate
    // try/catch blocks · the regex no longer requires them inside
    // one scope, only that both appear under the success guard.
    const guardIdx = CREATE_BUSINESS.search(
      /if\s*\(\s*verticalSubtypePersisted\s*\)\s*\{/,
    );
    expect(guardIdx).toBeGreaterThan(-1);
    const guardSlice = CREATE_BUSINESS.slice(guardIdx);
    expect(guardSlice).toContain("clearVerticalIntent()");
    expect(guardSlice).toContain("clearVerticalDeclined()");
  });

  it("each clear is wrapped in its OWN try/catch so a cookie-clear failure never blocks the success path OR the other clear", () => {
    // The I1 Check C fix made the two clears INDEPENDENT. The
    // regex pins: try { ... clearVerticalIntent() ... } catch
    // and separately: try { ... clearVerticalDeclined() ... } catch.
    expect(CREATE_BUSINESS).toMatch(
      /try\s*\{[\s\S]{0,300}?clearVerticalIntent\(\)[\s\S]{0,200}?\}\s*catch\s*\(\s*clearErr\s*\)/,
    );
    expect(CREATE_BUSINESS).toMatch(
      /try\s*\{[\s\S]{0,300}?clearVerticalDeclined\(\)[\s\S]{0,200}?\}\s*catch\s*\(\s*clearErr\s*\)/,
    );
  });
});

describe("I1 · failure-mode invariants", () => {
  it("REGRESSION · absent cookie means `verticalPresetSubtype` stays null · the subtype write block is skipped · flag stays false · nothing is cleared", () => {
    // The subtype write path only enters if BOTH preset fields are
    // present. We pin the conditional so a dropped null-check can't
    // run the Supabase update with partial data.
    expect(CREATE_BUSINESS).toMatch(
      /if\s*\(\s*verticalPresetSubtype\s+&&\s+verticalPresetCategory\s*\)/,
    );
  });

  it("REGRESSION · the preset-read step is itself in a soft-fail try/catch · a corrupted cookie never bricks business creation", () => {
    // The read step: `readVerticalIntent()` + `getPreset()` are
    // wrapped in try/catch and warn on failure. This is a
    // defensive invariant · without it a malformed JSON cookie
    // could throw synchronously before business create begins.
    expect(CREATE_BUSINESS).toMatch(
      /try\s*\{[\s\S]{0,400}?readVerticalIntent[\s\S]{0,400}?getPreset[\s\S]{0,400}?\}\s*catch\s*\(\s*vErr\s*\)/,
    );
  });

  it("REGRESSION · the error branch of the subtype write THROWS so the catch block is reached (flag stays false)", () => {
    // Pins the explicit `throw new Error(profileUpdateErr.message)`
    // inside the error check. Without the throw, a null-error check
    // would still false-positive the write (silently fallthrough)
    // and set `verticalSubtypePersisted = true` incorrectly.
    expect(CREATE_BUSINESS).toMatch(
      /if\s*\(\s*profileUpdateErr\s*\)\s*\{[\s\S]{0,80}?throw\s+new\s+Error\s*\(\s*profileUpdateErr\.message\s*\)/,
    );
  });

  it("the subtype-write success flip is reached only AFTER the throw-on-error check", () => {
    // Order: `.update(...)` → `if (profileUpdateErr) throw` →
    // `verticalSubtypePersisted = true`. Reordering (flipping
    // before the error check) would silently clear the cookie
    // on a failed write.
    const errorCheck = CREATE_BUSINESS.indexOf(
      "if (profileUpdateErr)",
    );
    const flagFlip = CREATE_BUSINESS.indexOf(
      "verticalSubtypePersisted = true",
    );
    expect(errorCheck).toBeGreaterThan(-1);
    expect(flagFlip).toBeGreaterThan(-1);
    expect(flagFlip).toBeGreaterThan(errorCheck);
  });
});

describe("I1 Check B · persistence proves a row was AFFECTED, not just a null error", () => {
  it("the update chains `.select('id').single()` so a zero-row match returns null", () => {
    // Supabase treats `.update().eq()` with zero matches as success
    // (null error). Chaining `.select().single()` returns null when
    // no rows are affected, matching the repo's canonical pattern
    // at business-service.ts:249-260 (updateBusinessProfile).
    expect(CREATE_BUSINESS).toMatch(
      /\.update\(\s*\{\s*profile:\s*nextProfile\s*\}\s*\)[\s\S]{0,100}?\.eq\(\s*"id"\s*,\s*business\.id\s*\)[\s\S]{0,100}?\.select\(\s*"id"\s*\)[\s\S]{0,100}?\.single\(\)/,
    );
  });

  it("destructures BOTH data and error from the update response", () => {
    expect(CREATE_BUSINESS).toMatch(
      /const\s*\{\s*data:\s*profileUpdateRow\s*,\s*error:\s*profileUpdateErr\s*\}/,
    );
  });

  it("REGRESSION · a null data row (zero affected rows) throws before the flag flips", () => {
    // Three must-haves: (1) check error first, (2) check data
    // existence AND id match, (3) only then flip the flag. The
    // regex pins (2) directly: `!profileUpdateRow || profileUpdateRow.id !== business.id` → throw.
    expect(CREATE_BUSINESS).toMatch(
      /if\s*\(\s*!profileUpdateRow\s*\|\|\s*profileUpdateRow\.id\s*!==\s*business\.id\s*\)\s*\{[\s\S]{0,160}?throw\s+new\s+Error/,
    );
  });

  it("the affected-row check appears BEFORE the flag flip", () => {
    const affectedRowCheck = CREATE_BUSINESS.indexOf("!profileUpdateRow");
    const flagFlip = CREATE_BUSINESS.indexOf(
      "verticalSubtypePersisted = true",
    );
    expect(affectedRowCheck).toBeGreaterThan(-1);
    expect(flagFlip).toBeGreaterThan(-1);
    expect(flagFlip).toBeGreaterThan(affectedRowCheck);
  });

  it("the thrown message names 'affected zero rows' so logs make the failure mode obvious", () => {
    expect(CREATE_BUSINESS).toContain("affected zero rows");
  });
});

describe("I1 Check C · cookie cleanups are INDEPENDENT", () => {
  it("clearVerticalIntent lives in its own try/catch, separate from clearVerticalDeclined", () => {
    // Each clear has its own try/catch · one failure can't block
    // the other. The regex pins the structure: try { ... clearVertical­Intent } catch
    // ... try { ... clearVerticalDeclined } catch.
    expect(CREATE_BUSINESS).toMatch(
      /try\s*\{[\s\S]{0,400}?clearVerticalIntent\(\)[\s\S]{0,200}?\}\s*catch\s*\(\s*clearErr\s*\)[\s\S]{0,400}?\}[\s\S]{0,400}?try\s*\{[\s\S]{0,400}?clearVerticalDeclined\(\)[\s\S]{0,200}?\}\s*catch\s*\(\s*clearErr\s*\)/,
    );
  });

  it("REGRESSION · the two clear calls are NOT inside the SAME try/catch (previous shape)", () => {
    // The old shape `try { clear1(); clear2(); } catch` would stop
    // clear2 if clear1 threw. The negative assertion catches any
    // regression that reunites them.
    expect(CREATE_BUSINESS).not.toMatch(
      /try\s*\{[\s\S]{0,100}?clearVerticalIntent\(\)[\s\S]{0,100}?clearVerticalDeclined\(\)[\s\S]{0,100}?\}\s*catch/,
    );
  });

  it("each clear has its own distinct warn message (naming the cookie that failed)", () => {
    expect(CREATE_BUSINESS).toContain("nex_welcome_vertical clear soft-fail");
    expect(CREATE_BUSINESS).toContain(
      "nex_welcome_vertical_declined clear soft-fail",
    );
  });

  it("both clears live INSIDE the `if (verticalSubtypePersisted)` block (never fire on failure)", () => {
    const guardIdx = CREATE_BUSINESS.search(
      /if\s*\(\s*verticalSubtypePersisted\s*\)\s*\{/,
    );
    const intentClearIdx = CREATE_BUSINESS.indexOf("clearVerticalIntent()");
    const declinedClearIdx = CREATE_BUSINESS.indexOf(
      "clearVerticalDeclined()",
    );
    expect(guardIdx).toBeGreaterThan(-1);
    expect(intentClearIdx).toBeGreaterThan(guardIdx);
    expect(declinedClearIdx).toBeGreaterThan(guardIdx);
  });
});

describe("I1 · belt-and-braces · saveBusinessActivationAction still clears both cookies", () => {
  it("activation clears nex_welcome_vertical", () => {
    expect(ACTIVATION_SRC).toContain("clearVerticalIntent()");
  });

  it("activation clears the decline sentinel too (owner-authorised R1 adjunct)", () => {
    expect(ACTIVATION_SRC).toContain("clearVerticalDeclined()");
  });

  it("activation clears only on the SUCCESS path (after `revalidatePath` fires, before `return { ok: true }`)", () => {
    // Positional check · revalidatePath → clearVerticalIntent →
    // `return { ok: true` all appear in order. Pre-success returns
    // short-circuit before this block so a failed activation never
    // reaches the clear.
    const revalidateIdx = ACTIVATION_SRC.search(
      /revalidatePath\(\s*"\/nex-native\/home"\s*\)/,
    );
    const clearIdx = ACTIVATION_SRC.indexOf("clearVerticalIntent()");
    const returnOkIdx = ACTIVATION_SRC.search(/return\s*\{\s*ok:\s*true/);
    expect(revalidateIdx).toBeGreaterThan(-1);
    expect(clearIdx).toBeGreaterThan(-1);
    expect(returnOkIdx).toBeGreaterThan(-1);
    expect(clearIdx).toBeGreaterThan(revalidateIdx);
    expect(returnOkIdx).toBeGreaterThan(clearIdx);
  });
});
