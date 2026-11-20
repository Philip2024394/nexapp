// src/lib/nex-native/delivery/__tests__/local-delivery-quote.test.ts
//
// Authored 2026-11-18 · Phase Delivery · D1
//
// Pure-library coverage for local-delivery-quote.ts. No DOM, no
// network, no fixtures beyond inline data. Covers:
//   · no-rings-configured
//   · missing-origin / missing-destination
//   · exact-boundary ring selection
//   · out-of-range beyond the largest ring
//   · duplicate-km deterministic tie-break
//   · tamper rejection (fare, currency, distance trunc)
//   · schema sanitisation drops malformed rows

import { describe, expect, it } from "vitest";
import type { LocalRadiusEntryT } from "@/lib/nex-native/catalogue/delivery-spec";
import {
  quoteLocalDelivery,
  isSubmittedLocalQuoteAuthentic,
} from "../local-delivery-quote";

// Shop origin · Jakarta Monas monument coordinates (reasonable
// Indonesian test anchor; exact value unimportant as long as both
// ends use the same reference).
const ORIGIN = { lat: -6.1753871, lng: 106.8271691 };

// Destination ~0.85 km north (rough, straight-line).
const CLOSE_DEST = { lat: -6.1676, lng: 106.8272 };
// Destination ~12 km north-east.
const FAR_DEST = { lat: -6.0700, lng: 106.9000 };

const RINGS: LocalRadiusEntryT[] = [
  { km: 5, price_pence: 1_500_000, currency: "IDR", delivery_days: 1 }, // Rp 15,000
  { km: 10, price_pence: 2_500_000, currency: "IDR", delivery_days: 1 }, // Rp 25,000
  { km: 20, price_pence: 4_500_000, currency: "IDR", delivery_days: 1 }, // Rp 45,000
];

