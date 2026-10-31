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
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { resolveWorldForRequest } from "@/lib/nex-worlds/world-resolver";
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
  // Deployment identity takes precedence. Fail-closed: if the env is
  // invalid in a country deployment, we do NOT silently fall back to
  // nex-original (that would leak the wrong country chrome). We let the
  // resolver throw and the root layout boundary handles it.
  try {
    const identity = resolveAppIdentity();
    if (identity.identity === "ireland") return getWorldDefinition("ireland");
    if (identity.identity === "indonesia") return getWorldDefinition("indonesia");
    // identity === "hq" · fall through to the DB-based resolver below.
  } catch {
    // Env not set at all in dev · fall through to DB resolver.
  }
  const session = await resolveSessionWithDevOverride();
  const resolved = await resolveWorldForRequest(session?.account.id ?? null);
  return resolved.world;
}

/** Owner-authorised 2026-10-31 (country-preview round) · per-world
 *  desktop/tablet backdrop image. Country deployments paint the
 *  matching studio photo behind the phone frame on ≥500px viewports
 *  (same images as the HQ landing cards). nex-original keeps the
 *  original neutral hero. The map is kept here (not in the registry)
 *  because this file is the only consumer. */
const WORLD_DESKTOP_BACKDROP: Record<string, string> = {
  "nex-original": "/nex-desktop-hero.png",
  ireland: "/nex-brand/hq/ireland-studio.png",
  indonesia: "/nex-brand/hq/indonesia-studio.png",
};

export function getWorldDesktopBackdrop(worldId: string): string {
  return WORLD_DESKTOP_BACKDROP[worldId] ?? "/nex-desktop-hero.png";
}

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
// Owner-sealed 2026-11-01 (updated · narrow premium palette) · per-world
// music/live side-drawer background. Ireland uses Emerald #123D2B
// (supersedes the earlier Irish Green #02AD04 seal from the same date).
// Other worlds leave this unset and fall through to the pre-existing
// drawer bg (var(--nex-world-background-base) with navy fallback), so
// nex-original + Indonesia chrome stays unchanged.
const WORLD_DRAWER_BG: Record<string, string> = {
  ireland: "#123D2B",
};

// Owner-sealed 2026-11-01 (narrow premium palette update) · per-world
// primary-ink colour for button text / primary ink. Ireland uses Sage
// #AFC5B5 so Forest primary buttons get Sage text. This is NOT a
// WorldPalette field — country-scoped by design, so it does not ripple
// across other worlds or require per-palette ink values on Indonesia /
// nex-original. Consumers opt-in with var(--nex-world-primary-ink, <fallback>).
const WORLD_PRIMARY_INK: Record<string, string> = {
  ireland: "#AFC5B5",
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
const WORLD_LIVE_DRAWER_FOOTER_IMAGE_URL: Record<string, string> = {
  ireland: "/nex-brand/ireland-leprechaun-dj.png",
};

export async function WorldStylesheet(): Promise<React.JSX.Element> {
  const world = await resolveWorldForLayout();
  const vars = paletteToCssVars(world.palette);
  const declarations = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  const backdropUrl = getWorldDesktopBackdrop(world.meta.id);
  const pageBase = world.palette.backgroundBase;
  const drawerBg = WORLD_DRAWER_BG[world.meta.id];
  const primaryInk = WORLD_PRIMARY_INK[world.meta.id];
  const taglineDisplay = WORLD_LIVE_DRAWER_TAGLINE_DISPLAY[world.meta.id];
  const edgeLightDisplay =
    WORLD_LIVE_DRAWER_EDGE_LIGHT_DISPLAY[world.meta.id];
  const footerImageDisplay =
    WORLD_LIVE_DRAWER_FOOTER_IMAGE_DISPLAY[world.meta.id];
  const footerImageUrl = WORLD_LIVE_DRAWER_FOOTER_IMAGE_URL[world.meta.id];
  const drawerDecl = drawerBg
    ? `  --nex-world-drawer-bg: ${drawerBg};\n`
    : "";
  const primaryInkDecl = primaryInk
    ? `  --nex-world-primary-ink: ${primaryInk};\n`
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
  const css =
    `:root {\n` +
    `  --nex-world-desktop-backdrop: url("${backdropUrl}");\n` +
    `  --nex-world-page-base: ${pageBase};\n` +
    drawerDecl +
    primaryInkDecl +
    taglineDecl +
    edgeLightDecl +
    footerImageDecl +
    `}\n` +
    `.nex-native-stage {\n${declarations}\n}`;
  // dangerouslySetInnerHTML is fine here · we control both the var
  // names and the CSS values (hex/rgb/gradient literals from our own
  // registry · no user input).
  return (
    <style
      data-nex-world-root={world.meta.id}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
