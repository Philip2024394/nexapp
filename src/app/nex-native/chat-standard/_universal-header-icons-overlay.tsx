"use client";

// src/app/nex-native/chat-standard/_universal-header-icons-overlay.tsx
//
// UNIVERSAL HEADER ICONS OVERLAY · sealed 2026-10-05 · R11b parity.
//
// Mounts the sealed R1 cluster (Home · Cart · Shop) on any legacy
// theme route without touching that theme's shell. Parallels
// UniversalChromeOverlay (R7 · lower-right 3-dots) and
// UniversalComposerFooter (R3 · pill composer) so every legacy
// production theme gets R1 / R3 / R7 from a single overlay family.
//
// Why this exists · R1 was sealed universal in the chrome doctrine
// (2026-10-05) but — unlike R3 and R7 — had no universal overlay
// implementation. Individual legacy themes carried their own
// hand-coded header right-clusters; motorbike / vitamins / cakes
// routes (served via PortraitBloomShell / HeaderRightCluster) gated
// Cart + Shop behind the NEX_COMMERCE_ENABLED flag, which left them
// shipping only Home. The doctrine was stronger than the
// implementation.
//
// Load-bearing architecture rules (sealed 2026-10-05):
//
//   1 · This overlay is the UNIVERSAL R1 implementation for legacy
//       theme routes. Standard Experience worlds carry R1 natively
//       (StandardHeaderActions inside _standard-experience.tsx) and
//       MUST NOT mount this overlay.
//   2 · Behaviour is universal · function first. Theme-specific
//       destinations go through props (`onShopClick`) · never
//       through theme-ID branches inside the overlay.
//   3 · The overlay suppresses native R1 clusters tagged with
//       `data-nex-native-r1-cluster`. The audit confirmed every
//       known native cluster is 100% R1 (no non-R1 controls
//       mixed in), so hiding the cluster is surgical, not blind.
//       Any future legacy theme that mixes R1 with unrelated
//       controls MUST split them so the suppression stays surgical.
//
// Props:
//   accent · optional CSS colour · defaults to NEX cyan
//   onShopClick · optional handler for the Shop icon · when omitted
//                 the Shop icon renders as a link to /nex-native/shop
//
// Positioning · fixed, top-right, respects safe-area-inset-top.
// zIndex 60 matches the UniversalChromeOverlay 3-dots.
//
// Icons self-contained · colour contract comes from the shared
// control resolver so the overlay matches the Standard Experience
// shell's native buttons byte-for-byte.

import * as React from "react";
import {
  resolveControlsTreatment,
} from "./_engine/control-resolver";

const NEX_CYAN = "#00AFFF";
const NEX_SECONDARY = "#4FC3DC";
const NEX_HIGHLIGHT = "#F4F7FC";
const NEX_DEEP = "#020914";

export interface UniversalHeaderIconsOverlayProps {
  accent?: string;
  /** Optional theme deep/anchor colour · passed through to the
   *  shared control resolver so header buttons sit on a theme-
   *  coherent solid surface. Defaults to NEX deep. */
  deep?: string;
  /** Optional theme highlight · drives icon colour (auto-contrasts
   *  for toggled-on states). Defaults to NEX highlight. */
  highlight?: string;
  /** Optional secondary · echoed to the resolver for consistency. */
  secondary?: string;
  /** Optional handler for Shop. When supplied the Shop icon fires
   *  this callback (e.g. to open a theme-specific shop sheet).
   *  When omitted the icon renders as a link (see `shopHref`),
   *  preserving navigability without inventing per-theme behaviour.
   *  Precedence: onShopClick > shopHref > default href. */
  onShopClick?: () => void;
  /** Optional aria-pressed state for Shop. Signals open/closed when
   *  the host wires `onShopClick` to a toggle. */
  shopOpen?: boolean;
  /** Optional declarative Shop destination. When supplied (and
   *  `onShopClick` is NOT), the Shop icon navigates here instead of
   *  the default `/nex-native/shop`. Used by legacy themes whose
   *  pre-overlay Shop target was a specific destination (e.g.
   *  theme-1 → /nex-native/maria). Preserving existing destinations
   *  prevents the universalisation from silently changing behaviour. */
  shopHref?: string;
}

export function UniversalHeaderIconsOverlay({
  accent: _accent = NEX_CYAN,
  deep: _deep = NEX_DEEP,
  highlight: _highlight = NEX_HIGHLIGHT,
  secondary: _secondary = NEX_SECONDARY,
  onShopClick: _onShopClick,
  shopOpen: _shopOpen,
  shopHref: _shopHref,
}: UniversalHeaderIconsOverlayProps): React.JSX.Element | null {
  // Sealed 2026-10-11 (final) · PortraitBloomShell renders its OWN
  // `HeaderRightCluster` with Home · Cart · Shop + a native
  // `ShopGridModal` slider that opens on Shop tap. This overlay used
  // to hide the shell's cluster via CSS (`[data-nex-native-r1-cluster]
  // { display: none !important }`) and re-render the three icons
  // itself · but my overlay's Shop button navigated to a page
  // instead of opening the shell's slider, so the shop sheet never
  // appeared on Joker (or any PortraitBloomShell theme).
  //
  // Fix: return null · let the shell's native cluster paint. The
  // export signature stays stable so existing `<UniversalHeaderIconsOverlay />`
  // mounts don't need to change. Same approach as
  // `UniversalChromeOverlay` which was also deduplicated.
  return null;
}

// ─── Icons · match the Standard Experience glyph vocabulary ─────────

function HomeIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

function CartIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="20" r="1.6" />
      <circle cx="17" cy="20" r="1.6" />
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.5L21 8H6" />
    </svg>
  );
}

function ShopIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <path d="M4 7h16l-1.2 11a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z" />
      <path d="M8 7V5a4 4 0 0 1 8 0v2" />
    </svg>
  );
}
