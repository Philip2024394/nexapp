// src/app/nex-native/directory/landing/page.tsx
//
// NEX Directory · landing page · sealed 2026-10-16.
// --------------------------------------------------------------------
// Full-fidelity match of the az5.png layout mock the owner supplied:
//   · Top header: NEX logo + NEX wordmark + AFFILIATES pill, "Shop ·
//     Book · Save" eyebrow, search + more icons on the right.
//   · Hero: three-line headline (orange middle line) + body copy +
//     cyan "Explore Deals" pill CTA + decorative neon-skyline art.
//   · Shop by Category: 4 × 2 grid of 8 category tiles.
//   · Featured Deals: three horizontal deal cards.
//   · Benefits strip: three cyan trust-icon rows.
//   · Primary CTA: full-width orange "Start Saving Now" pill +
//     "Already have an account? Sign in" hint.
//   · Bottom nav: Home · Connect · (+) · Messages · Profile.
//
// Icon sprites
//   Two source images are shipped in `/nex-directory/icons/`:
//     · `category-grid.png`  · 4 × 2 neon-outline category icons.
//     · `benefits-trio.png`  · 3 × 1 cyan trust icons.
//   Each tile uses CSS `background-image` + `background-position` so
//   the sprite loads ONCE and the browser crops to the right icon.
//   Positioning math: for an N-column sprite, column `c` lives at
//   `(c * 100 / (N-1))%` horizontally.
//
// Routing · the "Explore Deals" and "Start Saving Now" CTAs both link
// to `/nex-native/directory` (the Phase A canonical results surface).
// This landing route is additive · direct links to `/directory` still
// work exactly as before.

import type { CSSProperties } from "react";
import Link from "next/link";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import {
  getLandingFeed,
  pickOrMintSeed,
  type ListingCardViewModel,
} from "@/lib/nex-native/directory/landing-feed-service";
import { ListingCard } from "@/components/nex-native/directory/listing-card";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { effectiveTier } from "@/lib/nex-native/account-service";
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";
import { InstallHomeButtonClient } from "../../_install-home-button-client";
// NEX-022 · install promotion engagement gate · owner-sealed 2026-11-24.
// The installer UI must not mount for first-time / unengaged visitors.
// Only after a qualifying success event (first contact added or first
// message sent) does `isInstallEligible()` flip to true.
import { isInstallEligible } from "@/lib/nex-native/engagement/install-eligibility";

// Force dynamic render · a fresh landing visit should mint a fresh
// seed and pull a fresh random pair for Featured Deals. Caching would
// freeze the "random each visit" semantic the owner approved.
export const dynamic = "force-dynamic";

const CATEGORY_SHEET = "/nex-directory/icons/category-grid.png";
const BENEFITS_SHEET = "/nex-directory/icons/benefits-trio.png";
const HERO_ART = "/nex-directory/landing-hero.png";
const RESULTS_HREF = "/nex-native/directory";

// NEX palette (shared with the Vault sealed theme).
const COLOR_BG = "var(--nex-world-background-base, #020914)";
const COLOR_PANEL = "#0A1526";
const COLOR_PANEL_BORDER = "rgba(0,175,255,0.18)";
const COLOR_ORANGE = "#FF7200";
const COLOR_ORANGE_INK = "#1A1300";
const COLOR_CYAN = "#00AFFF";
const COLOR_TEXT = "#F2F5F8";
const COLOR_MUTED = "#7D9BC0";
const COLOR_SUBTLE = "#526B89";

export const metadata = {
  title: "NEX Directory",
};

// Mobile-first viewport · locks the device width + disables unwanted
// user-zoom-out so the landing shell renders at its intended 420px
// phone layout across iOS Safari, Android Chrome and in-app webviews.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
};

