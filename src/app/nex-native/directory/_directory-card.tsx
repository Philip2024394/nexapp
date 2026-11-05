// src/app/nex-native/directory/_directory-card.tsx
//
// NEX Directory · Phase A · The Directory listing card.
//
// What this is
//   · The single reusable Directory listing card component.
//   · Renders the real canonical view-model honestly: real identity,
//     real image when present, real location, real distance when the
//     viewer has granted geolocation, real categories, real
//     destination action.
//   · Missing data disappears gracefully — no "N/A", no fake fields,
//     no fabricated imagery, no made-up ratings, no invented
//     distances.
//
// What this is NOT
//   · Not a parallel Business/Profile detail component — clicking a
//     card takes the user to the EXISTING NEX Business cover or
//     EXISTING NEX user profile. The Directory is a discovery
//     layer INTO NEX.
//   · Not a mutator — card is read-only.
//   · Not a route owner — the Directory only hosts the listing
//     surface; the clicked route is NEX's existing destination.
//
// Destination behaviours (sealed by Phase C discriminated union)
//   nex_business              → full-card <Link> → /nex-native/{slug}
//   nex_user_profile          → full-card <Link> → /nex-native/u/{handle}
//   claim_available           → full-card <Link> → /nex-native/directory/{id}
//                               (Directory-side detail page · no "Unclaimed"
//                               label shown to visitors · ownership state
//                               is preserved internally via
//                               data-nex-directory-card-destination-kind
//                               for future NEX Marketing / acquisition work)
//   place_detail              → full-card <Link> → /nex-native/directory/{id}
//                               (same Directory-side detail page · place
//                               entities are not claimable; the detail
//                               page shows read-only canonical content)
//   redirect_to_canonical     → should not reach the card (service
//                               layer is responsible for re-resolving
//                               the chain · the server component
//                               pre-filters these)
//   unresolved                → should not reach the card (same ·
//                               the server component pre-filters)

"use client";

import type * as React from "react";
import Link from "next/link";
import type {
  DirectoryClassification,
  DirectoryCoordinates,
  DirectoryDestination,
  DirectoryListingVM,
} from "@/lib/nex-native/directory";
import { formatKmDistance, haversineKmOrNull } from "./_distance";
import { NoImage } from "./_no-image";
import { buildDirectoryDetailPath } from "./_routes";
import { CardCtaStrip } from "@/components/nex-native/directory/CardCtaStrip";
import {
  resolveCategoryImage,
  type CategoryImageLibraryRow,
  type CategoryImageResolved,
} from "@/lib/nex-native/directory/category-image-resolver";
import type { AreaIntelligence } from "@/lib/nex-native/directory/area-intelligence-types";
import { OsmAttributionBadge } from "@/components/nex-native/directory/OsmAttributionBadge";
// Phase 1c Batch 4 · 2026-11-06 · LiveProductIndicator removed with
// the Live Commerce surface deletion (scope reduction).

const PALETTE = {
  surface: "#0E1526",
  surfaceHi: "#182540",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  textSoft: "#4B6683",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0,175,255,0.08)",
  borderSoft: "rgba(255,255,255,0.06)",
} as const;

const CLASSIFICATION_LABEL: Record<DirectoryClassification, string> = {
  business: "Business",
  person: "Person",
  place: "Place",
};

const CLASSIFICATION_ACCENT: Record<DirectoryClassification, string> = {
  business: PALETTE.orange,
  person: PALETTE.cyan,
  place: PALETTE.textDim,
};

export interface DirectoryCardProps {
  readonly listing: DirectoryListingVM;
  readonly destination: DirectoryDestination;
  readonly userCoords: DirectoryCoordinates | null;
  /** Opens the slide-up Directory detail panel. Wired by the parent
   *  (Agent B's results surface). Optional so the card remains
   *  usable in SSR / isolation / disabled contexts — the CTA strip
   *  renders the "View X" button as a disabled `<button>` when the
   *  callback is absent. */
  readonly onOpenDetail?: () => void;
  /** Opens the sealed listing-chat panel. Wired by the parent (Agent
   *  B's results surface). Optional for the same reasons as
   *  onOpenDetail; the "Message" CTA renders disabled when absent. */
  readonly onOpenChat?: () => void;
  /** The curated category-image library · threaded from page.tsx →
   *  DirectoryResults → each card. Used to resolve a representative
   *  illustration when the listing has no OWNER_IMAGE / VERIFIED_REAL
   *  primary image. Empty array when the DB is unreachable or the
   *  library has not been seeded · the card then renders the honest
   *  no-image fallback. */
  readonly categoryImageLibrary?: readonly CategoryImageLibraryRow[];
  /** Pass-10b · optional shared area intelligence. When present, the
   *  card renders a compact "Known for: …" chip derived from the
   *  area's shortSummary. Null when the listing's (city, country) has
   *  not been researched yet · no chip is shown rather than
   *  fabricating one. */
  readonly areaIntel?: AreaIntelligence | null;
  // Phase 1c Batch 4 · 2026-11-06 · `isOwnerLive` / `liveWatchHref` /
  // `liveExpiresInMs` props removed with the Live Commerce surface
  // deletion (scope reduction).
}

