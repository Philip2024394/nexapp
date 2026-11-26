// tests/e2e/regression-spec-payload-helper.spec.ts
//
// L-034 · spec-payload-helper regression · authored 2026-11-26.
//
// Pins the contract that `tests/e2e/_fixtures/spec-payload-helper.ts`
// produces MINIMAL VALID payloads for EVERY category registered at
// `src/lib/nex-native/catalogue/specs/index.ts`. If a new category is
// registered that the helper cannot satisfy (new required field with
// an unsupported kind, new constraint the default value violates),
// this test fails loudly — forcing the helper to be updated BEFORE
// the UI full-form edit journey is driven in a broader cycle.
//
// Why Playwright and not vitest
// -----------------------------
// vitest can import `src/lib/nex-native/catalogue/specs/index.ts`
// (which pulls Zod + 30 category files + the DepartmentId type) but
// doing so from `tests/e2e/_fixtures/spec-payload-helper.ts` under
// the existing vitest config requires path-alias resolution that is
// easiest to reuse by running the test inside the Playwright project
// (where tsconfig paths already resolve). We use `test(...)` from
// @playwright/test but perform NO browser interactions · the helper
// is pure.
//
// What this spec does NOT cover
// ------------------------------
//   · The FULL `updateProductAction` server-action round-trip
//     (requires session + ownership + existing product in DB · will
//     be a separate L-034 follow-up once the helper is pinned).
//   · Driving the 701-line `_edit-client.tsx` UI field-by-field.
//     SpecFormBuilder auto-generates per category · UI driving is a
//     scoped follow-up.
//
// Classification: SPEC AUTHORED · exercises the helper against the
// REAL Zod spec registry · NO browser · NO DB.

import { expect, test } from "@playwright/test";
import { listRegisteredCategorySpecs } from "@/lib/nex-native/catalogue/specs";
import { MarketSpec } from "@/lib/nex-native/catalogue/market-spec";
import {
  buildMinimalCategorySpecPayload,
  buildMinimalMarketPayload,
  buildMinimalUpdateProductInput,
} from "./_fixtures/spec-payload-helper";

test.describe("L-034 · spec-payload helper · minimal valid payloads", () => {
  test("helper produces a payload that passes schema.safeParse for EVERY registered category", () => {
    const specs = listRegisteredCategorySpecs();
    expect(
      specs.length,
      "registry must expose at least one category spec",
    ).toBeGreaterThan(0);

    const failures: Array<{
      dept: string;
      cat: string;
      message: string;
    }> = [];

    for (const spec of specs) {
      const payload = buildMinimalCategorySpecPayload(spec);
      const result = spec.schema.safeParse(payload);
      if (!result.success) {
        failures.push({
          dept: spec.departmentId,
          cat: spec.categoryId,
          message: result.error.message,
        });
      }
    }

    expect(
      failures,
      `spec-payload helper must produce a valid payload for every registered CategorySpec. Failures:\n${JSON.stringify(
        failures,
        null,
        2,
      )}`,
    ).toEqual([]);

    // Annotate for the evidence log so the number of covered
    // categories is visible without grepping stdout.
    test.info().annotations.push({
      type: "l034-coverage",
      description: `helper validated against ${specs.length} registered category specs · 0 failures`,
    });
  });

  test("market helper passes MarketSpec.safeParse for all three scopes", () => {
    for (const scope of ["local", "export", "both"] as const) {
      const payload = buildMinimalMarketPayload(scope);
      const result = MarketSpec.safeParse(payload);
      expect(
        result.success,
        `MarketSpec.safeParse must accept minimal "${scope}" payload · got: ${result.success ? "ok" : result.error.message}`,
      ).toBe(true);
    }
  });

  test("buildMinimalUpdateProductInput composes a valid spec + market pair", () => {
    const specs = listRegisteredCategorySpecs();
    // Pick fashion_clothing/womens as the representative because
    // fashion_clothing is the Phase-1 pilot department (see
    // `src/lib/nex-native/catalogue/specs/index.ts:14`) and `womens`
    // is the first registered sub-category. If the Phase-1 pilot ever
    // moves this test fails loudly and forces the helper + ledger to
    // follow.
    const pilot = specs.find(
      (s) =>
        s.departmentId === "fashion_clothing" && s.categoryId === "womens",
    );
    expect(
      pilot,
      "expected the sealed Phase-1 pilot (fashion_clothing/womens) to exist in the registry",
    ).toBeDefined();

    const input = buildMinimalUpdateProductInput({
      productId: "00000000-0000-0000-0000-000000000001",
      categorySpec: pilot!,
      name: "L-034 helper smoke",
      pricePence: 1234,
      currency: "GBP",
    });

    // Caller invariants · UpdateProductInput shape.
    expect(input.productId).toBe("00000000-0000-0000-0000-000000000001");
    expect(input.departmentId).toBe("fashion_clothing");
    expect(input.categoryId).toBe("womens");
    expect(input.name).toBe("L-034 helper smoke");
    expect(input.pricePence).toBe(1234);
    expect(input.currency).toBe("GBP");

    // Zod invariants · the composed spec + market both pass their
    // respective validators.
    const specResult = pilot!.schema.safeParse(input.spec);
    expect(
      specResult.success,
      `composed spec payload must pass pilot schema · ${specResult.success ? "" : specResult.error.message}`,
    ).toBe(true);

    const marketResult = MarketSpec.safeParse(input.market);
    expect(
      marketResult.success,
      `composed market payload must pass MarketSpec · ${marketResult.success ? "" : marketResult.error.message}`,
    ).toBe(true);
  });
});
