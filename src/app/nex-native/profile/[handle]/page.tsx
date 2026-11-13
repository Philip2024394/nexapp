// src/app/nex-native/profile/[handle]/page.tsx
//
// NEX canonical user-profile page · sealed 2026-10-17 · gap-close pass.
// -------------------------------------------------------------------
// Full-match to the owner-supplied Emma Wilson reference. Layout:
//
//   1. CoverPhoto                 (full-bleed hero backdrop)
//   2. IdentityHero               (avatar overlap · name · verified ·
//                                  NEX ID · profession · location · bio)
//   3. InterestsPills             (Shared Interests · from mig 205)
//   4. MutualFriends              (viewer × owner intersection)
//   5. ActionButtons              (Connect + Message · viewer mode only)
//   6. SafeTradeCard              (bottom card · opens 4-state sheet)
//
// Owner mode: ActionButtons returns null · owner interacts via the
// "Edit profile" link in the identity block (lands on
// /profile/[handle]?mode=edit · tap-to-edit inline sections ships in
// a follow-up commit · the sealed /settings/profile edit widgets stay
// importable for that).
//
// Privacy chain preserved (sealed · do not weaken):
//   · Handle-format gate (regex)
//   · Phase 3A is_discoverable gate (migration 134)
//   · R10 Stage 5 profile_visibility gate (migration 200 · unapplied ·
//     fail-closed via resolveProfileVisibilityForViewer)
//   · 404 for forbidden profiles · never 403 (enumeration guard)
//
// Data honesty preserved (sealed · do not fabricate):
//   · cover_image_url NULL  → gradient fallback (never a stock photo)
//   · interests []          → section OMITTED (viewer) · "+ Add" (owner)
//   · profession NULL       → line OMITTED
//   · location NULL         → line OMITTED
//   · bio NULL              → OMITTED (viewer) · "Tap Edit..." hint (owner)
//   · mutual count === 0    → ENTIRE section OMITTED
//   · verified              → only when ≥1 owned business is Safe Trade
//                             VERIFIED · never fabricated
//   · Safe Trade sheet      → sealed resolveSafeTradeStatus · honest-null
//                             counts (no fabricated dispute totals)
//
// Server Component · all resolution + privacy gates run server-side ·
// client-only pieces (SafeTradeSheet, ConnectButton form) hydrate inside.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountServiceForSeo from "@/lib/nex-native/account-service";
import * as accountProfileServiceForSeo from "@/lib/nex-native/account-profile-service";
import {
  buildBreadcrumbList,
  buildPerson,
  renderJsonLd,
} from "@/lib/nex-native/seo/json-ld";
import { nexCanonicalUrl } from "@/lib/nex-native/seo/site-url-resolver";
import { ProfileJsonLdScripts } from "./_profile-json-ld";
// 2026-10-28 · dev-impersonation parity · without this Hendra
// signed in via NEX_DEV_IMPERSONATE_HANDLE renders as a non-owner
// viewer of his own profile · zero prod risk per sealed module.
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as accountService from "@/lib/nex-native/account-service";
import * as accountProfileService from "@/lib/nex-native/account-profile-service";
import { effectiveTier } from "@/lib/nex-native/account-service";
import * as businessService from "@/lib/nex-native/business-service";
import * as friendService from "@/lib/nex-native/friend-service";
import * as reportService from "@/lib/nex-native/report-service";
import { resolveProfileVisibilityForViewer } from "@/lib/nex-native/privacy-preferences-service";
import { resolveSafeTradeStatus, type SafeTradeSnapshot } from "@/lib/nex-native/safe-trade-status";
import { resolveTrustScoreByCanonicalId } from "@/lib/nex-native/trust/trust-score-service";
import { isAccountVerified } from "@/lib/nex-native/account-verification";
import { NEX_COMMERCE_ENABLED } from "@/lib/nex-native/launch-flags";
import type { ControlDrawerSession } from "@/components/nex-native/control-drawer/control-drawer-client";
import { sendFriendInviteAction } from "../../_actions";
import { ProfileChrome } from "./_profile-chrome";
import { NexPageHeader } from "../../_page-header";
import { CoverPhoto } from "./_cover-photo";
import { IdentityHero } from "./_identity-hero";
import { InterestsPills } from "./_interests-pills";
import { MutualFriends, type MutualPreviewAccount } from "./_mutual-friends";
import { ActionButtons, type ConnectState } from "./_action-buttons";
import { FollowButtonWithShamrock } from "@/components/nex-native/country-flare/FollowButtonWithShamrock";
import { isAccountIrishAction } from "@/lib/nex-native/country/country-actions";
import { FollowersCountChip } from "@/components/nex-native/follow/FollowersCountChip";
import { SocialBrandIcon } from "@/components/nex-native/social/brand-icon";
import { readFollowCounts, getFollowState } from "@/lib/nex-native/follow/follow-repository";
// SafeTradeCard import retired 2026-10-17 · the hero icon owns
// the sole entry to the Safe Trade sheet · bottom card removed.
import { OwnerEditShell } from "./_owner-edit-shell";
import { SafeTradeHeroIcon } from "./_safe-trade-hero-icon";
import { AccountMusicPreloader } from "@/components/nex-native/music/_account-music-preloader";
import { CreatorWelcomePanel } from "@/components/nex-native/creator/CreatorWelcomePanel";
// getCreatorSupportSettings import removed 2026-11-10 (Creator Support deleted).
import { savePersonalProfileAction, submitSafeTradeReportAction } from "./_actions";
import type {
  TrustAccountTier,
  TrustMarketReach,
  TrustVerificationStatus,
} from "./_trust-record-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner directive 2026-11-11 (SEO B2) · profile metadata respects the
// sealed privacy chain (handle format · is_discoverable gate). When the
// account has not opted in to public discovery, we emit a generic title
// with no name/handle/bio and NO JSON-LD · matching the audit ceiling
// that profile visibility is privacy-gated.
export async function generateMetadata(props: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle: rawHandle } = await props.params;
  const handle = (rawHandle || "").toLowerCase().trim();
  if (!/^[a-z0-9_.-]{2,32}$/.test(handle)) {
    return { title: "Profile · NEX" };
  }
  const account = await accountServiceForSeo
    .getAccountByNexHandle(handle)
    .catch(() => null);
  if (!account) return { title: "Profile · NEX" };
  const profile = await accountProfileServiceForSeo
    .getProfileByAccountId(account.id)
    .catch(() => null);
  if (!profile || profile.is_discoverable !== true) {
    return { title: "Profile · NEX" };
  }
  const canonical = nexCanonicalUrl(`/nex-native/profile/${handle}`);
  const displayName = account.display_name?.trim() || `@${handle}`;
  const bio = profile.bio?.trim();
  const description =
    bio && bio.length > 0 ? bio : `${displayName} on NEX.`;
  return {
    title: `${displayName} · NEX`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "profile",
      title: `${displayName} · NEX`,
      description,
      url: canonical,
      siteName: "NEX",
    },
    twitter: {
      card: "summary_large_image",
      title: `${displayName} · NEX`,
      description,
    },
  };
}

