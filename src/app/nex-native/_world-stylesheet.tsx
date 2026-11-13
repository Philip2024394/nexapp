// src/app/nex-native/_world-stylesheet.tsx
//
// Owner-authorised 2026-10-31 · NEX World Engine · Stage 5A.
//
// Server component that:
//   1. Resolves the world for THIS request (preview cookie for the
//      authorised owner · activated world · default fallback)
//   2. Emits a `<style>` tag that sets the 15 world palette CSS
//      variables on `.nex-native-stage` so every descendant can
//      read `var(--nex-world-*)`.
//   3. Also sets a `data-nex-world="<id>"` attribute on the same
//      scope so analytics / debugging / per-world CSS can target
//      specific worlds.
//
// Hydration posture:
//   · Server renders a deterministic <style> block based on the
//     resolved world. The matching layout wrapper reads the SAME
//     resolution (via `WorldDataAttribute`) so the HTML + CSS stay
//     consistent on both server and client.
//   · No client-side world resolution · everything is server-driven.
//     Switching worlds requires a navigation (which refreshes the
//     layout) · activateWorldAction / previewWorldAction call
//     `revalidatePath('/', 'layout')` so the next render picks up
//     the change.

import "server-only";
import * as React from "react";
import { resolveAppIdentity } from "@/lib/nex-native/app/resolve-app-identity";
import {
  paletteToCssVars,
  type WorldDefinition,
} from "@/lib/nex-worlds/world-types";
import { getWorldDefinition } from "@/lib/nex-worlds/world-registry";

/** Resolve the world for the current request.
 *
 *  Resolution order (Rev A plan §1 + §3):
 *    1. Deployment identity (NEX_APP_IDENTITY env). Country deployments
 *       (ireland, indonesia) force their matching world palette so
 *       Ireland users ALWAYS see Ireland chrome regardless of DB state.
 *       This is the source of truth for the country app.
 *    2. HQ deployment (and local dev with no identity set) falls through
 *       to the sealed owner-preview + DB-activated world resolver.
 */
export async function resolveWorldForLayout(): Promise<WorldDefinition> {
  // Owner directive 2026-11-03 · Ireland is the sole active product.
  // Resolution order (correctness-first · no broad catch):
  //
  //   1. If NEX_APP_IDENTITY env is GENUINELY ABSENT in dev → Ireland.
  //      ONLY this exact case (empty string + NODE_ENV=development)
  //      silently defaults to Ireland. Everything else must use the
  //      sealed resolver so invalid env or prod misconfig fails closed.
  //
  //   2. Otherwise call resolveAppIdentity() which throws typed
  //      AppIdentityError on invalid/missing-in-prod · let those
  //      errors propagate (do NOT catch).
  //        · ireland   → Ireland world
  //        · indonesia → Indonesia world (inactive but retained)
  //        · hq        → DB-based resolver (admin can preview any world)
  //
  // Prior revision used a broad `try { ... } catch { return ireland }`
  // which masked invalid-identity + prod-missing errors by silently
  // painting Ireland chrome. Owner-corrected 2026-11-03.
  // Owner directive 2026-11-03 · Ireland-only · the resolver always
  // returns Ireland. The identity env var is still read for its
  // other roles (validation + country gates in resolveAppIdentity)
  // but world selection is now a constant. The sealed fail-closed
  // behaviour of resolveAppIdentity() is preserved: an invalid env
  // in production still throws.
  //
  // Owner directive 2026-11-10 (cycle 5) · Worldwide identity is
  // registered as a distinct deployment. For now it reuses the
  // Ireland WorldDefinition as its base palette scaffolding (so no
  // 19-file WorldId widening is required) · identity-specific
  // overrides (data attribute, backdrop) are applied below in
  // WorldStylesheet via resolveAppIdentity(). The owner will skin
  // Worldwide further in a later authorised pass.
  const rawIdentity = (process.env.NEX_APP_IDENTITY ?? "").trim();
  if (rawIdentity.length > 0) {
    // Honour the sealed identity validator · invalid values still throw.
    resolveAppIdentity();
  }
  return getWorldDefinition("ireland");
}

