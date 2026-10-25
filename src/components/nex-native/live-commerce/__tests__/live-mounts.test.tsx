// src/components/nex-native/live-commerce/__tests__/live-mounts.test.tsx
//
// Phase 2 · G2 · integration tests for LiveHeartbeatRing +
// LiveProductIndicator + ShopLiveStrip rendered consumers.
// -----------------------------------------------------------------------------
// EVIDENCE BOUNDARY
//   · Rendered-HTML tests via renderToStaticMarkup (sealed convention).
//   · Source-shape tests on the consumer surface wiring.
//   · No real DB access. The mount-point behaviour depends on the
//     fail-open service reads; sandbox verification is deferred.

import { describe, it, test, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LiveHeartbeatRing } from "../LiveHeartbeatRing";
import { LiveProductIndicator } from "../LiveProductIndicator";
import { ShopLiveStrip } from "../ShopLiveStrip";

/* ─── Rendered behaviour · LiveHeartbeatRing ─────────────────── */

describe("LiveHeartbeatRing · rendered", () => {
  test("isLive=false renders children untouched (no ring markup)", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        LiveHeartbeatRing,
        { isLive: false, children: React.createElement("span", { id: "x" }) },
      ),
    );
    expect(html).toContain('data-nex-live-heartbeat="off"');
    expect(html).toContain('id="x"');
    expect(html).not.toContain("LIVE");
    expect(html).not.toMatch(/role="img"/);
  });

  test("isLive=true renders animated ring + LIVE pill + aria-label", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        LiveHeartbeatRing,
        {
          isLive: true,
          ariaLabel: "Aisha is live now",
          children: React.createElement("div", { id: "y" }),
        },
      ),
    );
    expect(html).toContain('data-nex-live-heartbeat="on"');
    expect(html).toContain("Aisha is live now");
    expect(html).toContain("Live");
    expect(html).toContain("conic-gradient");
    expect(html).toContain('role="img"');
  });

  test("onTapHref wraps the ring in a Link", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        LiveHeartbeatRing,
        {
          isLive: true,
          onTapHref: "/nex-native/live-commerce/abc-123",
          children: React.createElement("span"),
        },
      ),
    );
    expect(html).toMatch(/data-nex-live-heartbeat-link/);
    expect(html).toContain("/nex-native/live-commerce/abc-123");
  });

  test("respects prefers-reduced-motion via CSS", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        LiveHeartbeatRing,
        {
          isLive: true,
          children: React.createElement("span"),
        },
      ),
    );
    expect(html).toContain("prefers-reduced-motion");
  });
});

/* ─── Rendered behaviour · LiveProductIndicator ───────────────── */

describe("LiveProductIndicator · rendered", () => {
  test("isFeaturedLive=false renders nothing", () => {
    const el = React.createElement(LiveProductIndicator, {
      isFeaturedLive: false,
    });
    const html = renderToStaticMarkup(el);
    expect(html).toBe("");
  });

  test("isFeaturedLive=true renders the LIVE chip with pulsing dot", () => {
    const html = renderToStaticMarkup(
      React.createElement(LiveProductIndicator, {
        isFeaturedLive: true,
      }),
    );
    expect(html).toMatch(/data-nex-live-product-indicator/);
    expect(html).toContain("Live");
    expect(html).toContain("nexLiveProductDot");
  });

  test("watchHref wraps the chip in a Link to the broadcast", () => {
    const html = renderToStaticMarkup(
      React.createElement(LiveProductIndicator, {
        isFeaturedLive: true,
        watchHref: "/nex-native/live-commerce/session-xyz?product=abc",
      }),
    );
    expect(html).toMatch(/data-nex-live-product-indicator-link/);
    expect(html).toContain("session-xyz");
    expect(html).toContain("product=abc");
  });

  test("accessible label defaults to a tap-to-watch description", () => {
    const html = renderToStaticMarkup(
      React.createElement(LiveProductIndicator, {
        isFeaturedLive: true,
      }),
    );
    expect(html).toMatch(/aria-label="[^"]*live now[^"]*tap to watch[^"]*"/);
  });
});

/* ─── Rendered behaviour · ShopLiveStrip ─────────────────────── */

describe("ShopLiveStrip · rendered", () => {
  test("isLive=false renders nothing", () => {
    const html = renderToStaticMarkup(
      React.createElement(ShopLiveStrip, {
        isLive: false,
        watchHref: null,
        broadcasterLabel: "Aisha",
      }),
    );
    expect(html).toBe("");
  });

  test("isLive=true + watchHref=null renders nothing (no destination)", () => {
    const html = renderToStaticMarkup(
      React.createElement(ShopLiveStrip, {
        isLive: true,
        watchHref: null,
        broadcasterLabel: "Aisha",
      }),
    );
    expect(html).toBe("");
  });

  test("renders broadcaster label when no featured product", () => {
    const html = renderToStaticMarkup(
      React.createElement(ShopLiveStrip, {
        isLive: true,
        watchHref: "/nex-native/live-commerce/sess-1",
        broadcasterLabel: "Aisha Vintage Cameras",
      }),
    );
    expect(html).toContain("Aisha Vintage Cameras is live now");
    expect(html).toContain("/nex-native/live-commerce/sess-1");
    expect(html).toContain("Watch");
  });

  test("renders featured product name when present", () => {
    const html = renderToStaticMarkup(
      React.createElement(ShopLiveStrip, {
        isLive: true,
        watchHref: "/nex-native/live-commerce/sess-1",
        broadcasterLabel: "Aisha",
        featuredProductName: "Leica M6",
      }),
    );
    expect(html).toContain("demonstrating Leica M6");
    expect(html).not.toContain("Aisha is live now");
  });
});

