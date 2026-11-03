// src/lib/nex-native/billing/__tests__/price-registry-country.test.ts
//
// NEX Billing · [pure] country-aware price registry tests.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT).
//
// Verifies:
//   · Ireland identity reads *_IE env var preferred
//   · Indonesia identity reads *_ID env var preferred
//   · HQ (Worldwide) identity reads the unsuffixed env var only
//   · When *_IE is unset but unsuffixed is set, Ireland falls back to
//     the unsuffixed env var
//   · Changing identity does NOT accidentally expose Ireland prices to
//     Indonesia (fail-closed separation)
//   · No actual price values are hardcoded in the registry itself ·
//     every value comes from the env

import { describe, it, expect } from "vitest";
import {
  buildPriceRegistry,
  envVarsForTier,
  suffixForIdentity,
  PRICE_ENV_VARS,
} from "../price-registry";

describe("[pure] suffixForIdentity", () => {
  it("ireland → _IE", () => expect(suffixForIdentity("ireland")).toBe("_IE"));
  it("indonesia → _ID", () => expect(suffixForIdentity("indonesia")).toBe("_ID"));
  it("hq → '' (worldwide default)", () =>
    expect(suffixForIdentity("hq")).toBe(""));
  it("unknown identity → '' (fail-closed to WW)", () =>
    expect(suffixForIdentity("mars")).toBe(""));
});

describe("[pure] envVarsForTier", () => {
  it("ireland · shop/standard · preferred=*_IE · fallback=unsuffixed", () => {
    const v = envVarsForTier("shop", "standard", "ireland");
    expect(v).toEqual({
      preferred: "STRIPE_PRICE_SHOP_STANDARD_IE",
      fallback: "STRIPE_PRICE_SHOP_STANDARD",
    });
  });
  it("indonesia · vault/5gb · preferred=*_ID · fallback=unsuffixed", () => {
    const v = envVarsForTier("vault", "5gb", "indonesia");
    expect(v).toEqual({
      preferred: "STRIPE_PRICE_VAULT_5GB_ID",
      fallback: "STRIPE_PRICE_VAULT_5GB",
    });
  });
  it("hq · preferred equals fallback (unsuffixed)", () => {
    const v = envVarsForTier("shop", "standard", "hq");
    expect(v).toEqual({
      preferred: "STRIPE_PRICE_SHOP_STANDARD",
      fallback: "STRIPE_PRICE_SHOP_STANDARD",
    });
  });
  it("unknown product → null", () => {
    expect(envVarsForTier("rocket" as "shop", "standard", "hq")).toBeNull();
  });
  it("unknown tier → null", () => {
    expect(envVarsForTier("shop", "mega", "hq")).toBeNull();
  });
});

describe("[pure] Ireland registry · reads *_IE preferred", () => {
  it("prefers *_IE when set", () => {
    const env = new Map<string, string>([
      ["STRIPE_PRICE_SHOP_STANDARD_IE", "price_IEshopstdabc1234"],
      ["STRIPE_PRICE_SHOP_STANDARD", "price_WWshopstdabc1234"],
    ]);
    const reg = buildPriceRegistry({
      identity: "ireland",
      getEnv: (k) => env.get(k),
    });
    expect(reg.getPriceIdForTier("shop", "standard")).toBe(
      "price_IEshopstdabc1234",
    );
    expect(reg.identity).toBe("ireland");
  });

  it("falls back to unsuffixed when *_IE is unset", () => {
    const env = new Map<string, string>([
      ["STRIPE_PRICE_SHOP_STANDARD", "price_WWshopstdabc1234"],
    ]);
    const reg = buildPriceRegistry({
      identity: "ireland",
      getEnv: (k) => env.get(k),
    });
    expect(reg.getPriceIdForTier("shop", "standard")).toBe(
      "price_WWshopstdabc1234",
    );
  });

  it("returns null when neither variant is set (fail-closed)", () => {
    const env = new Map<string, string>();
    const reg = buildPriceRegistry({
      identity: "ireland",
      getEnv: (k) => env.get(k),
    });
    expect(reg.getPriceIdForTier("shop", "standard")).toBeNull();
    expect(reg.isFullyConfigured()).toBe(false);
  });
});

