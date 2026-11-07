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
          title={`Template ${layoutIndex + 1} of ${totalLayouts} preview`}
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
        {/* Owner directive 2026-11-07 · "add little scrolling bar
            verticle right side of templates only for user viewing the
            templates so user knows the screen template will scrolling
            · on full screen this bar is not showing or on live view".
            Decorative only · visual hint that the iframe content can
            scroll. The thumb drifts down + up on a slow loop so the
            cue reads even without interaction. Not scroll-synced ·
            scope-contained. Full-screen overlay + public shop pages
            do NOT render this element. */}
        <div
          aria-hidden
          data-nex-template-scroll-hint
          style={{
            position: "absolute",
            top: "14%",
            bottom: "14%",
            right: 5,
            width: 3,
            borderRadius: 999,
            background: "rgba(198, 161, 91, 0.22)",
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "28%",
              borderRadius: 999,
              background: GOLD,
              opacity: 0.85,
              animation: "nexTemplateScrollHint 3.6s ease-in-out infinite",
            }}
          />
        </div>
        <style>{`
          @keyframes nexTemplateScrollHint {
            0%   { transform: translateY(0%); }
            50%  { transform: translateY(257%); }
            100% { transform: translateY(0%); }
          }
        `}</style>
      </section>

      {/* Owner directive 2026-11-07 · "view large screen - must be
          outside the phone the button and must open in screen size".
          Labelled pill sits outside the phone frame · the full-
          screen dialog portals to document.body and covers the
          whole viewport. */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          data-nex-template-fullscreen
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: GOLD,
            background: "rgba(5, 15, 28, 0.9)",
            border: `1.5px solid ${BORDER_HI}`,
            borderRadius: 999,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>⤢</span>
          View large screen
        </button>
      </div>

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
            fontSize: 14,
            fontWeight: 900,
            color: INK,
            letterSpacing: "0.04em",
            fontVariantNumeric: "tabular-nums",
            minWidth: 150,
            textAlign: "center",
          }}
        >
          Template {layoutIndex + 1} of {totalLayouts}
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
              label={`Template ${layoutIndex + 1} of ${totalLayouts}`}
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
  // Owner directive 2026-11-07 (two refinements):
  //   · "view large screen must stay inside the phone screen size of
  //     phone . not open desktop of tablet size" · the iframe is
  //     clamped to a 9:19.5 phone silhouette regardless of viewport.
  //   · "we must have close small button footer center small and we
  //     dont need see this on desktop Template 1 of 11" · the top
  //     header (gold label + × button) was removed; close now lives
  //     as a small centred pill BELOW the phone silhouette.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${label} large view`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(26, 18, 10, 0.92)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "env(safe-area-inset-top, 0px) 12px env(safe-area-inset-bottom, 0px)",
        boxSizing: "border-box",
      }}
      onClick={onClose}
    >
      <div
        data-nex-template-fullscreen-frame
        onClick={(e) => e.stopPropagation()}
        style={{
          // Phone silhouette clamped to viewport · same 9:19.5 ratio
          // as the picker preview · just bigger.
          width: "min(96vw, calc(86vh * 9 / 19.5))",
          aspectRatio: "9 / 19.5",
          maxHeight: "86vh",
          borderRadius: 32,
          background: PAD_CREAM,
          border: `2px solid ${GOLD}`,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
          position: "relative",
        }}
      >
        <iframe
          src={src}
          title={`${label} large view`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
            background: "transparent",
          }}
        />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close large view"
        data-nex-template-fullscreen-close
        style={{
          padding: "6px 18px",
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: CREAM,
          background: "rgba(5, 15, 28, 0.9)",
          border: `1.5px solid ${GOLD}`,
          borderRadius: 999,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Close
      </button>
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
