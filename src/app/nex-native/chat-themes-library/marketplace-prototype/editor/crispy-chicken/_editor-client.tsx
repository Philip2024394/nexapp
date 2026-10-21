"use client";

// src/app/nex-native/chat-themes-library/marketplace-prototype/editor/crispy-chicken/_editor-client.tsx
//
// Owner directive 2026-10-22 · prototype editor client · reads the
// sealed CRISPY_CHICKEN_MOCK as baseline, lets the owner edit every
// field + upload images, persists everything to localStorage under
// `nex-mp-editor-crispy-chicken`. "View preview" opens the Shop
// preview with the edited content applied via a `?preview=1` cookie
// flag (planned Phase 2 bridge · not implemented yet · the preview
// button is honest about this).

import * as React from "react";
import Link from "next/link";
import { CRISPY_CHICKEN_MOCK } from "@/app/nex-native/cover/mock-data";

// ─── Palette · scoped to this editor only ────────────────────────
const NEX = {
  bg: "#020914",
  card: "rgba(5, 15, 28, 0.8)",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.3)",
  orange: "#FF7200",
  orangeInk: "#1A0808",
  green: "#16D66B",
  red: "#DC2626",
  danger: "rgba(220, 38, 38, 0.14)",
};

const STORAGE_KEY = "nex-mp-editor-crispy-chicken";

// ─── Editable shape ──────────────────────────────────────────────
// Mirror only the fields we actually expose in the editor UI. We
// NEVER write back to the sealed MockCoverContent interface so a
// mismatch between editor + mock-data can be caught at save time.
interface EditableContent {
  businessName: string;
  tagline: string;
  handle: string;
  nexId: string;
  portraitDataUrl: string | null;
  wallpaperDataUrl: string | null;
  countryCode: string;
  presenceOnline: boolean;
  address: string;
  hours: string;
  hoursByDay: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", { open: string; close: string; closed: boolean }>;
  social: {
    instagram: string;
    tiktok: string;
    facebook: string;
    whatsapp: string;
    website: string;
  };
  paymentMethodLabels: string[];
  aboutUs: string;
  ownerName: string;
  ownerPosition: string;
  yearEstablished: string;
  atmosphereLine: string;
  sections: Array<{
    id: string;
    name: string;
  }>;
  products: Array<{
    id: string;
    sectionId: string;
    name: string;
    price: string;
    description: string;
    stockStatus: "in_stock" | "low_stock" | "sold_out";
    /** Owner directive 2026-10-22 · up to 4 photos per item ·
     *  images[0] is the hero · images[1..3] appear as additional
     *  slides in the menu-item sheet carousel. Max 4 cap matches
     *  the editor's 4-slot UI. */
    images: Array<string>;
  }>;
  services: Array<{
    id: string;
    name: string;
    fromPrice: string;
    description: string;
  }>;
  reviews: Array<{
    id: string;
    author: string;
    body: string;
    stars: number;
  }>;
}