interface PageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{
    mode?: string;
    demo?: string;
    error?: string;
    /** Owner directive 2026-10-17 Phase 2.0 · the submit action
     *  sets ?report=sent ONLY after the sealed createReport returned
     *  normally. Reaching this URL is honest proof of persistence ·
     *  no success is shown on the error path. */
    report?: string;
    /** Owner directive 2026-10-18 · when the viewer arrives from a
     *  chat theme preview, the chat header's avatar tap threads the
     *  theme's primary colour here (URL-encoded hex) so the profile
     *  opens tinted in the SAME colour as the chat they came from.
     *  Sanitised with a strict #RRGGBB regex before use · bad values
     *  silently drop. */
    themeAccent?: string;
  }>;
}

/** Parse + sanitise the ?themeAccent query · returns null for any
 *  value that isn't a plain `#RRGGBB` hex. Prevents style-injection
 *  via the URL. Owner directive 2026-10-18. */
function parseThemeAccent(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return null;
  return trimmed;
}

const HANDLE_REGEX = /^nex-[0-9]{5,}$/i;

/**
 * Dev-only demo override · owner-authorised 2026-10-17.
 * Visiting /nex-native/profile/[any-handle]?demo=emma when
 * NODE_ENV !== "production" renders a fake profile that matches the
 * owner-supplied Emma Wilson reference pixel-for-pixel (data-wise).
 * Zero production risk · the gate rejects the demo flag entirely in
 * production builds and silently falls through to the real
 * resolution path.
 */
/**
 * Dev-only mock override for Philip O'Farrell's own account
 * (handle: nex-10842). Owner-authorised 2026-10-17 · "WE can add
 * mock for my account its the philip o farrell". When NODE_ENV !==
 * "production" AND the viewer is viewing their own profile AND
 * the profile account's handle matches the gated handle below AND
 * the owner has NOT yet filled in profession/location/bio, the
 * page substitutes mock values so the canonical layout is visible
 * end-to-end against the owner-supplied Emma Wilson reference.
 *
 * The mock NEVER writes to the DB · it only overrides what the
 * page renders. Any real data the owner has stored takes
 * precedence (if `profile.profession` is non-null, we use that
 * instead of the mock). Production is unaffected · the gate
 * rejects on NODE_ENV.
 *
 * To disable: set the handle to an empty string OR deploy to prod.
 */
const PHILIP_MOCK_HANDLE = "nex-10842";
const PHILIP_MOCK = {
  avatarUrl:
    "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=400&h=400&fit=crop&crop=faces",
  coverImageUrl:
    "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&h=400&fit=crop",
  profession: "NEX Founder",
  headline: "Product · Design",
  locationLabel: "Yogyakarta, Indonesia",
  bio: "Building NEX · trust-first social commerce for Indonesia and beyond.",
  interests: ["Travel", "Photography", "Food", "Business", "Design", "Music"] as const,
  // Owner directive 2026-10-17 · "see mock mutual friends and the
  // buttons in footer" · mock mutuals + mock Connect/Message preview
  // on Philip's own view · dev-only · never applied in prod.
  mutualCount: 12,
  mutualPreview: [
    {
      id: "demo-mutual-1",
      displayName: "Alex Chen",
      avatarUrl:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces",
    },
    {
      id: "demo-mutual-2",
      displayName: "Sarah Kim",
      avatarUrl:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces",
    },
    {
      id: "demo-mutual-3",
      displayName: "Mike Ross",
      avatarUrl:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=faces",
    },
    {
      id: "demo-mutual-4",
      displayName: "Priya Patel",
      avatarUrl:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=faces",
    },
  ],
};

const EMMA_DEMO = {
  displayName: "Emma Wilson",
  nexHandle: "nex-005345",
  avatarUrl:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=faces",
  coverImageUrl:
    "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&h=400&fit=crop",
  profession: "Marketing Professional",
  headline: null as string | null,
  locationLabel: "London, UK",
  bio: "Love travel, good food, photography and meeting new people.",
  interests: ["Travel", "Photography", "Food", "Fitness", "Music", "Business"] as const,
  isVerified: true,
  mutualCount: 12,
  // Owner directive 2026-10-17 · reference shows 4 preview avatars
  // + "+8" overflow (12 total) · with REAL portrait images (not
  // initials) · using free Unsplash portrait URLs for the demo so
  // the layout matches the shared reference pixel-for-pixel.
  mutualPreview: [
    {
      id: "demo-mutual-1",
      displayName: "Alex Chen",
      avatarUrl:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces",
    },
    {
      id: "demo-mutual-2",
      displayName: "Sarah Kim",
      avatarUrl:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces",
    },
    {
      id: "demo-mutual-3",
      displayName: "Mike Ross",
      avatarUrl:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=faces",
    },
    {
      id: "demo-mutual-4",
      displayName: "Priya Patel",
      avatarUrl:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=faces",
    },
  ],
} as const;

