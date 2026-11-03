// src/app/nex-native/contacts/_prototype-shared.tsx
//
// Shared mock data + prototype nav for the Ireland layout prototypes.
// Not committed to main · Owner-review prototypes · delete after choice.
//
// Mock data mirrors the real `ContactRowDisplay` shape so the sealed
// `_contact-row.tsx` component renders identically here as in production.
// Irish Gold (#C6A15B) is passed through as `accentHex` so the row rim
// adopts the Ireland palette without touching the sealed row file.

import type * as React from "react";
import type { ContactRowDisplay } from "./_contacts-list";

/** Ireland world-secondary · Irish Gold · sealed 2026-11-01. */
export const PROTOTYPE_IRISH_GOLD = "#C6A15B";

/** Inline the Ireland world palette as CSS custom properties on the
 *  prototype's root element. This guarantees the sealed `_contact-row`
 *  renders in Ireland colours even when the local dev deployment has
 *  no `NEX_APP_IDENTITY` set (default resolves to `hq` / nex-original).
 *  Mirrors the values emitted by `_world-stylesheet.tsx` for the
 *  Ireland world. Preview-only · the live Ireland deployment emits
 *  these from the server stylesheet, so this inline block is a no-op
 *  there (CSS cascade: inherited parent vars win over empty children). */
export const IRELAND_PROTOTYPE_VARS = {
  "--nex-world-primary": "#1B5138",
  "--nex-world-secondary": "#C6A15B",
  "--nex-world-tertiary": "#C6A15B",
  // Owner directive 2026-11-03 · "page background same as header" ·
  // the phone-frame interior reads Emerald so the chrome, body, and
  // card family all share the Ireland deep-green surface. Cards keep
  // their drawer-bg (also Emerald) + gold rim + subtle shadow for
  // visual separation on the matching background.
  "--nex-world-background-base": "#123D2B",
  "--nex-world-surface": "#FFFFFF",
  "--nex-world-surface-sunken": "#F2EDDE",
  "--nex-world-text-primary": "#102013",
  "--nex-world-text-secondary": "#3F5742",
  "--nex-world-text-muted": "#7A8C7E",
  "--nex-world-border": "rgba(2, 173, 4, 0.14)",
  "--nex-world-border-accent": "rgba(2, 173, 4, 0.4)",
  "--nex-world-success": "#02AD04",
  "--nex-world-warning": "#F5A623",
  "--nex-world-danger": "#9B1C1C",
  "--nex-world-drawer-bg": "#123D2B",
  "--nex-world-primary-ink": "#AFC5B5",
} as React.CSSProperties;

/** Mock contact rows. Deliberately mixed · online / away / offline /
 *  presence-unknown · verified / shop / with city / minimal · so each
 *  prototype shows the full range of row states against Ireland chrome.
 *
 *  Owner directive 2026-11-03 · "location must show on the card · for
 *  Ireland the county · for other users the country". The `city` field
 *  carries whichever string is appropriate for the viewer's deployment
 *  context: Ireland users see their contact's COUNTY (Dublin, Cork,
 *  Galway, Kerry, Limerick); non-Irish contacts show the COUNTRY name
 *  ("Germany" below). Honest absence remains supported (Aoife has
 *  null city → cards omit the location row rather than fabricate). */
