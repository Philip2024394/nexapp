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
  const [hoursExpanded, setHoursExpanded] = React.useState(false);

  // Close on Escape.
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : "https://www.google.com/maps";

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
      {/* Top-right icon cluster · cart + burger · owner directive
          2026-11-06: "burger icon and cart icon header right side
          yes". Flex row inside a positioned wrapper so both sit
          on the same baseline. */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          zIndex: 50,
        }}
      >
        <a
          href="/nex-native/cart"
          aria-label="Shopping cart"
          data-nex-shop-cart
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(0, 0, 0, 0.55)",
            border: `1px solid ${GOLD}`,
            color: CREAM,
            display: "grid",
            placeItems: "center",
            textDecoration: "none",
            backdropFilter: "blur(10px)",
            WebkitTapHighlightColor: "transparent",
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
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="9" cy="20" r="1.4" />
            <circle cx="17" cy="20" r="1.4" />
            <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 8H6" />
          </svg>
        </a>
        <button
          type="button"
          aria-label="Shop menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          data-nex-shop-burger
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(0, 0, 0, 0.55)",
            border: `1px solid ${GOLD}`,
            color: CREAM,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
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
      </div>

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
            {/* Visit us · opens Google Maps in a new tab. */}
            <MenuRow
              icon="📍"
              label="Visit us"
              sublabel={address ?? "Add an address in shop settings"}
              href={mapsHref}
              external
            />

            {/* Hours · inline expand. */}
            <button
              type="button"
              onClick={() => setHoursExpanded((v) => !v)}
              style={menuRowStyle(false)}
            >
              <span style={iconStyle} aria-hidden>
                🕒
              </span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span style={labelStyle}>Hours</span>
                <span style={sublabelStyle}>
                  {hoursExpanded ? "Hide schedule" : "Show schedule"}
                </span>
              </span>
              <span style={{ color: INK_DIM, fontSize: 14 }} aria-hidden>
                {hoursExpanded ? "▾" : "▸"}
              </span>
            </button>
            {hoursExpanded ? (
              <div
                style={{
                  padding: "4px 14px 10px 44px",
                  fontSize: 11,
                  color: INK_DIM,
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  rowGap: 3,
                  columnGap: 10,
                  borderBottom: `1px solid ${BORDER}`,
                }}
              >
                {(hours ?? [
                  { day: "Hours coming soon", hours: "" },
                ]).map((r) => (
                  <React.Fragment key={r.day}>
                    <span style={{ color: GOLD, fontWeight: 700 }}>
                      {r.day}
                    </span>
                    <span>{r.hours}</span>
                  </React.Fragment>
                ))}
              </div>
            ) : null}

            <MenuRow
              icon="📦"
              label="Dispatch & delivery"
              sublabel="Shipping times + areas"
              href="#"
              disabled
            />
            <MenuRow
              icon="↩️"
              label="Returns"
              sublabel="Return window + process"
              href="#"
              disabled
            />
            <MenuRow
              icon="📑"
              label="Wholesale enquiry"
              sublabel="Bulk orders · trade price"
              href="#"
              disabled
            />
            <MenuRow
              icon="💬"
              label="Chat with us"
              sublabel={ownerHandle ? `@${ownerHandle}` : "Preview mode"}
              href={
                ownerHandle
                  ? `/nex-native/chat/peer/${encodeURIComponent(ownerHandle)}`
                  : "#"
              }
              disabled={!ownerHandle}
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
