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
// Owner directive 2026-11-12 · HeaderCartIcon import retired · the
// mount was removed from the burger-menu header.
import type { ShopCoverContent } from "@/lib/nex-native/shop-cover-service";
import {
  isFaqItemEnabled,
  type NexInfoFaqItem,
} from "@/lib/nex-native/info-pages";
// Owner directive 2026-11-27 §D · "Download App" row appended as the
// FINAL burger entry on each storefront. The row manages its own
// install-flow state via useShopInstallFlow; we only pass the shop
// slug + display name + sealed row styles.
import { BurgerInstallRow } from "@/components/nex-native/shop-install/burger-install-row";

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
  /** Owner directive 2026-11-06 · "is all work wired and connected
   *  supabase". Threaded from the preview page's
   *  getShopCoverContent(businessId) call · lets the burger-menu
   *  overlays (About Us · Visit Us · Services) paint with the
   *  owner's real nex_business row instead of the hardcoded "Irish
   *  Pride / Dublin / 12 Francis Street" mock. Null when no
   *  business is in session · every sheet falls back to the mock
   *  per-field so the template view still reads as finished. */
  readonly content?: ShopCoverContent | null;
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
  content,
}: BurgerMenuProps): React.JSX.Element {
  // Owner-authored content overrides mock defaults field-by-field.
  // address/hours props (which the preview page already threaded)
  // still win over content.address/hoursDisplay when supplied — the
  // picker's live edits should beat the persisted shop row.
  const resolvedAddress = address ?? content?.address ?? null;
  const resolvedShopUrl =
    shopUrl ??
    (content?.slug ? `/nex-native/${content.slug}` : null);
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
  type SheetKey =
    | "visit"
    | "shipping"
    | "services"
    | "about"
    | "faq"
    | null;
  const [sheet, setSheet] = React.useState<SheetKey>(null);

  // Owner directive 2026-11-17 · Seller FAQ customer-facing surface.
  // Only entries that are enabled AND have both a non-empty question
  // AND a non-empty answer surface to buyers · unanswered rows stay
  // hidden per directive ("Only answered, published entries are shown
  // to customers"). If zero rows survive the filter the FAQ row never
  // renders — the shop looks the same as before.
  const publishedFaqItems: NexInfoFaqItem[] = React.useMemo(() => {
    const rows = content?.infoPages?.faq_items ?? [];
    return rows.filter(
      (row) =>
        isFaqItemEnabled(row) &&
        row.question.trim().length > 0 &&
        row.answer.trim().length > 0,
    );
  }, [content?.infoPages?.faq_items]);
  const ownerAccountId = content?.ownerAccountId ?? null;
  const shopDisplayName = content?.displayName ?? "the seller";

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

  const mapsHref = resolvedAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedAddress)}`
    : "https://www.google.com/maps";
  const directionsHref = resolvedAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(resolvedAddress)}`
    : "https://www.google.com/maps/dir/";

  function openSheet(key: Exclude<SheetKey, null>) {
    setOpen(false);
    setSheet(key);
  }

  function onShare() {
    if (!shopUrl || typeof navigator === "undefined") return;
    if (typeof navigator.share === "function") {
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
      {/* Owner directive 2026-11-12 · HeaderCartIcon removed from the
          shop template header. Supersedes the 2026-11-06 "cart icon
          enlarged alongside the burger" rule. Only the burger menu
          remains top-right · buyers reach the cart via the global
          drawer "My Orders" row or the direct /nex-native/cart URL. */}
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
          // Owner directive 2026-11-27 · burger icon colour locked to
          // black on the shop surface (supersedes the prior CREAM /
          // off-white stroke) so the control reads as a solid tap-
          // target against any cover image including the Scaffolding
          // in the Mist greyscale backdrop.
          color: "#000000",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          zIndex: 50,
          WebkitTapHighlightColor: "transparent",
          padding: 0,
          // Pale drop-shadow halo so the black strokes stay visible
          // against dark cover photos without fighting the cover tint.
          filter: "drop-shadow(0 1px 4px rgba(255,255,255,0.85))",
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
            {/* FAQ · owner-authorised 2026-11-17. Only renders when
                this shop has at least one published + answered FAQ
                entry · keeps the dropdown shape identical for shops
                that haven't filled it in yet. */}
            {publishedFaqItems.length > 0 ? (
              <SheetRow
                icon="❓"
                label="FAQ"
                sublabel={`${publishedFaqItems.length} common question${publishedFaqItems.length === 1 ? "" : "s"}`}
                onClick={() => openSheet("faq")}
              />
            ) : null}
            {shopUrl ? (
              <button
                type="button"
                onClick={onShare}
                style={menuRowStyle(false)}
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
            {/* Owner directive 2026-11-27 §D · "Download App" as the
                FINAL burger-menu item on each storefront. Hidden when
                the shop is already installed on this device so
                repeat-visit burgers stay tidy. */}
            {content?.slug ? (
              <BurgerInstallRow
                shopSlug={content.slug}
                shopDisplayName={content.displayName ?? "this shop"}
                rowStyle={menuRowStyle(true)}
                labelStyle={labelStyle}
                sublabelStyle={sublabelStyle}
                iconStyle={iconStyle}
                caretColor={INK_DIM}
                onAfterAction={() => setOpen(false)}
              />
            ) : null}
          </nav>
        </>
      ) : null}

      {/* Slide-up info sheets · all phone-frame-scoped (position:
          absolute scopes to nearest positioned ancestor · PhoneFrame
          is one · owner-sealed shop-page phone-frame rule 2026-11-06). */}
      {sheet === "visit" ? (
        <VisitUsSheet
          address={resolvedAddress}
          hours={hours}
          hoursDisplay={content?.hoursDisplay ?? null}
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
        <AboutUsSheet
          accent={accent}
          content={content ?? null}
          shopUrl={resolvedShopUrl}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "faq" ? (
        <FaqSheet
          items={publishedFaqItems}
          ownerAccountId={ownerAccountId}
          shopDisplayName={shopDisplayName}
          accent={accent}
          onClose={() => setSheet(null)}
        />
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
  hoursDisplay,
  mapsHref,
  directionsHref,
  accent,
  onClose,
}: {
  address?: string | null;
  hours?: ReadonlyArray<{ day: string; hours: string }> | null;
  /** Owner-authored hours string (nex_business.hours_display) ·
   *  renders as a single-row hint under the per-day grid when
   *  structured hours aren't provided. */
  hoursDisplay?: string | null;
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
            : hoursDisplay
              ? [{ day: "Open", hours: hoursDisplay }]
              : [{ day: "Hours coming soon", hours: "" }]
          ).map((r) => (
            <React.Fragment key={r.day}>
              <span style={{ color: GOLD, fontWeight: 700 }}>{r.day}</span>
              <span>{r.hours}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Owner directive 2026-11-06 · "visit us 1 button in footer
          · Get Directions". Open-in-Maps CTA dropped · the main
          map tile above already deep-links to the same Google Maps
          page when tapped, so a dedicated button was redundant.
          Directions stays as the single primary action. */}
      <a
        href={directionsHref}
        target="_blank"
        rel="noreferrer"
        style={{ ...ctaPrimaryStyle, marginTop: 18 }}
      >
        Get Directions ↗
      </a>
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
  content,
  shopUrl,
  onClose,
}: {
  accent: string;
  content: ShopCoverContent | null;
  shopUrl: string | null;
  onClose: () => void;
}) {
  // Mock hours logic for the clock meta line · "Closing today 18:00"
  // when still open · "Opens tomorrow 10:00" when outside hours · all
  // computed client-side from a simple 10:00–18:00 Tues–Sat mock. The
  // wire batch swaps this for real nex_business.hours_by_day data.
  const todayStatus = React.useMemo(() => computeMockOpenStatus(), []);

  // Owner directive 2026-11-06 · "is all work wired and connected
  // supabase". Content prop overrides each mock field · null parts
  // fall back to the mock so the preview still reads for visitors.
  const displayName = content?.displayName ?? "Irish Pride";
  const city = content?.city ?? "Dublin, Ireland";
  const description =
    content?.description ??
    "A small Dublin workshop built on the idea that everyday objects deserve to be made properly · local materials, long-time collaborators, steady hands.";
  const address =
    content?.address ?? "12 Francis Street · Dublin 8 · Ireland";
  const monogram = initialsFromName(displayName);

  // Social-handle URL builders · thread the raw handles the owner
  // typed (sans @) · fall back to the mock "#" href when the owner
  // hasn't set a handle yet so the row shape stays consistent.
  const socialHrefs = {
    Instagram: content?.instagramHandle
      ? `https://instagram.com/${content.instagramHandle}`
      : null,
    TikTok: content?.tiktokHandle
      ? `https://tiktok.com/@${content.tiktokHandle}`
      : null,
    Facebook: content?.facebookHandle
      ? `https://facebook.com/${content.facebookHandle}`
      : null,
    Website: content?.websiteUrl ?? null,
  };
  // Keep the shopUrl reference so the inline-share pattern can wire
  // in a follow-up · consumed by data-nex-pending-action tags today.
  void shopUrl;

  return (
    <div
      role="dialog"
      aria-label="About us"
      data-nex-shop-sheet="about-us"
      /* Owner directive 2026-11-06 · "about us should fit inside
         the phone width and show the round corners not square
         black color". Overlay now carries the sealed phone-frame
         border-radius (32px) so its rounded corners show through
         instead of painting a black square inside the tile. On
         surfaces with a smaller outer radius (themes-picker tile
         @ 18px), the parent's overflow: hidden clips the 32 down
         to its own shape, so the overlay still reads correctly. */
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
        borderRadius: 32,
        overflow: "hidden",
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
          /* Owner directive 2026-11-06 · "about us the phone edge
             line remove · we dont want phone color rim line" ·
             accent-tinted divider lines (header / address / footer)
             stripped so the overlay reads as a single flat sheet. */
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
            }}
          >
            {monogram}
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
            {displayName}
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
            {city}
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
          <p
            style={{
              ...sheetBodyStyle,
              fontSize: 12,
              lineHeight: 1.45,
              whiteSpace: "pre-line",
            }}
          >
            {description}
          </p>
        </section>
      </div>

      {/* Owner directive 2026-11-07 · dedicated Contact us section
          sits just above the social footer. Always labelled · the
          seller's phone/email become tap-to-call / tap-to-email
          links when present; address falls back to the content or
          mock. WhatsApp is deliberately NOT referenced (owner
          directive 2026-11-07). */}
      <section
        aria-label="Contact us"
        style={{
          marginTop: 10,
          padding: "12px 12px",
          borderRadius: 12,
          border: `1px solid ${accent}55`,
          background: "rgba(5, 15, 28, 0.55)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 900,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: accent,
          }}
        >
          Contact us
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11.5,
            color: INK_DIM,
            lineHeight: 1.4,
          }}
        >
          <span aria-hidden style={{ color: accent, fontSize: 14 }}>📍</span>
          <span>{address}</span>
        </div>

        {content?.publicPhone ? (
          <a
            href={`tel:${content.publicPhone.replace(/[^\d+]/g, "")}`}
            aria-label={`Call ${displayName}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11.5,
              color: INK,
              textDecoration: "none",
              lineHeight: 1.4,
            }}
          >
            <span aria-hidden style={{ color: accent, fontSize: 14 }}>📞</span>
            <span style={{ textDecoration: "underline" }}>
              {content.publicPhone}
            </span>
          </a>
        ) : null}

        {content?.publicEmail ? (
          <a
            href={`mailto:${content.publicEmail}`}
            aria-label={`Email ${displayName}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11.5,
              color: INK,
              textDecoration: "none",
              lineHeight: 1.4,
              wordBreak: "break-all",
            }}
          >
            <span aria-hidden style={{ color: accent, fontSize: 14 }}>✉</span>
            <span style={{ textDecoration: "underline" }}>
              {content.publicEmail}
            </span>
          </a>
        ) : null}
      </section>

      {/* FOOTER · owner directive 2026-11-06 refined · "the scial
          media icons same style and design as shop page". Matches
          the sealed CoverIdentityRail buttons exactly: 34×34,
          borderRadius 10 (square-rounded, not circle), solid world
          gold fill, warm ink glyph, no border, no shadow, same
          stroke-1.4 SVG vocabulary. */}
      <footer
        style={{
          paddingTop: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        {SHOP_PAGE_SOCIAL_ICONS.map((s) => {
          const href = socialHrefs[s.label as keyof typeof socialHrefs];
          const isWired = Boolean(href);
          return (
            <a
              key={s.label}
              href={href ?? "#"}
              target={isWired ? "_blank" : undefined}
              rel={isWired ? "noreferrer noopener" : undefined}
              aria-label={s.label}
              title={s.label}
              data-nex-pending-action={
                isWired ? undefined : `social-${s.label.toLowerCase()}`
              }
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
                opacity: isWired ? 1 : 0.55,
              }}
            >
              {s.glyph}
            </a>
          );
        })}
      </footer>
    </div>
  );
}

