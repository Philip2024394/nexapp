// tests/e2e/smoke-switch-calculator.spec.ts
//
// NEX-007 · smoke verification for /nex-native/switch · 2026-11-25.
// Authored under Founder Decision 2 (2026-11-25) which authorised a
// smoke test on the Switch savings calculator independently of
// Ask Seller.
//
// Observable contract:
//   1. Route returns 200.
//   2. Server-rendered root marker [data-nex-switch-page] is visible.
//   3. The calculator section (aria-label="Switch cost calculator")
//      mounts client-side.
//   4. The sealed honesty copy is visible · "Presets are dated
//      examples, not universal truth" OR the active preset's
//      citation line — this guards the Founder-sealed rule against
//      shipping fabricated commission rates as fact.
//   5. Entering a trivial scenario (GMV=1000, orders=10, commission
//      =10%) causes the Comparison block to transition out of the
//      zero-sales "nothing to compare" state.
//
// What this spec DOES NOT do:
//   · Does not assert a specific savings amount · math correctness
//     lives in the unit tests under src/app/nex-native/switch/__tests__.
//   · Does not touch the drawer, the header, or any sealed surface.
//   · Does not compare against production commission rates · all
//     presets stay in the UI as dated examples.
//
// Classification: SMOKE · interactivity + sealed-honesty surface.

import { expect, test } from "@playwright/test";

test.describe("NEX-007 · Switch calculator · public smoke", () => {
  test("public route renders sealed markers + presets + reactive comparison", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    const response = await page.goto("/nex-native/switch", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status(), "/nex-native/switch returns 200").toBe(200);

    const root = page.locator("[data-nex-switch-page]").first();
    await expect(root, "Switch page root marker renders").toBeVisible({
      timeout: 10_000,
    });

    // Client calculator section · aria-label is the sealed surface
    // identifier (no data-nex-* attr on this client component).
    const calc = page
      .locator('section[aria-label="Switch cost calculator"]')
      .first();
    await expect(calc, "calculator section mounts").toBeVisible({
      timeout: 10_000,
    });

    // Hydration gate · the calculator is a "use client" component with
    // controlled inputs. A pre-hydration `fill()` sets the DOM value
    // but React's onChange never fires, so state stays empty and the
    // next render clears the DOM back. Wait for networkidle so the JS
    // bundle has landed and React has hydrated the island.
    await page.waitForLoadState("networkidle");

    // Honesty copy guard · the Founder-sealed 2026-11-23 directive
    // requires that preset commission rates are NEVER presented as
    // universal truth. One of the two sealed phrases must appear.
    const honesty = page.getByText(
      /Presets are dated examples, not universal truth|Last verified/i,
    );
    await expect(
      honesty.first(),
      "sealed honesty copy is visible (dated example or Last verified citation)",
    ).toBeVisible({ timeout: 10_000 });

    // Reactivity probe · enter a trivial scenario.
    const gmv = calc.locator('input[inputmode="decimal"]').first();
    const orders = calc.locator('input[inputmode="numeric"]').first();
    const commission = calc.locator('input[inputmode="decimal"]').nth(1);

    // Belt-and-braces hydration proof · retry fill until the controlled
    // input value persists. If the island has not hydrated, React will
    // reset the value to "" after the fill and the inputValue() will be
    // empty · poll re-fills until it sticks.
    await expect
      .poll(
        async () => {
          await gmv.fill("1000");
          return gmv.inputValue();
        },
        { timeout: 5_000, message: "GMV input accepts controlled value" },
      )
      .toBe("1000");
    await orders.fill("10");
    await commission.fill("10");

    // The zero-sales guard copy MUST disappear once hasAnySales is
    // truthy. If it is still present, the calculator failed to react.
    await expect
      .poll(
        async () =>
          (await calc
            .getByText(/nothing to compare/i)
            .count()),
        { timeout: 5_000 },
      )
      .toBe(0);
  });
});
