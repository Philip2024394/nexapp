// @vitest-environment jsdom
// src/components/nex-native/shop-drawer/__tests__/shop-drawer-viewer-kind.test.tsx
//
// NEX Shop Drawer · viewer-kind regression suite · 2026-11-18 prompt-4.
// -----------------------------------------------------------------------------
// Pins the identity-aware branching contract added 2026-11-18 after the
// Nex-Guest localhost:3008 observation that Treaty Bar Hoodie / Dublin
// print / Roasted Blend demo cards were visible to a signed-out visitor
// in the LEFT seller-products drawer.
//
// Root cause (traced before the fix):
//   · src/app/nex-native/free-chat/page.tsx hardcoded viewerHasShop={true}
//     which forced the drawer out of its noShopMode branch.
//   · src/components/nex-native/shop-drawer/shop-drawer-client.tsx line
//     117 fell back to MOCK_SHOP_PRODUCTS whenever a mount omitted the
//     `products` prop. The free-chat mount omitted it, so every visitor
//     saw the Phase-1 demo fixtures.
//
// This suite does NOT re-prove that bug; it pins the FIX so a future
// drive-by re-adding a mock fallback or dropping the `viewerKind` prop
// will fail immediately.

import { describe, expect, it, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { ShopDrawer } from "../shop-drawer-client";

afterEach(() => {
  cleanup();
});

const NO_OP = (): void => {};

function openDrawer(container: HTMLElement): void {
  const trigger = container.querySelector<HTMLButtonElement>(
    "[data-nex-shop-drawer-trigger]",
  );
  if (!trigger) throw new Error("drawer FAB trigger not rendered");
  fireEvent.click(trigger);
}

describe("ShopDrawer · identity-aware viewer kinds (2026-11-18 prompt-4)", () => {
  it("guest viewer sees create-account container, NOT mock products", () => {
    const { container } = render(
      <ShopDrawer
        viewerKind="guest"
        viewerHasShop={false}
        peerDisplayName="your pick"
        shareAction={NO_OP}
      />,
    );
    openDrawer(container);
    // Guest container is rendered
    expect(
      document.querySelector("[data-nex-shop-drawer-guest]"),
    ).not.toBeNull();
    // CTA points at the signup surface
    const cta = document.querySelector<HTMLAnchorElement>(
      "[data-nex-shop-drawer-guest-cta]",
    );
    expect(cta?.getAttribute("href")).toBe("/nex-native/sign-in?mode=signup");
    // No Phase-1 mocks leaked
    expect(document.body.textContent).not.toMatch(/Treaty Bar Hoodie/);
    expect(document.body.textContent).not.toMatch(/Dublin print/i);
    expect(document.body.textContent).not.toMatch(/Roasted Blend/i);
    // Not the activate-shop container, not the shop-empty container
    expect(
      document.querySelector("[data-nex-shop-drawer-activate]"),
    ).toBeNull();
    expect(
      document.querySelector("[data-nex-shop-drawer-shop-empty]"),
    ).toBeNull();
  });

  it("no-shop signed-in viewer sees activate-your-shop container, NOT mocks", () => {
    const { container } = render(
      <ShopDrawer
        viewerKind="no-shop"
        viewerHasShop={false}
        peerDisplayName="your pick"
        shareAction={NO_OP}
      />,
    );
    openDrawer(container);
    expect(
      document.querySelector("[data-nex-shop-drawer-activate]"),
    ).not.toBeNull();
    const cta = document.querySelector<HTMLAnchorElement>(
      "[data-nex-shop-drawer-activate-cta]",
    );
    expect(cta?.getAttribute("href")).toBe("/nex-native/manage/shop");
    expect(document.body.textContent).not.toMatch(/Treaty Bar Hoodie/);
    expect(
      document.querySelector("[data-nex-shop-drawer-guest]"),
    ).toBeNull();
    expect(
      document.querySelector("[data-nex-shop-drawer-shop-empty]"),
    ).toBeNull();
  });

  it("shop-owning viewer with zero products sees 'no products yet' container, NOT mocks", () => {
    const { container } = render(
      <ShopDrawer
        viewerKind="shop"
        viewerHasShop={true}
        products={[]}
        peerDisplayName="your pick"
        shareAction={NO_OP}
      />,
    );
    openDrawer(container);
    expect(
      document.querySelector("[data-nex-shop-drawer-shop-empty]"),
    ).not.toBeNull();
    const cta = document.querySelector<HTMLAnchorElement>(
      "[data-nex-shop-drawer-shop-empty-cta]",
    );
    expect(cta?.getAttribute("href")).toBe("/nex-native/manage/products");
    expect(document.body.textContent).not.toMatch(/Treaty Bar Hoodie/);
    expect(
      document.querySelector("[data-nex-shop-drawer-guest]"),
    ).toBeNull();
    expect(
      document.querySelector("[data-nex-shop-drawer-activate]"),
    ).toBeNull();
  });

  it("shop-owning viewer with real products sees their own product cards", () => {
    const { container } = render(
      <ShopDrawer
        viewerKind="shop"
        viewerHasShop={true}
        products={[
          {
            id: "real-prod-1",
            name: "Owner's Real Product",
            priceLabel: "€9.99",
            imageUrl: null,
          },
        ]}
        peerDisplayName="your pick"
        shareAction={NO_OP}
      />,
    );
    openDrawer(container);
    expect(document.body.textContent).toMatch(/Owner's Real Product/);
    expect(document.body.textContent).not.toMatch(/Treaty Bar Hoodie/);
    // None of the empty-state containers are rendered
    expect(
      document.querySelector("[data-nex-shop-drawer-guest]"),
    ).toBeNull();
    expect(
      document.querySelector("[data-nex-shop-drawer-activate]"),
    ).toBeNull();
    expect(
      document.querySelector("[data-nex-shop-drawer-shop-empty]"),
    ).toBeNull();
  });

  it("legacy mount (viewerKind undefined) still works · noShopMode when viewerHasShop=false", () => {
    // Backward-compat check · the peer-catalog page is the only other
    // caller and it passes peerCatalog=true, but we still ensure the
    // undefined-viewerKind path keeps the historical noShopMode gate.
    const { container } = render(
      <ShopDrawer
        viewerHasShop={false}
        peerDisplayName="your pick"
        shareAction={NO_OP}
      />,
    );
    openDrawer(container);
    expect(
      document.querySelector("[data-nex-shop-drawer-activate]"),
    ).not.toBeNull();
  });

  it("peer-catalog mode is unaffected by viewerKind · never renders guest/activate/shop-empty containers", () => {
    const { container } = render(
      <ShopDrawer
        peerCatalog={true}
        viewerHasShop={false}
        products={[]}
        peerDisplayName="Aoife"
        shareAction={NO_OP}
      />,
    );
    openDrawer(container);
    expect(
      document.querySelector("[data-nex-shop-drawer-guest]"),
    ).toBeNull();
    expect(
      document.querySelector("[data-nex-shop-drawer-activate]"),
    ).toBeNull();
    expect(
      document.querySelector("[data-nex-shop-drawer-shop-empty]"),
    ).toBeNull();
  });
});
