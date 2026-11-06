"use client";

// src/app/nex-native/manage/shop/themes/_client.tsx
//
// Interactive shell for the Shop Themes picker.
// Owner-authorised 2026-11-06.
//
// Layout (desktop + mobile via a single phone-frame-scoped flex):
//   · Sticky header · "Shop Themes" + current business name.
//   · Hero preview tile · 16:9 card showing the currently-selected
//     template with the live tint + background overlay.
//   · Horizontal snap-scroll carousel · 11 template tiles · tap or
//     swipe to select · active tile gets an emerald ring.
//   · Accent colour row · native <input type="color"> + hex field +
//     "Clear tint" reset.
//   · Background image row · "Upload" button (image/png · image/jpeg
//     · image/webp · 5 MB cap) + thumbnail + "Remove" reset.
//   · Sticky footer · "Apply" writes the three selections through
//     three sealed server actions and shows an inline confirmation.

import * as React from "react";
import {
  applyShopLayoutAction,
  applyShopTintAction,
  applyShopBackgroundAction,
  clearShopBackgroundAction,
} from "./_actions";
import type { CoverLayoutId } from "@/app/nex-native/cover/layout-ids";

// Palette · emerald Ireland tokens with navy fallback for the HQ
// identity. Only the per-row pieces need explicit colours; the
// stage/body inherits from the world-stylesheet.
const EMERALD = "var(--nex-world-primary, #123D2B)";
const FOREST = "var(--nex-world-forest, #1B5138)";
const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "rgba(7, 21, 37, 0.72)";
const SURFACE_HI = "rgba(10, 27, 54, 0.88)";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";

interface Props {
  readonly businessId: string | null;
  readonly businessName: string | null;
  readonly currentLayoutId: CoverLayoutId;
  readonly currentTintHex: string | null;
  readonly currentImageUrl: string | null;
  readonly layoutIds: readonly CoverLayoutId[];
  readonly layoutLabels: Readonly<Record<CoverLayoutId, string>>;
}

