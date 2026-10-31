// src/app/nex-native/dev/directory-detail-prototype/page.tsx
//
// NEX Directory · DEV PROTOTYPE · 2026-10-13.
//
// What this is
//   · A static-fixture prototype of the directory detail-page design
//     the founder specified (Bumas Hotel reference). Dev-only.
//   · Uses the real `ThumbnailStrip` component with a POPULATED
//     fixture so the sealed 3-state render matches production code.
//   · Honest-illustration rule: every thumbnail is a labelled SVG
//     with the word "illustrative" baked into the pixels. No real
//     business photo is implied.
//   · The Safe Stay button opens a centred overlay with the trust
//     profile details · click outside or press Escape to close.
//
// What this is NOT
//   · Not the real detail page · the real one lives at
//     src/app/nex-native/directory/[id]/page.tsx and renders real
//     canonical data from Supabase.
//   · Not wired to chat / claim / navigation · Chat now and Visit
//     us buttons are visual-only placeholders.
//   · Not a template for business imagery · if a real listing has no
//     approved image, the detail page renders the honest no-image
//     state (per `_no-image.tsx`), NOT these illustrative tiles.

"use client";

import type * as React from "react";
import { useEffect, useState } from "react";
import { ThumbnailStrip } from "../../directory/[id]/_thumbnail-strip";
import type { ThumbnailStripResult } from "@/lib/nex-native/directory/media-resolver";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
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
  amber: "#FBBF24",
} as const;

// ─── labelled illustrative SVG · zero external image loads ─────────

