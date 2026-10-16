// src/app/nex-native/dev/directory-hotel-prototype/page.tsx
//
// NEX Directory · HOTEL / VILLA / STAY property page · mobile-first.
// Founder-authorised 2026-10-13 (build instruction, not another report).
//
// Design direction
//   · White/light premium theme · navy typography · restrained blue
//     actions · generous spacing.
//   · Mobile-first · designed for 375–430 wide viewports FIRST.
//   · Immersive edge-to-edge photography · swipeable with scroll-snap.
//   · Progressive disclosure via native <details> · zero JS collapse logic.
//   · Persistent bottom action bar · Ask a question · Request booking.
//   · NEX Chat accessible throughout; two overlays separate the two
//     distinct intents (question vs booking) · shared context packet.
//
// Data honesty rules (sealed · do not relax)
//   · No invented review scores · no "4.7 ★" badges
//   · No fake response-time commitments
//   · No fabricated owner verification · we show the owner-verified
//     chip ONLY where NEX would truly have `business_claim.state=
//     VERIFIED` AND `business_canonical.lifecycle_state=OWNER_CLAIMED`.
//     The prototype hard-codes this as true for Bumas Hotel but EVERY
//     other prototype hotel defaults to "owner has not claimed yet."
//   · No fake booking availability · "Request booking" never implies
//     instant confirmation
//   · No misleading NEX Safe claims
//   · Prices NOT shown · we say "Confirm your total with the owner"
//     because NEX has no booking engine today
//
// What's a WORKING integration vs PROTOTYPE-ONLY
//   WORKING (reused real primitives):
//     · ThumbnailStrip component (sealed in Phase 1 image milestone)
//     · DirectoryImage type (sealed canonical shape)
//     · humaniseOsmTag(tag) pattern lifted from the dark prototype
//       for area-landmark labelling
//   PROTOTYPE-ONLY (fixture data · no DB round-trip):
//     · Bumas Hotel identity, address, hero image, local service picks
//     · The two chat overlays (Ask a question / Request booking)
//       render fixture conversations · neither persists or sends.
//     · "Make the most of your stay" providers are illustrative SVGs
//     · Walking-distance numbers to landmarks

"use client";

import type * as React from "react";
import { useEffect, useState } from "react";
import { ThumbnailStrip } from "../../directory/[id]/_thumbnail-strip";
import type { ThumbnailStripResult } from "@/lib/nex-native/directory/media-resolver";

// ─── sealed palette · matches Bumas Hotel mockup exactly ───────────
// Pure white background · NEX orange brand logo · navy typography ·
// soft NEX-blue action tone · line icons (not emoji). Updated per
// founder direction 2026-10-13: "white background · same colors and
// icons · exactly as screenshot colors."

const NEX = {
  bg: "#FFFFFF",           // pure white (mockup background)
  bgSoft: "#FFFFFF",       // kept same for white-only page
  surface: "#FFFFFF",
  surfaceAlt: "#F6F8FB",   // very subtle grey (mockup section tint)
  text: "#1A2B4A",         // navy · headings (mockup)
  textMid: "#44557A",      // mid slate · body
  textMuted: "#6B7B99",    // muted captions
  textSoft: "#9AA6BC",     // very muted
  accent: "#3B6CE0",       // NEX blue (search button in mockup)
  accentSoft: "#E6ECFA",   // light blue tint for pills
  accentMuted: "#F1F5FD",  // very light blue background
  orange: "#FF7200",       // NEX brand orange (logo)
  verified: "#2E8F5B",     // green for verified chip
  verifiedSoft: "#E3F5EC",
  warn: "#C97A1D",         // amber warn
  warnSoft: "#FCF2E0",
  divider: "#E6EBF2",      // soft grey divider (mockup)
  dividerSoft: "#F1F4F9",
  shadow: "0 1px 2px rgba(26,43,74,0.04), 0 1px 3px rgba(26,43,74,0.06)",
  shadowLg: "0 10px 25px rgba(26,43,74,0.10), 0 2px 6px rgba(26,43,74,0.06)",
} as const;

// ─── illustrative SVG helper (prototype-only images) ───────────────

