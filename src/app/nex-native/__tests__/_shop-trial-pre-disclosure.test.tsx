// A05 · 2026-11-18 · unit coverage for the pre-trial disclosure.
//
// Guardrail 1 of 4 (Option B sealed 2026-11-08) requires the trial
// terms to be visible BEFORE any call to Stripe checkout. This file
// verifies that the surface renders the four pieces of language the
// sealed decision requires:
//
//   1. the 7-day free window
//   2. the fact a card is required to start
//   3. the automatic day-8 charge language
//   4. the four launch-currency prices already disclosed on
//      /nex-native/settings/tier
//
// It also asserts the companion /settings/tier page mounts the
// disclosure above ShopCheckoutButton · the regression this is
// defending against is a drive-by refactor that drops the
// disclosure while leaving the button in place.

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { ShopTrialPreDisclosure } from "../_shop-trial-pre-disclosure";

const TIER_PAGE_PATH = path.resolve(
  __dirname,
  "../settings/tier/page.tsx",
);
const TIER_PAGE_SRC = fs.readFileSync(TIER_PAGE_PATH, "utf8");

describe("A05 · ShopTrialPreDisclosure · rendered content", () => {
  const html = renderToStaticMarkup(<ShopTrialPreDisclosure />);

  it("renders the 7-day free + card-required heading", () => {
    expect(html).toContain("7 days free");
    expect(html).toContain("card required");
  });

  it("states the day-8 automatic charge", () => {
    expect(html).toContain("day 8");
    expect(html).toMatch(/begins automatically unless you cancel/);
  });

  it("names the Package & billing cancel surface", () => {
    expect(html).toContain("Package &amp; billing");
  });

  it("lists all four sealed launch-currency prices", () => {
    expect(html).toContain("EUR 4.99 / month");
    expect(html).toContain("GBP 4.99 / month");
    expect(html).toContain("USD 4.99 / month");
    expect(html).toContain("IDR 89,000 / month");
  });

  it("explains the cancel-during-trial access window", () => {
    expect(html).toMatch(/Cancelling during the trial keeps your NEX Shop access/);
    expect(html).toContain("day 7 ends");
  });

  it("has the stable data attribute callers can rely on", () => {
    expect(html).toContain("data-nex-shop-trial-pre-disclosure");
  });

  it("is accessible · heading is linked to the section via aria-labelledby", () => {
    const withId = renderToStaticMarkup(
      <ShopTrialPreDisclosure id="trial-test" />,
    );
    expect(withId).toContain('id="trial-test"');
    expect(withId).toContain('aria-labelledby="trial-test-heading"');
    expect(withId).toContain('id="trial-test-heading"');
  });

  it("supports highlightCurrency without inventing extra lines", () => {
    const withHighlight = renderToStaticMarkup(
      <ShopTrialPreDisclosure highlightCurrency="EUR" />,
    );
    expect(withHighlight).toContain(
      'data-nex-shop-trial-pre-disclosure-price="EUR" data-highlighted="true"',
    );
    expect(withHighlight).toContain(
      'data-nex-shop-trial-pre-disclosure-price="GBP" data-highlighted="false"',
    );
    // Still only four prices · no new currencies invented.
    const matches = withHighlight.match(/data-nex-shop-trial-pre-disclosure-price=/g);
    expect(matches?.length).toBe(4);
  });
});

describe("A05 · settings/tier mounts the disclosure above checkout", () => {
  it("imports the disclosure component", () => {
    expect(TIER_PAGE_SRC).toContain(
      'import { ShopTrialPreDisclosure } from "../../_shop-trial-pre-disclosure";',
    );
  });

  it("renders the disclosure for Gratis viewers", () => {
    expect(TIER_PAGE_SRC).toContain("<ShopTrialPreDisclosure");
  });

  it("places the disclosure before ShopCheckoutButton in the Gratis branch", () => {
    // Narrow to the Gratis branch (the `!isPaid` block) so we don't
    // match an unrelated earlier mention of ShopCheckoutButton.
    const branchStart = TIER_PAGE_SRC.indexOf("!isPaid ? (");
    expect(branchStart).toBeGreaterThan(-1);
    const branch = TIER_PAGE_SRC.slice(branchStart, branchStart + 1200);
    const disclosureIdx = branch.indexOf("<ShopTrialPreDisclosure");
    const buttonIdx = branch.indexOf("<ShopCheckoutButton");
    expect(disclosureIdx).toBeGreaterThan(-1);
    expect(buttonIdx).toBeGreaterThan(-1);
    expect(disclosureIdx).toBeLessThan(buttonIdx);
  });
});
