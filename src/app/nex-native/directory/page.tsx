// src/app/nex-native/directory/page.tsx
//
// NEX Directory · bare entry · sealed 2026-10-16.
// --------------------------------------------------------------------
// Thin server route that forwards to the shared `LandingDirectoryView`
// for every variant:
//
//   /nex-native/directory              → all-view · seed minted fresh
//   /nex-native/directory?s=xyz        → all-view · stable seed
//   /nex-native/directory?category=xx  → category-filtered (legacy query form)
//   /nex-native/directory?page=2       → paginated
//
// Path-based category routing (`/directory/products`, `/directory/food`,
// …) lives in `./[id]/page.tsx` which intercepts the slug and renders
// the SAME shared view.
//
// Owner directive 2026-10-16 · the previous ~700-line "NEX Directory
// is being prepared" shell (HeroSection + SearchForm + Classification
// Tabs + canonical-only Pagination + PreparingShell + EmptyState) was
// RETIRED. The Phase A LandingDirectoryView is the only render path.
//
// Non-negotiables preserved: no migrations, no DB writes, no changes
// to the sealed `listDirectory` canonical layer (the shared feed
// service `getLandingFeed` consumes `listCanonicalBusinessesPaged` +
// `listBusinessesPaged` read-only).

import type * as React from "react";

import {
  getLandingFeed,
} from "@/lib/nex-native/directory/landing-feed-service";
// Owner directive 2026-10-27 · search Feature A · the directory
// page's existing <input type="search" name="q" /> was decorative ·
// `q` was never read server-side. This import wires the sealed search
// path which calls BOTH searchCanonicalBusinesses + searchBusinesses
// in parallel + ranks results. Only used when the request carries a
// non-empty `q`; the seed-shuffled landing feed is preserved for the
// no-query browse flow.
import {
  getDirectorySearchResults,
  normaliseSearchQuery,
} from "@/lib/nex-native/directory/search-service";
import {
  isLandingCategorySlug,
  type LandingCategorySlug,
} from "@/lib/nex-native/directory/landing-category-mapping";
import { parseIsoAlpha2 } from "@/lib/nex-native/geo/iso-countries";
import { readUserLocationFromAccount } from "@/lib/nex-native/user-location/actions";
import { LandingDirectoryView } from "./_landing-directory-view";
// Owner directive 2026-10-18 · directory header now carries the
// shared ControlDrawer (3-dots) on the right · we resolve the
// signed-in session here so the drawer shows the real identity bar
// and gates the Business Vault row by the Bisnis tier. Null session
// is handled gracefully (anon identity + locked rows per the sealed
// 2026-10-18 drawer-locks directive).
// 2026-11-20 · dev-impersonation parity backfill. The ControlDrawer
// for a dev-impersonated viewer must show the persona identity, not
// anon, so this page's session read must honour the override. Aliased
// to keep the existing call-site unchanged.
import { resolveSessionWithDevOverride as resolveNexAppSessionFromContext } from "@/lib/nex-native/app/dev-impersonation";
import { effectiveTier } from "@/lib/nex-native/account-service";
import type { ControlDrawerSession } from "@/components/nex-native/control-drawer/control-drawer-client";
// Owner directive 2026-10-18 · P1 of the discovery system · the
// directory sort seed now lives in a short-lived cookie so the
// order stays stable while browsing but shuffles after a real
// break. URL `?s=` still takes priority for share-link
// reproducibility.
import { resolveDirectorySeed } from "@/lib/nex-native/directory/directory-seed-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<{
    readonly category?: string;
    readonly country?: string;
    readonly page?: string;
    readonly s?: string;
    /** Owner directive 2026-10-16 · "within N km" distance filter. */
    readonly km?: string;
    /** Owner directive 2026-10-27 · Feature A · free-text search over
     *  canonical + nex_business. Non-empty routes through the sealed
     *  `getDirectorySearchResults`; empty / absent preserves the
     *  seed-shuffled landing feed. */
    readonly q?: string;
  }>;
}

