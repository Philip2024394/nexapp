// src/app/nex-native/product/[productId]/page.tsx
//
// Bridge 1 · canonical product destination for NEX Directory search.
// -------------------------------------------------------------------------
// A visitor arrives here from /nex-native/search after tapping a product
// card. This page renders the real product from the authoritative NEX
// Supabase.
//
// 2026-11-16 · Nov-16 execution block · Stream A · B1 + B2 closure.
//   · B1 · action block under the product (Add to cart + Ask more
//          details) was removed 2026-11-06 and never replaced. Rewired
//          below using the sealed AddToCartButton + a new inquiry
//          composer that calls sendProductInquiryAction.
//   · B2 · business handle `@{slug}.nex` is now a Link to the shop
//          page (`/nex-native/{slug}`) · the previous comment claiming
//          the destination was retired is stale.
//   · Centered cart popup · CartHeaderButton mounted in the page
//          header · clicking it opens the sealed cart popup overlay.
//
// No new chat system. No new product system. No schema change.

import Link from "next/link";
import { notFound } from "next/navigation";
import "../../nex-native.css";
import * as productService from "@/lib/nex-native/product-service";
import * as businessService from "@/lib/nex-native/business-service";
import * as accountService from "@/lib/nex-native/account-service";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { AddToCartButton } from "../../_add-to-cart-button";
import { CartHeaderButton } from "@/components/nex-native/cart-header-button/cart-header-button-client";
import { InquiryComposerButton } from "./_inquiry-composer-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Basic UUID sanity guard so we don't slam the DB with garbage. The
// canonical NEX product id is a Postgres uuid; anything else is 404.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // Draft / archived remain reachable to their owner via manage surfaces.
  if (product.status !== "live") notFound();

  const business = await businessService.getBusinessById(product.business_id);
  if (!business) notFound();

  // Owner display name for the inquiry composer footer line ("Reply
  // arrives in your chat with <owner>") — best-effort lookup, falls
  // back to the business display name if the account lookup trips.
  let ownerDisplayName: string = business.display_name;
  try {
    const ownerAccount = await accountService.getAccountById(
      business.owner_account_id,
    );
    if (ownerAccount) {
      ownerDisplayName =
        ownerAccount.display_name ??
        ownerAccount.nex_handle ??
        business.display_name;
    }
  } catch {
    /* fall back silently · business display name is a safe default */
  }

  // Resolve viewer identity so the product page can honestly handle
  // the "you are the owner" edge (no inquiry composer to oneself) and
  // the "sold out" / unavailable states without lying to the buyer.
  const viewer = await resolveSessionWithDevOverride();
  const viewerIsOwner =
    !!viewer && viewer.account.id === business.owner_account_id;

  const outOfStock = product.stock_status === "sold_out";

  const priceLabel = formatPriceLabel(product.price_pence, product.currency);

  return (
    <div className="nex-native-root" data-nex-product-page>
      <main className="mx-auto max-w-2xl px-4 py-6">
        {/* Page header · drawer trigger on right · cart popup on left.
            The header cart button opens the centered popup · it does
            not navigate away from this page (owner directive 2026-11-16). */}
        <div
          data-nex-product-page-header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <CartHeaderButton variant="inline" />
          <Link
            href="/nex-native/directory/landing"
            data-nex-product-page-back
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--nex-neutral-700, #4B5563)",
              textDecoration: "none",
              letterSpacing: "0.04em",
            }}
          >
            ← Directory
          </Link>
        </div>

        <header className="mb-4 border-b border-[var(--nex-neutral-300)] pb-3">
          {/* B2 · 2026-11-16 · business handle is now a Link to the
              shop page. The shop route `/nex-native/{slug}` exists
              (verified · audit confirmation). */}
          <Link
            href={`/nex-native/${business.slug}`}
            data-nex-product-page-shop-link={business.slug}
            className="text-[10px] font-medium uppercase tracking-wider text-[var(--nex-accent-600)] hover:underline"
          >
            @{business.slug}.nex
          </Link>
          <h1
            className="text-xl font-semibold text-[var(--nex-neutral-900)]"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.25,
              minHeight: "calc(1.25em * 2)",
              wordBreak: "break-word",
            }}
          >
            {product.name}
          </h1>
          <p className="mt-1 text-sm text-[var(--nex-neutral-700)]">
            {priceLabel}
            {product.stock_status && (
              <span
                className={`ml-2 inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                  product.stock_status === "in_stock"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : product.stock_status === "low_stock"
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : product.stock_status === "made_to_order"
                        ? "border-blue-300 bg-blue-50 text-blue-900"
                        : "border-neutral-300 bg-neutral-100 text-neutral-600 line-through"
                }`}
              >
                {product.stock_status === "in_stock"
                  ? "in stock"
                  : product.stock_status === "low_stock"
                    ? "low stock"
                    : product.stock_status === "made_to_order"
                      ? "made to order"
                      : "sold out"}
              </span>
            )}
          </p>
        </header>

        {product.image_url && (
          <div className="mb-4 overflow-hidden rounded-2xl border border-[var(--nex-neutral-200)] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full object-contain"
              data-nex-product-image
            />
          </div>
        )}

        {product.description && (
          <p className="mb-4 whitespace-pre-wrap text-sm text-[var(--nex-neutral-800)]">
            {product.description}
          </p>
        )}

        {product.gallery_urls && product.gallery_urls.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {product.gallery_urls.map((u, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={`${u}-${i}`}
                src={u}
                alt={`${product.name} · image ${i + 2}`}
                className="h-20 w-20 rounded border border-[var(--nex-neutral-200)] object-contain bg-white"
              />
            ))}
          </div>
        )}

        {product.tags && product.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {product.tags.map((t) => (
              <Link
                key={t}
                href="/nex-native/directory/landing"
                className="inline-block rounded border border-[var(--nex-neutral-300)] bg-white px-2 py-0.5 text-xs text-[var(--nex-neutral-700)] hover:border-[var(--nex-accent-500)]"
              >
                {t}
              </Link>
            ))}
          </div>
        )}

        <section className="mb-4 rounded-xl border border-[var(--nex-neutral-200)] bg-white/70 p-3 text-xs text-[var(--nex-neutral-700)]">
          Sold by{" "}
          <Link
            href={`/nex-native/${business.slug}`}
            className="font-medium text-[var(--nex-neutral-900)] hover:underline"
            data-nex-product-page-seller-link={business.slug}
          >
            {business.display_name}
          </Link>
          {business.address && <> · {business.address.split("\n")[0]}</>}
        </section>

        {/* B1 · 2026-11-16 · action block under product. Two CTAs:
              · Add to cart  → uses the sealed AddToCartButton primitive
                (writes to NEX_CART_STORAGE_KEY · fires nex-cart-changed).
              · Ask more details about this product → opens the inquiry
                composer modal · on Send routes through the sealed
                sendProductInquiryAction so both participants see ONE
                linked inquiry in peer chat after reload. */}
        <section
          data-nex-product-page-actions
          className="mb-6"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {viewerIsOwner ? (
            <p
              data-nex-product-page-owner-notice
              style={{
                margin: 0,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0, 175, 255, 0.4)",
                background: "rgba(0, 175, 255, 0.08)",
                color: "#0B3B5C",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              This is your product. Buyers see Add to cart and Ask more
              details here. Edit it in your Shop dashboard.
            </p>
          ) : outOfStock ? (
            <>
              <p
                data-nex-product-page-sold-out
                style={{
                  margin: 0,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(200, 16, 46, 0.4)",
                  background: "rgba(200, 16, 46, 0.08)",
                  color: "#7A0000",
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
              >
                Sold out · you can&rsquo;t add this to your cart right
                now. You can still ask the shop below.
              </p>
              <InquiryComposerButton
                productId={product.id}
                productName={product.name}
                productImageUrl={product.image_url ?? null}
                priceLabel={priceLabel}
                ownerAccountId={business.owner_account_id}
                ownerDisplayName={ownerDisplayName}
              />
            </>
          ) : (
            <>
              <AddToCartButton
                item={{
                  kind: "product",
                  id: product.id,
                  shop_id: business.id,
                  shop_slug: business.slug ?? "",
                  shop_owner_account_id: business.owner_account_id,
                  shop_display_name: business.display_name,
                  name: product.name,
                  price_pence: product.price_pence,
                  currency: product.currency,
                  image_url: product.image_url ?? null,
                }}
                label="Add to cart"
                tone="primary"
              />
              <InquiryComposerButton
                productId={product.id}
                productName={product.name}
                productImageUrl={product.image_url ?? null}
                priceLabel={priceLabel}
                ownerAccountId={business.owner_account_id}
                ownerDisplayName={ownerDisplayName}
              />
            </>
          )}
        </section>

        <footer className="mx-auto max-w-2xl px-4 pb-8 pt-6 text-center text-[10px] text-[var(--nex-neutral-500)]">
          Powered by NEX
        </footer>
      </main>
    </div>
  );
}
