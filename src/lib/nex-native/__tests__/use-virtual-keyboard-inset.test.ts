// src/lib/nex-native/__tests__/use-virtual-keyboard-inset.test.ts
//
// NEX · useVirtualKeyboardInset · 2026-10-15 · Phase B.1a.
// -----------------------------------------------------------------------------
// Source-shape + export-identity tests. Runtime behaviour (actually
// subscribing to visualViewport events in a mounted component)
// requires a React renderer, which this repo does NOT ship (no
// @testing-library/react, no react-dom/test-utils wiring).
//
// The B.1a owner directive forbids introducing new dependencies, so
// the hook's runtime behaviour is verified by:
//   (a) deterministic source-shape asserts in this file (SSR guard,
//       listener attach + detach, rAF cleanup, correct formula, zero
//       default)
//   (b) manual real-device verification on an iPhone with Safari
//       (explicitly flagged in the Phase B.1a report)
//
// If @testing-library/react is adopted later we can extend this
// file with mounted-hook runtime tests. For now the shape coverage
// is the honest contract.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useVirtualKeyboardInset } from "../use-virtual-keyboard-inset";

const SRC = readFileSync(
  resolve(__dirname, "..", "use-virtual-keyboard-inset.ts"),
  "utf8",
);

/* ─── A · source shape ──────────────────────────────────────── */

describe("useVirtualKeyboardInset · source shape", () => {
  it("is a 'use client' module", () => {
    expect(SRC.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("exports the hook with the correct name + is a function", () => {
    expect(SRC).toContain("export function useVirtualKeyboardInset()");
    expect(typeof useVirtualKeyboardInset).toBe("function");
    expect(useVirtualKeyboardInset.name).toBe("useVirtualKeyboardInset");
  });

  it("guards against missing window / visualViewport (SSR + older browsers)", () => {
    expect(SRC).toContain('typeof window === "undefined"');
    expect(SRC).toContain("window.visualViewport");
    expect(SRC).toMatch(/if\s*\(!vv\)\s*return/);
  });

  it("initial state is 0 (zero inset until the first measurement)", () => {
    // The hook body contains `useState<number>(0)` so React mounts
    // with inset === 0 and callers see "no keyboard" until proven
    // otherwise · critical for the progressive-enhancement contract.
    expect(SRC).toContain("useState<number>(0)");
  });

  it("subscribes to both resize AND scroll on visualViewport (iOS fires both)", () => {
    expect(SRC).toMatch(/vv\.addEventListener\(\s*["']resize["']/);
    expect(SRC).toMatch(/vv\.addEventListener\(\s*["']scroll["']/);
  });

  it("removes both listeners on unmount (no leak)", () => {
    expect(SRC).toMatch(/vv\.removeEventListener\(\s*["']resize["']/);
    expect(SRC).toMatch(/vv\.removeEventListener\(\s*["']scroll["']/);
  });

  it("cancels any pending rAF on unmount", () => {
    expect(SRC).toContain("cancelAnimationFrame(frame)");
  });

  it("rounds to integers + clamps to >=0 (no sub-pixel React thrash)", () => {
    expect(SRC).toContain("Math.round(raw)");
    expect(SRC).toContain("Math.max(0,");
  });

  it("formula is layout.innerHeight - visual.height - visual.offsetTop", () => {
    expect(SRC).toMatch(
      /window\.innerHeight\s*-\s*vv\.height\s*-\s*vv\.offsetTop/,
    );
  });

  it("uses setState with the equality short-circuit (no spurious renders)", () => {
    // Expected pattern: setInset((prev) => (prev === next ? prev : next))
    expect(SRC).toMatch(/setInset\(\s*\(prev\)\s*=>\s*\(?\s*prev\s*===\s*next/);
  });

  it("schedules compute via requestAnimationFrame (batches storm of events)", () => {
    expect(SRC).toContain("requestAnimationFrame");
    expect(SRC).toContain("scheduleCompute");
  });
});

/* ─── B · caller integration · universal composer footer ────── */

describe("useVirtualKeyboardInset · caller integration", () => {
  const COMPOSER_SRC = readFileSync(
    resolve(
      __dirname,
      "..",
      "..",
      "..",
      "app",
      "nex-native",
      "chat-standard",
      "_universal-composer-footer.tsx",
    ),
    "utf8",
  );

  it("universal composer imports the hook", () => {
    expect(COMPOSER_SRC).toMatch(
      /import\s*\{\s*useVirtualKeyboardInset\s*\}\s*from\s*["']@\/lib\/nex-native\/use-virtual-keyboard-inset["']/,
    );
  });

  it("universal composer invokes the hook (one call site)", () => {
    expect(COMPOSER_SRC).toMatch(
      /const\s+keyboardInset\s*=\s*useVirtualKeyboardInset\(\s*\)/,
    );
  });

  it("universal composer lifts the fixed overlay via translateY(-keyboardInset)", () => {
    expect(COMPOSER_SRC).toMatch(
      /transform:\s*keyboardInset\s*>\s*0\s*\?\s*`translateY\(-\$\{keyboardInset\}px\)`/,
    );
  });

  it("universal composer exposes the inset on a data attribute for e2e/debugging", () => {
    expect(COMPOSER_SRC).toContain('data-nex-keyboard-inset={keyboardInset}');
  });

  it("universal composer applies the lift ONLY on the fixed overlay (not elsewhere)", () => {
    // Exactly one translateY(-${keyboardInset}px) call site.
    const matches =
      COMPOSER_SRC.match(/translateY\(-\$\{keyboardInset\}px\)/g) || [];
    expect(matches.length).toBe(1);
  });
});