// -----------------------------------------------------------------------------
// FaqSheet · owner directive 2026-11-17. Renders the shop's published
// FAQ as an accordion inside the sealed Sheet wrapper so the surface
// feels identical to Visit Us / Services / About. One entry is open at
// a time (buyers scan top-to-bottom). A "Still have a question?" CTA
// at the bottom deep-links into the sealed peer chat with the owner.
// -----------------------------------------------------------------------------
function FaqSheet({
  items,
  ownerAccountId,
  shopDisplayName,
  accent,
  onClose,
}: {
  items: NexInfoFaqItem[];
  ownerAccountId: string | null;
  shopDisplayName: string;
  accent: string;
  onClose: () => void;
}) {
  const [openId, setOpenId] = React.useState<string | null>(
    items.length > 0 ? (items[0]?.id ?? null) : null,
  );
  const chatHref = ownerAccountId
    ? `/nex-native/chat/peer/${encodeURIComponent(ownerAccountId)}`
    : null;
  const cap = { ...sectionCapStyle, color: accent };
  return (
    <Sheet title="FAQ" accent={accent} onClose={onClose}>
      <div style={cap}>Common questions</div>
      <div
        style={{
          marginTop: 6,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {items.map((row) => {
          const isOpen = row.id === openId;
          return (
            <div
              key={row.id}
              style={{
                border: `1px solid ${hexAlpha(accent, 0.3)}`,
                borderRadius: 10,
                background: "rgba(5, 15, 28, 0.55)",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : row.id)}
                aria-expanded={isOpen}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 12px",
                  background: "transparent",
                  color: INK,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  fontSize: 12.5,
                  fontWeight: 700,
                  lineHeight: 1.35,
                }}
              >
                <span style={{ flex: 1 }}>{row.question}</span>
                <span
                  aria-hidden
                  style={{
                    color: accent,
                    fontSize: 14,
                    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 160ms ease-out",
                  }}
                >
                  ›
                </span>
              </button>
              {isOpen ? (
                <div
                  style={{
                    padding: "0 12px 12px",
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: INK_DIM,
                    whiteSpace: "pre-line",
                  }}
                >
                  {row.answer}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p style={sheetHintStyle}>
        Still have a question? Message {shopDisplayName} directly.
      </p>
      {chatHref ? (
        <a href={chatHref} style={{ ...ctaPrimaryStyle, marginTop: 8 }}>
          Message the seller →
        </a>
      ) : (
        <div
          style={{
            ...ctaSecondaryStyle,
            marginTop: 8,
            opacity: 0.6,
            cursor: "not-allowed",
          }}
        >
          Message the seller
        </div>
      )}
    </Sheet>
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

function initialsFromName(name: string | null | undefined): string {
  const safe = (name ?? "").trim();
  if (!safe) return "·";
  const parts = safe.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  const monogram = (a + b).toUpperCase();
  return monogram || "·";
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
// IconInstagram / IconTikTok / IconFacebook / IconGlobe. Owner
// directive 2026-11-07 · dropped WhatsApp from the social row ·
// phone is now a plain Contact-us listing with a tel: link, not a
// chat-app deep link.
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
