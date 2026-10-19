// src/app/nex-native/call/preview/__tests__/preview-honesty.test.ts
//
// NEX Call Preview · preview-honesty regression guards.
// Owner-authorised Phase 1B build 2026-10-19.
// -----------------------------------------------------------------------------
// The /call/preview route is a design-review surface (not dev-gated,
// not linked from public nav, but reachable via direct URL). These
// tests make sure it can never silently drift into pretending to be
// a live call surface:
//
//   · The dev-preview ribbon ("DEV PREVIEW · not a live call") must
//     be present so a direct-URL visitor is told immediately.
//   · "Coming later" aria-labels + disabled attributes on every
//     unwired control (Audio · More · Add people) must remain · the
//     labels are honest today and must stay honest.
//   · The connection footer passes null quality so the chrome
//     renders the honest "Measuring…" placeholder.
//   · The End Call handler must not claim to end a real call · it
//     only routes back to the Calls hub.
//   · No public nav links the preview URL · reachability is
//     direct-URL only.

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../../../..");
const PREVIEW_PAGE = path.join(REPO_ROOT, "src/app/nex-native/call/preview/page.tsx");
const PREVIEW_SHELL = path.join(REPO_ROOT, "src/app/nex-native/call/preview/_control-bar-shell.tsx");

const PAGE_SRC = fs.readFileSync(PREVIEW_PAGE, "utf8");
const SHELL_SRC = fs.readFileSync(PREVIEW_SHELL, "utf8");

