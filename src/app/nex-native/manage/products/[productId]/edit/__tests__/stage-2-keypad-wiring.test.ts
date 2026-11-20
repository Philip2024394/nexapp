// src/app/nex-native/manage/products/[productId]/edit/__tests__/stage-2-keypad-wiring.test.ts
//
// Stage 2 keypad rollout · source-shape regressions for the product
// edit client. Added 2026-11-17 during the Keypad + Private-Content
// pass. Covers the four eligible controls: product name, dispatch
// time, description (textarea), price (numeric-only).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const EDIT_SRC = readFileSync(
  resolve(__dirname, "..", "_edit-client.tsx"),
  "utf8",
);

describe("Stage 2 keypad wiring · product edit client", () => {
  it("imports NexInput and NexTextarea from the shared barrel", () => {
    expect(EDIT_SRC).toMatch(
      /import \{ NexInput, NexTextarea \} from "@\/lib\/nex-native\/nex-keyboard"/,
    );
  });

  it("product name uses NexInput with maxLength=120", () => {
    expect(EDIT_SRC).toMatch(
      /<NexInput[\s\S]{0,400}value=\{name\}[\s\S]{0,200}maxLength=\{120\}/,
    );
  });

  it("dispatch time uses NexInput with maxLength=120 and the placeholder preserved", () => {
    expect(EDIT_SRC).toMatch(
      /<NexInput[\s\S]{0,400}value=\{dispatchTime\}[\s\S]{0,400}placeholder="e\.g\. Ships within 2 business days"/,
    );
  });

  it("description uses NexTextarea with maxLength=500 and rows=3", () => {
    expect(EDIT_SRC).toMatch(
      /<NexTextarea[\s\S]{0,400}value=\{description\}[\s\S]{0,400}maxLength=\{500\}/,
    );
    expect(EDIT_SRC).toMatch(/<NexTextarea[\s\S]{0,400}rows=\{3\}/);
  });

  it("description onChange still enforces the 500-char slice contract", () => {
    expect(EDIT_SRC).toMatch(
      /<NexTextarea[\s\S]{0,400}onChange=\{\(next\) => setDescription\(next\.slice\(0, 500\)\)\}/,
    );
  });

  it("price uses NexInput type=\"number\" with planes={[\"numbers\"]}", () => {
    expect(EDIT_SRC).toMatch(
      /<NexInput[\s\S]{0,600}type="number"[\s\S]{0,400}planes=\{\["numbers"\]\}/,
    );
  });

  it("price preserves min={0} and step=\"0.01\"", () => {
    expect(EDIT_SRC).toMatch(/<NexInput[\s\S]{0,600}value=\{price\}[\s\S]{0,400}min=\{0\}/);
    expect(EDIT_SRC).toMatch(/<NexInput[\s\S]{0,600}value=\{price\}[\s\S]{0,400}step="0\.01"/);
  });

  it("<select> elements for stockStatus, currency, variantType remain native", () => {
    expect(EDIT_SRC).toMatch(/<select[\s\S]{0,200}value=\{stockStatus\}/);
    expect(EDIT_SRC).toMatch(/<select[\s\S]{0,200}value=\{currency\}/);
    expect(EDIT_SRC).toMatch(/<select[\s\S]{0,200}value=\{variantType\}/);
  });

  it("no raw <input> remains for name/dispatchTime/price", () => {
    expect(EDIT_SRC).not.toMatch(/<input[\s\S]{0,200}value=\{name\}/);
    expect(EDIT_SRC).not.toMatch(/<input[\s\S]{0,200}value=\{dispatchTime\}/);
    expect(EDIT_SRC).not.toMatch(/<input[\s\S]{0,200}value=\{price\}/);
  });

  it("no raw <textarea> remains for the description field", () => {
    expect(EDIT_SRC).not.toMatch(/<textarea[\s\S]{0,200}value=\{description\}/);
  });
});
