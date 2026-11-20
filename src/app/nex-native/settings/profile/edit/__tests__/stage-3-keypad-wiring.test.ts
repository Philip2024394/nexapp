// src/app/nex-native/settings/profile/edit/__tests__/stage-3-keypad-wiring.test.ts
//
// Stage 3 keypad rollout · source-shape regressions for the three
// eligible profile-edit client fields: about-me textarea, address
// textarea, and the Other-profession free-text input.
// Added 2026-11-17 during the Keypad + Private-Content pass.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string): string =>
  readFileSync(resolve(__dirname, "..", rel), "utf8");

const ABOUT_SRC = read("_about-me-field.tsx");
const ADDRESS_SRC = read("_address-with-location.tsx");
const PROF_SRC = read("_profession-picker.tsx");

describe("Stage 3 keypad wiring · about-me field", () => {
  it("imports NexTextarea from the shared barrel", () => {
    expect(ABOUT_SRC).toMatch(
      /import \{ NexTextarea \} from "@\/lib\/nex-native\/nex-keyboard"/,
    );
  });

  it("renders NexTextarea with name=\"about_me\" and maxLength=MAX_CHARS", () => {
    expect(ABOUT_SRC).toMatch(/<NexTextarea[\s\S]{0,400}name="about_me"/);
    expect(ABOUT_SRC).toMatch(/<NexTextarea[\s\S]{0,400}maxLength=\{MAX_CHARS\}/);
  });

  it("preserves the 500-char slice contract in onChange", () => {
    expect(ABOUT_SRC).toMatch(
      /<NexTextarea[\s\S]{0,400}onChange=\{\(next\) => setValue\(next\.slice\(0, MAX_CHARS\)\)\}/,
    );
  });

  it("no raw <textarea> remains for about_me", () => {
    expect(ABOUT_SRC).not.toMatch(/<textarea[\s\S]{0,200}name="about_me"/);
  });
});

describe("Stage 3 keypad wiring · address-with-location field", () => {
  it("imports NexTextarea from the shared barrel", () => {
    expect(ADDRESS_SRC).toMatch(
      /import \{ NexTextarea \} from "@\/lib\/nex-native\/nex-keyboard"/,
    );
  });

  it("renders NexTextarea with name=\"address\" and maxLength=300", () => {
    expect(ADDRESS_SRC).toMatch(/<NexTextarea[\s\S]{0,400}name="address"/);
    expect(ADDRESS_SRC).toMatch(/<NexTextarea[\s\S]{0,400}maxLength=\{300\}/);
  });

  it("preserves the 300-char slice contract and status-side-effect in onChange", () => {
    expect(ADDRESS_SRC).toMatch(
      /<NexTextarea[\s\S]{0,600}onChange=\{\(next\) => \{\s*setValue\(next\.slice\(0, 300\)\);\s*if \(status === "set"\) setStatus\("idle"\);\s*\}\}/,
    );
  });

  it("no raw <textarea> remains for the address field", () => {
    expect(ADDRESS_SRC).not.toMatch(/<textarea[\s\S]{0,200}name="address"/);
  });
});

describe("Stage 3 keypad wiring · profession picker other-text input", () => {
  it("imports NexInput from the shared barrel", () => {
    expect(PROF_SRC).toMatch(
      /import \{ NexInput \} from "@\/lib\/nex-native\/nex-keyboard"/,
    );
  });

  it("renders NexInput for the free-text Other profession entry", () => {
    expect(PROF_SRC).toMatch(
      /<NexInput[\s\S]{0,400}aria-label="Enter your profession"/,
    );
  });

  it("preserves maxLength=80 and the slice contract", () => {
    expect(PROF_SRC).toMatch(/<NexInput[\s\S]{0,400}maxLength=\{80\}/);
    expect(PROF_SRC).toMatch(
      /<NexInput[\s\S]{0,400}onChange=\{\(next\) => setOtherText\(next\.slice\(0, 80\)\)\}/,
    );
  });

  it("preserves the autoFocus prop", () => {
    expect(PROF_SRC).toMatch(/<NexInput[\s\S]{0,400}autoFocus/);
  });

  it("hidden form input <input type=\"hidden\" name=\"profession\"> remains native", () => {
    expect(PROF_SRC).toMatch(/<input[\s\S]{0,200}type="hidden"[\s\S]{0,200}name="profession"/);
  });
});