function makeIllustrativeSvg(label: string, hue: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='560' viewBox='0 0 800 560'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='hsl(${hue},55%,80%)'/>
      <stop offset='100%' stop-color='hsl(${hue},40%,55%)'/>
    </linearGradient></defs>
    <rect width='800' height='560' fill='url(#g)'/>
    <text x='50%' y='48%' text-anchor='middle' font-family='Inter,sans-serif' font-size='28' font-weight='600' fill='#0F172A' opacity='0.72'>${label}</text>
    <text x='50%' y='56%' text-anchor='middle' font-family='Inter,sans-serif' font-size='12' fill='#334155' opacity='0.55' letter-spacing='2'>ILLUSTRATIVE</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ─── Bumas Hotel fixture ───────────────────────────────────────────

const BUMAS = {
  canonicalBusinessId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  name: "Bumas Hotel",
  propertyType: "Hotel",
  city: "Denpasar",
  region: "Bali",
  country: "Indonesia",
  address: "Jl. Diponegoro No. 55 · 80114",
  // Claim state is prototype-only · if this were production it would
  // come from nex.business_claim.state=VERIFIED.
  ownerVerified: true,
  // Prototype-only measured response-time · HIDDEN unless real data.
  responseMeasured: false,
  // Facilities the hotel DOES offer (from fixture · would come from
  // the owner portal in production).
  hotelOffers: new Set<string>([
    "wifi",
    "parking",
    "pool",
    "air_conditioning",
    "breakfast",
    "front_desk_24h",
  ]),
  // Things NEX could compute from area intel + coordinates ·
  // walking-distance values hand-picked for the prototype.
  nearby: [
    { label: "Segara Beach", walkMin: 7, kind: "beach" },
    { label: "Puputan Square", walkMin: 4, kind: "historic:monument" },
    { label: "Bali Museum", walkMin: 6, kind: "tourism:museum" },
    { label: "Pasar Badung (market)", walkMin: 9, kind: "shop:marketplace" },
    { label: "Ngurah Rai Airport", driveMin: 30, kind: "aeroway:aerodrome" },
  ],
};

// Prototype hero gallery · 4 illustrative tiles swipeable
const HERO_IMAGES = [
  { url: makeIllustrativeSvg("Bumas Hotel", 210), alt: "Hotel exterior · illustrative" },
  { url: makeIllustrativeSvg("Pool & garden", 170), alt: "Pool & garden · illustrative" },
  { url: makeIllustrativeSvg("Standard room", 32), alt: "Standard room · illustrative" },
  { url: makeIllustrativeSvg("Lobby", 290), alt: "Lobby · illustrative" },
];

// Thumbnail strip (used in the "More photos" collapsible)
const THUMBS_FIXTURE: ThumbnailStripResult = {
  ok: true,
  images: [
    { url: makeIllustrativeSvg("Standard room", 210), altText: "Standard room", sourceId: "owner_upload" },
    { url: makeIllustrativeSvg("Deluxe room", 32), altText: "Deluxe room", sourceId: "owner_upload" },
    { url: makeIllustrativeSvg("Pool", 170), altText: "Pool", sourceId: "owner_upload" },
  ],
};

// ─── local services catalogue · dedup against hotel's own offers ───

interface LocalCategory {
  readonly id: string;
  readonly label: string;
  readonly glyph: string;
  readonly hint: string;
  // When any of these keys appear in BUMAS.hotelOffers, HIDE this category.
  readonly supersededByHotelOffers?: readonly string[];
}

const LOCAL_CATALOG: readonly LocalCategory[] = [
  { id: "motorbike_rental", label: "Motorbike rental", glyph: "motorbike", hint: "Explore Sanur at your own pace" },
  // Hotel laundry is on-premises · if the hotel offers it, we hide
  // this category. Bumas doesn't list `laundry` in `hotelOffers`,
  // so it stays visible.
  { id: "laundry", label: "Laundry", glyph: "laundry", hint: "Fresh clothes during your stay", supersededByHotelOffers: ["laundry"] },
  { id: "massage_spa", label: "Massage & spa", glyph: "spa", hint: "Local treatment, 10–15 min walk", supersededByHotelOffers: ["spa"] },
  { id: "private_driver", label: "Private driver", glyph: "car", hint: "Airport transfers & day trips", supersededByHotelOffers: ["airport_shuttle"] },
  { id: "tours", label: "Day tours", glyph: "map", hint: "Guided experiences nearby" },
  { id: "coworking", label: "Coworking", glyph: "computer", hint: "Reliable Wi-Fi for a work day" },
];

function visibleLocalCategories(): readonly LocalCategory[] {
  return LOCAL_CATALOG.filter((cat) => {
    if (!cat.supersededByHotelOffers) return true;
    return !cat.supersededByHotelOffers.some((k) => BUMAS.hotelOffers.has(k));
  });
}

// ─── small shared bits ────────────────────────────────────────────

function Facility({ label, icon }: { label: string; icon: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        background: NEX.surfaceAlt,
        border: `1px solid ${NEX.divider}`,
        fontSize: 14,
        color: NEX.text,
      }}
    >
      <span style={{ color: NEX.accent, display: "inline-flex" }}>
        <Icon name={icon} size={20} />
      </span>
      <span>{label}</span>
    </div>
  );
}

