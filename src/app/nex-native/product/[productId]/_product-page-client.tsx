"use client";

// src/app/nex-native/product/[productId]/_product-page-client.tsx
//
// Owner-authorised 2026-11-16 · product-page redesign.
// -----------------------------------------------------------------
// Replaces the slide-up product-detail slider with a full product
// page matching the sealed UI mock:
//
//   1. Large main image at the top.
//   2. Up to 4 real thumbnails below · tap to swap main image ·
//      hidden with only one image · clean placeholder with none.
//   3. Title + real price (stars suppressed · no rating backend).
//   4. 2-3 line description preview · "Read more" expands to the
//      full description PLUS the saved category-specific `spec`
//      fields rendered as a clean list. "Read less" collapses.
//   5. Prominent orange "Ask Seller" button → existing
//      openShopChatAction (product-context chat · product chip
//      painted above the composer).
//   6. "Add to Cart" button underneath → sealed AddToCartButton
//      (centered cart popup + header count pill unchanged).
//   7. Floating round back button with left arrow, bottom-right,
//      fixed position, with safe-area + lifted above the Add to
//      Cart sticky row so it never covers the primary CTAs.
//
// No new product system · no new chat system · no schema change.

import * as React from "react";
import { useRouter } from "next/navigation";
import type { NexProductSpec } from "@/lib/nex-native/types";
import { AddToCartButton, type AddToCartItemInit } from "../../_add-to-cart-button";
import { openShopChatAction } from "../../[businessSlug]/_open-shop-chat-action";
import { CartHeaderButton } from "@/components/nex-native/cart-header-button/cart-header-button-client";
// Owner-authorised 2026-11-16 · MOCK-ONLY review-demo integration.
// Reviews state is read via a hook · when the explicit demo flag is
// off the hook returns a zero-count summary and the rating row stays
// gated exactly as before.
import {
  useIsReviewDemoOn,
  useProductReviewSummary,
} from "@/lib/nex-native/reviews/review-store-provider";
import { ReviewsListPopup } from "@/components/nex-native/reviews/ReviewsListPopup";

const ORANGE = "#FF7A00";
const ORANGE_DARK = "#E86A00";
const INK = "#1A1F2B";
const INK_DIM = "#5F6773";
const INK_SOFT = "#8A939E";
const PLACEHOLDER_BG = "#F2F3F5";
const STAR_GOLD = "#F6A51A";
const STOCK_GREEN = "#1E8E3E";
const STOCK_GREEN_BG = "rgba(30,142,62,0.12)";

const MAX_THUMBS = 3;
const DESC_PREVIEW_CLAMP = 4; // lines · matches sealed 2026-11-16 mock

export interface ProductPageClientProps {
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly description: string | null;
    readonly image_url: string | null;
    readonly gallery_urls: string[] | null;
    readonly spec: NexProductSpec | null;
    readonly price_pence: number;
    readonly currency: string;
    readonly dispatch_time: string | null;
    readonly sample_request_time: string | null;
  };
  readonly business: {
    readonly id: string;
    readonly slug: string;
    readonly display_name: string;
    readonly owner_account_id: string;
    readonly logo_url?: string | null;
  };
  readonly priceLabel: string;
  readonly viewerIsOwner: boolean;
  readonly outOfStock: boolean;
  /** Owner-authorised 2026-11-16 · preview / demo mode. When true, Ask
   *  Seller + Add to Cart become no-op buttons that surface a small
   *  "preview" notice instead of posting to the real server action /
   *  writing to the real cart. Used by `/nex-native/product/preview`
   *  so the layout can be reviewed with mock data without wiring up a
   *  real seller or polluting the buyer's cart. The back FAB routes to
   *  the directory landing when there is no history. */
  readonly demoMode?: boolean;
  /** Owner-authorised 2026-11-16 · optional rating row. Rendered ONLY
   *  when real rating data is passed through. The live `nex_product`
   *  schema has no rating columns today, so the real product page
   *  does not pass this prop and the star row stays hidden. The
   *  preview route passes mock numbers so the sealed layout mock
   *  reviews truthfully. Fabricating rating data on the live page
   *  remains forbidden until a rating backend exists. */
  readonly rating?: {
    readonly score: number;
    readonly count: number;
  } | null;
}

