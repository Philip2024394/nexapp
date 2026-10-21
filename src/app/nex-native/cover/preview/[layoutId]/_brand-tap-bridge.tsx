"use client";

// src/app/nex-native/cover/preview/[layoutId]/_brand-tap-bridge.tsx
//
// Owner directive 2026-10-22 · prototype bridge · when the sealed
// cover-preview is loaded inside the NEX Themes Marketplace iframe
// with `?brand=<id>`, product-card taps route to the parent-window
// menu-item sheet instead of the sealed peer-chat flow.
//
// Boundary · only takes effect when the window has a cross-document
// parent (iframe context). Direct navigation to
// `/nex-native/cover/preview/[layoutId]` has no parent, so the
// listener never fires and the sealed commerce path
// (tap product → `/nex-native/chat/peer/{seller}?product=…`)
// stays intact.
//
// Interception strategy · a document-level capturing click listener
// walks up from the click target to find the nearest <a href="…">.
// If the href matches the sealed peer-chat product pattern, we
// preventDefault + stopPropagation and postMessage up:
//
//   { type: "nex-marketplace:product-tap", brand, productId }
//
// The marketplace prototype parent listens for this and opens the
// menu-item bottom sheet. The sealed CoverCatalog + its product
// cards are untouched.

import * as React from "react";

const CHAT_PEER_PATTERN = /\/nex-native\/chat\/peer\/[^/?]+\?product=([^&]+)/;

export function BrandTapBridge({
  brand,
}: {
  readonly brand: string;
}): null {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    // Not embedded · the direct-navigation sealed flow is correct ·
    // bridge is a no-op.
    if (window.parent === window) return;

    const handleClick = (event: MouseEvent) => {
      let node = event.target as HTMLElement | null;
      while (node && node !== document.body) {
        if (node.tagName === "A") {
          const href =
            (node as HTMLAnchorElement).getAttribute("href") ?? "";
          const match = href.match(CHAT_PEER_PATTERN);
          if (match && match[1]) {
            event.preventDefault();
            event.stopPropagation();
            try {
              window.parent.postMessage(
                {
                  type: "nex-marketplace:product-tap",
                  brand,
                  productId: decodeURIComponent(match[1]),
                },
                "*",
              );
            } catch {
              // Parent postMessage can fail across origin boundaries.
              // Silent · the user can still scroll the catalog.
            }
            return;
          }
        }
        node = node.parentElement;
      }
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () =>
      document.removeEventListener("click", handleClick, { capture: true });
  }, [brand]);

  return null;
}