export default async function DirectoryLandingPage({
  searchParams,
}: {
  readonly searchParams?: Promise<{ s?: string }>;
}) {
  // Resolve or mint a per-visit seed. Thread it into Featured Deals'
  // CTA + the "View All" / "Explore Deals" buttons so the directory
  // page lands with the SAME seed → consistent random mix across the
  // landing → directory transition.
  const resolvedParams = (await searchParams) ?? {};
  const seed = pickOrMintSeed(resolvedParams.s ?? null);

  // Featured Deals: owner approved exactly 2 cards on mobile · fetch
  // through the sealed service · honest reduced state when fewer than
  // 2 eligible rows exist · zero fabrication.
  const feed = await getLandingFeed({
    limit: 2,
    visitorSeed: seed,
  });

  // Owner directive 2026-10-16 · ControlDrawer proof-of-concept on
  // the landing page. The drawer trigger replaces the inert MoreGlyph
  // IconButton. Session is resolved server-side and passed in · the
  // drawer never derives entitlement from client-trusted inputs.
  // Null session → the drawer renders a Sign-In prompt instead of
  // identity + logout + business group.
  let drawerSession: ControlDrawerSession | null = null;
  try {
    const session = await resolveNexAppSessionFromContext();
    if (session) {
      drawerSession = {
        displayName: session.account.display_name,
        nexHandle: session.account.nex_handle,
        isBisnis: effectiveTier(session.account) === "bisnis",
      };
    }
  } catch {
    // Unauthenticated · drawer stays in anonymous mode. The landing
    // page itself is public, so a session failure must not block
    // first paint.
  }

  // NEX-022 · install promotion must not render until the user has
  // completed at least one meaningful interaction. First-time visitors
  // never see the install button here · it is marked eligible by the
  // first successful contact-add or message-send server action.
  const installEligible = await isInstallEligible();

  return (
    <main
      style={pageStyle}
      aria-label="NEX Directory landing"
      data-nex-landing-bg="neon-city-skyline"
    >
      {/* Owner directive 2026-10-16 · background image fits the full
          viewport (height + width) via `background-size: 100% 100%`
          on a viewport-sized layer that scrolls WITH the page content
          (position: absolute, not fixed). The image + overlay anchor
          at the top of the main, visible on first paint, and scroll
          off together as the viewer moves down. */}
      <div style={pageBgLayerStyle} aria-hidden="true" />
      <div style={shellStyle}>
        <TopHeader drawerSession={drawerSession} />
        <HeroSection seed={seed} />
        <CategorySection seed={seed} />
        <FeaturedDealsSection cards={feed.cards} seed={seed} />
        <PrimaryCta seed={seed} installEligible={installEligible} />
      </div>
    </main>
  );
}

// ─── Top header ────────────────────────────────────────────────────

function TopHeader({
  drawerSession,
}: {
  readonly drawerSession: ControlDrawerSession | null;
}) {
  return (
    <header style={headerStyle}>
      <div style={headerLeftStyle}>
        <div style={headerBrandRowStyle}>
          {/* Shared NEX ping badge · identical size + accent as the
              create-account page so the brand mark stays consistent
              across every entry surface. */}
          <NexPingBadge size={56} accent={COLOR_CYAN} dataTestId="directory-landing-nex" />
          <span style={brandWordmarkStyle}>NEX</span>
        </div>
        <div style={headerEyebrowStyle}>Shop · Book · Save</div>
      </div>
      <div style={headerRightStyle}>
        {/* Owner directive 2026-10-18 · the magnifying glass that
            used to live here routed to /nex-native/directory · but
            the viewer is already on the Directory landing, so a
            self-referential search icon added no value. Replaced
            with a Home icon that routes back to /nex-native/welcome
            · the orientation / post-signup landing · so the user
            always has a one-tap exit back to familiar territory. */}
        <Link
          href="/nex-native/welcome"
          aria-label="Back to NEX welcome"
          style={iconButtonStyle}
          data-nex-landing-home-link
        >
          <HomeGlyph />
        </Link>
        <ControlDrawer session={drawerSession} />
      </div>
    </header>
  );
}