export function ProductPageClient({
  product,
  business,
  priceLabel,
  viewerIsOwner,
  outOfStock,
  demoMode = false,
  rating = null,
}: ProductPageClientProps): React.JSX.Element {
  const router = useRouter();
  const [demoNotice, setDemoNotice] = React.useState<string | null>(null);
  // Owner-authorised 2026-11-16 · MOCK-ONLY review-demo wiring. The
  // demo store is sealed off in production via `useIsReviewDemoOn` ·
  // when off, `summary.count === 0` and the live rating gate below
  // (`effectiveRating`) falls back to the explicit `rating` prop.
  const demoOn = useIsReviewDemoOn();
  const demoSummary = useProductReviewSummary(product.id);
  const effectiveRating = React.useMemo<
    { score: number; count: number } | null
  >(() => {
    if (demoOn && demoSummary.count > 0) {
      return { score: demoSummary.averageScore, count: demoSummary.count };
    }
    return rating;
  }, [demoOn, demoSummary, rating]);
  const [reviewsOpen, setReviewsOpen] = React.useState(false);
  React.useEffect(() => {
    if (!demoNotice) return;
    const t = window.setTimeout(() => setDemoNotice(null), 2600);
    return () => window.clearTimeout(t);
  }, [demoNotice]);

  // ---- Gallery -----------------------------------------------------
  //
  // Only the product's REAL images are used — never invented. The
  // main image seeds from product.image_url; the thumbnail strip
  // includes it + up to 3 gallery_urls entries (first four real
  // images total). Tapping a thumb swaps the main image.
  const images = React.useMemo<string[]>(() => {
    const gallery = Array.isArray(product.gallery_urls)
      ? product.gallery_urls.filter(
          (u): u is string => typeof u === "string" && u.length > 0,
        )
      : [];
    const list: string[] = [];
    if (product.image_url) list.push(product.image_url);
    for (const u of gallery) {
      if (list.includes(u)) continue;
      list.push(u);
      if (list.length >= MAX_THUMBS) break;
    }
    return list;
  }, [product.image_url, product.gallery_urls]);

  const [activeImage, setActiveImage] = React.useState<string | null>(
    images[0] ?? null,
  );

  // ---- Description / specs expand ---------------------------------
  const [descExpanded, setDescExpanded] = React.useState(false);
  const specsRef = React.useRef<HTMLDListElement | null>(null);
  // Owner directive 2026-11-16 · when the buyer taps the chevron the
  // newly-revealed spec table lives below the viewport fold. Scroll it
  // into view so the user doesn't have to hunt for it. Runs after the
  // expansion commits so layout is settled.
  React.useEffect(() => {
    if (!descExpanded) return;
    const id = window.requestAnimationFrame(() => {
      specsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [descExpanded]);
  const descriptionText = (product.description ?? "").trim();
  const hasDescription = descriptionText.length > 0;
  const specEntries = React.useMemo(
    () => extractSpecEntries(product.spec ?? null, {
      dispatch_time: product.dispatch_time,
      sample_request_time: product.sample_request_time,
    }),
    [product.spec, product.dispatch_time, product.sample_request_time],
  );
  const hasSpecs = specEntries.length > 0;
  const hasExpandable =
    hasSpecs || (hasDescription && descriptionText.length > 160);

  // ---- Back button -------------------------------------------------
  const handleBack = React.useCallback(() => {
    if (typeof window === "undefined") return;
    // History length > 1 means there is a previous page in this tab
    // session to return to (the shop surface the buyer tapped from,
    // or the chat where the product drawer lived). This preserves
    // scroll because the browser restores it.
    if (window.history.length > 1) {
      router.back();
      return;
    }
    // Fallback · no history (direct link, reload) → seller's shop
    // in normal mode · directory landing in demo mode (there is no
    // real shop behind a mock product).
    router.push(
      demoMode
        ? "/nex-native/directory/landing"
        : `/nex-native/${business.slug}`,
    );
  }, [router, business.slug, demoMode]);

  // ---- Ask Seller form (bound server action) -----------------------
  const askSellerAction = React.useMemo(
    () => openShopChatAction.bind(null, business.slug),
    [business.slug],
  );

  // ---- Add to Cart item shape -------------------------------------
  const cartItem: AddToCartItemInit = {
    kind: "product",
    id: product.id,
    shop_id: business.id,
    shop_slug: business.slug,
    shop_owner_account_id: business.owner_account_id,
    shop_display_name: business.display_name,
    name: product.name,
    price_pence: product.price_pence,
    currency: product.currency,
    image_url: product.image_url,
  };

  return (
    <div
      data-nex-product-page-v2
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "12px 14px 24px",
        color: INK,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* ── Header · shop logo + name (left) · cart + back (right)
          Owner directive 2026-11-16 · per sealed mock the page header
          identifies the seller on the left and keeps the cart popup
          trigger + back control on the right. The back FAB that
          previously floated bottom-right is retired · the header's
          back button replaces it. */}
      <header
        data-nex-product-page-header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          paddingBottom: 2,
        }}
      >
        <a
          data-nex-product-shop-badge
          href={demoMode ? "#" : `/nex-native/${business.slug}`}
          onClick={(e) => {
            if (demoMode) {
              e.preventDefault();
              setDemoNotice("Preview mode · shop link disabled");
            }
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: INK,
            minHeight: 44,
            paddingRight: 8,
            borderRadius: 999,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              overflow: "hidden",
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.08)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              fontSize: 14,
              fontWeight: 900,
              color: INK_DIM,
            }}
          >
            {business.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={business.logo_url}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <span>
                {(business.display_name || "?").trim().charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "-0.005em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 170,
            }}
          >
            {business.display_name}
          </span>
        </a>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <CartHeaderButton variant="inline" />
          <button
            type="button"
            data-nex-product-header-back
            aria-label="Go back to the previous page"
            onClick={handleBack}
            style={{
              width: 30,
              height: 30,
              minWidth: 30,
              borderRadius: 999,
              background: "#111418",
              color: "#fff",
              border: "none",
              boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              fontSize: 15,
              lineHeight: 1,
            }}
          >
            <span aria-hidden>←</span>
          </button>
        </div>
      </header>

      {/* ── Gallery · vertical thumbs (left) + main image (right) ─
          Matches sealed 2026-11-16 mock. On a single-image product the
          thumbs column collapses so the main image can use the full
          width · the image itself is never cropped out of frame. */}
      <div
        data-nex-product-gallery
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        {images.length > 1 ? (
          <div
            data-nex-product-gallery-thumbs
            role="list"
            aria-label="Product images"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              width: 56,
              flexShrink: 0,
            }}
          >
            {images.map((src, i) => {
              const isActive = src === activeImage;
              return (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  role="listitem"
                  data-nex-product-thumb-index={i}
                  aria-label={`Show image ${i + 1} of ${images.length}`}
                  aria-pressed={isActive}
                  onClick={() => setActiveImage(src)}
                  style={{
                    width: 56,
                    height: 56,
                    minWidth: 44,
                    minHeight: 44,
                    borderRadius: 12,
                    background: "#fff",
                    border: isActive
                      ? `2px solid ${ORANGE}`
                      : "1px solid rgba(0,0,0,0.08)",
                    padding: 2,
                    cursor: "pointer",
                    overflow: "hidden",
                    display: "block",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: 10,
                      display: "block",
                    }}
                  />
                </button>
              );
            })}
          </div>
        ) : null}

        <div
          data-nex-product-gallery-main
          role={activeImage ? undefined : "img"}
          aria-label={activeImage ? undefined : `${product.name} · no image`}
          style={{
            flex: 1,
            aspectRatio: "1 / 1",
            borderRadius: 18,
            background: activeImage ? "#fff" : PLACEHOLDER_BG,
            border: "1px solid rgba(0,0,0,0.06)",
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
          }}
        >
          {activeImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeImage}
              alt={product.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: INK_DIM,
              }}
            >
              Image coming soon
            </span>
          )}
        </div>
      </div>

      {/* ── Title · optional star row · price + stock pill ──────
          Star row is gated on a non-null `rating` prop · the live
          /nex-native/product/<id> route still passes nothing so the
          row stays hidden on the real page until a rating backend
          exists. The /nex-native/product/preview route passes a mock
          rating so this matches the sealed 2026-11-16 layout mock. */}
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h1
          data-nex-product-title
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 900,
            lineHeight: 1.2,
            letterSpacing: "-0.015em",
            color: INK,
            wordBreak: "break-word",
          }}
        >
          {product.name}
        </h1>

        {effectiveRating ? (
          <button
            type="button"
            data-nex-product-rating
            data-nex-product-rating-source={demoOn && demoSummary.count > 0 ? "demo" : "prop"}
            aria-label={`Rated ${effectiveRating.score.toFixed(1)} out of 5 from ${formatReviewCount(effectiveRating.count)} reviews · tap to view reviews`}
            onClick={() => setReviewsOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: INK_DIM,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textAlign: "left",
              minHeight: 32,
            }}
          >
            <span aria-hidden style={{ display: "inline-flex", gap: 1 }}>
              {[0, 1, 2, 3, 4].map((i) => {
                const filled = effectiveRating.score - i;
                let fillPct: number;
                if (filled >= 1) fillPct = 100;
                else if (filled <= 0) fillPct = 0;
                else fillPct = Math.round(filled * 100);
                return <StarIcon key={i} fillPct={fillPct} />;
              })}
            </span>
            <span style={{ fontWeight: 800, color: INK }}>
              {effectiveRating.score.toFixed(1)}
            </span>
            <span>({formatReviewCount(effectiveRating.count)} reviews)</span>
          </button>
        ) : null}

        <div
          data-nex-product-price-row
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div
            data-nex-product-price
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: ORANGE,
              lineHeight: 1,
            }}
          >
            {priceLabel}
          </div>
          {outOfStock ? null : (
            <div
              data-nex-product-stock-pill
              aria-label="In stock"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 999,
                background: STOCK_GREEN_BG,
                color: STOCK_GREEN,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.01em",
              }}
            >
              <span aria-hidden>✓</span>
              In Stock
            </div>
          )}
        </div>
      </header>

      {/* ── Description · 4-line clamp + chevron drop-down ────── */}
      {hasDescription ? (
        <section
          data-nex-product-description
          aria-label="Product description"
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <p
              style={{
                margin: 0,
                flex: 1,
                fontSize: 14,
                lineHeight: 1.55,
                color: INK_DIM,
                whiteSpace: "pre-wrap",
                display: descExpanded ? "block" : "-webkit-box",
                WebkitLineClamp: descExpanded ? undefined : DESC_PREVIEW_CLAMP,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {descriptionText}
            </p>
            {hasExpandable ? (
              <button
                type="button"
                data-nex-product-read-toggle
                aria-expanded={descExpanded}
                aria-label={
                  descExpanded
                    ? "Collapse description"
                    : "Expand description and specs"
                }
                onClick={() => setDescExpanded((v) => !v)}
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  padding: 0,
                  marginTop: -2,
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.04)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  color: INK,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "transform 160ms ease",
                  transform: descExpanded ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <ChevronDown />
              </button>
            ) : null}
          </div>

          {/* Expanded block · real specs only · from product.spec +
              dispatch_time / sample_request_time (same fields the
              existing category/upload system persists). Nothing
              hard-coded. */}
          {descExpanded && hasSpecs ? (
            <dl
              ref={specsRef}
              data-nex-product-specs
              style={{
                margin: "12px 0 0",
                scrollMarginTop: 16,
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(0,0,0,0.03)",
                border: "1px solid rgba(0,0,0,0.06)",
                display: "grid",
                gridTemplateColumns: "min-content 1fr",
                columnGap: 14,
                rowGap: 8,
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              {specEntries.map((entry) => (
                <React.Fragment key={entry.label}>
                  <dt
                    style={{
                      fontWeight: 700,
                      color: INK,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.label}
                  </dt>
                  <dd style={{ margin: 0, color: INK_DIM }}>
                    {entry.value}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          ) : null}

        </section>
      ) : null}

      {/* ── Primary CTAs ──────────────────────────────────────── */}
      <section
        data-nex-product-actions
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 4,
        }}
      >
        {viewerIsOwner ? (
          <p
            data-nex-product-owner-notice
            style={{
              margin: 0,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,175,255,0.4)",
              background: "rgba(0,175,255,0.08)",
              color: "#0B3B5C",
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            This is your product. Buyers see &ldquo;Ask Seller&rdquo; and
            &ldquo;Add to Cart&rdquo; here. Edit it in your Shop dashboard.
          </p>
        ) : (
          <>
            {demoMode ? (
              <button
                type="button"
                data-nex-product-ask-seller
                data-nex-product-demo
                aria-label="Ask seller (preview mode)"
                onClick={() =>
                  setDemoNotice("Preview mode · Ask Seller is disabled")
                }
                style={{
                  width: "100%",
                  minHeight: 52,
                  padding: "14px 18px",
                  borderRadius: 999,
                  background: ORANGE,
                  color: "#fff",
                  border: "none",
                  fontSize: 16,
                  fontWeight: 900,
                  letterSpacing: "0.01em",
                  cursor: "pointer",
                  boxShadow: `0 10px 24px ${ORANGE}55`,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span aria-hidden>💬</span>
                Ask Seller
              </button>
            ) : (
              <form action={askSellerAction} style={{ margin: 0 }}>
                <input type="hidden" name="product_id" value={product.id} />
                <button
                  type="submit"
                  data-nex-product-ask-seller
                  aria-label="Ask seller about this product"
                  style={{
                    width: "100%",
                    minHeight: 52,
                    padding: "14px 18px",
                    borderRadius: 999,
                    background: ORANGE,
                    color: "#fff",
                    border: "none",
                    fontSize: 16,
                    fontWeight: 900,
                    letterSpacing: "0.01em",
                    cursor: "pointer",
                    boxShadow: `0 10px 24px ${ORANGE}55`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                  onMouseDown={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      ORANGE_DARK;
                  }}
                  onMouseUp={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      ORANGE;
                  }}
                >
                  <span aria-hidden>💬</span>
                  Ask Seller
                </button>
              </form>
            )}

            {outOfStock ? (
              <p
                data-nex-product-sold-out
                style={{
                  margin: 0,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(200, 16, 46, 0.4)",
                  background: "rgba(200, 16, 46, 0.08)",
                  color: "#7A0000",
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
              >
                Sold out · you can&rsquo;t add this to your cart right
                now. You can still ask the seller above.
              </p>
            ) : demoMode ? (
              <button
                type="button"
                data-nex-product-demo-add
                onClick={() =>
                  setDemoNotice("Preview mode · Add to Cart is disabled")
                }
                style={{
                  width: "100%",
                  minHeight: 52,
                  padding: "14px 18px",
                  borderRadius: 999,
                  background: "#EDEEF1",
                  color: INK,
                  border: `1.5px solid ${ORANGE}`,
                  fontSize: 16,
                  fontWeight: 900,
                  letterSpacing: "0.01em",
                  cursor: "pointer",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span aria-hidden>🛒</span>
                Add to Cart
              </button>
            ) : (
              <AddToCartButton
                item={cartItem}
                label="Add to Cart"
                tone="ghost"
              />
            )}
          </>
        )}

        {demoNotice ? (
          <div
            role="status"
            aria-live="polite"
            data-nex-product-demo-toast
            style={{
              position: "fixed",
              left: "50%",
              transform: "translateX(-50%)",
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 184px)",
              padding: "10px 16px",
              borderRadius: 999,
              background: "rgba(26,31,43,0.94)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
              zIndex: 72,
              whiteSpace: "nowrap",
            }}
          >
            {demoNotice}
          </div>
        ) : null}
      </section>

      {/* Owner-authorised 2026-11-16 · MOCK-ONLY reviews list popup.
          Opens from the tappable rating row. When demo flag is off and
          the `rating` prop is null, `effectiveRating` is null and the
          row never renders · so this popup is unreachable in prod. */}
      <ReviewsListPopup
        open={reviewsOpen}
        product={{
          id: product.id,
          name: product.name,
          thumbnailUrl: product.image_url ?? "",
        }}
        onClose={() => setReviewsOpen(false)}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Icon helpers · pure inline SVG · no external deps
// ──────────────────────────────────────────────────────────────────

function StarIcon({ fillPct }: { readonly fillPct: number }): React.JSX.Element {
  const id = React.useId();
  const clipId = `${id}-clip`;
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      aria-hidden
      style={{ display: "block" }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={(fillPct / 100) * 20} height="20" />
        </clipPath>
      </defs>
      <path
        d="M10 1.5l2.6 5.3 5.9.86-4.27 4.16 1 5.88L10 14.95l-5.23 2.75 1-5.88L1.5 7.66l5.9-.86L10 1.5z"
        fill="#E0E3E7"
      />
      <g clipPath={`url(#${clipId})`}>
        <path
          d="M10 1.5l2.6 5.3 5.9.86-4.27 4.16 1 5.88L10 14.95l-5.23 2.75 1-5.88L1.5 7.66l5.9-.86L10 1.5z"
          fill={STAR_GOLD}
        />
      </g>
    </svg>
  );
}

// Locale-stable thousands formatter · avoids SSR/CSR hydration mismatch
// that `Intl.NumberFormat` / `toLocaleString()` can introduce when the
// server and client pick different default locales.
function formatReviewCount(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function ChevronDown(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      aria-hidden
      style={{ display: "block" }}
    >
      <path
        d="M5 7.5l5 5 5-5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────
// Spec → display helpers
//
// Specs come from the existing category/subcategory/upload system
// (nex_product.spec jsonb · NexProductSpec). We reflect whatever
// keys the seller filled in · nothing hard-coded, nothing invented.
// Empty / null / empty-array values are skipped so the list stays
// clean. A plumbing service shows plumbing fields; a phone cover
// shows its own fields · each shop controls its own schema.
// ──────────────────────────────────────────────────────────────────

interface SpecEntry {
  readonly label: string;
  readonly value: string;
}

const UNIVERSAL_LABELS: Record<string, string> = {
  condition: "Condition",
  origin: "Origin",
  brand: "Brand",
  model: "Model",
  authenticity: "Authenticity",
  materials: "Materials",
  dimensions: "Dimensions",
  weight: "Weight",
  included: "Included",
  warranty: "Warranty",
  certifications: "Certifications",
  age_rating: "Age rating",
  year_produced: "Year produced",
  care_instructions: "Care instructions",
  duration: "Duration",
  service_location: "Service location",
  advance_booking: "Advance booking",
  age_range: "Age range",
  hs_code: "HS code",
  export_markets: "Export markets",
  factory_location: "Factory",
  production_capacity: "Production capacity",
  lead_time: "Lead time",
};

function prettyKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDimensions(
  d: NonNullable<NexProductSpec["dimensions"]>,
): string | null {
  const parts: string[] = [];
  if (typeof d.w === "number") parts.push(String(d.w));
  if (typeof d.h === "number") parts.push(String(d.h));
  if (typeof d.d === "number") parts.push(String(d.d));
  if (parts.length === 0) return null;
  return `${parts.join(" × ")}${d.unit ? ` ${d.unit}` : ""}`;
}

function formatWeight(
  w: NonNullable<NexProductSpec["weight"]>,
): string | null {
  if (typeof w.value !== "number") return null;
  return `${w.value}${w.unit ? ` ${w.unit}` : ""}`;
}

function extractSpecEntries(
  spec: NexProductSpec | null,
  extras: {
    readonly dispatch_time: string | null;
    readonly sample_request_time: string | null;
  },
): SpecEntry[] {
  const out: SpecEntry[] = [];
  if (spec) {
    const src = spec as Record<string, unknown>;
    for (const key of Object.keys(src)) {
      if (key === "additional") continue;
      const value = src[key];
      if (value === null || value === undefined) continue;

      if (key === "dimensions" && typeof value === "object") {
        const text = formatDimensions(
          value as NonNullable<NexProductSpec["dimensions"]>,
        );
        if (text) out.push({ label: UNIVERSAL_LABELS.dimensions, value: text });
        continue;
      }
      if (key === "weight" && typeof value === "object") {
        const text = formatWeight(
          value as NonNullable<NexProductSpec["weight"]>,
        );
        if (text) out.push({ label: UNIVERSAL_LABELS.weight, value: text });
        continue;
      }

      if (Array.isArray(value)) {
        const items = value
          .map((v) => (typeof v === "string" ? v.trim() : String(v)))
          .filter((s) => s.length > 0);
        if (items.length > 0) {
          out.push({
            label: UNIVERSAL_LABELS[key] ?? prettyKey(key),
            value: items.join(", "),
          });
        }
        continue;
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length === 0) continue;
        out.push({
          label: UNIVERSAL_LABELS[key] ?? prettyKey(key),
          value: trimmed,
        });
        continue;
      }

      if (typeof value === "number" && Number.isFinite(value)) {
        out.push({
          label: UNIVERSAL_LABELS[key] ?? prettyKey(key),
          value: String(value),
        });
      }
    }

    // Freeform additional block · seller-controlled schema per shop.
    const additional = src.additional;
    if (additional && typeof additional === "object" && !Array.isArray(additional)) {
      for (const k of Object.keys(additional as Record<string, unknown>)) {
        const v = (additional as Record<string, unknown>)[k];
        if (typeof v !== "string") continue;
        const trimmed = v.trim();
        if (trimmed.length === 0) continue;
        out.push({ label: prettyKey(k), value: trimmed });
      }
    }
  }

  // Dispatch + sample request · same fields the seller edits via the
  // upload flow (nex_product.dispatch_time / sample_request_time).
  if (extras.dispatch_time && extras.dispatch_time.trim().length > 0) {
    out.push({ label: "Dispatch time", value: extras.dispatch_time.trim() });
  }
  if (
    extras.sample_request_time &&
    extras.sample_request_time.trim().length > 0
  ) {
    out.push({
      label: "Sample request",
      value: extras.sample_request_time.trim(),
    });
  }

  return out;
}
