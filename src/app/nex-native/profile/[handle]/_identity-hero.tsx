// src/app/nex-native/profile/[handle]/_identity-hero.tsx
//
// NEX canonical profile · identity hero · sealed 2026-10-17.
// -------------------------------------------------------------------
// Owner-sealed Emma Wilson reference. Visual order:
//   · Circular avatar · 120px · cyan ring · OPTIONAL blue verified
//     checkmark badge overlay (bottom-right) when `isVerified=true`
//   · Display name · bold · OPTIONAL blue checkmark glyph to the
//     right when verified
//   · NEX ID · prominent · uppercase prefix via display transform ·
//     chat-bubble icon prefix per the owner-sealed reference
//   · Profession · headline (middle-dot joiner · briefcase prefix)
//   · Location (pin prefix)
//   · Bio paragraph
//
// Verification source: `account-verification.isAccountVerified` ·
// resolver returns true ONLY when the account owns at least one
// nex_business with Safe Trade status === "VERIFIED". Never
// fabricated · owner-sealed Option 1 2026-10-17.
//
// Owner mode: when the viewer IS the profile owner, the hero renders
// a tap-to-edit affordance (pencil) in the identity block that lands
// on /profile/me?mode=edit. For full inline tap-to-edit the owner
// panel at `_owner-edit-panel.tsx` composes the edit widgets.
//
// Avatar overlap: when the parent mounts a <CoverPhoto /> above us,
// the hero container uses a negative margin-top to overlap the
// circular avatar onto the cover's lower edge (per the Emma Wilson
// reference). The negative margin is applied unconditionally · when
// no cover is above, the overlap still looks clean against the solid
// navy page background.
//
// Server Component · pure presentation.

import type * as React from "react";
import Link from "next/link";
import { AvatarCameraPicker } from "./_avatar-camera-picker";
// Owner-authorised 2026-10-20 · Phase 1 Verified-Directory wedge ·
// the TrustShield renders inline next to the display name when the
// profile has an attached business with high / medium / low Trust
// Score. Unknown-tier returns null (shield hidden) per owner directive.
import { TrustShield } from "@/lib/nex-native/trust/trust-shield";
import type { TrustTier } from "@/lib/nex-native/trust/trust-score-shared";
// Owner-authorised 2026-10-31 · NEX Creator Programme · Stage 1.
// Yellow Creator chips reuse the sealed NEX yellow pill visual
// (same colour / size / treatment as the DevViewerBadge). The chip
// primitive is independent · DevViewerBadge is NOT modified.
// Stage 2.1 · tapping a Creator chip opens CreatorSupportSheet.
import type { SectionProgress } from "@/lib/nex-native/creator/creator-badges-common";
import type { CreatorSupportSettings } from "@/lib/nex-native/creator/creator-support-service";
import { CreatorBadgeStrip } from "@/components/nex-native/creator/CreatorBadgeStrip";
// Phase V · P18 · 2026-11-05 · Social-to-Shop Discovery · clickable
// Shop button on the profile hero avatar when the profile owner has
// a published shop. Bottom-LEFT anchor so it never collides with the
// sealed verified-check / camera-upload overlay in the bottom-right
// corner.
import { AvatarShopBadge } from "@/components/nex-native/shop/AvatarShopBadge";
// Owner-authorised 2026-10-31 · NEX World Engine · Stage 5 wiring.
import { NEX_W } from "@/lib/nex-worlds/world-palette-css";