export default async function CanonicalProfilePage({ params, searchParams }: PageProps) {
  const { handle: rawHandle } = await params;
  const sp = await searchParams;
  const handle = (rawHandle ?? "").trim().toLowerCase();

  // Dev-only demo override · gated by NODE_ENV + explicit ?demo=emma
  // query param. Renders the owner-supplied Emma Wilson reference
  // against the real components so the layout can be visually
  // verified end-to-end. Production builds silently drop the flag.
  const demoMode =
    process.env.NODE_ENV !== "production" && sp.demo === "emma";
  if (demoMode) {
    return <DemoEmmaRender />;
  }

  if (!HANDLE_REGEX.test(handle)) notFound();

  // Owner directive 2026-11-11 (Cycle 23 · P3 parallelization) ·
  // handle lookup + session resolve are independent · run concurrently.
  const [profileAccount, session] = await Promise.all([
    accountService.getAccountByNexHandle(handle),
    resolveSessionWithDevOverride().catch(() => null),
  ]);
  if (!profileAccount) notFound();

  const viewerAccountId = session?.account.id ?? null;
  const isOwner = viewerAccountId === profileAccount.id;

  // Owner directive 2026-11-11 (Cycle 23 · P3 parallelization) ·
  // Phase 3A gate (sealed · do not weaken) + R10 Stage 5 visibility
  // gate both only need profileAccount.id · run concurrently. Previously
  // these were two sequential awaits.
  //
  // 2026-11-01 fix retained: `is_discoverable` lives on
  // `nex_account_profile`, not `nex_account`. The profileRow fetch here
  // doubles as the hydration read used by downstream rendering · we
  // pass it through `profilePromise` below (was redundantly re-fetched).
  const [profileRow, visibility] = await Promise.all([
    accountProfileService
      .getProfileByAccountId(profileAccount.id)
      .catch(() => null),
    resolveProfileVisibilityForViewer(viewerAccountId, profileAccount.id),
  ]);
  const isDiscoverable = Boolean(profileRow?.is_discoverable);
  if (!isOwner && !isDiscoverable) notFound();
  if (!visibility.visible && !isOwner) notFound();

  // Non-owner trying to view edit mode · drop the flag silently.
  if (sp.mode === "edit" && !isOwner) {
    redirect(`/nex-native/profile/${handle}`);
  }

  // Owner directive 2026-11-11 (Cycle 23 · P3 dedup) · reuse the
  // profileRow we already fetched for the is_discoverable gate rather
  // than firing a second getProfileByAccountId. One fewer DB round-trip.
  const profilePromise = Promise.resolve(profileRow);
  const businessesPromise = NEX_COMMERCE_ENABLED
    ? businessService.listBusinessesByOwner(profileAccount.id).catch(() => [])
    : Promise.resolve([]);
  const verifiedPromise = isAccountVerified(profileAccount.id);
  const connectStatePromise = resolveConnectState(viewerAccountId, profileAccount.id);
  const mutualFriendsPromise =
    viewerAccountId && !isOwner
      ? friendService
          .countMutualFriends(viewerAccountId, profileAccount.id, 4)
          .catch(() => ({ count: 0, previewIds: [] as string[] }))
      : Promise.resolve({ count: 0, previewIds: [] as string[] });

  // Owner-authorised 2026-10-30 · Stage 1 Follow surface. Resolve the
  // follow counts (always) and the viewer's follow state (only when
  // viewer is signed in + not the owner · self-follow is impossible).
  // Per Stage 1 preparation §13.6 the list UI is deferred to Stage 2 ·
  // only the count chip + the FollowButton render Stage 1.
  const followCountsPromise = readFollowCounts(profileAccount.id).catch(() => ({
    followersCount: 0,
    followingCount: 0,
  }));
  const viewerFollowStatePromise =
    viewerAccountId && !isOwner
      ? getFollowState({
          followerId: viewerAccountId,
          followeeId: profileAccount.id,
        }).catch(() => "not-following" as const)
      : Promise.resolve("not-following" as const);
  // Owner-authorised 2026-10-30 · resolve the profile owner's
  // Irish-account flag so the FollowButton can fire the sealed
  // IrishShamrockBurst on Follow / Unfollow. Fails open to false
  // (burst stays silent).
  const isIrishOwnerPromise = isAccountIrishAction({
    accountId: profileAccount.id,
  })
    .then((r) => (r.ok ? r.isIrish : false))
    .catch(() => false);

  // Owner-authorised 2026-10-31 · NEX Creator Programme · Stage 1.
  // Resolve earned Creator badges (music-only today; shape ready for
  // shop/video/etc.). Fail-open · a broken resolver can never break
  // the profile render; the hero simply hides the badge row.
  const creatorBadgesPromise = (async () => {
    const { resolveCreatorBadges } = await import(
      "@/lib/nex-native/creator/creator-badges"
    );
    return resolveCreatorBadges(profileAccount.id);
  })().catch(() => ({ all: [], earned: [] }));

  // Owner-authorised 2026-10-31 · Stage 2.1 ·
  // Always resolve the creator's Support settings server-side so that:
  //   · When viewer === owner · we may show the Welcome panel (needs
  //     to know if Support is configured yet)
  //   · When viewer !== owner · we expose the settings to the
  //     IdentityHero → CreatorBadgeStrip → CreatorSupportSheet ONLY
  //     when `enabled === true` (sealed privacy rule · never leak a
  //     draft). The gate below enforces that.
  // Owner-sealed 2026-11-10 · Creator Support feature deleted.
  // Short-circuit to null so the IdentityHero → CreatorBadgeStrip
  // chain renders its empty-support state and no sheet opens.
  // Preserved as a promise so downstream `await creatorSupportPromise`
  // keeps working.
  const creatorSupportPromise = Promise.resolve(null);

  // Owner-authorised 2026-10-31 · world-class "premium app feel" ·
  // warm the viewer's browser cache for the profile owner's music
  // library the moment they land on the account page. If they tap
  // music / an avatar / anywhere that deep-links to the music feed,
  // the first slide loads from cache instead of blocking on a cold
  // signed-URL fetch. Fail-open: resolver returns an empty bundle on
  // any error so a music outage never breaks the profile page.
  const musicPreloadPromise = (async () => {
    const { resolveAccountMusicPreload } = await import(
      "@/lib/nex-native/music/account-music-preload"
    );
    return resolveAccountMusicPreload({
      ownerAccountId: profileAccount.id,
      viewerIsOwner: isOwner,
    });
  })().catch(() => ({
    topTrackHref: null,
    topCoverUrl: null,
    topBackgroundUrl: null,
    topAudioUrl: null,
    libraryCoverUrls: [] as readonly string[],
  }));

  const [profile, businesses, isVerified, connectState, mutualResult, followCounts, viewerFollowState, isIrishOwner, musicPreload, creatorBadges, creatorSupportSettings] = await Promise.all([
    profilePromise,
    businessesPromise,
    verifiedPromise,
    connectStatePromise,
    mutualFriendsPromise,
    followCountsPromise,
    viewerFollowStatePromise,
    isIrishOwnerPromise,
    musicPreloadPromise,
    creatorBadgesPromise,
    creatorSupportPromise,
  ]);

  // Owner-authorised 2026-10-31 · welcome-panel visibility:
  // isOwner + has earned badge + Support not yet enabled.
  const showCreatorWelcome =
    isOwner &&
    creatorBadges.earned.length > 0 &&
    (!creatorSupportSettings || !creatorSupportSettings.enabled);

  // Owner-authorised 2026-10-31 · Stage 2.1 · the public settings
  // view. A visitor's badge-tap only ever sees settings when the
  // creator has publicly enabled them · owner always sees their own
  // (even in draft) so they can preview their Support window.
  const publicCreatorSupport =
    isOwner
      ? creatorSupportSettings
      : creatorSupportSettings && creatorSupportSettings.enabled
      ? creatorSupportSettings
      : null;

  // Pre-migration-205 shape: cover_image_url + interests may be absent.
  // The service's .select("*") returns undefined for missing columns ·
  // we treat both as empty (never fabricated).
  const profileAny = profile as unknown as
    | { cover_image_url?: string | null; interests?: string[] | null }
    | null;
  let coverImageUrl = profileAny?.cover_image_url ?? null;
  let interests = Array.isArray(profileAny?.interests) ? profileAny!.interests! : [];

  // Dev-only Philip mock substitution (gated by NODE_ENV + handle +
  // owner-view). Real stored values override the mock · the mock only
  // fills the empty slots so the layout can be seen fully populated.
  const philipMockActive =
    process.env.NODE_ENV !== "production" &&
    isOwner &&
    handle === PHILIP_MOCK_HANDLE;
  if (philipMockActive) {
    if (!coverImageUrl) coverImageUrl = PHILIP_MOCK.coverImageUrl;
    if (interests.length === 0) interests = [...PHILIP_MOCK.interests];
  }

  const primaryBusiness = businesses.length > 0 ? businesses[0]! : null;
  const safeTradeSnapshot: SafeTradeSnapshot | null = primaryBusiness
    ? resolveSafeTradeStatus(primaryBusiness)
    : null;

  // Owner-authorised 2026-10-20 · Phase 1 Verified-Directory wedge ·
  // resolve the Trust Score for the primary business. Fail-soft to
  // unknown-tier when no business exists or when there's no canonical
  // projection yet. The score reads from nex.business_evidence; empty
  // table rows resolve to tier="unknown" and the shield / evidence
  // panel both hide (sealed owner directive).
  const primaryBusinessCanonicalId: string | null = primaryBusiness
    ? ((primaryBusiness as unknown as { canonical_business_id?: string | null })
        .canonical_business_id ?? null)
    : null;
  const businessOwnerClaimedAtIso: string | null =
    (primaryBusiness as unknown as { created_at?: string | null } | null)
      ?.created_at ?? null;
  const trustScore = primaryBusiness
    ? await resolveTrustScoreByCanonicalId(primaryBusinessCanonicalId, {
        isClaimed: true,
        claimedAt: businessOwnerClaimedAtIso,
        /* Owner directive 2026-10-20 · display-name fallback bridges
           claimed sellers to their canonical row while migration 999
           (nex_business.canonical_business_id FK) is unapplied. */
        displayNameFallback: primaryBusiness.display_name ?? null,
      })
    : null;

  // Owner directive 2026-11-11 (Cycle 23 · N+1 fix) · mutual-friend
  // preview accounts now use the batch `getAccountsByIds` helper · one
  // query regardless of preview count instead of N per-id lookups.
  // Explicit param types also unblock TS tuple inference on the big
  // Promise.all destructure above.
  let mutualPreview: MutualPreviewAccount[] = [];
  if (mutualResult.previewIds.length > 0) {
    const previewMap = await accountService
      .getAccountsByIds(mutualResult.previewIds as string[])
      .catch(() => new Map());
    mutualPreview = (mutualResult.previewIds as string[])
      .map((id: string) => previewMap.get(id))
      .filter(
        (a: ReturnType<typeof previewMap.get>): a is NonNullable<typeof a> =>
          a != null,
      )
      .map((a) => ({
        id: a.id,
        displayName: a.display_name ?? "friend",
        // avatar_url lives on nex_account_profile · deferred.
        avatarUrl: null,
      }));
  }
  let effectiveMutualCount = mutualResult.count;

  // Philip mock · inject mock mutuals + preview portraits when the
  // dev-only mock is active and the real resolver returned zero.
  if (philipMockActive && effectiveMutualCount === 0) {
    effectiveMutualCount = PHILIP_MOCK.mutualCount;
    mutualPreview = PHILIP_MOCK.mutualPreview.map((p) => ({ ...p }));
  }

  // Trust Record fields · sealed 2026-10-17 Phase 1. All resolved
  // from real DB state via sealed services · zero fabrication.
  const accountAnyExtra = profileAccount as unknown as {
    tier?: string;
    created_at?: string;
  };
  const trustAccountTier: TrustAccountTier =
    accountAnyExtra.tier === "bisnis" ? "Premium" : "Standard";
  const trustMemberSinceIso = accountAnyExtra.created_at ?? null;
  const primaryBusinessAnyExtra = primaryBusiness as unknown as {
    created_at?: string;
    market_reach?: string;
  } | null;
  const trustShopActiveSinceIso = primaryBusinessAnyExtra?.created_at ?? null;
  const trustMarketReach: TrustMarketReach =
    primaryBusinessAnyExtra?.market_reach === "both"
      ? "Local and export"
      : primaryBusinessAnyExtra?.market_reach === "export_only"
        ? "Export only"
        : primaryBusinessAnyExtra?.market_reach === "local_only"
          ? "Local only"
          : null;
  // Owner directive 2026-10-17 · Phase 1.1 · labels narrowed per
  // audit finding B.2 · the sealed resolver proves ownership + shop
  // eligibility · NOT identity verification · NOT trade history.
  // "Verified Directory seller" was unreachable in production code
  // AND overclaimed · replaced with "Eligible Directory seller" ·
  // the NEW status reads "· new on NEX" to communicate newness
  // honestly without implying a verified track record.
  const trustVerification: TrustVerificationStatus =
    safeTradeSnapshot?.status === "VERIFIED"
      ? "Eligible Directory seller"
      : safeTradeSnapshot?.status === "NEW"
        ? "Eligible Directory seller · new on NEX"
        : safeTradeSnapshot?.status === "FLAGGED"
          ? "Shop currently restricted"
          : safeTradeSnapshot?.status === "SUSPENDED"
            ? "Shop suspended"
            : null;
  const trustReportsOnFile = await reportService
    .countPendingReportsAgainst(profileAccount.id)
    .catch(() => 0);

  // Owner directive 2026-11-04 · prefer the account's own handle
  // over the generic "NEX member" fallback.
  const displayName =
    profileAccount.display_name ?? profileAccount.nex_handle ?? "NEX user";
  const chatHref = session
    ? `/nex-native/chat/peer/${profileAccount.id}`
    : `/nex-native/sign-in?return_to=${encodeURIComponent(`/nex-native/chat/peer/${profileAccount.id}`)}`;

  // Viewer identity for the top chrome bar (NOT the profile being
  // viewed). Honours the Emma Wilson reference where the top bar
  // shows the VIEWER's own NEX ID (not the profile owner's). The
  // viewer's own profile row is fetched only when they're signed in.
  const viewerProfile = viewerAccountId
    ? await accountProfileService.getProfileByAccountId(viewerAccountId).catch(() => null)
    : null;
  const drawerSession: ControlDrawerSession | null = session
    ? {
        displayName: session.account.display_name,
        nexHandle: session.account.nex_handle,
        isBisnis: effectiveTier(session.account) === "bisnis",
      }
    : null;

  // Owner directive 2026-11-12 · inline edit mode on the profile
  // view page RETIRED · the dedicated drawer row "Edit Profile" →
  // /settings/profile/edit is now the single entry point to profile
  // editing. The ?mode=edit query is ignored on this surface (the
  // handler below forces editMode=false for every viewer, including
  // the owner). OwnerEditShell + cover camera picker + avatar
  // camera picker + inline fields all stay on disk for possible
  // revival but never render here.
  const editMode = false as const;
  const editError = typeof sp.error === "string" ? sp.error : null;

  // Resolve the effective field values used to seed the edit form
  // (so the owner opens edit mode with their current values · real
  // or mocked · pre-filled instead of blank inputs).
  const effectiveProfession =
    profile?.profession ?? (philipMockActive ? PHILIP_MOCK.profession : null);
  const effectiveHeadline =
    profile?.headline ?? (philipMockActive ? PHILIP_MOCK.headline : null);
  const effectiveLocation =
    profile?.location_label ?? (philipMockActive ? PHILIP_MOCK.locationLabel : null);
  // Owner directive 2026-11-12 · address is pulled from the sealed
  // Edit Profile save path · shown on the hero location row when
  // location_label is null.
  const effectiveAddress =
    (profile as { address?: string | null } | null)?.address ?? null;
  // Owner directive 2026-11-12 · five sealed socials from
  // nex_account_profile · migration 273 columns. Each handle
  // flows through to the footer row which only renders a brand
  // icon for platforms the user has set.
  const profileSocials = profile as {
    instagram_handle?: string | null;
    facebook_handle?: string | null;
    tiktok_handle?: string | null;
    x_handle?: string | null;
    youtube_handle?: string | null;
  } | null;
  const socialInstagram = profileSocials?.instagram_handle ?? null;
  const socialFacebook = profileSocials?.facebook_handle ?? null;
  const socialTiktok = profileSocials?.tiktok_handle ?? null;
  const socialX = profileSocials?.x_handle ?? null;
  const socialYoutube = profileSocials?.youtube_handle ?? null;
  // Owner directive 2026-11-12 · about-me is the canonical source of
  // the long-form self-description · written by the sealed Edit
  // Profile form into nex_account_profile.about_me (migration 274).
  // The older `bio` column is legacy and may hold stale seeded values
  // (e.g. the "Irish folk + traditional covers. Dublin." test string
  // that was in there before migration 274 landed). We prefer about_me
  // whenever it's non-empty · fall back to bio for pre-migration rows ·
  // mock-fallback only when neither is set.
  const profileAboutMe =
    (profile as { about_me?: string | null } | null)?.about_me ?? null;
  const effectiveBio =
    (profileAboutMe && profileAboutMe.trim().length > 0 ? profileAboutMe : null) ??
    profile?.bio ??
    (philipMockActive ? PHILIP_MOCK.bio : null);
  const effectiveInterests = interests;

  /* Owner directive 2026-10-18 · profile opens in the SAME theme
     colour as the chat the viewer came from · ?themeAccent URL
     param (sanitised) tints the chrome top-of-page gradient + sets
     --nex-profile-accent CSS var so any theme-aware descendant can
     pick it up. Null (no param, bad hex) renders the sealed navy. */
  const themeAccent = parseThemeAccent(sp.themeAccent);
  // Owner directive 2026-11-12 (third pass) · scroll container is
  // the sealed .nex-native-frame itself (overflow-y:auto defined in
  // nex-native.css line 245). Main does NOT own its own scroll · it
  // sizes to its natural content height and lets the frame scroll
  // the whole column. Nested-scroll pattern was swallowing the
  // sticky header + hiding overflow. The sticky header below pins
  // to the frame's top edge because the frame is now the nearest
  // scrolling ancestor.
  const mainStyle: React.CSSProperties = {
    position: "relative",
    minHeight: "100%",
    background: themeAccent
      ? `linear-gradient(180deg, ${themeAccent}44 0%, ${themeAccent}22 180px, ${NEX.bg} 400px, ${NEX.bg} 100%)`
      : NEX.bg,
    color: NEX.text,
    fontFamily: SANS,
    display: "flex",
    flexDirection: "column",
    paddingBottom: 12,
    ["--nex-profile-accent" as unknown as string]:
      themeAccent ?? "#00AFFF",
  };

  return (
    <>
      {/* Owner directive 2026-11-11 (SEO B2 closeout) · visibility-gated
          Person + BreadcrumbList JSON-LD · re-runs discoverability check
          server-side so non-discoverable profiles never emit structured
          data regardless of the branch mounting this component. */}
      <ProfileJsonLdScripts handle={handle} />
    <main
      data-nex-profile-root
      data-nex-profile-mode={isOwner ? "owner" : "viewer"}
      data-nex-profile-edit-mode={editMode ? "on" : "off"}
      data-nex-profile-themed={themeAccent ? "true" : "false"}
      style={mainStyle}
    >
      {/* Owner-authorised 2026-10-31 · world-class premium app feel.
          Invisible: warms the browser cache for the profile owner's
          top music track + library row thumbnails + the music-feed
          route payload. If the viewer taps anything that deep-links
          to /nex-native/nex-feed/music-{trackId}, the slide loads
          from cache instead of a cold start. Save-Data / 2G guards
          live inside the component. */}
      <AccountMusicPreloader
        topTrackHref={musicPreload.topTrackHref}
        topCoverUrl={musicPreload.topCoverUrl}
        topBackgroundUrl={musicPreload.topBackgroundUrl}
        topAudioUrl={musicPreload.topAudioUrl}
        libraryCoverUrls={musicPreload.libraryCoverUrls}
      />

      {/* Owner-authorised 2026-10-31 · Creator welcome panel · shown
          on the owner's own profile when they've earned a Creator
          badge but haven't set up Support yet. Dismissible client-
          side (ephemeral · comes back on next profile visit until
          they configure Support). */}
      {showCreatorWelcome ? (
        <CreatorWelcomePanel
          earnedBadges={creatorBadges.earned}
          firstName={displayName.split(" ")[0] ?? displayName}
        />
      ) : null}
      {/* Owner directive 2026-10-18 · when the viewer arrives from a
          chat theme preview (?themeAccent in URL) · show a theme-
          coloured strip at the top of the page so the continuity
          from chat → profile is visible. 4px tall · pure accent ·
          sits above ProfileChrome. */}
      {themeAccent && (
        <div
          data-nex-profile-theme-strip
          aria-hidden
          style={{
            height: 4,
            width: "100%",
            background: `linear-gradient(90deg, ${themeAccent}, ${themeAccent}aa, ${themeAccent})`,
            boxShadow: `0 2px 12px ${themeAccent}66`,
            flexShrink: 0,
          }}
        />
      )}
      {/* Owner directive 2026-11-12 (fifth pass) · header drawer
          button renders IN FLOW at the top · plain block positioning
          · sticky trick was hiding the hero on initial render. The
          frame itself scrolls the whole column, so the drawer
          button scrolls away as the user moves down the page (they
          scroll back up to reach it · same behaviour as every
          other NEX surface). Header + cover both visible at the
          top of main on first paint. */}
      <div
        style={{
          padding: "calc(env(safe-area-inset-top,0) + 8px) 14px 8px",
          flexShrink: 0,
        }}
      >
        <NexPageHeader dataScope="profile-view" />
      </div>
      {/* Owner directive 2026-11-12 (third pass) · ProfileChrome
          removed · NexPageHeader above is the single owner of the
          top-right drawer button. Previously both rendered their
          own ControlDrawer trigger, which showed TWO buttons on the
          profile view. Component kept on disk for possible reuse. */}
      {/* Owner directive 2026-10-17 Phase 2.0 · honest post-submit
          confirmation banner. Rendered server-side from the URL
          query string · the ?report=sent flag is ONLY reachable via
          the sealed submitSafeTradeReportAction's post-persistence
          redirect · any error path redirects with ?error= which
          renders the warn-tone banner instead. Success is NEVER
          shown on the error path. */}
      {sp.report === "sent" ? (
        <div
          role="status"
          data-nex-profile-report-banner="sent"
          style={{
            margin: "8px 14px 0",
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(22, 214, 107, 0.14)",
            border: "1px solid rgba(22, 214, 107, 0.45)",
            color: "#16D66B",
            fontSize: 12,
            lineHeight: 1.4,
            fontFamily: SANS,
          }}
        >
          ✓ Report submitted · NEX HQ will review and act according to
          the sealed enforcement doctrine. Your identity is private.
        </div>
      ) : null}
      {typeof sp.error === "string" && sp.error.length > 0 ? (
        <div
          role="alert"
          data-nex-profile-report-banner="error"
          style={{
            margin: "8px 14px 0",
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(244, 106, 106, 0.14)",
            border: "1px solid rgba(244, 106, 106, 0.45)",
            color: "#F46A6A",
            fontSize: 12,
            lineHeight: 1.4,
            fontFamily: SANS,
          }}
        >
          {sp.error}
        </div>
      ) : null}
      {/* ProfileBody is the actual page content. When the viewer is
          the owner it mounts inside OwnerEditShell so the shell can
          append its inline-edit inputs AFTER the body in edit mode.
          Viewer mode renders the body directly. */}
      {isOwner ? (
        <OwnerEditShell
          profileHandle={profileAccount.nex_handle ?? handle}
          editMode={editMode}
          errorMessage={editError}
          saveAction={savePersonalProfileAction}
          initial={{
            profession: effectiveProfession,
            headline: effectiveHeadline,
            locationLabel: effectiveLocation,
            bio: effectiveBio,
            interests: effectiveInterests,
          }}
        >
          <ProfileBody
            coverImageUrl={coverImageUrl}
            displayName={displayName}
            profileAccountNexHandle={profileAccount.nex_handle}
            effectiveProfession={effectiveProfession}
            effectiveHeadline={effectiveHeadline}
            effectiveLocation={effectiveLocation}
            effectiveAddress={effectiveAddress}
            socialInstagram={socialInstagram}
            socialFacebook={socialFacebook}
            socialTiktok={socialTiktok}
            socialX={socialX}
            socialYoutube={socialYoutube}
            effectiveBio={effectiveBio}
            avatarUrl={profile?.avatar_url ?? (philipMockActive ? PHILIP_MOCK.avatarUrl : null)}
            isOwner={isOwner}
            editMode={editMode}
            isVerified={isVerified}
            interests={interests}
            mutualCount={effectiveMutualCount}
            mutualPreview={mutualPreview}
            previewActions={philipMockActive}
            trustAccountTier={trustAccountTier}
            trustMemberSinceIso={trustMemberSinceIso}
            trustShopActiveSinceIso={trustShopActiveSinceIso}
            trustMarketReach={trustMarketReach}
            trustVerification={trustVerification}
            trustReportsOnFile={trustReportsOnFile}
            viewerIsSignedIn={session !== null}
            isSignedIn={session !== null}
            profileAccountId={profileAccount.id}
            handle={handle}
            displayNameForActions={displayName}
            connectState={connectState}
            safeTradeSnapshot={safeTradeSnapshot}
            primaryBusiness={primaryBusiness}
            chatHref={chatHref}
            trustScore={trustScore}
            ownerClaimedAtIso={businessOwnerClaimedAtIso}
            followersCount={followCounts.followersCount}
            followingCount={followCounts.followingCount}
            viewerFollowState={viewerFollowState}
            isIrishOwner={isIrishOwner}
            earnedCreatorBadges={creatorBadges.earned}
            creatorSupportSettings={publicCreatorSupport}
          />
        </OwnerEditShell>
      ) : (
        <ProfileBody
          coverImageUrl={coverImageUrl}
          displayName={displayName}
          profileAccountNexHandle={profileAccount.nex_handle}
          effectiveProfession={effectiveProfession}
          effectiveHeadline={effectiveHeadline}
          effectiveLocation={effectiveLocation}
          effectiveAddress={effectiveAddress}
          socialInstagram={socialInstagram}
          socialFacebook={socialFacebook}
          socialTiktok={socialTiktok}
          socialX={socialX}
          socialYoutube={socialYoutube}
          effectiveBio={effectiveBio}
          avatarUrl={profile?.avatar_url ?? null}
          isOwner={isOwner}
          editMode={false}
          isVerified={isVerified}
          interests={interests}
          mutualCount={mutualResult.count}
          mutualPreview={mutualPreview}
          isSignedIn={session !== null}
          profileAccountId={profileAccount.id}
          handle={handle}
          displayNameForActions={displayName}
          connectState={connectState}
          safeTradeSnapshot={safeTradeSnapshot}
          primaryBusiness={primaryBusiness}
          chatHref={chatHref}
          trustScore={trustScore}
          ownerClaimedAtIso={businessOwnerClaimedAtIso}
          trustAccountTier={trustAccountTier}
          trustMemberSinceIso={trustMemberSinceIso}
          trustShopActiveSinceIso={trustShopActiveSinceIso}
          trustMarketReach={trustMarketReach}
          trustVerification={trustVerification}
          trustReportsOnFile={trustReportsOnFile}
          viewerIsSignedIn={session !== null}
          followersCount={followCounts.followersCount}
          followingCount={followCounts.followingCount}
          viewerFollowState={viewerFollowState}
          isIrishOwner={isIrishOwner}
          earnedCreatorBadges={creatorBadges.earned}
          creatorSupportSettings={publicCreatorSupport}
        />
      )}
    </main>
    </>
  );
}

