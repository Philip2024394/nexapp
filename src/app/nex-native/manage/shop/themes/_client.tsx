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

      {/* ── Single-pane template picker · arrows + swipe ────── */}
      <TemplateCarousel
        layoutIds={layoutIds}
        layoutLabels={layoutLabels}
        selectedLayout={selectedLayout}
        tintHex={tintHex}
        imageUrl={imageUrl}
        onPick={onPickLayout}
      />

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
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goPrev, goNext]);

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

  return (
    <section aria-label="Template picker" style={{ position: "relative" }}>
      {/* Navigation row · left arrow · template name · right arrow.
          Lives ABOVE the preview so the template render stays
          completely clean (no overlays, no buttons). */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 6,
        }}
      >
        <ArrowButton direction="left" onClick={goPrev} />
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 12,
            fontWeight: 800,
            color: INK,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {layoutLabels[selectedLayout]}
          <span style={{ color: INK_MUTED, marginLeft: 8, fontWeight: 600 }}>
            {index + 1} / {layoutIds.length}
          </span>
        </div>
        <ArrowButton direction="right" onClick={goNext} />
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
            renders inside the carousel. */}
        <iframe
          key={selectedLayout}
          src={`/nex-native/cover/preview/${selectedLayout}?embed=1`}
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
      </div>

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
