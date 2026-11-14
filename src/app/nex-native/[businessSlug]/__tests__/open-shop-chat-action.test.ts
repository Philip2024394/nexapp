// src/app/nex-native/[businessSlug]/__tests__/open-shop-chat-action.test.ts
//
// Stage 3 · 2026-11-14 · owner-authorised.
// -----------------------------------------------------------------------------
// Covers the pure next-path builder exported from the Shop Chat entry
// server action. The builder encodes the sealed Stage-3 round-trip
// shape: `/nex-native/<slug>?open-chat=1` optionally extended with
// `&product=<id>`. The `[businessSlug]/page.tsx` open-chat handler
// expects EXACTLY this shape so a product reference threads through
// sign-up / sign-in and lands in the correct Shop Chat with the
// Stage 1 chip pre-filled.
//
// Why a pure helper · the server action itself depends on session /
// Supabase and can't be unit tested without heavy mocks. Factoring
// out the URL shape keeps the test fast and isolates the invariant:
// if the shape drifts, the Stage-3 anon continuity silently breaks.
//
// Invariants proven:
//   · Without a product, the path is the sealed open-chat landing.
//   · With a product, product=<id> is appended as a QUERY param
//     (not a fragment, not another URL) and URL-encoded.
//   · The shop slug is passed through verbatim (the caller is
//     trusted to have picked a known slug · we never fabricate).
//   · Product id is URL-encoded so odd characters cannot break the
//     query string.

import { describe, expect, it } from "vitest";
import { buildSignedOutNextPath } from "@/lib/nex-native/business-chat/anon-next-path";

describe("buildSignedOutNextPath · Stage 3 anon round-trip path", () => {
  it("returns the sealed open-chat landing when productId is null", () => {
    expect(buildSignedOutNextPath("hand-craft", null)).toBe(
      "/nex-native/hand-craft?open-chat=1",
    );
  });

  it("appends product=<id> when a product id is provided", () => {
    expect(
      buildSignedOutNextPath(
        "hand-craft",
        "11111111-2222-4333-8444-555555555555",
      ),
    ).toBe(
      "/nex-native/hand-craft?open-chat=1&product=11111111-2222-4333-8444-555555555555",
    );
  });

  it("URL-encodes the product id defensively", () => {
    const raw = "a b/c&d";
    const out = buildSignedOutNextPath("hand-craft", raw);
    // The slug segment stays verbatim · only the product id value is
    // encoded. Encoded space is "%20" · '/' is "%2F" · '&' is "%26".
    expect(out).toBe(
      "/nex-native/hand-craft?open-chat=1&product=a%20b%2Fc%26d",
    );
  });

  it("passes the slug through verbatim · never fabricates", () => {
    expect(buildSignedOutNextPath("shop-with-hyphens-123", null)).toBe(
      "/nex-native/shop-with-hyphens-123?open-chat=1",
    );
  });

  it("stays a strict /nex-native/ local path (anti-open-redirect contract)", () => {
    const out = buildSignedOutNextPath("hand-craft", null);
    expect(out.startsWith("/nex-native/")).toBe(true);
    expect(out.includes("//")).toBe(false);
    expect(out.includes("\\")).toBe(false);
    expect(out.includes(":")).toBe(false);
  });

  it("output can be re-consumed as a safe sign-in next= param (whitelist shape)", () => {
    // The sign-in page applies a whitelist: must start with
    // /nex-native/ · no `//` · no `\` · length < 1024. The builder
    // output must satisfy that whitelist so the auth round-trip
    // doesn't drop our carefully-built next path.
    const withProduct = buildSignedOutNextPath(
      "hand-craft",
      "11111111-2222-4333-8444-555555555555",
    );
    expect(withProduct.startsWith("/nex-native/")).toBe(true);
    expect(withProduct.includes("//")).toBe(false);
    expect(withProduct.includes("\\")).toBe(false);
    expect(withProduct.length).toBeLessThan(1024);
  });
});
