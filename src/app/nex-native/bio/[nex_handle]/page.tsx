// src/app/nex-native/bio/[nex_handle]/page.tsx
//
// Unified NEX bio-link · one shareable destination that aggregates the
// owner's public profile + discoverable businesses + chat CTA.
// Sealed 2026-10-17.
//
// Design doctrine (owner-approved 2026-10-17):
//   · Route is /nex-native/bio/{nex_handle} · the sealed Phase-3A
//     /u/{nex_handle} and the sealed shop /{businessSlug} routes
//     are UNCHANGED and remain valid share destinations.
//   · Privacy chain mirrors /u/[handle]/page.tsx EXACTLY:
//       1. Handle format gate (via accountService.getAccountByNexHandle)
//       2. Phase 3A gate: is_discoverable=true OR viewer is owner
//       3. R10 Stage-5 gate: resolveProfileVisibilityForViewer()
//     All 404 branches collapse to notFound() to prevent enumeration.
//   · Business visibility respects the Bridge-55 commerce launch flag
//     (NEX_COMMERCE_ENABLED). When commerce is Phase-1-gated off, the
//     businesses section is OMITTED (not shown as disabled) because
//     the shop route /{businessSlug} is itself hidden.
//   · chosen_handle fallback: the account service uses .select("*"),
//     so PostgREST omits the column key pre-migration-204. Property
//     access returns undefined and the ?? fallback resolves to the
//     display_name. The page works against the current live schema
//     without migration 204.
//   · This page is a NEX SYSTEM surface · renders in NEX brand
//     regardless of viewer chat_theme · same convention as /u/[handle].
//
// Fields rendered (per owner approval + §4.4 of implementation plan):
//   · nex-NNNNN (always · from migration 013)
//   · Avatar (profile.avatar_url) with initials fallback
//   · Primary label (account.chosen_handle ?? account.display_name)
//   · Headline, bio, city (location_label), profession, daily_activity, kind
//     · each omitted when null
//   · Discoverable businesses (slug, display_name, logo_url, description)
//     · only when commerce is enabled
//
// Fields explicitly NEVER rendered: email, phone, supabase_user_id,
// orders, vault, contacts, inbox, skills, looking_for, private settings,
// chat history. Enforced by import-list policy (static-source test T14)
// and by only using the three sealed services below.

import type * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountService from "@/lib/nex-native/account-service";
import * as accountProfileService from "@/lib/nex-native/account-profile-service";
import * as businessService from "@/lib/nex-native/business-service";
import { resolveProfileVisibilityForViewer } from "@/lib/nex-native/privacy-preferences-service";
import { commerceEnabledForRequest } from "@/lib/nex-native/launch-flags";
import { NexPageHeader } from "../../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ─── NEX palette · system surface · never themed ──────────────── */
const NEX = {
  bg: "#020914",
  surface: "#0E1526",
  surfaceHi: "#182540",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  textSoft: "#4B6683",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.14)",
  cyanFaint: "rgba(0,175,255,0.06)",
  borderSoft: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.12)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface PageProps {
  params: Promise<{ nex_handle: string }>;
  searchParams?: Promise<{ commerce?: string }>;
}

