// src/app/nex-native/manage/shop/setup/__tests__/stage-1-keypad-wiring.test.ts
//
// Stage 1 keypad rollout · source-shape regressions for the three
// seller-setup wizard clients (identity, location, contact).
//
// Added 2026-11-17 during the Keypad + Private-Content pass. Each
// assertion is independent of the others so a future rollback of
// one file surfaces as a scoped failure rather than a cascade.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string): string =>
  readFileSync(resolve(__dirname, "..", rel), "utf8");

const IDENTITY_SRC = read("identity/_client.tsx");
const LOCATION_SRC = read("location/_client.tsx");
const CONTACT_SRC = read("contact/_client.tsx");

describe("Stage 1 keypad wiring · identity wizard", () => {
  it("imports NexInput from the shared nex-keyboard barrel", () => {
    expect(IDENTITY_SRC).toMatch(
      /import \{ NexInput \} from "@\/lib\/nex-native\/nex-keyboard"/,
    );
  });

  it("no longer renders a raw <input> for the shop-name field", () => {
    expect(IDENTITY_SRC).not.toMatch(/<input[\s\S]{0,200}id="shop-name"/);
  });

  it("renders NexInput with id=\"shop-name\" + name=\"displayName\"", () => {
    expect(IDENTITY_SRC).toMatch(
      /<NexInput[\s\S]{0,400}id="shop-name"[\s\S]{0,200}name="displayName"/,
    );
  });

  it("preserves maxLength=40 and autoFocus", () => {
    expect(IDENTITY_SRC).toMatch(/<NexInput[\s\S]{0,400}maxLength=\{40\}/);
    expect(IDENTITY_SRC).toMatch(/<NexInput[\s\S]{0,400}autoFocus/);
  });

  it("file picker <input type=\"file\"> remains raw (security-sensitive exclusion)", () => {
    expect(IDENTITY_SRC).toMatch(/<input[\s\S]{0,200}type="file"/);
  });
});

describe("Stage 1 keypad wiring · location wizard", () => {
  it("imports NexInput and NexTextarea from the shared barrel", () => {
    expect(LOCATION_SRC).toMatch(
      /import \{ NexInput, NexTextarea \} from "@\/lib\/nex-native\/nex-keyboard"/,
    );
  });

  it("no longer renders a raw <input> for the city field", () => {
    expect(LOCATION_SRC).not.toMatch(/<input[\s\S]{0,200}id="shop-city"/);
  });

  it("no longer renders a raw <textarea> for the address field", () => {
    expect(LOCATION_SRC).not.toMatch(/<textarea[\s\S]{0,200}id="shop-address"/);
  });

  it("renders NexInput for shop-city with maxLength=80", () => {
    expect(LOCATION_SRC).toMatch(
      /<NexInput[\s\S]{0,400}id="shop-city"[\s\S]{0,200}maxLength=\{80\}/,
    );
  });

  it("renders NexTextarea for shop-address with maxLength=500 and rows=2", () => {
    expect(LOCATION_SRC).toMatch(
      /<NexTextarea[\s\S]{0,500}id="shop-address"/,
    );
    expect(LOCATION_SRC).toMatch(/<NexTextarea[\s\S]{0,500}maxLength=\{500\}/);
    expect(LOCATION_SRC).toMatch(/<NexTextarea[\s\S]{0,500}rows=\{2\}/);
  });

  it("<select id=\"shop-country\"> remains native (NexInput wraps <input> only)", () => {
    expect(LOCATION_SRC).toMatch(/<select[\s\S]{0,200}id="shop-country"/);
  });
});

describe("Stage 1 keypad wiring · contact wizard", () => {
  it("imports NexInput from the shared barrel", () => {
    expect(CONTACT_SRC).toMatch(
      /import \{ NexInput \} from "@\/lib\/nex-native\/nex-keyboard"/,
    );
  });

  it("renders a single NexInput inside the FIELDS map", () => {
    expect(CONTACT_SRC).toMatch(
      /<NexInput[\s\S]{0,400}id=\{`shop-\$\{field\.name\}`\}/,
    );
  });

  it("forwards the varying field.type (text/url/email/tel) through NexInput", () => {
    expect(CONTACT_SRC).toMatch(
      /<NexInput[\s\S]{0,400}type=\{field\.type \?\? "text"\}/,
    );
  });

  it("does not render a raw <input> for the FIELDS loop (all six contact rows)", () => {
    expect(CONTACT_SRC).not.toMatch(
      /<input[\s\S]{0,400}id=\{`shop-\$\{field\.name\}`\}/,
    );
  });
});
