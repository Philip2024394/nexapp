// src/app/nex-native/search/page.tsx
//
// NEX Discover · the shop + menu finder that replaces NEX Directory
// as the live search surface (founder directive 2026-10-13).
// -----------------------------------------------------------------
// Lists NEX users who have a shop or menu on NEX Chat. The entry
// point is a HARD location gate: if the viewer declines, they are
// redirected to /nex-native/home (see _hard-location-gate.tsx).
//
// Visual language matches the "Neon European Food Discovery App"
// mockup supplied by the founder (dark navy, orange CTAs, rounded
// cards, chip row, "View menu" + "Chat with owner" per card).
//
// Data:
//   · Default feed · listRandomBusinesses(20) · newest 300 shuffled
//   · Query mode  · searchBusinesses(q, 20) when ?q= present
//   · Category    · filtered to one NEX_BUSINESS_CATEGORIES id
//   · Distance    · haversine when viewer has saved location AND
//                   business row has location_lat/location_lng
//
// Each card:
//   · logo_url thumbnail (null → initials tile)
//   · display_name + friendly business-category label + city
//   · distance (km, rounded 1 dp) when both sides have coords
//   · short description preview (max 1 line)
//   · "View menu" → /nex-native/{slug} (existing shop landing)
//   · "Chat with owner" → /nex-native/chat/peer/{owner_account_id}

import Link from "next/link";
import type { CSSProperties } from "react";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { readUserLocationFromAccount } from "@/lib/nex-native/user-location/actions";
import * as discoveryService from "@/lib/nex-native/discovery-service";
import * as localDirectory from "@/lib/nex-native/local-directory-service";
import { NEX_BUSINESS_CATEGORIES } from "@/lib/nex-native/site-templates";
import type { NexBusinessRow } from "@/lib/nex-native/types";
import { NexPageHeader } from "../_page-header";
import { HardLocationGate } from "./_hard-location-gate";
import { DiscoverControls } from "./_discover-controls";
import { CountrySelector, type CountryOption } from "./_country-selector";
import { ShopCard } from "./_shop-card";
import { fetchDiscoverCardContext } from "@/lib/nex-native/discover-card-context";
import {
  parseSavedLocation,
  type SavedLocation,
} from "@/lib/nex-native/user-location/types";
import {
  flagEmojiForIso,
  countryNameForIso,
} from "@/lib/nex-native/user-location/country-labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  surface: "#07152A",
  panel: "#0A1B36",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#8BA9D1",
  textSoft: "#6B82A5",
  orange: "#FF7200",
  orangeSoft: "rgba(255,114,0,0.4)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.4)",
  cyanFaint: "rgba(0,175,255,0.1)",
  border: "rgba(255,255,255,0.1)",
  borderSoft: "rgba(255,255,255,0.06)",
};

// Chip row dropped 2026-10-13 per founder direction · the "Viewing
// <city>, <country>" line + the country-flag badge in the search
// field replace the Nearby/Restaurant/Café/Bakery/Salon/Fitness
// chips. Category filtering now happens via the search query itself
// (the directory-service query matches entity_type synonyms:
// "restaurant" / "cafe" / "hotel" / "service" all route to the right
// vertical in local-directory-service).

const CATEGORY_FOOD_LIKE = new Set([
  "restaurant",
  "cafe",
  "bakery",
  "ice-cream",
  "dessert-shop",
  "drinks-shop",
  "juice-bar",
]);

/** ISO 3166-1 alpha-2 → human country name. Falls back to the ISO
 *  itself when unknown, so a country we didn't name is still
 *  rendered as "GB" / "US" rather than left blank. */