function makeIllustrativeSvg(label: string, hue: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='480' viewBox='0 0 480 480'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='hsl(${hue},45%,24%)'/>
        <stop offset='100%' stop-color='hsl(${hue},40%,14%)'/>
      </linearGradient>
    </defs>
    <rect width='480' height='480' fill='url(#g)'/>
    <text x='50%' y='48%' text-anchor='middle' font-family='Inter,sans-serif' font-size='24' font-weight='600' fill='#F2F5F8' opacity='0.92'>${label}</text>
    <text x='50%' y='58%' text-anchor='middle' font-family='Inter,sans-serif' font-size='13' fill='#B5C3D6' opacity='0.75' letter-spacing='1'>ILLUSTRATIVE</text>
  </svg>`;
  // encodeURIComponent on the raw SVG; data URI payload.
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ─── fixture · Bumas Hotel reference listing ───────────────────────

const BUMAS = {
  name: "Bumas Hotel",
  city: "Denpasar",
  region: "Bali",
  country: "Indonesia",
  entityType: "accommodation" as const,
  categoryLabel: "Hotel",
  description:
    "Comfortable accommodation for holidays and longer stays. Contact the hotel for room availability, prices and amenities.",
  exploreLabel: "Explore rooms and facilities",
  heroImage: makeIllustrativeSvg("Bumas Hotel", 210),
};

const STRIP_FIXTURE: ThumbnailStripResult = {
  ok: true,
  images: [
    {
      url: makeIllustrativeSvg("Standard room", 210),
      altText: "Standard room · illustrative example",
      sourceId: "owner_upload",
    },
    {
      url: makeIllustrativeSvg("Deluxe room", 32),
      altText: "Deluxe room · illustrative example",
      sourceId: "owner_upload",
    },
    {
      url: makeIllustrativeSvg("Pool & facilities", 170),
      altText: "Pool and facilities · illustrative example",
      sourceId: "owner_upload",
    },
  ],
};

// ─── prototype page ───────────────────────────────────────────────

export default function DirectoryDetailPrototypePage(): React.ReactElement {
  const [safeStayOpen, setSafeStayOpen] = useState(false);
  const [visitUsOpen, setVisitUsOpen] = useState(false);
  const anyOverlayOpen = safeStayOpen || visitUsOpen;

  // ── Local-only photo drop-in (prototype dev tool) ──────────────
  // Lets the operator pick up to 4 images from their disk. The images
  // become blob: URLs IN THE BROWSER only · zero network · zero
  // storage · zero NEX session touch. The URLs are revoked on
  // teardown to avoid memory leaks. On reload the state resets to
  // illustrative SVGs.
  const [customHero, setCustomHero] = useState<string | null>(null);
  const [customThumbs, setCustomThumbs] = useState<readonly string[]>([]);

  // Revoke the blob: URLs when they change or on unmount.
  useEffect(() => {
    return () => {
      if (customHero) URL.revokeObjectURL(customHero);
      for (const u of customThumbs) URL.revokeObjectURL(u);
    };
  }, [customHero, customThumbs]);

  function handleFilesPicked(fileList: FileList | null): void {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 4);
    if (files.length === 0) return;
    // Clean up previous URLs before replacing.
    if (customHero) URL.revokeObjectURL(customHero);
    for (const u of customThumbs) URL.revokeObjectURL(u);
    const urls = files.map((f) => URL.createObjectURL(f));
    setCustomHero(urls[0] ?? null);
    setCustomThumbs(urls.slice(1));
  }

  function resetToIllustrative(): void {
    if (customHero) URL.revokeObjectURL(customHero);
    for (const u of customThumbs) URL.revokeObjectURL(u);
    setCustomHero(null);
    setCustomThumbs([]);
  }

  // The effective hero + strip fixtures · fall back to illustrative
  // SVGs when the operator hasn't picked custom photos.
  const effectiveHeroSrc = customHero ?? BUMAS.heroImage;
  const effectiveStripFixture: ThumbnailStripResult =
    customThumbs.length > 0
      ? {
          ok: true,
          images: customThumbs.map((url, i) => ({
            url,
            altText: `${BUMAS.name} · local photo ${i + 1}`,
            sourceId: "local_file_drop_in",
          })),
        }
      : STRIP_FIXTURE;

  // Close on Escape key for keyboard parity (both overlays).
  useEffect(() => {
    if (!anyOverlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSafeStayOpen(false);
        setVisitUsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anyOverlayOpen]);

  // Lock scroll while any overlay is open.
  useEffect(() => {
    if (!anyOverlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [anyOverlayOpen]);

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; margin: 0; padding: 0; }`}</style>
      <main
        data-nex-dev-prototype="directory-detail"
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          paddingBottom: 48,
        }}
      >
        <PrototypeHeader />
        <PhotoDropIn
          hasCustom={customHero !== null || customThumbs.length > 0}
          onFilesPicked={handleFilesPicked}
          onReset={resetToIllustrative}
          customCount={(customHero ? 1 : 0) + customThumbs.length}
        />
        <article
          data-nex-prototype-article
          style={{
            maxWidth: 720,
            margin: "0 auto",
          }}
        >
          {/* Hero + identity · image on LEFT with name/location overlaid
              · right column holds the badges only */}
          <section
            data-nex-prototype-hero-identity
            style={{
              padding: "16px 20px 0",
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            {/* Image · small square · left side · clean (no overlay) */}
            <div
              data-nex-prototype-hero
              style={{
                flex: "0 0 auto",
                width: 120,
                height: 120,
                borderRadius: 14,
                overflow: "hidden",
                background: NEX.surfaceHi,
                position: "relative",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={effectiveHeroSrc}
                alt={
                  customHero
                    ? "Bumas Hotel · local-file preview"
                    : "Bumas Hotel · illustrative hero"
                }
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>

            {/* Middle column · business name + location */}
            <div
              data-nex-prototype-identity
              style={{
                flex: "1 1 160px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                gap: 6,
                minWidth: 0,
                paddingTop: 2,
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: NEX.text,
                  lineHeight: 1.15,
                }}
              >
                {BUMAS.name}
              </h1>
              <div
                style={{
                  fontSize: 13,
                  color: NEX.textDim,
                  lineHeight: 1.5,
                }}
              >
                {BUMAS.city}, {BUMAS.region} · {BUMAS.country}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: NEX.textMuted,
                  lineHeight: 1.5,
                }}
              >
                Jl. Diponegoro No. 55 · 80114
              </div>
              <div
                style={{
                  marginTop: 4,
                  display: "inline-flex",
                  alignItems: "center",
                  alignSelf: "flex-start",
                  gap: 4,
                  padding: "3px 10px",
                  background: NEX.cyanFaint,
                  border: `1px solid ${NEX.cyan}33`,
                  borderRadius: 999,
                  fontSize: 11,
                  color: NEX.cyan,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                }}
              >
                <span aria-hidden>📍</span>
                2.3 km away
              </div>
            </div>
          </section>

          {/* Category heading + Safe Stay (right) · description below */}
          <section
            data-nex-prototype-about
            style={{ padding: "22px 20px 0" }}
          >
            <div
              data-nex-prototype-category-row
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: NEX.orange,
                  lineHeight: 1.2,
                }}
              >
                {BUMAS.categoryLabel}
              </h2>

              {/* NEX Safe · category-adapted trust action · same row as
                  the category heading. Opens the centre overlay.
                  Doctrine: docs/doctrine/nex-safe-trust-system.md */}
              <button
                type="button"
                onClick={() => setSafeStayOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={safeStayOpen}
                aria-controls="nex-prototype-safe-stay-dialog"
                aria-label="Open Safe Stay trust profile"
                data-nex-prototype-safe-button
                data-nex-prototype-safe-category="stay"
                style={{
                  flex: "0 0 auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: 0,
                  background: "transparent",
                  border: "none",
                  color: NEX.cyan,
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: 0.2,
                  cursor: "pointer",
                }}
              >
                <span aria-hidden style={{ fontSize: 18 }}>🛡️</span>
                Safe Stay
              </button>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.6,
                color: NEX.textDim,
              }}
            >
              {BUMAS.description}
            </p>
            <div
              style={{
                marginTop: 14,
                fontSize: 12,
                color: NEX.textMuted,
                letterSpacing: 0.3,
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              {BUMAS.exploreLabel}
            </div>
          </section>

          {/* The real ThumbnailStrip component with POPULATED fixture.
              layout="grid" · 3-column full-width grid · each tile 1/3 of
              the row width with a 1:1 aspect ratio.
              hideHeading=true · "Explore rooms and facilities" already
              heads this section above.
              Fixture swaps to custom-dropped photos when present. */}
          <ThumbnailStrip
            result={effectiveStripFixture}
            businessName={BUMAS.name}
            layout="grid"
            hideHeading={true}
          />

          {/* Chat now + Visit us CTAs */}
          <section
            data-nex-prototype-cta-row
            style={{
              display: "flex",
              gap: 12,
              padding: "4px 20px 0",
            }}
          >
            <PrototypeButton
              variant="primary"
              label="Chat now"
              hint="Opens NEX Chat (visual only in prototype)"
              icon="💬"
            />
            {/* Visit us · opens the embedded Google Maps overlay */}
            <button
              type="button"
              onClick={() => setVisitUsOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={visitUsOpen}
              aria-controls="nex-prototype-visit-us-dialog"
              aria-label="Open walking map to Bumas Hotel"
              data-nex-prototype-button="secondary"
              style={{
                flex: 1,
                padding: "14px 18px",
                borderRadius: 14,
                border: "none",
                background: NEX.surfaceHi,
                color: NEX.text,
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: 0.2,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <span aria-hidden style={{ fontSize: 16 }}>📍</span>
              Visit us
            </button>
          </section>

          <ReceptionHoursSection />
          <DiscoverThisAreaSection />
          <RelatedBusinessesSection />
          <ClaimListingSection />

          {/* End-of-page footer note · prototype only */}
          <SafeStayOverlay
            open={safeStayOpen}
            onClose={() => setSafeStayOpen(false)}
          />
          <VisitUsOverlay
            open={visitUsOpen}
            onClose={() => setVisitUsOpen(false)}
          />
          <section
            data-nex-prototype-footer-note
            style={{
              margin: "32px 20px 0",
              padding: "14px 16px",
              borderRadius: 12,
              background: NEX.surface,
              border: `1px solid ${NEX.borderSoft}`,
              fontSize: 11,
              color: NEX.textMuted,
              lineHeight: 1.6,
            }}
          >
            End of prototype. All sections above use static fixtures. The
            real detail page at <code>/nex-native/directory/[id]</code>{" "}
            renders each section from the sealed canonical layer, with
            the approval gates and honest-null fallbacks enforced in
            production code.
          </section>
        </article>
      </main>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §A · Reception / booking hours (accommodation-specific)
// ═════════════════════════════════════════════════════════════════════
//
// Hotels operate 24 hours · what varies is reception desk and
// booking-support availability. On the real page this section is
// category-adapted per `business_canonical.entity_type`:
//   food                    → "Opening hours"
//   accommodation           → "Reception hours" + check-in / check-out
//   service / professional  → "Availability" (business hours · may
//                             include "by appointment")
//   place                   → "Visiting hours" (if any)
//   transport_operator      → "Service hours"
// For this prototype we show the accommodation shape.

function ReceptionHoursSection(): React.ReactElement {
  return (
    <section
      data-nex-prototype-section="reception-hours"
      style={{ padding: "28px 20px 0" }}
    >
      <SectionHeading label="Reception &amp; booking" />

      {/* Check-in / check-out · the two timestamps that matter for
          accommodation. 24h front-desk is the one activity flag. */}
      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <CheckBlock label="Check-in" value="from 14:00" />
        <CheckBlock label="Check-out" value="by 12:00" />
        <CheckBlock label="24h front desk" value="Yes" />
      </div>

      <div
        style={{
          marginTop: 12,
          fontSize: 11,
          color: NEX.textSoft,
          lineHeight: 1.5,
          letterSpacing: 0.2,
        }}
      >
        The hotel is open 24 hours. For arrivals outside standard
        check-in time, contact the hotel in advance to arrange late
        check-in.
      </div>
    </section>
  );
}

function CheckBlock(props: { readonly label: string; readonly value: string }): React.ReactElement {
  return (
    <div
      style={{
        flex: "1 1 140px",
        padding: "10px 14px",
        borderRadius: 10,
        background: NEX.surface,
        border: `1px solid ${NEX.borderSoft}`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: NEX.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          fontWeight: 600,
        }}
      >
        {props.label}
      </div>
      <div style={{ marginTop: 4, fontSize: 14, color: NEX.text, fontWeight: 600 }}>
        {props.value}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §C · Discover This Area (shared area intelligence)
// ═════════════════════════════════════════════════════════════════════

function DiscoverThisAreaSection(): React.ReactElement {
  const attractions = [
    { label: "Pura Jagatnatha", kind: "amenity:place_of_worship" },
    { label: "Puputan Square", kind: "historic:monument" },
    { label: "Bali Museum", kind: "tourism:museum" },
    { label: "Taman Werdhi Budaya", kind: "tourism:attraction" },
    { label: "Pasar Badung", kind: "shop:marketplace" },
  ];
  const transport = [
    { label: "Terminal Ubung", kind: "public_transport:station" },
    { label: "Ngurah Rai Airport", kind: "aeroway:aerodrome" },
    { label: "Pelabuhan Benoa", kind: "amenity:ferry_terminal" },
  ];
  return (
    <section
      data-nex-prototype-section="discover-this-area"
      style={{ padding: "28px 20px 0" }}
    >
      <SectionHeading label="Discover this area" />
      <div
        style={{
          marginTop: 10,
          padding: 16,
          borderRadius: 14,
          background: NEX.surface,
          border: `1px solid ${NEX.borderSoft}`,
        }}
      >
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <AreaIntelColumn
            heading="Attractions"
            glyph="🏛"
            items={attractions}
          />
          <AreaIntelColumn
            heading="Transport"
            glyph="🚉"
            items={transport}
          />
        </div>
        <div
          style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: `1px solid ${NEX.borderSoft}`,
            fontSize: 10,
            color: NEX.textSoft,
            letterSpacing: 0.3,
            lineHeight: 1.6,
          }}
        >
          © OpenStreetMap contributors (ODbL) · method:
          osm_overpass_landmarks_v1 · researched: 2026-10-12
        </div>
      </div>
    </section>
  );
}

// OSM taxonomy → human-readable category label.
// Keeps the raw OSM tag in the DB (provenance) · the UI only ever
// renders this friendly label. Falls back to a prettied version of the
// tag so unknown keys still read OK rather than showing raw code.
function humaniseOsmTag(tag: string): string {
  const map: Readonly<Record<string, string>> = {
    "amenity:place_of_worship": "Temple",
    "amenity:ferry_terminal": "Ferry terminal",
    "amenity:restaurant": "Restaurant",
    "amenity:cafe": "Café",
    "amenity:bar": "Bar",
    "historic:monument": "Monument",
    "historic:memorial": "Memorial",
    "historic:castle": "Castle",
    "historic:ruins": "Ruins",
    "historic:heritage": "Heritage",
    "historic:archaeological_site": "Archaeological site",
    "tourism:museum": "Museum",
    "tourism:attraction": "Attraction",
    "tourism:gallery": "Gallery",
    "tourism:viewpoint": "Viewpoint",
    "shop:marketplace": "Market",
    "public_transport:station": "Station",
    "public_transport:stop_position": "Transit stop",
    "aeroway:aerodrome": "Airport",
    "railway:station": "Train station",
    "amenity:bus_station": "Bus station",
  };
  if (map[tag]) return map[tag];
  // Fallback · prettify "foo:bar_baz" → "Bar baz"
  const parts = tag.split(":");
  const value = parts[parts.length - 1] ?? tag;
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function AreaIntelColumn(props: {
  readonly heading: string;
  readonly glyph: string;
  readonly items: readonly { readonly label: string; readonly kind: string }[];
}): React.ReactElement {
  return (
    <div style={{ flex: "1 1 220px", minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 10,
          fontSize: 12,
          color: NEX.textMuted,
          textTransform: "uppercase",
          letterSpacing: 1,
          fontWeight: 600,
        }}
      >
        <span aria-hidden>{props.glyph}</span>
        {props.heading}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {props.items.map((it) => (
          <li
            key={it.label}
            style={{
              padding: "8px 0",
              borderBottom: `1px solid ${NEX.borderSoft}`,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "baseline",
            }}
          >
              <span
                style={{
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: 14,
                  color: NEX.textDim,
                  lineHeight: 1.4,
                }}
              >
                {it.label}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: NEX.textMuted,
                  letterSpacing: 0.2,
                  flex: "0 0 auto",
                }}
              >
                {humaniseOsmTag(it.kind)}
              </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §D · Safe Stay overlay (opens from the Safe Stay button on the hero)
// ═════════════════════════════════════════════════════════════════════
//
// Centre-stage modal that renders the trust profile when the Safe Stay
// button is clicked. In production this is the "polished animated
// centre overlay" the founder specified · the prototype uses the same
// shape (backdrop + centred container + close button) · all content is
// static fixture data per the Bumas Hotel reference.

function SafeStayOverlay(props: {
  readonly open: boolean;
  readonly onClose: () => void;
}): React.ReactElement | null {
  if (!props.open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-prototype-safe-stay-title"
      id="nex-prototype-safe-stay-dialog"
      data-nex-prototype-safe-overlay
      onClick={props.onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(1, 4, 10, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        animation: "nex-safe-fade-in 180ms ease-out",
      }}
    >
      <style>{`
        @keyframes nex-safe-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes nex-safe-pop-in {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
      <div
        role="document"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "calc(100dvh - 40px)",
          overflowY: "auto",
          padding: 22,
          borderRadius: 20,
          background:
            `linear-gradient(180deg, ${NEX.surface} 0%, #0a1322 100%)`,
          border: `1px solid ${NEX.cyan}33`,
          boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px ${NEX.cyan}11`,
          animation: "nex-safe-pop-in 220ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
        }}
      >
        {/* Header · title + close */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <span aria-hidden style={{ fontSize: 24 }}>🛡️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              id="nex-prototype-safe-stay-title"
              style={{ fontSize: 16, fontWeight: 700, color: NEX.text }}
            >
              NEX Safe Stay
            </div>
            <div
              style={{
                fontSize: 11,
                color: NEX.textMuted,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              Business trust profile · evidence not opinion
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close trust profile"
            data-nex-prototype-safe-overlay-close
            style={{
              flex: "0 0 auto",
              width: 32,
              height: 32,
              borderRadius: 999,
              border: `1px solid ${NEX.borderSoft}`,
              background: "transparent",
              color: NEX.textDim,
              fontSize: 16,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        <TrustRow
          state="verified"
          title="Business identity verified"
          evidence="method: WhatsApp OTP · verified 2026-09-14"
        />
        <TrustRow
          state="verified"
          title="NEX account active since"
          evidence="2024-11-02 · 1 year 11 months"
        />
        <TrustRow
          state="verified"
          title="Typical response time"
          evidence="2h 14m median · 42 conversations · last 90 days"
        />
        <TrustRow
          state="partial"
          title="Supply capability"
          evidence="Local supply · International bookings · Languages: Indonesian, English"
        />
        <TrustRow
          state="verified"
          title="Complaint record"
          evidence="No qualifying complaints recorded in the 12-month window · honest-null · not a safety claim"
        />
        <TrustRow
          state="unknown"
          title="Owner response policy"
          evidence="Not yet published by the business"
        />

        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: `1px solid ${NEX.borderSoft}`,
            fontSize: 10,
            color: NEX.textSoft,
            lineHeight: 1.6,
            letterSpacing: 0.2,
          }}
        >
          Each item carries its own verification date. &quot;No qualifying
          complaints&quot; is honest-null · it does not mean &quot;safe.&quot;
          It means zero reports met independence + corroboration thresholds in
          the available window. See{" "}
          <code style={{ color: NEX.textMuted }}>
            docs/doctrine/nex-safe-trust-system.md
          </code>
          .
        </div>
      </div>
    </div>
  );
}

function TrustRow(props: {
  readonly state: "verified" | "partial" | "unknown" | "unavailable";
  readonly title: string;
  readonly evidence: string;
}): React.ReactElement {
  const stateMap = {
    verified: { icon: "✓", color: "#4ADE80", bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.3)", label: "Verified" },
    partial:  { icon: "◐", color: NEX.cyan,  bg: NEX.cyanFaint,            border: `${NEX.cyan}33`,           label: "Partial" },
    unknown:  { icon: "·", color: NEX.textMuted, bg: "transparent",         border: NEX.borderSoft,            label: "Not verified" },
    unavailable: { icon: "⟳", color: NEX.amber,  bg: "rgba(251,191,36,0.08)", border: `${NEX.amber}33`,         label: "Unable to verify" },
  } as const;
  const s = stateMap[props.state];
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "10px 0",
        borderBottom: `1px solid ${NEX.borderSoft}`,
      }}
    >
      <div
        style={{
          flex: "0 0 auto",
          width: 24,
          height: 24,
          borderRadius: 999,
          background: s.bg,
          border: `1px solid ${s.border}`,
          color: s.color,
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
        aria-hidden
      >
        {s.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 14, color: NEX.text, fontWeight: 500 }}>
            {props.title}
          </span>
          <span
            style={{
              fontSize: 10,
              color: s.color,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              fontWeight: 600,
            }}
          >
            {s.label}
          </span>
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            color: NEX.textMuted,
            lineHeight: 1.5,
          }}
        >
          {props.evidence}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §D2 · Visit us overlay · embedded Google Maps (no API key needed)
// ═════════════════════════════════════════════════════════════════════
//
// Opens on "Visit us" tap. Embeds Google Maps centred on the hotel's
// coordinates with walking-friendly zoom. The user can pan, zoom, and
// drop into Street View from the standard Google controls inside the
// iframe · all without leaving NEX.
//
// Prototype choice: no-API-key embed via `https://maps.google.com/maps?
// q=…&output=embed`. This is the format Google serves for embedded
// previews and does not require Maps JavaScript API billing. For
// production, swap to the official Maps Embed API with an API key +
// `mode=walking` on the directions variant, or to Mapbox / OSM if
// Google ToS is a blocker.
//
// Honest note: the iframe loads from google.com · it does leave the
// NEX origin boundary at the network level. Nothing in NEX session
// state leaks because the iframe is a sandboxed cross-origin frame.

function VisitUsOverlay(props: {
  readonly open: boolean;
  readonly onClose: () => void;
}): React.ReactElement | null {
  if (!props.open) return null;
  // Bumas Hotel · illustrative coordinates (Denpasar centre).
  // Walking-friendly zoom = 16. `t=m` is the roadmap view.
  const lat = -8.6705;
  const lng = 115.2126;
  const embedSrc =
    `https://maps.google.com/maps?q=${lat},${lng}&z=16&t=m&output=embed`;
  const openInGoogleHref = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-prototype-visit-us-title"
      id="nex-prototype-visit-us-dialog"
      data-nex-prototype-visit-overlay
      onClick={props.onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(1, 4, 10, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        animation: "nex-safe-fade-in 180ms ease-out",
      }}
    >
      <div
        role="document"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "calc(100dvh - 40px)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 20,
          overflow: "hidden",
          background:
            `linear-gradient(180deg, ${NEX.surface} 0%, #0a1322 100%)`,
          border: `1px solid ${NEX.cyan}33`,
          boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px ${NEX.cyan}11`,
          animation: "nex-safe-pop-in 220ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 18px",
            borderBottom: `1px solid ${NEX.borderSoft}`,
          }}
        >
          <span aria-hidden style={{ fontSize: 20 }}>📍</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              id="nex-prototype-visit-us-title"
              style={{ fontSize: 15, fontWeight: 700, color: NEX.text }}
            >
              Visit {BUMAS.name}
            </div>
            <div
              style={{
                fontSize: 11,
                color: NEX.textMuted,
                marginTop: 2,
                lineHeight: 1.4,
              }}
            >
              Jl. Diponegoro No. 55 · {BUMAS.city}, {BUMAS.region}
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close map"
            data-nex-prototype-visit-overlay-close
            style={{
              flex: "0 0 auto",
              width: 32,
              height: 32,
              borderRadius: 999,
              border: `1px solid ${NEX.borderSoft}`,
              background: "transparent",
              color: NEX.textDim,
              fontSize: 16,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Embedded Google Maps iframe */}
        <div
          style={{
            flex: 1,
            minHeight: 320,
            background: NEX.surfaceHi,
            position: "relative",
          }}
        >
          <iframe
            src={embedSrc}
            title="Bumas Hotel location · walking map"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allow="geolocation"
            style={{
              width: "100%",
              height: "100%",
              minHeight: 320,
              border: "none",
              display: "block",
            }}
          />
        </div>

        {/* Footer · open-in-google-maps for turn-by-turn */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 18px",
            borderTop: `1px solid ${NEX.borderSoft}`,
            fontSize: 11,
            color: NEX.textMuted,
          }}
        >
          <span style={{ flex: 1 }}>
            Pan, zoom, or drop into Street View directly on the map.
          </span>
          <a
            href={openInGoogleHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "7px 14px",
              borderRadius: 10,
              border: `1px solid ${NEX.cyan}66`,
              background: `${NEX.cyan}1a`,
              color: NEX.cyan,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              letterSpacing: 0.2,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            🚶  Walking directions
          </a>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §E · Related businesses
// ═════════════════════════════════════════════════════════════════════

function RelatedBusinessesSection(): React.ReactElement {
  const related = [
    { name: "Puri Santrian Beach Resort", city: "Sanur", distKm: "4.2 km", hue: 32 },
    { name: "Villa Kaba Kaba Resort", city: "Tabanan", distKm: "15.7 km", hue: 170 },
    { name: "Hotel Nikko Bali", city: "Nusa Dua", distKm: "22.1 km", hue: 210 },
  ];
  return (
    <section
      data-nex-prototype-section="related-businesses"
      style={{ padding: "28px 20px 0" }}
    >
      <SectionHeading label="You may also like" />
      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 12,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          paddingBottom: 4,
        }}
      >
        {related.map((r) => (
          <div
            key={r.name}
            style={{
              flex: "0 0 220px",
              scrollSnapAlign: "start",
              padding: 12,
              borderRadius: 14,
              background: NEX.surface,
              border: `1px solid ${NEX.borderSoft}`,
            }}
          >
            <div
              style={{
                width: "100%",
                aspectRatio: "4 / 3",
                borderRadius: 10,
                overflow: "hidden",
                background: NEX.surfaceHi,
                marginBottom: 10,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={makeIllustrativeSvg(r.name, r.hue)}
                alt={`${r.name} · illustrative example`}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: NEX.text }}>
              {r.name}
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 11,
                color: NEX.textMuted,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{r.city}</span>
              <span style={{ color: NEX.cyan }}>{r.distKm}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §F · Claim listing CTA
// ═════════════════════════════════════════════════════════════════════

function ClaimListingSection(): React.ReactElement {
  return (
    <section
      data-nex-prototype-section="claim-listing"
      style={{ padding: "28px 20px 0" }}
    >
      <div
        style={{
          padding: 18,
          borderRadius: 14,
          background: `linear-gradient(135deg, ${NEX.orange}22, ${NEX.orange}08)`,
          border: `1px solid ${NEX.orange}55`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span aria-hidden style={{ fontSize: 18 }}>🏷️</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: NEX.text }}>
            Is this your business?
          </div>
        </div>
        <div style={{ fontSize: 13, color: NEX.textDim, lineHeight: 1.6 }}>
          Claim this listing to receive customer messages in NEX Chat,
          upload verified photos, and respond to inquiries directly.
          Ownership is verified by a one-time code sent to the business's
          contact channel.
        </div>
        <button
          type="button"
          disabled
          data-nex-prototype-claim-button
          style={{
            marginTop: 14,
            padding: "11px 20px",
            borderRadius: 12,
            border: "none",
            background: NEX.orange,
            color: "#1A1300",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 0.3,
            cursor: "not-allowed",
            boxShadow: `0 2px 10px ${NEX.orange}55`,
          }}
        >
          Claim this listing →
        </button>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §G · Shared section heading
// ═════════════════════════════════════════════════════════════════════

function SectionHeading(props: {
  readonly label: string;
  readonly hint?: string;
}): React.ReactElement {
  return (
    <header style={{ marginBottom: 2 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 11,
          color: NEX.textMuted,
          textTransform: "uppercase",
          letterSpacing: 1,
          fontWeight: 600,
        }}
      >
        {props.label}
      </h2>
      {props.hint ? (
        <div
          style={{
            marginTop: 4,
            fontSize: 10,
            color: NEX.amber,
            lineHeight: 1.5,
            maxWidth: 520,
          }}
        >
          {props.hint}
        </div>
      ) : null}
    </header>
  );
}

// ─── sub-components ────────────────────────────────────────────────

// ─── local-file drop-in · dev tool · browser-only · zero persistence ──

function PhotoDropIn(props: {
  readonly hasCustom: boolean;
  readonly onFilesPicked: (files: FileList | null) => void;
  readonly onReset: () => void;
  readonly customCount: number;
}): React.ReactElement {
  const [isDragging, setIsDragging] = useState(false);
  const inputId = "nex-prototype-photo-drop-in-input";

  return (
    <div
      data-nex-prototype-photo-drop-in
      style={{
        padding: "10px 20px 0",
      }}
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          props.onFilesPicked(e.dataTransfer?.files ?? null);
        }}
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          background: isDragging ? `${NEX.cyan}11` : `${NEX.surface}cc`,
          border: `1px dashed ${isDragging ? NEX.cyan : `${NEX.cyan}55`}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          transition: "background 120ms ease, border-color 120ms ease",
        }}
      >
        <span aria-hidden style={{ fontSize: 18 }}>📷</span>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ fontSize: 13, color: NEX.text, fontWeight: 600 }}>
            {props.hasCustom
              ? `Local preview · ${props.customCount} photo${props.customCount === 1 ? "" : "s"} loaded`
              : "Preview with your own photos"}
          </div>
          <div
            style={{
              fontSize: 11,
              color: NEX.textMuted,
              marginTop: 2,
              lineHeight: 1.5,
            }}
          >
            Pick up to 4 image files · first becomes the hero · next 3
            become the thumbnail grid · images stay in your browser only
            · nothing is uploaded, stored, or committed.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label
            htmlFor={inputId}
            style={{
              padding: "7px 14px",
              borderRadius: 10,
              border: `1px solid ${NEX.cyan}66`,
              background: `${NEX.cyan}1a`,
              color: NEX.cyan,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.2,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {props.hasCustom ? "Replace photos" : "Pick 4 photos"}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => props.onFilesPicked(e.target.files)}
            style={{ display: "none" }}
          />
          {props.hasCustom ? (
            <button
              type="button"
              onClick={props.onReset}
              style={{
                padding: "7px 14px",
                borderRadius: 10,
                border: `1px solid ${NEX.borderSoft}`,
                background: "transparent",
                color: NEX.textDim,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 0.2,
                cursor: "pointer",
              }}
            >
              Reset to illustrative
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PrototypeHeader(): React.ReactElement {
  return (
    <header
      style={{
        padding: "14px 20px",
        borderBottom: `1px solid ${NEX.borderSoft}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: `${NEX.bg}cc`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: NEX.textMuted,
          letterSpacing: 1,
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        NEX Dev · Directory Detail Prototype
      </div>
    </header>
  );
}

function PrototypeButton(props: {
  readonly variant: "primary" | "secondary";
  readonly label: string;
  readonly hint: string;
  readonly icon: string;
}): React.ReactElement {
  const isPrimary = props.variant === "primary";
  return (
    <button
      type="button"
      aria-label={`${props.label} · ${props.hint}`}
      data-nex-prototype-button={props.variant}
      disabled
      style={{
        flex: 1,
        padding: "14px 18px",
        borderRadius: 14,
        border: "none",
        background: isPrimary ? NEX.orange : NEX.surfaceHi,
        color: isPrimary ? "#1A1300" : NEX.text,
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: 0.2,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: "not-allowed",
        opacity: 0.95,
        boxShadow: isPrimary ? `0 2px 10px ${NEX.orange}55` : "none",
      }}
    >
      <span aria-hidden style={{ fontSize: 16 }}>{props.icon}</span>
      {props.label}
    </button>
  );
}
