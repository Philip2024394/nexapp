"use client";

// src/app/nex-native/cover/_burger-menu.tsx
//
// Shop cover · top-right burger menu.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// World-class shop apps keep the cover screen focused on products and
// move address/hours/returns/dispatch into a secondary menu. This
// component is the sealed burger that lives in the top-right of the
// shop cover. It renders for every template without touching the
// sealed layout primitives.
//
// Scope (Phase A):
//   · Visual burger (36×36 round · gold-bordered) in top-right.
//   · Tap opens a right-anchored dropdown with the sealed rows:
//       📍 Visit us      → mailto / Google Maps link (TBD wire)
//       🕒 Hours         → inline expand with weekly hours (placeholder)
//       📦 Dispatch      → routes to the (TBD) dispatch policy page
//       ↩️  Returns      → routes to the (TBD) returns policy page
//       📑 Wholesale     → opens a (TBD) wholesale enquiry form
//       💬 Chat with us  → opens the sealed peer-chat to the owner
//       🔗 Share shop    → native share sheet
//   · Phase A ships the UI + the Visit-us + Share + Chat wires;
//     policy pages land in a follow-up.
//
// Positioning: `position: absolute; top: 8; right: 8` inside the
// cover container · zIndex above the wallpaper + scrim · DOES NOT
// use `position: fixed` so the sealed phone-frame transform doesn't
// trap it (position:absolute scopes to the nearest positioned
// ancestor · PhoneFrame has one).

import * as React from "react";
import { HeaderCartIcon } from "../_header-cart-icon";

interface BurgerMenuProps {
  /** Owner's NEX handle so the "Chat with us" row can deep-link
   *  directly into /nex-native/chat/peer/<handle>. Null when the
   *  preview is rendering mock content (chat row becomes an inert
   *  placeholder). */
  readonly ownerHandle?: string | null;
  /** Shop address for the Google Maps row · when null the "Visit
   *  us" row still shows but opens maps.google.com without a query. */
  readonly address?: string | null;
  /** Optional per-day hours for the inline hours block. When null
   *  the row shows "Hours coming soon". */
  readonly hours?: ReadonlyArray<{ day: string; hours: string }> | null;
  /** Public shop URL for the share action. */
  readonly shopUrl?: string | null;
  /** Owner directive 2026-11-06 · "same theme color as front
   *  theme" · the burger overlays (About Us in particular) live
   *  OUTSIDE the CoverThemeSkin wrapper so --nex-accent doesn't
   *  inherit · callers thread the applied tint explicitly. Falls
   *  back to the world-palette gold when omitted. */
  readonly accentHex?: string | null;
}

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "#FAF8F4";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const SURFACE = "rgba(5, 15, 28, 0.94)";
const BORDER = "rgba(198, 161, 91, 0.3)";
const BORDER_HI = "rgba(198, 161, 91, 0.65)";

