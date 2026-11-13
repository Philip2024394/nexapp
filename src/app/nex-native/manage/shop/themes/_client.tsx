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
import { useRouter } from "next/navigation";
import {
  applyShopLayoutAction,
  applyShopPresetBackgroundAction,
  applyShopTintAction,
} from "./_actions";
import { SuggestedTintChip } from "./_suggested-tint-chip";
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

// Owner directive 2026-11-12 · default picker backdrop swapped to the
// sealed NEX Golden Holiday Shopping Scene. Used ONLY when the user
// hasn't picked their own cover image yet · once they have one
// (currentImageUrl), the picker previews ON THEIR IMAGE so what they
// see in the picker matches their real shop. Written to disk only
// (public/nex-native/shop-themes-default-bg.png) · never persisted to
// the DB. The prior cream canvas lives at /nex-native/shop-themes-bg.png
// in case a future surface wants the neutral canvas back.
const DEFAULT_PREVIEW_BG = "/nex-native/shop-themes-default-bg.png";

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
  // Owner directive 2026-11-12 · if the user has already picked their
  // own shop background (currentImageUrl set), preview templates ON
  // THEIR IMAGE so what they see here matches the real public shop.
  // Only when they haven't picked one yet does the sealed Golden
  // Holiday default (DEFAULT_PREVIEW_BG) paint behind the templates.
  // Supersedes the 2026-11-07 "ALWAYS default" rule.
  const previewImageUrl = currentImageUrl ?? DEFAULT_PREVIEW_BG;
  // Owner directive 2026-11-09 revision 2 · default tint updated to
  // the sealed NEX gold (#C6A15B) to pair with the new emerald e-
  // commerce background. The previous default #123D2B dark-emerald was
  // picked for the cream canvas · against the green image it blended
  // in and read as muddy brown. Gold contrasts cleanly against both
  // the green hero + the image's warm-toned products. Owner-saved
  // tints (currentTintHex) still override this default on their own
  // shop · this is only the first-paint default in the picker.
  const tintHex = currentTintHex ?? "#C6A15B";
  const [status, setStatus] = React.useState<
    | { kind: "idle" }
    | { kind: "applying" }
    | { kind: "ok"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [pending, startTransition] = React.useTransition();
  // Owner directive 2026-11-12 · after "Select template" lands, the
  // owner is auto-advanced to /manage/shop/backgrounds to pick a
  // background · the backgrounds page then redirects back here so the
  // composed preview (template + background + tint) renders in the
  // live iframe. This closes the flow:
  //   themes → backgrounds → themes (with composed preview) → done.
  const router = useRouter();
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
        message: "Template saved · choose your background next.",
      });
      // Owner directive 2026-11-12 · auto-advance to the shop
      // background library (chat-themes-style tile grid) so the
      // owner picks their cover image next. The backgrounds page
      // writes the pick + redirects back here · the live preview
      // then composes template + background + tint. router.push is
      // used instead of a server-side redirect because the action
      // completes inside startTransition (client context).
      router.push("/nex-native/manage/shop/backgrounds");
    });
  }

  const previewSrc = buildPreviewSrc(selectedLayout, previewImageUrl, tintHex);

  // ─── Zero-white-screen loading state ────────────────────────
  // Owner directive 2026-11-07 "NEX WORLD STANDARD — FULL-SCREEN
  // SHOP TEMPLATE PREVIEW & ZERO-WHITE-SCREEN LOADING". Single
  // iframe (no key remount) + branded emerald overlay that covers
  // the iframe until onLoad fires for the current previewSrc. 12s
  // safety timeout surfaces a retry prompt rather than letting the
  // spinner run forever.
  const [loadedSrc, setLoadedSrc] = React.useState<string | null>(null);
  const [loadTimeoutFor, setLoadTimeoutFor] = React.useState<string | null>(null);
  const loading = loadedSrc !== previewSrc;
  const timedOut = loadTimeoutFor === previewSrc;

  React.useEffect(() => {
    if (!loading) return;
    setLoadTimeoutFor(null);
    const handle = window.setTimeout(() => {
      setLoadTimeoutFor(previewSrc);
    }, 12000);
    return () => window.clearTimeout(handle);
  }, [previewSrc, loading]);

  function onIframeLoad() {
    setLoadedSrc(previewSrc);
    setLoadTimeoutFor(null);
  }

  function retryPreviewLoad() {
    // Force-rebust the src with a cache-bust so stuck 3rd-party
    // chunks don't pin us to a broken state.
    setLoadedSrc(null);
    setLoadTimeoutFor(null);
    // No state change needed on previewSrc · the iframe's onLoad
    // handler re-fires when the src is set again · we nudge it
    // by resetting loadedSrc above so loading === true again.
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
        {/* Owner directive 2026-11-12 (second pass) · "Shop Template"
            heading repainted BLACK (was gray). Owner wanted it to
            read as a clear anchor, not a muted subhead. */}
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 900,
            color: "#000000",
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
            color: "#9A9A9A",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginTop: 2,
          }}
        >
          Model Template - #1
        </span>
      </header>

      {/* Owner directive 2026-11-07 · "no undo white outside phone -
          inside phone background color cream off white". The outer
          cream pad was removed · the off-white now sits INSIDE the
          phone silhouette as the interior backdrop (so transparent
          areas of the template render show cream through). Page
          chrome stays on the sealed dark Ireland NEX_BG. */}

      {/* Owner directive 2026-11-12 (fourth pass) · "View large
          screen" chip lives ABOVE the phone silhouette · centred row
          outside the phone frame · supersedes the earlier overlay
          placement inside the silhouette. */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 6,
        }}
      >
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          data-nex-template-fullscreen
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#1A120A",
            background: "#FFD600",
            border: "1px solid #E6B800",
            borderRadius: 999,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>⤢</span>
          View large screen
        </button>
      </div>

      {/* ── PHONE FRAME LIVE PREVIEW ─────────────────────────────
          Sealed 9:19.5 silhouette · narrow max-width keeps the frame
          tall + phone-shaped. Interior bg is off-white (PAD_CREAM)
          per owner 2026-11-07. */}
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
          // Owner directive 2026-11-09 (revision 2) · background image
          // fills the FULL WIDTH of the silhouette · `100% 100%` size
          // stretches to fit both axes so no side bars and no vertical
          // crop · aspect ratio of image may distort slightly, that's
          // intentional per owner request. Solid gold rim all round.
          // Owner directive 2026-11-12 · silhouette backdrop swapped
          // to the new sealed shop-themes-default-bg.png and now
          // displays FULL HEIGHT (background-size: cover + center
          // position · overflow is already hidden on the parent so
          // horizontal overflow is cropped cleanly). The prior
          // `100% 100%` size distorted the image on non-9:19.5
          // ratios; `cover` preserves aspect.
          background: `url('${DEFAULT_PREVIEW_BG}') center / cover no-repeat`,
          border: `2px solid ${GOLD}`,
          overflow: "hidden",
          // Owner directive 2026-11-12 · drop shadow removed so the
          // phone silhouette sits on the page without a darker pool
          // beneath it · page is now one consistent colour top to
          // bottom.
          boxShadow: "none",
          boxSizing: "border-box",
        }}
      >
        <iframe
          src={previewSrc}
          title={`Template ${layoutIndex + 1} of ${totalLayouts} preview`}
          loading="eager"
          onLoad={onIframeLoad}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
            background: "transparent",
          }}
        />
        <TemplateLoadingOverlay
          visible={loading}
          templateNumber={layoutIndex + 1}
          timedOut={timedOut}
          onRetry={retryPreviewLoad}
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
        {/* Owner directive 2026-11-12 · scroll-hint track + thumb now
            inherit the current theme tint (`tintHex`) instead of the
            hard-coded Ireland gold. Supersedes the 2026-11-07 gold
            seal · the moving bar reads as part of the chosen theme's
            palette so changing the tint colour changes the hint. */}
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
            background: `${tintHex}38`,
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
              background: tintHex,
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
        {/* Owner directive 2026-11-12 · counter text repainted gray
            so the eye reads the orange arrow pills first and the
            template number as the secondary label. */}
        <span
          data-nex-template-counter
          style={{
            fontSize: 14,
            fontWeight: 900,
            color: "#9A9A9A",
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

      {/* Owner directive 2026-11-12 · SuggestedTintChip removed.
          The tint is auto-picked server-side in
          applyShopPresetBackgroundAction (paired tint in
          PRESET_BACKGROUND_META), so there's no need to ask the
          owner to confirm. The chip + its client-side extractor
          component stay on disk but unmounted. */}

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
        {/* Owner directive 2026-11-12 · Select template CTA repainted
            NEX Orange with white ink + a soft orange glow. Matches
            the other primary CTAs in the signup flow (Activate on
            profile edit · Yes I'm in on /welcome/shop-offer). */}
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
            color: "#FFFFFF",
            background: "#FF7200",
            border: "none",
            borderRadius: 999,
            fontFamily: "inherit",
            cursor: pending || status.kind === "applying" ? "wait" : "pointer",
            boxShadow:
              "0 4px 14px rgba(255, 114, 0, 0.45), 0 0 20px rgba(255, 114, 0, 0.25)",
          }}
        >
          {status.kind === "applying"
            ? "Selecting…"
            : status.kind === "ok"
              ? "Template selected ✓"
              : status.kind === "error"
                ? "Retry"
                : "Select template"}
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
              templateNumber={layoutIndex + 1}
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
        // Owner directive 2026-11-12 (third pass) · prev/next buttons
        // repainted as filled black circles with a white glyph ·
        // supersedes the plain-text glyph pass earlier the same day.
        width: 40,
        height: 40,
        borderRadius: 999,
        background: "#000000",
        border: "none",
        color: "#FFFFFF",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        fontSize: 16,
        fontWeight: 900,
        lineHeight: 1,
        fontFamily: "inherit",
        padding: 0,
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.45)",
      }}
    >
      {direction === "left" ? "◀" : "▶"}
    </button>
  );
}

