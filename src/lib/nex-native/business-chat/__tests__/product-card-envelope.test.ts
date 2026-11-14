// src/lib/nex-native/business-chat/__tests__/product-card-envelope.test.ts
//
// Stage 2 · 2026-11-14 · owner-authorised.
// -----------------------------------------------------------------------------
// Covers the pure envelope builder + parser used by both entry points
// to the business-scoped shop chat product-card message flow:
//
//   1. 3-dot shop-products drawer (seller / shop-staff side)  — existing
//   2. Stage 1 pending-product chip "Send to shop" button — new
//
// Invariants proven:
//   · Envelope plaintext shape matches what `_client.tsx`'s renderer
//     (`ProductCardBubble` + `attachment_type === "product"` branch)
//     expects — otherwise bubbles on either entry would silently
//     fall through to the muted "a product was shared" placeholder.
//   · `attachmentMeta` is the BARE reference only. No price snapshot,
//     no name, no image URL · the server-visible metadata surface
//     stays narrow per the 2026-11-09 chat device-only E2E seal.
//   · Parser is lenient on optional fields but STRICT on structural
//     invariants: non-"product" kind, missing product_id, or non-object
//     input are all rejected (returns null) so a malformed bubble
//     renders the placeholder instead of a corrupted card.

import { describe, expect, it } from "vitest";
import {
  buildProductCardEnvelope,
  parseProductCardEnvelope,
  type ProductCardInput,
} from "@/lib/nex-native/business-chat/product-card-envelope";

const SAMPLE: ProductCardInput = {
  id: "11111111-2222-4333-8444-555555555555",
  name: "Hand Craft Scarf",
  price_pence: 199000,
  currency: "IDR",
  image_url: "https://example.com/scarf.jpg",
};

describe("buildProductCardEnvelope · plaintext shape", () => {
  it("serialises the exact JSON fields the ProductCardBubble renderer reads", () => {
    const env = buildProductCardEnvelope(SAMPLE);
    const parsed = JSON.parse(env.plaintext) as Record<string, unknown>;
    expect(parsed).toEqual({
      kind: "product",
      product_id: SAMPLE.id,
      name: SAMPLE.name,
      price_pence: SAMPLE.price_pence,
      currency: SAMPLE.currency,
      image_url: SAMPLE.image_url,
    });
  });

  it("marks kind='product' so the bubble decoder routes to ProductCardBubble", () => {
    const env = buildProductCardEnvelope(SAMPLE);
    expect(JSON.parse(env.plaintext).kind).toBe("product");
  });

  it("normalises missing image_url to null (never undefined)", () => {
    const env = buildProductCardEnvelope({ ...SAMPLE, image_url: null });
    const parsed = JSON.parse(env.plaintext) as Record<string, unknown>;
    expect(parsed.image_url).toBeNull();
    expect("image_url" in parsed).toBe(true);
  });

  it("preserves zero-decimal currencies verbatim (IDR / JPY)", () => {
    for (const currency of ["IDR", "JPY"]) {
      const env = buildProductCardEnvelope({ ...SAMPLE, currency });
      expect(JSON.parse(env.plaintext).currency).toBe(currency);
    }
  });
});

describe("buildProductCardEnvelope · server-visible metadata", () => {
  it("writes ONLY the product_id to attachmentMeta — no price / name / image leaks", () => {
    const env = buildProductCardEnvelope(SAMPLE);
    expect(env.attachmentMeta).toEqual({ product_id: SAMPLE.id });
    // Defence-in-depth · property absence assertions.
    const keys = Object.keys(env.attachmentMeta);
    expect(keys).toHaveLength(1);
    expect(keys).toEqual(["product_id"]);
    const meta = env.attachmentMeta as Record<string, unknown>;
    expect(meta.name).toBeUndefined();
    expect(meta.price_pence).toBeUndefined();
    expect(meta.image_url).toBeUndefined();
    expect(meta.currency).toBeUndefined();
  });

  it("uses the typed 'product' literal for attachmentType", () => {
    const env = buildProductCardEnvelope(SAMPLE);
    expect(env.attachmentType).toBe("product");
  });
});

describe("buildProductCardEnvelope · determinism", () => {
  it("returns identical envelopes for identical input (key-order stable)", () => {
    const a = buildProductCardEnvelope(SAMPLE);
    const b = buildProductCardEnvelope(SAMPLE);
    expect(a.plaintext).toBe(b.plaintext);
    expect(a.attachmentMeta).toEqual(b.attachmentMeta);
  });
});

describe("parseProductCardEnvelope · accept path", () => {
  it("round-trips a built envelope back to the original fields", () => {
    const env = buildProductCardEnvelope(SAMPLE);
    const back = parseProductCardEnvelope(env.plaintext);
    expect(back).toEqual(SAMPLE);
  });

  it("falls back to an empty name when the field is missing (no fabrication)", () => {
    const back = parseProductCardEnvelope(
      JSON.stringify({ kind: "product", product_id: "abc-deleted" }),
    );
    expect(back?.name).toBe("");
    expect(back?.id).toBe("abc-deleted");
    // Price / currency fall back to safe defaults · NEVER fabricated
    // real-looking numbers.
    expect(back?.price_pence).toBe(0);
    expect(back?.currency).toBe("IDR");
    expect(back?.image_url).toBeNull();
  });
});

describe("parseProductCardEnvelope · reject path", () => {
  it("returns null for non-JSON input", () => {
    expect(parseProductCardEnvelope("not json")).toBeNull();
    expect(parseProductCardEnvelope("")).toBeNull();
  });

  it("returns null for JSON that is not an object", () => {
    expect(parseProductCardEnvelope("42")).toBeNull();
    expect(parseProductCardEnvelope("null")).toBeNull();
    expect(parseProductCardEnvelope('"product"')).toBeNull();
    expect(parseProductCardEnvelope("[1,2,3]")).toBeNull();
  });

  it("returns null when kind is not 'product'", () => {
    expect(
      parseProductCardEnvelope(
        JSON.stringify({ kind: "text", product_id: "x" }),
      ),
    ).toBeNull();
  });

  it("returns null when product_id is missing or empty", () => {
    expect(
      parseProductCardEnvelope(JSON.stringify({ kind: "product" })),
    ).toBeNull();
    expect(
      parseProductCardEnvelope(
        JSON.stringify({ kind: "product", product_id: "" }),
      ),
    ).toBeNull();
    expect(
      parseProductCardEnvelope(
        JSON.stringify({ kind: "product", product_id: 42 }),
      ),
    ).toBeNull();
  });

  it("returns null for the muted placeholder case (empty / whitespace plaintext)", () => {
    expect(parseProductCardEnvelope("   ")).toBeNull();
  });
});
