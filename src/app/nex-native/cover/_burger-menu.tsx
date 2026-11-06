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
}: BurgerMenuProps): React.JSX.Element {
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
      {/* Top-right cluster · owner directive 2026-11-06 · the cart
          icon returns to the header to the LEFT of the burger (just
          icon, no button chrome · matches HeaderIconLink tone) wired
          to the sealed NEX_CART_STORAGE_KEY + AddToCartButton events
          via HeaderCartIcon variant="inline". The old bottom-sticky
          Cart button is hidden in the preview via ?embed=1 CSS. */}
      <div
        style={{
          position: "absolute",
          top: 14,
          right: 56,
          zIndex: 50,
          display: "inline-flex",
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
          top: 10,
          right: 10,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "rgba(0, 0, 0, 0.55)",
          border: `1px solid ${GOLD}`,
          color: CREAM,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          zIndex: 50,
          backdropFilter: "blur(10px)",
          WebkitTapHighlightColor: "transparent",
          padding: 0,
          boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
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
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "shipping" ? (
        <ShippingReturnsSheet onClose={() => setSheet(null)} />
      ) : null}
      {sheet === "services" ? (
        <ServicesSheet
          ownerHandle={ownerHandle ?? null}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "about" ? (
        <AboutUsSheet onClose={() => setSheet(null)} />
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
  onClose,
  children,
}: {
  title: string;
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
          borderTop: `2px solid ${GOLD}`,
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
            background: BORDER_HI,
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
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 900,
              color: GOLD,
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
  onClose,
}: {
  address?: string | null;
  hours?: ReadonlyArray<{ day: string; hours: string }> | null;
  mapsHref: string;
  directionsHref: string;
  onClose: () => void;
}) {
  return (
    <Sheet title="Visit us" onClose={onClose}>
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
function ShippingReturnsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Shipping & Returns" onClose={onClose}>
      <section style={{ marginBottom: 14 }}>
        <div style={sectionCapStyle}>📦 Dispatch</div>
        <p style={sheetBodyStyle}>
          Orders ship within 1–2 business days from Dublin. Tracked
          delivery with email + SMS updates.
        </p>
      </section>
      <section style={{ marginBottom: 14 }}>
        <div style={sectionCapStyle}>🚚 Delivery</div>
        <p style={sheetBodyStyle}>
          Standard delivery across Ireland · 2–4 business days. UK + EU
          delivery · 5–8 business days. Free delivery on orders over €50.
        </p>
      </section>
      <section>
        <div style={sectionCapStyle}>↩️ Returns</div>
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
  onClose,
}: {
  ownerHandle: string | null;
  onClose: () => void;
}) {
  const chatHref = ownerHandle
    ? `/nex-native/chat/peer/${encodeURIComponent(ownerHandle)}`
    : null;
  return (
    <Sheet title="Services" onClose={onClose}>
      <section style={{ marginBottom: 14 }}>
        <div style={sectionCapStyle}>🛒 Retail</div>
        <p style={sheetBodyStyle}>
          Buy direct from the shop — products listed are in stock and
          ship as shown. Secure checkout, tracked delivery.
        </p>
      </section>
      <section style={{ marginBottom: 14 }}>
        <div style={sectionCapStyle}>🏷 Wholesale</div>
        <p style={sheetBodyStyle}>
          Bulk orders for stockists + trade clients. Trade pricing,
          volume discounts, and consolidated dispatch on request.
        </p>
      </section>
      <section>
        <div style={sectionCapStyle}>✨ Custom orders</div>
        <p style={sheetBodyStyle}>
          Make-to-suit. Send dimensions, colours, materials, or a
          reference photo — owner replies with a quote + lead time.
        </p>
      </section>
      {chatHref ? (
        <a href={chatHref} style={{ ...ctaPrimaryStyle, marginTop: 18 }}>
          Chat with owner about a custom order →
        </a>
      ) : (
        <div style={{ ...ctaSecondaryStyle, marginTop: 18 }}>
          Chat opens once the shop owner signs in.
        </div>
      )}
    </Sheet>
  );
}

// -----------------------------------------------------------------------------
// AboutUsSheet · for templates that have no inline description block
// in the design (product-grid-first templates). Owner-authorised
// 2026-11-06. Real content lives on nex_business; placeholder here.
// -----------------------------------------------------------------------------
function AboutUsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="About us" onClose={onClose}>
      <section style={{ marginBottom: 14 }}>
        <div style={sectionCapStyle}>Our story</div>
        <p style={sheetBodyStyle}>
          A short description of the shop lives here — who you are,
          what you make, and the craft or care that goes into each
          piece.
        </p>
      </section>
      <section style={{ marginBottom: 14 }}>
        <div style={sectionCapStyle}>What we make</div>
        <p style={sheetBodyStyle}>
          Signature products, materials, and the style that makes this
          shop yours.
        </p>
      </section>
      <section>
        <div style={sectionCapStyle}>Where we&rsquo;re based</div>
        <p style={sheetBodyStyle}>
          Address, workshop or showroom location, and the area you
          serve.
        </p>
      </section>
      <p style={sheetHintStyle}>
        Edit this in Manage → Shop → About, and it shows here on every
        template without an inline About block.
      </p>
    </Sheet>
  );
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
