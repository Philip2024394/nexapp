// src/lib/nex-native/__tests__/badge-sync-contract.test.ts
//
// Owner directive 2026-10-16 · home-screen app-badge contract tests.
// Verifies the invariants the Badge feature depends on without
// hitting the live DB (we exercise the shape, not the data path).
//
// Covers:
//   1. `countTotalUnreadPeerMessages` is exported from the sealed
//      peer-message-service module with the expected signature.
//   2. The service worker (`/public/nex-native-sw.js`) feature-detects
//      `self.navigator.setAppBadge` before calling it (no throw on
//      iOS Safari / Firefox).
//   3. The service worker clamps the badge count into a safe range
//      [0, 9999] before passing it to the Badging API.
//   4. The `/api/nex-native/unread-count` route returns `{ count: 0 }`
//      on error / anonymous (never 404s, never leaks).
//   5. The client badge-sync component is feature-detected and ships
//      no fake-UI path when `navigator.setAppBadge` is absent.
//   6. The install button component (`_install-home-button-client`)
//      hides itself when the PWA is already installed.

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO = path.resolve(__dirname, "..", "..", "..", "..");

function readRepoFile(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), "utf8");
}

describe("home-screen app-badge · contract tests", () => {
  it("peer-message-service exports countTotalUnreadPeerMessages", async () => {
    const src = readRepoFile("src/lib/nex-native/peer-message-service.ts");
    // Export declaration + Promise<number> return type (allow the
    // argument list to span lines).
    expect(src).toMatch(
      /export\s+async\s+function\s+countTotalUnreadPeerMessages\s*\([\s\S]*?Promise<number>/,
    );
    // Argument name is viewerAccountId with NexUuid type.
    expect(src).toMatch(/viewerAccountId:\s*NexUuid/);
    // Uses the sealed read_at IS NULL + sender != viewer predicate.
    expect(src).toMatch(/\.is\s*\(\s*["']read_at["']\s*,\s*null\s*\)/);
    expect(src).toMatch(
      /\.neq\s*\(\s*["']sender_account_id["']\s*,\s*viewerAccountId\s*\)/,
    );
    // Fails CLOSED on DB error (returns 0, not NaN or null).
    expect(src).toMatch(/if\s*\(\s*error\s*\)\s*return\s+0\s*;/);
  });

  it("service worker feature-detects navigator.setAppBadge before calling", () => {
    const sw = readRepoFile("public/nex-native-sw.js");
    // Must have an explicit typeof === "function" guard BEFORE the
    // call site. The pattern checks that the guard appears somewhere
    // ABOVE the setAppBadge invocation in the file (defensive, no
    // regex capture of program-order; good enough since the SW is
    // one small file with one call site).
    expect(sw).toMatch(
      /typeof\s+self\.navigator\.setAppBadge\s*===\s*["']function["']/,
    );
    const guardIdx = sw.indexOf("typeof self.navigator.setAppBadge");
    const callIdx = sw.indexOf("self.navigator.setAppBadge(");
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    expect(callIdx).toBeGreaterThan(guardIdx);
    // Must clamp the count before applying (defence against hostile
    // payloads).
    expect(sw).toMatch(/Math\.max\s*\(\s*0\s*,/);
    expect(sw).toMatch(/Math\.min\s*\(\s*9999/);
    // Must call clearAppBadge when count is 0.
    expect(sw).toMatch(/clearAppBadge\s*\(\s*\)/);
    // All badge calls must be wrapped in .catch so an unexpected
    // rejection cannot propagate out of the push handler.
    expect(sw).toMatch(/\.setAppBadge\(count\)\.catch\(/);
    expect(sw).toMatch(/\.clearAppBadge\(\)\.catch\(/);
  });

  it("unread-count route returns { count: 0 } on error (no leak, no 404)", () => {
    const src = readRepoFile("src/app/api/nex-native/unread-count/route.ts");
    // Fail-closed to zero on any thrown error.
    expect(src).toMatch(/catch\s*\{[\s\S]*?NextResponse\.json\(\s*\{\s*count:\s*0/);
    // Returns zero for anonymous session (no leak).
    expect(src).toMatch(/if\s*\(\s*!session\s*\)[\s\S]*?count:\s*0/);
    // No-store cache header (badge must reflect current state).
    expect(src).toMatch(/cache-control["\s:]+no-store/);
  });

  it("badge-sync client feature-detects the Badging API", () => {
    const src = readRepoFile(
      "src/app/nex-native/_app-badge-sync-client.tsx",
    );
    // Must check for setAppBadge presence before use.
    expect(src).toMatch(
      /typeof\s+nav\.setAppBadge\s*!==\s*["']function["']/,
    );
    // Must early-return (silent degrade) when absent.
    expect(src).toMatch(
      /if\s*\(\s*typeof\s+nav\.setAppBadge\s*!==\s*["']function["']\s*\)\s*return\s*;/,
    );
    // Must call clearAppBadge for count=0 (never leave a stale number).
    expect(src).toMatch(/clearAppBadge\s*\?\s*\.\s*\(\s*\)/);
    // No polling when tab hidden (don't waste cycles / rate-limit).
    expect(src).toMatch(/document\.visibilityState\s*===\s*["']visible["']/);
  });

  it("install button hides when PWA is already installed (standalone)", () => {
    const src = readRepoFile(
      "src/app/nex-native/_install-home-button-client.tsx",
    );
    // Must detect display-mode: standalone.
    expect(src).toMatch(/display-mode:\s*standalone/);
    // Must detect iOS Safari standalone flag.
    expect(src).toMatch(/\.standalone\s*===\s*true/);
    // Must transition to installed state and render null.
    expect(src).toMatch(/kind:\s*["']installed["']/);
    // Must render nothing in hidden/installed state.
    expect(src).toMatch(
      /state\.kind\s*===\s*["']hidden["']\s*\|\|\s*state\.kind\s*===\s*["']installed["']/,
    );
  });

  it("install button never fakes an install success", () => {
    const src = readRepoFile(
      "src/app/nex-native/_install-home-button-client.tsx",
    );
    // Must await the real browser userChoice before marking installed.
    expect(src).toMatch(/userChoice/);
    expect(src).toMatch(/outcome\s*===\s*["']accepted["']/);
    // On iOS the button only shows guidance · no attempt to spoof the
    // native Share sheet (which iOS doesn't permit).
    expect(src).toMatch(/Add to Home Screen/);
  });

  it("push payload carries appBadgeCount only when the recipient computation succeeds", () => {
    const src = readRepoFile("src/app/nex-native/_actions.ts");
    // The dispatch call must spread `appBadgeCount` conditionally (never
    // pass null/undefined to the SW).
    expect(src).toMatch(
      /appBadgeCount\s*!==\s*null\s*\?\s*\{\s*appBadgeCount\s*\}\s*:\s*\{\}/,
    );
    // Must call the sealed countTotalUnreadPeerMessages for the RECIPIENT,
    // not the sender · badge must reflect the recipient's state.
    expect(src).toMatch(
      /peerMessageService\.countTotalUnreadPeerMessages\s*\(\s*peerAccountId\s*\)/,
    );
    // Must swallow computation errors (fire-and-forget rule intact).
    expect(src).toMatch(
      /appBadgeCount:\s*number\s*\|\s*null\s*=\s*null[\s\S]*?catch\s*\{/,
    );
  });

  it("PWA manifest start_url remains /nex-native/contacts (owner invariant)", () => {
    const manifest = JSON.parse(readRepoFile("public/nex.webmanifest"));
    expect(manifest.start_url).toBe("/nex-native/contacts");
    expect(manifest.scope).toBe("/nex-native/");
  });

  it("install button is mounted on exactly the two owner-approved surfaces", () => {
    const welcome = readRepoFile("src/app/nex-native/welcome/page.tsx");
    const landing = readRepoFile(
      "src/app/nex-native/directory/landing/page.tsx",
    );
    expect(welcome).toContain("InstallHomeButtonClient");
    expect(welcome).toMatch(/data-nex-welcome-install-slot/);
    expect(landing).toContain("InstallHomeButtonClient");
    expect(landing).toMatch(/data-nex-landing-install-slot/);
  });
});
