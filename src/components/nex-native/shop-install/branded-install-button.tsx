"use client";

// src/components/nex-native/shop-install/branded-install-button.tsx
//
// NEX branded shop install button · owner directive 2026-11-27 §A.
// -----------------------------------------------------------------------------
// The "standard install button per merchant" surface. One rendered per
// storefront · background colour is the merchant's selected cover tint
// (`shop_cover_tint_hex`) · foreground (label + glyph) is picked by the
// auto-contrast helper already used by chat-standard so WCAG AA holds
// against every tint the merchant can choose.
//
// What the spec locks in (§A, uniform design across merchants):
//   · Button shape, size, padding, radius, label template, icon layout
//     and chat-badge overlay are FIXED here. Merchants cannot restyle.
//   · Shop icon on the left · NEX Chat glyph overlaid on the shop icon
//     so the viewer reads "install THIS shop, and you'll get NEX Chat
//     with them". Falls back to a plain shop-initial avatar when the
//     merchant has not uploaded a logo.
//   · Label "Download [Shop Name]" · truncated with ellipsis if the
//     display name is unusually long · the button never grows.
//
// What it hides:
//   · When the shop is already installed (`isShopInstalled`) OR when
//     the current browser is running NEX in standalone PWA mode
//     (`isStandalone`). Spec §F: "Repeat launches must preserve the
//     installed shop's identity" — if we're already in that identity,
//     no need to re-advertise install.
//
// Platform behaviour (mirrors `_install-client.tsx` so the two
// branded surfaces and the sealed global surface never diverge):
//   · chromium / desktop with deferred event → native prompt via
//     `useShopInstallFlow().trigger()`.
//   · ios → action-toast with Share → Add to Home Screen instructions.
//   · android-fallback / desktop without deferred → action-toast
//     pointing at the browser menu. We NEVER claim a prompt will
//     open when the browser hasn't granted us one.
//
// Testing hooks:
//   · `data-nex-shop-install-button` + `data-nex-shop-slug=<slug>` so
//     Playwright can locate the exact instance on a given storefront
//     without relying on label matching (merchant names can repeat
//     across country deployments).
//
// Security / privacy (spec §F):
//   · No merchant data is sent anywhere by this component · it only
//     paints the current shop's logo/tint/name and calls the already-
//     captured browser prompt. The prompt itself is cross-merchant-
//     scoped by the browser (one PWA scope `/nex-native/`), but
//     `start_url` in the dynamic per-shop manifest routes the
//     installed shortcut to the branded surface for THIS shop.

import * as React from "react";
import { iconColorOn } from "@/app/nex-native/chat-standard/_engine/control-resolver";
import { showActionToast } from "@/components/nex-native/ui/action-toast";
import { NexChatBadge } from "./nex-chat-badge";
import { useShopInstallFlow } from "./use-shop-install-flow";

/** Sealed fallback tint · kept in sync with
 *  `src/app/nex-native/[businessSlug]/manifest.webmanifest/route.ts`
 *  and the storefront page's own tint-resolution order. Picked when
 *  the merchant has not chosen a cover tint. */
const SEALED_FALLBACK_TINT = "#020914";

/** Sealed on-tint foreground pair · chat-standard vocabulary. Dark
 *  tints get white foreground · light tints get near-black. */
const ON_DARK = "#FFFFFF";
const ON_LIGHT = "#0B1220";

export interface BrandedInstallButtonShop {
  readonly slug: string;
  readonly displayName: string;
  readonly logoUrl: string | null;
  readonly tintHex: string | null;
}

export interface BrandedInstallButtonProps {
  readonly shop: BrandedInstallButtonShop;
  /** Optional callback fired AFTER a successful install so the
   *  mounting page can record the event in its own analytics /
   *  dismissal co-ordinator. */
  readonly onInstalled?: (shopSlug: string) => void;
  /** When true, the button renders inside a surface that already
   *  provides its own horizontal padding · we skip our outer margin
   *  so the layout doesn't double-pad. */
  readonly inline?: boolean;
}

/** Validates `#RRGGBB` strictly · same regex as the manifest route
 *  and the cover page's tint resolution. Keeps merchants from
 *  injecting named colours, alpha, or `rgb()` strings through the
 *  button's inline style. */
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function resolveTint(candidate: string | null): string {
  if (typeof candidate !== "string") return SEALED_FALLBACK_TINT;
  const trimmed = candidate.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed : SEALED_FALLBACK_TINT;
}