describe("[pure] Indonesia registry · reads *_ID preferred", () => {
  it("prefers *_ID when set", () => {
    const env = new Map<string, string>([
      ["STRIPE_PRICE_SHOP_UNLIMITED_ID", "price_IDshopunlabcdef78"],
      ["STRIPE_PRICE_SHOP_UNLIMITED", "price_WWshopunlabcdef78"],
    ]);
    const reg = buildPriceRegistry({
      identity: "indonesia",
      getEnv: (k) => env.get(k),
    });
    expect(reg.getPriceIdForTier("shop", "unlimited")).toBe(
      "price_IDshopunlabcdef78",
    );
  });

  it("does NOT read *_IE when identity=indonesia", () => {
    const env = new Map<string, string>([
      // Ireland suffix set, but Indonesia identity should ignore it
      ["STRIPE_PRICE_SHOP_STANDARD_IE", "price_IEshouldnotleakxx"],
    ]);
    const reg = buildPriceRegistry({
      identity: "indonesia",
      getEnv: (k) => env.get(k),
    });
    // No *_ID, no unsuffixed, so Indonesia returns null (fail-closed)
    expect(reg.getPriceIdForTier("shop", "standard")).toBeNull();
  });
});

describe("[pure] HQ (Worldwide) registry · unsuffixed only", () => {
  it("reads unsuffixed env", () => {
    const env = new Map<string, string>([
      ["STRIPE_PRICE_VAULT_25GB", "price_WWvault25abcde78"],
    ]);
    const reg = buildPriceRegistry({
      identity: "hq",
      getEnv: (k) => env.get(k),
    });
    expect(reg.getPriceIdForTier("vault", "25gb")).toBe(
      "price_WWvault25abcde78",
    );
  });

  it("does NOT read *_IE even if present (fail-closed separation)", () => {
    const env = new Map<string, string>([
      ["STRIPE_PRICE_SHOP_STANDARD_IE", "price_IEshouldnotbeused"],
    ]);
    const reg = buildPriceRegistry({
      identity: "hq",
      getEnv: (k) => env.get(k),
    });
    expect(reg.getPriceIdForTier("shop", "standard")).toBeNull();
  });

  it("default identity (no identity param) treats as 'hq'", () => {
    const env = new Map<string, string>([
      ["STRIPE_PRICE_SHOP_STANDARD", "price_defaultabcde1234"],
    ]);
    const reg = buildPriceRegistry({ getEnv: (k) => env.get(k) });
    expect(reg.identity).toBe("hq");
    expect(reg.getPriceIdForTier("shop", "standard")).toBe(
      "price_defaultabcde1234",
    );
  });
});

describe("[pure] identity separation · same env var set, different registries", () => {
  it("Ireland and Indonesia built from the SAME env map return different values", () => {
    const env = new Map<string, string>([
      ["STRIPE_PRICE_SHOP_STANDARD_IE", "price_IEeur1234567abcd"],
      ["STRIPE_PRICE_SHOP_STANDARD_ID", "price_IDidr1234567abcd"],
      ["STRIPE_PRICE_SHOP_STANDARD", "price_WWfallback1234567"],
    ]);
    const ireland = buildPriceRegistry({
      identity: "ireland",
      getEnv: (k) => env.get(k),
    });
    const indonesia = buildPriceRegistry({
      identity: "indonesia",
      getEnv: (k) => env.get(k),
    });
    const ww = buildPriceRegistry({
      identity: "hq",
      getEnv: (k) => env.get(k),
    });
    expect(ireland.getPriceIdForTier("shop", "standard")).toBe(
      "price_IEeur1234567abcd",
    );
    expect(indonesia.getPriceIdForTier("shop", "standard")).toBe(
      "price_IDidr1234567abcd",
    );
    expect(ww.getPriceIdForTier("shop", "standard")).toBe(
      "price_WWfallback1234567",
    );
  });
});

describe("[pure] no amounts baked into the registry source", () => {
  // Owner rule: "Do not silently choose or publish new Indonesia or Worldwide amounts."
  // Enforce by inspection · the registry source file must never contain
  // amount-shaped literals (Rp, €, USD, numeric currency values).
  it("PRICE_ENV_VARS has only env-var NAME strings, not amount strings", () => {
    const flat = Object.values(PRICE_ENV_VARS).flatMap((p) =>
      Object.values(p),
    );
    for (const v of flat) {
      expect(v).toMatch(/^STRIPE_PRICE_[A-Z0-9_]+$/);
      expect(v).not.toMatch(/Rp|€|USD|EUR|IDR/);
      expect(v).not.toMatch(/\d+\.\d+/); // no decimal amounts
    }
  });
});