export default async function BioLinkPage(props: PageProps): Promise<React.JSX.Element> {
  const { nex_handle: rawHandle } = await props.params;
  const sp = props.searchParams ? await props.searchParams : {};

  // Normalise handle · allow /bio/36474 as a shortcut for /bio/nex-36474
  // · same convention as /u/[handle].
  const normalised = normaliseHandle(rawHandle);
  if (!normalised) notFound();

  // Gate 1 · format + existence · getAccountByNexHandle enforces the
  // /^nex-[0-9]{5,}$/ pattern and returns null for malformed input.
  // Uses .select("*") so chosen_handle may or may not be in the row
  // depending on migration-204 status · property access returns
  // undefined when the column is absent.
  const account = await accountService.getAccountByNexHandle(normalised);
  if (!account) notFound();

  const profile = await accountProfileService
    .getProfileByAccountId(account.id)
    .catch(() => null);

  const session = await resolveNexAppSessionFromContext();
  const isSelf = Boolean(session && session.account.id === account.id);

  // Gate 2 · Phase 3A opt-in · non-owners can only see discoverable profiles.
  const isDiscoverable = profile?.is_discoverable === true;
  if (!isDiscoverable && !isSelf) {
    notFound();
  }

  // Gate 3 · R10 Stage-5 secondary visibility axis · profile_visibility
  // may be private or contacts-only even when is_discoverable=true.
  // Mirror the sealed /u/[handle] behaviour: 404 for both private and
  // contacts-non-friend. A "limited" minimal-card view is a future
  // scope · until it ships we 404 to be privacy-safe.
  if (!isSelf) {
    const visibility = await resolveProfileVisibilityForViewer(
      session?.account.id ?? null,
      account.id,
    );
    if (!visibility.visible) {
      notFound();
    }
  }

  // Business visibility · gated by Bridge-55 commerce launch flag.
  // When commerce is Phase-1-gated off, the /{businessSlug} route
  // itself redirects to /home · so omit the businesses section to
  // avoid producing dead "Open shop →" links on this public share
  // destination.
  const commerceEnabled = commerceEnabledForRequest(sp);
  const businesses = commerceEnabled
    ? await businessService.listBusinessesByOwner(account.id).catch(() => [])
    : [];

  // Resolve primary display label · prefer chosen_handle when present
  // post-migration-204 · fall back to display_name otherwise.
  // The `?? undefined` normalisation handles the pre-migration-204
  // case where the key is absent from the row object.
  const chosenHandleMaybe = (account as { chosen_handle?: string | null }).chosen_handle;
  const primaryLabel: string =
    (typeof chosenHandleMaybe === "string" && chosenHandleMaybe.length > 0
      ? chosenHandleMaybe
      : account.display_name) || account.display_name;

  // Resolve chat CTA target. Signed-in viewer gets peer-chat link
  // (resolved client-side on click to avoid eagerly creating conversations
  // on every bio-link view · bio-link is a public destination that
  // search bots and link previews will fetch). Signed-out viewer gets
  // the guest-chat entry.
  const chatHref = session
    ? `/nex-native/chat/peer/${account.id}`
    : `/nex-native/chat/guest/${account.id}`;

  // Owner-preview badge · identical convention to /u/[handle].
  const showOwnerPreviewBadge = isSelf && !isDiscoverable;

  return (
    <main
      id="main"
      data-nex-bio-root
      data-nex-bio-handle={normalised}
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        padding: "0 16px 48px",
      }}
    >
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <NexPageHeader dataScope="bio-link" />

        {showOwnerPreviewBadge && (
          <OwnerPreviewBadge handle={normalised} />
        )}

        <ProfileCard
          nexHandle={account.nex_handle ?? normalised}
          primaryLabel={primaryLabel}
          avatarUrl={profile?.avatar_url ?? null}
          headline={profile?.headline ?? null}
          bio={profile?.bio ?? null}
          city={profile?.location_label ?? null}
          profession={profile?.profession ?? null}
          dailyActivity={profile?.daily_activity ?? null}
          kind={profile?.kind ?? null}
        />

        {businesses.length > 0 && (
          <section
            data-nex-bio-section="businesses"
            style={{
              marginTop: 28,
              padding: 16,
              background: NEX.surface,
              border: `1px solid ${NEX.borderSoft}`,
              borderRadius: 14,
            }}
          >
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: NEX.textMuted,
              }}
            >
              Businesses
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {businesses.map((b) => (
                <BusinessCard
                  key={b.id}
                  slug={b.slug}
                  displayName={b.display_name}
                  logoUrl={b.logo_url}
                  description={b.description}
                />
              ))}
            </div>
          </section>
        )}

        <section
          data-nex-bio-section="actions"
          style={{
            marginTop: 20,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <Link
            href={chatHref}
            data-nex-bio-action="chat"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 48,
              padding: "12px 16px",
              borderRadius: 999,
              background: NEX.orange,
              color: "#1A1300",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.02em",
              textDecoration: "none",
            }}
          >
            {session ? "Open chat" : "Chat as a guest"}
          </Link>
          <Link
            href={`/nex-native/u/${normalised}`}
            data-nex-bio-action="full-profile"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 48,
              padding: "12px 16px",
              borderRadius: 999,
              background: "transparent",
              color: NEX.cyan,
              border: `1px solid ${NEX.cyan}`,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textDecoration: "none",
            }}
          >
            Open full profile →
          </Link>
        </section>
      </div>
    </main>
  );
}

/* ─── helpers · pure functions · exported for test use ─────────── */

/**
 * Normalise an incoming handle · lowercase · accept bare digits as a
 * shortcut (prepend 'nex-'). Returns null if the normalised form does
 * not match the sealed migration-013 format /^nex-[0-9]{5,}$/.
 * accountService.getAccountByNexHandle will also validate internally;
 * this guard produces a clean notFound() for obviously-bad input
 * without a round-trip.
 */
export function normaliseHandle(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = decodeURIComponent(raw).trim().toLowerCase();
  if (trimmed.length === 0) return null;
  const n = trimmed.startsWith("nex-") ? trimmed : `nex-${trimmed}`;
  if (!/^nex-[0-9]{5,}$/.test(n)) return null;
  return n;
}

/* ─── sub-components ──────────────────────────────────────────── */

