// src/lib/nex-native/billing/__tests__/shop-tier-enforcement.test.ts
//
// NEX Shop 3-tier enforcement · acceptance tests (pure-logic layer).
// -----------------------------------------------------------------------------
// Owner-authorised 2026-11-07.
//
// These tests exercise the pure enforceCreateProduct / enforceImageUpload
// / enforceVideoUpload helpers against the Entry / Professional /
// Professional Plus entitlement specs. Pure functions only · no Supabase,
// no HTTP, no FFprobe. The server-side guards + ffprobe path are
// exercised via integration verification separately.

import { describe, it, expect } from "vitest";
import {
  enforceCreateProduct,
  enforceImageUpload,
  enforceVideoUpload,
  resolveShopTier,
  getSpecForDbTier,
  describeError,
} from "../shop-tier-enforcement";
import {
  ENTRY_ENTITLEMENT,
  PROFESSIONAL_ENTITLEMENT,
  PROFESSIONAL_PLUS_ENTITLEMENT,
} from "../../commercial/shop-entitlements";

describe("resolveShopTier", () => {
  it("maps 'professional' → 'professional'", () => {
    expect(resolveShopTier("professional")).toBe("professional");
  });
  it("maps 'professional_plus' → 'professional_plus'", () => {
    expect(resolveShopTier("professional_plus")).toBe("professional_plus");
  });
  it("maps null → 'entry' (conservative fallback)", () => {
    expect(resolveShopTier(null)).toBe("entry");
  });
  it("maps undefined → 'entry'", () => {
    expect(resolveShopTier(undefined)).toBe("entry");
  });
  it("maps legacy 'bisnis' → 'entry' (needs migration, not generous fallback)", () => {
    expect(resolveShopTier("bisnis")).toBe("entry");
  });
  it("maps unknown string → 'entry'", () => {
    expect(resolveShopTier("xyz")).toBe("entry");
  });
});

describe("getSpecForDbTier", () => {
  it("returns Entry spec for null", () => {
    expect(getSpecForDbTier(null)).toBe(ENTRY_ENTITLEMENT);
  });
  it("returns Professional spec for 'professional'", () => {
    expect(getSpecForDbTier("professional")).toBe(PROFESSIONAL_ENTITLEMENT);
  });
  it("returns Plus spec for 'professional_plus'", () => {
    expect(getSpecForDbTier("professional_plus")).toBe(PROFESSIONAL_PLUS_ENTITLEMENT);
  });
});

describe("enforceCreateProduct · Entry tier (5 product cap)", () => {
  it("allows the 5th product (currentCount=4)", () => {
    const r = enforceCreateProduct(null, 4);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });
  it("denies the 6th product (currentCount=5)", () => {
    const r = enforceCreateProduct(null, 5);
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(["product-cap"]);
    expect(r.spec).toBe(ENTRY_ENTITLEMENT);
  });
  it("denies when way over cap (currentCount=99)", () => {
    const r = enforceCreateProduct(null, 99);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toBe("product-cap");
  });
});

describe("enforceCreateProduct · Professional tier (50 product cap)", () => {
  it("allows the 50th product (currentCount=49)", () => {
    const r = enforceCreateProduct("professional", 49);
    expect(r.ok).toBe(true);
  });
  it("denies the 51st product (currentCount=50)", () => {
    const r = enforceCreateProduct("professional", 50);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toBe("product-cap");
    expect(r.spec).toBe(PROFESSIONAL_ENTITLEMENT);
  });
});

describe("enforceCreateProduct · Professional Plus tier (500 product cap)", () => {
  it("allows the 500th product (currentCount=499)", () => {
    const r = enforceCreateProduct("professional_plus", 499);
    expect(r.ok).toBe(true);
  });
  it("denies the 501st product (currentCount=500)", () => {
    const r = enforceCreateProduct("professional_plus", 500);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toBe("product-cap");
    expect(r.spec).toBe(PROFESSIONAL_PLUS_ENTITLEMENT);
  });
});