export function DirectoryCard(props: DirectoryCardProps): React.ReactElement {
  const {
    listing,
    destination,
    userCoords,
    onOpenDetail,
    onOpenChat,
    categoryImageLibrary,
    areaIntel,
  } = props;

  const distanceKm = haversineKmOrNull(userCoords, listing.coordinates);
  const distanceLabel = distanceKm === null ? null : formatKmDistance(distanceKm);
  // "Distance from me" is a standard card feature. When either side's
  // coordinates are missing (user has not granted geolocation yet, or
  // the canonical listing has no coordinates) the chip renders
  // "Location Unconfirmed" · an honest status label, not a fabricated
  // distance.
  const distanceChipLabel =
    distanceLabel !== null ? distanceLabel : "Location Unconfirmed";
  const distanceChipKind: "known" | "unconfirmed" =
    distanceLabel !== null ? "known" : "unconfirmed";
  const place = joinPlace(listing.city, listing.district);
  // Pass-10 enrichment overlay surfaced from `nex.food_business`
  // (phone / website / street line). Each chip renders only when the
  // underlying field is non-null · the "no fabrication" contract from
  // Phase B carries through verbatim. WhatsApp is NOT surfaced here
  // (NEX is the messaging product · see projector).
  const streetSnippet =
    listing.streetLine !== null && listing.streetLine.trim().length > 0
      ? truncateSnippet(listing.streetLine.trim(), 72)
      : null;
  const contactChips = buildContactChips(listing);

  // Keywords = aliases (variants of the name the user might search).
  // Deliberately NOT fabricated from `name_canonical` or
  // `category_ids` — aliases are a real column with real values.
  const keywords = listing.aliases.filter((a) => a.trim().length > 0);
  const categories = listing.categoryIds.filter((c) => c.trim().length > 0);

  // Every destination kind that reaches the card (page.tsx pre-filters
  // redirect_to_canonical + unresolved) now routes somewhere real:
  //   nex_business      → owner's existing /nex-native/{slug}
  //   nex_user_profile  → owner's existing /nex-native/u/{handle}
  //   claim_available   → Directory-side /nex-native/directory/{id}
  //   place_detail      → Directory-side /nex-native/directory/{id}
  // "Unclaimed" / ownership-status labels are deliberately NOT exposed
  // to the visitor; that state is preserved internally via
  // `data-nex-directory-card-destination-kind` for future acquisition work.
  const href = buildHref(destination);
  const isLinkable = href !== null;

  // Resolve a representative category illustration when the listing
  // has no OWNER_IMAGE / VERIFIED_REAL primary image. Pure · deterministic:
  // same (library snapshot + canonical id) → same variant on every render.
  // Returns null when the library hasn't been seeded OR when no tier
  // matches · the hero slot then renders the no-image fallback honestly.
  const representativeImage: CategoryImageResolved | null =
    listing.primaryImage === null && categoryImageLibrary !== undefined
      ? resolveCategoryImage({
          libraryRows: categoryImageLibrary,
          entityType: listing.entityType,
          categoryIds: listing.categoryIds,
          canonicalBusinessId: listing.canonicalBusinessId,
        })
      : null;

  const body = (
    <article
      data-nex-directory-card
      data-nex-directory-card-canonical-id={listing.canonicalBusinessId}
      data-nex-directory-card-classification={listing.classification}
      data-nex-directory-card-destination-kind={destination.kind}
      data-nex-directory-card-linkable={isLinkable ? "true" : "false"}
      data-nex-directory-card-has-image={listing.primaryImage !== null ? "true" : "false"}
      data-nex-directory-card-has-representative={representativeImage !== null ? "true" : "false"}
      data-nex-directory-card-has-distance={distanceLabel !== null ? "true" : "false"}
      style={{
        background: PALETTE.surface,
        border: `1px solid ${PALETTE.borderSoft}`,
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Landscape card · small 92×92 image on the left, body on the
          right. The hero-illustration slot has been removed per owner
          decision (2026-10-12) · a listing without an owner photo now
          shows the representative category illustration inline as the
          small thumb (ADR-0022-compliant · still flagged
          `isRepresentative:true` to the caption contract). */}
      <div
        style={{
          padding: 14,
          display: "flex",
          gap: 14,
          alignItems: "stretch",
        }}
      >
      <CardImage
        listing={listing}
        classification={listing.classification}
        representativeImage={representativeImage}
      />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {/* Title row · name on the left · km-distance pushed to the
            RIGHT side (2026-10-13 owner directive). The Business /
            Place / Person classification BADGE was removed in the
            same change · the internal `classification` state is
            still exposed via `data-nex-directory-card-classification`
            on the parent <article> for acquisition/analytics work,
            but it is NOT a visible UI chip anymore. */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            flexWrap: "nowrap",
          }}
        >
          <h3
            data-nex-directory-card-name
            style={{
              margin: 0,
              flex: 1,
              minWidth: 0,
              color: PALETTE.text,
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.3,
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {listing.name}
          </h3>
          {/* Phase 1c Batch 4 · 2026-11-06 · DirectoryCardLiveChip
              removed with Live Commerce surface deletion. */}
          <span
            data-nex-directory-card-chip="distance"
            data-nex-directory-card-distance-kind={distanceChipKind}
            aria-label={
              distanceChipKind === "known"
                ? `${distanceChipLabel} away`
                : "Distance from you is unavailable because location has not been shared or this listing has no coordinates"
            }
            style={{
              flexShrink: 0,
              marginLeft: "auto",
              fontSize: 14,
              fontWeight: 600,
              color:
                distanceChipKind === "known"
                  ? PALETTE.textDim
                  : PALETTE.textSoft,
              padding: "2px 10px",
              borderRadius: 999,
              border: `1px solid ${PALETTE.borderSoft}`,
              background:
                distanceChipKind === "known"
                  ? PALETTE.surfaceHi
                  : "transparent",
              whiteSpace: "nowrap",
            }}
          >
            {distanceChipLabel}
          </span>
        </div>
        {place !== null ? (
          <p
            data-nex-directory-card-place
            style={{
              margin: 0,
              color: PALETTE.textMuted,
              fontSize: 14,
              lineHeight: 1.4,
            }}
          >
            {place}
          </p>
        ) : null}
        {streetSnippet !== null ? (
          <p
            data-nex-directory-card-street
            style={{
              margin: 0,
              color: PALETTE.textSoft,
              fontSize: 14,
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {streetSnippet}
          </p>
        ) : null}
        {categories.length > 0 ? (
          <ul
            aria-label="Categories"
            data-nex-directory-card-categories
            style={{
              margin: "2px 0 0 0",
              padding: 0,
              listStyle: "none",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {categories.slice(0, 3).map((c) => (
              <li
                key={c}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "3px 10px",
                  background: PALETTE.surfaceHi,
                  color: PALETTE.textDim,
                  borderRadius: 999,
                }}
              >
                {c}
              </li>
            ))}
          </ul>
        ) : null}
        {keywords.length > 0 ? (
          <p
            data-nex-directory-card-keywords
            style={{
              margin: 0,
              color: PALETTE.textSoft,
              fontSize: 13,
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Also known as: {keywords.slice(0, 3).join(" · ")}
          </p>
        ) : null}
        {areaIntel !== null && areaIntel !== undefined ? (
          <p
            data-nex-directory-card-area-known-for
            data-nex-directory-card-area-id={areaIntel.areaId}
            style={{
              margin: "2px 0 0 0",
              color: PALETTE.textDim,
              fontSize: 13,
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            <span style={{ color: PALETTE.textSoft, fontWeight: 600, marginRight: 4 }}>
              Known for:
            </span>
            {areaIntel.shortSummary}
          </p>
        ) : null}
        {contactChips.length > 0 ? (
          <ul
            aria-label="Contact"
            data-nex-directory-card-contact
            style={{
              margin: "4px 0 0 0",
              padding: 0,
              listStyle: "none",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {contactChips.map((chip) => (
              <li
                key={chip.key}
                data-nex-directory-card-contact-chip={chip.key}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "3px 10px",
                  background: PALETTE.surfaceHi,
                  color: PALETTE.textDim,
                  borderRadius: 999,
                  border: `1px solid ${PALETTE.borderSoft}`,
                }}
              >
                {chip.label}
              </li>
            ))}
          </ul>
        ) : null}
        {listing.isOsmAttributed ? (
          <div style={{ marginTop: 4 }}>
            <OsmAttributionBadge osmId={listing.osmId} size="compact" />
          </div>
        ) : null}
        {/* Data-conditional CTA strip · the primary interaction
            surface on each card (Message · Call · Website ·
            Directions · View X). Horizontally scrollable on mobile.
            Buttons appear only when the underlying field on the real
            VM is present — never fabricated. The strip's
            stopPropagation on CTA clicks prevents the surrounding
            whole-card <Link> from swallowing the tap.
            The legacy "View shop →" chevron row was removed
            2026-10-12 · the CTA strip's "View X" button now carries
            the open-detail affordance so there is no duplicate CTA. */}
        <CardCtaStrip
          listing={listing}
          onOpenDetail={onOpenDetail}
          onOpenChat={onOpenChat}
        />
      </div>
      </div>
    </article>
  );

  if (isLinkable && href !== null) {
    return (
      <Link
        href={href}
        aria-label={`Open ${listing.name}`}
        data-nex-directory-card-link
        style={{ textDecoration: "none", color: "inherit" }}
      >
        {body}
      </Link>
    );
  }
  return body;
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Card image slot
// ═════════════════════════════════════════════════════════════════════

function CardImage(props: {
  readonly listing: DirectoryListingVM;
  readonly classification: DirectoryClassification;
  readonly representativeImage: CategoryImageResolved | null;
}): React.ReactElement {
  const { listing, classification, representativeImage } = props;
  // Tier 1 · owner-uploaded primary image
  if (listing.primaryImage !== null) {
    return (
      <div
        data-nex-directory-card-image="present"
        style={{
          width: 92,
          height: 92,
          flexShrink: 0,
          borderRadius: 14,
          overflow: "hidden",
          background: PALETTE.surfaceHi,
          position: "relative",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={listing.primaryImage.url}
          alt={listing.primaryImage.altText || listing.name}
          data-nex-directory-card-image-src
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
  // Tier 2 · resolved representative category image. Shown as the
  // same 92×92 thumb · never as a full-width hero.
  if (representativeImage !== null) {
    return (
      <div
        data-nex-directory-card-image="representative"
        data-nex-directory-card-image-category-slug={representativeImage.category_slug}
        style={{
          width: 92,
          height: 92,
          flexShrink: 0,
          borderRadius: 14,
          overflow: "hidden",
          background: PALETTE.surfaceHi,
          position: "relative",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={representativeImage.url}
          alt={`${listing.name} · representative illustration for ${representativeImage.category_slug}`}
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
  // Tier 3 · no image anywhere · honest absent-state glyph
  return (
    <div data-nex-directory-card-image="absent" style={{ flexShrink: 0 }}>
      <NoImage classification={classification} name={listing.name} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Pure helpers
// ═════════════════════════════════════════════════════════════════════

function joinPlace(
  city: string | null,
  district: string | null,
): string | null {
  const parts: string[] = [];
  if (district !== null && district.length > 0) parts.push(district);
  if (city !== null && city.length > 0) parts.push(city);
  return parts.length === 0 ? null : parts.join(" · ");
}

interface ContactChip {
  readonly key: "phone" | "website";
  readonly label: string;
}

/** Build the per-card contact chip set from the projected VM. Pure,
 *  deterministic. Returns an empty array when the listing has neither
 *  enrichment contact field set. Never fabricates. WhatsApp is
 *  intentionally NOT surfaced here: NEX is the messaging product (the
 *  WhatsApp replacement), so handing a visitor off to WhatsApp would
 *  send them to a competitor. OSM WhatsApp numbers stay in
 *  `nex.food_business.whatsapp_number` for HQ marketing outreach only
 *  — they never render on any public NEX surface. */
function buildContactChips(
  listing: DirectoryListingVM,
): readonly ContactChip[] {
  const chips: ContactChip[] = [];
  if (listing.phoneE164 !== null && listing.phoneE164.trim().length > 0) {
    chips.push({ key: "phone", label: "Phone" });
  }
  if (listing.websiteApex !== null && listing.websiteApex.trim().length > 0) {
    chips.push({ key: "website", label: "Website" });
  }
  return chips;
}

/** Shorten a snippet to a visual-length budget using Array.from length
 *  (code-point count · stable across emoji / combining marks) and
 *  append a trailing ellipsis when truncation occurred. Pure. */
function truncateSnippet(value: string, maxChars: number): string {
  const chars = Array.from(value);
  if (chars.length <= maxChars) return value;
  return chars.slice(0, Math.max(1, maxChars - 1)).join("") + "…";
}

/** Build the full-card href for every renderable destination kind.
 *  Returns null for destinations that should never reach the card
 *  (redirect_to_canonical / unresolved · pre-filtered in page.tsx).
 *
 *  Owner-claimed destinations route to their existing NEX cover /
 *  profile. Everything else routes to the Directory-side detail page.
 *  No destination kind is a dead card. */
// Phase 1c Batch 4 · 2026-11-06 · DirectoryCardLiveChip removed with
// the Live Commerce surface deletion (scope reduction).

function buildHref(destination: DirectoryDestination): string | null {
  if (destination.kind === "nex_business") return destination.path;
  if (destination.kind === "nex_user_profile") return destination.path;
  if (destination.kind === "claim_available") {
    return buildDirectoryDetailPath(destination.canonicalBusinessId);
  }
  if (destination.kind === "place_detail") {
    return buildDirectoryDetailPath(destination.canonicalBusinessId);
  }
  return null;
}