function HomeGlyph() {
  // Simple house silhouette · 24-unit viewBox so it visually matches
  // the retired SearchGlyph's weight (circle + handle). Stroke
  // colour inherits the shared header text palette.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 11.5 12 4l9 7.5"
        stroke={COLOR_TEXT}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 10.5V20h14V10.5"
        stroke={COLOR_TEXT}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// MoreGlyph removed · the three-dot menu glyph now lives inside the
// shared `ControlDrawer` component where it is bound to the drawer's
// open/close state. Owner directive 2026-10-16.

// ─── Hero ──────────────────────────────────────────────────────────

function HeroSection({ seed }: { readonly seed: string }) {
  return (
    <section style={heroStyle}>
      <div style={heroCopyStyle}>
        <h1 style={heroHeadlineStyle}>
          <span style={heroLineWhiteStyle}>More Choice.</span>
          <span style={heroLineOrangeStyle}>Better Deals.</span>
          <span style={heroLineWhiteStyle}>All in One Place.</span>
        </h1>
        <p style={heroBodyStyle}>
          Discover trusted products, services, accommodation, food and more —
          powered by NEX Network.
        </p>
        <Link
          href={directoryHref({ seed })}
          style={heroCtaStyle}
          data-nex-landing-cta="explore"
        >
          <span>Explore Deals</span>
          <ArrowRight />
        </Link>
      </div>
    </section>
  );
}

/** Build a stable directory URL. Owner directive 2026-10-16 "url is
 *  small and mapped tree" · prefer the path-based `/directory/{slug}`
 *  form over the `?category=` query-param form. For the all-view
 *  (no category) we don't thread the seed either · the directory
 *  mints a fresh one · keeps the first-visit URL as short as
 *  `/nex-native/directory`. */
function directoryHref({
  seed,
  category,
}: {
  readonly seed: string;
  readonly category?: string;
}): string {
  // Seed is intentionally unused on first-navigation hrefs · the
  // directory page mints its own fresh seed per visit. Pagination
  // threads the seed via `?s=` on the resulting page's Prev/Next.
  void seed;
  if (category) return `${RESULTS_HREF}/${category}`;
  return RESULTS_HREF;
}

function ArrowRight({ size = 14 }: { readonly size?: number } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ marginLeft: 8 }}>
      <path
        d="M3 8h9m0 0L8 4m4 4-4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// ─── Shop by Category · 4 × 2 grid ─────────────────────────────────

// `key` stays as the canonical slug so the search page can filter on
// the stable identifier · `label` is purely the on-tile text and can
// change without breaking the query-param contract.
//
// `accent` matches each icon's own neon tint on the category-grid
// sprite sheet · the label text picks up its icon's colour so the
// tile reads as one coloured object. Owner directive 2026-10-16.
const CATEGORIES: ReadonlyArray<{
  readonly key: string;
  readonly label: string;
  readonly col: 0 | 1 | 2 | 3;
  readonly row: 0 | 1;
  readonly accent: string;
}> = [
  { key: "products",      label: "Products",  col: 0, row: 0, accent: "#FF8A2A" }, // cart · neon orange
  { key: "services",      label: "Services",  col: 1, row: 0, accent: "#00AFFF" }, // wrench · neon cyan
  { key: "accommodation", label: "Stay",      col: 2, row: 0, accent: "#B566FF" }, // bed · neon violet
  { key: "food-drink",    label: "Food",      col: 3, row: 0, accent: "#4DD17A" }, // fork+knife · neon green
  { key: "travel",        label: "Travel",    col: 0, row: 1, accent: "#FFCC33" }, // plane · neon yellow
  { key: "transport",     label: "Transport", col: 1, row: 1, accent: "#00AFFF" }, // car · neon cyan
  { key: "experiences",   label: "Events",    col: 2, row: 1, accent: "#FF5EB4" }, // ticket · neon pink
  { key: "deals",         label: "Deals",     col: 3, row: 1, accent: "#FFCC33" }, // tag · neon yellow
];