function countryDisplayName(iso: string): string {
  const u = iso.toUpperCase();
  const map: Record<string, string> = {
    ID: "Indonesia",
    GB: "United Kingdom",
    US: "United States",
    AU: "Australia",
    NZ: "New Zealand",
    DE: "Germany",
    FR: "France",
    ES: "Spain",
    IT: "Italy",
    NL: "Netherlands",
    BE: "Belgium",
    CH: "Switzerland",
    AT: "Austria",
    DK: "Denmark",
    SE: "Sweden",
    NO: "Norway",
    IE: "Ireland",
    LU: "Luxembourg",
    PT: "Portugal",
    JP: "Japan",
    KR: "South Korea",
    SG: "Singapore",
    MY: "Malaysia",
    TH: "Thailand",
    VN: "Vietnam",
    PH: "Philippines",
    IN: "India",
    AE: "United Arab Emirates",
    CA: "Canada",
  };
  return map[u] ?? u;
}

function categoryLabel(id: string | null): string {
  if (id === null) return "Shop";
  // Humanize the id (hyphens → spaces, title-case).
  return id
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function categoryKind(id: string | null): string {
  if (id === null) return "Shop";
  if (CATEGORY_FOOD_LIKE.has(id)) return "Restaurant";
  return "Service";
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const PAGE_SIZE = 24;

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    lat?: string;
    lng?: string;
    city?: string;
    country?: string;
    page?: string;
    /** Explicit seed overrides the session-anchored default so a URL
     *  shared with another user shows the same order. Must be 1-64
     *  chars; longer values are ignored and the daily default is used. */
    seed?: string;
    /** `?dev_promos=1` overlays fixture promos on the first 6 cards
     *  so the founder can preview promo bubbles live before migration
     *  159 is applied. Dev-only · clearly labelled "DEMO" in each
     *  fixture title · no production effect. */
    dev_promos?: string;
  }>;
}

// Dev-only · deterministic fixture promos used when ?dev_promos=1.
// Clearly branded "DEMO" so there's no mistaking these for real
// owner-created promos. Overlaid on the first 6 cards of the page
// in a rotating 1/2/3-slot pattern so the user can see all layout
// variants (1 bubble, 2 bubbles, 3 bubbles).

/** Inline SVG data URI · TRANSPARENT circle art with big centered
 *  CRIMSON "N%". No stroke · the frosted-glass bubble behind it
 *  tints the backdrop dark enough that solid crimson reads cleanly.
 *  A subtle drop-shadow filter adds a touch of depth without adding
 *  a competing outline. */
