"use client";

// src/app/nex-native/manage/shop/themes/_client.tsx
//
// Interactive shell for the Shop Themes picker.
// Owner-authorised 2026-11-06.
//
// Layout (desktop + mobile via a single phone-frame-scoped flex):
//   · Sticky header · "Shop Themes" + current business name.
//   · Template carousel · 11 cover templates · arrow + swipe + dots
//     · 👆 button fullscreens the current template preview.
//   · Choose Background pill · single CTA linking to the dedicated
//     backgrounds library (/manage/shop/backgrounds) which is the
//     sole writer for shop background image URLs. Inline presets +
//     upload were removed 2026-11-06 per owner directive.
//   · Sticky footer · "Apply" writes layout + tint through two
//     sealed server actions and shows an inline confirmation.
//     Background is applied separately from the library page.

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
// Owner directive 2026-11-06 · the inline Background-image section
// (upload + preset carousel) was removed · all background picking
// now flows through /manage/shop/backgrounds, which writes via
// applyShopPresetBackgroundAction and redirects back to this page.
// The actions below are the ones this page still invokes directly.
import { applyShopLayoutAction, applyShopTintAction } from "./_actions";
import type { CoverLayoutId } from "@/app/nex-native/cover/layout-ids";

// Owner directive 2026-11-06 · per-template download baselines ·
// each layout starts at a hand-picked seed count · useFakeDownloads
// ticks the count up every 3 / 16 / 24 hours (random interval per
// template) to look like a steady stream of shop owners activating
// the template · localStorage-scoped so each session's own stream
// feels organic (server-side counts can replace the seed table in
// a follow-up without touching the hook or the UI).
const TEMPLATE_DOWNLOADS_BASE: Readonly<Record<CoverLayoutId, number>> = {
  cafe: 1247,
  cafe_landscape: 892,
  cafe_round: 534,
  product: 2156,
  product_landscape: 1843,
  product_round: 1012,
  product_landscape_round: 678,
  personal_brand: 1489,
  personal_brand_landscape: 923,
  personal_brand_round: 712,
  accommodation: 445,
};

// Fake-but-natural download counter · stores per-key count + next
// bump time in localStorage · randomised intervals [3h · 16h · 24h]
// + randomised increments [1..5] so the number drifts up at a
// human-looking pace instead of ticking like a stopwatch.
function useFakeDownloads(key: string, base: number): number {
  const [count, setCount] = React.useState(base);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = `nex-shop-dl:${key}`;
    const INTERVAL_HOURS = [3, 16, 24] as const;
    const now = Date.now();
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw
        ? (JSON.parse(raw) as { count?: number; nextAt?: number })
        : null;
      const currentCount = parsed?.count ?? base;
      const nextAt = parsed?.nextAt ?? 0;
      if (now >= nextAt) {
        const inc = Math.floor(Math.random() * 5) + 1;
        const intervalH =
          INTERVAL_HOURS[Math.floor(Math.random() * INTERVAL_HOURS.length)]!;
        const newCount = currentCount + inc;
        const newNextAt = now + intervalH * 60 * 60 * 1000;
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ count: newCount, nextAt: newNextAt }),
        );
        setCount(newCount);
      } else {
        setCount(currentCount);
      }
    } catch {
      setCount(base);
    }
  }, [key, base]);
  return count;
}

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
  // Owner directive 2026-11-06 · the inline Background-image section
  // was removed · imageUrl now flows one-way from the server prop
  // (the backgrounds library page is the sole writer · router.push
  // back to this page re-fetches the fresh value).
  const imageUrl = currentImageUrl;
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
          gap: 4,
          paddingBottom: 6,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 900,
            color: GOLD,
            letterSpacing: "-0.01em",
          }}
        >
          Shop Themes
        </h1>
        <p style={{ margin: 0, fontSize: 12, color: INK_DIM, lineHeight: 1.45 }}>
          Copy url and start sharing online and social bio linking · the world is waiting…
        </p>
      </header>

      {/* ── Single-pane template picker · arrows + swipe ────── */}
      <TemplateCarousel
        layoutIds={layoutIds}
        layoutLabels={layoutLabels}
        selectedLayout={selectedLayout}
        tintHex={tintHex}
        imageUrl={imageUrl}
        onPick={onPickLayout}
      />

      {/* Owner directive 2026-11-06 · "remove Accent colour color
          option each theme image we upload we will pick the theme
          color". The explicit colour-picker UI is gone · the tint
          is now derived automatically per background (preset and
          upload both default to emerald for now · follow-up batch
          wires per-preset tint metadata so each preset carries its
          own paired colour). `tintHex` state still flows to the
          Apply action so the persistence chain is unchanged. */}

      {/* ── Activate Shop CTA ─────────────────────────────────
          Owner directive 2026-11-06 · "the button under the phone
          change to Activate Shop". The CTA under the phone is now
          the commit action for the currently-selected template +
          tint (same onApplyAll contract that drove the removed
          sticky footer). Choose-background access is already in
          the header via the solid gold Library button · users
          don't need a second entry point beneath the phone. */}
      <section
        aria-label="Activate shop"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
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
            padding: "12px 24px",
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#1A120A",
            background: GOLD,
            border: "none",
            borderRadius: 999,
            fontFamily: "inherit",
            cursor:
              pending || status.kind === "applying" ? "wait" : "pointer",
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
          <span style={{ fontSize: 11, color: "#D82A2A" }}>
            {status.message}
          </span>
        ) : null}
      </section>

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

