// src/app/nex-native/chat/__tests__/shop-chooser-catalog.test.ts
//
// NEX · S5 · shop-type chooser catalogue tests.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Pure data tests · no DOM, no React render. The catalogue is the
// single source of truth that the chooser maps over, so verifying
// its shape pins the four approved Sell cards + the separate
// Earn-with-NEX section + the honest Coming-soon markers.
//
// Owner-approved spec:
//
//   Sell lane · 4 cards:
//     · Products      · live
//     · Services      · Coming soon (no backend yet)
//     · Food          · live
//     · Accommodation · Coming soon (no backend yet)
//
//   Earn with NEX · separate section · 1 card:
//     · Affiliate · live via sealed /affiliate/join
//
//   Honest availability:
//     · Live cards MUST have a non-null href.
//     · Coming-soon cards MUST have href = null (no synthetic
//       flow, no fabricated route · owner directive).
//     · available === !!href (invariant).

import { describe, test, expect } from "vitest";
import {
  SHOP_CHOOSER_CATALOG,
  sellCards,
  earnCards,
  isShopChooserCardId,
  type ShopChooserCardId,
  type ShopChooserCard,
} from "../_shop-chooser-catalog";

// ─── Catalogue shape · four Sell + Affiliate separate ────────────

describe("SHOP_CHOOSER_CATALOG · shape", () => {
  test("T5.1 · catalogue contains exactly 5 cards", () => {
    expect(SHOP_CHOOSER_CATALOG).toHaveLength(5);
  });

  test("T5.2 · catalogue ids match the sealed enum (no extras / no missing)", () => {
    const expected: readonly ShopChooserCardId[] = [
      "products",
      "services",
      "food",
      "accommodation",
      "affiliate",
    ];
    const actual = SHOP_CHOOSER_CATALOG.map((c) => c.id);
    expect(actual).toEqual(expected);
  });

  test("T5.3 · sell section contains the four approved cards in the owner-approved order", () => {
    const sell = sellCards().map((c) => c.id);
    expect(sell).toEqual([
      "products",
      "services",
      "food",
      "accommodation",
    ]);
  });

  test("T5.4 · earn section contains Affiliate only", () => {
    const earn = earnCards().map((c) => c.id);
    expect(earn).toEqual(["affiliate"]);
  });
});

// ─── Live vs Coming-soon · availability invariant ─────────────────

describe("SHOP_CHOOSER_CATALOG · availability honesty", () => {
  test("T5.5 · Products is LIVE with the sealed onboarding route", () => {
    const products = cardById("products");
    expect(products.available).toBe(true);
    expect(products.href).toBe(
      "/nex-native/onboarding?type=product&commerce=1",
    );
  });

  test("T5.6 · Food is LIVE with the sealed onboarding route", () => {
    const food = cardById("food");
    expect(food.available).toBe(true);
    expect(food.href).toBe(
      "/nex-native/onboarding?type=food&commerce=1",
    );
  });

  test("T5.7 · Affiliate is LIVE at the sealed /affiliate/join route", () => {
    const aff = cardById("affiliate");
    expect(aff.available).toBe(true);
    expect(aff.href).toBe("/nex-native/affiliate/join");
  });

  test("T5.8 · Services is COMING SOON · href is null · no synthetic flow", () => {
    const svc = cardById("services");
    expect(svc.available).toBe(false);
    expect(svc.href).toBeNull();
  });

  test("T5.9 · Accommodation is COMING SOON · href is null · no synthetic flow", () => {
    const acc = cardById("accommodation");
    expect(acc.available).toBe(false);
    expect(acc.href).toBeNull();
  });

  test("T5.10 · invariant · available === !!href for every card", () => {
    for (const card of SHOP_CHOOSER_CATALOG) {
      expect(card.available).toBe(Boolean(card.href));
    }
  });

  test("T5.11 · every live href is a same-origin absolute path · open-redirect guard", () => {
    for (const card of SHOP_CHOOSER_CATALOG) {
      if (card.href !== null) {
        expect(card.href.startsWith("/nex-native/")).toBe(true);
        expect(card.href.includes(":")).toBe(false);
        expect(card.href.includes("//")).toBe(false);
      }
    }
  });
});

// ─── Narrowing helper ────────────────────────────────────────────

describe("isShopChooserCardId", () => {
  test("T5.12 · accepts every sealed id", () => {
    for (const card of SHOP_CHOOSER_CATALOG) {
      expect(isShopChooserCardId(card.id)).toBe(true);
    }
  });

  test("T5.13 · rejects tampered / unknown values", () => {
    expect(isShopChooserCardId("admin_elevation")).toBe(false);
    expect(isShopChooserCardId("")).toBe(false);
    expect(isShopChooserCardId("PRODUCTS")).toBe(false);
    expect(isShopChooserCardId("affiliate_join")).toBe(false);
  });
});

// ─── Captions · each card describes WHAT it is, honestly ─────────

describe("SHOP_CHOOSER_CATALOG · captions", () => {
  test("T5.14 · every card has a non-empty label + caption", () => {
    for (const card of SHOP_CHOOSER_CATALOG) {
      expect(card.label.length).toBeGreaterThan(0);
      expect(card.caption.length).toBeGreaterThan(0);
    }
  });

  test("T5.15 · captions do NOT promise working features for Coming-soon cards", () => {
    const svc = cardById("services");
    const acc = cardById("accommodation");
    // The caption describes WHAT the lane is for, not that it's
    // active. Owner directive · "handled truthfully".
    expect(svc.caption.toLowerCase()).not.toMatch(/live now|available today/);
    expect(acc.caption.toLowerCase()).not.toMatch(/live now|available today/);
  });
});

function cardById(id: ShopChooserCardId): ShopChooserCard {
  const found = SHOP_CHOOSER_CATALOG.find((c) => c.id === id);
  if (!found) throw new Error(`catalogue missing ${id}`);
  return found;
}