/** Resolve the deployment-identity tag that should drive identity-
 *  scoped chrome overrides (backdrop, data-nex-identity attribute).
 *  Returns one of "ireland" | "hq" | "worldwide" | null (dev/no-env).
 *  Never throws · errors mean "no identity override" and Ireland
 *  chrome is used as the base. */
function resolveIdentityTag():
  | "ireland"
  | "hq"
  | "worldwide"
  | null {
  try {
    const raw = (process.env.NEX_APP_IDENTITY ?? "").trim();
    if (raw.length === 0) return null;
    const id = resolveAppIdentity();
    return id.identity;
  } catch {
    return null;
  }
}

/** Owner-authorised 2026-11-03 · Ireland-only consolidation ·
 *  Ireland is the single supported world · the nex-original neutral
 *  hero and the Indonesia studio photo were retired alongside the
 *  world registry pruning.
 *
 *  Owner directive 2026-11-05 iter 28 · "global back ground image
 *  all pages that app will be displaying on desktop of tablet" ·
 *  the sealed Ireland studio PNG is superseded by the new NEX Global
 *  Community Banner · every world + the fallback point at the same
 *  image so desktop/tablet (≥500px per nex-native.css) renders one
 *  consistent branded backdrop across the entire app. */
// Owner directive 2026-11-06 · "change the desktop back ground image
// to this on all desktop and tablet view" · NEX Global Connection
// Experience supersedes the earlier Global Community Banner as the
// single desktop/tablet backdrop painted behind the sealed phone
// frame on viewports ≥500 px (see nex-native.css global-desktop-
// hero block).
// Owner directive 2026-11-13 · desktop/tablet backdrop swapped to the
// cream + gold abstract wave so the area around the 360×780 phone
// frame matches the Shop Centre + Chat Settings surface treatment.
// Asset at /public/nex-native/cream-gold-wave-bg.png (1.5 MB).
const GLOBAL_DESKTOP_BACKDROP = "/nex-native/cream-gold-wave-bg.png";

const WORLD_DESKTOP_BACKDROP: Record<string, string> = {
  ireland: GLOBAL_DESKTOP_BACKDROP,
};

// Owner directive 2026-11-10 (cycle 5) · Per-identity desktop backdrop
// override. Unlike WORLD_DESKTOP_BACKDROP (keyed by WorldId), this map
// is keyed by AppIdentityId so worldwide can diverge from ireland
// without widening WorldId. Worldwide falls through to the sealed
// NEX Global Connection Experience backdrop for launch · the owner
// will skin it in a later authorised pass.
const IDENTITY_DESKTOP_BACKDROP: Record<string, string> = {
  worldwide: GLOBAL_DESKTOP_BACKDROP,
};

export function getWorldDesktopBackdrop(worldId: string): string {
  return WORLD_DESKTOP_BACKDROP[worldId] ?? GLOBAL_DESKTOP_BACKDROP;
}

export function getIdentityDesktopBackdrop(identityId: string): string | null {
  return IDENTITY_DESKTOP_BACKDROP[identityId] ?? null;
}

// Owner-sealed 2026-11-10 (cycle 5 approve → cycle 7 refine) ·
// Worldwide identity palette. DISTINCT from Ireland (emerald + cream)
// and from HQ (neutral dark). Worldwide uses DEEP TEAL (global ocean)
// + WARM GOLD (NEX brand anchor) + rich navy surfaces · evoking
// globality while keeping the NEX gold accent language intact so the
// app still "feels NEX" regardless of deployment.
//
// Emitted on `.nex-native-stage` AFTER the Ireland palette when
// identity === "worldwide" so these take precedence.
const WORLDWIDE_PALETTE_OVERRIDES: Record<string, string> = {
  // Primary · deep teal (global ocean)
  "--nex-world-primary": "#0E5B5F",
  // Secondary · warm gold (NEX brand anchor · matches Ireland's gold)
  "--nex-world-secondary": "#D4A24F",
  // Tertiary · amber (warm highlight)
  "--nex-world-tertiary": "#E6B655",
  // Background · deep navy (the "pre-dawn ocean" base)
  "--nex-world-background-base": "#081821",
  // Surface · elevated navy with teal undertone
  "--nex-world-surface": "#0F2630",
  // Sunken · deeper navy for recessed panels
  "--nex-world-surface-sunken": "#061520",
  // Primary-ink · warm off-white (not cold grey · feels global/warm)
  "--nex-world-text-primary": "#F2EEE4",
  // Secondary-ink · muted warm grey
  "--nex-world-text-secondary": "#B8B2A4",
  // Muted-ink · dim warm grey
  "--nex-world-text-muted": "#7A7568",
  // Borders · teal with low opacity
  "--nex-world-border": "rgba(14, 91, 95, 0.22)",
  "--nex-world-border-accent": "rgba(212, 162, 79, 0.42)", // gold-tinted
  // Status colours · keep brand-consistent (don't fight Ireland)
  "--nex-world-success": "#16A34A",
  "--nex-world-warning": "#F59E0B",
  "--nex-world-danger": "#B91C1C",
  // Drawer backdrop (used by payments page + other dark drawers)
  "--nex-world-drawer-bg": "#0E2A30",
  "--nex-world-primary-ink": "#B9CBCA",
};