/**
 * The actual page body (cover + hero + sections). Mounted inside
 * OwnerEditShell when the viewer is the owner so the shell's inline
 * edit fields appear BELOW the body naturally. Mounted directly
 * when the viewer is anonymous or a non-owner.
 */
function ProfileBody(props: {
  coverImageUrl: string | null;
  displayName: string;
  profileAccountNexHandle: string | null;
  effectiveProfession: string | null;
  effectiveHeadline: string | null;
  effectiveLocation: string | null;
  // Owner directive 2026-11-12 · saved street address from
  // nex_account_profile.address · fallback for the hero location row
  // when location_label is null.
  effectiveAddress: string | null;
  // Owner directive 2026-11-12 · 5 socials flow from profile → ProfileBody → ProfileFooterSection.
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialTiktok: string | null;
  socialX: string | null;
  socialYoutube: string | null;
  effectiveBio: string | null;
  avatarUrl: string | null;
  isOwner: boolean;
  editMode: boolean;
  isVerified: boolean;
  interests: string[];
  mutualCount: number;
  mutualPreview: MutualPreviewAccount[];
  isSignedIn: boolean;
  profileAccountId: string;
  handle: string;
  displayNameForActions: string;
  connectState: ConnectState;
  safeTradeSnapshot: SafeTradeSnapshot | null;
  primaryBusiness: { id: string; slug: string | null; display_name: string } | null;
  chatHref: string;
  /** Dev-only · when true, Connect/Message buttons render even in
   *  owner mode so the owner can preview what viewers see. Driven
   *  by the Philip mock gate · never active in production. */
  previewActions?: boolean;
  // Trust Record fields · all server-resolved · never fabricated.
  trustAccountTier: TrustAccountTier;
  trustMemberSinceIso: string | null;
  trustShopActiveSinceIso: string | null;
  trustMarketReach: TrustMarketReach;
  trustVerification: TrustVerificationStatus;
  trustReportsOnFile: number;
  viewerIsSignedIn: boolean;
  /** Owner-authorised 2026-10-20 · Phase 1 Verified-Directory wedge ·
   *  pre-resolved Trust Score for the primary business · null when
   *  the viewer has no business attached. The sheet + hero icon both
   *  receive this via props so Safe Trade displays the evidence
   *  panel and the shield renders next to the business name. */
  trustScore: import("@/lib/nex-native/trust/trust-score-shared").TrustScoreResult | null;
  ownerClaimedAtIso: string | null;
  // Owner-authorised 2026-10-30 · Stage 1 Follow (§13.6). Prop widened
  // to the full NexFollowState union (includes "pending") so this body
  // can forward whatever `getFollowState` returned without narrowing.
  // Stage 1 UI treats "pending" the same as "not-following" visually ·
  // the pending branch is reserved for a Stage 2 handshake flow.
  followersCount: number;
  followingCount: number;
  viewerFollowState: import("@/lib/nex-native/follow/types").NexFollowState;
  /** Owner-authorised 2026-10-30 · when true, Follow / Unfollow taps
   *  fire the sealed IrishShamrockBurst overlay. Scoped to Ireland
   *  only (phone_country_code === '+353') per Phase 1 hard-coded
   *  owner decision. */
  isIrishOwner: boolean;
  /** Owner-authorised 2026-10-31 · NEX Creator Programme · Stage 1.
   *  Earned per-section Creator badges rendered beneath avatar +
   *  location in IdentityHero. Empty array = no badges · badge row
   *  is hidden. */
  earnedCreatorBadges: readonly import("@/lib/nex-native/creator/creator-badges").SectionProgress[];
  /** Owner-authorised 2026-10-31 · Stage 2.1 · the creator's Support
   *  settings for the tappable Support sheet. Server already gates
   *  this prop (null when the viewer is not the owner AND the
   *  creator has not publicly enabled Support · sealed privacy). */
  creatorSupportSettings: unknown; // Creator Support deleted 2026-11-10 · prop kept for backward-compat with callers · ignored.
}) {
  // Avatar + cover camera overlays only when the owner is actively
  // editing · zero footprint for viewers or in view mode.
  const showUploadAffordances = props.isOwner && props.editMode;
  return (
    <>
      <CoverPhoto
        coverImageUrl={props.coverImageUrl}
        isOwner={props.isOwner}
        showCoverUploadAffordance={showUploadAffordances}
      />
      {/* Owner directive 2026-11-12 · Safe Trade hero shield removed
          from the profile view. "The user's account is their own."
          A tiny NEX-member tick next to the display name is the only
          remaining membership signal. Backend counters + SafeTradeSheet
          component files stay for other surfaces until explicitly
          retired. */}
      <IdentityHero
        displayName={props.displayName}
        nexHandle={props.profileAccountNexHandle}
        avatarUrl={props.avatarUrl}
        profession={props.effectiveProfession}
        headline={props.effectiveHeadline}
        locationLabel={props.effectiveLocation}
        address={props.effectiveAddress}
        bio={props.effectiveBio}
        isOwner={props.isOwner}
        isVerified={props.isVerified}
        showAvatarUploadAffordance={showUploadAffordances}
        trustTier={props.trustScore?.tier ?? "unknown"}
        earnedCreatorBadges={props.earnedCreatorBadges}
        supportSettings={props.creatorSupportSettings}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 10 }}>
        <InterestsPills
          interests={props.interests}
          isOwner={props.isOwner}
          bio={props.effectiveBio}
        />
        <MutualFriends count={props.mutualCount} preview={props.mutualPreview} />
        {/* Owner directive 2026-11-02 · Connect + Message action
         *  pills retired from the profile hero · Follow-only is the
         *  new primary action (rendered below in the FollowButton
         *  row). ActionButtons component kept in the file tree for
         *  any future surface that needs the connect/invite flow. */}

        {/* Owner-authorised 2026-10-30 · Stage 1 Follow surface
            (§13.6). Count chip renders for all viewers (including
            the owner · they see their own counts). FollowButton
            renders only for non-owner signed-in viewers. */}
        {/* Owner directive 2026-11-12 · Followers / Following row
            now centered on the page · supersedes the space-between
            layout that pushed the count chip left and the Follow
            button right. The chip renders centered; the optional
            Follow button sits beneath it on its own centered row so
            both elements remain visible without competing for the
            edges. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            paddingTop: 4,
          }}
        >
          <FollowersCountChip
            followersCount={props.followersCount}
            followingCount={props.followingCount}
            ink="#102033"
            inkDim="#4A6080"
          />
          {!props.isOwner && props.isSignedIn ? (
            <FollowButtonWithShamrock
              followeeId={props.profileAccountId}
              source="profile"
              initialState={props.viewerFollowState}
              size="md"
              isSelfAccount={false}
              isIrishOwner={props.isIrishOwner}
            />
          ) : null}
        </div>

        {/* Owner directive 2026-11-02 · profile footer section · pass 2
         *  of the hero redesign. Three stacked blocks under the
         *  followers/following row:
         *    1. Short description (uses effectiveBio · trimmed to 180
         *       chars so it fits the hero footprint)
         *    2. Social-media icons row (placeholder links · owner edit
         *       flow wires the real URLs; icons stay muted when no URL
         *       is set so they signal "ready to be configured").
         *    3. Safe Trade Report facts panel (sellers only · shows
         *       status badge mapped from SafeTradeSnapshot + the three
         *       honest facts: complaints filed · posts flagged ·
         *       account status). No reviews · just facts. */}
        <ProfileFooterSection
          bio={props.effectiveBio}
          isSeller={props.primaryBusiness !== null}
          safeTradeSnapshot={props.safeTradeSnapshot}
          trustReportsOnFile={props.trustReportsOnFile}
          displayName={props.displayName}
          instagramHandle={props.socialInstagram}
          facebookHandle={props.socialFacebook}
          tiktokHandle={props.socialTiktok}
          xHandle={props.socialX}
          youtubeHandle={props.socialYoutube}
          dateJoinedNexIso={props.trustMemberSinceIso}
        />
        {/* Footer Safe Trade card RETIRED 2026-10-17 per owner
            directive · the Safe Trade shield icon on the hero top-
            left is now the sole entry point to the 4-state sheet ·
            same resolver · same copy · same sheet component · zero
            duplicate chrome. */}
        {/* Footer Edit Profile button retired 2026-10-17 per owner
            directive · the sealed "one edit button top-right on the
            image" rule is restored · the OwnerEditShell's Edit/Save
            pill is the sole owner-edit entry point. */}
      </div>
    </>
  );
}

