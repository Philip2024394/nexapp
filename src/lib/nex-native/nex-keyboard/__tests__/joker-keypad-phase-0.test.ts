// src/lib/nex-native/nex-keyboard/__tests__/joker-keypad-phase-0.test.ts
//
// Owner-authorised 2026-10-24 · Phase 0.5 · source-shape regression
// coverage for the backward-compatible extensions to the sealed
// JokerKeypad primitive.
//
// Why source-shape asserts: this repo intentionally does NOT ship
// react-testing-library (sealed in the use-virtual-keyboard-inset
// test · "forbids introducing new dependencies"). Runtime behaviour
// is validated via the sandbox at /nex-native/dev/keypad-sandbox
// and the real-device verification matrix in the Phase 0 report.
// These tests pin the implementation so a future contributor cannot
// accidentally break the Phase 0 contract.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "app",
    "nex-native",
    "chat-standard",
    "_joker-keypad.tsx",
  ),
  "utf8",
);

describe("JokerKeypad · Phase 0.1 extensions · prop surface", () => {
  it("declares the `mode` prop with the sealed union type", () => {
    expect(SRC).toMatch(/mode\?:\s*"chat"\s*\|\s*"single-line"\s*\|\s*"multiline"/);
  });

  it("declares the `planes` prop as readonly Plane[]", () => {
    expect(SRC).toMatch(/planes\?:\s*readonly\s+Plane\[\]/);
  });

  it("declares the `onEnter` callback prop", () => {
    expect(SRC).toMatch(/onEnter\?:\s*\(\)\s*=>\s*void/);
  });

  it("declares the `maxLength` prop as a soft clamp", () => {
    expect(SRC).toMatch(/maxLength\?:\s*number/);
  });
});

describe("JokerKeypad · Phase 0.1 extensions · defaults preserve sealed chat behaviour", () => {
  it("mode defaults to 'chat'", () => {
    expect(SRC).toMatch(/mode\s*=\s*"chat"/);
  });

  it("planes default is undefined (not an empty array)", () => {
    // The destructuring omits a default for `planes` so it stays undefined.
    expect(SRC).toMatch(/initialPlane = "letters",\s*mode = "chat",\s*planes,/);
  });

  it("handleEnterKey falls through to onSend + onClose in chat mode", () => {
    expect(SRC).toMatch(/mode === "chat"[^\n]*\n[^\n]*onSend\(\);[\s\S]{0,120}onClose\(\);/);
  });

  it("Send button retains the empty-input disable guard for chat mode only", () => {
    expect(SRC).toMatch(/disabled=\{mode === "chat" && value\.length === 0\}/);
  });
});

describe("JokerKeypad · Phase 0.1 extensions · multiline mode", () => {
  it("inserts a newline at cursor position in multiline mode", () => {
    expect(SRC).toMatch(/if \(mode === "multiline"\)[\s\S]{0,400}\\n/);
  });

  it("does NOT close the keypad in multiline mode", () => {
    // The multiline branch returns before onClose() is called.
    const multilineBranch = SRC.match(/if \(mode === "multiline"\) \{[\s\S]*?\}/);
    expect(multilineBranch).toBeTruthy();
    expect(multilineBranch?.[0]).not.toMatch(/onClose\(\)/);
  });

  it("respects maxLength inside the newline insert", () => {
    const multilineBranch = SRC.match(/if \(mode === "multiline"\) \{[\s\S]*?\}/);
    expect(multilineBranch?.[0]).toMatch(/maxLength !== undefined/);
  });
});

describe("JokerKeypad · Phase 0.1 extensions · single-line mode", () => {
  it("fires onEnter + onClose in single-line mode", () => {
    expect(SRC).toMatch(/mode === "single-line"[\s\S]{0,200}onEnter\?\.\(\);[\s\S]{0,120}onClose\(\);/);
  });
});

describe("JokerKeypad · Phase 0.1 extensions · plane allow-list", () => {
  it("defines isPlaneAllowed guard", () => {
    expect(SRC).toMatch(/const isPlaneAllowed = React\.useCallback/);
  });

  it("resolves initialPlane against the allow-list via resolvedInitialPlane", () => {
    expect(SRC).toMatch(/resolvedInitialPlane/);
  });

  it("plane toggle rejects disallowed targets", () => {
    expect(SRC).toMatch(/isPlaneAllowed\(target\)\s*\?\s*target\s*:\s*prev/);
  });

  it("every mode-tab is gated on isPlaneAllowed", () => {
    const tabsMatches = SRC.match(/isPlaneAllowed\("(letters|numbers|symbols|emoji|sticker|giphy)"\)/g);
    expect(tabsMatches).toBeTruthy();
    // At minimum: letters OR numbers OR symbols group, emoji, sticker, giphy = 4+ guards
    expect(tabsMatches!.length).toBeGreaterThanOrEqual(4);
  });
});

describe("JokerKeypad · Phase 0.1 extensions · maxLength clamp", () => {
  it("clamps pressKey against maxLength", () => {
    const pressKey = SRC.match(/const pressKey = [\s\S]*?\};/);
    expect(pressKey?.[0]).toMatch(/maxLength !== undefined && next\.length > maxLength/);
  });

  it("clamps pressSpace against maxLength", () => {
    const pressSpace = SRC.match(/const pressSpace = [\s\S]*?\};/);
    expect(pressSpace?.[0]).toMatch(/maxLength !== undefined && next\.length > maxLength/);
  });
});

