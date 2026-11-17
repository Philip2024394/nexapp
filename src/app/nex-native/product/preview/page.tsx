// src/app/nex-native/product/preview/page.tsx
//
// Owner-authorised 2026-11-16 · product-page PREVIEW route.
// -----------------------------------------------------------------
// Renders the sealed <ProductPageClient /> layout with inline MOCK
// data so the design can be reviewed without seeding a real sandbox
// product. No database read, no auth requirement, no sandbox needed.
//
// Explicitly separated from the canonical `/nex-native/product/<id>`
// route so a real product URL still 404s honestly when the id does
// not resolve against the live `nex_product` table.
//
// Demo mode is forwarded to the client so Ask Seller + Add to Cart
// become no-op buttons with a short "Preview mode" toast · nothing
// writes to the real cart or opens a real conversation.

import "../../nex-native.css";
import { ProductPageClient } from "../[productId]/_product-page-client";
import type { NexProductSpec } from "@/lib/nex-native/types";
// Owner-authorised 2026-11-16 · MOCK-ONLY review-demo wiring.
// REVIEW_DEMO_PREVIEW_PRODUCT_ID is the id the demo store seeds
// reviews against · aligning it here makes the preview route's star
// row show the same aggregate the drawer's "Leave a review" button
// writes to.
import { REVIEW_DEMO_PREVIEW_PRODUCT_ID } from "@/lib/nex-native/reviews/mock-review-store";
import { PreviewDemoEnabler } from "./_preview-demo-enabler";

export const runtime = "nodejs";
export const dynamic = "force-static";

// ─── Mock data ────────────────────────────────────────────────────
//
// Shape mirrors `nex_product` so the real client component can render
// it verbatim. Images point at a public image CDN (no local asset
// copies needed). Specs demonstrate the universal keys documented in
// `src/lib/nex-native/types.ts:842-891` so the Read-more section has
// something meaningful to show.

const MOCK_SPEC: NexProductSpec = {
  condition: "new",
  brand: "NEX Leatherwork",
  model: "LC-14 Pro",
  materials: ["Full-grain Italian leather", "Microfiber lining"],
  dimensions: { w: 72, h: 148, d: 11, unit: "mm" },
  weight: { value: 38, unit: "g" },
  included: ["Phone cover", "Dust bag", "Care card"],
  warranty: "12 months manufacturer",
  origin: "Yogyakarta, Indonesia",
  care_instructions: "Wipe with a dry cloth · avoid direct sunlight",
};

// Inline SVG mock images so the preview renders instantly without
// relying on an external CDN. Four distinct tones so swapping the
// thumbnail visibly changes the main image. Encoded with base64 so
// the `#` fill values and other reserved URL characters don't need
// per-char escaping.
function mockPhoneCoverSvg(label: string, body: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f5f1ea"/><stop offset="1" stop-color="#e5ddcf"/></linearGradient><linearGradient id="leather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${body}"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs><rect width="400" height="400" fill="url(#bg)"/><g transform="translate(130 60)"><rect x="0" y="0" width="140" height="280" rx="22" fill="url(#leather)" stroke="#2a1a0a" stroke-width="2"/><circle cx="36" cy="40" r="18" fill="#111" stroke="#2a1a0a" stroke-width="2"/><circle cx="36" cy="40" r="6" fill="#3a3a3a"/><rect x="22" y="70" width="96" height="8" rx="2" fill="#1a0a04" opacity="0.4"/><circle cx="70" cy="200" r="24" fill="#ffffff" opacity="0.14"/><text x="70" y="208" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#f8efdc">N</text></g><text x="200" y="372" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" font-weight="800" fill="#6b533a" letter-spacing="2">${label}</text></svg>`;
  const b64 = Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${b64}`;
}

const MOCK_PRODUCT = {
  id: REVIEW_DEMO_PREVIEW_PRODUCT_ID,
  name: "Premium Leather Phone Cover",
  description:
    "Handcrafted genuine leather. Stylish, durable and perfect fit for your phone. Full-grain Italian leather exterior with a soft microfiber lining to prevent scratches on the device. Each cover is cut, stitched and finished by hand in our Yogyakarta workshop so no two pieces look exactly alike. Precision cutouts for the camera, charging port, speaker grille and side buttons keep every control fully usable without removing the case.",
  image_url: mockPhoneCoverSvg("TAN", "#b58a52", "#7a4f24"),
  gallery_urls: [
    mockPhoneCoverSvg("BLACK", "#2b2420", "#0d0a08"),
    mockPhoneCoverSvg("COGNAC", "#c6762b", "#7d3e0a"),
    mockPhoneCoverSvg("ESPRESSO", "#5a3920", "#2b1a0a"),
  ],
  spec: MOCK_SPEC,
  price_pence: 4999,
  currency: "EUR",
  dispatch_time: "Ships in 1-2 business days",
  sample_request_time: null,
};

// Mock shop logo · simple round monogram SVG for the header badge.
function mockShopLogoSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="72" height="72"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b58a52"/><stop offset="1" stop-color="#7a4f24"/></linearGradient></defs><rect width="72" height="72" fill="url(#g)"/><text x="36" y="46" text-anchor="middle" font-family="Georgia, serif" font-size="34" font-weight="800" fill="#f8efdc">N</text></svg>`;
  const b64 = Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${b64}`;
}

const MOCK_BUSINESS = {
  id: "00000000-0000-4000-8000-00000000aaaa",
  slug: "preview-shop",
  display_name: "NEX Leatherwork",
  owner_account_id: "00000000-0000-4000-8000-00000000bbbb",
  logo_url: mockShopLogoSvg(),
};

export default function Page() {
  return (
    <div
      className="nex-native-root"
      data-nex-product-page
      style={{
        background: "#FAF3E7",
        // Owner directive 2026-11-16 · the parent
        // `[data-nex-page-slide-root]` is `display:flex; overflow:hidden`
        // so the route content itself must claim the scroll column.
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <main
        className="mx-auto"
        style={{
          maxWidth: 460,
          padding: "10px 0 32px",
          position: "relative",
          background: "#FAF3E7",
        }}
      >
        <PreviewDemoEnabler />
        <ProductPageClient
          product={MOCK_PRODUCT}
          business={MOCK_BUSINESS}
          priceLabel="€49.99"
          viewerIsOwner={false}
          outOfStock={false}
          demoMode
          // Owner-authorised 2026-11-16 · `rating` prop no longer
          // passed · the client reads the live average from the
          // review-demo store so the Post popup → star row round
          // trip stays honest. The old 4.8/1245 mock numbers were
          // fabricated pre-store and could drift from the actual
          // seeded data.
        />
      </main>
    </div>
  );
}