/* ─── Source-shape · product-detail page wiring ───────────────── */

const PRODUCT_PAGE = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "app",
    "nex-native",
    "[businessSlug]",
    "[productId]",
    "page.tsx",
  ),
  "utf8",
);

describe("Product-detail page · live-mount wiring (source-shape)", () => {
  it("imports LiveHeartbeatRing + LiveProductIndicator", () => {
    expect(PRODUCT_PAGE).toMatch(/import \{ LiveHeartbeatRing \}/);
    expect(PRODUCT_PAGE).toMatch(/import \{ LiveProductIndicator \}/);
  });

  it("resolves ownerLiveSession via getActiveSessionForBroadcaster", () => {
    expect(PRODUCT_PAGE).toMatch(
      /getActiveSessionForBroadcaster\(\s*business\.owner_account_id/,
    );
  });

  it("resolves productIsFeatured by comparing this product to the active pin", () => {
    expect(PRODUCT_PAGE).toMatch(
      /activePin\?\.product_id === product\.id/,
    );
  });

  it("the live-watch href includes the specific product id", () => {
    expect(PRODUCT_PAGE).toMatch(
      /\/nex-native\/live-commerce\/\$\{ownerLiveSession\.id\}\?product=\$\{encodeURIComponent\(product\.id\)\}/,
    );
  });

  it("product-level indicator only renders when productIsFeatured + href present", () => {
    expect(PRODUCT_PAGE).toMatch(
      /\{productIsFeatured && liveWatchHref && \(/,
    );
  });

  it("heartbeat ring wraps the 52×52 avatar container", () => {
    expect(PRODUCT_PAGE).toMatch(
      /<LiveHeartbeatRing[\s\S]*?size=\{52\}[\s\S]*?onTapHref=\{liveWatchHref\}/,
    );
  });

  it("never claims cross-seller Live state (owner-of-this-product only)", () => {
    // The call site uses business.owner_account_id directly · never
    // a different account id. Enumerate all call sites in this file
    // and assert the FIRST positional argument is
    // business.owner_account_id specifically. Later positional args
    // (e.g. the Plan v4 · AC-1 injected `nowMs`) are permitted and
    // irrelevant to the cross-seller-leak invariant this test guards.
    const callSites = [
      ...PRODUCT_PAGE.matchAll(/getActiveSessionForBroadcaster\(([^)]*)\)/g),
    ];
    expect(callSites.length).toBeGreaterThan(0);
    for (const match of callSites) {
      const firstArg = (match[1] ?? "").split(",")[0]?.trim() ?? "";
      expect(firstArg).toBe("business.owner_account_id");
    }
  });
});

/* ─── Source-shape · shop page wiring ────────────────────────── */

const SHOP_PAGE = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "app",
    "nex-native",
    "[businessSlug]",
    "page.tsx",
  ),
  "utf8",
);

describe("Shop page · live-mount wiring (source-shape)", () => {
  it("imports ShopLiveStrip + live-session-service", () => {
    expect(SHOP_PAGE).toMatch(/import \{ ShopLiveStrip \}/);
    expect(SHOP_PAGE).toMatch(/getActiveSessionForBroadcaster/);
    expect(SHOP_PAGE).toMatch(/getFeaturedProductForSession/);
  });

  it("live state is derived from business.owner_account_id (no cross-seller leak)", () => {
    expect(SHOP_PAGE).toMatch(
      /getActiveSessionForBroadcaster\(\s*\n?\s*business\.owner_account_id/,
    );
  });

  it("ShopLiveStrip is mounted conditionally on ownerLiveSession existing", () => {
    // Plan v4 · AC-2 · the gate now also requires the authoritative
    // liveness verdict (`shopLiveness.isLive`) to be true. We assert
    // both the row-existence guard AND the verdict guard are present.
    expect(SHOP_PAGE).toMatch(
      /\{ownerLiveSession && shopLiveness\.isLive && \(/,
    );
    expect(SHOP_PAGE).toMatch(/<ShopLiveStrip[\s\S]*?isLive=\{true\}/);
  });

  it("watchHref prefers the ?product= deep-link when a pin is active", () => {
    expect(SHOP_PAGE).toMatch(
      /\?product=\$\{encodeURIComponent\(activePin\.product_id\)\}/,
    );
  });

  it("featured-product name resolution is fail-open (try/catch)", () => {
    expect(SHOP_PAGE).toMatch(
      /try \{[\s\S]*?productService\.getProductById\(activePin\.product_id\)[\s\S]*?\} catch/,
    );
  });
});

/* ─── Source-shape · viewer surface ?product= deep-link ───────── */

const VIEWER_PAGE = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "app",
    "nex-native",
    "live-commerce",
    "[sessionId]",
    "page.tsx",
  ),
  "utf8",
);

describe("Viewer surface · ?product= deep-link wiring", () => {
  it("accepts searchParams.product", () => {
    expect(VIEWER_PAGE).toMatch(
      /searchParams:\s*Promise<\{\s*product\?:\s*string\s*\}>/,
    );
  });

  it("shape-validates the product param (UUID regex)", () => {
    expect(VIEWER_PAGE).toMatch(/UUID_SHAPE/);
    expect(VIEWER_PAGE).toMatch(
      /\/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$\/i/,
    );
  });

  it("passes incomingProductHint through to the viewer client", () => {
    expect(VIEWER_PAGE).toMatch(/incomingProductHint=\{incomingProductHint\}/);
  });

  it("silently drops malformed values (does NOT claim the product is live)", () => {
    expect(VIEWER_PAGE).toMatch(
      /incomingProductHint =[\s\S]*?UUID_SHAPE\.test\(sp\.product\)[\s\S]*?:\s*null/,
    );
  });
});