export function BurgerMenu({
  ownerHandle,
  address,
  hours,
  shopUrl,
  accentHex,
}: BurgerMenuProps): React.JSX.Element {
  const accent =
    accentHex && /^#[0-9A-Fa-f]{6}$/.test(accentHex)
      ? accentHex
      : "#C6A15B";
  const [open, setOpen] = React.useState(false);
  // Owner-authorised 2026-11-06: four slide-up sheets replace the inline
  // dropdown rows for content-heavy sections (world-standard Airbnb /
  // Google Business pattern — related fields grouped into ONE info card):
  //   · visit    → address + hours + map + directions
  //   · shipping → dispatch + delivery + returns details
  //   · services → retail · wholesale · custom-made toggles
  //   · about    → business description (for templates with no inline
  //                About block in the design).
  type SheetKey = "visit" | "shipping" | "services" | "about" | null;
  const [sheet, setSheet] = React.useState<SheetKey>(null);

  // Close on Escape · covers both the dropdown and any open sheet.
  React.useEffect(() => {
    if (!open && !sheet) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (sheet) setSheet(null);
      else if (open) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, sheet]);

  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : "https://www.google.com/maps";
  const directionsHref = address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
    : "https://www.google.com/maps/dir/";

  function openSheet(key: Exclude<SheetKey, null>) {
    setOpen(false);
    setSheet(key);
  }

  function onShare() {
    if (!shopUrl || typeof navigator === "undefined") return;
    if ("share" in navigator) {
      navigator
        .share({ title: "Shop on NEX", url: shopUrl })
        .catch(() => {
          void navigator.clipboard?.writeText(shopUrl);
        });
    } else {
      void navigator.clipboard?.writeText(shopUrl);
    }
  }

  return (
    <>
      {/* Top-right cluster · owner directive 2026-11-06 (revised) ·
          cart icon enlarged alongside the burger · burger button
          chrome removed (no dark circle, no gold ring) so it reads
          as just a bold stroke-3 glyph like the cart. Both icons
          drop-shadow for legibility over any background. Burger
          sits against the right edge; cart sits ~30px to its left. */}
      <div
        style={{
          position: "absolute",
          /* Owner directive 2026-11-06 (refined) · "cart icon move
             up little same row as burger icon". The 1.6× scale +
             top-right transform origin pushed the cart's visible
             centre below the burger's · drop top from 10 → 4 so
             both icons sit on a shared horizontal row. */
          top: 4,
          right: 56,
          zIndex: 50,
          display: "inline-flex",
          color: CREAM,
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.75))",
          transform: "scale(1.6)",
          transformOrigin: "top right",
        }}
        data-nex-shop-header-cart
      >
        <HeaderCartIcon variant="inline" />
      </div>
      <button
        type="button"
        aria-label="Shop menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-nex-shop-burger
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          width: 32,
          height: 32,
          borderRadius: 0,
          background: "transparent",
          border: "none",
          color: CREAM,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          zIndex: 50,
          WebkitTapHighlightColor: "transparent",
          padding: 0,
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.75))",
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          aria-hidden
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      {open ? (
        <>
          {/* Click-outside backdrop. */}
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "transparent",
              zIndex: 49,
            }}
          />
          {/* Dropdown. */}
          <nav
            aria-label="Shop menu"
            data-nex-shop-burger-menu
            style={{
              position: "absolute",
              top: 54,
              right: 10,
              width: 240,
              maxWidth: "calc(100% - 20px)",
              background: SURFACE,
              border: `1px solid ${BORDER_HI}`,
              borderRadius: 14,
              boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
              overflow: "hidden",
              zIndex: 50,
              color: INK,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {/* Visit us · opens combined slider (address · hours · map
                · directions). Hours was previously an inline expand;
                merged into this single sheet 2026-11-06. */}
            <SheetRow
              icon="📍"
              label="Visit us"
              sublabel="Address · hours · directions"
              onClick={() => openSheet("visit")}
            />
            {/* Shipping & Returns · one slider with Dispatch,
                Delivery and Returns sub-sections (owner-authorised
                2026-11-06 · replaces the two separate rows). */}
            <SheetRow
              icon="📦"
              label="Shipping & Returns"
              sublabel="Dispatch · delivery · returns"
              onClick={() => openSheet("shipping")}
            />
            {/* Services · retail · wholesale · custom-made toggles
                (owner-authorised 2026-11-06 · replaces Wholesale-only
                row · owner can advertise direct sale OR make-to-suit). */}
            <SheetRow
              icon="🛠"
              label="Services"
              sublabel="Retail · wholesale · custom orders"
              onClick={() => openSheet("services")}
            />
            {/* About us · for templates without an inline description
                block (owner-authorised 2026-11-06). */}
            <SheetRow
              icon="🏷"
              label="About us"
              sublabel="Your story · what you make"
              onClick={() => openSheet("about")}
            />
            {shopUrl ? (
              <button
                type="button"
                onClick={onShare}
                style={{ ...menuRowStyle(true), borderBottom: "none" }}
              >
                <span style={iconStyle} aria-hidden>
                  🔗
                </span>
                <span style={{ flex: 1, textAlign: "left" }}>
                  <span style={labelStyle}>Share shop</span>
                  <span style={sublabelStyle}>Copy link / share</span>
                </span>
              </button>
            ) : null}
          </nav>
        </>
      ) : null}

      {/* Slide-up info sheets · all phone-frame-scoped (position:
          absolute scopes to nearest positioned ancestor · PhoneFrame
          is one · owner-sealed shop-page phone-frame rule 2026-11-06). */}
      {sheet === "visit" ? (
        <VisitUsSheet
          address={address}
          hours={hours}
          mapsHref={mapsHref}
          directionsHref={directionsHref}
          accent={accent}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "shipping" ? (
        <ShippingReturnsSheet
          accent={accent}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "services" ? (
        <ServicesSheet
          ownerHandle={ownerHandle ?? null}
          accent={accent}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "about" ? (
        <AboutUsSheet accent={accent} onClose={() => setSheet(null)} />
      ) : null}
    </>
  );
}

function MenuRow({
  icon,
  label,
  sublabel,
  href,
  external,
  disabled,
}: {
  icon: string;
  label: string;
  sublabel: string;
  href: string;
  external?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div style={{ ...menuRowStyle(false), opacity: 0.6, cursor: "not-allowed" }}>
        <span style={iconStyle} aria-hidden>
          {icon}
        </span>
        <span style={{ flex: 1 }}>
          <span style={labelStyle}>{label}</span>
          <span style={sublabelStyle}>Coming soon · {sublabel}</span>
        </span>
      </div>
    );
  }
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      style={menuRowStyle(false)}
    >
      <span style={iconStyle} aria-hidden>
        {icon}
      </span>
      <span style={{ flex: 1 }}>
        <span style={labelStyle}>{label}</span>
        <span style={sublabelStyle}>{sublabel}</span>
      </span>
      <span style={{ color: INK_DIM, fontSize: 12 }} aria-hidden>
        {external ? "↗" : "›"}
      </span>
    </a>
  );
}