const DEFAULT_COUNTRY = "ID";
const PAGE_SIZE = 24;
const MAX_PAGE = 10_000;
const KM_ALLOWED = new Set<number>([5, 10, 25, 50, 100]);

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt((raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > MAX_PAGE) return MAX_PAGE;
  return n;
}

function parseKm(raw: string | undefined): number | null {
  const n = Number.parseInt((raw ?? "").trim(), 10);
  if (!Number.isFinite(n)) return null;
  return KM_ALLOWED.has(n) ? n : null;
}

export default async function DirectoryPage({
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const sp = await searchParams;

  // Category slug · validated against the sealed allow-list. Unknown
  // slugs collapse to the all-view rather than 404-ing · the bare
  // `/directory` and `/directory?category=garbage` both land here, and
  // the view renders the all-view feed when `landingSlug` is null.
  const rawCategory = typeof sp.category === "string" ? sp.category : null;
  const landingSlug: LandingCategorySlug | null =
    rawCategory !== null && isLandingCategorySlug(rawCategory)
      ? (rawCategory as LandingCategorySlug)
      : null;

  const requestedCountry = parseIsoAlpha2(sp.country);
  const country = requestedCountry ?? DEFAULT_COUNTRY;
  const page = parsePage(sp.page);
  const seedParam = typeof sp.s === "string" ? sp.s : null;
  // Owner directive 2026-10-18 · P1 · the seed now resolves via a
  // 15-min cookie first · URL `?s=` only overrides for share links.
  const seed = await resolveDirectorySeed(seedParam);
  const distanceKm = parseKm(sp.km);

  // Viewer location · null for anonymous visitors or signed-in users
  // who haven't saved a location. The sealed `readUserLocationFromAccount`
  // respects consent · we never geo-IP-infer. When null, the distance
  // filter is implicitly inactive and the FilterSheet shows the
  // "Grant location access" hint instead of the km buttons.
  const viewerLocation = await readUserLocationFromAccount();
  const hasViewerLocation = viewerLocation !== null;

  // Resolve ControlDrawer session · guest-safe. Falls through to null
  // for anonymous visitors; the drawer renders the sealed 2026-10-18
  // anon identity bar + locked rows in that case.
  let drawerSession: ControlDrawerSession | null = null;
  try {
    const sess = await resolveNexAppSessionFromContext();
    if (sess) {
      drawerSession = {
        displayName: sess.account.display_name,
        nexHandle: sess.account.nex_handle,
        isBisnis: effectiveTier(sess.account) === "bisnis",
      };
    }
  } catch {
    // Guest · keep drawerSession = null
  }

  // Owner directive 2026-10-27 · Feature A · when the user submits
  // a non-empty search query via the <input name="q"> we route through
  // the sealed `getDirectorySearchResults` which calls BOTH
  // searchCanonicalBusinesses + searchBusinesses in parallel + ranks
  // results. Empty / absent `q` preserves the seed-shuffled landing
  // feed byte-identically to pre-fix behaviour.
  const rawQuery = typeof sp.q === "string" ? sp.q : null;
  const query = normaliseSearchQuery(rawQuery);
  const feed =
    query.length > 0
      ? await getDirectorySearchResults({
          query,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          country: requestedCountry,
          seed,
        })
      : await getLandingFeed({
          limit: PAGE_SIZE,
          visitorSeed: seed,
          categorySlug: landingSlug,
          country: requestedCountry,
          offset: (page - 1) * PAGE_SIZE,
          maxDistanceKm: hasViewerLocation ? distanceKm : null,
          viewerLat: viewerLocation?.lat ?? null,
          viewerLng: viewerLocation?.lng ?? null,
        });

  return (
    <LandingDirectoryView
      seed={seed}
      category={landingSlug}
      country={country}
      countryFilter={requestedCountry}
      distanceKm={hasViewerLocation ? distanceKm : null}
      hasViewerLocation={hasViewerLocation}
      page={page}
      pageSize={PAGE_SIZE}
      feed={feed}
      drawerSession={drawerSession}
      query={query}
    />
  );
}
