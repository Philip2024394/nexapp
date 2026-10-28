// src/lib/nex-native/nex-keyboard/__tests__/nex-wrappers.test.ts
//
// Owner-authorised 2026-10-24 · Phase 0.5 · source-shape coverage
// for NexInput + NexTextarea wrappers.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const INPUT_SRC = readFileSync(
  resolve(__dirname, "..", "nex-input.tsx"),
  "utf8",
);
const TEXTAREA_SRC = readFileSync(
  resolve(__dirname, "..", "nex-textarea.tsx"),
  "utf8",
);
const INDEX_SRC = readFileSync(resolve(__dirname, "..", "index.ts"), "utf8");

describe("NexInput · module hygiene", () => {
  it('is a "use client" module', () => {
    expect(INPUT_SRC.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("imports JokerKeypad from the sealed path", () => {
    expect(INPUT_SRC).toMatch(
      /from "@\/app\/nex-native\/chat-standard\/_joker-keypad"/,
    );
  });

  it("imports isNexKeypadSupported from the local helper", () => {
    expect(INPUT_SRC).toMatch(
      /import \{ isNexKeypadSupported \} from "\.\/is-nex-keypad-supported"/,
    );
  });
});

describe("NexInput · OS keyboard suppression chain", () => {
  it("sets inputMode='none' when keypad is active", () => {
    expect(INPUT_SRC).toMatch(/inputMode=\{keypadActive \? "none" :/);
  });

  it("sets readOnly when keypad is active", () => {
    expect(INPUT_SRC).toMatch(/readOnly=\{keypadActive \|\| nativeProps\.readOnly\}/);
  });

  it("preventDefault on mouseDown when keypad active (desktop)", () => {
    expect(INPUT_SRC).toMatch(/onMouseDown[\s\S]{0,400}e\.preventDefault\(\)/);
  });

  it("no-ops the onChange when keypad is active (keypad owns writes)", () => {
    expect(INPUT_SRC).toMatch(/onChange=\{\(e\) => \{\s*if \(keypadActive\) return;/);
  });

  it("opens the keypad on focus / click / touchstart / mousedown", () => {
    expect(INPUT_SRC).toMatch(/onFocus=/);
    expect(INPUT_SRC).toMatch(/onClick=/);
    expect(INPUT_SRC).toMatch(/onTouchStart=/);
    expect(INPUT_SRC).toMatch(/onMouseDown=/);
  });
});

describe("NexInput · lazy-mount discipline", () => {
  it("keypad only renders after first open", () => {
    expect(INPUT_SRC).toMatch(/keypadActive && keypadEverOpened/);
  });

  it("tracks `keypadEverOpened` to defer the first mount", () => {
    expect(INPUT_SRC).toMatch(/keypadEverOpened/);
  });
});

describe("NexInput · props surface", () => {
  it("accepts a `forceKeypadActive` escape hatch for tests + sandbox", () => {
    expect(INPUT_SRC).toMatch(/forceKeypadActive\?:\s*boolean/);
  });

  it("passes mode='single-line' to the sealed keypad", () => {
    expect(INPUT_SRC).toMatch(/mode="single-line"/);
  });

  it("defaults accentColor to NEX cyan", () => {
    expect(INPUT_SRC).toMatch(/accentColor \?\?\s*"#00AFFF"/);
  });

  it("ships a data-nex-keypad sentinel for the Phase 8 lint rule", () => {
    expect(INPUT_SRC).toMatch(/data-nex-keypad=/);
  });
});

describe("NexTextarea · multiline + mirrors NexInput discipline", () => {
  it('is a "use client" module', () => {
    expect(TEXTAREA_SRC.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("passes mode='multiline' to the sealed keypad", () => {
    expect(TEXTAREA_SRC).toMatch(/mode="multiline"/);
  });

  it("renders a native <textarea>", () => {
    expect(TEXTAREA_SRC).toMatch(/<textarea/);
  });

  it("ships a data-nex-keypad sentinel for the Phase 8 lint rule", () => {
    expect(TEXTAREA_SRC).toMatch(/data-nex-keypad=/);
  });

  it("suppresses the OS keyboard via the same inputMode/readOnly chain", () => {
    expect(TEXTAREA_SRC).toMatch(/inputMode=\{keypadActive \? "none" :/);
    expect(TEXTAREA_SRC).toMatch(/readOnly=\{keypadActive \|\| nativeProps\.readOnly\}/);
  });
});

/* ─── Phase 0 corrective patch C · hydration safety ───────────── */

describe("NexInput · hydration-safe activation (Patch C)", () => {
  it("useState initializer returns false by default (matches SSR)", () => {
    /* The initializer function should return `false` to match the
       server render. forceKeypadActive overrides to its explicit value.
       The real detection runs post-mount in useIsomorphicLayoutEffect. */
    expect(INPUT_SRC).toMatch(
      /useState<boolean>\(\(\) => \{\s*if \(typeof forceKeypadActive === "boolean"\) return forceKeypadActive;\s*return false;\s*\}\)/,
    );
  });

  it("does NOT call isNexKeypadSupported() inside useState initializer", () => {
    /* This is the actual hydration-mismatch fix · calling the helper
       inside the initializer caused server/client first-render
       disagreement because server returns false and client returns
       true for mobile Latin viewports. */
    const useStateBlock = INPUT_SRC.match(
      /const \[keypadActive[\s\S]*?useIsomorphicLayoutEffect/,
    );
    expect(useStateBlock).toBeTruthy();
    const initializer = useStateBlock![0].split(
      "useIsomorphicLayoutEffect",
    )[0]!;
    expect(initializer).not.toMatch(/isNexKeypadSupported\(/);
  });

  it("uses an isomorphic layout effect for the post-hydration update", () => {
    expect(INPUT_SRC).toMatch(/useIsomorphicLayoutEffect/);
    expect(INPUT_SRC).toMatch(
      /typeof window !== "undefined" \? React\.useLayoutEffect : React\.useEffect/,
    );
  });

  it("layout effect calls isNexKeypadSupported() to commit the real value", () => {
    expect(INPUT_SRC).toMatch(
      /useIsomorphicLayoutEffect\(\(\)[\s\S]*?setKeypadActive\(isNexKeypadSupported\(\)\)/,
    );
  });
});

describe("NexTextarea · hydration-safe activation (Patch C)", () => {
  it("useState initializer returns false by default", () => {
    expect(TEXTAREA_SRC).toMatch(
      /useState<boolean>\(\(\) => \{\s*if \(typeof forceKeypadActive === "boolean"\) return forceKeypadActive;\s*return false;\s*\}\)/,
    );
  });

  it("does NOT call isNexKeypadSupported() inside useState initializer", () => {
    const useStateBlock = TEXTAREA_SRC.match(
      /const \[keypadActive[\s\S]*?useIsomorphicLayoutEffect/,
    );
    expect(useStateBlock).toBeTruthy();
    const initializer = useStateBlock![0].split(
      "useIsomorphicLayoutEffect",
    )[0]!;
    expect(initializer).not.toMatch(/isNexKeypadSupported\(/);
  });

  it("uses the isomorphic layout effect", () => {
    expect(TEXTAREA_SRC).toMatch(/useIsomorphicLayoutEffect/);
  });
});

describe("Barrel · public exports", () => {
  it("exports NexInput", () => {
    expect(INDEX_SRC).toMatch(/export \{ NexInput/);
  });

  it("exports NexTextarea", () => {
    expect(INDEX_SRC).toMatch(/export \{ NexTextarea/);
  });

  it("exports isNexKeypadSupported", () => {
    expect(INDEX_SRC).toMatch(/export \{[\s\S]*isNexKeypadSupported/);
  });

  it("exports setNexKeypadPreference", () => {
    expect(INDEX_SRC).toMatch(/setNexKeypadPreference/);
  });

  it("exports the type-only names", () => {
    expect(INDEX_SRC).toMatch(/NexKeypadPreference/);
    expect(INDEX_SRC).toMatch(/IsNexKeypadSupportedOptions/);
  });
});