function OwnerPreviewBadge({ handle }: { handle: string }): React.JSX.Element {
  return (
    <div
      data-nex-bio-owner-preview
      style={{
        marginTop: 12,
        padding: "10px 14px",
        background: NEX.cyanFaint,
        border: `1px solid ${NEX.cyanSoft}`,
        borderRadius: 10,
        fontSize: 12,
        color: NEX.cyan,
        lineHeight: 1.5,
      }}
    >
      Preview only · your bio link is <strong>{handle}</strong>. Non-owners
      see 404 until you turn on discoverability in Settings → Profile.
    </div>
  );
}

function ProfileCard(props: {
  nexHandle: string;
  primaryLabel: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  city: string | null;
  profession: string | null;
  dailyActivity: string | null;
  kind: string | null;
}): React.JSX.Element {
  const meta = [props.profession, props.city].filter(Boolean) as string[];
  return (
    <section
      data-nex-bio-section="profile"
      style={{
        marginTop: 20,
        padding: 20,
        background: NEX.surface,
        border: `1px solid ${NEX.borderSoft}`,
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        textAlign: "center",
      }}
    >
      <AvatarCircle
        avatarUrl={props.avatarUrl}
        initialsFrom={props.primaryLabel}
      />
      <div
        data-nex-bio-primary-label
        style={{
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1.2,
          color: NEX.text,
        }}
      >
        {props.primaryLabel}
      </div>
      <div
        data-nex-bio-handle-pill
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          color: NEX.cyan,
          padding: "4px 10px",
          borderRadius: 999,
          background: NEX.cyanFaint,
          border: `1px solid ${NEX.cyanSoft}`,
        }}
      >
        {props.nexHandle.toUpperCase()}
      </div>
      {props.headline && (
        <div
          data-nex-bio-headline
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: NEX.textDim,
            lineHeight: 1.4,
          }}
        >
          {props.headline}
        </div>
      )}
      {meta.length > 0 && (
        <div
          data-nex-bio-meta
          style={{
            fontSize: 12,
            color: NEX.textMuted,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            justifyContent: "center",
          }}
        >
          {meta.map((m, i) => (
            <span key={i}>
              {i > 0 && <span style={{ margin: "0 6px", opacity: 0.5 }}>·</span>}
              {m}
            </span>
          ))}
        </div>
      )}
      {props.bio && (
        <p
          data-nex-bio-bio
          style={{
            margin: "4px 0 0",
            fontSize: 13,
            color: NEX.textDim,
            lineHeight: 1.55,
            maxWidth: 360,
          }}
        >
          {props.bio}
        </p>
      )}
      {(props.kind || props.dailyActivity) && (
        <div
          data-nex-bio-chips
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            justifyContent: "center",
            marginTop: 4,
          }}
        >
          {props.kind && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: NEX.textMuted,
                padding: "4px 8px",
                borderRadius: 999,
                border: `1px solid ${NEX.borderStrong}`,
              }}
            >
              {props.kind.replace(/_/g, " ")}
            </span>
          )}
          {props.dailyActivity && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: NEX.textMuted,
                padding: "4px 8px",
                borderRadius: 999,
                border: `1px solid ${NEX.borderStrong}`,
              }}
            >
              {props.dailyActivity.replace(/_/g, " ")}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function AvatarCircle(props: {
  avatarUrl: string | null;
  initialsFrom: string;
}): React.JSX.Element {
  const initials = initialsFromName(props.initialsFrom);
  return (
    <div
      data-nex-bio-avatar
      style={{
        width: 96,
        height: 96,
        borderRadius: "50%",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        background: NEX.surfaceHi,
        border: `2px solid ${NEX.borderStrong}`,
        backgroundImage: props.avatarUrl ? `url(${props.avatarUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {!props.avatarUrl && (
        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: NEX.cyan,
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}

function BusinessCard(props: {
  slug: string;
  displayName: string;
  logoUrl: string | null;
  description: string | null;
}): React.JSX.Element {
  return (
    <Link
      href={`/nex-native/${props.slug}`}
      data-nex-bio-business-card
      data-nex-bio-business-slug={props.slug}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        background: NEX.surfaceHi,
        border: `1px solid ${NEX.borderSoft}`,
        borderRadius: 12,
        textDecoration: "none",
        color: NEX.text,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 10,
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          background: NEX.bg,
          border: `1px solid ${NEX.borderStrong}`,
          backgroundImage: props.logoUrl ? `url(${props.logoUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!props.logoUrl && (
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: NEX.cyan,
            }}
          >
            {initialsFromName(props.displayName)}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: NEX.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {props.displayName}
        </div>
        {props.description && (
          <div
            style={{
              fontSize: 12,
              color: NEX.textMuted,
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {props.description}
          </div>
        )}
      </div>
      <span style={{ color: NEX.cyan, fontSize: 18, flexShrink: 0 }}>→</span>
    </Link>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