const menuRowStyle = (last: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 14px",
  background: "transparent",
  color: INK,
  textDecoration: "none",
  border: "none",
  borderBottom: last ? "none" : `1px solid ${BORDER}`,
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "inherit",
  width: "100%",
  textAlign: "left",
});

const iconStyle: React.CSSProperties = {
  fontSize: 18,
  width: 24,
  textAlign: "center",
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 700,
};

const sublabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10.5,
  color: INK_DIM,
  marginTop: 1,
  lineHeight: 1.3,
};

// -----------------------------------------------------------------------------
// SheetRow · burger-menu row that opens a slide-up sheet instead of
// linking externally. Keeps the visual language identical to MenuRow
// but drives an onClick handler.
// -----------------------------------------------------------------------------
function SheetRow({
  icon,
  label,
  sublabel,
  onClick,
}: {
  icon: string;
  label: string;
  sublabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={menuRowStyle(false)}
      data-nex-shop-sheet-trigger={label.toLowerCase().replace(/\s+/g, "-")}
    >
      <span style={iconStyle} aria-hidden>
        {icon}
      </span>
      <span style={{ flex: 1, textAlign: "left" }}>
        <span style={labelStyle}>{label}</span>
        <span style={sublabelStyle}>{sublabel}</span>
      </span>
      <span style={{ color: INK_DIM, fontSize: 12 }} aria-hidden>
        ›
      </span>
    </button>
  );
}

// -----------------------------------------------------------------------------
// Sheet · shared slide-up panel wrapper. World-standard phone sheet
// (grab-handle, rounded top, backdrop click-outside, Escape via parent).
// Scoped to the phone frame via position:absolute.
// -----------------------------------------------------------------------------
const SHEET_SURFACE = "rgba(5, 15, 28, 0.98)";

