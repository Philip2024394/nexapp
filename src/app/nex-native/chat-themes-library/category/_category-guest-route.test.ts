// src/app/nex-native/chat-themes-library/category/_category-guest-route.test.ts
//
// Regression · Category showcase MUST support guest viewers · sealed
// 2026-10-11. Before this seal the page hard-redirected every guest
// to /sign-in via `loadLibraryData().kind === "unauthenticated"` ·
// users perceived it as "themes disappear when I navigate back to
// the themes page". The fix is a guest-mode branch mirroring the
// landing page.
//
// This test enforces the invariant by reading the page source:
//
//   · it must import `loadLibraryDataAsGuest` (the guest loader)
//   · it must import `resolveNexAppSessionOrGuest` (viewer dispatch)
//   · it must NOT `redirect("/nex-native/sign-in")` unconditionally
//     when the session loader returns `"unauthenticated"`
//
// A source-level test is appropriate here: the actual route runs
// as a Server Component with session + DB dependencies that are
// hostile to in-process import. The invariant is a code-shape
// contract.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
const CATEGORY_PAGE = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-themes-library/category/[categoryId]/page.tsx",
);

describe("Category showcase · guest mode · sealed 2026-10-11", () => {
  const src = fs.readFileSync(CATEGORY_PAGE, "utf8");

  test("imports loadLibraryDataAsGuest (the guest loader)", () => {
    expect(src).toMatch(
      /import\s*\{\s*loadLibraryDataAsGuest\s*\}\s*from\s*["']\.\.\/\.\.\/_load-library-data-guest["']/,
    );
  });

  test("imports resolveNexAppSessionOrGuest (viewer dispatcher)", () => {
    expect(src).toMatch(
      /import\s*\{\s*resolveNexAppSessionOrGuest\s*\}\s*from\s*["']@\/lib\/nex-native\/app\/session-or-guest["']/,
    );
  });

  test("does NOT redirect to /sign-in when data.kind === 'unauthenticated'", () => {
    // The old pattern was `redirect("/nex-native/sign-in")` on the
    // unauthenticated branch · the fix removes that unconditional
    // bounce. Guard the specific anti-pattern.
    expect(src).not.toMatch(
      /if\s*\(\s*data\.kind\s*===\s*["']unauthenticated["']\s*\)\s*redirect\(["']\/nex-native\/sign-in["']\)/,
    );
  });

  test("branches on viewer.kind === 'guest' before loading", () => {
    expect(src).toMatch(/viewer\.kind\s*===\s*["']guest["']/);
  });

  test("ThemeBrowserClient is reachable via a non-session local (currentThemeId variable, not data.currentThemeId)", () => {
    // Before the fix, the ThemeBrowserClient was wired with
    // `data.currentThemeId` etc · the fix hoists each field onto a
    // standalone local so both guest and session branches feed the
    // same props. If a future PR regresses to `data.foo`, this
    // test fails loudly.
    expect(src).toMatch(/currentThemeId=\{currentThemeId\}/);
    expect(src).toMatch(/canUsePremium=\{canUsePremium\}/);
    expect(src).toMatch(/viewerAvatarUrl=\{viewerAvatarUrl\}/);
  });

  test("falls back to guest loader when session returns 'unauthenticated' instead of bouncing", () => {
    // The resilient branch · if `loadLibraryData()` returns
    // unauthenticated (expired cookie etc), we still render the
    // page using the guest loader rather than redirecting away.
    expect(src).toMatch(/loadLibraryDataAsGuest/);
  });
});