export const PROTOTYPE_MOCK_ROWS: readonly ContactRowDisplay[] = [
  {
    id: "proto-01",
    kind: "friend",
    displayName: "Daniel Carter",
    handle: "nex-00042",
    avatarUrl: "https://i.pravatar.cc/128?img=11",
    chatHref: "#",
    profileHref: null,
    professionLine: "Electrician · Residential rewires",
    presence: "online",
    lastSeenMinsAgo: null,
    hasShop: true,
    isVerified: true,
    unreadCount: 2,
    city: "Dublin",
    initials: "DC",
  },
  {
    id: "proto-02",
    kind: "friend",
    displayName: "Síle O'Brien",
    handle: "nex-00084",
    avatarUrl: "https://i.pravatar.cc/128?img=47",
    chatHref: "#",
    profileHref: null,
    professionLine: "Carpenter · Bespoke staircases",
    presence: "away",
    lastSeenMinsAgo: 23,
    hasShop: false,
    isVerified: false,
    unreadCount: 0,
    city: "Cork",
    initials: null,
  },
  {
    id: "proto-03",
    kind: "friend",
    displayName: "Rónán Fitzgerald",
    handle: "nex-00117",
    avatarUrl: "https://i.pravatar.cc/128?img=33",
    chatHref: "#",
    profileHref: null,
    professionLine: "Plumber",
    presence: "offline",
    lastSeenMinsAgo: 180,
    hasShop: true,
    isVerified: false,
    unreadCount: 0,
    city: "Galway",
    initials: null,
  },
  {
    id: "proto-04",
    kind: "friend",
    displayName: "Aoife Byrne",
    handle: "nex-00163",
    // Intentionally null · demonstrates the initials-fallback and honest-
    // absence pattern. All other rows carry pravatar.cc placeholders.
    avatarUrl: null,
    chatHref: "#",
    profileHref: null,
    professionLine: null,
    presence: null,
    lastSeenMinsAgo: null,
    hasShop: false,
    isVerified: false,
    unreadCount: 0,
    city: null,
    initials: null,
  },
  {
    id: "proto-05",
    kind: "friend",
    displayName: "Cillian Walsh",
    handle: "nex-00201",
    avatarUrl: "https://i.pravatar.cc/128?img=59",
    chatHref: "#",
    profileHref: null,
    professionLine: "Painter · Heritage restoration",
    presence: "online",
    lastSeenMinsAgo: null,
    hasShop: true,
    isVerified: true,
    unreadCount: 0,
    city: "Limerick",
    initials: null,
  },
  {
    id: "proto-06",
    kind: "friend",
    displayName: "Hans Müller",
    handle: "nex-00247",
    avatarUrl: "https://i.pravatar.cc/128?img=68",
    chatHref: "#",
    profileHref: null,
    professionLine: "Software engineer · AI tooling",
    presence: "away",
    lastSeenMinsAgo: 45,
    hasShop: false,
    isVerified: true,
    unreadCount: 1,
    // Owner directive 2026-11-03 · non-Irish contact shows COUNTRY
    // name ("Germany") rather than a county · the deployment-identity
    // resolver decides which string the location field carries per
    // viewer context; this prototype carries the resolved value directly.
    city: "Germany",
    initials: null,
  },
];

/** Sticky footer nav visible on every prototype so the owner can
 *  compare the three layouts without typing URLs. */
export function PrototypeNav({ current }: { readonly current: "a" | "b" | "c" }) {
  const items: Array<{ id: "a" | "b" | "c"; label: string; href: string }> = [
    { id: "a", label: "A · Hero-first", href: "/nex-native/contacts/prototype-a" },
    { id: "b", label: "B · Compact", href: "/nex-native/contacts/prototype-b" },
    { id: "c", label: "C · Card-grid", href: "/nex-native/contacts/prototype-c" },
  ];
  return (
    <nav
      aria-label="Prototype navigation"
      style={{
        position: "sticky",
        bottom: 0,
        display: "flex",
        gap: 6,
        padding: "10px 10px calc(env(safe-area-inset-bottom, 0) + 10px)",
        background: "var(--nex-world-surface, #FFFFFF)",
        borderTop: "1px solid var(--nex-world-secondary, #C6A15B)",
        boxShadow: "0 -4px 12px rgba(0,0,0,0.08)",
        zIndex: 20,
      }}
    >
      {items.map((item) => {
        const active = current === item.id;
        return (
          <a
            key={item.id}
            href={item.href}
            style={{
              flex: 1,
              padding: "10px 6px",
              textAlign: "center",
              fontSize: 11,
              fontWeight: active ? 800 : 600,
              letterSpacing: "0.02em",
              background: active
                ? "var(--nex-world-primary, #1B5138)"
                : "var(--nex-world-surface, #FFFFFF)",
              color: active
                ? "var(--nex-world-primary-ink, #AFC5B5)"
                : "var(--nex-world-text-primary, #102013)",
              border: `1px solid var(--nex-world-secondary, #C6A15B)`,
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

/** Common pill style used by prototypes · active = Forest · inactive = Surface. */
export function prototypePillStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    background: active
      ? "var(--nex-world-primary, #1B5138)"
      : "var(--nex-world-surface, #FFFFFF)",
    color: active
      ? "var(--nex-world-primary-ink, #AFC5B5)"
      : "var(--nex-world-text-primary, #102013)",
    border: `1px solid var(--nex-world-secondary, #C6A15B)`,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: active ? 800 : 600,
    whiteSpace: "nowrap",
    cursor: "pointer",
    flexShrink: 0,
  };
}