function Sheet({
  title,
  accent,
  onClose,
  children,
}: {
  title: string;
  accent: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(2px)",
          zIndex: 60,
        }}
      />
      <section
        role="dialog"
        aria-label={title}
        data-nex-shop-sheet={title.toLowerCase().replace(/\s+/g, "-")}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "88%",
          background: SHEET_SURFACE,
          color: INK,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          /* Owner directive 2026-11-06 · sheet accents (top border,
             title colour, grab handle, header divider) now follow
             the applied theme tint so Shipping & Returns / Services
             / Visit Us all paint in the current template's colour. */
          borderTop: `2px solid ${accent}`,
          boxShadow: "0 -20px 40px rgba(0,0,0,0.65)",
          zIndex: 61,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "Inter, system-ui, sans-serif",
          animation: "nexShopSheetSlideUp 220ms ease-out",
        }}
      >
        <style>{`@keyframes nexShopSheetSlideUp { from { transform: translateY(16%); opacity: 0.4; } to { transform: translateY(0); opacity: 1; } }`}</style>
        <div
          aria-hidden
          style={{
            width: 36,
            height: 4,
            background: hexAlpha(accent, 0.6),
            borderRadius: 999,
            margin: "8px auto 2px",
          }}
        />
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 14px 12px",
            borderBottom: `1px solid ${hexAlpha(accent, 0.25)}`,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 900,
              color: accent,
              letterSpacing: "0.02em",
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              color: INK,
              border: `1px solid ${BORDER}`,
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </header>
        <div style={{ overflow: "auto", flex: 1, padding: "14px 14px 18px" }}>
          {children}
        </div>
      </section>
    </>
  );
}

// -----------------------------------------------------------------------------
// VisitUsSheet · address · hours · map placeholder · directions.
// Phase A (owner-authorised 2026-11-06): the "expand to full map" action
// is handled by a Google Maps deep-link (native maps app on mobile, web
// on desktop). Phase B+ will replace the placeholder with a real static
// map image + optional in-app expanded modal.
// -----------------------------------------------------------------------------
function VisitUsSheet({
  address,
  hours,
  mapsHref,
  directionsHref,
  accent,
  onClose,
}: {
  address?: string | null;
  hours?: ReadonlyArray<{ day: string; hours: string }> | null;
  mapsHref: string;
  directionsHref: string;
  accent: string;
  onClose: () => void;
}) {
  return (
    <Sheet title="Visit us" accent={accent} onClose={onClose}>
      {/* Map placeholder · tap or magnifier opens native maps. */}
      <a
        href={mapsHref}
        target="_blank"
        rel="noreferrer"
        aria-label="Open map in Google Maps"
        style={{
          display: "block",
          position: "relative",
          width: "100%",
          height: 140,
          borderRadius: 12,
          border: `1px solid ${BORDER_HI}`,
          background:
            "linear-gradient(135deg, rgba(27, 81, 56, 0.6) 0%, rgba(18, 61, 43, 0.9) 60%, rgba(5, 15, 28, 0.9) 100%)",
          textDecoration: "none",
          overflow: "hidden",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: 36,
            filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.5))",
          }}
        >
          📍
        </span>
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 34,
            height: 34,
            borderRadius: 999,
            background: "rgba(0,0,0,0.6)",
            color: CREAM,
            border: `1px solid ${GOLD}`,
            display: "grid",
            placeItems: "center",
            fontSize: 16,
            backdropFilter: "blur(6px)",
            boxShadow: "0 4px 10px rgba(0,0,0,0.45)",
          }}
        >
          🔍
        </span>
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "6px 10px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: GOLD,
            background:
              "linear-gradient(0deg, rgba(0,0,0,0.75), rgba(0,0,0,0) 100%)",
            textAlign: "center",
          }}
        >
          Tap to view full map
        </span>
      </a>

      <div style={{ marginTop: 14 }}>
        <div style={sectionCapStyle}>Our Address</div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.45,
            color: INK,
            marginTop: 4,
            whiteSpace: "pre-line",
          }}
        >
          {address ?? "Add your address in shop settings."}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={sectionCapStyle}>Hours</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            rowGap: 4,
            columnGap: 12,
            marginTop: 4,
            fontSize: 12,
            color: INK_DIM,
          }}
        >
          {(hours && hours.length > 0
            ? hours
            : [{ day: "Hours coming soon", hours: "" }]
          ).map((r) => (
            <React.Fragment key={r.day}>
              <span style={{ color: GOLD, fontWeight: 700 }}>{r.day}</span>
              <span>{r.hours}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginTop: 18,
        }}
      >
        <a
          href={mapsHref}
          target="_blank"
          rel="noreferrer"
          style={ctaSecondaryStyle}
        >
          Open in Maps ↗
        </a>
        <a
          href={directionsHref}
          target="_blank"
          rel="noreferrer"
          style={ctaPrimaryStyle}
        >
          Get Directions ↗
        </a>
      </div>
    </Sheet>
  );
}

