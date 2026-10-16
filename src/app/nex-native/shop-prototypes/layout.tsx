// src/app/nex-native/shop-prototypes/layout.tsx
//
// Production containment layout · B9/B10 · 2026-10-14.
//
// Pages under /nex-native/shop-prototypes/* are shop-UI design
// prototypes (voucher-pages, caption-readability, direct-price,
// direct-price/share-banner, story-reel). None has a server action,
// API dependency, or data mutation path. Grep confirms zero production
// hrefs point into this subtree from outside it.
//
// This layout gates the whole subtree with notFound() when
// NODE_ENV === "production". Development remains fully browsable.
//
// Note on commerce: these prototypes are UI-only. They do NOT activate
// the sealed commerce flag (NEX_COMMERCE_ENABLED) and do NOT bypass
// any server-side entitlement gate. Server-side commerce routes
// (cart, orders, [businessSlug], onboarding, conversations, liked)
// are protected separately by `commerceEnabledForRequest` which was
// hardened in the same B9/B10 pass to refuse the ?commerce=1 query
// bypass in production.
//
// See docs/doctrine/nex-production-route-containment-review-2026-10-14.md.

import type * as React from "react";
import { notFound } from "next/navigation";

export default function ShopPrototypesContainment({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  // Owner directive 2026-10-16 · opt out of the desktop phone-frame
  // so shop-UI prototype reviews use the available desktop width.
  return <div className="nex-admin-root">{children}</div>;
}
