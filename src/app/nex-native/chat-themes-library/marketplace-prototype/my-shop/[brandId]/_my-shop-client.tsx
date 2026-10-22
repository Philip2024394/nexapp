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
const DESCRIPTION_MAX_CHARS = 180;
const DESCRIPTION_WARN_CHARS = 160;
const IDEAL_IMAGE_SIDE = 1200;
const ACCEPTED_IMAGE_FORMATS = "image/jpeg,image/png,image/webp";
const ACCEPTED_IMAGE_LABEL = "JPG · PNG · WebP";

// ─── Currency catalog · 40 common currencies ─────────────────────
// Source: ISO 4217 + top GDP currencies · Indonesia first (NEX primary
// market), then APAC, EMEA, Americas. Each entry is enough for
// `Intl.NumberFormat` to render the right symbol + separators.
interface CurrencyEntry {
  readonly code: string;
  readonly symbol: string;
  readonly name: string;
  readonly locale: string;
  readonly decimals: 0 | 2;
}

const CURRENCY_CATALOG: ReadonlyArray<CurrencyEntry> = [
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", locale: "id-ID", decimals: 0 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG", decimals: 2 },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", locale: "ms-MY", decimals: 2 },
  { code: "THB", symbol: "฿", name: "Thai Baht", locale: "th-TH", decimals: 2 },
  { code: "VND", symbol: "₫", name: "Vietnamese Dong", locale: "vi-VN", decimals: 0 },
  { code: "PHP", symbol: "₱", name: "Philippine Peso", locale: "en-PH", decimals: 2 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN", decimals: 2 },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka", locale: "bn-BD", decimals: 2 },
  { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee", locale: "en-LK", decimals: 2 },
  { code: "NPR", symbol: "Rs", name: "Nepalese Rupee", locale: "ne-NP", decimals: 2 },
  { code: "PKR", symbol: "Rs", name: "Pakistani Rupee", locale: "en-PK", decimals: 2 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU", decimals: 2 },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", locale: "en-NZ", decimals: 2 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", locale: "ja-JP", decimals: 0 },
  { code: "KRW", symbol: "₩", name: "South Korean Won", locale: "ko-KR", decimals: 0 },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", locale: "zh-CN", decimals: 2 },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", locale: "en-HK", decimals: 2 },
  { code: "TWD", symbol: "NT$", name: "Taiwan Dollar", locale: "zh-TW", decimals: 2 },
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US", decimals: 2 },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", locale: "en-CA", decimals: 2 },
  { code: "MXN", symbol: "Mex$", name: "Mexican Peso", locale: "es-MX", decimals: 2 },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", locale: "pt-BR", decimals: 2 },
  { code: "ARS", symbol: "$", name: "Argentine Peso", locale: "es-AR", decimals: 2 },
  { code: "CLP", symbol: "$", name: "Chilean Peso", locale: "es-CL", decimals: 0 },
  { code: "EUR", symbol: "€", name: "Euro", locale: "en-IE", decimals: 2 },
  { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB", decimals: 2 },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", locale: "de-CH", decimals: 2 },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", locale: "sv-SE", decimals: 2 },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone", locale: "nb-NO", decimals: 2 },
  { code: "DKK", symbol: "kr", name: "Danish Krone", locale: "da-DK", decimals: 2 },
  { code: "PLN", symbol: "zł", name: "Polish Zloty", locale: "pl-PL", decimals: 2 },
  { code: "CZK", symbol: "Kč", name: "Czech Koruna", locale: "cs-CZ", decimals: 2 },
  { code: "HUF", symbol: "Ft", name: "Hungarian Forint", locale: "hu-HU", decimals: 0 },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", locale: "tr-TR", decimals: 2 },
  { code: "ILS", symbol: "₪", name: "Israeli Shekel", locale: "he-IL", decimals: 2 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", locale: "ar-AE", decimals: 2 },
  { code: "SAR", symbol: "ر.س", name: "Saudi Riyal", locale: "ar-SA", decimals: 2 },
  { code: "EGP", symbol: "E£", name: "Egyptian Pound", locale: "ar-EG", decimals: 2 },
  { code: "ZAR", symbol: "R", name: "South African Rand", locale: "en-ZA", decimals: 2 },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", locale: "en-NG", decimals: 2 },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling", locale: "en-KE", decimals: 2 },
];