// NEX World Standard · zero-white-screen loading overlay for every
// template preview surface (picker + full-screen). Emerald fill
// with centred ring spinner + "Loading Template N" copy · fades
// out over 240ms when the iframe below reports onLoad for the
// current src · surfaces a "Try again" prompt after a 12s stall
// timeout rather than running the spinner forever.
function TemplateLoadingOverlay({
  visible,
  templateNumber,
  timedOut,
  onRetry,
}: {
  visible: boolean;
  templateNumber: number;
  timedOut: boolean;
  onRetry: () => void;
}): React.JSX.Element {
  // Owner directive 2026-11-12 · delay state is a plain white page
  // with a small circular spinner · no gold trim, no uppercase badge,
  // no "Loading Template N" chrome. Timeout branch keeps the retry
  // affordance but on the same white surface.
  return (
    <div
      aria-live="polite"
      aria-busy={visible}
      data-nex-template-loading-overlay
      style={{
        position: "absolute",
        inset: 0,
        background: "#FFFFFF",
        color: "#1A1512",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        opacity: visible ? 1 : 0,
        transition: "opacity 240ms ease-out",
        pointerEvents: visible ? "auto" : "none",
        zIndex: 5,
        borderRadius: "inherit",
      }}
    >
      {timedOut ? (
        <>
          <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>⚠️</span>
          <div
            style={{
              textAlign: "center",
              padding: "0 16px",
              fontSize: 12,
              fontWeight: 600,
              color: "#1A1512",
              lineHeight: 1.45,
            }}
          >
            Template {templateNumber} is taking longer than usual.<br />
            Check your connection and try again.
          </div>
          <button
            type="button"
            onClick={onRetry}
            style={{
              padding: "8px 20px",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#FFFFFF",
              background: "#FF7200",
              border: "none",
              borderRadius: 999,
              cursor: "pointer",
              fontFamily: "inherit",
              marginTop: 4,
              boxShadow:
                "0 4px 14px rgba(255, 114, 0, 0.45), 0 0 20px rgba(255, 114, 0, 0.25)",
            }}
          >
            Try again
          </button>
        </>
      ) : (
        <>
          {/* Owner directive 2026-11-12 · nicer loading animation ·
              layered spinner · outer soft ring rotates slow, inner
              orange ring counter-rotates fast, centre dot pulses.
              Reads as "NEX preparing your view" without being busy. */}
          <div
            data-nex-template-spinner
            aria-hidden
            aria-label="Preparing your shop preview"
            style={{
              position: "relative",
              width: 56,
              height: 56,
            }}
          >
            {/* Outer ring · slow · soft gray */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 999,
                border: "3px solid rgba(26, 21, 18, 0.10)",
                borderTopColor: "rgba(26, 21, 18, 0.45)",
                animation: "nexTplSpinA 1400ms linear infinite",
              }}
            />
            {/* Inner ring · counter-rotating · orange accent */}
            <div
              style={{
                position: "absolute",
                inset: 8,
                borderRadius: 999,
                border: "2.5px solid rgba(255, 114, 0, 0.14)",
                borderBottomColor: "#FF7200",
                animation: "nexTplSpinB 900ms linear infinite",
              }}
            />
            {/* Centre dot · gentle pulse */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 6,
                height: 6,
                marginTop: -3,
                marginLeft: -3,
                borderRadius: 999,
                background: "#FF7200",
                boxShadow: "0 0 10px rgba(255, 114, 0, 0.55)",
                animation: "nexTplPulse 1600ms ease-in-out infinite",
              }}
            />
          </div>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(26, 21, 18, 0.55)",
            }}
          >
            Preparing your shop preview
          </p>
        </>
      )}
      <style>{`
        @keyframes nexTplSpinA {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes nexTplSpinB {
          0%   { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes nexTplPulse {
          0%, 100% { transform: scale(1);   opacity: 1;   }
          50%      { transform: scale(1.6); opacity: 0.5; }
        }
        @keyframes nexTemplateSpin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-template-spinner] > div {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function FullscreenTemplate({
  src,
  templateNumber,
  onClose,
}: {
  src: string;
  templateNumber: number;
  onClose: () => void;
}) {
  // Zero-white-screen guarantee · same single-iframe + branded
  // emerald overlay pattern the picker uses. 12s safety timeout
  // falls back to a retry prompt rather than infinite spinner.
  const [loadedSrc, setLoadedSrc] = React.useState<string | null>(null);
  const [timedOutFor, setTimedOutFor] = React.useState<string | null>(null);
  const loading = loadedSrc !== src;
  const timedOut = timedOutFor === src;
  React.useEffect(() => {
    if (!loading) return;
    setTimedOutFor(null);
    const handle = window.setTimeout(() => setTimedOutFor(src), 12000);
    return () => window.clearTimeout(handle);
  }, [src, loading]);
  function retry() {
    setLoadedSrc(null);
    setTimedOutFor(null);
  }
  // Owner directive 2026-11-07 (three refinements):
  //   · "view large screen must stay inside the phone screen size of
  //     phone . not open desktop of tablet size" · the iframe is
  //     clamped to a 9:19.5 phone silhouette regardless of viewport.
  //   · "we must have close small button footer center small and we
  //     dont need see this on desktop Template 1 of 11" · the top
  //     header (label + × button) was removed.
  //   · "how does the user view on mobile screen if the button close
  //     is outside the phone screen" · the Close pill now floats
  //     INSIDE the phone silhouette at its bottom-centre so it is
  //     always visible, never clipped below the mobile fold.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Template ${templateNumber} large view`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(26, 18, 10, 0.92)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
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
          // as the picker preview · just bigger. Owner directive
          // 2026-11-09 revision 2 · background image fills FULL WIDTH
          // via `100% 100%` size · solid gold rim all around.
          width: "min(96vw, calc(96vh * 9 / 19.5))",
          aspectRatio: "9 / 19.5",
          maxHeight: "96vh",
          borderRadius: 32,
          // Owner directive 2026-11-12 · silhouette backdrop swapped
          // to the new sealed shop-themes-default-bg.png and now
          // displays FULL HEIGHT (background-size: cover + center
          // position · overflow is already hidden on the parent so
          // horizontal overflow is cropped cleanly). The prior
          // `100% 100%` size distorted the image on non-9:19.5
          // ratios; `cover` preserves aspect.
          background: `url('${DEFAULT_PREVIEW_BG}') center / cover no-repeat`,
          border: `2px solid ${GOLD}`,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
          position: "relative",
        }}
      >
        <iframe
          src={src}
          title={`Template ${templateNumber} large view`}
          loading="eager"
          onLoad={() => setLoadedSrc(src)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
            background: "transparent",
          }}
        />
        <TemplateLoadingOverlay
          visible={loading}
          templateNumber={templateNumber}
          timedOut={timedOut}
          onRetry={retry}
        />
        {/* Close pill floats INSIDE the phone's bottom-centre so it
            stays visible on short mobile viewports where a
            below-the-phone button would be clipped. Semi-opaque dark
            fill sits on the template content without obscuring it. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close large view"
          data-nex-template-fullscreen-close
          style={{
            position: "absolute",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "6px 18px",
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            // Owner directive 2026-11-12 · large-view close chip now
            // paints NEX Yellow with a dark-brown ink + subtle gold
            // border · matches the "⤢ View large screen" open chip so
            // the pair reads as a single toggle in the sealed yellow
            // palette. Supersedes the dark-navy/translucent pill +
            // cream ink used on 2026-11-07.
            color: "#1A120A",
            background: "#FFD600",
            border: "1px solid #E6B800",
            borderRadius: 999,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 4px 14px rgba(0,0,0,0.55)",
          }}
        >
          Close
        </button>
      </div>
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
