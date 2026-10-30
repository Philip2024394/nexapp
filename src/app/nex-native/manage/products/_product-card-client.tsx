"use client";

// src/app/nex-native/manage/products/_product-card-client.tsx
//
// Owner-authorised 2026-10-30 (Product Upload World-Class brief ·
// seller product library). Enhanced product-row card with:
//
//   · 1 MAIN image + up to 3 smaller thumbnails
//   · Click a thumbnail → swaps it into the main slot (local-only
//     state; no network round-trip)
//   · Name + price + status chip
//   · Stock-status toggle (same semantics as the previous server form)
//   · Edit link → /nex-native/manage/products/[id]/edit
//   · Archive / Restore buttons (confirmation prompt)
//
// The server page passes a plain product-view-model so this component
// stays free of server-only imports.

import * as React from "react";
import Link from "next/link";

export interface ProductCardViewModel {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly price_pence: number;
  readonly currency: string;
  readonly status: "draft" | "live" | "archived";
  readonly stock_status: "in_stock" | "low_stock" | "sold_out" | "made_to_order" | null;
  readonly image_url: string | null;
  readonly gallery_urls: readonly string[] | null;
}

export interface ProductCardClientProps {
  readonly product: ProductCardViewModel;
}

const NEX = {
  panel: "rgba(0,0,0,0.32)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  green: "#16D66B",
  amber: "#F59E0B",
  red: "#FF3355",
};