const DEFAULT_CURRENCY_CODE = "IDR";

// ─── Spice ladder ────────────────────────────────────────────────
// Richeese-style 0-5 scale. Owners can leave as null (not spicy).
interface SpiceLevelEntry {
  readonly level: number;
  readonly label: string;
  readonly icon: string;
  readonly tone: string;
}

const CHILLI_RED = "#DC2626";

const SPICE_LEVELS: ReadonlyArray<SpiceLevelEntry> = [
  { level: 1, label: "Mild", icon: "🌶", tone: CHILLI_RED },
  { level: 2, label: "Medium", icon: "🌶🌶", tone: CHILLI_RED },
  { level: 3, label: "Hot", icon: "🌶🌶🌶", tone: CHILLI_RED },
  { level: 4, label: "Extra Hot", icon: "🌶🌶🌶🌶", tone: CHILLI_RED },
  { level: 5, label: "Fire", icon: "🌶🌶🌶🌶🌶", tone: CHILLI_RED },
];

// ─── Quick-pick seed · research-informed ─────────────────────────
// 21 items · 13 universal + 8 Indonesia-authentic · each row
// pre-fills name + suggested amount. Owner always overrides.
// Keep "Other · type my own name" at the top as the sealed escape
// hatch (owner directive 2026-10-22 · must always be present).
interface QuickPickItem {
  readonly id: string;
  readonly name: string;
  readonly suggestedAmount: number; // in major currency units
  readonly region: "universal" | "idn" | "eu";
  readonly suggestedSpice: number | null;
  readonly tag: string; // short category hint shown in dropdown
}

// Tags map ONLY to the 4 existing Crispy Chicken sections per owner
// directive 2026-10-22 (Burgers · Meal Deals · Chicken · Drinks).
// Standalone sides + dessert + plain rice were dropped from the quick
// pick because they don't fit the sealed 4-section taxonomy; owners
// who sell those items use the "Other" option in the category select
// to create their own section.
const QUICK_PICK_ITEMS: ReadonlyArray<QuickPickItem> = [
  // Universal
  { id: "qp-zinger", name: "Zinger Burger", suggestedAmount: 38000, region: "universal", suggestedSpice: 2, tag: "Burgers" },
  { id: "qp-tower", name: "Tower Burger", suggestedAmount: 48000, region: "universal", suggestedSpice: null, tag: "Burgers" },
  { id: "qp-original", name: "Original Recipe (1 pc)", suggestedAmount: 25000, region: "universal", suggestedSpice: null, tag: "Chicken" },
  { id: "qp-hot-crispy", name: "Hot & Crispy (1 pc)", suggestedAmount: 25000, region: "universal", suggestedSpice: 2, tag: "Chicken" },
  { id: "qp-wings", name: "Chicken Wings (3 pc)", suggestedAmount: 22000, region: "universal", suggestedSpice: 2, tag: "Chicken" },
  { id: "qp-nuggets", name: "Chicken Nuggets (5 pc)", suggestedAmount: 22000, region: "universal", suggestedSpice: null, tag: "Chicken" },
  { id: "qp-bucket", name: "Family Bucket (6 pc)", suggestedAmount: 180000, region: "universal", suggestedSpice: null, tag: "Meal Deals" },
  { id: "qp-pepsi", name: "Pepsi (medium)", suggestedAmount: 12000, region: "universal", suggestedSpice: null, tag: "Drinks" },
  // Indonesia-authentic (research-backed · KFC IDN · Richeese · Texas Chicken · Rocket · Hisana)
  { id: "qp-paket-dada", name: "Paket Nasi · Chicken Breast", suggestedAmount: 34000, region: "idn", suggestedSpice: null, tag: "Meal Deals" },
  { id: "qp-paket-paha", name: "Paket Nasi · Chicken Thigh", suggestedAmount: 32000, region: "idn", suggestedSpice: null, tag: "Meal Deals" },
  { id: "qp-paket-sayap", name: "Paket Nasi · Chicken Wing", suggestedAmount: 20000, region: "idn", suggestedSpice: null, tag: "Meal Deals" },
  { id: "qp-geprek", name: "Ayam Geprek Dada", suggestedAmount: 25000, region: "idn", suggestedSpice: 3, tag: "Chicken" },
  { id: "qp-fire-chicken", name: "Fire Chicken Lvl 3", suggestedAmount: 30000, region: "idn", suggestedSpice: 3, tag: "Chicken" },
  { id: "qp-es-teh", name: "Es Teh (iced tea)", suggestedAmount: 7000, region: "idn", suggestedSpice: null, tag: "Drinks" },
];

