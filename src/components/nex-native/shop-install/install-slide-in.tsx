"use client";

// src/components/nex-native/shop-install/install-slide-in.tsx
//
// NEX branded shop install · sliding notification · owner directive
// 2026-11-27 §B + §C.
// -----------------------------------------------------------------------------
// Right-edge sliding card that appears automatically on first visit
// to a branded shop. Suggested wording from §B (verbatim):
//
//   "Enjoy visiting this shop? Save [Shop Name] to your phone for
//    easy access whenever you want to visit again."
//
// Dismissal state machine (§C, implemented in
// `use-shop-install-flow.ts::useShopInstallDismissal`):
//   · First visit → show.
//   · 1st X → hide. Start 5-minute cooldown anchored to wall-clock,
//     NOT to time-on-shop. Route changes within the same shop do
//     NOT restart the timer. After 5 minutes elapse while still on
//     the shop the slide-in re-appears.
//   · 2nd X → permanent suppression · never shown again on THIS
//     device for THIS shop (until install prefs are reset).
//   · install → permanent suppression · immediate.
//
// Spec §C: per-customer × per-shop. For guests this is localStorage
// only · when the account layer bolts on, the hook already exposes
// `recordInstall` / `recordDismiss` for server reconciliation
// without changing this component.
//
// Mounting contract:
//   · Owner must mount exactly one `<InstallSlideIn>` per storefront
//     page · duplicate mounts would stack animations.
//   · The slide-in reads/writes its own state through the sealed
//     dismissal hook · the mounting page doesn't need to wire any
//     visibility prop.
//   · The component renders null when `shouldShowSlideIn === false`
//     so the DOM stays clean for merchants that have been suppressed.

import * as React from "react";
import { iconColorOn } from "@/app/nex-native/chat-standard/_engine/control-resolver";
import { showActionToast } from "@/components/nex-native/ui/action-toast";
import { NexChatBadge } from "./nex-chat-badge";
import {
  useShopInstallDismissal,
  useShopInstallFlow,
} from "./use-shop-install-flow";

const SEALED_FALLBACK_TINT = "#020914";
const ON_DARK = "#FFFFFF";
const ON_LIGHT = "#0B1220";
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function resolveTint(candidate: string | null): string {
  if (typeof candidate !== "string") return SEALED_FALLBACK_TINT;
  const trimmed = candidate.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed : SEALED_FALLBACK_TINT;
}

export interface InstallSlideInShop {
  readonly slug: string;
  readonly displayName: string;
  readonly logoUrl: string | null;
  readonly tintHex: string | null;
}

export interface InstallSlideInProps {
  readonly shop: InstallSlideInShop;
  /** Optional analytics hook fired when the user accepts install. */
  readonly onInstalled?: (shopSlug: string) => void;
}

/** Owner directive 2026-11-27 §B · auto-appearing right-edge card
 *  that uses the sealed 2-strike / 5-minute dismissal state machine. */
