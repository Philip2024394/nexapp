// src/app/nex-native/product/[productId]/page.tsx
//
// Bridge 1 · canonical product destination.
// -------------------------------------------------------------------
// Owner-authorised 2026-11-16 · redesign to match the sealed mock:
//   · large main image, up to 4 real thumbnails
//   · title + real price
//   · description preview + "Read more" expanding to real
//     category-specific specs
//   · prominent orange "Ask Seller" → existing product-context chat
//   · "Add to Cart" → existing sealed cart (centered popup + header
//     count pill unchanged)
//   · floating round back button bottom-right
//
// No new product system · no new chat system · no schema change.
// Specs are read from the existing nex_product.spec jsonb column so
// a plumbing service shows plumbing fields and a phone cover shows
// its own fields without hard-coding anything.

import { notFound } from "next/navigation";
import "../../nex-native.css";
import * as productService from "@/lib/nex-native/product-service";
import * as businessService from "@/lib/nex-native/business-service";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { stripWholesaleFromSpec } from "@/lib/nex-native/catalogue/strip-wholesale";
import { ProductPageClient } from "./_product-page-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Basic UUID sanity guard so we don't slam the DB with garbage. The
// canonical NEX product id is a Postgres uuid; anything else is 404.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatPriceLabel(pence: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(pence / 100);
  } catch {
    return `${currency} ${(pence / 100).toFixed(2)}`;
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  if (!UUID_REGEX.test(productId)) notFound();

  const product = await productService.getProductById(productId);
  if (!product) notFound();
  // Only "live" products are publicly discoverable via canonical URL.
  // Draft / archived remain reachable to their owner via manage
  // surfaces.
  if (product.status !== "live") notFound();

  const business = await businessService.getBusinessById(product.business_id);
  if (!business) notFound();

  const viewer = await resolveSessionWithDevOverride();
  const viewerIsOwner =
    !!viewer && viewer.account.id === business.owner_account_id;
  // Cycle 7 2026-11-24 · Launch Gap A fix · the product page remains
  // browseable signed-out so visitors can discover the product, but
  // the purchase affordances (Ask Seller + Add to Cart) require a
  // signed-in account. Expose the viewer's guest state to the client
  // so each affordance can surface the sealed NexAuthGate banner at
  // click-time with a preserved returnTo that resumes the intended
  // action post-sign-in.
  const isGuest = !viewer;

  const outOfStock = product.stock_status === "sold_out";
  const priceLabel = formatPriceLabel(product.price_pence, product.currency);

  return (
    <div
      className="nex-native-root"
      data-nex-product-page
      style={{
        background: "#FAF3E7",
        // Owner directive 2026-11-16 · parent slide-root is flex +
        // overflow:hidden, so route content claims the scroll column.
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
        <ProductPageClient
          product={{
            id: product.id,
            name: product.name,
            description: product.description,
            image_url: product.image_url,
            gallery_urls: product.gallery_urls,
            // W9 FIX (2026-11-18) · strip reserved `__wholesale` key at the
            // server data boundary before the spec crosses to the client
            // payload. Wholesale per-piece trade terms must never leak via
            // the public retail product-detail payload · access control
            // for wholesale pricing lives behind the dedicated buyer
            // catalogue at `/[businessSlug]/wholesale` with approval
            // enforcement (migration 350).
            spec: stripWholesaleFromSpec(product.spec ?? null),
            price_pence: product.price_pence,
            currency: product.currency,
            dispatch_time: product.dispatch_time,
            sample_request_time: product.sample_request_time,
          }}
          business={{
            id: business.id,
            slug: business.slug,
            display_name: business.display_name,
            owner_account_id: business.owner_account_id,
            logo_url: business.logo_url,
          }}
          priceLabel={priceLabel}
          viewerIsOwner={viewerIsOwner}
          isGuest={isGuest}
          outOfStock={outOfStock}
        />
      </main>
    </div>
  );
}
