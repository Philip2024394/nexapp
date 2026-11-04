// src/app/nex-native/_page-header.tsx
//
// Shared NEX-native page header · applied to EVERY dark-navy surface.
// -------------------------------------------------------------------------
//   · Left  · NEX ping badge → /nex-native (session-aware router: signed-in
//              lands on /home, signed-out lands on /create-account).
//              Replaces the plain "NEX" wordmark 2026-10-17 · owner-
//              authorised shared-header upgrade. The pulsing-ring badge
//              is the same identity primitive used by the Welcome,
//              Sign-in, Landing, and Create-Account hero surfaces.
//   · Right · magnifying glass → /nex-native/search (NEX Discover · the
//                               shop-finder that lists NEX users with
//                               shops or menus · location-gated · opens
//                               Chat with owner on tap)
//            three dots       → shared drawer with Home, Contacts, Chat,
//                               Calls, Search, Settings, Sign out. The
//                               drawer is the single navigation surface
//                               for every destination that used to live
//                               as a header icon · owner-authorised
//                               2026-10-17 · Home + Settings icons
//                               retired from the header globally.
//
// NOTE 2026-10-17 · the SettingsHeaderSlot (3D lock + account-gate
// probe + CreateAccountPrompt modal) is NO LONGER mounted in the
// header. The sealed /nex-native/settings route still fires the
// gate server-side for signed-in-no-account visitors who follow the
// drawer link · the gate still works, just via one path instead
// of two. The SettingsHeaderSlot component itself is preserved at
// src/components/nex-native/account-gate/SettingsHeaderSlot.tsx
// for any future surface that needs the inline lock affordance.
//
// Server Component · no hooks · uses inline styles keyed to the NEX
// dark-navy palette. Signed-out pages that render the header link the
// icons at auth-gated destinations · following them just bounces the
// visitor to /sign-in, which is the correct behaviour.

import Link from "next/link";
// Account-gate · the Settings-slot client component is self-contained
// and fetches the gate state via a lightweight route handler so this
// header stays SYNC and importable by both Server and Client
// components (`calls/_calls-client.tsx` still imports it today).
//
// `SettingsHeaderSlot` is no longer mounted here (owner directive
// 2026-10-17 · settings icon removed from the shared header) · the
// component lives at `src/components/nex-native/account-gate/
// SettingsHeaderSlot.tsx` for any future surface that needs it.
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import { PageHeaderDrawerButtonClient } from "./_page-header-drawer-button-client";

const NEX = {
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
};

interface NexPageHeaderProps {
  /** Optional data-attr for tests / analytics. */
  dataScope?: string;
  /** Owner directive 2026-11-03 · scope-specific brand image inside
   *  the ping badge (e.g. Community badge on /community/* surfaces).
   *  Falls back to the sealed "NEX" wordmark when null/undefined. */
  brandAvatarUrl?: string | null;
  /** Owner directive 2026-11-03 · scope-specific accent colour for
   *  the ping ring + halo. Defaults to NEX cyan. Community surfaces
   *  pass green so the ping always reads as presence-online. */
  brandAccent?: string;
  /** Owner directive 2026-11-04 · replaces the left ping-badge slot
   *  entirely with custom content. Used on the create-profile page
   *  to show the user's NEX ID in place of the cyan brand badge.
   *  All other callers leave this unset and keep the sealed badge. */
  brandSlot?: React.ReactNode;
  /** Owner directive 2026-11-04 · hide the magnifying-glass search
   *  icon on surfaces that provide their own in-page navigation
   *  grid (e.g. create-profile). Default false → icon stays. */
  hideSearch?: boolean;
}

export function NexPageHeader({
  dataScope,
  brandAvatarUrl,
  brandAccent,
  brandSlot,
  hideSearch,
}: NexPageHeaderProps) {
  return (
    <header
      data-nex-page-header
      data-nex-page-header-scope={dataScope}
      style={{
        paddingTop: "max(env(safe-area-inset-top, 0px), 8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      {brandSlot ?? (
        <Link
          href="/nex-native"
          aria-label="NEX home"
          data-nex-page-header-brand
          style={{
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            lineHeight: 0,
            borderRadius: "50%",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <NexPingBadge
            size={56}
            accent={brandAccent ?? NEX.cyan}
            avatarUrl={brandAvatarUrl ?? null}
            dataTestId="page-header-nex"
          />
        </Link>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Owner-authorised 2026-10-17 · Home + Settings icons
            removed from the shared header globally. Home is reachable
            via the three-dots drawer. Settings is reachable via the
            drawer AND the sealed /nex-native/settings route still
            fires its own account-gate prompt for signed-in-no-account
            users (the CreateAccountPrompt + 3D-lock behaviour is
            inside SettingsHeaderSlot which lives at
            src/components/nex-native/account-gate/SettingsHeaderSlot.tsx
            · still mountable from other surfaces if needed). */}
        {hideSearch ? null : (
          <Link
            href="/nex-native/directory/landing"
            aria-label="NEX Directory · shops · services · food · trades"
            data-nex-page-header-search
            style={iconLinkStyle}
          >
            <SearchIcon />
          </Link>
        )}
        <PageHeaderDrawerButtonClient />
      </div>
    </header>
  );
}

const iconLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 40,
  height: 40,
  borderRadius: "50%",
  border: `1px solid ${NEX.cyanSoft}`,
  background: "transparent",
  color: NEX.cyan,
  textDecoration: "none",
};

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