/* ─── Phase 0 corrective patch A · clipboard paste ──────────── */

describe("JokerKeypad · Phase 0 Patch A · paste KeyCap source shape", () => {
  it("declares a pasteError state", () => {
    expect(SRC).toMatch(/const \[pasteError, setPasteError\] = React\.useState<string \| null>/);
  });

  it("auto-dismisses the pasteError after 3 seconds via useEffect", () => {
    expect(SRC).toMatch(/setPasteError\(null\)/);
    expect(SRC).toMatch(/setTimeout\([\s\S]{0,80}3000\)/);
  });

  it("defines pressPaste as an async handler", () => {
    expect(SRC).toMatch(/const pressPaste = async \(\): Promise<void>/);
  });

  it("guards against unavailable Clipboard API", () => {
    expect(SRC).toMatch(/typeof navigator === "undefined"/);
    expect(SRC).toMatch(/!navigator\.clipboard \|\|\s*typeof navigator\.clipboard\.readText !== "function"/);
    expect(SRC).toMatch(/"Clipboard not available on this device"/);
  });

  it("handles NotAllowedError (permission denied) with user-visible copy", () => {
    expect(SRC).toMatch(/"NotAllowedError"/);
    expect(SRC).toMatch(/"Clipboard permission denied"/);
  });

  it("handles SecurityError (iframe clipboard-read block)", () => {
    expect(SRC).toMatch(/"SecurityError"/);
    expect(SRC).toMatch(/"Clipboard blocked by this page"/);
  });

  it("handles empty-clipboard with a visible message", () => {
    expect(SRC).toMatch(/text\.length === 0/);
    expect(SRC).toMatch(/"Clipboard is empty"/);
  });

  it("surfaces a maxLength-reached message when the clamp eats the paste", () => {
    expect(SRC).toMatch(/"Nothing to paste · maxLength reached"/);
  });

  it("respects maxLength clamp on the inserted segment", () => {
    const pressPasteBlock = SRC.match(/const pressPaste = async[\s\S]*?\n  \};/);
    expect(pressPasteBlock).toBeTruthy();
    expect(pressPasteBlock![0]).toMatch(/maxLength !== undefined/);
    expect(pressPasteBlock![0]).toMatch(/\.slice\(0, maxLength\)/);
  });

  it("inserts paste text at the cursor position", () => {
    const pressPasteBlock = SRC.match(/const pressPaste = async[\s\S]*?\n  \};/);
    expect(pressPasteBlock![0]).toMatch(/value\.slice\(0, cursorPos\) \+ inserted \+ value\.slice\(cursorPos\)/);
  });

  it("advances cursorPos by the inserted length", () => {
    const pressPasteBlock = SRC.match(/const pressPaste = async[\s\S]*?\n  \};/);
    expect(pressPasteBlock![0]).toMatch(/setCursorPos\(cursorPos \+ \(final\.length - value\.length\)\)/);
  });

  it("updates prevValueRef so external value sync stays consistent", () => {
    const pressPasteBlock = SRC.match(/const pressPaste = async[\s\S]*?\n  \};/);
    expect(pressPasteBlock![0]).toMatch(/prevValueRef\.current = final/);
  });

  it("renders a paste button in the top strip with aria-label", () => {
    expect(SRC).toMatch(/aria-label="Paste from clipboard"/);
    expect(SRC).toMatch(/data-nex-keypad-paste/);
  });

  it("fires pressPaste via void (fire-and-forget) on button tap", () => {
    expect(SRC).toMatch(/void pressPaste\(\)/);
  });

  it("renders an aria-live error banner when pasteError is set", () => {
    expect(SRC).toMatch(/data-nex-keypad-paste-error/);
    expect(SRC).toMatch(/aria-live="polite"/);
    expect(SRC).toMatch(/role="status"/);
  });

  it("does NOT log, transmit, or persist clipboard contents · no console/fetch/localStorage write touches `text`", () => {
    const pressPasteBlock = SRC.match(/const pressPaste = async[\s\S]*?\n  \};/);
    expect(pressPasteBlock![0]).not.toMatch(/console\.(log|warn|error|info|debug)/);
    expect(pressPasteBlock![0]).not.toMatch(/fetch\(/);
    expect(pressPasteBlock![0]).not.toMatch(/localStorage\.setItem/);
    expect(pressPasteBlock![0]).not.toMatch(/sessionStorage\.setItem/);
  });

  it("declares a catch-all for unexpected clipboard errors", () => {
    const pressPasteBlock = SRC.match(/const pressPaste = async[\s\S]*?\n  \};/);
    expect(pressPasteBlock![0]).toMatch(/} catch \(err\) \{/);
    expect(pressPasteBlock![0]).toMatch(/"Clipboard paste failed"/);
  });
});

describe("JokerKeypad · Phase 0.1 extensions · byte-equivalent chat defaults", () => {
  it("the sealed KeyCap row Enter still routes to handleEnterKey", () => {
    expect(SRC).toMatch(/glyph="↵"[\s\S]{0,200}onPress=\{handleEnterKey\}/);
  });

  it("existing onSend contract (fires + closes) still reached via chat mode", () => {
    // The chat branch is the FINAL branch of handleEnterKey.
    const handleEnterKey = SRC.match(/const handleEnterKey = \(\): void =>[\s\S]*?\n  \};/);
    expect(handleEnterKey?.[0]).toMatch(/onSend\(\);[\s\S]{0,120}onClose\(\);/);
  });
});
