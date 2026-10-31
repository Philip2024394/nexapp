"use client";

// src/app/nex-native/cover-themes-library/edit/[layoutId]/_edit-client.tsx
//
// NEX Shop Face Cover · Edit client · owner-authorised 2026-10-20.
// -----------------------------------------------------------------------------
// Two editors + a reset. Reads initial state server-side (via page.tsx)
// and shows an in-page preview iframe of the sealed /cover/preview
// surface at the current layoutId, repainted on each save.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CoverLayoutId } from "../../../cover/layout-ids";
import type { ShopCoverActionResult, ApplyAndContinueResult } from "./_actions";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "rgba(3, 16, 29, 0.72)",
  panelBorder: "rgba(0, 175, 255, 0.28)",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  orange: "#FF7200",
  danger: "#F46A6A",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/* Owner directive 2026-10-20 · scaling math mirrors MiniPhoneFrame:
   native 390×844 iframe scaled down to a 260px-wide tile with the
   derived proportional height. One source of truth for phone-tile
   math across the preview + edit surfaces. */
const NATIVE_PHONE_WIDTH = 390;
const NATIVE_PHONE_HEIGHT = 844;
// Owner directive 2026-10-20 · reduced 30% from 260 → 182.
const PREVIEW_TILE_WIDTH = 182;
const PREVIEW_SCALE = PREVIEW_TILE_WIDTH / NATIVE_PHONE_WIDTH;
const PREVIEW_TILE_HEIGHT = Math.round(NATIVE_PHONE_HEIGHT * PREVIEW_SCALE);

/** Owner directive 2026-10-20 · 8 preset swatches · Purple + Dark Blue
 *  retired (owner directive 2026-10-20 · "remove purple and only 1 blue
 *  color"). Kept Cyan as the sole blue · it's the sealed NEX brand
 *  blue used across every other identity surface. The custom-colour
 *  tile below the stack still lets the user pick ANY #RRGGBB. */
const PRESET_SWATCHES: ReadonlyArray<{ hex: string; label: string }> = [
  { hex: "#FF7200", label: "Orange" },
  { hex: "#00AFFF", label: "Cyan" },
  { hex: "#1EC77A", label: "Green" },
  { hex: "#F46A6A", label: "Red" },
  { hex: "#8B1A1A", label: "Dark Red" },
  { hex: "#FFC94A", label: "Amber" },
  { hex: "#FF4FBF", label: "Pink" },
  { hex: "#FFFFFF", label: "White" },
];

export interface EditShopCoverClientProps {
  readonly layoutId: CoverLayoutId;
  readonly templateNumber: string;
  readonly templateName: string;
  readonly businessId: string;
  readonly businessSlug: string;
  readonly initialImageUrl: string | null;
  readonly initialTintHex: string | null;
  /** Owner directive 2026-10-20 · preview iframe paints under THIS
   *  theme id (viewer's chat_theme) so the editor shows the user's
   *  current chat theme (e.g. crispy-chicken) rather than the
   *  cover-preview surface's internal pink-dream default. Null =
   *  omit ?theme= · preview uses its own fallback. */
  readonly viewerChatThemeId: string | null;
  /** Owner directive 2026-10-20 · the viewer's chat-theme wallpaper
   *  URL · painted inside the sealed NexPingBadge in the header left.
   *  Null = badge falls back to the "NEX" wordmark. */
  readonly viewerChatThemeImageUrl: string | null;
  /** Owner directive 2026-10-20 · shared ControlDrawer session · the
   *  3-dots trigger in the header right opens the sealed drawer. */
  readonly drawerSession: ControlDrawerSession;
  readonly uploadImageAction: (
    formData: FormData,
  ) => Promise<ShopCoverActionResult>;
  readonly updateTintAction: (
    formData: FormData,
  ) => Promise<ShopCoverActionResult>;
  readonly resetAction: () => Promise<ShopCoverActionResult>;
  /** Owner directive 2026-10-20 · Bisnis setup flow · persists the
   *  selected cover_layout_id and returns the next href to navigate
   *  to (/themes/<chat-theme>?shop=open). */
  readonly applyAndContinueAction: (
    formData: FormData,
  ) => Promise<ApplyAndContinueResult>;
}