function SectionTitle({ children, kicker }: { children: React.ReactNode; kicker?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {kicker ? (
        <div
          style={{
            fontSize: 11,
            color: NEX.textMuted,
            textTransform: "uppercase",
            letterSpacing: 1,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          {kicker}
        </div>
      ) : null}
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: NEX.text,
          lineHeight: 1.3,
        }}
      >
        {children}
      </h2>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════

export default function DirectoryHotelPrototypePage(): React.ReactElement {
  const [askQOpen, setAskQOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const anyOpen = askQOpen || bookOpen;

  // Escape + scroll lock
  useEffect(() => {
    if (!anyOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAskQOpen(false);
        setBookOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [anyOpen]);

  const localCats = visibleLocalCategories();

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; margin: 0; padding: 0; }
        /* Mobile-first · phone-shaped frame on wider viewports */
        .nex-mobile-shell { width: 100%; max-width: 480px; margin: 0 auto; }
        .nex-no-scrollbar::-webkit-scrollbar { display: none; }
        .nex-no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        details.nex-detail > summary { list-style: none; cursor: pointer; }
        details.nex-detail > summary::-webkit-details-marker { display: none; }
      `}</style>
      <main
        data-nex-dev-prototype="directory-hotel"
        style={{
          minHeight: "100dvh",
          background: NEX.bgSoft,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          paddingBottom: 96, // leave room for the sticky bottom bar
        }}
      >
        <div className="nex-mobile-shell" style={{ background: NEX.bg }}>
          <DevHeader />
          {/* ─── 01 · HERO GALLERY (edge-to-edge, swipeable) ─── */}
          <HeroGallery images={HERO_IMAGES} />

          {/* ─── 02 · IDENTITY BLOCK ─── */}
          <IdentityBlock />

          {/* ─── 03 · QUICK DECISION SUMMARY ─── */}
          <QuickDecide onAskQuestion={() => setAskQOpen(true)} />

          {/* ─── 04 · BOOKING ENTRY (dates / guests) ─── */}
          <BookingEntry onRequest={() => setBookOpen(true)} />

          {/* ─── 05 · WHAT TO EXPECT · POLICIES STRIP ─── */}
          <PoliciesStrip onAskQuestion={() => setAskQOpen(true)} />

          {/* ─── 06 · COLLAPSIBLE DETAILS ─── */}
          <section style={{ padding: "0 20px" }}>
            <CollapsibleSection title="Rooms" summary="3 room types from fixture · prices on request">
              <RoomsBody />
            </CollapsibleSection>
            <CollapsibleSection title="Facilities" summary={`${BUMAS.hotelOffers.size} confirmed by the owner`}>
              <FacilitiesBody />
            </CollapsibleSection>
            <CollapsibleSection title="About the property" summary="Short description">
              <AboutBody />
            </CollapsibleSection>
            <CollapsibleSection title="Location & nearby" summary="Walking distances">
              <LocationBody />
            </CollapsibleSection>
            <CollapsibleSection title="More photos" summary="3 approved photos">
              <ThumbnailStrip
                result={THUMBS_FIXTURE}
                businessName={BUMAS.name}
                layout="grid"
                hideHeading={true}
              />
            </CollapsibleSection>
          </section>

          {/* ─── 07 · MAKE THE MOST OF YOUR STAY ─── */}
          <MakeTheMostCarousel categories={localCats} />

          {/* ─── 08 · HONEST ILLUSTRATIVE FOOTER ─── */}
          <section
            style={{
              padding: "22px 20px 28px",
              fontSize: 11,
              color: NEX.textSoft,
              lineHeight: 1.5,
            }}
          >
            This is a NEX design prototype. Images are illustrative. All
            booking requests, chat threads and local-service recommendations
            run on fixture data in this prototype.
          </section>
        </div>

        {/* ─── STICKY BOTTOM ACTION BAR ─── */}
        <StickyActionBar
          onAskQuestion={() => setAskQOpen(true)}
          onRequestBooking={() => setBookOpen(true)}
        />

        {/* ─── OVERLAYS · chat + booking ─── */}
        <AskQuestionOverlay open={askQOpen} onClose={() => setAskQOpen(false)} />
        <RequestBookingOverlay open={bookOpen} onClose={() => setBookOpen(false)} />
      </main>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Dev header (minimal · just names the prototype)
// ═════════════════════════════════════════════════════════════════════

function DevHeader(): React.ReactElement {
  return (
    <header
      style={{
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${NEX.divider}`,
        background: NEX.bg,
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: NEX.orange,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        NEX
      </div>
      <button
        type="button"
        aria-label="Menu"
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          border: `1px solid ${NEX.divider}`,
          background: NEX.surface,
          color: NEX.textMid,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="menu" size={18} />
      </button>
    </header>
  );
}

// ─── Inline SVG line icon library · matches mockup aesthetic ───────
// Simple stroked 24×24 line icons · currentColor for easy theming.

const ICON_PATHS: Readonly<Record<string, string>> = {
  wifi:
    "M5 12.5a10 10 0 0 1 14 0 M8 16a6 6 0 0 1 8 0 M11 19.5a2 2 0 1 1 2 0",
  parking:
    "M6 4h8a5 5 0 0 1 0 10h-4v6H6zm4 2v6h4a3 3 0 0 0 0-6z",
  pool:
    "M3 15c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1 M3 19c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1 M8 11V5l4 3 4-3v6",
  ac:
    "M12 3v18 M4 7l16 10 M4 17l16-10 M9 5l3-2 3 2 M9 19l3 2 3-2",
  breakfast:
    "M3 11h14a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zm14 1h3a2 2 0 1 1 0 4h-1 M4 20h18 M8 7V4 M12 7V4 M16 7V4",
  bell:
    "M6 16a1 1 0 0 1 .4-1.5l1-.5V11a5 5 0 0 1 9.2 0v3l1 .5A1 1 0 0 1 18 16zm3.5 2a2.5 2.5 0 0 0 5 0",
  motorbike:
    "M4 17a3 3 0 1 0 6 0 M14 17a3 3 0 1 0 6 0 M10 17h4l-2-6h4l1-3h3 M7 11h5",
  laundry:
    "M4 4h16v16H4zm0 5h16 M8 7h.01 M11 7h.01 M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  spa:
    "M12 11c-1-2.5-3-4-6-4 0 3 1.5 5 4 6 M12 11c1-2.5 3-4 6-4 0 3-1.5 5-4 6 M12 11v9",
  car:
    "M4 14h16l-2-5a3 3 0 0 0-3-2H9a3 3 0 0 0-3 2zm0 0v4h3v-2 M20 14v4h-3v-2 M8 11h8",
  map:
    "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zm0 0v14 M15 6v14",
  computer:
    "M3 5h18v12H3zm0 12 2 3h14l2-3 M11 20h2",
  message:
    "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9l-5 4v-4H5a2 2 0 0 1-2-2z",
  calendar:
    "M4 6h16v14H4zm0 4h16 M8 3v4 M16 3v4",
  users:
    "M4 20a5 5 0 0 1 10 0 M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7 M14 20a5 5 0 0 1 7 0 M17.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  pin:
    "M12 21s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  check:
    "M5 12l4 4L19 6",
  menu:
    "M4 7h16 M4 12h16 M4 17h16",
  arrowRight:
    "M5 12h14 M13 6l6 6-6 6",
};

function Icon({
  name,
  size = 20,
  stroke = "currentColor",
  strokeWidth = 1.6,
}: {
  readonly name: keyof typeof ICON_PATHS | string;
  readonly size?: number;
  readonly stroke?: string;
  readonly strokeWidth?: number;
}): React.ReactElement {
  const d = ICON_PATHS[name as string] ?? "";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ display: "block" }}
    >
      <path d={d} />
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 01 · HERO GALLERY (swipeable, scroll-snap, pagination dots)
// ═════════════════════════════════════════════════════════════════════

function HeroGallery({
  images,
}: {
  readonly images: readonly { readonly url: string; readonly alt: string }[];
}): React.ReactElement {
  const [active, setActive] = useState(0);
  return (
    <section
      aria-label="Property photo gallery"
      style={{ position: "relative", background: NEX.surfaceAlt }}
    >
      <div
        className="nex-no-scrollbar"
        onScroll={(e) => {
          const el = e.currentTarget;
          const idx = Math.round(el.scrollLeft / el.clientWidth);
          if (idx !== active) setActive(idx);
        }}
        style={{
          display: "flex",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {images.map((img, i) => (
          <div
            key={i}
            style={{
              flex: "0 0 100%",
              scrollSnapAlign: "start",
              aspectRatio: "4 / 3",
              background: NEX.surfaceAlt,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.alt}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        ))}
      </div>
      {/* Pagination dots */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 10,
          display: "flex",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {images.map((_, i) => (
          <span
            key={i}
            style={{
              width: i === active ? 20 : 6,
              height: 6,
              borderRadius: 999,
              background: i === active ? "#FFFFFF" : "rgba(255,255,255,0.6)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
              transition: "width 160ms ease",
            }}
          />
        ))}
      </div>
      {/* Image counter top-right */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          padding: "4px 10px",
          background: "rgba(15,23,42,0.75)",
          color: "#FFFFFF",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.3,
        }}
      >
        {active + 1} / {images.length}
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 02 · IDENTITY BLOCK
// ═════════════════════════════════════════════════════════════════════

function IdentityBlock(): React.ReactElement {
  return (
    <section
      aria-label="Property identity"
      style={{ padding: "18px 20px 10px" }}
    >
      <div
        style={{
          fontSize: 11,
          color: NEX.textMuted,
          textTransform: "uppercase",
          letterSpacing: 1,
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        {BUMAS.propertyType}
      </div>
      <h1
        style={{
          margin: 0,
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: "-0.015em",
          color: NEX.text,
          lineHeight: 1.1,
        }}
      >
        {BUMAS.name}
      </h1>
      <div
        style={{
          marginTop: 6,
          fontSize: 14,
          color: NEX.textMid,
          lineHeight: 1.5,
        }}
      >
        {BUMAS.city}, {BUMAS.region} · {BUMAS.country}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 13,
          color: NEX.textMuted,
        }}
      >
        {BUMAS.address}
      </div>

      {/* Owner-verified chip · ONLY if NEX has a VERIFIED claim.
          Prototype hard-codes true for Bumas. In production this maps
          to nex.business_claim.state=VERIFIED + canonical.lifecycle_state
          ∈ (OWNER_CLAIMED, OWNER_VERIFIED). */}
      {BUMAS.ownerVerified ? (
        <div
          style={{
            marginTop: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            background: NEX.verifiedSoft,
            border: `1px solid ${NEX.verified}33`,
            borderRadius: 999,
            fontSize: 12,
            color: NEX.verified,
            fontWeight: 600,
            letterSpacing: 0.2,
          }}
        >
          <span aria-hidden style={{ fontSize: 11 }}>✓</span>
          Owner-verified listing
        </div>
      ) : (
        <div
          style={{
            marginTop: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            background: NEX.surfaceAlt,
            border: `1px solid ${NEX.divider}`,
            borderRadius: 999,
            fontSize: 12,
            color: NEX.textMuted,
            fontWeight: 600,
          }}
        >
          Owner has not yet claimed this listing
        </div>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 03 · QUICK DECISION SUMMARY
// ═════════════════════════════════════════════════════════════════════

function QuickDecide({ onAskQuestion }: { onAskQuestion: () => void }): React.ReactElement {
  // Facts NEX can confirm today (fixture-shaped from the real schema):
  //   · walking distance to a landmark (computed from coords)
  //   · owner-confirmed facility (from the owner portal · fixture here)
  //   · lifecycle verified
  // Unknown things we're honest about:
  //   · nightly rate · availability · guest score · specific room sizes
  const quickFacts: readonly { readonly label: string; readonly value: string }[] = [
    { label: "To Segara Beach", value: `${BUMAS.nearby[0].walkMin} min walk` },
    { label: "To Puputan Square", value: `${BUMAS.nearby[1].walkMin} min walk` },
    { label: "Airport", value: `~${BUMAS.nearby[4].driveMin} min drive` },
    { label: "Front desk", value: "24h" },
  ];
  return (
    <section aria-label="Quick decision summary" style={{ padding: "4px 20px 10px" }}>
      <div
        style={{
          padding: 16,
          background: NEX.surface,
          border: `1px solid ${NEX.divider}`,
          borderRadius: 14,
          boxShadow: NEX.shadow,
        }}
      >
        <SectionTitle kicker="Decide at a glance">What NEX can confirm</SectionTitle>
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {quickFacts.map((f) => (
            <li
              key={f.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "9px 0",
                borderBottom: `1px solid ${NEX.dividerSoft}`,
                fontSize: 14,
                color: NEX.text,
              }}
            >
              <span style={{ color: NEX.textMid }}>{f.label}</span>
              <span style={{ fontWeight: 600 }}>{f.value}</span>
            </li>
          ))}
        </ul>
        {/* Honest unknowns · explicit ASK state */}
        <div
          style={{
            marginTop: 14,
            padding: 12,
            background: NEX.accentMuted,
            border: `1px solid ${NEX.accentSoft}`,
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 13, color: NEX.text, lineHeight: 1.6 }}>
            <strong style={{ fontWeight: 700 }}>Not confirmed yet:</strong>{" "}
            nightly rate · availability for your dates · child & pet policy.{" "}
            <button
              type="button"
              onClick={onAskQuestion}
              style={{
                background: "transparent",
                border: "none",
                color: NEX.accent,
                fontWeight: 700,
                fontSize: 13,
                padding: 0,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Ask the owner
            </button>
            .
          </div>
        </div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 04 · BOOKING ENTRY · dates + guests
// ═════════════════════════════════════════════════════════════════════

function BookingEntry({ onRequest }: { onRequest: () => void }): React.ReactElement {
  return (
    <section aria-label="Booking request entry" style={{ padding: "10px 20px" }}>
      <div
        style={{
          padding: 16,
          background: NEX.surface,
          border: `1px solid ${NEX.divider}`,
          borderRadius: 14,
          boxShadow: NEX.shadow,
        }}
      >
        <SectionTitle kicker="Request booking">Pick dates & guests</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 4,
          }}
        >
          <FormInput label="Check-in" value="Pick a date" />
          <FormInput label="Check-out" value="Pick a date" />
          <FormInput label="Guests" value="2 adults" />
          <FormInput label="Rooms" value="1 room" />
        </div>
        <button
          type="button"
          onClick={onRequest}
          style={{
            marginTop: 14,
            width: "100%",
            padding: "14px 16px",
            borderRadius: 12,
            border: "none",
            background: NEX.accent,
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 0.2,
            cursor: "pointer",
            boxShadow: `0 2px 8px ${NEX.accent}33`,
          }}
        >
          Request booking
        </button>
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: NEX.textMuted,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          NEX sends your request to the owner · they confirm the price &
          availability · no instant booking yet.
        </div>
      </div>
    </section>
  );
}

function FormInput({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "10px 12px",
        background: NEX.bgSoft,
        border: `1px solid ${NEX.divider}`,
        borderRadius: 10,
        cursor: "not-allowed",
      }}
    >
      <span style={{ fontSize: 10, color: NEX.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: 14, color: NEX.text, fontWeight: 500 }}>{value}</span>
    </label>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 05 · POLICIES / "BEFORE YOU BOOK" STRIP
// ═════════════════════════════════════════════════════════════════════

function PoliciesStrip({ onAskQuestion }: { onAskQuestion: () => void }): React.ReactElement {
  return (
    <section aria-label="Before you book" style={{ padding: "10px 20px" }}>
      <div
        style={{
          padding: 14,
          background: NEX.warnSoft,
          border: `1px solid ${NEX.warn}44`,
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: NEX.warn,
            textTransform: "uppercase",
            letterSpacing: 1,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          Before you book
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 13, color: NEX.text }}>
          <li style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ color: NEX.textMid }}>Resort fee</span>
            <span style={{ fontWeight: 600 }}>Not disclosed yet</span>
          </li>
          <li style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ color: NEX.textMid }}>Deposit on arrival</span>
            <span style={{ fontWeight: 600 }}>Not disclosed yet</span>
          </li>
          <li style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ color: NEX.textMid }}>Cancellation</span>
            <span style={{ fontWeight: 600 }}>Not disclosed yet</span>
          </li>
        </ul>
        <button
          type="button"
          onClick={onAskQuestion}
          style={{
            marginTop: 10,
            background: "transparent",
            border: "none",
            color: NEX.warn,
            fontWeight: 700,
            fontSize: 13,
            padding: 0,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Ask the owner about charges & cancellation
        </button>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 06 · COLLAPSIBLE SECTIONS (native <details>, zero JS)
// ═════════════════════════════════════════════════════════════════════

function CollapsibleSection({
  title,
  summary,
  children,
}: {
  readonly title: string;
  readonly summary?: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <details
      className="nex-detail"
      style={{
        padding: "0",
        marginTop: 10,
        background: NEX.surface,
        border: `1px solid ${NEX.divider}`,
        borderRadius: 12,
        boxShadow: NEX.shadow,
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: NEX.text }}>
            {title}
          </div>
          {summary ? (
            <div style={{ fontSize: 12, color: NEX.textMuted, marginTop: 2 }}>
              {summary}
            </div>
          ) : null}
        </div>
        <span aria-hidden style={{ fontSize: 20, color: NEX.textMuted, lineHeight: 1 }}>
          ⌄
        </span>
      </summary>
      <div style={{ padding: "0 16px 16px" }}>{children}</div>
    </details>
  );
}

function RoomsBody(): React.ReactElement {
  const rooms = [
    { name: "Standard Room", bed: "1 double bed", notes: "City view" },
    { name: "Deluxe Room", bed: "1 double or 2 singles", notes: "Garden view · larger" },
    { name: "Family Suite", bed: "1 double + 2 singles", notes: "Separate living area" },
  ];
  return (
    <div>
      {rooms.map((r) => (
        <div
          key={r.name}
          style={{
            padding: "10px 0",
            borderBottom: `1px solid ${NEX.dividerSoft}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: NEX.text }}>{r.name}</div>
          <div style={{ fontSize: 13, color: NEX.textMid, marginTop: 2 }}>{r.bed}</div>
          <div style={{ fontSize: 12, color: NEX.textMuted, marginTop: 1 }}>{r.notes}</div>
        </div>
      ))}
      <div style={{ marginTop: 10, fontSize: 12, color: NEX.textMuted, lineHeight: 1.5 }}>
        Prices confirmed by the owner when you send a booking request.
      </div>
    </div>
  );
}

function FacilitiesBody(): React.ReactElement {
  const items: readonly { readonly k: string; readonly label: string; readonly icon: string }[] = [
    { k: "wifi", label: "Free Wi-Fi", icon: "wifi" },
    { k: "parking", label: "Free parking", icon: "parking" },
    { k: "pool", label: "Outdoor pool", icon: "pool" },
    { k: "air_conditioning", label: "Air conditioning", icon: "ac" },
    { k: "breakfast", label: "Breakfast available", icon: "breakfast" },
    { k: "front_desk_24h", label: "24-hour front desk", icon: "bell" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
      {items.map((it) => (
        <Facility key={it.k} label={it.label} icon={it.icon} />
      ))}
    </div>
  );
}

function AboutBody(): React.ReactElement {
  return (
    <p style={{ margin: 0, fontSize: 14, color: NEX.textMid, lineHeight: 1.65 }}>
      Comfortable Denpasar accommodation close to Puputan Square and the
      Bali Museum. Walking distance to Pasar Badung and roughly 7 minutes
      on foot to Segara Beach. Suitable for short city stays and longer
      explorations of south Bali.
    </p>
  );
}

function LocationBody(): React.ReactElement {
  return (
    <div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {BUMAS.nearby.map((n) => (
          <li
            key={n.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 0",
              borderBottom: `1px solid ${NEX.dividerSoft}`,
              fontSize: 13,
              color: NEX.text,
            }}
          >
            <span style={{ color: NEX.textMid }}>{n.label}</span>
            <span style={{ fontWeight: 600 }}>
              {n.walkMin !== undefined ? `${n.walkMin} min walk` : `~${n.driveMin} min drive`}
            </span>
          </li>
        ))}
      </ul>
      <div
        style={{
          marginTop: 10,
          height: 140,
          borderRadius: 10,
          background: "linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 50%, #DBEAFE 100%)",
          border: `1px solid ${NEX.divider}`,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: NEX.textMuted,
          fontSize: 11,
        }}
      >
        <span>Map · illustrative</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: NEX.textSoft, lineHeight: 1.5 }}>
        Distances estimated from OpenStreetMap landmarks around the hotel.
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 07 · MAKE THE MOST OF YOUR STAY · local services carousel
// ═════════════════════════════════════════════════════════════════════

function MakeTheMostCarousel({ categories }: { readonly categories: readonly LocalCategory[] }): React.ReactElement {
  if (categories.length === 0) {
    return (
      <section style={{ padding: "22px 20px 0" }}>
        <SectionTitle kicker="Make the most of your stay">Not enough nearby providers yet</SectionTitle>
        <div style={{ fontSize: 13, color: NEX.textMuted, lineHeight: 1.6 }}>
          NEX will show independent local services here once there are
          verified providers nearby. Nothing to recommend yet.
        </div>
      </section>
    );
  }
  return (
    <section
      aria-label="Local services around the property"
      style={{ padding: "22px 0 0" }}
    >
      <div style={{ padding: "0 20px" }}>
        <SectionTitle kicker="Make the most of your stay">
          Useful services around {BUMAS.name}
        </SectionTitle>
      </div>
      <div
        className="nex-no-scrollbar"
        style={{
          display: "flex",
          gap: 10,
          padding: "6px 20px 10px",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {categories.map((c) => (
          <div
            key={c.id}
            style={{
              flex: "0 0 180px",
              scrollSnapAlign: "start",
              padding: 14,
              borderRadius: 14,
              background: NEX.surface,
              border: `1px solid ${NEX.divider}`,
              boxShadow: NEX.shadow,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: NEX.accentMuted,
                color: NEX.accent,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={c.glyph} size={22} />
            </div>
            <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: NEX.text }}>
              {c.label}
            </div>
            <div style={{ fontSize: 12, color: NEX.textMuted, marginTop: 2, lineHeight: 1.4 }}>
              {c.hint}
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: NEX.accent,
                fontWeight: 600,
              }}
            >
              View providers →
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: "0 20px", fontSize: 11, color: NEX.textSoft, lineHeight: 1.5, marginTop: 4 }}>
        Only categories with eligible NEX businesses nearby are shown.
        Services the hotel already offers are excluded.
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════
// STICKY BOTTOM ACTION BAR
// ═════════════════════════════════════════════════════════════════════

function StickyActionBar({
  onAskQuestion,
  onRequestBooking,
}: {
  readonly onAskQuestion: () => void;
  readonly onRequestBooking: () => void;
}): React.ReactElement {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        className="nex-mobile-shell"
        style={{
          pointerEvents: "auto",
          padding: "10px 16px 14px",
          background: `${NEX.bg}f2`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: `1px solid ${NEX.divider}`,
          display: "flex",
          gap: 10,
          boxShadow: "0 -4px 20px rgba(15,23,42,0.08)",
        }}
      >
        <button
          type="button"
          onClick={onAskQuestion}
          aria-label="Ask the owner a question"
          style={{
            flex: "0 0 auto",
            width: 52,
            height: 52,
            borderRadius: 14,
            border: `1px solid ${NEX.divider}`,
            background: NEX.surface,
            color: NEX.textMid,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="message" size={22} />
        </button>
        <button
          type="button"
          onClick={onRequestBooking}
          style={{
            flex: 1,
            padding: "14px 16px",
            borderRadius: 14,
            border: "none",
            background: NEX.accent,
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 0.2,
            cursor: "pointer",
            boxShadow: `0 4px 14px ${NEX.accent}44`,
          }}
        >
          Request booking
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// ASK QUESTION OVERLAY · prototype chat preview
// ═════════════════════════════════════════════════════════════════════

function AskQuestionOverlay({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}): React.ReactElement | null {
  if (!open) return null;
  return (
    <OverlayShell onClose={onClose} title="Ask the owner" subtitle="Quick question about the property">
      <div
        style={{
          padding: "16px 18px",
          overflowY: "auto",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <QuickChip label="Can I walk to the beach?" />
        <QuickChip label="Is breakfast included?" />
        <QuickChip label="Are children welcome?" />
        <QuickChip label="Any extra fees on arrival?" />
      </div>
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${NEX.divider}` }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 999,
            background: NEX.bgSoft,
            border: `1px solid ${NEX.divider}`,
          }}
        >
          <input
            disabled
            placeholder="Type a question (prototype only)"
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: 14,
              outline: "none",
              color: NEX.text,
            }}
          />
          <button
            type="button"
            disabled
            style={{
              flex: "0 0 auto",
              padding: "4px 12px",
              borderRadius: 999,
              border: "none",
              background: NEX.accent,
              color: "#FFFFFF",
              fontSize: 12,
              fontWeight: 700,
              opacity: 0.5,
              cursor: "not-allowed",
            }}
          >
            Send
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: NEX.textSoft, textAlign: "center" }}>
          Prototype only · not wired to NEX Chat
        </div>
      </div>
    </OverlayShell>
  );
}

function QuickChip({ label }: { label: string }): React.ReactElement {
  return (
    <button
      type="button"
      style={{
        textAlign: "left",
        padding: "11px 14px",
        borderRadius: 12,
        border: `1px solid ${NEX.divider}`,
        background: NEX.surface,
        fontSize: 14,
        color: NEX.text,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════
// REQUEST BOOKING OVERLAY · structured request with pre-packed context
// ═════════════════════════════════════════════════════════════════════

function RequestBookingOverlay({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}): React.ReactElement | null {
  if (!open) return null;
  return (
    <OverlayShell
      onClose={onClose}
      title="Request booking"
      subtitle="NEX sends this to the owner · they confirm"
    >
      <div
        style={{
          padding: "16px 18px",
          overflowY: "auto",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <ContextCard />
        <TextArea label="Anything specific the owner should know?" />
        <div
          style={{
            fontSize: 12,
            color: NEX.textMuted,
            lineHeight: 1.6,
          }}
        >
          The owner receives all of this in one message along with your
          contact details. No instant confirmation · the owner replies
          with price &amp; availability.
        </div>
      </div>
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${NEX.divider}` }}>
        <button
          type="button"
          disabled
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 14,
            border: "none",
            background: NEX.accent,
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: 700,
            opacity: 0.6,
            cursor: "not-allowed",
          }}
        >
          Send request (prototype only)
        </button>
      </div>
    </OverlayShell>
  );
}

function ContextCard(): React.ReactElement {
  return (
    <div
      style={{
        padding: 14,
        background: NEX.accentMuted,
        border: `1px solid ${NEX.accentSoft}`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: NEX.accent,
          textTransform: "uppercase",
          letterSpacing: 1,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        Owner will receive
      </div>
      <ContextLine label="Property" value={BUMAS.name} />
      <ContextLine label="Dates" value="Pick above (not yet filled)" />
      <ContextLine label="Guests" value="2 adults" />
      <ContextLine label="Room" value="Standard · flexible" />
    </div>
  );
}

function ContextLine({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
      <span style={{ color: NEX.textMid }}>{label}</span>
      <span style={{ color: NEX.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function TextArea({ label }: { label: string }): React.ReactElement {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, color: NEX.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>
        {label}
      </span>
      <textarea
        disabled
        rows={3}
        placeholder="e.g. We're arriving at 11pm · will someone be at reception?"
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${NEX.divider}`,
          background: NEX.bgSoft,
          fontSize: 14,
          color: NEX.text,
          resize: "vertical",
          fontFamily: "inherit",
          outline: "none",
        }}
      />
    </label>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Shared overlay chrome
// ═════════════════════════════════════════════════════════════════════

function OverlayShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="nex-mobile-shell"
        style={{
          background: NEX.bg,
          borderRadius: "20px 20px 0 0",
          maxHeight: "90dvh",
          display: "flex",
          flexDirection: "column",
          boxShadow: NEX.shadowLg,
          animation: "nex-sheet-up 220ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
        }}
      >
        <style>{`
          @keyframes nex-sheet-up {
            from { transform: translateY(24px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>
        <div
          style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: `1px solid ${NEX.divider}`,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NEX.text }}>{title}</div>
            {subtitle ? (
              <div style={{ fontSize: 12, color: NEX.textMuted, marginTop: 2 }}>{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              flex: "0 0 auto",
              width: 32,
              height: 32,
              borderRadius: 999,
              border: `1px solid ${NEX.divider}`,
              background: NEX.surface,
              color: NEX.textMid,
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