/**
 * Server-side resolver for the Connect button's state. Reads one
 * `nex_friend_edge` row via the sealed canonicalPair ordering. Zero
 * client-side friend lookups · zero fabricated states · fail-closed
 * to "none" on any read error (never pre-grants Friends status).
 */
async function resolveConnectState(
  viewerId: string | null,
  ownerId: string,
): Promise<ConnectState> {
  if (viewerId === null) return "anonymous";
  if (viewerId === ownerId) return "none"; // owner mode suppresses the button
  try {
    const edge = await friendService.getEdge(viewerId, ownerId);
    if (!edge) return "none";
    if (edge.status === "blocked") return "blocked";
    if (edge.status === "accepted") return "accepted";
    if (edge.status === "pending") {
      return edge.requested_by === viewerId ? "pending-outgoing" : "pending-incoming";
    }
    if (edge.status === "declined") {
      // Asymmetric decline rule (sealed · see feedback memories).
      return edge.requested_by === viewerId ? "declined-by-them" : "none";
    }
    return "none";
  } catch {
    return "none";
  }
}

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  text: "#F2F5F8",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/**
 * Dev-only Emma Wilson render · composes the real profile components
 * with the EMMA_DEMO fake data so the layout can be visually verified
 * against the owner-supplied screenshot. Hard-gated by the NODE_ENV
 * + ?demo=emma check in the main handler · never reachable in prod.
 *
 * This render path does NOT touch any backend service · zero DB
 * roundtrips · zero fake data mutations · the sealed real-data path
 * is unaffected.
 */