export function EditShopCoverClient(props: EditShopCoverClientProps): React.JSX.Element {
  const [imageUrl, setImageUrl] = React.useState<string | null>(
    props.initialImageUrl,
  );
  const [tintHex, setTintHex] = React.useState<string | null>(props.initialTintHex);
  const [pending, setPending] = React.useState<null | "upload" | "tint" | "reset">(null);
  const [error, setError] = React.useState<string | null>(null);
  /* Owner directive 2026-10-20 · cache-bust token · initialised to 0
     (stable between server-render and client-hydrate · fixes the
     reported hydration mismatch where Date.now() differed by a few
     ms). Save handlers push Date.now() client-side to force the
     iframe to repaint on new overrides. Initial iframe load doesn't
     need a bust · it's a fresh fetch. */
  const [previewBust, setPreviewBust] = React.useState<number>(0);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = React.useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.currentTarget.files?.[0];
      ev.currentTarget.value = "";
      if (!file) return;
      setError(null);
      setPending("upload");
      try {
        const fd = new FormData();
        fd.append("file", file);
        const r = await props.uploadImageAction(fd);
        if (!r.ok) {
          setError(r.error ?? "Upload failed.");
          return;
        }
        setImageUrl(r.imageUrl ?? null);
        setPreviewBust(Date.now());
      } finally {
        setPending(null);
      }
    },
    [props],
  );

  const onPickColour = React.useCallback(
    async (hex: string) => {
      setError(null);
      /* Owner directive 2026-10-20 · optimistic colour pick · the
         preview iframe reads tintHex via the ?tint= query param, so
         updating state FIRST (before the server round-trip) repaints
         the shop template instantly on the user's screen. The DB
         save then persists the choice to nex_business.shop_cover_
         tint_hex for the real /{slug} shop face cover.
         If the save fails (e.g. migration 212 not applied yet) the
         UI error banner surfaces the reason BUT the preview keeps
         the optimistic colour so the user still sees what their
         choice looks like. */
      setTintHex(hex);
      setPreviewBust(Date.now());
      setPending("tint");
      try {
        const fd = new FormData();
        fd.append("hex", hex);
        const r = await props.updateTintAction(fd);
        if (!r.ok) {
          setError(r.error ?? "Save failed · the preview shows your pick but it's not saved yet.");
        }
      } finally {
        setPending(null);
      }
    },
    [props],
  );

  const router = useRouter();
  const onApplyAndContinue = React.useCallback(async () => {
    setError(null);
    setPending("tint"); // reuse pending state to lock buttons
    try {
      const fd = new FormData();
      fd.append("layoutId", props.layoutId);
      const r = await props.applyAndContinueAction(fd);
      if (!r.ok || !r.nextHref) {
        setError(r.error ?? "Apply failed.");
        return;
      }
      router.push(r.nextHref);
    } finally {
      setPending(null);
    }
  }, [props, router]);

  const onReset = React.useCallback(async () => {
    setError(null);
    setPending("reset");
    try {
      const r = await props.resetAction();
      if (!r.ok) {
        setError(r.error ?? "Reset failed.");
        return;
      }
      setImageUrl(null);
      setTintHex(null);
      setPreviewBust(Date.now());
    } finally {
      setPending(null);
    }
  }, [props]);

  // Preview iframe · cache-busted so it repaints after each save.
  // Owner directive 2026-10-20 · forwards:
  //   ?theme=<viewer chat_theme>   · base theme (e.g. crispy-chicken)
  //   ?tint=<hex>                  · live colour override preview
  //   ?bg=<url>                    · live background image override
  // So the preview reflects the user's picks instantly without a DB
  // round-trip. The real /{slug} shop face cover still reads
  // persisted overrides from nex_business.
  const themeParam = props.viewerChatThemeId
    ? `&theme=${encodeURIComponent(props.viewerChatThemeId)}`
    : "";
  const tintParam = tintHex ? `&tint=${encodeURIComponent(tintHex)}` : "";
  const bgParam = imageUrl ? `&bg=${encodeURIComponent(imageUrl)}` : "";
  const previewHref = `/nex-native/cover/preview/${props.layoutId}?embed=1&v=${previewBust}${themeParam}${tintParam}${bgParam}`;

  return (
    <main
      data-nex-edit-shop-cover
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        padding: "24px 16px 40px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Owner directive 2026-10-20 · identity-row header · NexPingBadge
          on the left (paints the viewer's chat theme wallpaper · same
          image shown on every NEX identity surface) + ControlDrawer
          3-dots on the right. Title block sits below the identity row
          running the full width. */}
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 4,
        }}
      >
        <div
          data-nex-edit-shop-cover-identity-row
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <NexPingBadge
            size={56}
            accent={NEX.cyan}
            dataTestId="edit-shop-cover-nex"
            avatarUrl={props.viewerChatThemeImageUrl}
          />
          <div style={{ flex: 1 }} />
          <ControlDrawer session={props.drawerSession} />
        </div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: tintHex ?? NEX.cyan,
            fontWeight: 700,
          }}
        >
          Edit · Template {props.templateNumber}
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.01em",
          }}
        >
          {props.templateName}
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 12.5,
            color: NEX.textDim,
            lineHeight: 1.45,
          }}
        >
          Pick a colour and replace the background image. Changes
          apply to your <strong>shop page only</strong> at{" "}
          <code>/{props.businessSlug}</code> ·{" "}
          <span style={{ color: NEX.textMute }}>
            your chat background is not affected.
          </span>
        </p>
      </header>

      {/* Preview + colour swatches · owner directive 2026-10-20 ·
          side-by-side row · preview on the left (same sealed tile
          dimensions · MiniPhoneFrame scaling math) + vertical colour
          swatch column on the right. One tap on a swatch repaints
          the preview instantly via the ?tint= query param. */}
      <section
        aria-label="Preview and theme colour"
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 14,
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        <div
          aria-label="Preview"
          style={{
            position: "relative",
            width: PREVIEW_TILE_WIDTH,
            height: PREVIEW_TILE_HEIGHT,
            borderRadius: 18,
            overflow: "hidden",
            background: "#000",
            border: `1px solid ${NEX.panelBorder}`,
            boxShadow: "0 10px 24px -8px rgba(0,0,0,0.7)",
            flexShrink: 0,
          }}
        >
          <iframe
            src={previewHref}
            title="Shop cover preview"
            loading="lazy"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: NATIVE_PHONE_WIDTH,
              height: NATIVE_PHONE_HEIGHT,
              border: 0,
              transform: `scale(${PREVIEW_SCALE})`,
              transformOrigin: "top left",
              backgroundColor: "#000",
            }}
            data-nex-edit-shop-cover-preview
          />
        </div>
        <div
          aria-label="Theme colour swatches"
          data-nex-edit-shop-cover-swatch-column
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 9.5,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.textDim,
              fontWeight: 800,
              marginBottom: 2,
            }}
          >
            Colour
          </span>
          {PRESET_SWATCHES.map((s) => {
            const picked = tintHex === s.hex;
            return (
              <button
                key={s.hex}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPickColour(s.hex)}
                aria-label={`Set ${s.label}`}
                aria-pressed={picked}
                disabled={pending !== null}
                data-nex-edit-shop-cover-swatch
                data-nex-edit-shop-cover-swatch-picked={picked ? "true" : "false"}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: s.hex,
                  border: picked
                    ? `2px solid ${NEX.text}`
                    : `1px solid rgba(255,255,255,0.14)`,
                  boxShadow: picked ? `0 0 0 2px ${s.hex}66` : "none",
                  cursor: pending === null ? "pointer" : "not-allowed",
                  padding: 0,
                }}
              />
            );
          })}
          {/* Owner directive 2026-10-20 · custom colour picker · native
              <input type="color"> opens the OS palette so the user can
              pick ANY hex when none of the 10 preset tiles fit. Styled
              as a 30×30 rainbow-gradient tile matching the preset
              swatch size. */}
          <label
            data-nex-edit-shop-cover-custom-swatch
            aria-label="Pick a custom colour"
            title="Pick a custom colour"
            style={{
              position: "relative",
              width: 30,
              height: 30,
              borderRadius: 8,
              background:
                "conic-gradient(from 0deg, #ff0000, #ff8a00, #ffe600, #1eff00, #00ffe0, #0051ff, #a800ff, #ff00c3, #ff0000)",
              border:
                tintHex &&
                !PRESET_SWATCHES.some((s) => s.hex === tintHex)
                  ? `2px solid ${NEX.text}`
                  : `1px solid rgba(255,255,255,0.14)`,
              cursor: pending === null ? "pointer" : "not-allowed",
              overflow: "hidden",
              display: "block",
            }}
          >
            <input
              type="color"
              value={tintHex ?? "#FF7200"}
              onChange={(e) => {
                const next = e.currentTarget.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(next)) {
                  void onPickColour(next.toUpperCase());
                }
              }}
              disabled={pending !== null}
              aria-label="Custom colour"
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0,
                border: 0,
                padding: 0,
                cursor: pending === null ? "pointer" : "not-allowed",
              }}
            />
          </label>
        </div>
      </section>
      {/* Current-override caption under the preview row */}
      <div
        style={{
          fontSize: 11,
          color: NEX.textMute,
          textAlign: "center",
          marginTop: -4,
        }}
      >
        {tintHex ? (
          <>
            Current colour:{" "}
            <code style={{ color: tintHex }}>{tintHex}</code>
          </>
        ) : (
          <>Using theme default · tap a swatch to override.</>
        )}
      </div>

      {/* Background image uploader */}
      <section
        aria-label="Shop background image"
        style={{
          padding: 14,
          borderRadius: 14,
          background: NEX.panel,
          border: `1px solid ${NEX.panelBorder}`,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: NEX.textDim,
            }}
          >
            Shop background image · shop only
          </span>
          <span style={{ fontSize: 11, color: NEX.textMute }}>
            PNG · JPG · WebP · max 5MB. Replaces the theme wallpaper
            on your shop page. Your chat theme background does NOT
            change.
          </span>
        </div>
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt=""
            style={{
              width: "100%",
              maxHeight: 160,
              objectFit: "cover",
              borderRadius: 10,
              border: `1px solid ${NEX.panelBorder}`,
            }}
          />
        ) : (
          <div
            style={{
              padding: "20px 12px",
              borderRadius: 10,
              border: `1px dashed ${NEX.panelBorder}`,
              textAlign: "center",
              fontSize: 11,
              color: NEX.textMute,
            }}
          >
            Using theme wallpaper · upload one to override.
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={onFileChange}
          data-nex-edit-shop-cover-file-input
        />
        <button
          type="button"
          onClick={onPickFile}
          disabled={pending !== null}
          data-nex-edit-shop-cover-upload-btn
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "none",
            background: pending === "upload" ? NEX.textMute : NEX.cyan,
            color: "#021424",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.04em",
            cursor: pending === null ? "pointer" : "default",
            fontFamily: SANS,
          }}
        >
          {pending === "upload" ? "Uploading…" : "Upload new image"}
        </button>
      </section>

      {/* Error banner */}
      {error ? (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(244, 106, 106, 0.12)",
            border: `1px solid ${NEX.danger}`,
            color: NEX.danger,
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Owner directive 2026-10-20 · Apply + continue · persists the
          selected cover layout to nex_business.cover_layout_id, then
          redirects to the user's live chat theme preview with the
          sealed shop chooser auto-opened. Primary CTA · full-width
          above the Back + Reset row. */}
      <button
        type="button"
        onClick={onApplyAndContinue}
        disabled={pending !== null}
        data-nex-edit-shop-cover-apply
        style={{
          marginTop: "auto",
          padding: "14px 18px",
          borderRadius: 12,
          border: "none",
          background: NEX.cyan,
          color: "#021424",
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: "0.04em",
          cursor: pending === null ? "pointer" : "default",
          fontFamily: SANS,
          boxShadow:
            "0 10px 24px -8px rgba(0,175,255,0.6), 0 0 24px rgba(0,175,255,0.3)",
        }}
      >
        {pending === "tint"
          ? "Working…"
          : "Apply + continue →"}
      </button>

      {/* Footer · Reset + Back */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <Link
          href="/nex-native/cover-themes-library"
          data-nex-edit-shop-cover-back
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "14px 16px",
            borderRadius: 12,
            background: "transparent",
            border: `1.5px solid ${NEX.cyan}`,
            color: NEX.cyan,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textDecoration: "none",
            fontFamily: SANS,
          }}
        >
          Back to library
        </Link>
        <button
          type="button"
          onClick={onReset}
          disabled={
            pending !== null || (imageUrl === null && tintHex === null)
          }
          data-nex-edit-shop-cover-reset
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            border: "none",
            background:
              imageUrl === null && tintHex === null
                ? "rgba(255,255,255,0.06)"
                : NEX.danger,
            color:
              imageUrl === null && tintHex === null ? NEX.textMute : "#1A0404",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.04em",
            cursor:
              pending !== null || (imageUrl === null && tintHex === null)
                ? "default"
                : "pointer",
            fontFamily: SANS,
          }}
        >
          {pending === "reset" ? "Resetting…" : "Reset to default"}
        </button>
      </section>
    </main>
  );
}