describe("A · dev-preview ribbon makes the preview intent unambiguous", () => {
  it("mounts a visible ribbon with the honest 'dev preview' marker", () => {
    expect(PAGE_SRC).toContain("data-nex-call-preview-dev-ribbon");
    expect(PAGE_SRC.toLowerCase()).toMatch(/dev preview/);
    expect(PAGE_SRC.toLowerCase()).toContain("not a live call");
  });

  it("ribbon has an accessible status role", () => {
    expect(PAGE_SRC).toMatch(/role=["']status["']/);
  });
});

// ─── A2 · R4 production access-control gate (owner-approved 2026-10-19) ─

describe("A2 · production access-control gate · matches the sealed /dev/* pattern", () => {
  it("imports notFound from next/navigation", () => {
    expect(PAGE_SRC).toMatch(/import\s*\{\s*notFound\s*\}\s*from\s*["']next\/navigation["']/);
  });

  it("page body gates on NODE_ENV !== 'production' with NEX_DEV_ROUTES=1 override", () => {
    expect(PAGE_SRC).toMatch(/const\s+isDev\s*=\s*process\.env\.NODE_ENV\s*!==\s*["']production["']/);
    expect(PAGE_SRC).toMatch(/const\s+prodOverride\s*=\s*process\.env\.NEX_DEV_ROUTES\s*===\s*["']1["']/);
    expect(PAGE_SRC).toMatch(/if\s*\(\s*!isDev\s*&&\s*!prodOverride\s*\)\s*notFound\(\)/);
  });

  it("gate appears BEFORE any mock data is picked (short-circuit before render)", () => {
    const gateAt = PAGE_SRC.indexOf("if (!isDev && !prodOverride) notFound()");
    const mockPickAt = PAGE_SRC.indexOf("MOCK_PARTICIPANTS[0]");
    expect(gateAt, "gate must exist").toBeGreaterThan(-1);
    expect(mockPickAt, "mock data pick must exist").toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(mockPickAt);
  });

  it("the ribbon remains alongside the gate (belt-and-braces honesty for NEX_DEV_ROUTES=1 sessions)", () => {
    expect(PAGE_SRC).toContain("data-nex-call-preview-dev-ribbon");
  });

  it("matches the sealed convention · /dev/standard-experience-preview uses the SAME gate", () => {
    // Cross-reference the sealed dev-route pattern so a drift between
    // the two is caught here. If the sealed route is ever retired or
    // its gate pattern changes, this test prompts a doctrine review.
    const sealedDevRoute = fs.readFileSync(
      path.join(REPO_ROOT, "src/app/nex-native/dev/standard-experience-preview/page.tsx"),
      "utf8",
    );
    expect(sealedDevRoute).toMatch(/const\s+isDev\s*=\s*process\.env\.NODE_ENV\s*!==\s*["']production["']/);
    expect(sealedDevRoute).toMatch(/if\s*\(\s*!isDev\s*&&\s*!prodOverride\s*\)\s*notFound\(\)/);
  });
});

describe("B · unwired controls carry honest 'coming later' disabled affordances", () => {
  it("Add people button is disabled with a 'coming later' aria-label + title", () => {
    expect(PAGE_SRC).toContain('aria-label="Add people · coming later"');
    expect(PAGE_SRC).toContain('title="Add people · coming later"');
    // The button must also carry the disabled attribute · a
    // 'coming later' label on an enabled button is a dark pattern.
    expect(PAGE_SRC).toMatch(/<button[^>]*disabled[\s\S]{0,200}aria-label="Add people/);
  });
});

describe("C · connection footer never fabricates a quality label", () => {
  it("passes quality={null} so the chrome honestly renders 'Measuring…'", () => {
    expect(PAGE_SRC).toMatch(/<ConnectionFooter\s+quality=\{\s*null\s*\}/);
  });
});

describe("D · End Call handler does not claim to end a real call", () => {
  it("preview End Call routes to the Calls hub (no engine teardown · no server action)", () => {
    expect(SHELL_SRC).toMatch(/onEndCall=\{\s*\(\)\s*=>\s*router\.push\s*\(\s*["'`]\/nex-native\/calls["'`]\s*\)/);
    // No reference to leaveGroupCallAction / endGroupCallAction / peerCall.hangup
    // · those are live-call concerns that the preview must not touch.
    expect(SHELL_SRC).not.toMatch(/leaveGroupCallAction|endGroupCallAction|peerCall|\.hangup\(/);
  });

  it("preview Mute + Camera are explicitly local-state toggles with NO engine attached", () => {
    expect(SHELL_SRC).toMatch(/onToggleMute=\{\s*\(\)\s*=>\s*setMuted\(\(v\)\s*=>\s*!v\)/);
    expect(SHELL_SRC).toMatch(/onToggleCamera=\{\s*\(\)\s*=>\s*setCameraOff\(\(v\)\s*=>\s*!v\)/);
    // The shell's own doctrine comment says "visual flip only · no
    // engine attached in the preview" · catches a developer wiring
    // in an engine call here that would then run on mock data.
    expect(SHELL_SRC.toLowerCase()).toMatch(/visual flip only|no engine attached/);
    expect(SHELL_SRC).not.toMatch(/engineRef|setMuted\(next\)|setCameraOff\(off\)/);
  });
});

describe("E · preview is not advertised from public navigation", () => {
  // Owner's rule for Phase 1B · preview reachability is direct-URL
  // only. This test fails loudly if someone wires a public nav or
  // hub tile to /call/preview, which would expose the ribbon-labelled
  // preview to ordinary users as a feature link.
  it("no production file under src/app or src/components links to /call/preview via href", () => {
    const roots = [
      path.join(REPO_ROOT, "src/app/nex-native"),
      path.join(REPO_ROOT, "src/components"),
    ];
    const needle = /href=["'`]\/nex-native\/call\/preview/;
    function walk(dir: string, acc: string[]) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        // Skip the preview folder itself + any __tests__ folder.
        if (entry.name === "preview" && dir.endsWith("call")) continue;
        if (entry.name === "__tests__") continue;
        if (entry.isDirectory()) walk(full, acc);
        else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
          const src = fs.readFileSync(full, "utf8");
          if (needle.test(src)) acc.push(full);
        }
      }
    }
    const matches: string[] = [];
    for (const r of roots) walk(r, matches);
    expect(matches, `Public code must not link /call/preview · found in:\n${matches.join("\n")}`)
      .toEqual([]);
  });
});