function DemoEmmaRender(): React.JSX.Element {
  const d = EMMA_DEMO;
  // sendFriendInviteAction is passed through unchanged so the Connect
  // button is interactable in demo mode (the server action gates on
  // auth + handle format anyway · demo tap just hits sign-in).
  return (
    <main
      data-nex-profile-root
      data-nex-profile-mode="viewer"
      data-nex-profile-demo="emma"
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        display: "flex",
        flexDirection: "column",
        paddingBottom: 32,
      }}
    >
      {/* Owner directive 2026-11-12 (third pass) · demo-mode
          ProfileChrome also removed · matches the real-path
          removal above so both code paths show exactly ONE drawer
          button (the one from NexPageHeader at the top). */}
      <CoverPhoto coverImageUrl={d.coverImageUrl} isOwner={false} />
      {/* Owner directive 2026-11-12 · demo path matches real path ·
          SafeTradeHeroIcon mount removed. */}
      <IdentityHero
        displayName={d.displayName}
        nexHandle={d.nexHandle}
        avatarUrl={d.avatarUrl}
        profession={d.profession}
        headline={d.headline}
        locationLabel={d.locationLabel}
        bio={d.bio}
        isOwner={false}
        isVerified={d.isVerified}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 10 }}>
        <InterestsPills
          interests={[...d.interests]}
          isOwner={false}
          bio={d.bio}
        />
        <MutualFriends count={d.mutualCount} preview={[...d.mutualPreview]} />
        {/* Owner directive 2026-11-02 · demo Connect + Message pills
         *  retired to match the main viewer path · Follow-only is
         *  the primary action across every profile. */}
        {/* Bottom Safe Trade card RETIRED 2026-10-17 · demo mirrors
            the real path · entry is the hero-icon only. */}
      </div>
    </main>
  );
}

