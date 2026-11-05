// src/app/nex-native/directory/new/page.tsx
//
// New on NEX · cross-shop product discovery feed · Phase V · P13
// 2026-11-05.
// -----------------------------------------------------------------
// A shopping-destination surface complementing the sealed canonical
// NEX Directory landing at /nex-native/directory/landing. Where the
// canonical landing surfaces BUSINESSES (shop-first discovery), this
// page surfaces PRODUCTS (product-first discovery) · the two sit
// side-by-side in the buyer journey:
//
//   Discover          /nex-native/directory/landing  (shops)
//   What's new        /nex-native/directory/new      (products)  ← HERE
//   Browse a shop     /nex-native/{slug}
//   Product detail    /nex-native/{slug}/{productId}
//
// Sealed doctrine honoured:
//   · Public visitor surface · no auth gate · no price fabrication
//   · Only `status='live'` products surface · drafts never leak
//   · Each tile deep-links to the sealed product URL so the shop
//     context (back-nav, seller card, "more from this shop") is
//     preserved · the buyer's journey stays inside NEX
//   · NEX takes 0% commission · no checkout logic here
//   · Country backdrop + design tokens · no html/body overrides

import type * as React from "react";
import Link from "next/link";
import {
  listRecentLiveProducts,
  type RecentLiveProductCard,
} from "@/lib/nex-native/product-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#050f1e",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7800",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// Page-size cap · the service fn is capped at 48 by default too;
// echo here so the page copy and the fetch stay in sync if either
// is tuned later.
const PAGE_LIMIT = 48;

export default async function DirectoryNewPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}): Promise<React.JSX.Element> {
  const sp = await searchParams;
  // Optional ?shop= lets a shop link to "what's new from OTHER
  // shops" while suppressing their own products from the feed. Fail-
  // soft on any query error · an empty feed renders a helpful
  // empty-state instead of a 500.
  const products = await listRecentLiveProducts({
    limit: PAGE_LIMIT,
    excludeBusinessId:
      typeof sp.shop === "string" && sp.shop.length > 0
        ? sp.shop
        : undefined,
  }).catch(() => [] as RecentLiveProductCard[]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
      }}
    >
      {/* --- Header ------------------------------------------------- */}
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0) + 14px) 16px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${NEX.border}`,
        }}
      >
        <Link
          href="/nex-native/directory/landing"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: NEX.textDim,
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          ← Directory
        </Link>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
          }}
        >
          New on NEX
        </div>
      </header>

      <main
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "24px 16px 48px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          Discover
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontWeight: 500,
            fontSize: "clamp(32px, 6vw, 44px)",
            letterSpacing: "-0.012em",
            lineHeight: 1.05,
            marginBottom: 10,
          }}
        >
          What&rsquo;s new across NEX
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.55,
            color: NEX.textDim,
            maxWidth: 520,
            marginBottom: 24,
          }}
        >
          Recently listed products from every live NEX shop. Tap any
          card to open the product · visit the shop · message the
          seller directly. Buyers pay sellers directly · NEX takes 0%
          commission.
        </p>

        {products.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 14,
              }}
            >
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            <div
              style={{
                marginTop: 28,
                textAlign: "center",
              }}
            >
              <Link
                href="/nex-native/directory/landing"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: "rgba(0,175,255,0.10)",
                  border: `1px solid ${NEX.cyanSoft}`,
                  color: NEX.cyan,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                }}
              >
                Browse all shops →
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ProductCard({
  product,
}: {
  readonly product: RecentLiveProductCard;
}): React.JSX.Element {
  const href = `/nex-native/${product.business_slug}/${product.id}`;
  const price = formatPrice(product.price_pence, product.currency);
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        overflow: "hidden",
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
        color: NEX.text,
        textDecoration: "none",
      }}
    >
      <div
        style={{
          aspectRatio: "1 / 1",
          width: "100%",
          background: NEX.panel,
          position: "relative",
        }}
      >
        {product.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.image_url}
            alt=""
            loading="lazy"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: NEX.textMute,
              fontSize: 28,
            }}
          >
            ◆
          </div>
        )}
      </div>
      <div
        style={{
          padding: "12px 14px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minHeight: 88,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: NEX.textDim,
            fontWeight: 700,
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {product.business_display_name}
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1.2,
            letterSpacing: "-0.005em",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {product.name}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: NEX.orange,
            letterSpacing: "0.01em",
          }}
        >
          {price}
        </div>
      </div>
    </Link>
  );
}

function EmptyState(): React.JSX.Element {
  return (
    <div
      style={{
        padding: "36px 20px",
        borderRadius: 14,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 32,
          marginBottom: 8,
          color: NEX.cyan,
        }}
        aria-hidden
      >
        ◆
      </div>
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 20,
          fontWeight: 500,
          lineHeight: 1.2,
          marginBottom: 6,
        }}
      >
        Nothing new just yet
      </div>
      <p
        style={{
          margin: "0 auto",
          maxWidth: 360,
          fontSize: 12,
          lineHeight: 1.55,
          color: NEX.textDim,
        }}
      >
        No live products on NEX right now in this region. Browse the
        shop directory to find businesses to follow &mdash; new
        products will appear here as sellers publish them.
      </p>
      <div style={{ marginTop: 16 }}>
        <Link
          href="/nex-native/directory/landing"
          style={{
            display: "inline-flex",
            padding: "10px 18px",
            borderRadius: 999,
            background: "rgba(0,175,255,0.10)",
            border: `1px solid ${NEX.cyanSoft}`,
            color: NEX.cyan,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Browse shop directory →
        </Link>
      </div>
    </div>
  );
}

/** Mirrors the formatPrice used on the product detail page. Honest
 *  "Price on request" when the price cannot be computed. */
function formatPrice(
  pence: number | null,
  currency: string | null,
): string {
  if (pence === null || pence < 0) return "Price on request";
  const amount = pence / 100;
  const cc = (currency ?? "").toUpperCase();
  if (cc === "IDR") {
    // IDR is typically displayed without decimals and with thousand-
    // separators (e.g. Rp 25.000).
    try {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `Rp ${Math.round(amount).toLocaleString()}`;
    }
  }
  if (cc === "EUR" || cc === "GBP" || cc === "USD") {
    try {
      return new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: cc,
      }).format(amount);
    } catch {
      return `${cc} ${amount.toFixed(2)}`;
    }
  }
  if (cc) return `${cc} ${amount.toFixed(2)}`;
  return `${amount.toFixed(2)}`;
}