const QUICK_PICK_OTHER_ID = "qp-other";

// ─── Promo + discount catalog ────────────────────────────────────
// One promo + one discount per item. Owner directive 2026-10-22 ·
// "Free Delivery" lives at shop level in the Full Editor and is
// intentionally NOT in this item-level dropdown.
type PromoType =
  | "bogo"
  | "free_drink"
  | "free_fries"
  | "free_rice"
  | "free_sauce";

interface PromoOption {
  readonly id: PromoType;
  readonly label: string;
  readonly short: string;
  readonly icon: string;
}

const PROMO_OPTIONS: ReadonlyArray<PromoOption> = [
  { id: "bogo", label: "Buy 1 Get 1 Free", short: "BOGO", icon: "🎁" },
  { id: "free_drink", label: "Free Drink with purchase", short: "FREE DRINK", icon: "🥤" },
  { id: "free_fries", label: "Free Fries with purchase", short: "FREE FRIES", icon: "🍟" },
  { id: "free_rice", label: "Free Rice with purchase", short: "FREE RICE", icon: "🍚" },
  { id: "free_sauce", label: "Free Sauce with purchase", short: "FREE SAUCE", icon: "🥣" },
];

const DISCOUNT_OPTIONS: ReadonlyArray<number> = [5, 10, 15, 20, 25, 30, 35, 40, 50];

const PROMO_YELLOW = "#FFD400";
const PROMO_INK = "#2A1D00";
const DISCOUNT_RED = "#DC2626";

function computeDiscountedAmount(amount: number, pct: number): number {
  if (pct <= 0 || !Number.isFinite(amount)) return amount;
  const after = (amount * (100 - pct)) / 100;
  // IDR + JPY + KRW + VND + CLP + HUF have 0 decimals · round to int
  // for all currencies to avoid odd .99 cents visuals. The display
  // helper (Intl.NumberFormat) still formats with the right decimals.
  return Math.round(after);
}

type StockStatus = "in_stock" | "low_stock" | "sold_out";

interface EditableProduct {
  id: string;
  sectionId: string;
  name: string;
  price: string;
  currency: string;
  description: string;
  stockStatus: StockStatus;
  spiceLevel: number | null;
  promo: PromoType | null;
  discountPercent: number; // 0-50 (0 = no discount)
  delivers: boolean;
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

function resolveCurrency(code: string | undefined | null): CurrencyEntry {
  return (
    CURRENCY_CATALOG.find((c) => c.code === code) ?? CURRENCY_CATALOG[0]
  );
}

function formatPrice(amount: string | number, code: string): string {
  const num = typeof amount === "string" ? Number(amount || "0") : amount;
  const cur = resolveCurrency(code);
  try {
    return new Intl.NumberFormat(cur.locale, {
      style: "currency",
      currency: cur.code,
      minimumFractionDigits: cur.decimals,
      maximumFractionDigits: cur.decimals,
    }).format(Number.isFinite(num) ? num : 0);
  } catch {
    return `${cur.symbol} ${Number(num).toLocaleString()}`;
  }
}

// Count visible characters (code-point aware · counts most emoji as 1).
function describeDescriptionLength(value: string): number {
  return Array.from(value).length;
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
      sectionId: p.section_id ?? CRISPY_CHICKEN_MOCK.sections[0]?.id ?? "",
      name: p.name,
      price: String(Math.round(p.price_pence / 100)),
      currency: DEFAULT_CURRENCY_CODE,
      description: p.description ?? "",
      stockStatus: (p.stock_status === "low_stock" ||
        p.stock_status === "sold_out"
        ? p.stock_status
        : "in_stock") as StockStatus,
      spiceLevel: null,
      promo: null,
      discountPercent: 0,
      delivers: true,
      images: [],
    })),
  };
}

