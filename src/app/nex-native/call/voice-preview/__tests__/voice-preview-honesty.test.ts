// src/app/nex-native/call/voice-preview/__tests__/voice-preview-honesty.test.ts
//
// NEX Voice-Call Preview · preview-honesty regression guards.
// Owner-authorised 2026-10-20 · voice sibling of the sealed
// /call/preview honesty suite (see
// src/app/nex-native/call/preview/__tests__/preview-honesty.test.ts).
// -----------------------------------------------------------------------------
// Same discipline as the video preview · the voice surface must
// never silently drift into pretending to be a live voice call:
//
//   · Dev-preview ribbon ("DEV PREVIEW · voice · mock data · not a
//     live call") must be present so a direct-URL visitor is told
//     immediately.
//   · "Coming later" aria-labels + disabled attributes on every
//     unwired control (Audio · More · Add people) must remain.
//   · Camera control must be HIDDEN on the voice surface via
//     showCamera={false} on the sealed CallControlBar primitive ·
//     a voice call has no video track to toggle, honest UI.
//   · Connection footer passes null quality so chrome renders
//     the honest "Measuring…" placeholder.
//   · End Call handler must not claim to end a real call · it only
//     routes back to the Calls hub.
//   · Every mock participant has videoOn: false · voice calls do
//     not carry a video track.
//   · No public nav links the voice-preview URL · reachability is
//     direct-URL only (same reachability rule as /call/preview).

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../../../..");
const PREVIEW_PAGE = path.join(
  REPO_ROOT,
  "src/app/nex-native/call/voice-preview/page.tsx",
);
const PREVIEW_SHELL = path.join(
  REPO_ROOT,
  "src/app/nex-native/call/voice-preview/_control-bar-shell.tsx",
);

const PAGE_SRC = fs.readFileSync(PREVIEW_PAGE, "utf8");
const SHELL_SRC = fs.readFileSync(PREVIEW_SHELL, "utf8");