function makeDiscountPromoSvg(_hue: number, percent: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>
    <defs>
      <filter id='sh' x='-20%' y='-20%' width='140%' height='140%'>
        <feDropShadow dx='0' dy='1' stdDeviation='1.2' flood-color='rgba(0,0,0,0.55)'/>
      </filter>
    </defs>
    <text x='60' y='60' text-anchor='middle' dominant-baseline='central' font-size='46' font-weight='900' fill='#E11D48' filter='url(#sh)' font-family='Inter, system-ui, -apple-system, sans-serif' letter-spacing='-1'>${percent}%</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const DEV_PROMO_FIXTURES: ReadonlyArray<{
  readonly id: string;
  readonly position: 1 | 2 | 3;
  readonly title: string;
  readonly description: string;
  readonly backgroundHex: string;
  readonly imageUrl: string;
  readonly hoursToExpiry: number;
}> = [
  {
    id: "demo-1",
    position: 1,
    title: "DEMO · 20% off today",
    description:
      "20% off your first order via NEX chat. Mention this promo at checkout. Dine-in or takeaway, no minimum spend.",
    backgroundHex: "#FF7200",
    imageUrl: makeDiscountPromoSvg(22, 20),
    hoursToExpiry: 22,
  },
  {
    id: "demo-2",
    position: 2,
    title: "DEMO · 15% off this week",
    description:
      "15% off any main dish, Monday to Thursday. Dine-in only. Limited slots per evening.",
    backgroundHex: "#00AFFF",
    imageUrl: makeDiscountPromoSvg(205, 15),
    hoursToExpiry: 72,
  },
  {
    id: "demo-3",
    position: 3,
    title: "DEMO · 30% off weekend brunch",
    description:
      "30% off the weekend brunch set · coffee and juice included. Reserve ahead via chat.",
    backgroundHex: "#16D66B",
    imageUrl: makeDiscountPromoSvg(140, 30),
    hoursToExpiry: 168,
  },
];

function fixturePromoFor(
  position: 1 | 2 | 3,
  bid: string,
): import("@/lib/nex-native/discover-card-context").DiscoverCardPromo {
  const seed = DEV_PROMO_FIXTURES[position - 1];
  const expiresAt = new Date(Date.now() + seed.hoursToExpiry * 3600_000).toISOString();
  return {
    id: `${bid}:${seed.id}`,
    position,
    title: seed.title,
    description: seed.description,
    imageUrl: seed.imageUrl,
    backgroundHex: seed.backgroundHex,
    expiresAt,
  };
}

export default async function NexDiscoverPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const session = await resolveNexAppSessionFromContext();
  const isSignedIn = session?.account?.id != null;

  // ─── Resolve viewer location (hard gate falls through when it's set)
  // Priority: URL ?lat/?lng (set by the gate on first grant), then
  // account-saved location, then null.
  let viewerLocation: SavedLocation | null = null;
  const spLat = sp.lat ? Number(sp.lat) : NaN;
  const spLng = sp.lng ? Number(sp.lng) : NaN;
  if (Number.isFinite(spLat) && Number.isFinite(spLng)) {
    viewerLocation = parseSavedLocation({
      lat: spLat,
      lng: spLng,
      cityLabel: typeof sp.city === "string" && sp.city.trim().length > 0 ? sp.city.trim() : null,
      countryIso:
        typeof sp.country === "string" && /^[A-Za-z]{2}$/.test(sp.country)
          ? sp.country.toUpperCase()
          : null,
      source: "gps",
      setAt: new Date().toISOString(),
    });
  }
  if (!viewerLocation) {
    viewerLocation = await readUserLocationFromAccount().catch(() => null);
  }

  // Human-readable "Viewing <city>, <country>" + flag for the top of
  // the surface. All derived from the resolved SavedLocation only ·
  // never fabricated when the fields are null.
  const viewerCity = viewerLocation?.cityLabel ?? null;
  const viewerCountryIso = viewerLocation?.countryIso ?? null;
  const viewerCountryName = countryNameForIso(viewerCountryIso);
  const viewerCountryFlag = flagEmojiForIso(viewerCountryIso);
  const viewingLine = viewerCity
    ? viewerCountryName
      ? `Viewing ${viewerCity}, ${viewerCountryName}`
      : `Viewing ${viewerCity}`
    : viewerCountryName
      ? `Viewing ${viewerCountryName}`
      : null;

  const query = (sp.q ?? "").trim();
  const activeCategory = (sp.category ?? "").trim();
  const effectiveCategory =
    activeCategory.length > 0 &&
    (NEX_BUSINESS_CATEGORIES as readonly string[]).includes(activeCategory)
      ? activeCategory
      : null;

  // 1-based page param · clamped to [1, 10000] so a hostile URL
  // can't ask for the 999999th page.
  const rawPage = sp.page ? Number(sp.page) : 1;
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.min(10000, Math.floor(rawPage)) : 1;
  const offset = (page - 1) * PAGE_SIZE;

  // Per-visit discovery seed · threaded through so page 1 looks fresh
  // on each new session but pages 2+ stay stable while the visitor
  // browses. Priority: explicit ?seed=…  →  session-anchored seed
  // (daily rotation + account id when signed in · daily-only for
  // anon) → deterministic null (test / server-render fallback).
  const explicitSeed =
    typeof sp.seed === "string" && sp.seed.length > 0 && sp.seed.length <= 64
      ? sp.seed
      : null;
  const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const defaultSeed = session?.account?.id
    ? `${todayKey}:${session.account.id.slice(0, 8)}`
    : todayKey;
  const feedSeed = explicitSeed ?? defaultSeed;

  // ─── Country selector · scopes the directory feed to one ISO
  //     (e.g. "ID", "GB", "DE"). Null = all countries. The chip row
  //     renders real counts per country, honest-null for empty ones.
  const activeCountryIso =
    typeof sp.country === "string" && /^[A-Z]{2}$/i.test(sp.country)
      ? sp.country.toUpperCase()
      : null;

  // Country options for the selector · pulled live from the directory.
  // Shows every ISO that has at least one canonical row, plus an
  // "All" option. Honest-null · unknown ISOs show the ISO code itself
  // as a fallback name.
  const countryOptions: CountryOption[] = await (async () => {
    try {
      const list = await localDirectory.listCountriesWithCanonical();
      const total = list.reduce((acc, r) => acc + r.n, 0);
      const options: CountryOption[] = [
        { iso: null, name: "All", canonicalCount: total, includedInProgramme: true },
      ];
      for (const r of list) {
        options.push({
          iso: r.iso,
          name: countryDisplayName(r.iso),
          canonicalCount: r.n,
          includedInProgramme: true,
        });
      }
      return options;
    } catch {
      return [{ iso: null, name: "All", canonicalCount: 0, includedInProgramme: true }];
    }
  })();

  // ─── Fetch feed from BOTH sources (founder directive 2026-10-13:
  //     "add all our business listing from nex directory to nex search"):
  //
  //       A. nex_business  (Supabase · merchant-claimed shops with owners)
  //       B. nex.business_canonical (local nex_dev · 22k+ directory
  //          canonical rows · unclaimed · no owner_account_id)
  //
  //     Both branches tolerate the other failing (postgres offline in
  //     prod, Supabase hiccup in dev) so the surface stays useful.
  //     Dedup is by slug (`display_name|slug` collision is vanishingly
  //     rare but guarded against). Chat button suppresses itself when
  //     owner_account_id is empty — the row is still visible but
  //     tagged as a Directory listing instead of a Chat partner.
  const supabaseRows: NexBusinessRow[] = await (async () => {
    // When the viewer scopes to a specific country, skip Supabase
    // nex_business entirely · it has no formal country column, so
    // mixing those rows into (say) ?country=GB would misrepresent
    // the market as populated when it isn't. Honest-null.
    if (activeCountryIso !== null) return [];
    try {
      if (query.length > 0) {
        return await discoveryService.searchBusinesses(
          query,
          { limit: PAGE_SIZE, offset },
          { category: effectiveCategory },
        );
      }
      if (effectiveCategory) {
        const all = await discoveryService.listBusinessesPaged(
          PAGE_SIZE,
          offset,
        );
        return all.filter((b) => b.business_category === effectiveCategory);
      }
      return await discoveryService.listBusinessesPaged(PAGE_SIZE, offset);
    } catch {
      return [];
    }
  })();
  const directoryRows: NexBusinessRow[] = await (async () => {
    try {
      if (query.length > 0) {
        return await localDirectory.searchCanonicalBusinesses(query, {
          limit: PAGE_SIZE,
          offset,
        });
      }
      return await localDirectory.listCanonicalBusinessesPaged(
        PAGE_SIZE,
        offset,
        { country: activeCountryIso, seed: feedSeed },
      );
    } catch {
      return [];
    }
  })();
  // Merge, dedup by slug, then clamp to PAGE_SIZE for the page. The
  // claimed Supabase rows are prepended so they tend to appear above
  // directory rows on the first page.
  const seenSlugs = new Set<string>();
  const merged: NexBusinessRow[] = [];
  for (const r of [...supabaseRows, ...directoryRows]) {
    const key = r.slug || r.id;
    if (seenSlugs.has(key)) continue;
    seenSlugs.add(key);
    merged.push(r);
  }
  const rows = merged.slice(0, PAGE_SIZE);

  // Honest totals for hasNext · sums both corpora. Any failure
  // degrades to "unknown total" (Next always clickable) rather than
  // showing a wrong number.
  const [supabaseTotal, directoryTotal] = await Promise.all([
    discoveryService.countActiveBusinesses().catch(() => null),
    localDirectory
      .countCanonicalBusinessesAll({ country: activeCountryIso })
      .catch(() => null),
  ]);
  const combinedTotal =
    supabaseTotal === null && directoryTotal === null
      ? null
      : (supabaseTotal ?? 0) + (directoryTotal ?? 0);
  const hasNext =
    combinedTotal === null ? rows.length === PAGE_SIZE : page * PAGE_SIZE < combinedTotal;
  const hasPrev = page > 1;

  // Batch-fetch cover + price context for the 24 cards on the page.
  // One Supabase round-trip returns heroImageUrl + minPricePence +
  // currency per claimed business. Directory rows (no business_id)
  // return nothing; the card falls back to the category gradient.
  const cardCtxMap = await fetchDiscoverCardContext(rows.map((r) => r.id));

  // Dev overlay · fixture promos on the first 6 cards (1 / 2 / 3
  // rotating) so promo bubbles are visible before migration 159 is
  // applied in production. Clearly branded "DEMO" in each title.
  //
  // Default-ON in dev so visiting /nex-native/search shows the
  // bubbles without hunting for a URL flag. Pass `?dev_promos=0` to
  // force the empty state locally. In production (NODE_ENV !=
  // "development") the overlay only activates when the flag is
  // explicitly set to "1" / "true" — so a prod viewer never sees a
  // DEMO promo unless they ask for it with a query string.
  const isDev = process.env.NODE_ENV === "development";
  const devPromosOn = sp.dev_promos === "0" || sp.dev_promos === "false"
    ? false
    : sp.dev_promos === "1" || sp.dev_promos === "true"
      ? true
      : isDev;
  if (devPromosOn) {
    // Single-slot model (2026-10-13 · supersedes the 3-circle stack):
    // one discount per card, rotating through the 3 fixture presets so
    // the user sees variety (20% orange, 15% cyan, 30% green) across
    // the first 6 cards.
    rows.slice(0, 6).forEach((r, i) => {
      const presetIdx = (i % 3) as 0 | 1 | 2;
      const promos = [fixturePromoFor((presetIdx + 1) as 1 | 2 | 3, r.id)];
      const existing = cardCtxMap.get(r.id) ?? {
        heroImageUrl: null,
        minPricePence: null,
        currency: null,
        maxSpiceLevel: null,
        promos: [],
        menuPreview: [],
      };
      cardCtxMap.set(r.id, { ...existing, promos });
    });
  }

  // Enrich with distance when both viewer and business have coords.
  const enriched = rows.map((b) => {
    let distanceKm: number | null = null;
    if (
      viewerLocation !== null &&
      typeof b.location_lat === "number" &&
      typeof b.location_lng === "number"
    ) {
      distanceKm = haversineKm(
        { lat: viewerLocation.lat, lng: viewerLocation.lng },
        { lat: b.location_lat, lng: b.location_lng },
      );
    }
    return { row: b, distanceKm };
  });

  // Default sort · "Nearby" chip is the no-category path. When we have
  // the viewer's location and the active chip is "Nearby" (""), sort by
  // distance ascending (nulls last so unlocated shops don't dominate).
  if (viewerLocation !== null && effectiveCategory === null) {
    enriched.sort((a, b) => {
      const ad = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const bd = b.distanceKm ?? Number.POSITIVE_INFINITY;
      return ad - bd;
    });
  }

  const feedHeadline =
    query.length > 0
      ? `Results for "${query}"`
      : effectiveCategory !== null
        ? `${categoryLabel(effectiveCategory)} near you`
        : "Shops near you";

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        html, body { scrollbar-width: none; -ms-overflow-style: none; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0; height: 0; display: none; }
        @keyframes nex-discover-presence-heartbeat {
          0%   { transform: scale(1);    opacity: 0.55; }
          70%  { transform: scale(1.32); opacity: 0; }
          100% { transform: scale(1.32); opacity: 0; }
        }
        /* Subtle "life" on the promo circles · 1.5-2% scale breathe
           on a 1.6s ease-in-out loop. Peripheral-eye attention
           without being spammy. */
        @keyframes nex-promo-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.04); }
        }
      `}</style>
      <main
        data-nex-discover-root
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "16px 18px 48px",
          position: "relative",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(70% 50% at 50% 0%, rgba(0,175,255,0.08), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: 460, margin: "0 auto" }}>
          <NexPageHeader dataScope="discover" />

          <section style={{ marginTop: 22 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                color: NEX.text,
              }}
            >
              NEX Discover
            </h1>
            <div
              style={{
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: NEX.textMuted,
                  lineHeight: 1.5,
                }}
              >
                Find people, food and local services
              </p>
              {combinedTotal !== null ? (
                <span
                  aria-label={`${combinedTotal.toLocaleString("en-US")} listings on NEX`}
                  style={{
                    flex: "0 0 auto",
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(255,114,0,0.14)",
                    border: `1px solid ${NEX.orangeSoft}`,
                    color: NEX.orange,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {combinedTotal.toLocaleString("en-US")} listings
                </span>
              ) : null}
            </div>
            {viewingLine ? (
              <div
                style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  background: "rgba(0,175,255,0.08)",
                  border: `1px solid ${NEX.cyanSoft}`,
                  borderRadius: 999,
                  fontSize: 12,
                  color: NEX.text,
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                }}
                aria-live="polite"
              >
                {viewerCountryFlag ? (
                  <span role="img" aria-label={viewerCountryName ?? "country"} style={{ fontSize: 16, lineHeight: 1 }}>
                    {viewerCountryFlag}
                  </span>
                ) : null}
                <span>{viewingLine}</span>
              </div>
            ) : null}
          </section>

          <section style={{ marginTop: 18 }}>
            <DiscoverControls
              initialQuery={query}
              countryFlagEmoji={viewerCountryFlag}
              countryName={viewerCountryName}
            />
            <CountrySelector
              options={countryOptions}
              activeIso={activeCountryIso}
            />
          </section>

          <section style={{ marginTop: 24 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: NEX.text,
              }}
            >
              {feedHeadline}
            </h2>

            <ul
              style={{
                listStyle: "none",
                margin: "14px 0 0",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {enriched.length === 0 ? (
                <EmptyFeed query={query} activeCategory={effectiveCategory} />
              ) : (
                enriched.map(({ row, distanceKm }) => (
                  <li key={row.id}>
                    <ShopCard
                      row={row}
                      distanceKm={distanceKm}
                      cardCtx={cardCtxMap.get(row.id) ?? null}
                      /* Prototype presence proxy: claimed shops read
                         as "online" so the green rim + heartbeat ping
                         is visible across the Discover feed. Flip to
                         a real presence resolver when the activity
                         service lands. Unclaimed directory rows read
                         "unknown" (neutral ring, no ping). */
                      presence={
                        typeof row.owner_account_id === "string" &&
                        row.owner_account_id.length > 0
                          ? "online"
                          : "unknown"
                      }
                      viewerCountryIso={viewerCountryIso}
                    />
                  </li>
                ))
              )}
            </ul>

            {rows.length > 0 ? (
              <Pager
                page={page}
                hasPrev={hasPrev}
                hasNext={hasNext}
                totalShown={combinedTotal}
                baseParams={{ ...sp, seed: feedSeed }}
              />
            ) : null}
          </section>

          <p
            style={{
              marginTop: 32,
              textAlign: "center",
              fontSize: 11,
              color: NEX.textSoft,
              lineHeight: 1.55,
            }}
          >
            Only verified NEX businesses with shops or menus appear here ·
            tap <strong style={{ color: NEX.text }}>Chat with owner</strong>{" "}
            to open a direct conversation.
          </p>
        </div>
      </main>
      <HardLocationGate
        initialLocation={viewerLocation}
        isSignedIn={isSignedIn}
      />
    </>
  );
}

// ShopCard moved to ./_shop-card.tsx (world-class layout · cover
// photo · open-now · from-price · retained Safe Trade + chips).

function Pager({
  page,
  hasPrev,
  hasNext,
  totalShown,
  baseParams,
}: {
  readonly page: number;
  readonly hasPrev: boolean;
  readonly hasNext: boolean;
  readonly totalShown: number | null;
  readonly baseParams: {
    q?: string;
    category?: string;
    lat?: string;
    lng?: string;
    city?: string;
    country?: string;
    seed?: string;
  };
}): React.JSX.Element {
  function hrefForPage(p: number): string {
    const u = new URLSearchParams();
    if (baseParams.q) u.set("q", baseParams.q);
    if (baseParams.category) u.set("category", baseParams.category);
    if (baseParams.lat) u.set("lat", baseParams.lat);
    if (baseParams.lng) u.set("lng", baseParams.lng);
    if (baseParams.city) u.set("city", baseParams.city);
    if (baseParams.country) u.set("country", baseParams.country);
    // Seed is threaded through pagination so pages 2+ reproduce the
    // same visual order as page 1 within the same visit.
    if (baseParams.seed) u.set("seed", baseParams.seed);
    if (p > 1) u.set("page", String(p));
    const qs = u.toString();
    return qs.length > 0 ? `/nex-native/search?${qs}` : "/nex-native/search";
  }
  const totalPages =
    totalShown !== null ? Math.max(1, Math.ceil(totalShown / PAGE_SIZE)) : null;
  return (
    <nav
      aria-label="Discover pagination"
      style={{
        marginTop: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      {hasPrev ? (
        <Link href={hrefForPage(page - 1)} style={pagerBtn("solid")}>
          ← Previous
        </Link>
      ) : (
        <span style={pagerBtn("disabled")} aria-disabled="true">
          ← Previous
        </span>
      )}
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: NEX.textMuted,
          letterSpacing: "0.02em",
        }}
      >
        Page {page}
        {totalPages !== null ? ` of ${totalPages.toLocaleString("en-US")}` : ""}
      </span>
      {hasNext ? (
        <Link href={hrefForPage(page + 1)} style={pagerBtn("solid")}>
          Next →
        </Link>
      ) : (
        <span style={pagerBtn("disabled")} aria-disabled="true">
          Next →
        </span>
      )}
    </nav>
  );
}

function pagerBtn(kind: "solid" | "disabled"): CSSProperties {
  const disabled = kind === "disabled";
  return {
    padding: "9px 16px",
    borderRadius: 999,
    border: `1px solid ${disabled ? NEX.borderSoft : NEX.cyanSoft}`,
    background: disabled ? "transparent" : "rgba(0,175,255,0.08)",
    color: disabled ? NEX.textSoft : NEX.cyan,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.02em",
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    userSelect: "none",
  };
}

function EmptyFeed({
  query,
  activeCategory,
}: {
  readonly query: string;
  readonly activeCategory: string | null;
}): React.JSX.Element {
  const title = query.length > 0 ? `No results for "${query}"` : "No shops here yet";
  const body =
    query.length > 0
      ? "Try a different word · or clear your category filter."
      : activeCategory !== null
        ? `No ${categoryLabel(activeCategory).toLowerCase()} shops are on NEX Chat yet in this area.`
        : "As NEX businesses complete their profiles they'll show up here.";
  return (
    <li>
      <div
        style={{
          padding: "20px 18px",
          borderRadius: 14,
          background: NEX.surface,
          border: `1px dashed ${NEX.cyanSoft}`,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: NEX.text }}>{title}</div>
        <div style={{ marginTop: 6, fontSize: 12, color: NEX.textMuted, lineHeight: 1.55 }}>
          {body}
        </div>
      </div>
    </li>
  );
}