function CategorySection({ seed }: { readonly seed: string }) {
  return (
    <section style={sectionStyle}>
      <SectionHeader title="Shop by Category" seed={seed} />
      <div style={categoryGridStyle}>
        {CATEGORIES.map(({ key, label, col, row, accent }) => (
          <CategoryTile
            key={key}
            slug={key}
            label={label}
            col={col}
            row={row}
            accent={accent}
            seed={seed}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryTile({
  slug,
  label,
  col,
  row,
  accent,
  seed,
}: {
  readonly slug: string;
  readonly label: string;
  readonly col: 0 | 1 | 2 | 3;
  readonly row: 0 | 1;
  readonly accent: string;
  readonly seed: string;
}) {
  // 4-column sprite → positions 0 / 33.33 / 66.67 / 100
  // 2-row sprite → positions 0 / 100
  const spriteStyle: CSSProperties = {
    width: 48,
    height: 48,
    backgroundImage: `url("${CATEGORY_SHEET}")`,
    backgroundSize: "400% 200%",
    backgroundPosition: `${(col * 100) / 3}% ${row * 100}%`,
    backgroundRepeat: "no-repeat",
    // Glow tinted to the tile's own accent so each icon's neon colour
    // reads cleanly against the translucent navy background.
    filter: `drop-shadow(0 0 6px ${accent}88)`,
  };
  // Every category tile activates the directory results route with
  // the stable slug as a `category` query param + the visitor seed
  // for stable mixed ordering. The slug lives on the CATEGORIES
  // array · changing a label (e.g. "Accommodation" → "Stay") does
  // NOT change the slug, so links + server-side filters stay stable.
  return (
    <Link
      href={directoryHref({ seed, category: slug })}
      style={categoryTileStyle}
      data-nex-landing-category={slug}
      aria-label={`${label} — open search directory`}
    >
      <span style={spriteStyle} aria-hidden="true" />
      <span style={{ ...categoryLabelStyle, color: accent, textShadow: `0 0 8px ${accent}66` }}>
        {label}
      </span>
    </Link>
  );
}

// ─── Featured Deals · two real cards (mobile) from the shared feed ──
//
// Phase A sealed 2026-10-16 · the previous hardcoded `DEALS` array
// (three fabricated cards with made-up prices/discounts) has been
// DELETED per owner approval. Cards now come from the sealed feed
// service `getLandingFeed` which merges owner-claimed + canonical
// sources, dedups by slug, and shuffles stably per visitor seed.
// Zero fabrication · owner rule #6.

function FeaturedDealsSection({
  cards,
  seed,
}: {
  readonly cards: readonly ListingCardViewModel[];
  readonly seed: string;
}) {
  return (
    <section style={sectionStyle}>
      <SectionHeader title="Featured Deals" seed={seed} />
      {cards.length === 0 ? (
        <FeaturedDealsEmpty seed={seed} />
      ) : (
        <div style={featuredDealsRowStyle}>
          {cards.map((card) => (
            <ListingCard key={card.id} listing={card} size="compact" />
          ))}
        </div>
      )}
    </section>
  );
}

/** Honest empty state · shown when no eligible listings exist. No
 *  fabricated placeholders · just an honest message + a CTA to the
 *  directory grid in case Prev/Next or seed-change finds results. */
function FeaturedDealsEmpty({ seed }: { readonly seed: string }) {
  return (
    <div style={featuredDealsEmptyStyle}>
      <p style={featuredDealsEmptyTitleStyle}>No featured listings right now.</p>
      <p style={featuredDealsEmptyBodyStyle}>
        New shops, services and places are added all the time.
      </p>
      <Link
        href={directoryHref({ seed })}
        style={featuredDealsEmptyCtaStyle}
      >
        <span>Browse all listings</span>
        <ArrowRight />
      </Link>
    </div>
  );
}

// Benefits strip ("Trusted Partners / Exclusive Offers / Easy Booking")
// was removed per owner directive 2026-10-16. The three trust tiles +
// their copy are gone from the landing surface.

// ─── Primary CTA ───────────────────────────────────────────────────

function PrimaryCta({
  seed,
  installEligible,
}: {
  readonly seed: string;
  readonly installEligible: boolean;
}) {
  return (
    <section style={primaryCtaSectionStyle}>
      <Link
        href={directoryHref({ seed })}
        style={primaryCtaButtonStyle}
        data-nex-landing-cta="start-saving"
      >
        <span>Start Saving Now</span>
        <ArrowRight size={16} />
      </Link>
      <p style={signInHintStyle}>
        Already have an account?{" "}
        <Link href="/nex-native/sign-in" style={signInLinkStyle}>
          Sign In
        </Link>
      </p>
      {/* Home-screen install prompt · owner directive 2026-10-16.
          NEX-022 · owner-sealed 2026-11-24 · the install button is
          gated behind `installEligible` (true only after first
          successful contact-add or message-send). Hidden when NEX is
          already installed; iOS falls back to a Share → "Add to Home
          Screen" tooltip. The `InstallHomeButtonClient` import is
          retained at module scope so string-grep gating in tests
          continues to match even when the mount is conditional. */}
      {installEligible ? (
        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "center",
          }}
          data-nex-landing-install-slot
        >
          <InstallHomeButtonClient />
        </div>
      ) : null}
    </section>
  );
}

// ─── Section header shared ─────────────────────────────────────────

function SectionHeader({
  title,
  seed,
}: {
  readonly title: string;
  readonly seed: string;
}) {
  return (
    <div style={sectionHeaderStyle}>
      <div style={sectionTitleRowStyle}>
        <FlameGlyph />
        <h2 style={sectionTitleStyle}>{title}</h2>
      </div>
      <Link href={directoryHref({ seed })} style={viewAllStyle}>
        View All <span aria-hidden="true">›</span>
      </Link>
    </div>
  );
}

// High-quality 3D-style neon flame · owner directive 2026-10-16.
// Three stacked gradients + an inner highlight + an outer glow give
// the glyph volume and a hot core, instead of the earlier flat
// two-path silhouette.
function FlameGlyph() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 32 32"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 0 6px rgba(255,114,0,0.75))" }}
    >
      <defs>
        <radialGradient id="flame-outer" cx="50%" cy="60%" r="60%">
          <stop offset="0%" stopColor="#FFE28A" />
          <stop offset="35%" stopColor="#FFB03A" />
          <stop offset="75%" stopColor="#FF5A00" />
          <stop offset="100%" stopColor="#B22600" />
        </radialGradient>
        <radialGradient id="flame-inner" cx="50%" cy="65%" r="40%">
          <stop offset="0%" stopColor="#FFF7D0" stopOpacity="1" />
          <stop offset="60%" stopColor="#FFE28A" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FFB03A" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Outer silhouette · classic flame shape with a flick at the tip */}
      <path
        d="M16 2c1 3 3 5 5 7.5s3 5 3 8.5a8 8 0 1 1-16 0c0-3 1.5-5 3-7s2.5-4 1.5-7c3 1 4.5 3 5 5-.5-3 0-5-1.5-7z"
        fill="url(#flame-outer)"
      />
      {/* Hot inner core · gives the glyph its 3D volume */}
      <path
        d="M16 11c1.2 2 3 3.5 3 6.5a4 4 0 1 1-8 0c0-2.5 1-3.5 2-4.5s1.5-2.5 1-4c1 .5 1.6 1.2 2 2z"
        fill="url(#flame-inner)"
      />
      {/* Specular highlight on the right shoulder · pops the roundness */}
      <path
        d="M18.5 7c.8 1.4 1.7 2.6 2 4-1 .4-2-.3-2.3-1.2-.3-.9-.2-1.9.3-2.8z"
        fill="#FFF2B5"
        opacity="0.75"
      />
    </svg>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

// Page background · owner directive 2026-10-16.
//
// Three requirements from the owner's spec:
//   1. Image fits the full height AND width of the viewport (no crop)
//   2. Page content and the dark gradient overlay scroll TOGETHER
//   3. (Previous bug) the overlay must not stay fixed while content scrolls
//
// Implementation:
//   · pageStyle has NO background image / overlay · just the fallback
//     navy colour. The image + overlay live on a child layer (next
//     const) that sits at the top of the main.
//   · pageBgLayerStyle is a position:absolute div sized exactly to
//     the viewport (`width: 100vw`, `height: 100svh`), with the
//     image + gradient painted on it as a multi-layer background
//     using `background-size: 100% 100%` so the image fills the
//     layer edge-to-edge without crop.
//   · Because the layer is `position: absolute` (not `fixed`), it
//     flows with the main's scroll context · the image + overlay
//     scroll off the top together with the content.
//   · Below the viewport-sized layer, the main's fallback navy
//     colour takes over as the viewer scrolls further down.
const pageStyle: CSSProperties = {
  position: "relative",
  minHeight: "100svh",
  width: "100%",
  margin: 0,
  padding: 0,
  color: COLOR_TEXT,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  display: "flex",
  flexDirection: "column",
  backgroundColor: COLOR_BG,
  overflowX: "hidden",
};

const pageBgLayerStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100svh",
  // Multi-layer background: gradient overlay on TOP of the image.
  // `background-size: 100% 100%` stretches BOTH layers edge-to-edge
  // so the image is fully visible (no crop) and the overlay covers
  // the entire layer.
  backgroundImage: `linear-gradient(180deg, rgba(2,9,20,0.35) 0%, rgba(2,9,20,0.55) 35%, rgba(2,9,20,0.78) 100%), url("${HERO_ART}")`,
  backgroundSize: "100% 100%, 100% 100%",
  backgroundRepeat: "no-repeat, no-repeat",
  backgroundPosition: "center, center",
  // Not fixed · scrolls with the rest of the main.
  pointerEvents: "none",
  zIndex: 0,
};

const shellStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  flex: 1,
  width: "100%",
  maxWidth: 420,
  margin: "0 auto",
  padding: "16px 16px 24px 16px",
  boxSizing: "border-box",
};

// Header ───

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  marginBottom: 20,
};
const headerLeftStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};
const headerBrandRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};
const brandWordmarkStyle: CSSProperties = {
  color: COLOR_TEXT,
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: 0.4,
};
const headerEyebrowStyle: CSSProperties = {
  color: COLOR_MUTED,
  fontSize: 11,
  // Shift under the badge + wordmark · ping badge is 56px + 8px gap.
  marginLeft: 64,
};
const headerRightStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};
const iconButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: COLOR_TEXT,
  padding: 0,
};

// Hero ───

const heroStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  // Owner directive 2026-10-16 · "More Choice" should sit higher ·
  // anchor hero copy to the top of its section instead of the bottom,
  // and tighten the minHeight so the whole block rides up closer to
  // the header.
  justifyContent: "flex-start",
  alignItems: "flex-start",
  minHeight: 180,
  padding: "6px 4px 16px 4px",
  margin: "0 0 16px 0",
};
const heroCopyStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  zIndex: 1,
  maxWidth: "100%",
};
const heroHeadlineStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  margin: 0,
  fontSize: 28,
  fontWeight: 800,
  lineHeight: 1.12,
  letterSpacing: -0.3,
  textShadow: "0 2px 10px rgba(0,0,0,0.55)",
};
const heroLineWhiteStyle: CSSProperties = { color: COLOR_TEXT };
const heroLineOrangeStyle: CSSProperties = {
  color: COLOR_ORANGE,
  textShadow: "0 0 14px rgba(255,114,0,0.55)",
};
const heroBodyStyle: CSSProperties = {
  margin: 0,
  color: COLOR_TEXT,
  opacity: 0.88,
  fontSize: 13,
  lineHeight: 1.5,
  maxWidth: 320,
  textShadow: "0 1px 6px rgba(0,0,0,0.45)",
};
const heroCtaStyle: CSSProperties = {
  marginTop: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  alignSelf: "flex-start",
  color: COLOR_BG,
  background: COLOR_CYAN,
  padding: "12px 22px",
  borderRadius: 999,
  fontSize: 14,
  fontWeight: 700,
  textDecoration: "none",
  boxShadow: "0 8px 24px rgba(0,175,255,0.55)",
};

