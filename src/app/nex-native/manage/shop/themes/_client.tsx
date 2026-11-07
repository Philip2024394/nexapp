"use client";

// src/app/nex-native/manage/shop/themes/_client.tsx
//
// Shop Themes · Template picker (template-only surface).
// Owner-authorised 2026-11-06 · light-theme rework 2026-11-07.
// -----------------------------------------------------------------------------
// Owner directive 2026-11-07 · "what we should have first is only
// the shop templates where user can back and forward and activate
// on white back ground off white · the user must see phone size
// height to scale to width and templates fitting with button over
// full screen".
//
// Resolution:
//   · This page is TEMPLATE-ONLY · no inline background strip (the
//     background library stays at /manage/shop/backgrounds).
//   · Off-white page bg (page.tsx sets NEX_BG = #FAF8F4). Dark ink
//     body copy · gold accents · emerald/forest preserved on the
//     Activate pill for brand consistency.
//   · Phone preview holds the sealed 9:19.5 silhouette · centred ·
//     max-width 300px · fullscreen trigger (⤢) in the top-right.
//   · ◀ Template N / 11 ▶ counter under the phone; keyboard ← →.
//   · Backend writes unchanged · Activate still sends
//     applyShopLayoutAction + applyShopTintAction + (if set)
//     applyShopPresetBackgroundAction so any background the owner
//     picked elsewhere stays persisted.

import * as React from "react";
import { createPortal } from "react-dom";
import {
  applyShopLayoutAction,
  applyShopPresetBackgroundAction,
  applyShopTintAction,
} from "./_actions";
import type { CoverLayoutId } from "@/app/nex-native/cover/layout-ids";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const EMERALD = "var(--nex-world-primary, #123D2B)";
const FOREST = "var(--nex-world-forest, #1B5138)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8"; // page body ink · reads on dark NEX page
const INK_DIM = "#B5C3D6"; // faded cool · body copy on dark
const INK_MUTED = "#7D9BC0"; // dim · hint copy on dark
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";