export function ProductCardClient({ product }: ProductCardClientProps): React.JSX.Element {
  // Build the image list · main first + up to 3 gallery thumbs.
  const images = React.useMemo(() => {
    const list: string[] = [];
    if (product.image_url) list.push(product.image_url);
    if (Array.isArray(product.gallery_urls)) {
      for (const u of product.gallery_urls) {
        if (typeof u === "string" && u.length > 0 && !list.includes(u)) list.push(u);
        if (list.length >= 4) break;
      }
    }
    return list;
  }, [product.image_url, product.gallery_urls]);

  const [activeIndex, setActiveIndex] = React.useState(0);
  const activeImage = images[activeIndex] ?? null;

  const isSoldOut = product.stock_status === "sold_out";
  const nextStockStatus = isSoldOut ? "in_stock" : "sold_out";
  const priceMajor = Math.round(product.price_pence / 100);
  const price = new Intl.NumberFormat("id-ID").format(priceMajor);

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        background: NEX.panel,
        border: `1px solid ${NEX.border}`,
        opacity: product.status === "archived" ? 0.6 : (isSoldOut ? 0.8 : 1),
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
        {/* ─── Image column · 1 main + 3 thumbs ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 10,
              background: activeImage ? `url(${activeImage}) center/cover` : "rgba(139,169,209,0.08)",
              border: `1px solid ${NEX.border}`,
            }}
            aria-label={`${product.name} main image`}
          />
          {images.length > 1 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
              {images.slice(1, 4).map((url, i) => {
                const idx = i + 1;
                const active = idx === activeIndex;
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    aria-label={`Thumbnail ${idx + 1}`}
                    style={{
                      height: 42,
                      padding: 0,
                      borderRadius: 6,
                      background: `url(${url}) center/cover`,
                      border: active ? `1.5px solid ${NEX.cyan}` : `1px solid ${NEX.border}`,
                      cursor: "pointer",
                      boxShadow: active ? `0 0 0 1px rgba(0,175,255,0.3)` : "none",
                    }}
                  />
                );
              })}
            </div>
          ) : null}
          {activeIndex > 0 ? (
            <button
              type="button"
              onClick={() => setActiveIndex(0)}
              style={{
                fontSize: 10,
                padding: "4px 8px",
                background: "transparent",
                color: NEX.cyan,
                border: `1px solid ${NEX.cyanSoft}`,
                borderRadius: 999,
                cursor: "pointer",
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              ↩ Main image
            </button>
          ) : null}
        </div>

        {/* ─── Meta column ─── */}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: NEX.text, letterSpacing: "-0.005em" }}>
              {product.name}
            </div>
            <div style={{ fontSize: 13, color: NEX.orange, fontWeight: 800 }}>
              {product.currency === "IDR" ? "Rp " : `${product.currency} `}{price}
            </div>
            <StatusPill status={product.status} />
            {isSoldOut ? <SoldOutPill /> : null}
            {product.stock_status === "low_stock" ? <LowStockPill /> : null}
            {product.stock_status === "made_to_order" ? <MadeToOrderPill /> : null}
          </div>
          {product.description ? (
            <div
              style={{
                fontSize: 12,
                color: NEX.textDim,
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {product.description}
            </div>
          ) : null}

          {/* ─── Action row ─── */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto" }}>
            <Link
              href={`/nex-native/manage/products/${encodeURIComponent(product.id)}/edit`}
              style={pillLinkStyle(NEX.cyan)}
            >
              Edit
            </Link>

            {product.status !== "archived" ? (
              <>
                <form action="/nex-native/manage/products" method="post" style={{ display: "inline" }}>
                  {/* server form inlined via useFormAction */}
                </form>
                <ToggleStockForm productId={product.id} nextStatus={nextStockStatus} isSoldOut={isSoldOut} />
                <ArchiveForm productId={product.id} productName={product.name} />
              </>
            ) : (
              <RestoreForm productId={product.id} productName={product.name} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleStockForm(props: { productId: string; nextStatus: string; isSoldOut: boolean }): React.JSX.Element {
  return (
    <form action={toggleAction} style={{ display: "inline" }}>
      <input type="hidden" name="product_id" value={props.productId} />
      <input type="hidden" name="next_status" value={props.nextStatus} />
      <button
        type="submit"
        style={pillBtnStyle(props.isSoldOut ? NEX.green : NEX.textDim, props.isSoldOut ? "rgba(22,214,107,0.35)" : NEX.borderStrong, props.isSoldOut ? "rgba(22,214,107,0.10)" : "rgba(0,0,0,0.28)")}
      >
        {props.isSoldOut ? "Mark available" : "Mark sold out"}
      </button>
    </form>
  );
}

function ArchiveForm(props: { productId: string; productName: string }): React.JSX.Element {
  return (
    <form
      action={archiveAction}
      onSubmit={(e) => {
        if (!confirm(`Archive "${props.productName}"? It will stop appearing in the shop until you restore it.`)) {
          e.preventDefault();
        }
      }}
      style={{ display: "inline" }}
    >
      <input type="hidden" name="product_id" value={props.productId} />
      <button
        type="submit"
        style={pillBtnStyle(NEX.red, "rgba(255,51,85,0.35)", "rgba(255,51,85,0.10)")}
      >
        Archive
      </button>
    </form>
  );
}

function RestoreForm(props: { productId: string; productName: string }): React.JSX.Element {
  return (
    <form
      action={restoreAction}
      onSubmit={(e) => {
        if (!confirm(`Restore "${props.productName}" as draft so you can republish?`)) {
          e.preventDefault();
        }
      }}
      style={{ display: "inline" }}
    >
      <input type="hidden" name="product_id" value={props.productId} />
      <button
        type="submit"
        style={pillBtnStyle(NEX.green, "rgba(22,214,107,0.35)", "rgba(22,214,107,0.10)")}
      >
        Restore
      </button>
    </form>
  );
}

/* Server-action module references · imported for form `action`. The
 * client component uses the `use server` indirection so React can wire
 * these up at the form level without a client-side submit handler. */
import { toggleProductStockAction as toggleAction, archiveProductAction as archiveAction, restoreProductAction as restoreAction } from "./_actions";

function StatusPill({ status }: { status: ProductCardViewModel["status"] }): React.JSX.Element | null {
  if (status === "live") return null;
  const palette = status === "archived"
    ? { bg: "rgba(255,114,0,0.14)", fg: NEX.orange, label: "Archived" }
    : { bg: "rgba(139,169,209,0.08)", fg: NEX.textMute, label: "Draft" };
  return <Pill bg={palette.bg} fg={palette.fg} label={palette.label} border={NEX.border} />;
}
function SoldOutPill(): React.JSX.Element {
  return <Pill bg="rgba(255,51,85,0.10)" fg={NEX.red} label="Sold out" border="rgba(255,51,85,0.35)" />;
}
function LowStockPill(): React.JSX.Element {
  return <Pill bg="rgba(245,158,11,0.10)" fg={NEX.amber} label="Low stock" border="rgba(245,158,11,0.35)" />;
}
function MadeToOrderPill(): React.JSX.Element {
  return <Pill bg="rgba(0,175,255,0.10)" fg={NEX.cyan} label="Made to order" border={NEX.cyanSoft} />;
}
function Pill(props: { bg: string; fg: string; label: string; border: string }): React.JSX.Element {
  return (
    <span style={{
      fontSize: 9,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: props.fg,
      fontWeight: 700,
      padding: "3px 8px",
      borderRadius: 999,
      border: `1px solid ${props.border}`,
      background: props.bg,
    }}>
      {props.label}
    </span>
  );
}

function pillBtnStyle(color: string, borderColor: string, bg: string): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: `1px solid ${borderColor}`,
    background: bg,
    color: color,
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

function pillLinkStyle(color: string): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: `1px solid ${color}`,
    background: "rgba(0,175,255,0.08)",
    color: color,
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    textDecoration: "none",
    display: "inline-block",
  };
}