// Section header shared ───

const sectionStyle: CSSProperties = {
  marginTop: 10,
  marginBottom: 18,
};
const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
};
const sectionTitleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};
const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: COLOR_TEXT,
  fontSize: 15,
  fontWeight: 700,
};
const viewAllStyle: CSSProperties = {
  color: COLOR_CYAN,
  fontSize: 12,
  textDecoration: "none",
  fontWeight: 600,
};

// Category grid · 4 columns × 2 rows per the az5.png sample ───

const categoryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 8,
};
const categoryTileStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  // Owner directive 2026-10-16 · reduce button heights · tighter
  // vertical padding + smaller gap while keeping the 48×48 icon.
  gap: 4,
  padding: "6px 4px 8px 4px",
  minHeight: 76,
  borderRadius: 14,
  background: "rgba(10,21,38,0.82)",
  border: `1px solid ${COLOR_PANEL_BORDER}`,
  color: COLOR_TEXT,
  textDecoration: "none",
  textAlign: "center",
};
const categoryLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: COLOR_TEXT,
  lineHeight: 1.1,
};

// Featured Deals row · owner approved exactly 2 cards on mobile.
// Phase A sealed 2026-10-16.
//
// The old 3-column `dealsRowStyle` + its deal-specific styles have
// been deleted along with the hardcoded `DEALS` array · the shared
// `ListingCard` carries its own full styling. We keep only the row
// container (grid of up to 2 columns) and the honest-empty state.

