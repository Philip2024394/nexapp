"use client";

// src/app/nex-native/chat-themes-library/marketplace-prototype/my-shop/[brandId]/_my-shop-client.tsx
//
// Owner directive 2026-10-22 · My Shop client · product management.
// Reads + writes the same localStorage key the editor uses so edits
// propagate across menu drawer, menu-item sheet, and NEX search.

import * as React from "react";
import Link from "next/link";
import { CRISPY_CHICKEN_MOCK } from "@/app/nex-native/cover/mock-data";
import { MARKETPLACE_CATALOG } from "../../_catalog";

const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.3)",
  orange: "#FF7200",
  orangeInk: "#1A0808",
  green: "#16D66B",
  red: "#DC2626",
  dangerDark: "#8B0000",
  danger: "rgba(220, 38, 38, 0.14)",
};

const MAX_IMAGES_PER_ITEM = 4;

type StockStatus = "in_stock" | "low_stock" | "sold_out";

interface EditableProduct {
  id: string;
  sectionId: string;
  name: string;
  price: string;
  description: string;
  stockStatus: StockStatus;
  images: string[];
}

interface EditableSection {
  id: string;
  name: string;
}

interface EditableContent {
  businessName: string;
  sections: EditableSection[];
  products: EditableProduct[];
  // Other fields exist in the full editor but are not touched here.
  [key: string]: unknown;
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatIdr(amountCents: number): string {
  const rupiah = Math.round(amountCents / 100);
  return `Rp ${rupiah.toLocaleString("id-ID")}`;
}

// Canvas-downscale (same as the editor) · max 600px wide, JPEG 0.78
async function readFileAsDataUrl(
  file: File,
): Promise<{ dataUrl: string; warning: string | null }> {
  if (file.size > 10_000_000) {
    throw new Error("Image too large · please upload under 10MB.");
  }
  const originalDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Could not read file · try a different image."));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Image decode failed · try a different file."));
    image.src = originalDataUrl;
  });
  const MAX_SIDE = 600;
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      dataUrl: originalDataUrl,
      warning: file.size > 300_000
        ? "Image large · browser downscale unavailable."
        : null,
    };
  }
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
  const base64 = dataUrl.split(",")[1] ?? "";
  const bytes = Math.round(base64.length * 0.75);
  const warning =
    bytes > 250_000
      ? "Image is large even after downscale · storage may fill up."
      : null;
  return { dataUrl, warning };
}

// Build the baseline localStorage shape from the sealed brand mock.
function baselineFromBrand(brandId: string): EditableContent | null {
  if (brandId !== "crispy-chicken") return null;
  return {
    businessName: CRISPY_CHICKEN_MOCK.businessName,
    sections: CRISPY_CHICKEN_MOCK.sections.map((s) => ({
      id: s.id,
      name: s.name,
    })),
    products: CRISPY_CHICKEN_MOCK.products.map((p) => ({
      id: p.id,
      sectionId: p.section_id,
      name: p.name,
      price: String(Math.round(p.price_pence / 100)),
      description: p.description ?? "",
      stockStatus: (p.stock_status === "low_stock" ||
        p.stock_status === "sold_out"
        ? p.stock_status
        : "in_stock") as StockStatus,
      images: [],
    })),
  };
}

