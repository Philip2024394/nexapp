// src/app/nex-native/directory/[id]/page.tsx
//
// NEX Directory · Phase A · The Directory-side detail surface for ONE
// canonical row.
//
// What this page is
//   · The Directory's own detail view for any canonical row that
//     reaches it. Rendered for discovery visitors who clicked a card
//     whose destination is `claim_available` or `place_detail`.
//   · A rich-conditional presentation framework: every content block
//     renders only when the backing field exists on the view model.
//     If a field is missing, the block disappears. No fabrication, no
//     placeholders, no "N/A", no "coming soon" dead copy.
//
// What this page is NOT
//   · Not the owner's cover page. If the destination resolves to
//     `nex_business` or `nex_user_profile`, this page redirects to
//     the owner's existing route (301 server-side) · the Directory
//     is the discovery layer, not a duplicate of the owner surface.
//   · Not a mutator. All DB access is SELECT (listing + evidence
//     presence check).
//   · Not a Message Business surface yet. The primary interaction
//     area is reserved · it renders ONLY actions the data genuinely
//     supports today (tel:, https:, maps directions) · no dead
//     button, no "coming soon" placeholder. When Message Business
//     lands as a separate authorisation, it fits here naturally.
//
// Current reality
//   · The one canonical row today is the sealed synthetic first-write
//     proof fixture. It has no phone, no website, no categories, no
//     real city, no coordinates returned to the service, no primary
//     image (migration 173 deferred). The detail page will therefore
//     render sparse-but-honest sections for it. When real canonical
//     rows arrive, the same code lights up with real content.

import "server-only";
import type * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCanonicalBusinessById } from "@/lib/nex-native/directory/directory-service";
import type {
  DirectoryClassification,
  DirectoryDestination,
  DirectoryListingVM,
} from "@/lib/nex-native/directory";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { NexPageHeader } from "../../_page-header";
import { NoImage } from "../_no-image";
import { buildDirectoryDetailPath } from "../_routes";
import { isVerifiedLifecycle } from "../_verified";
import { DetailDistanceChip } from "./_detail-distance";
// Client components · the detail page is server-rendered, but importing
// a `"use client"` component from a server component is well-supported:
// Next.js serialises props across the boundary. We mount them BELOW the
// main listing content as additional entry points for related-businesses
// discovery and owner-claim affordance. The existing panel-based flow in
// `ListingDetailPanel.tsx` is untouched · this is a complementary
// surface, not a replacement.
import { RelatedBusinessesSectionClient } from "@/components/nex-native/directory/RelatedBusinessesSectionClient";
import { OwnerClaimForm } from "@/components/nex-native/directory/OwnerClaimForm";
import { MapPinPing } from "@/components/nex-native/directory/MapPinPing";
import { OsmAttributionBadge } from "@/components/nex-native/directory/OsmAttributionBadge";
import {
  getPrimaryCategoryMetadata,
  partitionCategories,
  type CategoryMetadata,
} from "@/lib/nex-native/directory/category-metadata";
import { DiscoverThisArea } from "@/components/nex-native/directory/DiscoverThisArea";
import { fetchAreaIntelligence } from "@/lib/nex-native/directory/area-intelligence-service";
import type { AreaIntelligence } from "@/lib/nex-native/directory/area-intelligence-types";
import { UserLocationProvider } from "@/lib/nex-native/user-location/user-location-provider";
import { readUserLocationFromAccount } from "@/lib/nex-native/user-location/actions";
import { flagEmojiForIso } from "@/lib/nex-native/geo/flag-emoji";
import { ISO_COUNTRIES } from "@/lib/nex-native/geo/iso-countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═════════════════════════════════════════════════════════════════════
// §1 · Palette · aligned with /nex-native/directory list surface
// ═════════════════════════════════════════════════════════════════════

const NEX = {
  bg: "#020914",
  surface: "#0E1526",
  surfaceHi: "#182540",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  textSoft: "#4B6683",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0,175,255,0.08)",
  divider: "rgba(255,255,255,0.08)",
  borderSoft: "rgba(255,255,255,0.06)",
} as const;