/** Single-pane carousel · one template fills the phone-frame-sized
 *  preview. Left + right arrow buttons navigate · swipe gestures
 *  mirror the arrows · dots along the bottom give position + direct
 *  jump · the carousel IS the picker (no separate hero preview). */
function TemplateCarousel({
  layoutIds,
  layoutLabels,
  selectedLayout,
  tintHex,
  imageUrl,
  onPick,
}: {
  layoutIds: readonly CoverLayoutId[];
  layoutLabels: Readonly<Record<CoverLayoutId, string>>;
  selectedLayout: CoverLayoutId;
  tintHex: string;
  imageUrl: string | null;
  onPick: (id: CoverLayoutId) => void;
}) {
  const [fullscreen, setFullscreen] = React.useState(false);
  const index = Math.max(
    0,
    layoutIds.findIndex((id) => id === selectedLayout),
  );
  const last = layoutIds.length - 1;

  const goPrev = React.useCallback(() => {
    const next = index === 0 ? last : index - 1;
    onPick(layoutIds[next]!);
  }, [index, last, layoutIds, onPick]);
  const goNext = React.useCallback(() => {
    const next = index === last ? 0 : index + 1;
    onPick(layoutIds[next]!);
  }, [index, last, layoutIds, onPick]);

  // Keyboard · arrow keys when the preview is focused / hovered.
  // Escape closes the fullscreen overlay when it's open.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape" && fullscreen) setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goPrev, goNext, fullscreen]);

  // Touch swipe · horizontal drag ≥ 40px triggers nav.
  const touchStartX = React.useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const startX = touchStartX.current;
    const endX = e.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (startX == null || endX == null) return;
    const dx = endX - startX;
    if (dx <= -40) goNext();
    else if (dx >= 40) goPrev();
  }

  const downloadsCount = useFakeDownloads(
    `template:${selectedLayout}`,
    TEMPLATE_DOWNLOADS_BASE[selectedLayout] ?? 500,
  );

  return (
    <section aria-label="Template picker" style={{ position: "relative" }}>
      {/* Navigation row · owner directive 2026-11-06 (refined) ·
          ☕ Café label + template icon REMOVED · left slot now shows
          the live download count for the current template (reads as
          "N shops activated this") · Library solid gold button stays
          on the right. Arrows live on the preview tile edges. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 6,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
            color: INK,
          }}
          data-nex-template-downloads={selectedLayout}
        >
          <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>
            📥
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 900,
              color: GOLD,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.02em",
            }}
          >
            {/* Owner-sealed 2026-11-07 · pin locale to en-US so
                server + client agree on thousands separator (server
                in Ireland renders "1.247", browser in en-US renders
                "1,247" · mismatch triggers hydration error). */}
            {downloadsCount.toLocaleString("en-US")}
          </span>
        </div>
        <Link
          href="/nex-native/manage/shop/backgrounds"
          data-nex-template-library
          /* Owner directive 2026-11-06 (refined) · "libary make
             solid button with icon". Solid gold pill with warm ink
             text + magnifier glyph · matches the Choose Background
             CTA pattern on this page so the two libraries read as
             the same primary-action family. */
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 12px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#1A120A",
            background: GOLD,
            textDecoration: "none",
            border: "none",
            borderRadius: 999,
            flexShrink: 0,
          }}
        >
          <span aria-hidden style={{ fontSize: 13 }}>🔍</span>
          Library
        </Link>
      </div>

      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={`Shop template ${layoutLabels[selectedLayout]}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          marginTop: 10,
          position: "relative",
          width: "100%",
          // Match the sealed phone-frame aspect ratio (360 × 780 =
          // 9 : 19.5) so the iframe content fits naturally without
          // vertical scroll.
          aspectRatio: "9 / 19.5",
          borderRadius: 18,
          background: "transparent",
          border: `1px solid ${BORDER_HI}`,
          overflow: "hidden",
          boxShadow: "0 20px 48px rgba(0,0,0,0.55)",
          touchAction: "pan-y",
          boxSizing: "border-box",
        }}
      >
        {/* Real template render · iframes the sealed cover/preview
            /[layoutId]?embed=1 route · ?embed=1 hides the preview's
            own action bar + chrome so only the shop cover itself
            renders inside the carousel. `&bg=<url>` threads the
            owner's chosen preset / uploaded background so it paints
            inside the preview as the template's backdrop. */}
        <iframe
          key={`${selectedLayout}:${imageUrl ?? "none"}:${tintHex}`}
          src={`/nex-native/cover/preview/${selectedLayout}?embed=1${
            imageUrl ? `&bg=${encodeURIComponent(imageUrl)}` : ""
          }${
            /^#[0-9A-Fa-f]{6}$/.test(tintHex)
              ? `&tint=${encodeURIComponent(tintHex)}`
              : ""
          }`}
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

        {/* Owner directive 2026-11-06 (refined) · "remove the yellow
            hand button from screen center". The 👆 fullscreen trigger
            was replaced · double-tap / expand gestures can land on
            the iframe itself in a follow-up if owner wants quick
            fullscreen back. setFullscreen state kept so the overlay
            below can be re-opened from a future trigger without
            rewiring. */}

        {/* Owner directive 2026-11-06 · arrows moved out of the
            header row + onto the tile edges so the header can carry
            the downloads stat + Library button cleanly. */}
        <ArrowButton direction="left" onClick={goPrev} />
        <ArrowButton direction="right" onClick={goNext} />
      </div>

      {/* Fullscreen overlay · portaled to document.body so it escapes
          the sealed phone-frame transform. Shows the template at
          full viewport width + height. */}
      {fullscreen && typeof document !== "undefined"
        ? createPortal(
            <FullscreenTemplate
              layoutId={selectedLayout}
              layoutLabel={layoutLabels[selectedLayout]}
              tintHex={tintHex}
              imageUrl={imageUrl}
              onClose={() => setFullscreen(false)}
            />,
            document.body,
          )
        : null}

      {/* Position dots · tap any to jump directly. */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 6,
          marginTop: 10,
        }}
      >
        {layoutIds.map((id, i) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            aria-label={`Jump to ${layoutLabels[id]}`}
            aria-current={i === index ? "true" : undefined}
            style={{
              width: i === index ? 20 : 6,
              height: 6,
              borderRadius: 999,
              background: i === index ? GOLD : "rgba(198, 161, 91, 0.3)",
              border: "none",
              padding: 0,
              cursor: "pointer",
              transition: "width 160ms ease, background 160ms ease",
            }}
          />
        ))}
      </div>
    </section>
  );
}

/** Fullscreen overlay rendering the template at the full viewport.
 *  Portaled to document.body so `position: fixed` escapes the
 *  sealed phone-frame transform. Close via × button or Escape. */
function FullscreenTemplate({
  layoutId,
  layoutLabel,
  tintHex,
  imageUrl,
  onClose,
}: {
  layoutId: CoverLayoutId;
  layoutLabel: string;
  tintHex: string;
  imageUrl: string | null;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${layoutLabel} template fullscreen`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2, 9, 20, 0.92)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        boxSizing: "border-box",
      }}
    >
      {/* Phone-shaped fullscreen · owner directives 2026-11-06:
          "when i select the view template it should open in the
          phone screen not on desktop screen width" + "reduce the
          phone size on desktop to fit correctly on height".
          Centred in the dim backdrop · phone width now caps at
          340 px (down from 420) and height leaves 48 px of
          breathing room top+bottom so the frame NEVER touches the
          viewport edge even on 720 p laptops. Taps on the dim
          area close. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(340px, calc((100dvh - 48px) * 9 / 19.5))",
          height: "min(calc(100dvh - 48px), calc(340px * 19.5 / 9))",
          aspectRatio: "9 / 19.5",
          borderRadius: 24,
          background: "#020914",
          border: `1px solid ${BORDER_HI}`,
          boxShadow:
            "0 0 0 4px #000, 0 40px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(198,161,91,0.3)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            background: "rgba(0,0,0,0.55)",
            borderBottom: `1px solid ${BORDER_HI}`,
            color: CREAM,
            flexShrink: 0,
            backdropFilter: "blur(10px)",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: GOLD,
            }}
          >
            Template
          </span>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>
            {layoutLabel}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close fullscreen"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "transparent",
              color: CREAM,
              border: `1px solid ${BORDER_HI}`,
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </header>
        <iframe
          key={`fs:${layoutId}:${imageUrl ?? "none"}:${tintHex}`}
          src={`/nex-native/cover/preview/${layoutId}?embed=1${
            imageUrl ? `&bg=${encodeURIComponent(imageUrl)}` : ""
          }${
            /^#[0-9A-Fa-f]{6}$/.test(tintHex)
              ? `&tint=${encodeURIComponent(tintHex)}`
              : ""
          }`}
          title={`${layoutLabel} template fullscreen`}
          style={{
            flex: 1,
            width: "100%",
            height: "100%",
            border: "none",
            background: "transparent",
          }}
        />
      </div>
    </div>
  );
}

function ArrowButton({
  direction,
  onClick,
}: {
  direction: "left" | "right";
  onClick: () => void;
}) {
  const isLeft = direction === "left";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isLeft ? "Previous template" : "Next template"}
      style={{
        position: "absolute",
        top: "50%",
        [isLeft ? "left" : "right"]: 10,
        transform: "translateY(-50%)",
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "rgba(0,0,0,0.55)",
        border: `1px solid ${BORDER_HI}`,
        color: CREAM,
        fontSize: 20,
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        backdropFilter: "blur(6px)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {isLeft ? "‹" : "›"}
    </button>
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