// -----------------------------------------------------------------------------
// ShippingReturnsSheet · dispatch · delivery · returns all in one
// sheet with per-section details. Content is placeholder copy; owner
// will wire real values once Shop Settings ships that form.
// -----------------------------------------------------------------------------
function ShippingReturnsSheet({
  accent,
  onClose,
}: {
  accent: string;
  onClose: () => void;
}) {
  const cap = { ...sectionCapStyle, color: accent };
  return (
    <Sheet title="Shipping & Returns" accent={accent} onClose={onClose}>
      <section style={{ marginBottom: 14 }}>
        <div style={cap}>📦 Dispatch</div>
        <p style={sheetBodyStyle}>
          Orders ship within 1–2 business days from Dublin. Tracked
          delivery with email + SMS updates.
        </p>
      </section>
      <section style={{ marginBottom: 14 }}>
        <div style={cap}>🚚 Delivery</div>
        <p style={sheetBodyStyle}>
          Standard delivery across Ireland · 2–4 business days. UK + EU
          delivery · 5–8 business days. Free delivery on orders over €50.
        </p>
      </section>
      <section>
        <div style={cap}>↩️ Returns</div>
        <p style={sheetBodyStyle}>
          Change of mind returns accepted within 30 days · item must be
          unused and in original packaging. Full refund issued to the
          original payment method within 5 business days of receipt.
        </p>
      </section>
      <p style={sheetHintStyle}>
        Specific policies for this shop? Owner can edit these in
        Manage → Shop → Policies.
      </p>
    </Sheet>
  );
}

// -----------------------------------------------------------------------------
// ServicesSheet · retail · wholesale · custom-made. Replaces the
// wholesale-only row — owner can advertise direct sale AND/OR
// make-to-suit services. "Enquire" row deep-links to owner chat.
// -----------------------------------------------------------------------------
function ServicesSheet({
  ownerHandle,
  accent,
  onClose,
}: {
  ownerHandle: string | null;
  accent: string;
  onClose: () => void;
}) {
  const chatHref = ownerHandle
    ? `/nex-native/chat/peer/${encodeURIComponent(ownerHandle)}`
    : null;
  const cap = { ...sectionCapStyle, color: accent };
  return (
    <Sheet title="Services" accent={accent} onClose={onClose}>
      <section style={{ marginBottom: 14 }}>
        <div style={cap}>🛒 Retail</div>
        <p style={sheetBodyStyle}>
          Buy direct from the shop — products listed are in stock and
          ship as shown. Secure checkout, tracked delivery.
        </p>
      </section>
      <section style={{ marginBottom: 14 }}>
        <div style={cap}>🏷 Wholesale</div>
        <p style={sheetBodyStyle}>
          Bulk orders for stockists + trade clients. Trade pricing,
          volume discounts, and consolidated dispatch on request.
        </p>
      </section>
      <section>
        <div style={cap}>✨ Custom orders</div>
        <p style={sheetBodyStyle}>
          Make-to-suit. Send dimensions, colours, materials, or a
          reference photo — owner replies with a quote + lead time.
        </p>
      </section>
      {/* Owner directive 2026-11-06 · "services remove this Chat
          opens once the shop owner signs in · we have floating
          chat button on each shop theme". Signed-out fallback was
          redundant · the sealed ShopChatFab bottom-right already
          handles chat intent across every template. */}
      {chatHref ? (
        <a href={chatHref} style={{ ...ctaPrimaryStyle, marginTop: 18 }}>
          Chat with owner about a custom order →
        </a>
      ) : null}
    </Sheet>
  );
}

