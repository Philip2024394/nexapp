// src/app/nex-native/post-signup-apply/__tests__/post-signup-apply.test.ts
//
// Phase 0 integration · guard the invariants of the post-signup replay
// intercept route. We avoid rendering the full server page (no DB in
// vitest) and instead test the pure helpers it depends on + confirm
// the page source itself keeps the required guard shape.

import { describe, test, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

vi.mock("server-only", () => ({}));

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
const PAGE = path.join(
  REPO_ROOT,
  "src/app/nex-native/post-signup-apply/page.tsx",
);

describe("Phase 0 · post-signup-apply guard shape", () => {
  const src = fs.readFileSync(PAGE, "utf8");

  test("page uses resolveNexAppSessionOrGuest · never bypasses the auth helper", () => {
    expect(src).toContain("resolveNexAppSessionOrGuest");
  });

  test("guest branch redirects back to /sign-in (does not consume cookie)", () => {
    // The guest branch MUST route to /sign-in · if it consumed the
    // cookie the user would lose their pending state during a bad auth
    // transition. Explicit guard against that.
    expect(src).toMatch(/if\s*\(\s*viewer\.kind\s*===\s*"guest"\s*\)[\s\S]{0,200}redirect\("\/nex-native\/sign-in"\)/);
    // The guest branch must NOT call consumePendingAccountWall before
    // the auth guard. Compare offsets of the actual CALL sites, not
    // doctrine-comment mentions of the identifier.
    const guestBranchIndex = src.indexOf('viewer.kind === "guest"');
    const consumeCallIndex = src.indexOf("await consumePendingAccountWall(");
    expect(guestBranchIndex).toBeGreaterThan(0);
    expect(consumeCallIndex).toBeGreaterThan(guestBranchIndex);
  });

  test("consumption is one-shot (consumePendingAccountWall · not peek)", () => {
    expect(src).toContain("await consumePendingAccountWall(");
    // Peek would allow replay · guard against drift at the CALL site
    // (doctrine comments elsewhere may legitimately mention peek).
    expect(src).not.toContain("await peekPendingAccountWall(");
  });

  test("nextUrl is RE-validated server-side (defence in depth)", () => {
    expect(src).toContain("isAllowedNextUrl(pending.nextUrl)");
  });

  test("fallback destination is /nex-native/home (safe local path)", () => {
    expect(src).toContain('"/nex-native/home"');
  });

  test("pick-theme branch applies the sealed catalogue + tier validation", () => {
    expect(src).toContain("applyPickTheme");
    expect(src).toContain("chatThemeService.getThemeById");
    expect(src).toContain("effectiveTier");
  });

  test("consequential actions do NOT auto-execute (only redirect)", () => {
    // The switch cases for order-product / message-business / etc.
    // must not call any mutating service. Verify by searching for
    // any order/message/post service import — the file should import
    // ONLY the theme service + account helpers.
    expect(src).not.toContain("peer-message-service");
    expect(src).not.toContain("order-service");
    expect(src).not.toContain("business-service");
    expect(src).not.toContain("community-service");
  });

  test("page is marked force-dynamic (always runs server-side)", () => {
    expect(src).toContain('export const dynamic = "force-dynamic"');
  });
});

describe("Phase 0 · signup + sign-in divert to intercept", () => {
  const actions = fs.readFileSync(
    path.join(REPO_ROOT, "src/app/nex-native/_actions.ts"),
    "utf8",
  );

  test("createNexAccountAction peeks pending wall before default post-signup redirect", () => {
    const createIdx = actions.indexOf("createNexAccountAction");
    const peekIdx = actions.indexOf("peekPendingAccountWall", createIdx);
    // Task #32 · 2026-10-11 · default redirect for a cold signup is
    // now /create-account/pick-theme (the sealed post-signup theme
    // choice surface) instead of /create-account/welcome. The
    // pick-theme page itself redirects onward to /welcome after a
    // selection or skip.
    const pickThemeIdx = actions.indexOf(
      "/create-account/pick-theme",
      peekIdx,
    );
    expect(createIdx).toBeGreaterThan(0);
    expect(peekIdx).toBeGreaterThan(createIdx);
    expect(pickThemeIdx).toBeGreaterThan(peekIdx);
  });

  test("signInAction peeks pending wall before default home redirect", () => {
    const signIdx = actions.indexOf("signInAction");
    const peekIdx = actions.indexOf("peekPendingAccountWall", signIdx);
    expect(signIdx).toBeGreaterThan(0);
    expect(peekIdx).toBeGreaterThan(signIdx);
    // The pending-wall divert must appear BEFORE the final home redirect
    // in signInAction's body. We find the first `redirect("/nex-native/home")`
    // AFTER signInAction and confirm the peek precedes it.
    const homeIdx = actions.indexOf(
      'redirect("/nex-native/home")',
      signIdx,
    );
    expect(homeIdx).toBeGreaterThan(peekIdx);
  });
});