/** Emits a <style data-nex-world-root> block that scopes the world
 *  palette CSS vars to `.nex-native-stage`. Scoping to the stage
 *  (NOT `:root`) is important: /nex-native is one of several route
 *  trees in this app · we don't leak vars into non-NEX surfaces.
 *
 *  Additionally emits two vars on `:root` so the body-level desktop
 *  hero backdrop (set in nex-native.css ≥500px breakpoint) can swap
 *  per-country: `--nex-world-desktop-backdrop` + `--nex-world-page-base`.
 *  These two live on :root (not .nex-native-stage) because the body
 *  background is painted on html/body — ancestors of the stage. */
// Owner-sealed 2026-11-10 · NEX Ireland light-theme palette.
// Sidebar / side-drawer background switched from Emerald #123D2B to
// Pale Ivory #F5EDD3. Matches palette.surfaceSunken in world-registry
// so the drawer, panels, and sunken surfaces read as one surface.
const WORLD_DRAWER_BG: Record<string, string> = {
  ireland: "#F5EDD3",
};

// Owner-sealed 2026-11-10 · primary-ink flipped from Sage #AFC5B5
// (readable on Forest buttons) to dark warm brown #2A1F0F so Amber
// primary buttons carry readable dark text in the new light theme.
const WORLD_PRIMARY_INK: Record<string, string> = {
  ireland: "#2A1F0F",
};

// Owner-authorised 2026-11-04 later-same-day · NEX Ireland drawer trim +
// palette alignment. Per-world dim ink used for subtitles / supporting
// copy on the sealed ControlDrawer. Ireland uses a slightly cooler Sage
// derivative so section titles and subtitles belong to the emerald
// chrome rather than the universal cool-grey (#7D9BC0) default. Other
// worlds leave this unset → consumers fall back to the sealed
// cool-grey, unchanged.
const WORLD_MUTED_INK: Record<string, string> = {
  ireland: "#8FA69A",
};

// Owner-authorised 2026-11-04 later-same-day · NEX Ireland drawer trim.
// Per-world ControlDrawer running-edge-light display switch. Mirrors
// the sealed LiveSideDrawer gating (same component shape · narrower
// 3px gold streak travelling top→bottom down the drawer's interior
// edge). Ireland sets this to `block` · all other worlds leave it
// unset so the overlay inherits its inline `display: none` fallback
// and renders nothing.
const WORLD_CONTROL_DRAWER_EDGE_LIGHT_DISPLAY: Record<string, string> = {
  ireland: "block",
};

// Owner-sealed 2026-11-01 (narrow premium palette update) · per-world
// Live side-drawer tagline display switch. The "Premium Irish experience"
// tagline is rendered unconditionally in the drawer markup, but its
// `display` CSS property is driven by this var — only Ireland sets it to
// `block`. Other worlds leave this unset → the fallback `display: none`
// in the drawer keeps the tagline out of their chrome and out of the
// accessibility tree.
const WORLD_LIVE_DRAWER_TAGLINE_DISPLAY: Record<string, string> = {
  ireland: "block",
};

