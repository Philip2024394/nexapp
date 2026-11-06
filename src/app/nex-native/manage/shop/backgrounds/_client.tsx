"use client";

// src/app/nex-native/manage/shop/backgrounds/_client.tsx
//
// NEX Shop Backgrounds library · interactive grid.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Mirrors the /chat-themes-library visual: emerald + gold palette ·
// phone-framed · hero header + grid of preset tiles + inline apply.
//
// Each tile shows the background image at a 16:10 aspect ratio with
// a dim overlay + name label. Tapping a tile:
//   1. Calls applyShopPresetBackgroundAction (sealed guardrails ·
//      whitelist on the server) · writes nex_business.shop_cover_
//      image_url.
//   2. Shows an inline "Applied · opening Shop Themes" status pill.
//   3. Redirects to /manage/shop/themes so the owner sees the new
//      background on the template carousel.

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { applyShopPresetBackgroundAction } from "../themes/_actions";

const EMERALD = "var(--nex-world-primary, #123D2B)";
const FOREST = "var(--nex-world-forest, #1B5138)";
const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "#FAF8F4";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "rgba(5, 15, 28, 0.72)";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";

// Keep the catalog colocated here · follow-up batch will move it to
// a shared lib module once the second + third presets ship.
interface ShopBackgroundPreset {
  readonly id: string;
  readonly url: string;
  readonly label: string;
  readonly description: string;
}

const PRESETS: ReadonlyArray<ShopBackgroundPreset> = [
  {
    id: "dynamic-nex-shopping-showcase",
    url: "/nex-brand/shop-themes/dynamic-nex-shopping-showcase.png",
    label: "Dynamic NEX Shopping Showcase",
    description: "Warm retail atmosphere · product-first palette.",
  },
];

interface Props {
  readonly businessId: string | null;
  readonly currentImageUrl: string | null;
}

export function ShopBackgroundsClient({
  businessId,
  currentImageUrl,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [status, setStatus] = React.useState<
    | { kind: "idle" }
    | { kind: "applying"; id: string }
    | { kind: "ok"; id: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  function onPick(preset: ShopBackgroundPreset) {
    if (!businessId) return;
    setStatus({ kind: "applying", id: preset.id });
    startTransition(async () => {
      const result = await applyShopPresetBackgroundAction(
        businessId,
        preset.url,
      );
      if (result.ok) {
        setStatus({ kind: "ok", id: preset.id });
        // Small delay so the owner sees the confirmation pill flip
        // on the tile before the redirect takes them to the themes
        // picker with the new background painted on every template.
        setTimeout(() => {
          router.push("/nex-native/manage/shop/themes");
        }, 650);
      } else {
        setStatus({ kind: "error", message: result.error });
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
      {/* Header · same shape as /chat-themes-library · "back" link,
          big title, small tagline. */}
      <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Link
          href="/nex-native/manage/shop/themes"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            fontSize: 11,
            fontWeight: 700,
            color: GOLD,
            textDecoration: "none",
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
          }}
        >
          ← Shop Themes
        </Link>
      </nav>
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          paddingBottom: 8,
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
          Shop Backgrounds
        </h1>
        <p style={{ margin: 0, fontSize: 12, color: INK_DIM, lineHeight: 1.45 }}>
          Choose a background for your shop · bundled with your subscription · updates every template instantly.
        </p>
      </header>

      {/* Grid · single-column snap-scroll · each tile is a full-
          width 16:10 preview with label underneath · same pattern
          as the chat-themes featured strip. */}
      <section
        aria-label="Shop background presets"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {PRESETS.map((preset) => {
          const isCurrent = currentImageUrl === preset.url;
          const isApplying =
            status.kind === "applying" && status.id === preset.id;
          const isApplied = status.kind === "ok" && status.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPick(preset)}
              disabled={pending || !businessId}
              data-nex-shop-bg-preset-tile={preset.id}
              aria-current={isCurrent ? "true" : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
                padding: 0,
                background: SURFACE,
                border: `2px solid ${
                  isCurrent || isApplied ? GOLD : BORDER
                }`,
                borderRadius: 14,
                cursor: businessId ? "pointer" : "not-allowed",
                color: INK,
                textAlign: "left",
                overflow: "hidden",
                boxShadow:
                  isCurrent || isApplied
                    ? "0 0 0 3px rgba(198, 161, 91, 0.18)"
                    : "none",
                transition:
                  "border-color 160ms ease, box-shadow 160ms ease",
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "16 / 10",
                  background: `url(${preset.url}) center/cover`,
                }}
              >
                {isCurrent ? (
                  <span style={pillStyle}>Current</span>
                ) : isApplied ? (
                  <span style={{ ...pillStyle, background: EMERALD }}>
                    Applied
                  </span>
                ) : isApplying ? (
                  <span style={{ ...pillStyle, background: EMERALD }}>
                    Applying…
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  padding: "10px 12px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800 }}>
                  {preset.label}
                </div>
                <div style={{ fontSize: 11, color: INK_DIM, lineHeight: 1.45 }}>
                  {preset.description}
                </div>
              </div>
            </button>
          );
        })}

        {!businessId ? (
          <div
            style={{
              padding: 14,
              fontSize: 12,
              color: INK_MUTED,
              background: SURFACE,
              border: `1px dashed ${BORDER}`,
              borderRadius: 10,
            }}
          >
            You don&rsquo;t have a shop yet — set one up in{" "}
            <Link
              href="/nex-native/manage/shop"
              style={{ color: GOLD, textDecoration: "underline" }}
            >
              Manage · Shop
            </Link>{" "}
            before picking a background.
          </div>
        ) : null}

        {status.kind === "error" ? (
          <div
            style={{
              padding: 10,
              fontSize: 12,
              color: "#D82A2A",
              background: "rgba(216, 42, 42, 0.08)",
              border: "1px solid rgba(216, 42, 42, 0.35)",
              borderRadius: 10,
            }}
          >
            {status.message}
          </div>
        ) : null}
      </section>

      <footer
        style={{
          marginTop: "auto",
          paddingTop: 10,
          borderTop: `1px solid ${BORDER}`,
          fontSize: 11,
          color: INK_MUTED,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        More backgrounds land here with every seasonal drop · you can also upload your own on <Link href="/nex-native/manage/shop/themes" style={{ color: GOLD }}>Shop Themes</Link>.
      </footer>
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  position: "absolute",
  top: 10,
  left: 10,
  padding: "3px 10px",
  background: "rgba(0,0,0,0.6)",
  color: "#FAF8F4",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  borderRadius: 999,
  border: "1px solid rgba(198,161,91,0.6)",
  backdropFilter: "blur(6px)",
};