// Owner directive 2026-11-07 · "not the app page white undo - i
// mean behind the template offwhite". The page stays dark; this
// cream pad sits DIRECTLY BEHIND the phone preview so the template
// reads as a product-photo mock-up inside a soft off-white card.
const PAD_CREAM = "#FAF8F4";
const PAD_INK = "#1A120A";
const PAD_INK_DIM = "#5F4A2C";

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
  currentLayoutId,
  currentTintHex,
  currentImageUrl,
  layoutIds,
  layoutLabels,
}: Props): React.JSX.Element {
  const [selectedLayout, setSelectedLayout] =
    React.useState<CoverLayoutId>(currentLayoutId);
  // Background + tint carry through unchanged so a save re-persists
  // whatever the owner last picked on /manage/shop/backgrounds.
  const imageUrl = currentImageUrl;
  const tintHex = currentTintHex ?? "#123D2B";
  const [status, setStatus] = React.useState<
    | { kind: "idle" }
    | { kind: "applying" }
    | { kind: "ok"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [pending, startTransition] = React.useTransition();
  const [fullscreen, setFullscreen] = React.useState(false);

  // No business row yet → soft empty state.
  if (!businessId) {
    return <EmptyShopState />;
  }

  const layoutIndex = Math.max(
    0,
    layoutIds.findIndex((id) => id === selectedLayout),
  );
  const totalLayouts = layoutIds.length;
  const prevLayout = () =>
    setSelectedLayout(layoutIds[layoutIndex === 0 ? totalLayouts - 1 : layoutIndex - 1]!);
  const nextLayout = () =>
    setSelectedLayout(layoutIds[layoutIndex === totalLayouts - 1 ? 0 : layoutIndex + 1]!);

  // Keyboard arrow navigation (page-level) · Escape closes fullscreen.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevLayout();
      else if (e.key === "ArrowRight") nextLayout();
      else if (e.key === "Escape" && fullscreen) setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [layoutIndex, layoutIds, fullscreen]); // eslint-disable-line react-hooks/exhaustive-deps

  function onApplyAll() {
    if (!businessId) return;
    setStatus({ kind: "applying" });
    startTransition(async () => {
      const results = await Promise.all([
        applyShopLayoutAction(businessId, selectedLayout),
        applyShopTintAction(businessId, tintHex),
        imageUrl
          ? applyShopPresetBackgroundAction(businessId, imageUrl)
          : Promise.resolve({ ok: true } as const),
      ]);
      const bad = results.find((r) => !r.ok);
      if (bad && "error" in bad) {
        setStatus({ kind: "error", message: bad.error });
        return;
      }
      setStatus({
        kind: "ok",
        message: "Template activated · your shop is live.",
      });
    });
  }

  const previewSrc = buildPreviewSrc(selectedLayout, imageUrl, tintHex);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 0,
        overflow: "auto",
        color: INK,
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
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 900,
              color: GOLD,
              letterSpacing: "-0.01em",
            }}
          >
            Shop Template
          </h1>
          <span
            data-nex-step-indicator
            style={{
              fontSize: 10,
              fontWeight: 900,
              color: INK_MUTED,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            Step 1 of 2
          </span>
        </div>
      </header>

      {/* Owner directive 2026-11-07 · "no undo white outside phone -
          inside phone background color cream off white". The outer
          cream pad was removed · the off-white now sits INSIDE the
          phone silhouette as the interior backdrop (so transparent
          areas of the template render show cream through). Page
          chrome stays on the sealed dark Ireland NEX_BG. */}

      {/* ── PHONE FRAME LIVE PREVIEW ─────────────────────────────
          Sealed 9:19.5 silhouette · narrow max-width keeps the frame
          tall + phone-shaped. Interior bg is off-white (PAD_CREAM)
          per owner 2026-11-07. Fullscreen trigger (⤢) overlays the
          top-right. */}
      <section
        aria-label="Live preview"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 300,
          aspectRatio: "9 / 19.5",
          minHeight: 500,
          margin: "0 auto",
          borderRadius: 32,
          background: PAD_CREAM,
          border: `2px solid ${BORDER_HI}`,
          overflow: "hidden",
          boxShadow: "0 18px 46px rgba(0, 0, 0, 0.4)",
          boxSizing: "border-box",
        }}
      >
        <iframe
          key={`${selectedLayout}:${imageUrl ?? "none"}:${tintHex}`}
          src={previewSrc}
          title={`${layoutLabels[selectedLayout]} template preview`}
          loading="lazy"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
            background: "transparent",
          }}
        />
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          aria-label="View template full-screen"
          title="View full-screen"
          data-nex-template-fullscreen
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(26, 18, 10, 0.72)",
            color: CREAM,
            border: `1px solid ${GOLD}`,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 18,
            fontWeight: 900,
            lineHeight: 1,
            padding: 0,
            boxShadow: "0 4px 12px rgba(26,18,10,0.35)",
          }}
        >
          ⤢
        </button>
      </section>

      {/* ── Prev / count / next row under the phone ──────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <ArrowPill direction="left" onClick={prevLayout} />
        <span
          data-nex-template-counter
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: INK,
            letterSpacing: "0.04em",
            fontVariantNumeric: "tabular-nums",
            minWidth: 150,
            textAlign: "center",
          }}
        >
          Template {layoutIndex + 1} of {totalLayouts}
          <span
            style={{
              display: "block",
              fontSize: 10,
              fontWeight: 700,
              color: INK_DIM,
              marginTop: 2,
              letterSpacing: "0.02em",
            }}
          >
            {layoutLabels[selectedLayout]}
          </span>
        </span>
        <ArrowPill direction="right" onClick={nextLayout} />
      </div>

      {/* ── Activate Shop CTA ─────────────────────────────────── */}
      <section
        aria-label="Activate shop"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          paddingTop: 2,
        }}
      >
        <button
          type="button"
          onClick={onApplyAll}
          disabled={pending || status.kind === "applying"}
          data-nex-shop-activate
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "12px 28px",
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#1A120A",
            background: GOLD,
            border: "none",
            borderRadius: 999,
            fontFamily: "inherit",
            cursor: pending || status.kind === "applying" ? "wait" : "pointer",
            boxShadow: "0 12px 26px rgba(198,161,91,0.35)",
          }}
        >
          {status.kind === "applying"
            ? "Activating…"
            : status.kind === "ok"
              ? "Shop active ✓"
              : status.kind === "error"
                ? "Retry"
                : "Activate Shop"}
        </button>
        {status.kind === "error" ? (
          <span style={{ fontSize: 11, color: "#B13030" }}>
            {status.message}
          </span>
        ) : null}
        {status.kind === "ok" ? (
          <span style={{ fontSize: 11, color: INK_DIM }}>
            {status.message}
          </span>
        ) : null}
      </section>

      {/* Fullscreen overlay · portaled to document.body so it escapes
          the sealed phone-frame transform. Close via × or Escape. */}
      {fullscreen && typeof document !== "undefined"
        ? createPortal(
            <FullscreenTemplate
              src={previewSrc}
              label={layoutLabels[selectedLayout]}
              onClose={() => setFullscreen(false)}
            />,
            document.body,
          )
        : null}

      <span
        style={{
          display: "block",
          textAlign: "center",
          fontSize: 10,
          color: INK_MUTED,
          paddingBottom: 4,
        }}
      >
        Need to change the background? Go to{" "}
        <a
          href="/nex-native/manage/shop/backgrounds"
          style={{ color: INK_DIM, fontWeight: 800 }}
        >
          Backgrounds →
        </a>
      </span>
    </div>
  );
}