// Hydrated products may be missing new fields if they were saved
// before the 2026-10-22 schema bump. Fill defaults without touching
// existing values.
function hydrateProduct(p: Partial<EditableProduct>): EditableProduct {
  return {
    id: p.id ?? `prod-${Date.now()}`,
    sectionId: p.sectionId ?? "",
    name: p.name ?? "",
    price: p.price ?? "0",
    currency: p.currency ?? DEFAULT_CURRENCY_CODE,
    description: p.description ?? "",
    stockStatus: p.stockStatus ?? "in_stock",
    spiceLevel: p.spiceLevel ?? null,
    promo: p.promo ?? null,
    discountPercent: p.discountPercent ?? 0,
    delivers: p.delivers ?? true,
    images: p.images ?? [],
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
          // Back-compat · fill new fields on products saved before
          // currency + spiceLevel were added (2026-10-22).
          const hydrated: EditableContent = {
            ...parsed,
            products: parsed.products.map((p) => hydrateProduct(p)),
          };
          setContent(hydrated);
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

  // Owner-defined category · persists into content.sections alongside
  // the pre-seeded Burgers · Meal Deals · Chicken · Drinks. Returns
  // the new section id so the form can select it immediately.
  // MUST be declared before the early-return below so hook order is
  // stable across renders (React Rules of Hooks).
  const addSection = React.useCallback(
    (name: string): string | null => {
      if (!content) return null;
      const newSection: EditableSection = {
        id: `sec-${Date.now()}`,
        name,
      };
      const next: EditableContent = {
        ...content,
        sections: [...content.sections, newSection],
      };
      persist(next, `Category "${name}" added`);
      return newSection.id;
    },
    [content, persist],
  );

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
          href="/nex-native/chat-themes-library"
          aria-label="Back to marketplace"
          title="Back to marketplace"
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
          Marketplace
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
            onAddSection={addSection}
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
                  hydrateProduct({
                    id: `prod-${Date.now()}`,
                    sectionId: patch.sectionId ?? content.sections[0].id,
                    name: patch.name ?? "New item",
                    price: patch.price ?? "0",
                    currency: patch.currency ?? DEFAULT_CURRENCY_CODE,
                    description: patch.description ?? "",
                    stockStatus: patch.stockStatus ?? "in_stock",
                    spiceLevel: patch.spiceLevel ?? null,
                    promo: patch.promo ?? null,
                    discountPercent: patch.discountPercent ?? 0,
                    delivers: patch.delivers ?? true,
                    images: patch.images ?? [],
                  }),
                ],
              };
              persist(next, "Product added");
              setMode("view");
            }}
            onWarn={(msg) => setToast(msg)}
            onAddSection={addSection}
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
  const promoEntry = product.promo
    ? PROMO_OPTIONS.find((p) => p.id === product.promo) ?? null
    : null;
  const hasDiscount = product.discountPercent > 0;
  const originalAmount = Number(product.price || "0");
  const discountedAmount = hasDiscount
    ? computeDiscountedAmount(originalAmount, product.discountPercent)
    : originalAmount;

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
        {promoEntry && (
          <span
            data-nex-mp-my-shop-promo-badge={promoEntry.id}
            style={{
              position: "absolute",
              top: 3,
              left: 3,
              padding: "1px 4px",
              borderRadius: 3,
              background: PROMO_YELLOW,
              color: PROMO_INK,
              fontSize: 8,
              fontWeight: 900,
              letterSpacing: 0.3,
              lineHeight: 1.4,
              textTransform: "uppercase",
              boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
              maxWidth: 60,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {promoEntry.short}
          </span>
        )}
        {hasDiscount && (
          <span
            data-nex-mp-my-shop-discount-badge={product.discountPercent}
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              padding: "1px 4px",
              borderRadius: 3,
              background: DISCOUNT_RED,
              color: "#FFFFFF",
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: 0.2,
              lineHeight: 1.4,
              boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
            }}
          >
            -{product.discountPercent}%
          </span>
        )}
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
          {hasDiscount ? (
            <>
              <span
                style={{
                  fontSize: 10,
                  color: NEX.textMute,
                  textDecoration: "line-through",
                  fontWeight: 700,
                }}
              >
                {formatPrice(originalAmount, product.currency)}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: DISCOUNT_RED,
                  letterSpacing: "-0.005em",
                }}
              >
                {formatPrice(discountedAmount, product.currency)}
              </span>
            </>
          ) : (
            <span
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: accent,
                letterSpacing: "-0.005em",
              }}
            >
              {formatPrice(product.price, product.currency)}
            </span>
          )}
          {!product.delivers && (
            <span
              style={{
                padding: "1px 5px",
                borderRadius: 999,
                background: hexWithAlpha(DELIVERY_NO_ORANGE, 0.16),
                color: DELIVERY_NO_ORANGE,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 0.3,
                textTransform: "uppercase",
              }}
            >
              Pickup only
            </span>
          )}
          {product.spiceLevel !== null && product.spiceLevel >= 1 && (() => {
            const entry = SPICE_LEVELS.find(
              (s) => s.level === product.spiceLevel,
            );
            if (!entry) return null;
            return (
              <span
                style={{
                  padding: "1px 5px",
                  borderRadius: 999,
                  background: hexWithAlpha(entry.tone, 0.16),
                  color: entry.tone,
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                {entry.icon} {entry.label}
              </span>
            );
          })()}
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
  onAddSection,
}: {
  readonly mode: "add" | "edit";
  readonly accent: string;
  readonly product?: EditableProduct;
  readonly sections: EditableSection[];
  readonly onCancel: () => void;
  readonly onSave: (patch: Partial<EditableProduct>) => void;
  readonly onWarn: (msg: string) => void;
  readonly onAddSection: (name: string) => string | null;
}): React.JSX.Element {
  const [name, setName] = React.useState(product?.name ?? "");
  const [sectionId, setSectionId] = React.useState(
    product?.sectionId ?? sections[0]?.id ?? "",
  );
  const [price, setPrice] = React.useState(product?.price ?? "");
  const [currency, setCurrency] = React.useState(
    product?.currency ?? DEFAULT_CURRENCY_CODE,
  );
  const [description, setDescription] = React.useState(
    product?.description ?? "",
  );
  const [stockStatus, setStockStatus] = React.useState<StockStatus>(
    product?.stockStatus ?? "in_stock",
  );
  const [spiceLevel, setSpiceLevel] = React.useState<number | null>(
    product?.spiceLevel ?? null,
  );
  const [promo, setPromo] = React.useState<PromoType | null>(
    product?.promo ?? null,
  );
  const [discountPercent, setDiscountPercent] = React.useState<number>(
    product?.discountPercent ?? 0,
  );
  const [delivers, setDelivers] = React.useState<boolean>(
    product?.delivers ?? true,
  );
  const [images, setImages] = React.useState<string[]>(
    product?.images ?? [],
  );
  const [quickPickId, setQuickPickId] = React.useState<string>(
    QUICK_PICK_OTHER_ID,
  );

  const canSave = name.trim().length > 0 && price.trim().length > 0;
  const descriptionLength = describeDescriptionLength(description);
  const descriptionOverLimit = descriptionLength > DESCRIPTION_MAX_CHARS;
  const descriptionWarning = descriptionLength >= DESCRIPTION_WARN_CHARS;
  const currencyEntry = resolveCurrency(currency);

  // Quick-pick handler · pre-fills name + amount + spice + section
  // without locking anything. Owner can edit every field after.
  const applyQuickPick = React.useCallback(
    (id: string) => {
      setQuickPickId(id);
      if (id === QUICK_PICK_OTHER_ID) {
        // "Other" clears the name so the owner types their own.
        setName("");
        return;
      }
      const pick = QUICK_PICK_ITEMS.find((q) => q.id === id);
      if (!pick) return;
      setName(pick.name);
      // Only prefill price if the field is empty — don't clobber an
      // owner's typed value.
      setPrice((prev) =>
        prev.trim().length === 0 ? String(pick.suggestedAmount) : prev,
      );
      if (pick.suggestedSpice !== null) {
        setSpiceLevel(pick.suggestedSpice);
      }
      // Auto-match the pick's tag to an existing section (case-insensitive).
      const match = sections.find(
        (s) => s.name.toLowerCase() === pick.tag.toLowerCase(),
      );
      if (match) setSectionId(match.id);
    },
    [sections],
  );

  // "Other category" sentinel in the Category select.
  const [addingSection, setAddingSection] = React.useState(false);
  const [newSectionName, setNewSectionName] = React.useState("");
  const ADD_SECTION_SENTINEL = "__add_new_section__";

  const commitNewSection = () => {
    const trimmed = newSectionName.trim();
    if (trimmed.length === 0) {
      onWarn("Category name can't be empty.");
      return;
    }
    const dup = sections.find(
      (s) => s.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (dup) {
      setSectionId(dup.id);
      setAddingSection(false);
      setNewSectionName("");
      onWarn(`"${dup.name}" already exists · selected it.`);
      return;
    }
    const newId = onAddSection(trimmed);
    if (newId) {
      setSectionId(newId);
      setAddingSection(false);
      setNewSectionName("");
    }
  };

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

      {/* Quick-pick · research-informed common items + "Other"
          escape hatch sealed 2026-10-22 at top of the list. */}
      {mode === "add" && (
        <Field label="Common items · tap to pre-fill · Other = type my own">
          <select
            value={quickPickId}
            onChange={(e) => applyQuickPick(e.target.value)}
            style={inputStyle}
            data-nex-mp-my-shop-quick-pick
          >
            <option value={QUICK_PICK_OTHER_ID}>
              ✎ Other · type my own name
            </option>
            <optgroup label="Universal · global menu">
              {QUICK_PICK_ITEMS.filter((q) => q.region === "universal").map(
                (q) => (
                  <option key={q.id} value={q.id}>
                    {q.name} · {q.tag} · {formatPrice(q.suggestedAmount, currency)}
                    {q.suggestedSpice !== null ? " · 🌶" : ""}
                  </option>
                ),
              )}
            </optgroup>
            <optgroup label="🇮🇩 Indonesia · common at IDN outlets">
              {QUICK_PICK_ITEMS.filter((q) => q.region === "idn").map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name} · {q.tag} · {formatPrice(q.suggestedAmount, currency)}
                  {q.suggestedSpice !== null ? " · 🌶" : ""}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
      )}

      <Field label="Item name">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            // Typing a custom name defaults the quick-pick back to Other.
            if (quickPickId !== QUICK_PICK_OTHER_ID) {
              setQuickPickId(QUICK_PICK_OTHER_ID);
            }
          }}
          placeholder="Classic Crispy Burger"
          style={inputStyle}
          maxLength={80}
        />
      </Field>

      <Field label="Category">
        <select
          value={addingSection ? ADD_SECTION_SENTINEL : sectionId}
          onChange={(e) => {
            if (e.target.value === ADD_SECTION_SENTINEL) {
              setAddingSection(true);
              setNewSectionName("");
            } else {
              setAddingSection(false);
              setSectionId(e.target.value);
            }
          }}
          style={inputStyle}
          data-nex-mp-my-shop-category-select
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value={ADD_SECTION_SENTINEL}>
            ✎ Other · type my own category name
          </option>
        </select>
        {addingSection && (
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 6,
            }}
          >
            <input
              type="text"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitNewSection();
                }
                if (e.key === "Escape") {
                  setAddingSection(false);
                  setNewSectionName("");
                }
              }}
              placeholder="e.g. Sides · Desserts · Snacks · Signature Dishes"
              aria-label="New category name"
              autoFocus
              maxLength={40}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={commitNewSection}
              disabled={newSectionName.trim().length === 0}
              style={{
                padding: "0 14px",
                minHeight: 40,
                borderRadius: 8,
                background:
                  newSectionName.trim().length > 0
                    ? accent
                    : "rgba(255,255,255,0.08)",
                color:
                  newSectionName.trim().length > 0
                    ? "#FFFFFF"
                    : NEX.textMute,
                border: "none",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 0.3,
                cursor:
                  newSectionName.trim().length > 0 ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                WebkitTapHighlightColor: "transparent",
                flexShrink: 0,
              }}
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingSection(false);
                setNewSectionName("");
              }}
              aria-label="Cancel new category"
              style={{
                width: 40,
                minHeight: 40,
                borderRadius: 8,
                background: "transparent",
                color: NEX.textMute,
                border: `1px solid ${NEX.cyanSoft}`,
                fontSize: 18,
                lineHeight: 1,
                cursor: "pointer",
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        )}
      </Field>

      <Field label="Price · currency + amount">
        <div style={{ display: "flex", gap: 6 }}>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            aria-label="Currency"
            style={{ ...inputStyle, width: 110, flexShrink: 0 }}
          >
            {CURRENCY_CATALOG.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.symbol}
              </option>
            ))}
          </select>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => {
              const cleaned = currencyEntry.decimals === 0
                ? e.target.value.replace(/[^0-9]/g, "")
                : e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
              setPrice(cleaned.slice(0, 12));
            }}
            placeholder={currencyEntry.decimals === 0 ? "45000" : "9.99"}
            aria-label="Amount"
            style={{ ...inputStyle, flex: 1 }}
          />
        </div>
        <div
          style={{
            fontSize: 10,
            color: NEX.textMute,
            lineHeight: 1.5,
            marginTop: 4,
          }}
        >
          Preview · {formatPrice(price || "0", currency)} ·{" "}
          {currencyEntry.name} · local currency only, no auto-conversion.
        </div>
      </Field>

      <Field label="Spice level">
        <SpicePicker value={spiceLevel} onChange={setSpiceLevel} accent={accent} />
      </Field>

      <Field label="Delivery?">
        <DeliveryToggle value={delivers} onChange={setDelivers} accent={accent} />
      </Field>

      <Field label="Promo badge · one per item · appears top-left of the card">
        <select
          value={promo ?? ""}
          onChange={(e) =>
            setPromo(e.target.value === "" ? null : (e.target.value as PromoType))
          }
          style={inputStyle}
          data-nex-mp-my-shop-promo-select
        >
          <option value="">None · no promo</option>
          {PROMO_OPTIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Discount · one per item · appears top-right of the card">
        <select
          value={String(discountPercent)}
          onChange={(e) => setDiscountPercent(Number(e.target.value))}
          style={inputStyle}
          data-nex-mp-my-shop-discount-select
        >
          <option value="0">None · full price</option>
          {DISCOUNT_OPTIONS.map((pct) => (
            <option key={pct} value={pct}>
              {pct}% off
            </option>
          ))}
        </select>
        {discountPercent > 0 && (
          <div
            style={{
              fontSize: 10,
              color: NEX.textMute,
              lineHeight: 1.5,
              marginTop: 4,
            }}
          >
            Preview ·{" "}
            <span style={{ textDecoration: "line-through", color: NEX.textMute }}>
              {formatPrice(price || "0", currency)}
            </span>{" "}
            →{" "}
            <strong style={{ color: DISCOUNT_RED, fontWeight: 900 }}>
              {formatPrice(
                computeDiscountedAmount(Number(price || "0"), discountPercent),
                currency,
              )}
            </strong>
          </div>
        )}
      </Field>

      {(promo !== null || discountPercent > 0) && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            background: hexWithAlpha("#FFC14D", 0.1),
            border: `1px solid ${hexWithAlpha("#FFC14D", 0.3)}`,
            fontSize: 10,
            color: "#FFC14D",
            lineHeight: 1.5,
          }}
        >
          ⚠ Prototype only · the promo + discount badges show on cards
          but the cart doesn&apos;t apply them at checkout yet. Doctrine
          + commerce wiring is scheduled separately.
        </div>
      )}

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => {
            const next = e.target.value;
            const len = describeDescriptionLength(next);
            if (len > DESCRIPTION_MAX_CHARS) {
              // Hard stop · keep what fits within the limit (code-point aware).
              const trimmed = Array.from(next)
                .slice(0, DESCRIPTION_MAX_CHARS)
                .join("");
              setDescription(trimmed);
              onWarn(`Description max ${DESCRIPTION_MAX_CHARS} characters.`);
              return;
            }
            setDescription(next);
          }}
          placeholder="Buttermilk-fried chicken · lettuce · mayo · toasted brioche. 🔥 Try it with hot sauce!"
          rows={3}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            fontSize: 10,
            color: descriptionOverLimit
              ? NEX.red
              : descriptionWarning
              ? "#FFC14D"
              : NEX.textMute,
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {descriptionLength}/{DESCRIPTION_MAX_CHARS}
          </span>
        </div>
      </Field>

      <Field label={`Photo Max ${MAX_IMAGES_PER_ITEM} - First Photo is main Photo`}>
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
            onSave({
              name,
              sectionId,
              price,
              currency,
              description,
              stockStatus,
              spiceLevel,
              promo,
              discountPercent,
              delivers,
              images,
            })
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