export function ShopThemesClient({
  businessId,
  businessName,
  currentLayoutId,
  currentTintHex,
  currentImageUrl,
  layoutIds,
  layoutLabels,
}: Props): React.JSX.Element {
  const [selectedLayout, setSelectedLayout] =
    React.useState<CoverLayoutId>(currentLayoutId);
  const [tintHex, setTintHex] = React.useState<string>(
    currentTintHex ?? "#123D2B",
  );
  const [imageUrl, setImageUrl] = React.useState<string | null>(currentImageUrl);
  const [status, setStatus] = React.useState<
    | { kind: "idle" }
    | { kind: "applying" }
    | { kind: "ok"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [pending, startTransition] = React.useTransition();

  // No business row yet → soft empty state.
  if (!businessId) {
    return (
      <EmptyShopState />
    );
  }

  function onPickLayout(id: CoverLayoutId) {
    setSelectedLayout(id);
  }

  function onApplyAll() {
    if (!businessId) return;
    setStatus({ kind: "applying" });
    startTransition(async () => {
      const [layout, tint] = await Promise.all([
        applyShopLayoutAction(businessId, selectedLayout),
        applyShopTintAction(businessId, tintHex),
      ]);
      if (!layout.ok) {
        setStatus({ kind: "error", message: `layout: ${layout.error}` });
        return;
      }
      if (!tint.ok) {
        setStatus({ kind: "error", message: `tint: ${tint.error}` });
        return;
      }
      setStatus({
        kind: "ok",
        message: "Applied · your shop now renders with the new theme.",
      });
    });
  }

  async function onUploadBackground(file: File) {
    if (!businessId) return;
    const fd = new FormData();
    fd.set("businessId", businessId);
    fd.set("file", file);
    setStatus({ kind: "applying" });
    const result = await applyShopBackgroundAction(fd);
    if (result.ok) {
      setImageUrl(result.url);
      setStatus({ kind: "ok", message: "Background uploaded." });
    } else {
      setStatus({ kind: "error", message: `background: ${result.error}` });
    }
  }

  function onClearBackground() {
    if (!businessId) return;
    startTransition(async () => {
      const result = await clearShopBackgroundAction(businessId);
      if (result.ok) {
        setImageUrl(null);
        setStatus({ kind: "ok", message: "Background cleared." });
      } else {
        setStatus({ kind: "error", message: `clear: ${result.error}` });
      }
    });
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 0,
        overflow: "auto",
      }}
    >
      {/* ── Header ───────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          paddingBottom: 6,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: GOLD,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          Shop Themes
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 900,
            color: INK,
            letterSpacing: "-0.01em",
          }}
        >
          {businessName ?? "Your shop"}
        </h1>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: INK_DIM }}>
          Pick a template, tint, and backdrop. Changes apply to your public
          shop cover immediately.
        </p>
      </header>

      {/* ── Hero preview ────────────────────────────────────── */}
      <HeroPreview
        layoutId={selectedLayout}
        tintHex={tintHex}
        imageUrl={imageUrl}
      />

      {/* ── Template carousel ───────────────────────────────── */}
      <section aria-label="Template picker">
        <SectionLabel>Template</SectionLabel>
        <div
          style={{
            display: "flex",
            gap: 10,
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            paddingBottom: 6,
            marginTop: 6,
          }}
        >
          {layoutIds.map((id) => {
            const isActive = id === selectedLayout;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPickLayout(id)}
                data-nex-shop-template-tile={id}
                data-nex-shop-template-active={isActive ? "true" : "false"}
                style={{
                  flex: "0 0 120px",
                  scrollSnapAlign: "start",
                  padding: 0,
                  background: SURFACE,
                  border: `2px solid ${isActive ? GOLD : BORDER}`,
                  borderRadius: 12,
                  cursor: "pointer",
                  textAlign: "left",
                  color: INK,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  boxShadow: isActive
                    ? `0 0 0 3px rgba(198, 161, 91, 0.18)`
                    : "none",
                  transition: "border-color 160ms ease, box-shadow 160ms ease",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: "100%",
                    aspectRatio: "9 / 16",
                    background: `linear-gradient(135deg, ${EMERALD}, ${FOREST})`,
                    borderRadius: "10px 10px 0 0",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Simple tile-shape hint per layout family. */}
                  <TemplateGlyph layoutId={id} />
                </div>
                <div
                  style={{
                    padding: "2px 8px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: isActive ? GOLD : INK_DIM,
                  }}
                >
                  {layoutLabels[id]}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Accent colour ───────────────────────────────────── */}
      <section aria-label="Accent colour">
        <SectionLabel>Accent colour</SectionLabel>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 6,
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            <input
              type="color"
              value={tintHex}
              onChange={(e) => setTintHex(e.target.value)}
              aria-label="Pick accent colour"
              style={{
                appearance: "none",
                border: "none",
                background: "transparent",
                width: 28,
                height: 28,
                padding: 0,
                cursor: "pointer",
              }}
            />
            <code
              style={{
                fontSize: 12,
                fontFamily: "ui-monospace, Menlo, monospace",
                color: INK,
                letterSpacing: "0.04em",
              }}
            >
              {tintHex.toUpperCase()}
            </code>
          </label>
          <button
            type="button"
            onClick={() => setTintHex("#123D2B")}
            style={{
              fontSize: 11,
              padding: "6px 10px",
              background: "transparent",
              color: INK_DIM,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Reset to emerald
          </button>
        </div>
      </section>

      {/* ── Background image ────────────────────────────────── */}
      <section aria-label="Background image">
        <SectionLabel>Background image</SectionLabel>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 6,
            flexWrap: "wrap",
          }}
        >
          <div
            aria-hidden
            style={{
              width: 64,
              height: 64,
              borderRadius: 10,
              background: imageUrl
                ? `url(${imageUrl}) center/cover`
                : `linear-gradient(135deg, ${EMERALD}, ${FOREST})`,
              border: `1px solid ${BORDER}`,
              flexShrink: 0,
            }}
          />
          <label
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "8px 12px",
              background: EMERALD,
              color: CREAM,
              border: `1px solid ${BORDER_HI}`,
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Upload image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                if (f) onUploadBackground(f);
              }}
            />
          </label>
          {imageUrl ? (
            <button
              type="button"
              onClick={onClearBackground}
              disabled={pending}
              style={{
                fontSize: 11,
                padding: "6px 10px",
                background: "transparent",
                color: INK_DIM,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Remove background
            </button>
          ) : null}
          <span style={{ fontSize: 11, color: INK_MUTED }}>
            PNG · JPG · WebP · up to 5 MB
          </span>
        </div>
      </section>

      {/* ── Apply CTA + inline status ───────────────────────── */}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingTop: 10,
          marginTop: "auto",
          borderTop: `1px solid ${BORDER}`,
        }}
      >
        <button
          type="button"
          onClick={onApplyAll}
          disabled={pending || status.kind === "applying"}
          style={{
            padding: "10px 18px",
            background: `linear-gradient(135deg, ${EMERALD}, ${FOREST})`,
            color: CREAM,
            border: `1px solid ${GOLD}`,
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.04em",
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          {status.kind === "applying" ? "Applying…" : "Apply theme"}
        </button>
        {status.kind === "ok" ? (
          <span style={{ fontSize: 12, color: GOLD }}>{status.message}</span>
        ) : status.kind === "error" ? (
          <span style={{ fontSize: 12, color: "#D82A2A" }}>
            {status.message}
          </span>
        ) : null}
      </footer>
    </div>
  );
}

function EmptyShopState(): React.JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
        color: INK,
      }}
    >
      <div style={{ fontSize: 40, lineHeight: 1 }} aria-hidden>
        🏪
      </div>
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
        Create your shop first
      </h1>
      <p style={{ margin: 0, fontSize: 13, color: INK_DIM, maxWidth: 320 }}>
        Shop themes let you customise the cover of your public shop page.
        Head to Manage · Shop to provision your business before picking a
        theme.
      </p>
      <a
        href="/nex-native/manage/shop"
        style={{
          padding: "10px 16px",
          background: `linear-gradient(135deg, ${EMERALD}, ${FOREST})`,
          color: CREAM,
          border: `1px solid ${GOLD}`,
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 800,
          textDecoration: "none",
          letterSpacing: "0.04em",
        }}
      >
        Go to Manage Shop
      </a>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 800,
        color: GOLD,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function HeroPreview({
  layoutId,
  tintHex,
  imageUrl,
}: {
  layoutId: CoverLayoutId;
  tintHex: string;
  imageUrl: string | null;
}) {
  return (
    <div
      aria-label="Hero preview"
      style={{
        width: "100%",
        aspectRatio: "16 / 10",
        borderRadius: 14,
        background: imageUrl
          ? `url(${imageUrl}) center/cover`
          : `linear-gradient(135deg, ${EMERALD}, ${FOREST})`,
        border: `1px solid ${BORDER_HI}`,
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 20px 48px rgba(0,0,0,0.5)",
      }}
    >
      {/* Tint overlay · scales with selected hex. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, transparent 50%, ${tintHex}66 100%)`,
        }}
      />
      {/* Layout label pill. */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          padding: "4px 10px",
          background: "rgba(0,0,0,0.55)",
          color: "#FAF8F4",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          borderRadius: 999,
        }}
      >
        {layoutId.replace(/_/g, " ")}
      </div>
    </div>
  );
}

function TemplateGlyph({ layoutId }: { layoutId: CoverLayoutId }) {
  // Lightweight shape cue per layout family so the grid tiles read
  // distinct at a glance without needing real screenshots.
  const family = layoutId.split("_")[0];
  const shape =
    layoutId.endsWith("_round")
      ? "circle"
      : layoutId.endsWith("_landscape")
        ? "landscape"
        : "portrait";
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: shape === "landscape" ? "70%" : "48%",
          aspectRatio: shape === "landscape" ? "3 / 2" : "3 / 4",
          background: "rgba(198, 161, 91, 0.22)",
          border: "1px solid rgba(198, 161, 91, 0.6)",
          borderRadius: shape === "circle" ? "50%" : 6,
        }}
      />
      <span
        style={{
          position: "absolute",
          bottom: 6,
          fontSize: 9,
          color: "rgba(250, 248, 244, 0.72)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {family}
      </span>
    </div>
  );
}