const featuredDealsRowStyle: CSSProperties = {
  display: "grid",
  // 2-up on mobile · the owner-approved count. Each card expands to
  // fill its column, so taller card content (image + 2-line title +
  // description + city) remains visually balanced.
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 10,
};

const featuredDealsEmptyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 8,
  padding: "16px 14px",
  background: "rgba(10,21,38,0.82)",
  border: `1px solid ${COLOR_PANEL_BORDER}`,
  borderRadius: 14,
};
const featuredDealsEmptyTitleStyle: CSSProperties = {
  margin: 0,
  color: COLOR_TEXT,
  fontSize: 13,
  fontWeight: 700,
};
const featuredDealsEmptyBodyStyle: CSSProperties = {
  margin: 0,
  color: COLOR_MUTED,
  fontSize: 11,
  lineHeight: 1.4,
};
const featuredDealsEmptyCtaStyle: CSSProperties = {
  marginTop: 4,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 14px",
  borderRadius: 999,
  background: COLOR_CYAN,
  color: COLOR_BG,
  fontSize: 12,
  fontWeight: 700,
  textDecoration: "none",
};

// Benefits strip styles removed with the strip itself · owner
// directive 2026-10-16. The `benefits-trio.png` sprite stays on disk
// for a potential future icon-only revival; nothing imports it today.

// Primary CTA ───

const primaryCtaSectionStyle: CSSProperties = {
  marginTop: 4,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
};
const primaryCtaButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  // Owner directive 2026-10-16 · reduce by 30px total · 15px inset
  // each side so the pill no longer stretches edge-to-edge.
  width: "calc(100% - 30px)",
  minHeight: 54,
  padding: "0 24px",
  borderRadius: 999,
  background: COLOR_ORANGE,
  color: COLOR_ORANGE_INK,
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: 0.2,
  textDecoration: "none",
  boxShadow: `0 12px 32px rgba(255,114,0,0.42)`,
};
const signInHintStyle: CSSProperties = {
  margin: 0,
  color: COLOR_MUTED,
  fontSize: 12,
};
const signInLinkStyle: CSSProperties = {
  color: COLOR_CYAN,
  textDecoration: "none",
  fontWeight: 700,
};

