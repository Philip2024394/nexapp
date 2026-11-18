# Buying Guides

Independent Next editorial buying guides.

**Go-live:** 2026-11-17 — owner-authorised outstanding-gate wiring.
Pages now carry no `robots: { index: false, follow: false }` and the
routes are listed in `sitemap.ts`.

## Routes

- `/nex-generated/buying-guides` — index (grouped by category).
- `/nex-generated/buying-guides/rolex` — Rolex Buying Guide (independent · not affiliated with Rolex SA).
- `/nex-generated/buying-guides/mobile-phones` — Mobile Phone Buying Guide (independent · not affiliated with any handset manufacturer or carrier).
- `/nex-generated/buying-guides/handbags` — Handbag Buying Guide (independent · not affiliated with any bag maker).
- `/nex-generated/buying-guides/laptops` — Laptop Buying Guide (independent · not affiliated with any manufacturer).
- `/nex-generated/buying-guides/running-shoes` — Running Shoes Buying Guide (independent · not affiliated with any footwear brand).
- `/nex-generated/buying-guides/leather-wallets` — Leather Wallet Buying Guide (independent · not affiliated with any wallet brand).

## Preview locally

```
npm run dev
# then open:
# http://localhost:3008/nex-generated/buying-guides
```

## Adding a new guide

1. Add an entry in `_guides-manifest.ts` with `status: "published"`.
2. Create `./<slug>/page.tsx` on the shared `GuideLayout` from `../_guide-layout`.
3. Add the new route to `src/app/sitemap.ts` STATIC_ENTRIES.
4. Ship with its own evidence ledger under `evidence/buying-guides/<slug>/`.

## Image slots

Every inline image slot renders as an accessible square placeholder
(`<figure role="img" aria-label="Image slot N — awaiting owner upload">`)
with `data-image-slot={N}`, a visible numbered badge, a dashed border
and a short caption hint. Owner-supplied images are swapped in at
integration time.

## Scope & safety

- Independent editorial content · no commercial affiliation with any
  brand or retailer discussed.
- No DB queries, no server actions, no auth gating.
- The single outbound link is the seller-recruitment button, which
  routes to the existing sealed shop-onboarding landing at
  `/nex-native/manage/shop/start`.