describe("A · dev-preview ribbon makes the voice-preview intent unambiguous", () => {
  it("mounts a visible ribbon with the honest 'dev preview · voice' marker", () => {
    expect(PAGE_SRC).toContain("data-nex-call-voice-preview-dev-ribbon");
    expect(PAGE_SRC.toLowerCase()).toMatch(/dev preview/);
    expect(PAGE_SRC.toLowerCase()).toContain("voice");
    expect(PAGE_SRC.toLowerCase()).toContain("not a live call");
  });

  it("ribbon has an accessible status role", () => {
    expect(PAGE_SRC).toMatch(/role=["']status["']/);
  });
});

describe("A2 · production access-control gate · matches the sealed /dev/* pattern", () => {
  it("imports notFound from next/navigation", () => {
    expect(PAGE_SRC).toMatch(
      /import\s*\{\s*notFound\s*\}\s*from\s*["']next\/navigation["']/,
    );
  });

  it("page body gates on NODE_ENV !== 'production' with NEX_DEV_ROUTES=1 override", () => {
    expect(PAGE_SRC).toMatch(
      /const\s+isDev\s*=\s*process\.env\.NODE_ENV\s*!==\s*["']production["']/,
    );
    expect(PAGE_SRC).toMatch(
      /const\s+prodOverride\s*=\s*process\.env\.NEX_DEV_ROUTES\s*===\s*["']1["']/,
    );
    expect(PAGE_SRC).toMatch(
      /if\s*\(\s*!isDev\s*&&\s*!prodOverride\s*\)\s*notFound\(\)/,
    );
  });

  it("gate appears BEFORE any mock data is picked (short-circuit before render)", () => {
    const gateAt = PAGE_SRC.indexOf("if (!isDev && !prodOverride) notFound()");
    const mockPickAt = PAGE_SRC.indexOf("MOCK_PARTICIPANTS[0]");
    expect(gateAt, "gate must exist").toBeGreaterThan(-1);
    expect(mockPickAt, "mock data pick must exist").toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(mockPickAt);
  });
});

describe("B · unwired controls carry honest 'coming later' disabled affordances", () => {
  it("Add people button is disabled with a 'coming later' aria-label + title", () => {
    expect(PAGE_SRC).toContain('aria-label="Add people · coming later"');
    expect(PAGE_SRC).toContain('title="Add people · coming later"');
    expect(PAGE_SRC).toMatch(
      /<button[^>]*disabled[\s\S]{0,200}aria-label="Add people/,
    );
  });
});

describe("C · connection footer never fabricates a quality label", () => {
  it("passes quality={null} so the chrome honestly renders 'Measuring…'", () => {
    expect(PAGE_SRC).toMatch(/<ConnectionFooter\s+quality=\{\s*null\s*\}/);
  });
});

describe("D · voice-only invariants · no video track · no camera button", () => {
  it("every MOCK_PARTICIPANTS entry has videoOn: false", () => {
    // Grep the file for `videoOn:` entries and assert none are true.
    const matches = PAGE_SRC.match(/videoOn:\s*(true|false)/g) ?? [];
    expect(matches.length, "voice preview must declare videoOn on each tile")
      .toBeGreaterThan(0);
    for (const m of matches) {
      expect(m).toBe("videoOn: false");
    }
  });

  it("voice shell passes showCamera={false} to the sealed CallControlBar", () => {
    expect(SHELL_SRC).toMatch(/showCamera=\{\s*false\s*\}/);
  });

  it("voice shell does NOT render a cameraOff toggle · no video track to toggle", () => {
    // The shell MUST NOT wire a cameraOff setter or pass an
    // onToggleCamera handler to CallControlBar. Matching the actual
    // code patterns (`setCameraOff(...)` call · `onToggleCamera=`
    // JSX attribute) rather than the bare identifier · the doc
    // comments legitimately mention the retired handlers.
    expect(SHELL_SRC).not.toMatch(/setCameraOff\(/);
    expect(SHELL_SRC).not.toMatch(/onToggleCamera=/);
  });
});

describe("E · End Call handler does not claim to end a real call", () => {
  it("preview End Call routes to the Calls hub (no engine teardown · no server action)", () => {
    expect(SHELL_SRC).toMatch(
      /onEndCall=\{\s*\(\)\s*=>\s*router\.push\s*\(\s*["'`]\/nex-native\/calls["'`]\s*\)/,
    );
    expect(SHELL_SRC).not.toMatch(
      /leaveGroupCallAction|endGroupCallAction|peerCall|\.hangup\(/,
    );
  });

  it("preview Mute is explicitly a local-state toggle with NO engine attached", () => {
    expect(SHELL_SRC).toMatch(
      /onToggleMute=\{\s*\(\)\s*=>\s*setMuted\(\(v\)\s*=>\s*!v\)/,
    );
    expect(SHELL_SRC.toLowerCase()).toMatch(
      /visual flip only|no engine attached/,
    );
    expect(SHELL_SRC).not.toMatch(/engineRef|setMuted\(next\)/);
  });
});

describe("F · voice preview is not advertised from public navigation", () => {
  // Reachability rule mirrors the sealed /call/preview Phase 1B rule.
  // If someone wires a public nav or hub tile to /call/voice-preview,
  // this test fails loudly so the ribbon-labelled preview is not
  // exposed to ordinary users as a shippable feature link.
  it("no production file under src/app or src/components links to /call/voice-preview via href", () => {
    const roots = [
      path.join(REPO_ROOT, "src/app/nex-native"),
      path.join(REPO_ROOT, "src/components"),
    ];
    const needle = /href=["'`]\/nex-native\/call\/voice-preview/;
    function walk(dir: string, acc: string[]) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.name === "voice-preview" && dir.endsWith("call")) continue;
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
    expect(
      matches,
      `Public code must not link /call/voice-preview · found in:\n${matches.join(
        "\n",
      )}`,
    ).toEqual([]);
  });
});