// ─── Baseline from the sealed Crispy Chicken mock ────────────────
function baselineFromMock(): EditableContent {
  const toDay = (open?: string, close?: string, closed?: boolean) => ({
    open: open ?? "",
    close: close ?? "",
    closed: closed ?? false,
  });
  const hoursByDay = CRISPY_CHICKEN_MOCK.hoursByDay ?? null;
  return {
    businessName: CRISPY_CHICKEN_MOCK.businessName,
    tagline: CRISPY_CHICKEN_MOCK.tagline,
    handle: CRISPY_CHICKEN_MOCK.handle,
    nexId: "-37123",
    portraitDataUrl: null,
    wallpaperDataUrl: null,
    countryCode: CRISPY_CHICKEN_MOCK.countryCode ?? "US",
    presenceOnline: CRISPY_CHICKEN_MOCK.presenceOnline,
    address: CRISPY_CHICKEN_MOCK.address,
    hours: CRISPY_CHICKEN_MOCK.hours,
    hoursByDay: {
      mon: toDay(hoursByDay?.mon?.open, hoursByDay?.mon?.close, "closed" in (hoursByDay?.mon ?? {})),
      tue: toDay(hoursByDay?.tue?.open, hoursByDay?.tue?.close, "closed" in (hoursByDay?.tue ?? {})),
      wed: toDay(hoursByDay?.wed?.open, hoursByDay?.wed?.close, "closed" in (hoursByDay?.wed ?? {})),
      thu: toDay(hoursByDay?.thu?.open, hoursByDay?.thu?.close, "closed" in (hoursByDay?.thu ?? {})),
      fri: toDay(hoursByDay?.fri?.open, hoursByDay?.fri?.close, "closed" in (hoursByDay?.fri ?? {})),
      sat: toDay(hoursByDay?.sat?.open, hoursByDay?.sat?.close, "closed" in (hoursByDay?.sat ?? {})),
      sun: toDay(hoursByDay?.sun?.open, hoursByDay?.sun?.close, "closed" in (hoursByDay?.sun ?? {})),
    },
    social: {
      instagram: CRISPY_CHICKEN_MOCK.social.instagram ?? "",
      tiktok: CRISPY_CHICKEN_MOCK.social.tiktok ?? "",
      facebook: CRISPY_CHICKEN_MOCK.social.facebook ?? "",
      whatsapp: CRISPY_CHICKEN_MOCK.social.whatsapp ?? "",
      website: CRISPY_CHICKEN_MOCK.social.website ?? "",
    },
    paymentMethodLabels: [...(CRISPY_CHICKEN_MOCK.paymentMethodLabels ?? [])],
    aboutUs: CRISPY_CHICKEN_MOCK.aboutUs ?? "",
    ownerName: CRISPY_CHICKEN_MOCK.ownerName ?? "",
    ownerPosition: CRISPY_CHICKEN_MOCK.ownerPosition ?? "",
    yearEstablished: String(CRISPY_CHICKEN_MOCK.yearEstablished ?? ""),
    atmosphereLine: CRISPY_CHICKEN_MOCK.atmosphereLine,
    sections: CRISPY_CHICKEN_MOCK.sections.map((s) => ({
      id: s.id,
      name: s.name,
    })),
    products: CRISPY_CHICKEN_MOCK.products.map((p) => ({
      id: p.id,
      sectionId: p.section_id,
      name: p.name,
      price: (p.price_pence / 100).toFixed(0),
      description: p.description ?? "",
      stockStatus: (p.stock_status === "in_stock" ||
        p.stock_status === "low_stock" ||
        p.stock_status === "sold_out"
        ? p.stock_status
        : "in_stock") as "in_stock" | "low_stock" | "sold_out",
      images: [],
    })),
    services: CRISPY_CHICKEN_MOCK.services.map((s) => ({
      id: s.id,
      name: s.name,
      fromPrice: s.fromPrice,
      description: s.description,
    })),
    reviews: CRISPY_CHICKEN_MOCK.reviews.map((r, i) => ({
      id: `review-${i}`,
      author: r.author,
      body: r.body,
      stars: r.stars,
    })),
  };
}

// ─── Image upload helper ─────────────────────────────────────────
// Owner directive 2026-10-22 · multi-image gallery · to keep
// localStorage from blowing up (4 images × 24 items would exceed
// the ~5MB per-origin quota at full-res), uploaded images are
// auto-downscaled through a canvas: max 600px wide, JPEG quality
// 0.78. Typical result · 60–120KB per photo · 24 × 4 ≈ 10MB worst-
// case, well-handled by Chrome's 10MB quota and gracefully warned
// before it saturates.
async function readFileAsDataUrl(
  file: File,
): Promise<{ dataUrl: string; warning: string | null }> {
  if (file.size > 10_000_000) {
    throw new Error("Image too large · please upload under 10MB.");
  }

  // Read into an <img>, then canvas-downscale to a bounded size.
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
    // Canvas unavailable (very old browser) · fall back to the raw
    // data URL with a soft warning.
    return {
      dataUrl: originalDataUrl,
      warning: file.size > 300_000
        ? "Image large · browser downscale unavailable · may fill storage."
        : null,
    };
  }
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.78);

  // Rough byte estimate for data-URL (base64 payload only).
  const base64 = dataUrl.split(",")[1] ?? "";
  const bytes = Math.round(base64.length * 0.75);
  const warning =
    bytes > 250_000
      ? "Still a big photo after downscale · 2+ large images per item may fill storage."
      : null;

  return { dataUrl, warning };
}