// ============================================================
// ProfileFooterSection · owner-authorised 2026-11-02 · pass 2 of
// the hero redesign. See the mount site above for scope + intent.
// Three stacked blocks: description · social icons · Safe Trade
// Report facts panel (sellers only). Pure presentational component;
// data flows in via props.
// ============================================================

function ProfileFooterSection(props: {
  readonly bio: string | null;
  readonly isSeller: boolean;
  readonly safeTradeSnapshot: SafeTradeSnapshot | null;
  readonly trustReportsOnFile: number;
  readonly displayName: string;
  // Owner directive 2026-11-12 · 5 social handles pulled from
  // nex_account_profile · null means the user hasn't set that
  // platform · footer only renders icons for handles that are set.
  readonly instagramHandle?: string | null;
  readonly facebookHandle?: string | null;
  readonly tiktokHandle?: string | null;
  readonly xHandle?: string | null;
  readonly youtubeHandle?: string | null;
  // Owner directive 2026-11-12 · supersedes the bio paragraph that
  // used to sit here · footer now reports when the account joined
  // NEX instead (bio moved under the interests grid). ISO 8601
  // timestamp from `nex_account.created_at`.
  readonly dateJoinedNexIso?: string | null;
}): React.JSX.Element | null {
  // Owner directive 2026-11-02 · Safe Trade Report panel ALWAYS
  // renders on every profile (buyer should always be able to see
  // the account's standing · or clearly see "no shop active" when
  // the profile is not a seller). Section itself never short-circuits
  // now · it always has at least the Safe Trade panel.

  // Owner directive 2026-11-12 · bio no longer rendered in the footer
  // (moved under the interests grid) · shortBio reference retired.
  void props.bio;

  // Account status mapping · the three states the owner asked for
  // (active / moderate / regular) map onto the sealed SafeTradeStatus:
  //   · active   = VERIFIED (claimed + ≥1 completed trade + 0 open)
  //                OR NEW (claimed + 0 completed, 0 open · "ready to trade")
  //   · moderate = FLAGGED (1+ open dispute · buyer caution)
  //                OR trustReportsOnFile > 0 (reports regardless of trade state)
  //   · regular  = UNCLAIMED (directory listing · no owner yet)
  //                OR SUSPENDED (shows as "regular" visually but copy
  //                differs · the badge below honours the real state).
  // Honest-null: SafeTradeSnapshot.openDisputes is null when the
  // dispute schema isn't wired yet · we show "No complaints recorded
  // yet" instead of fabricating "0".
  const status = props.safeTradeSnapshot?.status ?? "UNCLAIMED";
  const openDisputes = props.safeTradeSnapshot?.openDisputes;
  const reportsOnFile = props.trustReportsOnFile ?? 0;
  const statusGroup: "active" | "moderate" | "regular" =
    status === "FLAGGED" || reportsOnFile > 0 || (openDisputes ?? 0) > 0
      ? "moderate"
      : status === "VERIFIED" || status === "NEW"
        ? "active"
        : "regular";
  const STATUS_PALETTE = {
    active: { bg: "rgba(22, 214, 107, 0.14)", ring: "#16D66B", ink: "#16D66B" },
    moderate: { bg: "rgba(255, 114, 0, 0.14)", ring: "#FF7200", ink: "#FF7200" },
    regular: { bg: "rgba(125, 155, 192, 0.14)", ring: "#7D9BC0", ink: "#7D9BC0" },
  } as const;
  const palette = STATUS_PALETTE[statusGroup];

  return (
    <section
      data-nex-profile-footer-section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "16px 14px 0",
      }}
    >
      {/* Owner directive 2026-11-12 · bio render REPLACED here with
          a "Date joined NEX" line · the bio itself now surfaces
          directly under the interests grid (see InterestsPills).
          `shortBio` remains computed above for future callers · it
          just isn't painted in this footer. */}
      {props.dateJoinedNexIso ? (
        <p
          data-nex-profile-footer-date-joined
          style={{
            // Owner directive 2026-11-12 · both the "Date joined NEX"
            // prefix AND the formatted date paint in the same muted
            // gray (#9A9A9A). Supersedes the earlier white-bold span
            // on the date value · the whole line now reads as one
            // calm gray metadata row.
            margin: 0,
            fontSize: 12,
            lineHeight: 1.4,
            color: "#9A9A9A",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
            textAlign: "center",
          }}
        >
          Date joined NEX · {formatDateJoined(props.dateJoinedNexIso)}
        </p>
      ) : null}

      {/* Owner directive 2026-11-12 · social icons row rebuilt.
          Supersedes the hardcoded emoji glyph placeholders (📷 ⓕ 𝕏
          ▶ ♪) that rendered regardless of whether handles were set.
          New rule: only render a brand icon when the user has saved
          that platform's handle · each icon is an external anchor
          to the platform. Zero placeholder clutter · hidden row
          when no socials are set. Uses the sealed 5-brand PNG set
          from /nex-social/. */}
      {(() => {
        const items = (
          [
            { platform: "instagram", handle: props.instagramHandle, url: (h: string) => `https://instagram.com/${h}` },
            { platform: "facebook", handle: props.facebookHandle, url: (h: string) => `https://facebook.com/${h}` },
            { platform: "tiktok", handle: props.tiktokHandle, url: (h: string) => `https://tiktok.com/@${h}` },
            { platform: "x", handle: props.xHandle, url: (h: string) => `https://x.com/${h}` },
            { platform: "youtube", handle: props.youtubeHandle, url: (h: string) => `https://youtube.com/@${h}` },
          ] as const
        ).filter((s) => (s.handle ?? "").trim().length > 0);
        if (items.length === 0) return null;
        return (
          <div
            data-nex-profile-footer-socials
            style={{
              display: "flex",
              gap: 14,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {items.map((s) => (
              <a
                key={s.platform}
                href={s.url(s.handle!.trim().replace(/^@/, ""))}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${s.platform} · @${s.handle!.trim().replace(/^@/, "")}`}
                data-nex-profile-footer-social={s.platform}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                  lineHeight: 0,
                }}
              >
                <SocialBrandIcon platform={s.platform} size={32} />
              </a>
            ))}
          </div>
        );
      })()}

      {/* Owner directive 2026-11-12 · Safe Trade Report block
          removed from the profile view (per owner feedback "remove
          this Safe Trade Report … from app"). The DB-side counters
          (nex_safe_trade_report, dispute + flag counters) remain
          untouched · only the UI render is retired. If a future
          surface needs the honesty counters back, revive the block
          from git history. The SafeTradeFactRow helper below is now
          unused and can be deleted in a cleanup pass. */}
    </section>
  );
}

// Owner directive 2026-11-12 · formats the "Date joined NEX" line
// (e.g. "May 2026") · locale-agnostic month + year so it reads the
// same across markets. Returns null-safe empty string when the ISO
// can't be parsed so the paragraph just omits the value.
function formatDateJoined(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function SafeTradeFactRow(props: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        fontSize: 12,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <span style={{ color: "#8BA9D1" }}>{props.label}</span>
      <span style={{ color: "#F2F5F8", fontWeight: 700 }}>{props.value}</span>
    </li>
  );
}