// -----------------------------------------------------------------------------
// AboutUsSheet · for templates that have no inline description block
// in the design (product-grid-first templates). Owner-authorised
// 2026-11-06. Real content lives on nex_business; placeholder here.
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// AboutUsSheet · owner directive 2026-11-06 refined twice:
//   · First pass · full-overlay frosted-glass with mock body content
//   · Second pass · pin + clock meta line, accent tracks the applied
//                   theme tint, compacted so content fits the phone
//                   without forced scroll, close top-right, socials
//                   bottom-right (bottom footer).
//
// Positioning stays position:absolute inset:0 so the overlay covers
// the whole shop frame but doesn't escape the sealed phone-frame
// containing block.
// -----------------------------------------------------------------------------
function AboutUsSheet({
  accent,
  onClose,
}: {
  accent: string;
  onClose: () => void;
}) {
  // Mock hours logic for the clock meta line · "Closing today 18:00"
  // when still open · "Opens tomorrow 10:00" when outside hours · all
  // computed client-side from a simple 10:00–18:00 Tues–Sat mock. The
  // wire batch swaps this for real nex_business.hours_by_day data.
  const todayStatus = React.useMemo(() => computeMockOpenStatus(), []);

  return (
    <div
      role="dialog"
      aria-label="About us"
      data-nex-shop-sheet="about-us"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 70,
        background: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(14px) saturate(1.1)",
        WebkitBackdropFilter: "blur(14px) saturate(1.1)",
        color: INK,
        display: "flex",
        flexDirection: "column",
        padding:
          "calc(env(safe-area-inset-top, 0px) + 14px) 14px calc(env(safe-area-inset-bottom, 0px) + 14px)",
        boxSizing: "border-box",
        fontFamily: "Inter, system-ui, sans-serif",
        animation: "nexShopAboutFadeIn 240ms ease-out",
      }}
    >
      <style>{`
        @keyframes nexShopAboutFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nexAboutPing {
          0%   { transform: scale(1); opacity: 0.55; }
          80%  { transform: scale(1.7); opacity: 0; }
          100% { transform: scale(1.7); opacity: 0; }
        }
      `}</style>

      {/* Close · top-right · gold-rimmed circle in the applied
          accent so it reads as part of the theme. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        data-nex-shop-about-close
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 30,
          height: 30,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          color: CREAM,
          border: `1px solid ${hexAlpha(accent, 0.55)}`,
          cursor: "pointer",
          fontSize: 15,
          lineHeight: 1,
          padding: 0,
          zIndex: 1,
        }}
      >
        ×
      </button>

      {/* HEADER · profile avatar + business name + online dot + meta
          line with pin location and clock hours. Avatar + accents
          track the applied theme tint so the overlay feels native
          to the current template. */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingBottom: 10,
          borderBottom: `1px solid ${hexAlpha(accent, 0.25)}`,
          paddingRight: 40,
        }}
      >
        {/* Owner directive 2026-11-06 (refined) · "about us show
            have the same style profile ping and country flag round
            image". Sealed CoverIdentityBadge vocabulary scaled to
            the overlay's 48px portrait: two pulsing green ping
            rings for online presence + a small round flag badge
            in the bottom-right where the sealed badge's charm
            sits. */}
        <div
          style={{
            position: "relative",
            width: 48,
            height: 48,
            flexShrink: 0,
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: "50%",
              border: "2px solid #22C55E",
              animation:
                "nexAboutPing 2s cubic-bezier(0, 0, 0.2, 1) infinite",
              pointerEvents: "none",
            }}
          />
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: "50%",
              border: "2px solid #22C55E",
              animation:
                "nexAboutPing 2s cubic-bezier(0, 0, 0.2, 1) infinite",
              animationDelay: "1s",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "relative",
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${accent}, ${darken(accent, 0.35)})`,
              display: "grid",
              placeItems: "center",
              color: readableInk(accent),
              fontSize: 18,
              fontWeight: 900,
              boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
              border: `2px solid ${accent}`,
            }}
          >
            IP
          </div>
          {/* Country flag badge · bottom-right · same anchor as
              the sealed CoverIdentityBadge flag · 18px circle so
              it reads at 48px portrait scale. */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#03101D",
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              border: `1.5px solid ${accent}`,
              boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
            }}
          >
            🇮🇪
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 900,
              color: CREAM,
              letterSpacing: "-0.01em",
              lineHeight: 1.15,
            }}
          >
            Irish Pride
          </div>
          {/* Owner directive 2026-11-06 (refined) · "this should be
              under business name 1 row · Dublin, Ireland and same
              on front shop page". Single-row location line under
              the name · no "Online ·" prefix (presence stays on
              the avatar rim per sealed vocabulary). */}
          <div
            style={{
              fontSize: 11,
              color: INK_DIM,
              letterSpacing: "0.03em",
              marginTop: 2,
              lineHeight: 1.2,
            }}
          >
            Dublin, Ireland
          </div>
        </div>
      </header>

      {/* Meta row · owner directive 2026-11-06 refined · clock
          status moved to the RIGHT side (hours scan right-to-left
          like a shop sign), pin + address dropped out of this row
          (they sit at the lower end of the page just above the
          social footer per owner request). */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "10px 0 6px",
          fontSize: 10.5,
          color: INK_DIM,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span
            aria-hidden
            style={{ color: accent, fontSize: 13, lineHeight: 1 }}
          >
            🕐
          </span>
          <span style={{ color: todayStatus.isOpen ? "#16D66B" : CREAM }}>
            {todayStatus.label}
          </span>
        </span>
      </div>

      {/* BODY · two compact sections so content fits the phone
          without forced scroll · auto overflow stays on so long
          real-business copy can still scroll when it lands. */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <section style={{ marginBottom: 10 }}>
          <div style={{ ...sectionCapStyle, color: accent }}>Our story</div>
          <p style={{ ...sheetBodyStyle, fontSize: 12, lineHeight: 1.45 }}>
            A small Dublin workshop built on the idea that everyday
            objects deserve to be made properly · local materials,
            long-time collaborators, steady hands.
          </p>
        </section>
        <section>
          <div style={{ ...sectionCapStyle, color: accent }}>What we make</div>
          <p style={{ ...sheetBodyStyle, fontSize: 12, lineHeight: 1.45 }}>
            Signature pieces in our own designs, custom orders built
            to size, and limited seasonal drops · finished by hand ·
            shipped in recycled packaging.
          </p>
        </section>
      </div>

      {/* Owner directive 2026-11-06 refined · address moved to the
          lower end of the page · sits just above the social footer
          so the full street address reads as a direct "visit us"
          cue right before the user taps a social link. */}
      <div
        style={{
          padding: "10px 0 12px",
          borderTop: `1px solid ${hexAlpha(accent, 0.18)}`,
          marginTop: 10,
          fontSize: 11,
          color: INK_DIM,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          aria-hidden
          style={{ color: accent, fontSize: 14, lineHeight: 1 }}
        >
          📍
        </span>
        12 Francis Street · Dublin 8 · Ireland
      </div>

      {/* FOOTER · owner directive 2026-11-06 refined · "the scial
          media icons same style and design as shop page". Matches
          the sealed CoverIdentityRail buttons exactly: 34×34,
          borderRadius 10 (square-rounded, not circle), solid world
          gold fill, warm ink glyph, no border, no shadow, same
          stroke-1.4 SVG vocabulary. */}
      <footer
        style={{
          paddingTop: 12,
          borderTop: `1px solid ${hexAlpha(accent, 0.25)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        {SHOP_PAGE_SOCIAL_ICONS.map((s) => (
          <a
            key={s.label}
            href="#"
            aria-label={s.label}
            title={s.label}
            data-nex-pending-action={`social-${s.label.toLowerCase()}`}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "var(--nex-world-secondary, #C6A15B)",
              color: "#1A120A",
              display: "grid",
              placeItems: "center",
              textDecoration: "none",
              boxShadow: "none",
              border: "none",
            }}
          >
            {s.glyph}
          </a>
        ))}
      </footer>
    </div>
  );
}