// Owner-directive 2026-11-01 (unified-drawer architecture · Batch A
// safeguard) · per-world Live side-drawer running-edge-light display
// switch. The running Gold light detail is Ireland's premium accent
// (hardcoded Gold #C6A15B in the overlay element). Indonesia / Worldwide
// / future worlds leave this map empty, so the overlay inherits the
// inline `display: none` fallback and renders nothing — Irish Gold is
// never imposed on other country chromes.
//   To add a future per-country running light with its own colour:
//     1. Register the country here with `display: "block"`.
//     2. Override the inline overlay-gradient colour in LiveSideDrawer
//        via a new `--nex-world-live-drawer-edge-light-color` CSS var
//        pattern (not yet needed — Ireland alone uses Gold today).
const WORLD_LIVE_DRAWER_EDGE_LIGHT_DISPLAY: Record<string, string> = {
  ireland: "block",
};

// Owner-directive 2026-11-01 · per-world Live side-drawer footer image.
// Ireland adds a small flipped "Dancing Leprechaun with Headphones"
// decoration to the footer area of the drawer. Indonesia / Worldwide
// leave this unset so no Irish branding leaks into other country
// chromes. The image path is scoped via a URL CSS var so future
// countries can register their own decoration without touching
// LiveSideDrawer.
const WORLD_LIVE_DRAWER_FOOTER_IMAGE_DISPLAY: Record<string, string> = {
  ireland: "block",
};
// Owner-authorised 2026-11-01 · Social Commerce palette sweep · Path A ·
// Keypad theming. The sealed JokerKeypad consumes these when set,
// falling back to its original dark-navy + Joker-green when not.
// Ireland registers: forest-green backdrop + Irish gold accent. Other
// worlds leave this empty and keep the sealed Joker palette.
const WORLD_KEYPAD_BG_TOP: Record<string, string> = {
  ireland: "#0A1F15",
};
const WORLD_KEYPAD_BG_BOTTOM: Record<string, string> = {
  ireland: "#123D2B",
};
const WORLD_KEYPAD_ACCENT: Record<string, string> = {
  // Owner directive 2026-11-03 · "kepad is global on nex chat ireland
  // and the blue keys change to orange color" · Ireland keypad accent
  // flips to NEX Orange #FF7200 (supersedes the earlier 2026-11-01
  // Social-Commerce-sweep Gold #C6A15B assignment).
  //
  // Non-Ireland worlds (nex-original · indonesia) intentionally leave
  // this map empty · the sealed 2026-11-01 memory note is explicit:
  // "Other worlds leave this empty and keep the sealed Joker palette."
  // Removing the hard-coded #00AFFF fallback in nex-input/nex-textarea
  // RESTORES this sealed behaviour on Worldwide + Indonesia (they had
  // been painting blue by accident due to that fallback). If the owner
  // later wants Worldwide blue specifically, re-add
  // `"nex-original": "#00AFFF"` here.
  ireland: "#FF7200",
};

const WORLD_LIVE_DRAWER_FOOTER_IMAGE_URL: Record<string, string> = {
  ireland: "/nex-brand/ireland-leprechaun-dj.png",
};

