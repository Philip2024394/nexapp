// src/app/nex-native/manage/products/page.tsx
//
// Bridge 66 · Seller product list · per-card sold-out/available toggle.
// ---------------------------------------------------------------------
// Server Component. Reads every product the caller owns for their
// first business and renders a compact list matching the visual
// language of /nex-native/manage/menu (dark navy panel · cyan
// eyebrow · orange accents · pill toggle button).
//
// Doctrine kept:
//   · Availability toggle is not delete · sold-out just paints a
//     red pill and dims the row on the public shop.
//   · Manage layout (Bridge 55) already gates the whole /manage/*
//     subtree behind the Phase 1 commerce flag · no per-page gate.
//   · Redirects to /nex-native/onboarding?commerce=1 when the caller
//     has not yet created a business (mirrors the menu page).

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
// Owner directive 2026-11-06 readiness fill · the manage/products
// page previously used the production-only session resolver which
// bounced dev-impersonated owners to /sign-in. Swap to the dev-aware
// resolver (same contract) so owners testing with
// NEX_DEV_IMPERSONATE_HANDLE can reach their product list. Real
// sessions are unaffected.
import { resolveSessionWithDevOverride as resolveNexAppSessionFromContext } from "@/lib/nex-native/app/dev-impersonation";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import { ProductCardClient, type ProductCardViewModel } from "./_product-card-client";

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
  orange: "#FF7200",
  orangeSoft: "rgba(255,114,0,0.6)",
  green: "#16D66B",
  amber: "#F59E0B",
  red: "#FF3355",
};