function buildPreviewSrc(
  layoutId: CoverLayoutId,
  imageUrl: string | null,
  tintHex: string,
): string {
  const bg = imageUrl ? `&bg=${encodeURIComponent(imageUrl)}` : "";
  const tint = /^#[0-9A-Fa-f]{6}$/.test(tintHex)
    ? `&tint=${encodeURIComponent(tintHex)}`
    : "";
  return `/nex-native/cover/preview/${layoutId}?embed=1${bg}${tint}`;
}

function ArrowPill({
  direction,
  onClick,
}: {
  direction: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "left" ? "Previous template" : "Next template"}
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        // Sits on the dark Ireland page bg · dark fill with gold
        // ring + gold glyph reads cleanly on NEX_BG.
        background: "rgba(5, 15, 28, 0.9)",
        border: `1.5px solid ${BORDER_HI}`,
        color: GOLD,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        fontSize: 20,
        fontWeight: 900,
        lineHeight: 1,
        fontFamily: "inherit",
        padding: 0,
      }}
    >
      {direction === "left" ? "◀" : "▶"}
    </button>
  );
}

function FullscreenTemplate({
  src,
  label,
  onClose,
}: {
  src: string;
  label: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${label} template full-screen`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(26, 18, 10, 0.92)",
        display: "flex",
        flexDirection: "column",
        padding: "env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "12px 16px",
          color: CREAM,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: GOLD,
          }}
        >
          {label}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close full-screen"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "rgba(250, 248, 244, 0.1)",
            border: `1px solid ${GOLD}`,
            color: CREAM,
            fontSize: 18,
            fontWeight: 900,
            lineHeight: 1,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            padding: 0,
            fontFamily: "inherit",
          }}
        >
          ×
        </button>
      </div>
      <iframe
        src={src}
        title={`${label} fullscreen`}
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          background: "transparent",
        }}
      />
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
        Shop templates let you customise the cover of your public shop
        page. Head to Manage · Shop to provision your business before
        picking a template.
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