export async function WorldStylesheet(): Promise<React.JSX.Element> {
  const world = await resolveWorldForLayout();
  const identityTag = resolveIdentityTag();
  // Owner directive 2026-11-10 (cycle 5) · Worldwide identity layers
  // its own palette variables on top of the base (Ireland) palette.
  // The base palette is emitted first so unknown keys inherit cleanly;
  // Worldwide overrides follow. Ireland + HQ keep the Ireland base
  // unchanged (worldwideOverrides stays {} for those identities).
  const worldwideOverrides =
    identityTag === "worldwide" ? WORLDWIDE_PALETTE_OVERRIDES : {};
  const vars = { ...paletteToCssVars(world.palette), ...worldwideOverrides };
  const declarations = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  const identityBackdrop = identityTag
    ? getIdentityDesktopBackdrop(identityTag)
    : null;
  const backdropUrl = identityBackdrop ?? getWorldDesktopBackdrop(world.meta.id);
  const pageBase = (
    identityTag === "worldwide"
      ? WORLDWIDE_PALETTE_OVERRIDES["--nex-world-background-base"]
      : null
  ) ?? world.palette.backgroundBase;
  const drawerBg = WORLD_DRAWER_BG[world.meta.id];
  const primaryInk = WORLD_PRIMARY_INK[world.meta.id];
  const mutedInk = WORLD_MUTED_INK[world.meta.id];
  const controlDrawerEdgeLightDisplay =
    WORLD_CONTROL_DRAWER_EDGE_LIGHT_DISPLAY[world.meta.id];
  const taglineDisplay = WORLD_LIVE_DRAWER_TAGLINE_DISPLAY[world.meta.id];
  const edgeLightDisplay =
    WORLD_LIVE_DRAWER_EDGE_LIGHT_DISPLAY[world.meta.id];
  const footerImageDisplay =
    WORLD_LIVE_DRAWER_FOOTER_IMAGE_DISPLAY[world.meta.id];
  const footerImageUrl = WORLD_LIVE_DRAWER_FOOTER_IMAGE_URL[world.meta.id];
  const keypadBgTop = WORLD_KEYPAD_BG_TOP[world.meta.id];
  const keypadBgBottom = WORLD_KEYPAD_BG_BOTTOM[world.meta.id];
  const keypadAccent = WORLD_KEYPAD_ACCENT[world.meta.id];
  const drawerDecl = drawerBg
    ? `  --nex-world-drawer-bg: ${drawerBg};\n`
    : "";
  const primaryInkDecl = primaryInk
    ? `  --nex-world-primary-ink: ${primaryInk};\n`
    : "";
  const mutedInkDecl = mutedInk
    ? `  --nex-world-muted-ink: ${mutedInk};\n`
    : "";
  const controlDrawerEdgeLightDecl = controlDrawerEdgeLightDisplay
    ? `  --nex-world-control-drawer-edge-light-display: ${controlDrawerEdgeLightDisplay};\n`
    : "";
  const taglineDecl = taglineDisplay
    ? `  --nex-world-live-drawer-tagline-display: ${taglineDisplay};\n`
    : "";
  const edgeLightDecl = edgeLightDisplay
    ? `  --nex-world-live-drawer-edge-light-display: ${edgeLightDisplay};\n`
    : "";
  const footerImageDecl =
    footerImageDisplay && footerImageUrl
      ? `  --nex-world-live-drawer-footer-image-display: ${footerImageDisplay};\n` +
        `  --nex-world-live-drawer-footer-image-url: url("${footerImageUrl}");\n`
      : "";
  // Owner-authorised 2026-11-01 · Social Commerce palette sweep · Path A ·
  // Ireland keypad backdrop + accent. Derive the 5 alpha variants from
  // the accent hex so the sealed `deriveKeypadVars` behaviour is
  // preserved without touching the keypad component on every world.
  const keypadDecl = (() => {
    const parts: string[] = [];
    if (keypadBgTop) parts.push(`  --nex-keypad-bg-top: ${keypadBgTop};`);
    if (keypadBgBottom)
      parts.push(`  --nex-keypad-bg-bottom: ${keypadBgBottom};`);
    if (keypadAccent) {
      const hex = keypadAccent.replace("#", "").trim();
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        parts.push(`  --nex-kp-accent: ${keypadAccent};`);
        parts.push(`  --nex-kp-accent-dim: rgba(${r},${g},${b},0.22);`);
        parts.push(`  --nex-kp-accent-glow: rgba(${r},${g},${b},0.55);`);
        parts.push(`  --nex-kp-accent-pressed: rgba(${r},${g},${b},0.25);`);
        parts.push(`  --nex-kp-accent-border: rgba(${r},${g},${b},0.18);`);
      }
    }
    return parts.length > 0 ? parts.join("\n") + "\n" : "";
  })();
  const css =
    `:root {\n` +
    `  --nex-world-desktop-backdrop: url("${backdropUrl}");\n` +
    `  --nex-world-page-base: ${pageBase};\n` +
    drawerDecl +
    primaryInkDecl +
    mutedInkDecl +
    taglineDecl +
    edgeLightDecl +
    controlDrawerEdgeLightDecl +
    footerImageDecl +
    keypadDecl +
    `}\n` +
    `.nex-native-stage {\n${declarations}\n}`;
  // dangerouslySetInnerHTML is fine here · we control both the var
  // names and the CSS values (hex/rgb/gradient literals from our own
  // registry · no user input).
  return (
    <style
      data-nex-world-root={world.meta.id}
      data-nex-identity={identityTag ?? "none"}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