export function InstallSlideIn({
  shop,
  onInstalled,
}: InstallSlideInProps): React.JSX.Element | null {
  const flow = useShopInstallFlow({
    shopSlug: shop.slug,
    onInstalled: (slug) => {
      // Flip the dismissal record immediately on install so §F
      // "repeat launches must preserve installed identity" holds
      // even before the next storefront reload.
      recordInstall();
      onInstalled?.(slug);
    },
  });
  const { shouldShowSlideIn, recordDismiss, recordInstall } =
    useShopInstallDismissal({
      shopSlug: shop.slug,
      isShopInstalled: flow.isShopInstalled,
      isStandalone: flow.isStandalone,
    });

  // A 220 ms slide-in matches the chat-side motion vocabulary.
  const [mounted, setMounted] = React.useState(false);
  const [entered, setEntered] = React.useState(false);

  React.useEffect(() => {
    if (shouldShowSlideIn && flow.state.kind !== "detecting") {
      setMounted(true);
      // Next frame → slide in.
      const id = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(id);
    }
    // Slide out → unmount 220 ms later.
    setEntered(false);
    const timer = window.setTimeout(() => setMounted(false), 220);
    return () => window.clearTimeout(timer);
  }, [shouldShowSlideIn, flow.state.kind]);

  const tint = resolveTint(shop.tintHex);
  const fg = iconColorOn(tint, ON_DARK, ON_LIGHT);

  if (!mounted) return null;

  const handleInstall = async () => {
    if (flow.state.kind === "ios") {
      showActionToast({
        message: `To install ${shop.displayName}, tap Share, then Add to Home Screen.`,
        kind: "info",
        durationMs: 4200,
      });
      return;
    }
    if (flow.state.kind === "chromium" || flow.state.kind === "desktop") {
      const outcome = await flow.trigger();
      if (outcome === "noop") {
        showActionToast({
          message: `To install ${shop.displayName}, open your browser menu and choose Install app.`,
          kind: "info",
          durationMs: 4200,
        });
      }
      return;
    }
    if (flow.state.kind === "android-fallback") {
      showActionToast({
        message: `To install ${shop.displayName}, open your browser menu and choose Install app or Add to Home Screen.`,
        kind: "info",
        durationMs: 4200,
      });
      return;
    }
  };

  const handleDismiss = () => {
    recordDismiss();
  };

  const initial = (shop.displayName || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      role="dialog"
      aria-label={`Save ${shop.displayName} to your phone`}
      data-nex-shop-install-slidein
      data-nex-shop-slug={shop.slug}
      style={{
        position: "fixed",
        right: 12,
        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        // Mobile-first width · caps at 360 px so the card never
        // dominates the screen on a phablet.
        width: "min(360px, calc(100vw - 24px))",
        backgroundColor: tint,
        color: fg,
        borderRadius: 16,
        padding: "14px 14px 14px 12px",
        boxShadow:
          "0 10px 24px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.14)",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        transform: entered ? "translateX(0)" : "translateX(calc(100% + 24px))",
        transition: "transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1)",
        zIndex: 1200,
        willChange: "transform",
      }}
    >
      {/* Shop icon + chat badge overlay · same visual language as the
       *  install button so the two surfaces feel like one feature. */}
      <span
        aria-hidden
        style={{
          position: "relative",
          width: 40,
          height: 40,
          flex: "0 0 auto",
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.14)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: fg,
          marginTop: 2,
        }}
      >
        {shop.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shop.logoUrl}
            alt=""
            width={40}
            height={40}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <span
            style={{
              font: "700 17px/1 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            }}
          >
            {initial}
          </span>
        )}
        <span
          style={{
            position: "absolute",
            right: -4,
            bottom: -4,
            width: 18,
            height: 18,
            borderRadius: 999,
            backgroundColor: tint,
            color: fg,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 0 1.5px ${fg}`,
          }}
        >
          <NexChatBadge size={12} tone="solid" />
        </span>
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "600 14px/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            letterSpacing: 0.1,
          }}
        >
          Enjoy visiting this shop?
        </div>
        <div
          style={{
            marginTop: 4,
            font: "400 13px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            opacity: 0.92,
          }}
        >
          Save {shop.displayName} to your phone for easy access whenever you
          want to visit again.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            type="button"
            onClick={handleInstall}
            data-nex-shop-install-slidein-accept
            style={{
              appearance: "none",
              border: `1px solid ${fg}`,
              background: fg,
              color: tint,
              borderRadius: 999,
              paddingInline: 14,
              height: 34,
              font: "600 13px/1 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Save to phone
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            data-nex-shop-install-slidein-dismiss
            style={{
              appearance: "none",
              border: `1px solid ${fg}`,
              background: "transparent",
              color: fg,
              borderRadius: 999,
              paddingInline: 12,
              height: 34,
              font: "500 13px/1 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Not now
          </button>
        </div>
      </div>

      {/* Dedicated close "X" · the state machine treats this as a
       *  dismissal the same as "Not now", per spec §C — the buttons
       *  are just two affordances for the same action. */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss install prompt"
        data-nex-shop-install-slidein-close
        style={{
          appearance: "none",
          border: "none",
          background: "transparent",
          color: fg,
          width: 28,
          height: 28,
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          marginLeft: 2,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          aria-hidden
          focusable="false"
        >
          <path
            d="M6 6l12 12M18 6l-12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