const CLASSIFICATION_LABEL: Record<DirectoryClassification, string> = {
  business: "Business",
  person: "Person",
  place: "Place",
};

const CLASSIFICATION_ACCENT: Record<DirectoryClassification, string> = {
  business: NEX.orange,
  person: NEX.cyan,
  place: NEX.textDim,
};

// ═════════════════════════════════════════════════════════════════════
// §2 · The page
// ═════════════════════════════════════════════════════════════════════

interface PageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function DirectoryDetailPage(
  props: PageProps,
): Promise<React.ReactElement> {
  const { id } = await props.params;
  await resolveNexAppSessionFromContext();

  // Pass-10 user-location: SSR hint lets the detail page's distance
  // chip use the viewer's saved location without re-prompting GPS.
  // The LocationGate overlay is NOT mounted here (detail routes are
  // exempt per decision 2) · we only provide the saved coords.
  const initialServerLocation = await readUserLocationFromAccount();

  const outcome = await getCanonicalBusinessById(id);

  if (!outcome.systemReady) {
    return <PreparingShell />;
  }
  if (outcome.result === null) {
    notFound();
  }

  const { listing, destination, hasEvidence } = outcome.result;

  // Pass-10b · Discover this area · fetch shared area intelligence
  // for the listing's (city, country) tuple. Returns null when no
  // researched area entry exists · the UI handles the honest
  // "not yet researched" case.
  const areaIntel = await fetchAreaIntelligence(listing.city, listing.country);

  // Owner-claimed destinations redirect to the owner's existing cover /
  // profile. The Directory detail page is specifically for unowned /
  // place-only canonical rows.
  if (destination.kind === "nex_business") {
    redirect(destination.path);
  }
  if (destination.kind === "nex_user_profile") {
    redirect(destination.path);
  }
  // SUPERSEDED chain · the detail page follows one hop via Next.js
  // server redirect. The target id's detail page then re-resolves
  // (and if that is also SUPERSEDED, redirects again · bounded by
  // the lifecycle discipline that chains terminate in a non-SUPERSEDED
  // row).
  if (destination.kind === "redirect_to_canonical") {
    redirect(buildDirectoryDetailPath(destination.targetBusinessId));
  }
  // Honest unresolved: fall through to notFound rather than render
  // a defective detail. Defensive · the resolver should not emit
  // "unresolved" for a row we just read, but we never fabricate a
  // destination to recover.
  if (destination.kind === "unresolved") {
    notFound();
  }

  // destination.kind is now `claim_available` or `place_detail`.
  return (
    <UserLocationProvider initialServerLocation={initialServerLocation}>
      <DetailShell
        listing={listing}
        destination={destination}
        hasEvidence={hasEvidence}
        areaIntel={areaIntel}
      />
    </UserLocationProvider>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Shells
// ═════════════════════════════════════════════════════════════════════

function PageFrame(props: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <main
      data-nex-directory-detail-page
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "0 20px 48px 20px",
          width: "100%",
        }}
      >
        <NexPageHeader dataScope="directory-detail" />
        <BackToDirectory />
        {props.children}
      </div>
    </main>
  );
}