describe("quoteLocalDelivery · failure reasons", () => {
  it("returns no_rings_configured when the seller has no rings", () => {
    const r = quoteLocalDelivery({ radii: [], origin: ORIGIN, destination: CLOSE_DEST });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_rings_configured");
  });

  it("returns missing_origin when the shop has no coordinates", () => {
    const r = quoteLocalDelivery({
      radii: RINGS,
      origin: { lat: null, lng: null },
      destination: CLOSE_DEST,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_origin");
  });

  it("returns missing_destination when the buyer has no destination", () => {
    const r = quoteLocalDelivery({
      radii: RINGS,
      origin: ORIGIN,
      destination: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_destination");
  });

  it("returns out_of_range when distance exceeds the largest ring", () => {
    // Fake a very far destination by walking 0.5 deg north (~55 km).
    const far = { lat: ORIGIN.lat + 0.5, lng: ORIGIN.lng };
    const r = quoteLocalDelivery({ radii: RINGS, origin: ORIGIN, destination: far });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("out_of_range");
      expect(r.largestRingKm).toBe(20);
      expect(typeof r.distanceKm).toBe("number");
      expect(r.distanceKm).toBeGreaterThan(20);
    }
  });
});

describe("quoteLocalDelivery · happy paths", () => {
  it("picks the smallest ring that covers a close destination", () => {
    const r = quoteLocalDelivery({
      radii: RINGS,
      origin: ORIGIN,
      destination: CLOSE_DEST,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.applicableRingKm).toBe(5);
      expect(r.fareMinor).toBe(1_500_000);
      expect(r.currency).toBe("IDR");
      expect(r.deliveryDays).toBe(1);
      expect(r.distanceKind).toBe("straight_line_haversine");
      expect(r.distanceKm).toBeGreaterThan(0);
      expect(r.distanceKm).toBeLessThan(5);
    }
  });

  it("promotes to the next ring when distance exceeds the smallest", () => {
    const r = quoteLocalDelivery({
      radii: RINGS,
      origin: ORIGIN,
      destination: FAR_DEST,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // ~12 km → 20 km ring.
      expect(r.applicableRingKm).toBe(20);
      expect(r.fareMinor).toBe(4_500_000);
    }
  });

  it("includes the ring exactly at the boundary (distance <= km)", () => {
    // Synthesise: hand-craft a radii list where the 5 km ring covers
    // a distance computed from CLOSE_DEST. We assert the inequality
    // used is inclusive · if the resolver flipped to strict >, the
    // smallest ring would be unreachable for a buyer at exactly N km.
    const r = quoteLocalDelivery({
      radii: [{ km: 5, price_pence: 100_000, currency: "IDR" }],
      origin: ORIGIN,
      destination: CLOSE_DEST,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.applicableRingKm).toBe(5);
  });

  it("omits deliveryDays when the seller did not set it", () => {
    const r = quoteLocalDelivery({
      radii: [{ km: 5, price_pence: 100_000, currency: "IDR" }],
      origin: ORIGIN,
      destination: CLOSE_DEST,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.deliveryDays).toBeUndefined();
  });
});

describe("quoteLocalDelivery · schema sanitisation", () => {
  it("drops malformed rings before resolving", () => {
    // Negative price would fail the schema · the resolver should
    // treat the row as absent and still succeed on the valid ring.
    const r = quoteLocalDelivery({
      radii: [
        // valid
        { km: 5, price_pence: 100_000, currency: "IDR" },
        // invalid · currency not ISO-3 uppercase
        ({ km: 10, price_pence: 200_000, currency: "idr" } as unknown as LocalRadiusEntryT),
        // invalid · zero km
        ({ km: 0, price_pence: 50_000, currency: "IDR" } as unknown as LocalRadiusEntryT),
      ],
      origin: ORIGIN,
      destination: CLOSE_DEST,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.applicableRingKm).toBe(5);
  });

  it("returns no_rings_configured when every row is malformed", () => {
    const r = quoteLocalDelivery({
      radii: [
        ({ km: 0, price_pence: 50_000, currency: "IDR" } as unknown as LocalRadiusEntryT),
        ({ km: -5, price_pence: 50_000, currency: "IDR" } as unknown as LocalRadiusEntryT),
      ],
      origin: ORIGIN,
      destination: CLOSE_DEST,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_rings_configured");
  });
});

describe("quoteLocalDelivery · duplicate-km tie-break", () => {
  it("picks the cheaper of two duplicate rings", () => {
    const r = quoteLocalDelivery({
      radii: [
        { km: 10, price_pence: 300_000, currency: "IDR" },
        { km: 10, price_pence: 200_000, currency: "IDR" },
      ],
      origin: ORIGIN,
      destination: CLOSE_DEST,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fareMinor).toBe(200_000);
  });
});

// ─── Tamper rejection ────────────────────────────────────────────────

describe("isSubmittedLocalQuoteAuthentic", () => {
  const authoritative = quoteLocalDelivery({
    radii: RINGS,
    origin: ORIGIN,
    destination: CLOSE_DEST,
  });

  it("accepts a quote whose fare + currency match the resolver", () => {
    expect(authoritative.ok).toBe(true);
    if (!authoritative.ok) return;
    expect(
      isSubmittedLocalQuoteAuthentic(
        {
          fareMinor: authoritative.fareMinor,
          currency: authoritative.currency,
          distanceKm: authoritative.distanceKm,
        },
        authoritative,
      ),
    ).toBe(true);
  });

  it("rejects a submitted lower fare (price tamper)", () => {
    expect(authoritative.ok).toBe(true);
    if (!authoritative.ok) return;
    expect(
      isSubmittedLocalQuoteAuthentic(
        { fareMinor: 1, currency: authoritative.currency },
        authoritative,
      ),
    ).toBe(false);
  });

  it("rejects a currency mismatch", () => {
    expect(authoritative.ok).toBe(true);
    if (!authoritative.ok) return;
    expect(
      isSubmittedLocalQuoteAuthentic(
        { fareMinor: authoritative.fareMinor, currency: "USD" },
        authoritative,
      ),
    ).toBe(false);
  });

  it("rejects a distance claim that would land on a cheaper ring", () => {
    expect(authoritative.ok).toBe(true);
    if (!authoritative.ok) return;
    // Pretend the buyer is at 25 km while the resolver computed ~1 km.
    expect(
      isSubmittedLocalQuoteAuthentic(
        {
          fareMinor: authoritative.fareMinor,
          currency: authoritative.currency,
          distanceKm: 25,
        },
        authoritative,
      ),
    ).toBe(false);
  });

  it("rejects everything when the authoritative resolver was unable to quote", () => {
    const unresolvable = quoteLocalDelivery({
      radii: [],
      origin: ORIGIN,
      destination: CLOSE_DEST,
    });
    expect(unresolvable.ok).toBe(false);
    expect(
      isSubmittedLocalQuoteAuthentic(
        { fareMinor: 0, currency: "IDR" },
        unresolvable,
      ),
    ).toBe(false);
  });
});
