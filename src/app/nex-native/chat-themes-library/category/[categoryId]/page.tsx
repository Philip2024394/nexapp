// src/app/nex-native/chat-themes-library/category/[categoryId]/page.tsx
//
// Category Showcase Route · Step 1B (sealed 2026-10-06).
// NEX App Chrome Rule applied 2026-10-11 · supersedes the earlier
// Universal Theme Colour Rule for THIS wrapper surface.
//
// Shows every World belonging to a given category. Reuses the
// existing `ThemeBrowserClient` so the world-level presentation /
// preview / handoff behaviour is byte-identical to the current
// Library · this route is navigation + filtering, not a second
// renderer.
//
// URL shape:
//
//   /nex-native/chat-themes-library/category/[categoryId]
//
// Behaviour:
//
//   · categoryId is a registered id → render the category's name /
//     tagline / icon header + the filtered ThemeBrowserClient
//   · categoryId is not registered → notFound() (404)
//   · category has zero worlds → render the header + an empty-state
//     message instead of the grid
//
// Architectural guards (regression-tested):
//
//   · Zero per-category UI branches · the route's rendering is a
//     pure function of the ThemeCategory + filtered worlds array ·
//     the guard regex in `_category-grid.test.ts` enforces that no
//     surface compares a category id against a specific string
//     literal.
//   · Preserves the universal theme handoff `themePreviewHref(id)`
//     because the filtered worlds flow into the SAME
//     ThemeBrowserClient that already uses it
//   · Does NOT reintroduce any iframe grid or allowlist pattern
//   · Does NOT touch _standard-experience.tsx, Theme Engine, Theme
//     Brain, DB schema, or any Step 2 / Step 3 territory
//   · NEX APP CHROME RULE (sealed 2026-10-11 · founder-flipped):
//     wrapper surfaces here (page bg · back-link · header · tagline ·
//     empty-state card) use the NEX app palette · NEVER category
//     tints (no red Haunted bg · no brown Food bg · no sand
//     Accommodation bg). The category identity still shows through
//     the icon + name + tagline text; the SURROUNDING chrome stays
//     NEX navy / cyan / off-white so the theme library feels like
//     one coherent app surface. The theme CONTENT inside
//     ThemeBrowserClient still paints each world in its own palette.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory } from "@/lib/nex-native/theme-category/registry";
import {
  loadLibraryData,
} from "../../_load-library-data";
import { loadLibraryDataAsGuest } from "../../_load-library-data-guest";
import { ThemeBrowserClient } from "../../_theme-browser-client";
import { updateChatThemeAction } from "../../../_actions";
import { NexPageHeader } from "../../../_page-header";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CategoryShowcasePage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const category = getCategory(categoryId);
  if (!category) notFound();

  // Sealed 2026-10-11 · guest-mode branch · mirrors the landing
  // page (`chat-themes-library/page.tsx`) which already supports
  // guests via `loadLibraryDataAsGuest()`. Before this branch,
  // every guest tap on a category tile hard-redirected to
  // /sign-in · the user perceived it as "themes disappear when I
  // navigate back to the themes page". Fix: load guest data +
  // supply sensible defaults for the auth-dependent fields that
  // `ThemeBrowserClient` consumes.
  const viewer = await resolveNexAppSessionOrGuest();
  const isGuest = viewer.kind === "guest";

  const session = isGuest ? null : await loadLibraryData();
  const guest = isGuest ? await loadLibraryDataAsGuest() : null;

  // When the session loader returns `unauthenticated` (e.g. an
  // expired session but the account resolver thought we had one),
  // fall through to the guest loader rather than redirecting ·
  // keeps navigation smooth and avoids the sign-in bounce.
  const browserThemes = isGuest
    ? guest!.browserThemes
    : session!.kind === "ok"
      ? session!.browserThemes
      : (await loadLibraryDataAsGuest()).browserThemes;
  const currentThemeId =
    !isGuest && session!.kind === "ok" ? session!.currentThemeId : "default";
  const canUsePremium =
    !isGuest && session!.kind === "ok" ? session!.canUsePremium : false;
  const viewerAvatarUrl =
    !isGuest && session!.kind === "ok" ? session!.viewerAvatarUrl : null;
  const usePhoneTiles = isGuest
    ? guest!.usePhoneTiles
    : session!.kind === "ok"
      ? session!.usePhoneTiles
      : true;
  const useImmersivePreview = isGuest
    ? guest!.useImmersivePreview
    : session!.kind === "ok"
      ? session!.useImmersivePreview
      : true;

  // Pure filter · no per-category logic · the showcase renders
  // whatever worlds the merged collection currently assigns to this
  // category_id. Zero-member categories render an empty-state copy.
  const worlds = browserThemes.filter((t) => t.category_id === category.id);

  // NEX App Chrome Rule · the wrapper atmosphere is NEX navy / cyan /
  // off-white on every category · the room no longer takes its
  // chrome colours from the category palette. Category identity now
  // lives only in the icon + name + tagline + the per-world cards
  // inside ThemeBrowserClient (which still paints each world in its
  // own palette). Founder-sealed 2026-10-11.
  const palette = {
    deep: "#020914",       // NEX navy · page background
    highlight: "#F4F7FC",  // NEX off-white · body text
    primary: "#00AFFF",    // NEX cyan · accent / icon rim
    secondary: "#8BA9D1",  // NEX gray · dim / tagline / back-link
  };
  const bg = palette.deep;
  const text = palette.highlight;
  const accent = palette.primary;
  const dim = palette.secondary;

  return (
    <>
      <style>{`
        html, body { background: ${bg} !important; }
      `}</style>
      <main
        data-nex-category-page
        data-nex-category-id={category.id}
        style={{
          minHeight: "100dvh",
          background: bg,
          color: text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "20px 16px 40px",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-theme" />

          <Link
            href="/nex-native/chat-themes-library"
            prefetch={false}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 10,
              fontSize: 11,
              color: dim,
              textDecoration: "none",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            ← All categories
          </Link>

          <h1
            data-nex-category-header
            data-nex-category-id={category.id}
            style={{
              margin: "14px 0 6px",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: text,
            }}
          >
            {category.icon && (
              <span aria-hidden style={{ fontSize: 28, lineHeight: 1 }}>
                {category.icon}
              </span>
            )}
            {category.name}
          </h1>
          {category.tagline && (
            <p
              style={{
                margin: "0 0 18px",
                fontSize: 13,
                color: dim,
                lineHeight: 1.55,
              }}
            >
              {category.tagline}
            </p>
          )}

          {worlds.length === 0 ? (
            <div
              data-nex-category-empty
              style={{
                marginTop: 20,
                padding: "28px 20px",
                borderRadius: 14,
                // Empty-state card uses a tinted-dark fill derived
                // from the theme accent · never generic NEX blue.
                background: bg,
                border: `1px solid ${accent}`,
                textAlign: "center",
                color: dim,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              No worlds in this category yet.
            </div>
          ) : (
            <ThemeBrowserClient
              themes={worlds}
              currentThemeId={currentThemeId}
              canUsePremium={canUsePremium}
              activateAction={updateChatThemeAction}
              viewerAvatarUrl={viewerAvatarUrl}
              usePhoneTiles={usePhoneTiles}
              useImmersivePreview={useImmersivePreview}
            />
          )}
        </div>
      </main>
    </>
  );
}