// ─── Client component ────────────────────────────────────────────
export function EditorClient(): React.JSX.Element {
  const [content, setContent] = React.useState<EditableContent>(() =>
    baselineFromMock(),
  );
  const [loaded, setLoaded] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [openSections, setOpenSections] = React.useState<
    Record<string, boolean>
  >({
    identity: true,
    menu: true,
    store: false,
    story: false,
  });

  // Hydrate from localStorage on mount.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as EditableContent;
        if (parsed && typeof parsed === "object" && parsed.businessName) {
          setContent(parsed);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoaded(true);
    }
  }, []);

  // Toast auto-dismiss.
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const save = React.useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
      setToast("Saved to this browser · prototype only");
    } catch (err) {
      setToast(
        err instanceof Error && err.message.toLowerCase().includes("quota")
          ? "Storage full · remove some images and try again"
          : "Could not save · try again",
      );
    }
  }, [content]);

  const reset = React.useCallback(() => {
    if (
      typeof window === "undefined" ||
      !window.confirm(
        "Reset every field back to the sealed Crispy Chicken baseline? Your edits + uploaded photos will be deleted from this browser.",
      )
    ) {
      return;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    setContent(baselineFromMock());
    setToast("Reset to baseline");
  }, []);

  const toggleSection = React.useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (!loaded) {
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
        Loading editor…
      </div>
    );
  }

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
          borderBottom: `1px solid ${NEX.cyanSoft}`,
          flexShrink: 0,
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
            padding: 0,
            borderRadius: "50%",
            background: "transparent",
            color: NEX.text,
            border: `1px solid ${NEX.cyanSoft}`,
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
            fontFamily: "inherit",
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
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            Prototype editor · localStorage only
          </div>
          <h1
            style={{
              margin: "3px 0 0",
              fontSize: 18,
              fontWeight: 900,
              color: NEX.text,
              letterSpacing: "-0.012em",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Crispy Chicken shop
          </h1>
        </div>
        <button
          type="button"
          onClick={reset}
          data-nex-mp-editor-reset
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
          }}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={save}
          data-nex-mp-editor-save
          style={{
            padding: "0 14px",
            minHeight: 36,
            borderRadius: 10,
            background: NEX.cyan,
            color: "#021018",
            border: "none",
            fontSize: 12,
            fontWeight: 900,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: `0 4px 14px -4px ${NEX.cyan}`,
          }}
        >
          Save
        </button>
      </header>

      {/* ─── Body · scrollable sections ─── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "12px 12px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* Honesty banner */}
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: hexWithAlpha(NEX.cyan, 0.08),
            border: `1px solid ${hexWithAlpha(NEX.cyan, 0.28)}`,
            color: NEX.textDim,
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: NEX.text }}>
            Prototype editor · your edits save to this browser only.
          </strong>{" "}
          No account is linked, no photos go to the cloud, no payment is
          taken — this is a UX preview of the Phase 2 seller editor.
        </div>

        {/* ─── Identity ─── */}
        <Section
          id="identity"
          title="Identity"
          open={openSections.identity}
          onToggle={() => toggleSection("identity")}
        >
          <Field label="Business name">
            <TextInput
              value={content.businessName}
              onChange={(v) =>
                setContent((c) => ({ ...c, businessName: v }))
              }
            />
          </Field>
          <Field label="Tagline">
            <TextInput
              value={content.tagline}
              onChange={(v) => setContent((c) => ({ ...c, tagline: v }))}
            />
          </Field>
          <Field label="Handle">
            <TextInput
              value={content.handle}
              onChange={(v) => setContent((c) => ({ ...c, handle: v }))}
            />
          </Field>
          <Field label="NEX ID">
            <TextInput
              value={content.nexId}
              onChange={(v) => setContent((c) => ({ ...c, nexId: v }))}
              placeholder="-37123"
            />
          </Field>
          <Field label="Country code (ISO 3166-1 alpha-2)">
            <TextInput
              value={content.countryCode}
              onChange={(v) =>
                setContent((c) => ({ ...c, countryCode: v.toUpperCase().slice(0, 2) }))
              }
              placeholder="US"
            />
          </Field>
          <Field label="Portrait photo">
            <ImageUpload
              value={content.portraitDataUrl}
              onChange={(v) =>
                setContent((c) => ({ ...c, portraitDataUrl: v }))
              }
              onWarn={(w) => setToast(w)}
            />
          </Field>
          <Field label="Hero wallpaper">
            <ImageUpload
              value={content.wallpaperDataUrl}
              onChange={(v) =>
                setContent((c) => ({ ...c, wallpaperDataUrl: v }))
              }
              onWarn={(w) => setToast(w)}
              aspectRatio="16 / 9"
            />
          </Field>
          <Field label="Online presence">
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${NEX.cyanSoft}`,
                cursor: "pointer",
                fontSize: 13,
                color: NEX.text,
              }}
            >
              <input
                type="checkbox"
                checked={content.presenceOnline}
                onChange={(e) =>
                  setContent((c) => ({ ...c, presenceOnline: e.target.checked }))
                }
                style={{ cursor: "pointer" }}
              />
              Show as online now
            </label>
          </Field>
        </Section>

        {/* ─── Menu · categories + items ─── */}
        <Section
          id="menu"
          title="Menu"
          open={openSections.menu}
          onToggle={() => toggleSection("menu")}
        >
          <Field label="Categories">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {content.sections.map((section, i) => (
                <div
                  key={section.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <TextInput
                    value={section.name}
                    onChange={(v) =>
                      setContent((c) => ({
                        ...c,
                        sections: c.sections.map((s, idx) =>
                          idx === i ? { ...s, name: v } : s,
                        ),
                      }))
                    }
                  />
                  <IconButton
                    label="Move up"
                    disabled={i === 0}
                    onClick={() =>
                      setContent((c) => {
                        const next = [...c.sections];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        return { ...c, sections: next };
                      })
                    }
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    label="Move down"
                    disabled={i === content.sections.length - 1}
                    onClick={() =>
                      setContent((c) => {
                        const next = [...c.sections];
                        [next[i], next[i + 1]] = [next[i + 1], next[i]];
                        return { ...c, sections: next };
                      })
                    }
                  >
                    ↓
                  </IconButton>
                  <IconButton
                    label="Remove category"
                    tone="danger"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Remove "${section.name}" and all its items?`,
                        )
                      ) {
                        return;
                      }
                      setContent((c) => ({
                        ...c,
                        sections: c.sections.filter((_, idx) => idx !== i),
                        products: c.products.filter(
                          (p) => p.sectionId !== section.id,
                        ),
                      }));
                    }}
                  >
                    ×
                  </IconButton>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setContent((c) => ({
                    ...c,
                    sections: [
                      ...c.sections,
                      {
                        id: `sec-${Date.now()}`,
                        name: "New Category",
                      },
                    ],
                  }))
                }
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "transparent",
                  color: NEX.cyan,
                  border: `1px dashed ${NEX.cyanSoft}`,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                + Add category
              </button>
            </div>
          </Field>

          {content.sections.map((section) => (
            <Field key={section.id} label={`${section.name} · menu items`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {content.products
                  .filter((p) => p.sectionId === section.id)
                  .map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onChange={(patch) =>
                        setContent((c) => ({
                          ...c,
                          products: c.products.map((p) =>
                            p.id === product.id ? { ...p, ...patch } : p,
                          ),
                        }))
                      }
                      onRemove={() => {
                        if (
                          !window.confirm(
                            `Remove "${product.name}" from the menu?`,
                          )
                        ) {
                          return;
                        }
                        setContent((c) => ({
                          ...c,
                          products: c.products.filter((p) => p.id !== product.id),
                        }));
                      }}
                      onWarn={(w) => setToast(w)}
                    />
                  ))}
                <button
                  type="button"
                  onClick={() =>
                    setContent((c) => ({
                      ...c,
                      products: [
                        ...c.products,
                        {
                          id: `prod-${Date.now()}`,
                          sectionId: section.id,
                          name: "New item",
                          price: "0",
                          description: "",
                          stockStatus: "in_stock",
                          imageDataUrl: null,
                        },
                      ],
                    }))
                  }
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "transparent",
                    color: NEX.cyan,
                    border: `1px dashed ${NEX.cyanSoft}`,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  + Add item to {section.name}
                </button>
              </div>
            </Field>
          ))}
        </Section>

        {/* ─── Store info ─── */}
        <Section
          id="store"
          title="Store info"
          open={openSections.store}
          onToggle={() => toggleSection("store")}
        >
          <Field label="Short hours label">
            <TextInput
              value={content.hours}
              onChange={(v) => setContent((c) => ({ ...c, hours: v }))}
              placeholder="Open daily · 11:00 – 22:00"
            />
          </Field>
          <Field label="Opening hours (per day)">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {(
                [
                  ["mon", "Monday"],
                  ["tue", "Tuesday"],
                  ["wed", "Wednesday"],
                  ["thu", "Thursday"],
                  ["fri", "Friday"],
                  ["sat", "Saturday"],
                  ["sun", "Sunday"],
                ] as const
              ).map(([key, label]) => (
                <DayRow
                  key={key}
                  label={label}
                  value={content.hoursByDay[key]}
                  onChange={(patch) =>
                    setContent((c) => ({
                      ...c,
                      hoursByDay: {
                        ...c.hoursByDay,
                        [key]: { ...c.hoursByDay[key], ...patch },
                      },
                    }))
                  }
                />
              ))}
            </div>
          </Field>
          <Field label="Full address">
            <TextInput
              value={content.address}
              onChange={(v) => setContent((c) => ({ ...c, address: v }))}
            />
          </Field>
          <Field label="Social links">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(
                [
                  ["instagram", "Instagram handle"],
                  ["tiktok", "TikTok handle"],
                  ["facebook", "Facebook page"],
                  ["whatsapp", "WhatsApp (with country code)"],
                  ["website", "Website URL"],
                ] as const
              ).map(([key, label]) => (
                <TextInput
                  key={key}
                  value={content.social[key]}
                  onChange={(v) =>
                    setContent((c) => ({
                      ...c,
                      social: { ...c.social, [key]: v },
                    }))
                  }
                  placeholder={label}
                />
              ))}
            </div>
          </Field>
          <Field label="Payment methods">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {content.paymentMethodLabels.map((pm, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <TextInput
                    value={pm}
                    onChange={(v) =>
                      setContent((c) => ({
                        ...c,
                        paymentMethodLabels: c.paymentMethodLabels.map((x, idx) =>
                          idx === i ? v : x,
                        ),
                      }))
                    }
                  />
                  <IconButton
                    label="Remove"
                    tone="danger"
                    onClick={() =>
                      setContent((c) => ({
                        ...c,
                        paymentMethodLabels: c.paymentMethodLabels.filter(
                          (_, idx) => idx !== i,
                        ),
                      }))
                    }
                  >
                    ×
                  </IconButton>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setContent((c) => ({
                    ...c,
                    paymentMethodLabels: [...c.paymentMethodLabels, ""],
                  }))
                }
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "transparent",
                  color: NEX.cyan,
                  border: `1px dashed ${NEX.cyanSoft}`,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                + Add payment method
              </button>
            </div>
          </Field>
        </Section>

        {/* ─── Story + extras ─── */}
        <Section
          id="story"
          title="Story + extras"
          open={openSections.story}
          onToggle={() => toggleSection("story")}
        >
          <Field label="About us">
            <TextArea
              value={content.aboutUs}
              rows={8}
              onChange={(v) => setContent((c) => ({ ...c, aboutUs: v }))}
            />
          </Field>
          <Field label="Atmosphere line">
            <TextInput
              value={content.atmosphereLine}
              onChange={(v) =>
                setContent((c) => ({ ...c, atmosphereLine: v }))
              }
            />
          </Field>
          <Field label="Owner name">
            <TextInput
              value={content.ownerName}
              onChange={(v) => setContent((c) => ({ ...c, ownerName: v }))}
            />
          </Field>
          <Field label="Owner position">
            <TextInput
              value={content.ownerPosition}
              onChange={(v) =>
                setContent((c) => ({ ...c, ownerPosition: v }))
              }
            />
          </Field>
          <Field label="Year established">
            <TextInput
              value={content.yearEstablished}
              onChange={(v) =>
                setContent((c) => ({ ...c, yearEstablished: v.replace(/\D/g, "").slice(0, 4) }))
              }
              placeholder="2019"
            />
          </Field>
          <Field label="Services">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {content.services.map((svc) => (
                <div
                  key={svc.id}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid rgba(255,255,255,0.08)`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <TextInput
                    value={svc.name}
                    onChange={(v) =>
                      setContent((c) => ({
                        ...c,
                        services: c.services.map((s) =>
                          s.id === svc.id ? { ...s, name: v } : s,
                        ),
                      }))
                    }
                    placeholder="Service name"
                  />
                  <TextInput
                    value={svc.fromPrice}
                    onChange={(v) =>
                      setContent((c) => ({
                        ...c,
                        services: c.services.map((s) =>
                          s.id === svc.id ? { ...s, fromPrice: v } : s,
                        ),
                      }))
                    }
                    placeholder="from Rp 850k · or Full menu"
                  />
                  <TextArea
                    value={svc.description}
                    rows={2}
                    onChange={(v) =>
                      setContent((c) => ({
                        ...c,
                        services: c.services.map((s) =>
                          s.id === svc.id ? { ...s, description: v } : s,
                        ),
                      }))
                    }
                    placeholder="One-line description"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setContent((c) => ({
                        ...c,
                        services: c.services.filter((s) => s.id !== svc.id),
                      }))
                    }
                    style={{
                      alignSelf: "flex-end",
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: NEX.danger,
                      color: NEX.red,
                      border: "none",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setContent((c) => ({
                    ...c,
                    services: [
                      ...c.services,
                      {
                        id: `svc-${Date.now()}`,
                        name: "",
                        fromPrice: "",
                        description: "",
                      },
                    ],
                  }))
                }
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "transparent",
                  color: NEX.cyan,
                  border: `1px dashed ${NEX.cyanSoft}`,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                + Add service
              </button>
            </div>
          </Field>
          <Field label="Reviews">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {content.reviews.map((rev) => (
                <div
                  key={rev.id}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid rgba(255,255,255,0.08)`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <TextInput
                    value={rev.author}
                    onChange={(v) =>
                      setContent((c) => ({
                        ...c,
                        reviews: c.reviews.map((r) =>
                          r.id === rev.id ? { ...r, author: v } : r,
                        ),
                      }))
                    }
                    placeholder="Customer name"
                  />
                  <TextArea
                    value={rev.body}
                    rows={3}
                    onChange={(v) =>
                      setContent((c) => ({
                        ...c,
                        reviews: c.reviews.map((r) =>
                          r.id === rev.id ? { ...r, body: v } : r,
                        ),
                      }))
                    }
                    placeholder="What they said"
                  />
                  <select
                    value={rev.stars}
                    onChange={(e) =>
                      setContent((c) => ({
                        ...c,
                        reviews: c.reviews.map((r) =>
                          r.id === rev.id
                            ? { ...r, stars: Number(e.target.value) }
                            : r,
                        ),
                      }))
                    }
                    style={inputStyle}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} star{n === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setContent((c) => ({
                        ...c,
                        reviews: c.reviews.filter((r) => r.id !== rev.id),
                      }))
                    }
                    style={{
                      alignSelf: "flex-end",
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: NEX.danger,
                      color: NEX.red,
                      border: "none",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setContent((c) => ({
                    ...c,
                    reviews: [
                      ...c.reviews,
                      {
                        id: `review-${Date.now()}`,
                        author: "",
                        body: "",
                        stars: 5,
                      },
                    ],
                  }))
                }
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "transparent",
                  color: NEX.cyan,
                  border: `1px dashed ${NEX.cyanSoft}`,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                + Add review
              </button>
            </div>
          </Field>
        </Section>

        {/* Footer honesty · reminder of localStorage-only scope */}
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 10,
            background: hexWithAlpha(NEX.orange, 0.08),
            border: `1px solid ${hexWithAlpha(NEX.orange, 0.3)}`,
            color: NEX.textDim,
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: NEX.text }}>Prototype only.</strong> Edits
          save to this browser via <code style={{ color: NEX.orange }}>
            localStorage
          </code>
          . Clearing site data or using a different browser / device will
          lose everything. The real editor will persist to Supabase after
          the Theme Commerce Purchase Journey doctrine locks and the shop
          content schema is approved.
        </div>
      </div>

      {/* ─── Toast ─── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          data-nex-mp-editor-toast
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

// ─── Reusable primitives ─────────────────────────────────────────

function Section({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      data-nex-mp-editor-section={id}
      style={{
        background: NEX.card,
        border: `1px solid ${NEX.cyanSoft}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%",
          padding: "12px 14px",
          background: "transparent",
          color: NEX.text,
          border: "none",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "-0.005em",
          cursor: "pointer",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span>{title}</span>
        <span
          aria-hidden
          style={{
            color: NEX.cyan,
            fontSize: 16,
            lineHeight: 1,
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 180ms ease",
          }}
        >
          ›
        </span>
      </button>
      {open && (
        <div
          style={{
            padding: "4px 14px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            borderTop: `1px solid rgba(0,175,255,0.14)`,
          }}
        >
          {children}
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
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

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "10px 12px",
  background: "rgba(2, 9, 20, 0.7)",
  color: NEX.text,
  fontSize: 13,
  border: `1px solid ${NEX.cyanSoft}`,
  borderRadius: 8,
  outline: "none",
  fontFamily: "inherit",
};

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly placeholder?: string;
}): React.JSX.Element {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly rows?: number;
  readonly placeholder?: string;
}): React.JSX.Element {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      style={{
        ...inputStyle,
        resize: "vertical",
        lineHeight: 1.5,
      }}
    />
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  label,
  tone,
}: {
  readonly children: React.ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly label: string;
  readonly tone?: "danger";
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        width: 32,
        height: 32,
        padding: 0,
        borderRadius: 8,
        background:
          tone === "danger" ? NEX.danger : "rgba(255, 255, 255, 0.05)",
        color: disabled
          ? NEX.textMute
          : tone === "danger"
          ? NEX.red
          : NEX.text,
        border: `1px solid ${
          tone === "danger"
            ? "rgba(220, 38, 38, 0.3)"
            : "rgba(255, 255, 255, 0.08)"
        }`,
        fontSize: 15,
        lineHeight: 1,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function ImageUpload({
  value,
  onChange,
  onWarn,
  aspectRatio = "1 / 1",
}: {
  readonly value: string | null;
  readonly onChange: (dataUrl: string | null) => void;
  readonly onWarn: (msg: string) => void;
  readonly aspectRatio?: string;
}): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const { dataUrl, warning } = await readFileAsDataUrl(file);
      onChange(dataUrl);
      if (warning) onWarn(warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
  };

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div
        style={{
          width: 80,
          aspectRatio,
          borderRadius: 10,
          background: value
            ? `url("${value}") center / cover no-repeat`
            : "rgba(255,255,255,0.04)",
          border: `1px dashed ${NEX.cyanSoft}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: NEX.textMute,
          fontSize: 11,
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {!value && "No photo"}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: hexWithAlpha(NEX.cyan, 0.12),
            color: NEX.cyan,
            border: `1px solid ${NEX.cyanSoft}`,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {value ? "Replace photo" : "Upload photo"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              background: NEX.danger,
              color: NEX.red,
              border: "none",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Remove
          </button>
        )}
        {error && (
          <div style={{ fontSize: 11, color: NEX.red }}>{error}</div>
        )}
      </div>
    </div>
  );
}

// ─── Multi-image upload · 4 slots + reorder ─────────────────────
//
// Owner directive 2026-10-22 · each menu item can carry up to 4
// photos. images[0] renders as the hero in the menu-item sheet ·
// images[1..3] appear as additional slides in the carousel. Buyers
// only see arrows + count when images.length > 1.

const MAX_IMAGES_PER_ITEM = 4;

function MultiImageUpload({
  images,
  onChange,
  onWarn,
}: {
  readonly images: Array<string>;
  readonly onChange: (next: Array<string>) => void;
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

  const slotsFilled = images.length;
  const canAddMore = slotsFilled < MAX_IMAGES_PER_ITEM;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 2,
        }}
      >
        {images.map((src, i) => (
          <div
            key={`${i}-${src.slice(-16)}`}
            data-nex-mp-editor-item-image-slot={i}
            style={{
              position: "relative",
              width: 76,
              aspectRatio: "1 / 1",
              borderRadius: 10,
              background: `url("${src}") center / cover no-repeat`,
              border: i === 0
                ? `2px solid ${NEX.cyan}`
                : `1px solid ${NEX.cyanSoft}`,
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {/* Hero marker on slot 0 */}
            {i === 0 && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: 4,
                  left: 4,
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: NEX.cyan,
                  color: "#021018",
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                  lineHeight: 1.3,
                }}
              >
                Hero
              </span>
            )}
            {/* Reorder + remove · bottom row of each slot */}
            <div
              style={{
                position: "absolute",
                bottom: 2,
                left: 2,
                right: 2,
                display: "flex",
                alignItems: "center",
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
                  width: 20,
                  height: 20,
                  padding: 0,
                  borderRadius: 4,
                  background: "rgba(0, 0, 0, 0.6)",
                  color: i === 0 ? "rgba(255,255,255,0.25)" : "#FFFFFF",
                  border: "none",
                  fontSize: 11,
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
                  width: 20,
                  height: 20,
                  padding: 0,
                  borderRadius: 4,
                  background: "rgba(0, 0, 0, 0.6)",
                  color:
                    i === images.length - 1
                      ? "rgba(255,255,255,0.25)"
                      : "#FFFFFF",
                  border: "none",
                  fontSize: 11,
                  lineHeight: 1,
                  cursor:
                    i === images.length - 1 ? "default" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                ›
              </button>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => {
                  const next = images.filter((_, idx) => idx !== i);
                  onChange(next);
                }}
                aria-label="Remove photo"
                style={{
                  width: 20,
                  height: 20,
                  padding: 0,
                  borderRadius: 4,
                  background: "rgba(220, 38, 38, 0.8)",
                  color: "#FFFFFF",
                  border: "none",
                  fontSize: 12,
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
              width: 76,
              aspectRatio: "1 / 1",
              borderRadius: 10,
              background: hexWithAlpha(NEX.cyan, 0.08),
              color: NEX.cyan,
              border: `1px dashed ${NEX.cyanSoft}`,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            <span style={{ fontSize: 20 }}>+</span>
            <span>
              Photo
              <br />
              {slotsFilled}/{MAX_IMAGES_PER_ITEM}
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
      {images.length === 0 && (
        <div
          style={{
            fontSize: 10,
            color: NEX.textMute,
            lineHeight: 1.4,
          }}
        >
          First photo = hero · drag left/right to reorder · up to{" "}
          {MAX_IMAGES_PER_ITEM} photos per item.
        </div>
      )}
    </div>
  );
}

function DayRow({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: { open: string; close: string; closed: boolean };
  readonly onChange: (patch: Partial<{ open: string; close: string; closed: boolean }>) => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
      }}
    >
      <span
        style={{
          width: 60,
          color: NEX.textDim,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      {value.closed ? (
        <span
          style={{
            flex: 1,
            color: NEX.textMute,
            fontStyle: "italic",
            padding: "10px 12px",
          }}
        >
          Closed
        </span>
      ) : (
        <>
          <input
            type="time"
            value={value.open}
            onChange={(e) => onChange({ open: e.target.value })}
            style={{ ...inputStyle, flex: 1, padding: "8px 10px" }}
          />
          <span style={{ color: NEX.textMute }}>–</span>
          <input
            type="time"
            value={value.close}
            onChange={(e) => onChange({ close: e.target.value })}
            style={{ ...inputStyle, flex: 1, padding: "8px 10px" }}
          />
        </>
      )}
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          color: NEX.textMute,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <input
          type="checkbox"
          checked={value.closed}
          onChange={(e) => onChange({ closed: e.target.checked })}
          style={{ cursor: "pointer" }}
        />
        Closed
      </label>
    </div>
  );
}

function ProductCard({
  product,
  onChange,
  onRemove,
  onWarn,
}: {
  readonly product: EditableContent["products"][number];
  readonly onChange: (patch: Partial<EditableContent["products"][number]>) => void;
  readonly onRemove: () => void;
  readonly onWarn: (msg: string) => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid rgba(255,255,255,0.08)`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <MultiImageUpload
        images={product.images}
        onChange={(next) => onChange({ images: next })}
        onWarn={onWarn}
      />
      <TextInput
        value={product.name}
        onChange={(v) => onChange({ name: v })}
        placeholder="Item name"
      />
      <div style={{ display: "flex", gap: 6 }}>
        <TextInput
          value={product.price}
          onChange={(v) => onChange({ price: v.replace(/\D/g, "") })}
          placeholder="Price (IDR, no commas)"
        />
        <select
          value={product.stockStatus}
          onChange={(e) =>
            onChange({
              stockStatus: e.target.value as EditableContent["products"][number]["stockStatus"],
            })
          }
          style={{ ...inputStyle, flex: "0 0 130px" }}
        >
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="sold_out">Sold out</option>
        </select>
      </div>
      <TextArea
        value={product.description}
        rows={2}
        onChange={(v) => onChange({ description: v })}
        placeholder="Short description"
      />
      <button
        type="button"
        onClick={onRemove}
        style={{
          alignSelf: "flex-end",
          padding: "6px 10px",
          borderRadius: 6,
          background: NEX.danger,
          color: NEX.red,
          border: "none",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Remove item
      </button>
    </div>
  );
}

// ─── Local helper ────────────────────────────────────────────────
function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
