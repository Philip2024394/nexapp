// src/app/nex-native/__tests__/admin-action-role-gates.test.ts
//
// NEX Phase 2.1 completeness · regression anchor for admin server
// actions · owner-sealed 2026-10-18.
// -------------------------------------------------------------------
// Verifies the SEALED invariant: every admin server action
// INDEPENDENTLY calls `requireHqAdmin` · a direct form POST from
// outside the admin page MUST be rejected on its own merits.
//
// This test does NOT invoke the action functions directly (they
// transitively load the full _actions.ts module which pulls in dozens
// of unrelated services · too heavy for a unit test). Instead it
// inspects the SOURCE of each admin action and asserts the sealed
// gate call is present · AND the old hardcoded-email check is absent.
//
// Rationale (owner-sealed): a page-level `requireHqAdmin` is NOT
// sufficient · a malicious caller could POST a crafted form directly
// to the server action's URL. The action must re-verify. This test
// is a static code-level anchor that fails loudly if a future
// refactor accidentally relaxes an admin action's gate.

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ACTIONS_PATH = join(process.cwd(), "src/app/nex-native/_actions.ts");
const ACTIONS_SRC = readFileSync(ACTIONS_PATH, "utf8");

function sliceAction(name: string): string {
  // Finds the function body for `export async function <name>` and
  // returns text up to the next `export async function` boundary.
  const open = ACTIONS_SRC.indexOf(`export async function ${name}`);
  if (open < 0) throw new Error(`cannot find ${name} in _actions.ts`);
  const nextMarker = ACTIONS_SRC.indexOf(
    "export async function ",
    open + `export async function ${name}`.length,
  );
  return nextMarker > 0
    ? ACTIONS_SRC.slice(open, nextMarker)
    : ACTIONS_SRC.slice(open);
}

// ─── A · adminSetAccountTierAction · Phase 2.1 original migration ───

describe("adminSetAccountTierAction · sealed gate invariants", () => {
  const body = sliceAction("adminSetAccountTierAction");

  test("calls requireHqAdmin (independent server-action gate)", () => {
    expect(body).toContain("requireHqAdmin");
  });

  test("uses the sealed hq-authorization helper via dynamic import", () => {
    expect(body).toMatch(
      /from\s+["']@\/lib\/nex-native\/hq-authorization["']|import\(["']@\/lib\/nex-native\/hq-authorization["']\)/,
    );
  });

  test("does NOT contain the retired hardcoded dev-admin email check", () => {
    expect(body).not.toContain(`"dev-admin@nex-native.local"`);
    expect(body).not.toContain(`'dev-admin@nex-native.local'`);
  });

  test("does NOT depend on the retired NEX_ALLOW_DEV_ADMIN env flag (code form)", () => {
    // Match CODE references only · tolerate docstring mentions in
    // the sliced range that belong to the preamble of the next
    // function (slice runs to the next `export async function`
    // boundary which may include subsequent docstrings).
    expect(body).not.toMatch(/process\.env\.NEX_ALLOW_DEV_ADMIN/);
  });

  test("uses non-revealing error banner on authorization failure", () => {
    // The banner message must NOT leak the specific role requirement.
    expect(body).toContain(`"This action is not available."`);
  });
});

// ─── B · adminCreateChatThemeAction · Phase 2.1 completeness fix ─────

describe("adminCreateChatThemeAction · sealed gate invariants (Finding 2.1)", () => {
  const body = sliceAction("adminCreateChatThemeAction");

  test("calls requireHqAdmin (independent server-action gate)", () => {
    expect(body).toContain("requireHqAdmin");
  });

  test("uses the sealed hq-authorization helper via dynamic import", () => {
    expect(body).toMatch(
      /from\s+["']@\/lib\/nex-native\/hq-authorization["']|import\(["']@\/lib\/nex-native\/hq-authorization["']\)/,
    );
  });

  test("does NOT contain the retired hardcoded dev-admin email check", () => {
    expect(body).not.toContain(`"dev-admin@nex-native.local"`);
    expect(body).not.toContain(`'dev-admin@nex-native.local'`);
  });

  test("does NOT depend on the retired NEX_ALLOW_DEV_ADMIN env flag (code form)", () => {
    // Match CODE references only · tolerate docstring mentions in
    // the sliced range that belong to the preamble of the next
    // function (slice runs to the next `export async function`
    // boundary which may include subsequent docstrings).
    expect(body).not.toMatch(/process\.env\.NEX_ALLOW_DEV_ADMIN/);
  });

  test("uses non-revealing error banner on authorization failure", () => {
    expect(body).toContain(`"This action is not available."`);
  });
});

// ─── C · catch-all guard · no OTHER admin action retains the old gate ──

describe("global sealed-invariant · no admin action keeps the retired email gate", () => {
  test("no remaining 'dev-admin@nex-native.local' string in server-action code paths", () => {
    // Comments and docstring references are tolerated · code-level
    // string literals are NOT. We check for the literal in a
    // code-context pattern (preceded by a comparator or assignment).
    const literalMatches = ACTIONS_SRC.match(
      /(===|!==|==|!=|=\s*)["']dev-admin@nex-native\.local["']/g,
    );
    expect(literalMatches ?? []).toEqual([]);
  });

  test("no remaining NEX_ALLOW_DEV_ADMIN env-flag check in server-action code paths", () => {
    // Likewise · exclude comment-only references.
    const envMatches = ACTIONS_SRC.match(
      /process\.env\.NEX_ALLOW_DEV_ADMIN\s*!==?\s*["']1["']/g,
    );
    expect(envMatches ?? []).toEqual([]);
  });
});