// ─── Delivery toggle ──────────────────────────────────────────────

const DELIVERY_YES_GREEN = "#16D66B";
const DELIVERY_NO_ORANGE = "#FF7200";

function DeliveryToggle({
  value,
  onChange,
}: {
  readonly value: boolean;
  readonly onChange: (next: boolean) => void;
  readonly accent?: string;
}): React.JSX.Element {
  const tone = value ? DELIVERY_YES_GREEN : DELIVERY_NO_ORANGE;
  return (
    <div
      role="switch"
      aria-checked={value}
      tabIndex={0}
      onClick={() => onChange(!value)}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange(!value);
        }
      }}
      data-nex-mp-my-shop-delivery-toggle={value ? "yes" : "no"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        background: hexWithAlpha(tone, 0.12),
        border: `1px solid ${hexWithAlpha(tone, 0.4)}`,
        color: tone,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 800,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 38,
          height: 22,
          borderRadius: 999,
          background: tone,
          position: "relative",
          flexShrink: 0,
          transition: "background 150ms ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: value ? 18 : 2,
            width: 18,
            height: 18,
            borderRadius: 999,
            background: "#FFFFFF",
            transition: "left 150ms ease",
          }}
        />
      </span>
      <span style={{ flex: 1 }}>
        {value ? "Yes · this item delivers" : "Pickup only · no delivery"}
      </span>
    </div>
  );
}