export default async function ManageProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; m?: string; business?: string; filter?: string }>;
}) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;

  const businesses = await businessService.listBusinessesByOwner(
    session.account.id,
  );
  if (businesses.length === 0) {
    redirect("/nex-native/onboarding?commerce=1");
  }

  // Multi-business support · pick explicit ?business= or first owned.
  const businessId = (sp.business && businesses.some((b) => b.id === sp.business)) ? sp.business : businesses[0]!.id;
  const business = businesses.find((b) => b.id === businessId)!;

  // Status filter · "all" (default · live+draft+archived) · "live" ·
  // "draft" · "archived". Clamp to known values.
  const rawFilter = (sp.filter ?? "all").toLowerCase();
  const filter: "all" | "live" | "draft" | "archived" =
    rawFilter === "live" || rawFilter === "draft" || rawFilter === "archived" ? rawFilter : "all";

  // listProductsByBusiness returns all statuses when `status` is
  // omitted · we filter client-side after loading so the counts can be
  // computed for the filter pills.
  const allProducts = await productService.listProductsByBusiness(business.id);
  const products = filter === "all" ? allProducts : allProducts.filter((p) => p.status === filter);
  const counts = {
    all: allProducts.length,
    live: allProducts.filter((p) => p.status === "live").length,
    draft: allProducts.filter((p) => p.status === "draft").length,
    archived: allProducts.filter((p) => p.status === "archived").length,
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: 60,
      }}
    >
      {/* --- Top bar ---------------------------------------------------- */}
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
          href="/nex-native/manage"
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
          ← Manage
        </Link>
        <Link
          href={`/nex-native/${business.slug}`}
          style={{
            fontSize: 11,
            color: NEX.cyan,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          View shop ↗
        </Link>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: NEX.orange,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          Products
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            marginBottom: 6,
          }}
        >
          {business.display_name}
        </h1>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 13,
            color: NEX.textDim,
            lineHeight: 1.55,
          }}
        >
          Your library. Each card shows the main image plus up to three gallery
          thumbnails · click a thumbnail to preview it in the main slot. Use the
          toggle to flip a product between <b>available</b> and <b>sold out</b>{" "}
          (keeps it listed), <b>Edit</b> to reopen the upload form with every
          field pre-filled, or <b>Archive</b> to soft-hide (restorable).
        </p>

        {businesses.length > 1 ? (
          <BusinessPicker businesses={businesses} activeId={business.id} filter={filter} />
        ) : null}

        <FilterPills counts={counts} active={filter} businessId={business.id} />

        {banner && <Banner code={banner.code} message={banner.message} />}

        {products.length === 0 ? (
          <EmptyState businessSlug={business.slug} filter={filter} />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {products.map((product) => (
              <ProductCardClient key={product.id} product={toCardVM(product)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Server-side view-model mapper                                         *
 * --------------------------------------------------------------------- */

import type { NexProductRow } from "@/lib/nex-native/types";

function toCardVM(p: NexProductRow): ProductCardViewModel {
  const status: ProductCardViewModel["status"] =
    p.status === "live" || p.status === "draft" || p.status === "archived"
      ? p.status
      : "draft";
  const stock: ProductCardViewModel["stock_status"] =
    p.stock_status === "in_stock" || p.stock_status === "low_stock"
    || p.stock_status === "sold_out" || p.stock_status === "made_to_order"
      ? p.stock_status
      : null;
  const gallery: readonly string[] | null = Array.isArray(p.gallery_urls)
    ? p.gallery_urls.filter((u): u is string => typeof u === "string" && u.length > 0)
    : null;
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    price_pence: p.price_pence,
    currency: p.currency,
    status,
    stock_status: stock,
    image_url: p.image_url ?? null,
    gallery_urls: gallery,
  };
}

/* --------------------------------------------------------------------- *
 * Business picker (shown only when seller owns >1 business)             *
 * --------------------------------------------------------------------- */

function BusinessPicker(props: {
  businesses: ReadonlyArray<{ id: string; display_name: string; slug: string }>;
  activeId: string;
  filter: "all" | "live" | "draft" | "archived";
}): React.JSX.Element {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14,
      padding: 8, borderRadius: 10, background: "rgba(0,0,0,0.28)",
      border: `1px solid ${NEX.border}`,
    }}>
      {props.businesses.map((b) => {
        const active = b.id === props.activeId;
        const href = `/nex-native/manage/products?business=${encodeURIComponent(b.id)}&filter=${props.filter}`;
        return (
          <Link
            key={b.id}
            href={href}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: active ? "rgba(0,175,255,0.14)" : "transparent",
              color: active ? NEX.cyan : NEX.textDim,
              border: `1px solid ${active ? NEX.cyanSoft : NEX.border}`,
              fontSize: 11,
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: "0.04em",
            }}
          >
            {b.display_name}
          </Link>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Filter pills · All / Live / Draft / Archived                          *
 * --------------------------------------------------------------------- */

function FilterPills(props: {
  counts: { all: number; live: number; draft: number; archived: number };
  active: "all" | "live" | "draft" | "archived";
  businessId: string;
}): React.JSX.Element {
  const items: { k: "all" | "live" | "draft" | "archived"; label: string }[] = [
    { k: "all", label: "All" },
    { k: "live", label: "Live" },
    { k: "draft", label: "Draft" },
    { k: "archived", label: "Archived" },
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
      {items.map((it) => {
        const active = it.k === props.active;
        const count = props.counts[it.k];
        const href = `/nex-native/manage/products?business=${encodeURIComponent(props.businessId)}&filter=${it.k}`;
        return (
          <Link
            key={it.k}
            href={href}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: active ? "rgba(0,175,255,0.14)" : "rgba(0,0,0,0.28)",
              color: active ? NEX.cyan : NEX.textDim,
              border: `1px solid ${active ? NEX.cyanSoft : NEX.borderStrong}`,
              fontSize: 11,
              fontWeight: 800,
              textDecoration: "none",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {it.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{count}</span>
          </Link>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Empty state                                                           *
 * --------------------------------------------------------------------- */

function EmptyState({ businessSlug, filter }: { businessSlug: string; filter: "all" | "live" | "draft" | "archived" }) {
  const label = filter === "all" ? "No products yet." : `No ${filter} products.`;
  return (
    <div
      style={{
        padding: "28px 20px",
        textAlign: "center",
        color: NEX.textMute,
        fontSize: 13,
        lineHeight: 1.55,
        border: `1px dashed ${NEX.borderStrong}`,
        borderRadius: 14,
        marginBottom: 20,
      }}
    >
      {label}
      <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Link
          href="/nex-native/create/product"
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 12,
            background: NEX.cyan,
            color: "#031018",
            fontSize: 12,
            fontWeight: 800,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            boxShadow: "0 8px 22px rgba(0,175,255,0.35)",
          }}
        >
          + Create a product
        </Link>
        <Link
          href={`/nex-native/${businessSlug}`}
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 12,
            background: "transparent",
            color: NEX.textDim,
            border: `1px solid ${NEX.borderStrong}`,
            fontSize: 12,
            fontWeight: 700,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          View shop
        </Link>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Banner                                                                *
 * --------------------------------------------------------------------- */

function Banner({ code, message }: { code: string; message: string }) {
  const isError = code.endsWith("_failed") || code.endsWith("_forbidden") ||
    code === "not_owner" || code === "product_not_found" ||
    code === "invalid_stock_status" || code === "missing_product_id";
  return (
    <div
      role="status"
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: isError
          ? "rgba(255,51,85,0.10)"
          : "rgba(22,214,107,0.10)",
        border: `1px solid ${
          isError ? "rgba(255,51,85,0.4)" : "rgba(22,214,107,0.4)"
        }`,
        color: isError ? "#FFB4C0" : "#B8F1CC",
        fontSize: 13,
        marginBottom: 18,
      }}
    >
      {message}
    </div>
  );
}