describe("enforceImageUpload · per-product image count + size", () => {
  it("Entry · denies image when per-product cap reached (default 4)", () => {
    const r = enforceImageUpload(
      null,
      ENTRY_ENTITLEMENT.products.imagesPerProduct,
      1_000_000,
    );
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("image-cap-per-product");
  });
  it("Professional · denies image > tier byte cap", () => {
    const over = PROFESSIONAL_ENTITLEMENT.products.imageMaxBytes + 1;
    const r = enforceImageUpload("professional", 0, over);
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("image-size");
  });
  it("Plus · allows image at exact cap byte size", () => {
    const r = enforceImageUpload(
      "professional_plus",
      0,
      PROFESSIONAL_PLUS_ENTITLEMENT.products.imageMaxBytes,
    );
    expect(r.ok).toBe(true);
  });
  it("Professional · reports both cap + size errors when both exceed", () => {
    const r = enforceImageUpload(
      "professional",
      PROFESSIONAL_ENTITLEMENT.products.imagesPerProduct + 2,
      PROFESSIONAL_ENTITLEMENT.products.imageMaxBytes * 2,
    );
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("image-cap-per-product");
    expect(r.errors).toContain("image-size");
  });
});

describe("enforceVideoUpload · tier gates", () => {
  it("Entry · denies all video (videosPerProduct===0)", () => {
    const r = enforceVideoUpload(null, 0, 1_000, 5);
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(["video-not-allowed-on-tier"]);
  });
  it("Professional · allows a video within size + duration cap", () => {
    const r = enforceVideoUpload(
      "professional",
      0,
      PROFESSIONAL_ENTITLEMENT.products.videoMaxBytes - 1,
      PROFESSIONAL_ENTITLEMENT.products.videoMaxSeconds - 1,
    );
    expect(r.ok).toBe(true);
  });
  it("Professional · denies second video when per-product cap=1", () => {
    const r = enforceVideoUpload("professional", 1, 1_000_000, 10);
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("video-cap-per-product");
  });
  it("Professional · denies video over byte cap", () => {
    const r = enforceVideoUpload(
      "professional",
      0,
      PROFESSIONAL_ENTITLEMENT.products.videoMaxBytes + 1,
      10,
    );
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("video-size");
  });
  it("Professional · denies video over duration cap", () => {
    const r = enforceVideoUpload(
      "professional",
      0,
      1_000,
      PROFESSIONAL_ENTITLEMENT.products.videoMaxSeconds + 1,
    );
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("video-duration");
  });
  it("Plus · allows 3 videos, denies 4th", () => {
    const allow = enforceVideoUpload("professional_plus", 2, 1_000, 10);
    expect(allow.ok).toBe(true);
    const deny = enforceVideoUpload("professional_plus", 3, 1_000, 10);
    expect(deny.ok).toBe(false);
    expect(deny.errors).toContain("video-cap-per-product");
  });
  it("Plus · duration=-1 skips duration check (for callers probing async)", () => {
    const r = enforceVideoUpload("professional_plus", 0, 1_000, -1);
    expect(r.ok).toBe(true);
  });
});

describe("describeError · human-readable upgrade prompts", () => {
  it("product-cap message mentions tier displayName + cap", () => {
    const msg = describeError("product-cap", ENTRY_ENTITLEMENT);
    expect(msg).toContain(ENTRY_ENTITLEMENT.displayName);
    expect(msg).toContain(String(ENTRY_ENTITLEMENT.products.maxActive));
  });
  it("video-not-allowed-on-tier mentions upgrade", () => {
    const msg = describeError("video-not-allowed-on-tier", ENTRY_ENTITLEMENT);
    expect(msg.toLowerCase()).toContain("upgrade");
  });
  it("video-cap singular vs plural", () => {
    const pro = describeError("video-cap-per-product", PROFESSIONAL_ENTITLEMENT);
    expect(pro).toMatch(/1 video\b/);
    const plus = describeError("video-cap-per-product", PROFESSIONAL_PLUS_ENTITLEMENT);
    expect(plus).toMatch(/\d+ videos/);
  });
});