function BackToDirectory(): React.ReactElement {
  return (
    <nav
      aria-label="Directory navigation"
      data-nex-directory-detail-back
      style={{ marginTop: 20, marginBottom: 8 }}
    >
      <Link
        href="/nex-native/directory"
        style={{
          color: NEX.textDim,
          fontSize: 13,
          fontWeight: 500,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <ChevronLeft />
        Back to Directory
      </Link>
    </nav>
  );
}

function PreparingShell(): React.ReactElement {
  return (
    <PageFrame>
      <section
        data-nex-directory-detail-state="preparing"
        style={{
          background: NEX.surface,
          border: `1px solid ${NEX.borderSoft}`,
          borderRadius: 16,
          padding: "28px 20px",
          textAlign: "center",
          marginTop: 20,
        }}
      >
        <h1
          style={{
            margin: 0,
            color: NEX.text,
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          The NEX Directory is being prepared.
        </h1>
        <p
          style={{
            margin: "10px 0 0 0",
            color: NEX.textMuted,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          Verified business and people data is being carefully assembled
          and reviewed. Come back soon.
        </p>
      </section>
    </PageFrame>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Detail content
// ═════════════════════════════════════════════════════════════════════

function DetailShell(props: {
  readonly listing: DirectoryListingVM;
  readonly destination: DirectoryDestination;
  readonly hasEvidence: boolean;
  readonly areaIntel: AreaIntelligence | null;
}): React.ReactElement {
  const { listing, destination, hasEvidence, areaIntel } = props;

  // Owner-claim affordance renders only when the destination is NOT the
  // owner's own cover · for `nex_business` / `nex_user_profile` the
  // earlier redirects have already left this component.
  // destination.kind is now `claim_available` or `place_detail`.
  // `place_detail` is intentionally read-only (public cultural / natural
  // places have no owner-claim path) · gate claim affordance on
  // `claim_available` only, matching the panel flow's `unclaimed` rule.
  const canClaim = destination.kind === "claim_available";

  return (
    <PageFrame>
      <article
        data-nex-directory-detail-canonical-id={listing.canonicalBusinessId}
        data-nex-directory-detail-classification={listing.classification}
        data-nex-directory-detail-destination-kind={destination.kind}
        data-nex-directory-detail-has-image={
          listing.primaryImage !== null ? "true" : "false"
        }
        data-nex-directory-detail-has-evidence={hasEvidence ? "true" : "false"}
        style={{ marginTop: 12 }}
      >
        <HeroSection listing={listing} />
        <AliasesSection listing={listing} />
        <AboutSection listing={listing} />
        <CategoriesSection listing={listing} />
        <LocationSection listing={listing} areaIntel={areaIntel} />
        <OpeningHoursSection listing={listing} />
        <ContactSection listing={listing} />
      </article>
      {/* NOTE (2026-10-13) · the DiscoverThisArea mount was moved from
          here into LocationSection so the area context sits directly
          below the km-away chip on EVERY listing. See the permanent
          requirement comment on LocationSection above and the
          regression test at [id]/__tests__/area-information-placement.test.ts.
          Do NOT re-add a page-level DiscoverThisArea mount here. */}
      <RelatedBusinessesPageSection listing={listing} />
      {canClaim ? <ClaimListingPageSection listing={listing} /> : null}
    </PageFrame>
  );
}

// ─── "You may also need" · page-level mount ──────────────────────────
//
// Mounts the shared `RelatedBusinessesSectionClient` client component.
// Honest empty states are already handled by the component itself (no
// coords → renders nothing · empty response → muted microcopy).
//
// We wrap it in a labelled section so the detail page gets a stable
// `data-nex-detail-page-related` selector and a visible heading. The
// component renders its own inner list; this wrapper does NOT duplicate
// or style its output.

function RelatedBusinessesPageSection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement {
  return (
    <section
      data-nex-detail-page-related
      aria-labelledby="nex-detail-page-related-heading"
      style={{
        marginTop: 28,
        background: NEX.surface,
        border: `1px solid ${NEX.borderSoft}`,
        borderRadius: 16,
        padding: "18px 20px",
      }}
    >
      <h2
        id="nex-detail-page-related-heading"
        style={{
          margin: "0 0 10px 0",
          color: NEX.textDim,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        You may also need
      </h2>
      <RelatedBusinessesSectionClient listing={props.listing} />
    </section>
  );
}

// ─── "Claim this listing" · page-level mount ─────────────────────────
//
// The sealed `OwnerClaimForm` is a full-screen multi-step flow when
// mounted directly. On the detail page we want a less intrusive entry
// so the owner isn't dropped into a form before they're sure. We give
// the surface a stable `data-nex-detail-page-claim` wrapper and use a
// native `<details>` disclosure for the expand-on-click gate · no
// client-side state wiring needed, keeps the server-rendered page a
// simple scroll surface. The form itself remains the sealed client
// component · we do NOT duplicate its logic.

function ClaimListingPageSection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement {
  return (
    <section
      data-nex-detail-page-claim
      aria-labelledby="nex-detail-page-claim-heading"
      style={{
        marginTop: 20,
        background: NEX.surface,
        border: `1px solid ${NEX.borderSoft}`,
        borderRadius: 16,
        padding: "18px 20px",
      }}
    >
      <h2
        id="nex-detail-page-claim-heading"
        style={{
          margin: "0 0 10px 0",
          color: NEX.textDim,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Claim this listing
      </h2>
      <details
        data-nex-detail-page-claim-disclosure
        style={{
          color: NEX.textDim,
          fontSize: 13.5,
          lineHeight: 1.5,
        }}
      >
        <summary
          data-nex-detail-page-claim-open
          style={{
            cursor: "pointer",
            padding: "10px 14px",
            borderRadius: 999,
            background: NEX.cyanFaint,
            color: NEX.cyan,
            border: `1px solid ${NEX.cyan}`,
            fontSize: 14,
            fontWeight: 600,
            display: "inline-block",
            width: "fit-content",
            listStyle: "none",
          }}
        >
          Open claim form
        </summary>
        <div style={{ marginTop: 14 }}>
          <OwnerClaimForm
            listing={props.listing}
            canonicalId={props.listing.canonicalBusinessId}
          />
        </div>
      </details>
    </section>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────

function HeroSection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement {
  const { listing } = props;
  // The "Verified" chip is gated on `lifecycleState` (the sealed
  // enum values VERIFIED and OWNER_VERIFIED) · NOT on evidence-row
  // presence. See _verified.ts for the semantic rationale: evidence
  // is provenance, lifecycle is verification.
  const verified = isVerifiedLifecycle(listing.lifecycleState);
  return (
    <section
      data-nex-directory-detail-hero
      style={{
        marginTop: 20,
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      <HeroImage listing={listing} />
      <div
        style={{
          flex: 1,
          minWidth: 220,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            data-nex-directory-detail-chip="classification"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: CLASSIFICATION_ACCENT[listing.classification],
            }}
          >
            {CLASSIFICATION_LABEL[listing.classification]}
          </span>
          {verified ? (
            <span
              data-nex-directory-detail-chip="verified"
              aria-label="Verified listing"
              title="Verified listing"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: NEX.cyan,
                padding: "2px 8px",
                borderRadius: 999,
                border: `1px solid ${NEX.cyan}`,
                background: NEX.cyanFaint,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <VerifiedGlyph />
              Verified
            </span>
          ) : null}
        </div>
        <h1
          data-nex-directory-detail-name
          style={{
            margin: 0,
            color: NEX.text,
            fontSize: 26,
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            wordBreak: "break-word",
          }}
        >
          {listing.name}
        </h1>
      </div>
    </section>
  );
}

function HeroImage(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement {
  const { listing } = props;
  if (listing.primaryImage !== null) {
    return (
      <div
        data-nex-directory-detail-image="present"
        style={{
          width: 140,
          height: 140,
          flexShrink: 0,
          borderRadius: 18,
          overflow: "hidden",
          background: NEX.surfaceHi,
        }}
      >
        {/* Plain <img> · Phase B contract is a plain URL string.
            next/image allowlist is a future wave. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={listing.primaryImage.url}
          alt={listing.primaryImage.altText || listing.name}
          data-nex-directory-detail-image-src
          loading="lazy"
          decoding="async"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>
    );
  }

  // No owner-uploaded primary image. If the listing's primary
  // category is one we have an approved category image for, use that
  // as a representative hero · with an EXPLICIT caption so the
  // visitor knows it is a category-level example and not a photo of
  // this specific business.
  const categoryHero = getPrimaryCategoryMetadata(listing.categoryIds);
  if (categoryHero !== null) {
    return (
      <div
        data-nex-directory-detail-image="category-example"
        data-nex-directory-detail-image-category={categoryHero.slug}
        style={{
          width: 140,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 18,
            overflow: "hidden",
            background: NEX.surfaceHi,
            border: `1px solid ${NEX.borderSoft}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={categoryHero.heroImageUrl}
            alt={categoryHero.altText}
            data-nex-directory-detail-image-src
            loading="lazy"
            decoding="async"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
        <span
          data-nex-directory-detail-image-caption
          style={{
            fontSize: 10.5,
            color: NEX.textSoft,
            lineHeight: 1.3,
            textAlign: "center",
          }}
        >
          Example image · owner has not uploaded photos
        </span>
      </div>
    );
  }

  return (
    <div
      data-nex-directory-detail-image="absent"
      style={{ flexShrink: 0 }}
    >
      <NoImage classification={listing.classification} name={listing.name} />
    </div>
  );
}

// ─── Aliases ──────────────────────────────────────────────────────────

function AliasesSection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement | null {
  const aliases = props.listing.aliases.filter(
    (a) => a.trim().length > 0,
  );
  if (aliases.length === 0) return null;
  return (
    <section
      data-nex-directory-detail-aliases
      style={{ marginTop: 10 }}
    >
      <p
        style={{
          margin: 0,
          color: NEX.textSoft,
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        Also known as: {aliases.join(" · ")}
      </p>
    </section>
  );
}

// ─── About · reserved for future description/overview column ─────────

function AboutSection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement | null {
  // The canonical table does not currently expose a free-text
  // description / overview column. When migration 175's
  // `nex.business_directory_v` view (or an equivalent later wave) adds
  // one, read it here. Until then, this section renders nothing · we
  // never fabricate "about" copy.
  void props;
  return null;
}

// ─── Categories ──────────────────────────────────────────────────────

function CategoriesSection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement | null {
  const categories = props.listing.categoryIds.filter(
    (c) => c.trim().length > 0,
  );
  if (categories.length === 0) return null;
  const { known, unknown } = partitionCategories(categories);
  return (
    <SectionBlock title="Services and categories" dataAttr="categories">
      {known.length > 0 ? (
        <div
          data-nex-directory-detail-category-cards
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {known.map((meta) => (
            <CategoryCard key={meta.slug} meta={meta} />
          ))}
        </div>
      ) : null}
      {unknown.length > 0 ? (
        <ul
          aria-label="Other categories"
          data-nex-directory-detail-category-chips
          style={{
            margin: known.length > 0 ? "12px 0 0 0" : 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {unknown.map((c) => (
            <li
              key={c}
              data-nex-directory-detail-category-chip={c}
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                padding: "4px 10px",
                background: NEX.surfaceHi,
                color: NEX.textDim,
                borderRadius: 999,
              }}
            >
              {c}
            </li>
          ))}
        </ul>
      ) : null}
    </SectionBlock>
  );
}

/** Known-category card · square image with rounded corners, title,
 *  and a visitor-facing description. Category-level content, never
 *  specific to the individual business. */
function CategoryCard(props: {
  readonly meta: CategoryMetadata;
}): React.ReactElement {
  const { meta } = props;
  return (
    <div
      data-nex-directory-detail-category-card
      data-nex-directory-detail-category-card-slug={meta.slug}
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 96,
          height: 96,
          borderRadius: 14,
          overflow: "hidden",
          background: NEX.surfaceHi,
          border: `1px solid ${NEX.borderSoft}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={meta.heroImageUrl}
          alt={meta.altText}
          data-nex-directory-detail-category-card-image
          loading="lazy"
          decoding="async"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: NEX.text,
            lineHeight: 1.2,
          }}
        >
          {meta.title}
        </div>
        <p
          data-nex-directory-detail-category-card-description
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.5,
            color: NEX.textDim,
          }}
        >
          {meta.description}
        </p>
      </div>
    </div>
  );
}

// ─── Location ────────────────────────────────────────────────────────

function LocationSection(props: {
  readonly listing: DirectoryListingVM;
  // Permanent requirement · see docs/doctrine/area-information-doctrine.md.
  // Every business detail page MUST mount DiscoverThisArea inside this
  // section, immediately below the km-away distance chip. Future
  // listing types, page redesigns and card refactors MUST preserve
  // this contract. See the companion regression test at
  // src/app/nex-native/directory/[id]/__tests__/area-information-placement.test.ts
  readonly areaIntel: AreaIntelligence | null;
}): React.ReactElement | null {
  const {
    city,
    district,
    country,
    streetLine,
    neighbourhood,
    address,
    coordinates,
  } = props.listing;

  // Each location field is rendered independently when present ·
  // honoring the no-concatenation rule. We do NOT fabricate a full
  // address by stitching together partial fields from the source.
  // The address jsonb column is open-shape · fields may be absent
  // entirely (undefined), explicitly null, or a trimmable string.
  // Guard against all three with a single typeof check so a canonical
  // row written by any walker (OSM Overpass, legacy backfill, future
  // sources) renders without a Runtime TypeError.
  const addressLine1HasValue =
    address !== null &&
    typeof address.line1 === "string" &&
    address.line1.trim().length > 0;
  const addressPostalHasValue =
    address !== null &&
    typeof address.postal_code === "string" &&
    address.postal_code.trim().length > 0;
  const streetLineHasValue =
    typeof streetLine === "string" && streetLine.trim().length > 0;
  const neighbourhoodHasValue =
    typeof neighbourhood === "string" && neighbourhood.trim().length > 0;
  const districtHasValue = district !== null && district.length > 0;
  const cityHasValue = city !== null && city.length > 0;
  const countryHasValue = country.length > 0;

  // Area line (district / city / country-name) composed
  // deterministically. The country token resolves ISO 3166 alpha-2 to
  // the common English name via ISO_COUNTRIES; when the lookup misses
  // we show the raw ISO code honestly rather than skipping.
  const countryName = resolveCountryName(country);
  const flag = flagEmojiForIso(country);
  const areaParts: string[] = [];
  if (districtHasValue) areaParts.push(district!);
  if (cityHasValue) areaParts.push(city!);
  if (countryHasValue) areaParts.push(countryName);
  const hasAreaLine = areaParts.length > 0;

  const hasAnyText =
    addressLine1HasValue ||
    addressPostalHasValue ||
    streetLineHasValue ||
    neighbourhoodHasValue ||
    hasAreaLine;
  const hasCoords = coordinates !== null;
  if (!hasAnyText && !hasCoords) return null;

  // Rendered order top → bottom (bold → muted):
  //   address.line1 (free-text address from source)
  //   street_line   (dedicated structured street column)
  //   neighbourhood
  //   area (district · city · country)
  //   postal_code (small chip below area · only when populated)
  //   distance chip
  // Each line hides when its backing field is empty · no concatenation.
  const topLinePresent = addressLine1HasValue;
  const secondLinePresent = !topLinePresent && streetLineHasValue;

  return (
    <SectionBlock title="Location" dataAttr="location">
      <div
        data-nex-directory-detail-location-head
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <MapPinPing size={22} accentColor={NEX.cyan} />
        <div
          data-nex-directory-detail-location-head-primary
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            fontSize: 14,
            color: NEX.text,
            fontWeight: 500,
          }}
        >
          {flag !== null ? (
            <span
              aria-hidden="true"
              data-nex-directory-detail-location-flag
              style={{ fontSize: 18, lineHeight: 1 }}
            >
              {flag}
            </span>
          ) : null}
          <span
            data-nex-directory-detail-location-area
            data-nex-directory-detail-location-iso={country}
          >
            {hasAreaLine ? areaParts.join(" · ") : countryName}
          </span>
        </div>
      </div>
      {addressLine1HasValue ? (
        <p
          data-nex-directory-detail-location-line="address-line1"
          style={{
            margin: 0,
            color: NEX.text,
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          {address!.line1}
        </p>
      ) : null}
      {streetLineHasValue ? (
        <p
          data-nex-directory-detail-location-line="street"
          style={{
            margin: topLinePresent ? "4px 0 0 0" : 0,
            color: topLinePresent ? NEX.textDim : NEX.text,
            fontSize: 14,
            fontWeight: topLinePresent ? 400 : 500,
            lineHeight: 1.5,
          }}
        >
          {streetLine}
        </p>
      ) : null}
      {neighbourhoodHasValue ? (
        <p
          data-nex-directory-detail-location-line="neighbourhood"
          style={{
            margin:
              topLinePresent || secondLinePresent ? "4px 0 0 0" : 0,
            color: NEX.textDim,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {neighbourhood}
        </p>
      ) : null}
      {/* The area line (district · city · country) is rendered in the
          Location head above (next to the map-pin ping + flag). We do
          NOT duplicate it here · the head is now the authoritative
          area display. The address-line1 / street / neighbourhood
          children stay as additional detail below the head. */}
      {addressPostalHasValue ? (
        <p
          data-nex-directory-detail-location-line="postal_code"
          style={{
            margin: "4px 0 0 0",
            color: NEX.textMuted,
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          Postal code: {address!.postal_code}
        </p>
      ) : null}
      <DetailDistanceChip listingCoords={coordinates} />
      {/* PERMANENT REQUIREMENT (2026-10-13):
          Every business-detail LocationSection MUST render
          DiscoverThisArea directly below the km-away chip. This is
          the single source of discovery context on each listing.
          See docs/doctrine/area-information-doctrine.md.
          Honest-null: the component returns null when the city has
          no researched area intel yet, so this mount site is safe
          to leave in place while coverage expands city by city. */}
      <div
        data-nex-directory-detail-location-area-intel
        style={{ marginTop: 12 }}
      >
        <DiscoverThisArea intel={props.areaIntel} />
      </div>
      {props.listing.isOsmAttributed ? (
        <div
          data-nex-directory-detail-location-attribution
          style={{ marginTop: 10 }}
        >
          <OsmAttributionBadge
            osmId={props.listing.osmId}
            size="detail"
          />
        </div>
      ) : null}
    </SectionBlock>
  );
}

// ─── Country name helper · ISO 3166 alpha-2 → common English name ───

/** Resolve "ID" to "Indonesia" via the sealed ISO_COUNTRIES table.
 *  Falls back to the raw code when the lookup misses rather than
 *  returning a fabricated name. Pure. */
function resolveCountryName(iso: string): string {
  if (!/^[A-Z]{2}$/.test(iso)) return iso;
  for (const entry of ISO_COUNTRIES) {
    if (entry.isoAlpha2 === iso) return entry.name;
  }
  return iso;
}

// ─── Opening hours section · honest "unknown" fallback ──────────────

function OpeningHoursSection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement {
  // Business owners who claim the listing can later set structured
  // weekly hours; today the only source is the OSM `opening_hours`
  // tag projected through the enrichment overlay. If the overlay
  // did not carry a value, the row has no recorded hours · we show
  // "Opening hours unknown" rather than fabricating.
  //
  // The section ALWAYS renders · "unknown" is a legitimate status
  // the visitor needs to see so they don't assume the business is
  // open or closed without evidence.
  const raw = props.listing.openingHoursText;
  const text =
    raw !== null && raw.trim().length > 0 ? raw.trim() : null;
  return (
    <SectionBlock title="Opening hours" dataAttr="opening-hours">
      <div
        data-nex-directory-detail-hours
        data-nex-directory-detail-hours-known={text !== null ? "true" : "false"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <ClockGlyph muted={text === null} />
        {text !== null ? (
          <span
            style={{
              fontSize: 14,
              color: NEX.text,
              lineHeight: 1.4,
              wordBreak: "break-word",
            }}
          >
            {text}
          </span>
        ) : (
          <span
            style={{
              fontSize: 13,
              color: NEX.textMuted,
              lineHeight: 1.4,
              fontStyle: "italic",
            }}
          >
            Opening hours unknown — the owner can add them when they claim
            this listing.
          </span>
        )}
      </div>
    </SectionBlock>
  );
}

// ─── Contact · primary interaction area ──────────────────────────────

function ContactSection(props: {
  readonly listing: DirectoryListingVM;
}): React.ReactElement | null {
  // Deliberately NO WhatsApp action here. NEX is the messaging product
  // (NEX chat with NEX ID is the WhatsApp replacement) · sending a
  // visitor to WhatsApp would hand them to a competitor. Phone-only
  // tel: + Website are the two real actions when the business is
  // unclaimed; once an owner claims the listing the destination becomes
  // nex_business and this page redirects to the owner's /nex-native/
  // {slug} cover (which carries the real Message-on-NEX action).
  const { phoneE164, websiteApex } = props.listing;
  const phoneHref = phoneHrefOrNull(phoneE164);
  const websiteHref =
    websiteApex !== null && websiteApex.trim().length > 0
      ? buildWebsiteHref(websiteApex)
      : null;
  if (phoneHref === null && websiteHref === null) {
    return null;
  }
  return (
    <SectionBlock title="Contact" dataAttr="contact">
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {phoneHref !== null ? (
          <a
            href={phoneHref}
            data-nex-directory-detail-action="call"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              borderRadius: 999,
              background: NEX.orange,
              color: "#1A1300",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <PhoneGlyph />
            Call
          </a>
        ) : null}
        {websiteHref !== null ? (
          <a
            href={websiteHref}
            target="_blank"
            rel="noopener noreferrer"
            data-nex-directory-detail-action="website"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              borderRadius: 999,
              background: NEX.surfaceHi,
              color: NEX.text,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              border: `1px solid ${NEX.borderSoft}`,
            }}
          >
            <GlobeGlyph />
            Website
          </a>
        ) : null}
      </div>
    </SectionBlock>
  );
}

/** Build a safe `tel:` href. Strips spaces · the canonical column is
 *  already E.164 when non-null, but we accept the enrichment-overlay
 *  value which may be a raw OSM phone string with spaces or dashes.
 *  Returns null when the value is empty after trimming. Pure. */
function phoneHrefOrNull(phone: string | null): string | null {
  if (phone === null) return null;
  const trimmed = phone.trim();
  if (trimmed.length === 0) return null;
  // Keep "+" for international prefixes; strip whitespace. Everything
  // else (digits, dashes, parens) is tel:-safe per RFC 3966.
  const compact = trimmed.replace(/\s+/g, "");
  return `tel:${compact}`;
}

/** Build a safe https:// href from a `website_apex` value. The canonical
 *  CHECK constraint already enforces that `website_apex` is a plain host
 *  (no scheme, no path, no credentials); we prefix `https://` for the
 *  href. Pure. */
function buildWebsiteHref(websiteApex: string): string {
  const trimmed = websiteApex.trim();
  return `https://${trimmed}`;
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Shared section block
// ═════════════════════════════════════════════════════════════════════

function SectionBlock(props: {
  readonly title: string;
  readonly dataAttr: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <section
      data-nex-directory-detail-section={props.dataAttr}
      style={{
        marginTop: 22,
        background: NEX.surface,
        border: `1px solid ${NEX.borderSoft}`,
        borderRadius: 16,
        padding: "18px 20px",
      }}
    >
      <h2
        style={{
          margin: "0 0 10px 0",
          color: NEX.textDim,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {props.title}
      </h2>
      {props.children}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Glyphs
// ═════════════════════════════════════════════════════════════════════

function ChevronLeft(): React.ReactElement {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function VerifiedGlyph(): React.ReactElement {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function PhoneGlyph(): React.ReactElement {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.12.9.34 1.78.66 2.63a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.45-1.45a2 2 0 012.11-.45c.85.32 1.73.54 2.63.66A2 2 0 0122 16.92z" />
    </svg>
  );
}

function ClockGlyph(props: { readonly muted?: boolean }): React.ReactElement {
  const stroke = props.muted ? NEX.textSoft : NEX.cyan;
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function GlobeGlyph(): React.ReactElement {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 010 20" />
      <path d="M12 2a15.3 15.3 0 000 20" />
    </svg>
  );
}