const NEX = {
  bg: NEX_W.backgroundBase,
  cyan: NEX_W.primary,
  cyanSoft: NEX_W.borderAccent,
  cyanFaint: NEX_W.border,
  // verifiedBlue is a FIXED semantic colour (not world-tinted · the
  // blue checkmark is a brand-sealed Safe-Trade signal).
  verifiedBlue: "#1DA1F2",
  text: NEX_W.textPrimary,
  textDim: NEX_W.textSecondary,
  textMuted: NEX_W.textMuted,
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface IdentityHeroProps {
  readonly displayName: string;
  readonly nexHandle: string | null;
  readonly avatarUrl: string | null;
  readonly profession: string | null;
  readonly headline: string | null;
  readonly locationLabel: string | null;
  readonly bio: string | null;
  readonly isOwner: boolean;
  /** True when the account owns ≥1 Safe-Trade-VERIFIED business ·
   *  resolved via `account-verification.isAccountVerified` server-side.
   *  Never computed client-side · never fabricated. */
  readonly isVerified: boolean;
  /** Owner-authorised 2026-10-20 · Phase 1 Verified-Directory wedge ·
   *  Trust tier for the attached business. "unknown" (default) hides
   *  the shield entirely. "high"/"medium"/"low" renders a shield to
   *  the right of the display name. */
  readonly trustTier?: TrustTier;
  /** When true, the avatar carries a camera-icon overlay in its
   *  bottom-right · tapping it opens a file picker that posts to
   *  the sealed `uploadAvatarAction` server action. Set by the
   *  parent page when `mode=edit` is on AND the viewer is the owner. */
  readonly showAvatarUploadAffordance?: boolean;
  /** Owner-authorised 2026-10-31 · NEX Creator Programme · Stage 1.
   *  Earned per-section Creator badges · rendered as yellow pills
   *  beneath the avatar + location (per the owner's "under image +
   *  country" directive). Empty array = no badges · section is hidden. */
  readonly earnedCreatorBadges?: readonly SectionProgress[];
  /** Owner-authorised 2026-10-31 · Stage 2.1 · the creator's Support
   *  settings, server-resolved ONLY when settings.enabled === true
   *  (sealed privacy rule · never leak another creator's drafts).
   *  Null = support not enabled → sheet renders friendly empty state. */
  readonly supportSettings?: CreatorSupportSettings | null;
  /** Phase V · P18 · 2026-11-05 · public shop URL for the profile
   *  owner's primary business, when they have one. Null for profiles
   *  without a published shop. Drives AvatarShopBadge · bottom-LEFT
   *  anchor so it doesn't collide with the sealed verified-check /
   *  camera-upload corner at bottom-right. */
  readonly shopHref?: string | null;
  /** Phase V · P18 · 2026-11-05 · display name of the owner's shop,
   *  used for the badge aria-label. Falls back to displayName when
   *  not supplied. */
  readonly shopName?: string | null;
}

export function IdentityHero(props: IdentityHeroProps): React.JSX.Element {
  // nexId display moved from "under name" to the top chrome bar
  // (ProfileChrome). The viewer's own NEX ID appears in the top-left
  // of every profile page. This profile's own NEX ID still appears
  // elsewhere in the app (ControlDrawer, Contacts row) · it is
  // deliberately NOT duplicated here.
  const initials = initialsFromName(props.displayName);
  const professionLine = buildProfessionLine(props.profession, props.headline);
  return (
    <header
      data-nex-profile-hero
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "0 14px 8px",
        // Owner directive 2026-10-17 (revised again) · "move up more
        // 0px" · interpreted as 0px hanging below · the full avatar
        // sits ON the cover · −128px (full 128px avatar diameter)
        // pulls it entirely inside the hero. If you meant something
        // different (e.g. move up by an additional 10/20px), tell me
        // the exact value and I'll adjust.
        marginTop: -128,
        textAlign: "center",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 128,
          height: 128,
        }}
      >
        {props.avatarUrl ? (
          <img
            src={props.avatarUrl}
            alt=""
            aria-hidden
            data-nex-profile-avatar
            style={{
              width: 128,
              height: 128,
              borderRadius: "50%",
              objectFit: "cover",
              border: `4px solid ${NEX.cyan}`,
              background: NEX.cyanFaint,
              boxShadow: `0 6px 24px -8px rgba(0,0,0,0.8)`,
            }}
          />
        ) : (
          <div
            aria-hidden
            data-nex-profile-avatar-initials
            style={{
              width: 128,
              height: 128,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              border: `4px solid ${NEX.cyan}`,
              background: NEX.cyanFaint,
              color: NEX.cyan,
              fontSize: 38,
              fontWeight: 800,
              letterSpacing: "0.04em",
              fontFamily: SANS,
              boxShadow: `0 6px 24px -8px rgba(0,0,0,0.8)`,
            }}
          >
            {initials}
          </div>
        )}
        {props.isVerified ? (
          <div
            aria-label="Verified NEX seller"
            data-nex-profile-avatar-verified
            style={{
              position: "absolute",
              right: 6,
              bottom: 6,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: NEX.verifiedBlue,
              display: "grid",
              placeItems: "center",
              border: `3px solid ${NEX.bg}`,
            }}
          >
            <CheckIcon color="#FFFFFF" size={14} />
          </div>
        ) : null}
        {/* Owner directive 2026-10-17 · camera-icon overlay on the
            avatar when edit mode is active · tap opens a native file
            picker that submits to the sealed `uploadAvatarAction` ·
            same upload path as the sealed face-camera-uploader so
            there's one storage pipeline. The overlay replaces the
            verified checkmark's corner when both are present (edit
            mode is a transient state · verification stays visible
            everywhere else). */}
        {props.showAvatarUploadAffordance ? (
          <AvatarCameraPicker />
        ) : null}
        {/* Phase V · P18 · 2026-11-05 · AvatarShopBadge · only when
            the profile owner has a published shop. Anchored bottom-LEFT
            to preserve the sealed verified-check + camera-upload
            bottom-right corner. */}
        {props.shopHref ? (
          <AvatarShopBadge
            shopHref={props.shopHref}
            sellerName={props.shopName ?? props.displayName}
            avatarPx={128}
            position="bottom-left"
          />
        ) : null}
      </div>

      <h1
        data-nex-profile-name
        style={{
          margin: "10px 0 0",
          fontSize: 22,
          fontWeight: 700,
          color: NEX.text,
          fontFamily: SANS,
          lineHeight: 1.15,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {props.displayName}
        {props.isVerified ? (
          <span
            aria-hidden
            data-nex-profile-name-verified
            style={{
              display: "inline-grid",
              placeItems: "center",
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: NEX.verifiedBlue,
            }}
          >
            <CheckIcon color="#FFFFFF" size={11} />
          </span>
        ) : null}
        {props.trustTier && props.trustTier !== "unknown" ? (
          <TrustShield
            tier={props.trustTier}
            size="sm"
            showLabel={false}
            titlePrefix={props.displayName}
          />
        ) : null}
      </h1>

      {/* Owner directive 2026-11-02 · the profile owner's Nex-ID
          returns as a dedicated row directly under the display name.
          The chrome-badge version was retired (commit 101ba72) and
          every other page-header handle rendering is retired too
          (commit c12cc18) · the profile hero is now the single
          authoritative identity surface where the Nex-ID appears.
          Supersedes the earlier 2026-10-17 retirement note. */}
      {props.nexHandle ? (
        <div
          data-nex-profile-nex-id
          style={{
            marginTop: 2,
            fontSize: 14,
            fontWeight: 700,
            color: NEX.textMuted,
            fontFamily: SANS,
            letterSpacing: "0.03em",
          }}
        >
          {props.nexHandle}
        </div>
      ) : null}

      {/* Location moved up to sit directly under the name per owner
          directive 2026-10-17 · uses a map icon (not pin) · auto-
          updates from `nex_account_profile.location_label` whenever
          the owner sets or changes their city/country in Settings.
          Owner mode shows an "+ Add your location" prompt when the
          field is NULL so the field is self-discoverable. */}
      {/* Owner directive 2026-11-02 · map pin icon is RED and the
       *  location line shows the county (e.g. "Dublin") pulled from
       *  nex_account_profile.location_label. Replaces the earlier
       *  cyan map pin · the bio paragraph has been retired in favour
       *  of a dedicated description section placed under the
       *  follower-stats row (follow-up commit). */}
      {props.locationLabel ? (
        <div
          data-nex-profile-location
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: NEX.text,
            fontFamily: SANS,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <MapIcon color="#E31C25" />
          <span>{props.locationLabel}</span>
        </div>
      ) : props.isOwner ? (
        <Link
          href={`/nex-native/profile/${(props.nexHandle ?? "").toLowerCase()}?mode=edit&focus=location`}
          data-nex-profile-location-empty-cta
          style={{
            fontSize: 12,
            color: NEX.textMuted,
            fontFamily: SANS,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            textDecoration: "none",
            padding: "4px 10px",
            borderRadius: 999,
            border: `1px dashed ${NEX.cyanSoft}`,
          }}
        >
          <MapIcon color="#E31C25" /> + Add your location
        </Link>
      ) : null}

      {/* Owner-authorised 2026-10-31 · Creator badges · yellow NEX
          chips rendered beneath avatar + location. Stage 2.1 · each
          chip is tappable and opens the universal CreatorSupportSheet.
          Server passes `supportSettings` only when the creator has
          enabled Support (sealed privacy · never leak drafts). */}
      {props.earnedCreatorBadges && props.earnedCreatorBadges.length > 0 ? (
        <CreatorBadgeStrip
          earnedBadges={props.earnedCreatorBadges}
          creatorName={props.displayName}
          creatorAvatarUrl={props.avatarUrl}
          creatorNexHandle={props.nexHandle}
          supportSettings={props.supportSettings ?? null}
        />
      ) : null}

      {professionLine ? (
        <div
          data-nex-profile-profession
          style={{
            fontSize: 13,
            color: NEX.textDim,
            fontFamily: SANS,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <BriefcaseIcon color={NEX.textMuted} />
          <span>{professionLine}</span>
        </div>
      ) : null}

      {/* Owner directive 2026-11-02 · bio paragraph in the hero
       *  retired. A dedicated short description area is coming to
       *  sit under the follower-stats row (follow-up commit) · the
       *  hero stays focused on identity + location + profession.
       *  props.bio stays in the data model (and in the OwnerEditShell
       *  for editing) · just not rendered here any more. */}

      {/* The in-hero "Edit profile" link was retired 2026-10-17 ·
          the OwnerEditShell wraps the whole page and renders exactly
          one toggle button in the top-right of the cover (Edit → Save).
          See _owner-edit-shell.tsx. */}
    </header>
  );
}

function OwnerEmptyHint({ hint }: { readonly hint: string }): React.JSX.Element {
  return (
    <div
      data-nex-profile-owner-hint
      style={{
        marginTop: 6,
        fontSize: 11,
        color: NEX.textMuted,
        fontFamily: SANS,
      }}
    >
      {hint}
    </div>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function buildProfessionLine(profession: string | null, headline: string | null): string | null {
  const p = (profession ?? "").trim();
  const h = (headline ?? "").trim();
  if (p.length === 0 && h.length === 0) return null;
  if (p.length === 0) return h;
  if (h.length === 0) return p;
  return `${p} · ${h}`;
}

function BriefcaseIcon({ color }: { readonly color: string }): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function MapIcon({ color }: { readonly color: string }): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CheckIcon({ color, size }: { readonly color: string; readonly size: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// PencilIcon retired · the edit affordance moved to OwnerEditShell.