// ─── Mock open-status + colour helpers ─────────────────────────────────
// Light-weight utilities colocated with AboutUsSheet so the component
// stays self-contained · follow-up batch will replace computeMockOpen-
// Status with a real hours lookup from nex_business.hours_by_day.

function computeMockOpenStatus(): { isOpen: boolean; label: string } {
  const now = new Date();
  const hour = now.getHours();
  // Mock schedule · Tues–Sat 10:00–18:00 · closed Sun / Mon.
  const day = now.getDay(); // 0=Sun 1=Mon 2=Tue … 6=Sat
  const openDay = day >= 2 && day <= 6;
  if (openDay && hour >= 10 && hour < 18) {
    return { isOpen: true, label: `Closing today ${18}:00` };
  }
  // Next open slot label.
  const tomorrow = (day + 1) % 7;
  const openLabel =
    tomorrow >= 2 && tomorrow <= 6
      ? "Opens tomorrow 10:00"
      : "Opens Tuesday 10:00";
  return { isOpen: false, label: openLabel };
}

function hexAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!m) return `rgba(198, 161, 91, ${alpha})`;
  const h = m[1]!;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darken(hex: string, amount: number): string {
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!m) return hex;
  const h = m[1]!;
  const r = Math.max(0, Math.floor(parseInt(h.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.floor(parseInt(h.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.floor(parseInt(h.slice(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ─── Shop-page-matched social icon catalogue ──────────────────────────
// Owner directive 2026-11-06 · the About Us socials row must render
// the same SVG vocabulary as CoverIdentityRail on the shop cover
// (stroke 1.4 · 16×16 viewBox 24 · currentColor fill) so the two
// surfaces feel like one design system. Matches primitives.tsx
// IconInstagram / IconTikTok / IconFacebook / IconWhatsApp / IconGlobe.
const SHOP_PAGE_SOCIAL_ICONS: ReadonlyArray<{
  label: string;
  glyph: React.ReactNode;
}> = [
  {
    label: "Instagram",
    glyph: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="4" width="16" height="16" rx="4.5" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="17" cy="7" r="0.9" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    glyph: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M14.5 4v9.2a3 3 0 11-3-3V13a1.7 1.7 0 100 3.4A1.7 1.7 0 0013.2 14V4h1.3c.2 1.7 1.4 3 3 3.2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    glyph: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M14 8h2V5h-2a3 3 0 00-3 3v2H9v3h2v7h3v-7h2l1-3h-3V8a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "WhatsApp",
    glyph: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 20l1.5-4A7 7 0 1112 19a7 7 0 01-3.5-.9L4 20zM9 9.5c0-.4.4-.5.7-.5s.5 0 .7.5.7 1.5.7 1.7-.2.4-.5.5c-.3.2-.4.3-.2.6.4.7 1.3 1.6 2 2 .3.1.5 0 .6-.2.2-.3.4-.5.7-.5.5 0 1.4.7 1.7.9.2.2.2.4.1.5-.3.6-1 1.1-1.7 1.1-1.4 0-3.4-1.5-4.4-3.4-.4-.6-.4-1.3-.4-1.7z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Website",
    glyph: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 12h16M12 4c2.5 2.5 3.5 5 3.5 8s-1 5.5-3.5 8M12 4C9.5 6.5 8.5 9 8.5 12s1 5.5 3.5 8" stroke="currentColor" strokeWidth="1.3" fill="none" />
      </svg>
    ),
  },
];

function readableInk(hex: string): string {
  // Simple WCAG-style luminance check · pick warm-ink #1A120A when
  // the accent is bright, pure white when it's dark.
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!m) return "#1A120A";
  const h = m[1]!;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 0.55 ? "#1A120A" : "#FAF8F4";
}

// -----------------------------------------------------------------------------
// Shared sheet styles.
// -----------------------------------------------------------------------------
const sectionCapStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: GOLD,
};

const sheetBodyStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: 12.5,
  lineHeight: 1.5,
  color: INK,
};

const sheetHintStyle: React.CSSProperties = {
  margin: "16px 0 0",
  fontSize: 11,
  color: INK_DIM,
  lineHeight: 1.5,
  textAlign: "center",
  fontStyle: "italic",
};

const ctaPrimaryStyle: React.CSSProperties = {
  display: "block",
  padding: "10px 12px",
  background: `linear-gradient(180deg, ${GOLD}, #A8894E)`,
  color: "#1A120A",
  textAlign: "center",
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  boxShadow: "0 6px 14px rgba(198,161,91,0.25)",
};

const ctaSecondaryStyle: React.CSSProperties = {
  display: "block",
  padding: "10px 12px",
  background: "rgba(255,255,255,0.05)",
  color: INK,
  textAlign: "center",
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 700,
  textDecoration: "none",
  border: `1px solid ${BORDER_HI}`,
};