export function MyShopClient({
  brandId,
}: {
  readonly brandId: string;
}): React.JSX.Element {
  const entry = MARKETPLACE_CATALOG.find((e) => e.themeId === brandId);
  const accent = entry?.ownerAccentHex ?? entry?.accentHex ?? NEX.cyan;
  const storageKey = `nex-mp-editor-${brandId}`;

  const [content, setContent] = React.useState<EditableContent | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [mode, setMode] = React.useState<"view" | "add">("view");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [filterSectionId, setFilterSectionId] =
    React.useState<string | null>(null);

  // Hydrate on mount.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as EditableContent;
        if (parsed && parsed.sections && parsed.products) {
          setContent(parsed);
          setLoaded(true);
          return;
        }
      }
    } catch {
      // fall through to baseline
    }
    const base = baselineFromBrand(brandId);
    setContent(base);
    setLoaded(true);
  }, [brandId, storageKey]);

  // Persist on every change.
  const persist = React.useCallback(
    (next: EditableContent, successMessage: string) => {
      setContent(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
        setToast(successMessage);
      } catch (err) {
        setToast(
          err instanceof Error && err.message.toLowerCase().includes("quota")
            ? "Storage full · remove some photos."
            : "Could not save · try again",
        );
      }
    },
    [storageKey],
  );

  // Toast dismiss.
  React.useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!loaded || !content) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: NEX.textMute,
          fontSize: 13,
        }}
      >
        {entry ? "Loading My Shop…" : "Brand not found."}
      </div>
    );
  }

  const editingProduct = editingId
    ? content.products.find((p) => p.id === editingId) ?? null
    : null;
  const visibleProducts = filterSectionId
    ? content.products.filter((p) => p.sectionId === filterSectionId)
    : content.products;

  return (
    <>
      {/* ─── Header ─── */}
      <header
        style={{
          padding:
            "calc(env(safe-area-inset-top, 0px) + 14px) 14px 10px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
          borderBottom: `1px solid ${NEX.cyanSoft}`,
          background:
            "linear-gradient(180deg, rgba(0, 175, 255, 0.1), transparent)",
        }}
      >
        <Link
          href="/nex-native/chat-themes-library"
          aria-label="Back to marketplace"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "transparent",
            color: NEX.text,
            border: `1px solid ${NEX.cyanSoft}`,
            fontSize: 20,
            lineHeight: 1,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          ←
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: accent,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            My Shop · {content.businessName}
          </div>
          <h1
            style={{
              margin: "3px 0 0",
              fontSize: 20,
              fontWeight: 900,
              color: NEX.text,
              letterSpacing: "-0.015em",
              lineHeight: 1.05,
            }}
          >
            {content.products.length} product
            {content.products.length === 1 ? "" : "s"}
          </h1>
        </div>
        <Link
          href={`/nex-native/chat-themes-library/marketplace-prototype/editor/${brandId}`}
          aria-label="Full editor"
          title="Open full editor (identity · store info · story)"
          style={{
            padding: "0 12px",
            minHeight: 36,
            borderRadius: 10,
            background: "transparent",
            color: NEX.textDim,
            border: `1px solid ${NEX.cyanSoft}`,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          Full editor
        </Link>
      </header>

      {/* ─── Mode toggle · pill tabs ─── */}
      <div
        data-nex-mp-my-shop-mode-tabs
        style={{
          display: "flex",
          gap: 6,
          padding: "10px 14px 0",
          flexShrink: 0,
        }}
      >
        <ModeTab
          label="View products"
          active={mode === "view"}
          accent={accent}
          onClick={() => {
            setMode("view");
            setEditingId(null);
          }}
        />
        <ModeTab
          label="Add item"
          active={mode === "add"}
          accent={accent}
          onClick={() => {
            setMode("add");
            setEditingId(null);
          }}
        />
      </div>

      {/* ─── Honest banner ─── */}
      <div
        style={{
          padding: "8px 14px 0",
          fontSize: 10,
          color: NEX.textMute,
          lineHeight: 1.5,
        }}
      >
        Prototype preview · changes save to this browser only · nothing
        is published to the real NEX Directory.
      </div>

      {/* ─── Body ─── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "12px 14px 40px",
        }}
      >
        {editingProduct ? (
          <ProductForm
            mode="edit"
            accent={accent}
            product={editingProduct}
            sections={content.sections}
            onCancel={() => setEditingId(null)}
            onSave={(patch) => {
              const next: EditableContent = {
                ...content,
                products: content.products.map((p) =>
                  p.id === editingProduct.id ? { ...p, ...patch } : p,
                ),
              };
              persist(next, "Product updated");
              setEditingId(null);
            }}
            onWarn={(msg) => setToast(msg)}
          />
        ) : mode === "add" ? (
          <ProductForm
            mode="add"
            accent={accent}
            sections={content.sections}
            onCancel={() => setMode("view")}
            onSave={(patch) => {
              const next: EditableContent = {
                ...content,
                products: [
                  ...content.products,
                  {
                    id: `prod-${Date.now()}`,
                    sectionId: patch.sectionId ?? content.sections[0].id,
                    name: patch.name ?? "New item",
                    price: patch.price ?? "0",
                    description: patch.description ?? "",
                    stockStatus: patch.stockStatus ?? "in_stock",
                    images: patch.images ?? [],
                  },
                ],
              };
              persist(next, "Product added");
              setMode("view");
            }}
            onWarn={(msg) => setToast(msg)}
          />
        ) : (
          <>
            {/* Section filter · All + each category */}
            {content.sections.length > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  overflowX: "auto",
                  paddingBottom: 10,
                }}
              >
                <FilterChip
                  label={`All · ${content.products.length}`}
                  active={filterSectionId === null}
                  accent={accent}
                  onClick={() => setFilterSectionId(null)}
                />
                {content.sections.map((s) => {
                  const count = content.products.filter(
                    (p) => p.sectionId === s.id,
                  ).length;
                  return (
                    <FilterChip
                      key={s.id}
                      label={`${s.name} · ${count}`}
                      active={filterSectionId === s.id}
                      accent={accent}
                      onClick={() => setFilterSectionId(s.id)}
                    />
                  );
                })}
              </div>
            )}

            {visibleProducts.length === 0 ? (
              <div
                style={{
                  padding: "48px 16px",
                  textAlign: "center",
                  color: NEX.textMute,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 10 }}>🍴</div>
                No products in this category.
                <br />
                Switch to <strong style={{ color: NEX.text }}>Add item</strong>{" "}
                to create one.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {visibleProducts.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    accent={accent}
                    section={content.sections.find(
                      (s) => s.id === product.sectionId,
                    )}
                    onEdit={() => setEditingId(product.id)}
                    onToggleOff={() => {
                      const next: EditableContent = {
                        ...content,
                        products: content.products.map((p) =>
                          p.id === product.id
                            ? {
                                ...p,
                                stockStatus:
                                  p.stockStatus === "sold_out"
                                    ? "in_stock"
                                    : "sold_out",
                              }
                            : p,
                        ),
                      };
                      persist(
                        next,
                        product.stockStatus === "sold_out"
                          ? "Product turned back on"
                          : "Product turned off",
                      );
                    }}
                    onDelete={() => {
                      if (
                        !window.confirm(
                          `Delete "${product.name}" from the menu? This cannot be undone.`,
                        )
                      ) {
                        return;
                      }
                      const next: EditableContent = {
                        ...content,
                        products: content.products.filter(
                          (p) => p.id !== product.id,
                        ),
                      };
                      persist(next, "Product deleted");
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            padding: "10px 16px",
            borderRadius: 999,
            background: "rgba(2, 9, 20, 0.9)",
            color: NEX.text,
            fontSize: 12,
            fontWeight: 700,
            border: `1px solid ${NEX.cyanSoft}`,
            boxShadow: "0 12px 28px -8px rgba(0,0,0,0.65)",
            zIndex: 1000,
            maxWidth: "calc(100% - 28px)",
            textAlign: "center",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}

// ─── Mode tab ─────────────────────────────────────────────────────

function ModeTab({
  label,
  active,
  accent,
  onClick,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly accent: string;
  readonly onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-nex-mp-my-shop-mode-tab={label.toLowerCase().replaceAll(" ", "-")}
      style={{
        flex: 1,
        minHeight: 40,
        padding: "0 14px",
        borderRadius: 10,
        background: active ? accent : "transparent",
        color: active ? "#FFFFFF" : NEX.textDim,
        border: active
          ? `1px solid rgba(255, 255, 255, 0.18)`
          : `1px solid ${NEX.cyanSoft}`,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.3,
        cursor: "pointer",
        fontFamily: "inherit",
        WebkitTapHighlightColor: "transparent",
        textShadow: active ? "0 1px 3px rgba(0, 0, 0, 0.55)" : "none",
        boxShadow: active
          ? `0 4px 12px -4px ${hexWithAlpha(accent, 0.7)}`
          : "none",
        transition: "background 150ms ease, color 150ms ease",
      }}
    >
      {label}
    </button>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  accent,
  onClick,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly accent: string;
  readonly onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flexShrink: 0,
        padding: "6px 12px",
        borderRadius: 999,
        background: active ? accent : "rgba(255,255,255,0.05)",
        color: active ? "#FFFFFF" : NEX.textDim,
        border: active
          ? "1px solid rgba(255,255,255,0.18)"
          : "1px solid rgba(255,255,255,0.08)",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.2,
        cursor: "pointer",
        fontFamily: "inherit",
        WebkitTapHighlightColor: "transparent",
        boxShadow: active
          ? `0 4px 10px -4px ${hexWithAlpha(accent, 0.6)}`
          : "none",
      }}
    >
      {label}
    </button>
  );
}

// ─── Product row ──────────────────────────────────────────────────

function ProductRow({
  product,
  section,
  accent,
  onEdit,
  onToggleOff,
  onDelete,
}: {
  readonly product: EditableProduct;
  readonly section?: EditableSection;
  readonly accent: string;
  readonly onEdit: () => void;
  readonly onToggleOff: () => void;
  readonly onDelete: () => void;
}): React.JSX.Element {
  const soldOut = product.stockStatus === "sold_out";
  const lowStock = product.stockStatus === "low_stock";
  const hero = product.images[0] ?? null;
  const initials = product.name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  return (
    <div
      data-nex-mp-my-shop-product={product.id}
      data-nex-mp-my-shop-product-off={soldOut ? "true" : "false"}
      style={{
        display: "grid",
        gridTemplateColumns: "72px 1fr auto",
        gap: 10,
        padding: 10,
        borderRadius: 12,
        background: "rgba(5, 15, 28, 0.72)",
        border: `1px solid ${
          soldOut ? "rgba(255, 255, 255, 0.08)" : hexWithAlpha(accent, 0.3)
        }`,
        opacity: soldOut ? 0.65 : 1,
        alignItems: "center",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 72,
          aspectRatio: "1 / 1",
          borderRadius: 10,
          overflow: "hidden",
          background: hero
            ? `url("${hero}") center / cover no-repeat`
            : `linear-gradient(135deg, ${hexWithAlpha(accent, 0.42)}, ${hexWithAlpha(accent, 0.14)}), ${NEX.bg}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: hexWithAlpha(accent, 0.9),
          fontSize: 20,
          fontWeight: 900,
          letterSpacing: "-0.02em",
          fontFamily: "'Georgia', 'Times New Roman', serif",
          textShadow: "0 2px 6px rgba(0, 0, 0, 0.5)",
          position: "relative",
        }}
      >
        {!hero && initials}
        {product.images.length > 1 && (
          <span
            style={{
              position: "absolute",
              bottom: 3,
              right: 3,
              padding: "1px 5px",
              borderRadius: 999,
              background: "rgba(0, 0, 0, 0.7)",
              color: "#FFFFFF",
              fontSize: 9,
              fontWeight: 800,
              lineHeight: 1.4,
            }}
          >
            {product.images.length}
          </span>
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: NEX.text,
            letterSpacing: "-0.005em",
            lineHeight: 1.25,
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
            marginTop: 2,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            color: NEX.textMute,
            flexWrap: "wrap",
          }}
        >
          {section && (
            <span
              style={{
                padding: "1px 7px",
                borderRadius: 999,
                background: hexWithAlpha(accent, 0.14),
                color: accent,
                fontWeight: 800,
                letterSpacing: 0.4,
                textTransform: "uppercase",
              }}
            >
              {section.name}
            </span>
          )}
          <span
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: accent,
              letterSpacing: "-0.005em",
            }}
          >
            {formatIdr(Number(product.price || "0") * 100)}
          </span>
          {lowStock && (
            <span style={{ color: "#FFC14D", fontWeight: 700 }}>
              · Low stock
            </span>
          )}
          {soldOut && (
            <span style={{ color: "#FF8080", fontWeight: 700 }}>
              · Turned off
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          alignItems: "stretch",
        }}
      >
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${product.name}`}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            background: accent,
            color: "#FFFFFF",
            border: "none",
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onToggleOff}
          aria-label={soldOut ? `Turn on ${product.name}` : `Turn off ${product.name}`}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.06)",
            color: NEX.textDim,
            border: `1px solid rgba(255,255,255,0.14)`,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {soldOut ? "Turn on" : "Turn off"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${product.name}`}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            background: NEX.danger,
            color: NEX.red,
            border: "1px solid rgba(220, 38, 38, 0.3)",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Product form (add + edit) ────────────────────────────────────

function ProductForm({
  mode,
  accent,
  product,
  sections,
  onCancel,
  onSave,
  onWarn,
}: {
  readonly mode: "add" | "edit";
  readonly accent: string;
  readonly product?: EditableProduct;
  readonly sections: EditableSection[];
  readonly onCancel: () => void;
  readonly onSave: (patch: Partial<EditableProduct>) => void;
  readonly onWarn: (msg: string) => void;
}): React.JSX.Element {
  const [name, setName] = React.useState(product?.name ?? "");
  const [sectionId, setSectionId] = React.useState(
    product?.sectionId ?? sections[0]?.id ?? "",
  );
  const [price, setPrice] = React.useState(product?.price ?? "");
  const [description, setDescription] = React.useState(
    product?.description ?? "",
  );
  const [stockStatus, setStockStatus] = React.useState<StockStatus>(
    product?.stockStatus ?? "in_stock",
  );
  const [images, setImages] = React.useState<string[]>(
    product?.images ?? [],
  );

  const canSave = name.trim().length > 0 && price.trim().length > 0;

  return (
    <div
      data-nex-mp-my-shop-form={mode}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: accent,
          fontWeight: 800,
        }}
      >
        {mode === "add" ? "New product" : `Editing · ${product?.name}`}
      </div>

      <Field label="Item name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Classic Crispy Burger"
          style={inputStyle}
        />
      </Field>

      <Field label="Category">
        <select
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          style={inputStyle}
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Price (IDR · no commas)">
        <input
          type="text"
          inputMode="numeric"
          value={price}
          onChange={(e) =>
            setPrice(e.target.value.replace(/\D/g, "").slice(0, 10))
          }
          placeholder="45000"
          style={inputStyle}
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Buttermilk-fried chicken · lettuce · mayo · toasted brioche."
          rows={3}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
        />
      </Field>

      <Field label={`Photos · up to ${MAX_IMAGES_PER_ITEM} (first is the hero)`}>
        <PhotoRow
          images={images}
          accent={accent}
          onChange={setImages}
          onWarn={onWarn}
        />
      </Field>

      <Field label="Availability">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["in_stock", "low_stock", "sold_out"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStockStatus(s)}
              aria-pressed={stockStatus === s}
              style={{
                padding: "7px 12px",
                borderRadius: 999,
                background:
                  stockStatus === s ? accent : "rgba(255,255,255,0.05)",
                color: stockStatus === s ? "#FFFFFF" : NEX.textDim,
                border:
                  stockStatus === s
                    ? "1px solid rgba(255,255,255,0.18)"
                    : "1px solid rgba(255,255,255,0.08)",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.3,
                cursor: "pointer",
                fontFamily: "inherit",
                WebkitTapHighlightColor: "transparent",
                textTransform: "none",
              }}
            >
              {s === "in_stock"
                ? "In stock"
                : s === "low_stock"
                ? "Low stock"
                : "Sold out"}
            </button>
          ))}
        </div>
      </Field>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 4,
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "0 16px",
            minHeight: 44,
            borderRadius: 10,
            background: "transparent",
            color: NEX.textDim,
            border: `1px solid ${NEX.cyanSoft}`,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() =>
            canSave &&
            onSave({ name, sectionId, price, description, stockStatus, images })
          }
          disabled={!canSave}
          style={{
            flex: 1,
            padding: "0 14px",
            minHeight: 44,
            borderRadius: 10,
            background: canSave ? accent : "rgba(255,255,255,0.08)",
            color: canSave ? "#FFFFFF" : NEX.textMute,
            border: "none",
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: 0.3,
            cursor: canSave ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            WebkitTapHighlightColor: "transparent",
            textShadow: canSave ? "0 1px 3px rgba(0, 0, 0, 0.55)" : "none",
            boxShadow: canSave
              ? `0 6px 16px -6px ${hexWithAlpha(accent, 0.75)}`
              : "none",
          }}
        >
          {mode === "add" ? "Add product" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Photo row (max 4 · reorder arrows · remove) ──────────────────

function PhotoRow({
  images,
  accent,
  onChange,
  onWarn,
}: {
  readonly images: string[];
  readonly accent: string;
  readonly onChange: (next: string[]) => void;
  readonly onWarn: (msg: string) => void;
}): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const { dataUrl, warning } = await readFileAsDataUrl(file);
      const next = [...images, dataUrl].slice(0, MAX_IMAGES_PER_ITEM);
      onChange(next);
      if (warning) onWarn(warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
  };

  const canAddMore = images.length < MAX_IMAGES_PER_ITEM;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        {images.map((src, i) => (
          <div
            key={`${i}-${src.slice(-16)}`}
            style={{
              position: "relative",
              width: 72,
              aspectRatio: "1 / 1",
              borderRadius: 10,
              background: `url("${src}") center / cover no-repeat`,
              border:
                i === 0
                  ? `2px solid ${accent}`
                  : `1px solid ${hexWithAlpha(accent, 0.3)}`,
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {i === 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: 3,
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: accent,
                  color: "#FFFFFF",
                  fontSize: 8,
                  fontWeight: 900,
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                  lineHeight: 1.4,
                }}
              >
                Hero
              </span>
            )}
            <div
              style={{
                position: "absolute",
                bottom: 2,
                left: 2,
                right: 2,
                display: "flex",
                gap: 2,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (i === 0) return;
                  const next = [...images];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  onChange(next);
                }}
                disabled={i === 0}
                aria-label="Move left"
                style={{
                  width: 18,
                  height: 18,
                  padding: 0,
                  borderRadius: 4,
                  background: "rgba(0,0,0,0.6)",
                  color: i === 0 ? "rgba(255,255,255,0.25)" : "#FFFFFF",
                  border: "none",
                  fontSize: 10,
                  lineHeight: 1,
                  cursor: i === 0 ? "default" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => {
                  if (i === images.length - 1) return;
                  const next = [...images];
                  [next[i], next[i + 1]] = [next[i + 1], next[i]];
                  onChange(next);
                }}
                disabled={i === images.length - 1}
                aria-label="Move right"
                style={{
                  width: 18,
                  height: 18,
                  padding: 0,
                  borderRadius: 4,
                  background: "rgba(0,0,0,0.6)",
                  color:
                    i === images.length - 1
                      ? "rgba(255,255,255,0.25)"
                      : "#FFFFFF",
                  border: "none",
                  fontSize: 10,
                  lineHeight: 1,
                  cursor: i === images.length - 1 ? "default" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                ›
              </button>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() =>
                  onChange(images.filter((_, idx) => idx !== i))
                }
                aria-label="Remove photo"
                style={{
                  width: 18,
                  height: 18,
                  padding: 0,
                  borderRadius: 4,
                  background: "rgba(220, 38, 38, 0.85)",
                  color: "#FFFFFF",
                  border: "none",
                  fontSize: 11,
                  lineHeight: 1,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
        {canAddMore && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              width: 72,
              aspectRatio: "1 / 1",
              borderRadius: 10,
              background: hexWithAlpha(accent, 0.08),
              color: accent,
              border: `1px dashed ${hexWithAlpha(accent, 0.5)}`,
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <span style={{ fontSize: 18 }}>+</span>
            <span>
              Photo
              <br />
              {images.length}/{MAX_IMAGES_PER_ITEM}
            </span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />
      {error && <div style={{ fontSize: 11, color: NEX.red }}>{error}</div>}
    </div>
  );
}

// ─── Reusable form primitives ─────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "rgba(2, 9, 20, 0.7)",
  color: NEX.text,
  fontSize: 13,
  border: `1px solid ${NEX.cyanSoft}`,
  borderRadius: 8,
  outline: "none",
  fontFamily: "inherit",
};

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: NEX.textMute,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