/** Owner directive 2026-11-27 §A · the single branded install button
 *  every storefront paints. Honours already-installed/standalone
 *  state by rendering null (the storefront's own layout stays
 *  compact). */
export function BrandedInstallButton({
  shop,
  onInstalled,
  inline,
}: BrandedInstallButtonProps): React.JSX.Element | null {
  const { state, isShopInstalled, isStandalone, trigger } = useShopInstallFlow({
    shopSlug: shop.slug,
    onInstalled,
  });

  const tint = resolveTint(shop.tintHex);
  const fg = iconColorOn(tint, ON_DARK, ON_LIGHT);

  // Hide entirely when the shop is already installed or we're
  // running inside the installed shortcut. Spec §F.
  if (isShopInstalled || isStandalone) return null;
  // Hide while we're still figuring out the platform so we don't
  // flash a button that then reveals an iOS Share hint.
  if (state.kind === "detecting") return null;

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (state.kind === "ios") {
      showActionToast({
        message: `To install ${shop.displayName}, tap Share, then Add to Home Screen.`,
        kind: "info",
        durationMs: 4200,
      });
      return;
    }
    if (state.kind === "chromium" || state.kind === "desktop") {
      const outcome = await trigger();
      if (outcome === "noop") {
        // Deferred event missing · fall through to the same browser-
        // menu hint android-fallback uses. We do NOT lie that the
        // prompt was opened.
        showActionToast({
          message: `To install ${shop.displayName}, open your browser menu and choose Install app.`,
          kind: "info",
          durationMs: 4200,
        });
      }
      return;
    }
    if (state.kind === "android-fallback") {
      showActionToast({
        message: `To install ${shop.displayName}, open your browser menu and choose Install app or Add to Home Screen.`,
        kind: "info",
        durationMs: 4200,
      });
      return;
    }
    // unsupported · silent · the button shouldn't have rendered but
    // we guard rather than throw.
  };

  const initial = (shop.displayName || "?").trim().charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={handleClick}
      data-nex-shop-install-button
      data-nex-shop-slug={shop.slug}
      aria-label={`Download ${shop.displayName} to your phone`}
      style={{
        // Fixed dimensions · merchants cannot restyle.
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        height: 44,
        paddingInline: 14,
        borderRadius: 12,
        border: "none",
        margin: inline ? 0 : "8px 0",
        backgroundColor: tint,
        color: fg,
        cursor: "pointer",
        font: "600 14px/1 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        letterSpacing: 0.1,
        // Prevent label wrap · ellipsis if the shop name is long.
        maxWidth: "100%",
        whiteSpace: "nowrap",
        boxShadow: "0 1px 2px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Shop icon + NEX Chat badge overlay. Fixed 28px avatar so the
       *  chat badge always lands in the same visual spot. */}
      <span
        aria-hidden
        style={{
          position: "relative",
          width: 28,
          height: 28,
          flex: "0 0 auto",
          borderRadius: 999,
          overflow: "visible",
          backgroundColor: "rgba(255,255,255,0.14)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: fg,
        }}
      >
        {shop.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the
          // storefront page already pre-resolved this URL to a public
          // Supabase storage path · <Image> would add layout cost for
          // a 28px avatar.
          <img
            src={shop.logoUrl}
            alt=""
            width={28}
            height={28}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <span
            style={{
              font: "700 13px/1 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            }}
          >
            {initial}
          </span>
        )}
        {/* NEX Chat badge · bottom-right corner · outline tone on the
         *  logo so it reads against most shop art. The badge adopts
         *  the auto-contrast foreground so dark tints get a white
         *  bubble and light tints get a near-black one. */}
        <span
          style={{
            position: "absolute",
            right: -3,
            bottom: -3,
            width: 14,
            height: 14,
            borderRadius: 999,
            backgroundColor: tint,
            color: fg,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            // Thin ring in the foreground colour so the badge lifts
            // off photographic logos.
            boxShadow: `0 0 0 1.5px ${fg}`,
          }}
        >
          <NexChatBadge size={10} tone="solid" />
        </span>
      </span>

      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        Download {shop.displayName}
      </span>
    </button>
  );
}
