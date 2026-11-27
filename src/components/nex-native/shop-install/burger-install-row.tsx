"use client";

// src/components/nex-native/shop-install/burger-install-row.tsx
//
// NEX branded shop install · "Download App" burger-menu row · owner
// directive 2026-11-27 §D.
// -----------------------------------------------------------------------------
// §D says: "Add 'Download App' as a FINAL burger-menu item on each
// storefront." This component is that row. It drops into the sealed
// shop burger (`src/app/nex-native/cover/_burger-menu.tsx`) as the
// LAST entry inside the dropdown, keeping the burger file ignorant of
// the install-flow hook's internals.
//
// Behaviour:
//   · Mounted inside the burger's dropdown <nav>. Caller provides
//     `rowStyle` / `labelStyle` / `sublabelStyle` / `iconStyle` /
//     `caretStyle` so the row inherits the sealed dark-glass + gold
//     dropdown vocabulary without this component re-hard-coding it
//     (the burger owns the visual language).
//   · Renders NULL when the shop is already installed on this
//     device OR the current session is running inside the installed
//     PWA. Spec §F "repeat launches must preserve installed
//     identity" — if we're already in that identity, no need to
//     advertise install from the burger.
//   · On click:
//        iOS  → action-toast with Share → Add to Home Screen hint.
//        Chromium / desktop (with deferred) → native prompt.
//        android-fallback / desktop (no deferred) → action-toast
//          with browser-menu hint. We NEVER lie that a prompt opened.
//   · Burger auto-closes on tap (caller passes `onAfterAction`).

import * as React from "react";
import { showActionToast } from "@/components/nex-native/ui/action-toast";
import { useShopInstallFlow } from "./use-shop-install-flow";

export interface BurgerInstallRowProps {
  readonly shopSlug: string;
  readonly shopDisplayName: string;
  /** Sealed dropdown row style · caller supplies the exact
   *  `menuRowStyle(last)` return so this row visually matches the
   *  rest of the burger without us duplicating the gold/ink palette. */
  readonly rowStyle: React.CSSProperties;
  readonly labelStyle: React.CSSProperties;
  readonly sublabelStyle: React.CSSProperties;
  readonly iconStyle: React.CSSProperties;
  readonly caretColor: string;
  /** Fired after the install action has started (prompt opened OR
   *  toast shown) so the burger can close its dropdown. */
  readonly onAfterAction?: () => void;
}

export function BurgerInstallRow({
  shopSlug,
  shopDisplayName,
  rowStyle,
  labelStyle,
  sublabelStyle,
  iconStyle,
  caretColor,
  onAfterAction,
}: BurgerInstallRowProps): React.JSX.Element | null {
  const { state, isShopInstalled, isStandalone, trigger } = useShopInstallFlow({
    shopSlug,
  });

  // Hide when already installed / running in standalone / still
  // figuring out the platform. The burger will render the share row
  // or FAQ row as the last visible item instead — this is per spec
  // (don't advertise install when it's redundant).
  if (isShopInstalled || isStandalone) return null;
  if (state.kind === "detecting") return null;
  if (state.kind === "installed") return null;
  if (state.kind === "unsupported") return null;

  const sublabel =
    state.kind === "ios"
      ? "Tap · then Share → Add to Home Screen"
      : state.kind === "android-fallback" ||
          (state.kind === "desktop" && state.deferred === null)
        ? "Open your browser menu to install"
        : "Save this shop to your home screen";

  const handleClick = async () => {
    if (state.kind === "ios") {
      showActionToast({
        message: `To install ${shopDisplayName}, tap Share, then Add to Home Screen.`,
        kind: "info",
        durationMs: 4200,
      });
      onAfterAction?.();
      return;
    }
    if (state.kind === "chromium" || state.kind === "desktop") {
      const outcome = await trigger();
      if (outcome === "noop") {
        showActionToast({
          message: `To install ${shopDisplayName}, open your browser menu and choose Install app.`,
          kind: "info",
          durationMs: 4200,
        });
      }
      onAfterAction?.();
      return;
    }
    if (state.kind === "android-fallback") {
      showActionToast({
        message: `To install ${shopDisplayName}, open your browser menu and choose Install app or Add to Home Screen.`,
        kind: "info",
        durationMs: 4200,
      });
      onAfterAction?.();
      return;
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      data-nex-shop-install-burger-row
      data-nex-shop-slug={shopSlug}
      style={{ ...rowStyle, borderBottom: "none" }}
    >
      <span style={iconStyle} aria-hidden>
        📲
      </span>
      <span style={{ flex: 1, textAlign: "left" }}>
        <span style={labelStyle}>Download App</span>
        <span style={sublabelStyle}>{sublabel}</span>
      </span>
      <span style={{ color: caretColor, fontSize: 12 }} aria-hidden>
        ›
      </span>
    </button>
  );
}