// ─── Spice picker · None + 1..5 ladder ────────────────────────────

function SpicePicker({
  value,
  onChange,
  accent,
}: {
  readonly value: number | null;
  readonly onChange: (next: number | null) => void;
  readonly accent: string;
}): React.JSX.Element {
  const selected = value ?? 0;
  const label =
    value === null
      ? "No spice selected · tap a level to flag spicy items."
      : (() => {
          const entry = SPICE_LEVELS.find((s) => s.level === value);
          return entry
            ? `${entry.icon} ${entry.label} · level ${entry.level} of 5`
            : "No spice selected";
        })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        role="radiogroup"
        aria-label="Spice level"
        data-nex-mp-my-shop-spice
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 4,
        }}
      >
        <SpiceButton
          label="None"
          active={value === null}
          accent={accent}
          tone={NEX.textMute}
          onClick={() => onChange(null)}
        />
        {SPICE_LEVELS.map((s) => (
          <SpiceButton
            key={s.level}
            label={String(s.level)}
            active={selected === s.level}
            accent={s.tone}
            tone={s.tone}
            onClick={() => onChange(s.level)}
          />
        ))}
      </div>
      <div
        style={{
          fontSize: 10,
          color: NEX.textMute,
          lineHeight: 1.5,
          minHeight: 14,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function SpiceButton({
  label,
  active,
  accent,
  tone,
  onClick,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly accent: string;
  readonly tone: string;
  readonly onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      style={{
        minHeight: 36,
        padding: "0 2px",
        borderRadius: 8,
        background: active ? accent : "rgba(255,255,255,0.05)",
        color: active ? "#FFFFFF" : tone,
        border: active
          ? "1px solid rgba(255,255,255,0.2)"
          : "1px solid rgba(255,255,255,0.08)",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.3,
        cursor: "pointer",
        fontFamily: "inherit",
        WebkitTapHighlightColor: "transparent",
        boxShadow: active ? `0 4px 10px -4px ${hexWithAlpha(accent, 0.7)}` : "none",
      }}
    >
      {label}
    </button>
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
        accept={ACCEPTED_IMAGE_FORMATS}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />
      <div
        style={{
          fontSize: 10,
          color: NEX.textMute,
          lineHeight: 1.5,
        }}
      >
        Square{" "}
        <strong style={{ color: NEX.textDim }}>
          {IDEAL_IMAGE_SIDE}×{IDEAL_IMAGE_SIDE}
        </strong>{" "}
        · {ACCEPTED_IMAGE_LABEL} · max 10 MB.
      </div>
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
  boxSizing: "border-box",
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
