// src/app/nex-native/[businessSlug]/manifest.webmanifest/route.ts
//
// Branded per-shop PWA manifest · Phase 1 · owner directive 2026-11-27.
// -----------------------------------------------------------------------------
// Serves a dynamic Web App Manifest per merchant storefront so the
// browser's install prompt binds to THAT merchant's identity (name,
// icon, start_url), while the underlying PWA remains the SINGLE shared
// NEX app. One Next.js app · one service worker · many branded entry
// shortcuts — exactly as the owner directive section E requires:
//
//   "Use the shared NEX application and a merchant-specific
//    installable PWA experience or equivalent supported home-screen
//    shortcut."
//   "Do not create a separate native app or independent backend for
//    every merchant."
//   "The main NEX installation identity must remain distinct from
//    individual merchant shop identities."
//
// Contract (observable):
//   · GET /nex-native/<slug>/manifest.webmanifest
//     → 200 application/manifest+json when the slug resolves to a
//       `nex_business` row.
//     → 404 text/plain when the slug does not resolve.
//   · The manifest JSON has `name` = shop display name,
//     `short_name` = first 30 chars of display name, `start_url`
//     = `/nex-native/<slug>` (so the home-screen shortcut opens
//     directly to that shop), `scope` = `/nex-native/` (shared with
//     the global NEX manifest so the service worker continues to
//     control every storefront), and `icons[0]` = `logo_url` when
//     the merchant has uploaded one, otherwise the shared NEX
//     maskable icon fallback.
//   · The maskable NEX icon is ALWAYS included so install never
//     fails when `logo_url` is missing or the wrong size — the
//     browser picks the best available.
//   · `theme_color` tracks the merchant's selected cover tint
//     (`nex_business.shop_cover_tint_hex`) when set to a well-formed
//     `#RRGGBB` value · falls back to the sealed NEX dark
//     (`#020914`) when the merchant has not chosen a tint. This
//     matches the storefront page's own tint-resolution order
//     (page.tsx `shop_cover_tint_hex` → theme `accent_hex` → gold
//     default) · the install prompt therefore paints the same
//     accent as the shop cover rather than the generic NEX chrome.
//     `background_color` stays on the sealed NEX dark so the
//     launch splash stays legible against every tint.
//   · `prefer_related_applications: false` + no `related_applications`
//     — we are not shipping a native app per shop, only the branded
//     shortcut.
//   · Response is marked `Cache-Control: public, max-age=3600,
//     s-maxage=3600` — one hour · changes to a shop's display name
//     or logo reach the installed shortcut after at most an hour.
//
// What this file does NOT do (Phase 2 / Phase 3 scope):
//   · No install UI. The sliding notification, standard install
//     button, and burger-menu "Download App" row live in their own
//     client components and are wired separately.
//   · No per-customer × per-shop dismissal state. That requires a
//     new `nex_account_shop_install_prefs` table whose migration is
//     drafted alongside this file and is BLOCKED-AT-APPROVAL on
//     sandbox-apply.
//   · No shop theme colour, cover-tint, or dark/light contrast
//     resolution. The reader of this file in Phase 2 should wire
//     those via chatThemeService without breaking the 404 branch.
//   · No multi-size icon generation. The merchant's `logo_url` is
//     emitted at a single size declared `512x512` with `purpose:
//     "any"` and the shared NEX maskable is retained at 512. A
//     dedicated image-resize pass can follow when install
//     telemetry warrants it.
//
// Security / privacy:
//   · Reads `nex_business` via `getBusinessBySlug` (service-role
//     admin client) — same read path the storefront page uses.
//   · No PII in the manifest body. Only public shop identity
//     (display_name, slug, logo_url) which already renders on the
//     unauthenticated storefront page.
//   · No query params, cookies, or headers are read · identical
//     response regardless of viewer.

import { getBusinessBySlug } from "@/lib/nex-native/business-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Default NEX icon fallbacks · match /public/nex.webmanifest shape
// so the installed shortcut always has a working icon even when
// `logo_url` is null or an unsupported format.
const NEX_FALLBACK_ICONS = [
  {
    src: "/icons/icon-maskable-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
] as const;

// Sealed defaults · the background is always the NEX dark so the
// launch splash reads consistently against every merchant tint. The
// theme colour defaults to the same dark and is overridden per-shop
// when `shop_cover_tint_hex` is a well-formed hex.
const NEX_DEFAULT_THEME_COLOR = "#020914";
const NEX_DEFAULT_BACKGROUND_COLOR = "#020914";

/** Strict `#RRGGBB` matcher · same shape used by cover-page tint
 *  resolution (page.tsx:311-317) so the manifest paints the same
 *  accent the storefront already paints. 3-digit hex, named colours,
 *  alpha or `rgb(...)` are rejected as a safety measure — manifests
 *  are cached by the user agent for an hour so a malformed value
 *  could stick and look like a merchant choice. */
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

interface RouteContext {
  params: Promise<{ businessSlug: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { businessSlug } = await params;

  // Guard: empty or malformed slug → 404 rather than crashing the
  // business lookup. We don't try to fuzzy-match.
  if (!businessSlug || typeof businessSlug !== "string") {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  let biz: Awaited<ReturnType<typeof getBusinessBySlug>> = null;
  try {
    biz = await getBusinessBySlug(businessSlug);
  } catch {
    // Service error · fail closed rather than leak. The page.tsx
    // storefront also silently falls back when the row can't be
    // loaded, so the manifest 404 mirrors that behaviour.
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (!biz) {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const displayName =
    typeof biz.display_name === "string" && biz.display_name.trim().length > 0
      ? biz.display_name.trim()
      : "NEX shop";
  const shortName = displayName.slice(0, 30);

  // Icons: owner's logo first (if present), NEX maskable always
  // retained so install never fails on a missing/mis-sized logo.
  const shopIcons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose: string;
  }> = [];
  if (typeof biz.logo_url === "string" && biz.logo_url.length > 0) {
    shopIcons.push({
      src: biz.logo_url,
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    });
  }

  // Per-shop theme colour · inherit the cover tint when the
  // merchant has set a well-formed hex, otherwise fall back to the
  // sealed NEX dark. This matches the storefront page's own tint
  // resolution order and ensures the install prompt, the launch
  // splash, and the home-screen shortcut all reference the same
  // accent a customer already sees on the shop.
  const tintCandidate =
    typeof biz.shop_cover_tint_hex === "string"
      ? biz.shop_cover_tint_hex.trim()
      : "";
  const themeColor = HEX_COLOR_RE.test(tintCandidate)
    ? tintCandidate
    : NEX_DEFAULT_THEME_COLOR;

  const manifest = {
    name: displayName,
    short_name: shortName,
    description: `${displayName} · on NEX`,
    start_url: `/nex-native/${businessSlug}`,
    scope: "/nex-native/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: NEX_DEFAULT_BACKGROUND_COLOR,
    theme_color: themeColor,
    lang: "en-GB",
    dir: "ltr",
    categories: ["shopping"],
    icons: [...shopIcons, ...NEX_FALLBACK_ICONS],
    prefer_related_applications: false,
    related_applications: [] as const,
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
