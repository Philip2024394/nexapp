// src/app/nex-native/contacts/page.tsx
//
// NEX Contacts · dedicated hub for every signed-in NEX account.
// -----------------------------------------------------------------------
// Owner-authorised 2026-10-17 (Phase 1 implementation after design pass).
//
// Layout matches the owner-supplied template (`nex contacts.png`):
//   · Earth background image (full-bleed, fades into solid navy)
//   · Header · NEX ping badge (left) + "NEX CONTACTS" title + subtitle
//     + Search icon + Plus icon (right)
//   · Search bar
//   · 5 filter pills · All · Friends · Business · Dating · Groups
//   · Invite Friends banner card (uses owner-supplied holographic PNG)
//   · My Groups card (uses owner-supplied glass emblem PNG)
//   · My Contacts list · avatar + name + chat icon
//
// Design decisions sealed in this implementation (D1-D9):
//   · D1 · city hidden entirely · no last_known_city_label exposure
//   · D2 · no presence dot · nex_presence table does not exist
//   · D3 · chat wired · call + video shown as disabled affordances
//   · D4 · invite via Web Share API with clipboard fallback · uses
//          the user's own /nex-native/u/[handle] profile URL
//   · D5 · Groups card renders with honest "coming soon · 0 groups"
//   · D6 · Dating pill visible but disabled
//   · D7 · launch flag NEX_CONTACTS_V2_ENABLED · dev default ON ·
//          prod default OFF · fallback redirect preserved when OFF
//   · D8 · empty state when zero contacts · never fabricated count
//   · D9 · system font stack · no new webfont dependency
//
// Fallback when flag OFF · the pre-Phase 1 behaviour is preserved:
// server-side redirect to /nex-native/chat?tab=friends. Setting
// NEX_CONTACTS_V2_ENABLED=0 at the env boundary (or deploying to
// production with the env unset) restores the redirect without any
// code change.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as friendService from "@/lib/nex-native/friend-service";
import * as accountService from "@/lib/nex-native/account-service";
import { effectiveTier } from "@/lib/nex-native/account-service";
import * as conversationService from "@/lib/nex-native/conversation-service";
// Owner directive 2026-10-17 · the new NEX identity-card layout
// surfaces the person's profession + headline underneath their NEX
// ID. Data comes from nex_account_profile (migration 042 · profession
// text ≤80, headline text ≤120 · NULL until supplied · never
// fabricated). Each friend row triggers one profile lookup in
// parallel · falls back silently to "no profession line" on error.
import * as accountProfileService from "@/lib/nex-native/account-profile-service";
import type { ControlDrawerSession } from "@/components/nex-native/control-drawer/control-drawer-client";
// Owner directive 2026-11-01 · Batch D+ · Creator Support auto-gate.
// Resolve viewer's earned Creator badges + Support configuration state
// server-side so the drawer can hide the "Creator Support" row for
// non-qualified viewers and flip the label to "Set up Creator Support"
// for qualified-but-not-configured ones. Both resolvers are fail-open:
// a transient DB error returns empty/null and the drawer falls back to
// LEGACY "always visible" behaviour so the row doesn't silently vanish
// on the home surface during an outage.
import {
  resolveCreatorBadges,
  EMPTY_EARNED_BADGES,
} from "@/lib/nex-native/creator/creator-badges";
import { getCreatorSupportSettings } from "@/lib/nex-native/creator/creator-support-service";
// Contacts intentionally does NOT wrap in `NexNativeShell` (and
// therefore not in `NexHudFrame`). The HUD renders a floating
// "NEX · ready" console-viewport button that the owner called out
// as a "floating orb" above the Contacts content. The Contacts
// surface is a dedicated hub with its own identity-forward layout
// via `ContactsShell` · it does not need the HUD chrome.
import { NEX_CONTACTS_V2_ENABLED } from "@/lib/nex-native/launch-flags";
import { ContactsShell } from "./_contacts-shell";
import { ContactsHeader } from "./_contacts-header";
import { type ContactsFilter } from "./_contacts-filter-pills";
import { type ContactRowDisplay } from "./_contacts-list";
import { ContactRow } from "./_contact-row";
import Link from "next/link";
import { ContactsPlusDrawer } from "./_contacts-plus-drawer";
import { ContactsLiveWorldTrigger } from "./_contacts-live-world-trigger";
import { CommunityNoticeCard } from "./_community-notice-card";
// Owner directive 2026-11-03 (B+β · full build) · "we want full build
// and connected to create profile page so we know where the user is
// from and where to add to the group". Resolve the viewer's actual
// Community membership + district zone server-side so the Community
// card shows real zone data, not a hardcoded Yogyakarta mock.
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import { getZoneById } from "@/lib/nex-native/community/zone-service";
// Owner directive 2026-11-03 · "can i see some mock contact cards on
// our new contacts page" · when running outside production AND the
// signed-in user has no real friends, swap in the full prototype mock
// dataset (6 contacts with varied presence / shop / verified / city
// states) so the new tile-grid design can be reviewed with populated
// rows. In production (NODE_ENV === "production") the mock injection
// is skipped entirely so real users never see fabricated contacts.
import { PROTOTYPE_MOCK_ROWS } from "./_prototype-shared";
// Owner directive 2026-11-03 · "update the new page design for contacts
// C · Card-grid page design" · the sealed SearchBar / FilterPills /
// Nex1WelcomeBanner / InviteFriendsCard imports are retired in favour
// of a tile grid matching prototype-c. ContactsHeader (sealed drawer)
// is preserved so the control drawer menu, creator badges, and
// impersonation banner continue to work. The files are not deleted
// (`_contacts-search-bar.tsx` etc. remain on disk · available if the
// owner wants to re-mount them in future).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ContactsPage({ searchParams }: PageProps) {
  // D7 · flag-off path · preserve previous server-side redirect
  // behaviour so bookmarks, PWA start_url and internal links keep
  // working without any client-side regression.
  if (!NEX_CONTACTS_V2_ENABLED) {
    redirect("/nex-native/chat?tab=friends");
  }

  // Owner directive 2026-10-26 · dev persona impersonation · when
  // NEX_DEV_IMPERSONATE_HANDLE is set in .env.local, Hendra (or
  // whichever handle) appears as the signed-in user across contacts
  // + side drawer. Falls through to real session otherwise.
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in");
  }

  // Track B · owner-authorised 2026-10-20 · one-shot shop auto-open.
  // Read the short-lived `nex_shop_auto_open_eligible` cookie that
  // `saveBusinessActivationAction` writes on successful activation
  // (300s TTL). If present AND valid, redirect ONCE to the owner's
  // newly-activated shop at /nex-native/<slug>. The clear MUST run
  // BEFORE the redirect call because `redirect()` throws · the two
  // operations live in independent try/catch blocks so a clear
  // failure cannot block the redirect intent.
  //
  // This block does NOT touch nex_welcome_intent / nex_welcome_vertical
  // or their sealed Phase A1 clearing discipline. Does NOT auto-open
  // the FocusedShopSheet (that is a customer-chat primitive). The
  // owner lands on their own public shop page where the owner-only
  // Add Listing CTA (Track A · same cycle) is already visible.
  {
    let autoOpenSlug: string | null = null;
    try {
      const { readShopAutoOpenEligible } = await import(
        "@/app/nex-native/_shop-auto-open-cookie"
      );
      autoOpenSlug = await readShopAutoOpenEligible();
    } catch (readErr) {
      // eslint-disable-next-line no-console
      console.warn(
        "contacts · nex_shop_auto_open_eligible read soft-fail:",
        readErr,
      );
    }
    if (autoOpenSlug !== null) {
      try {
        const { clearShopAutoOpenEligible } = await import(
          "@/app/nex-native/_shop-auto-open-cookie"
        );
        await clearShopAutoOpenEligible();
      } catch (clearErr) {
        // eslint-disable-next-line no-console
        console.warn(
          "contacts · nex_shop_auto_open_eligible clear soft-fail:",
          clearErr,
        );
      }
      redirect(`/nex-native/${autoOpenSlug}`);
    }
  }

  const sp = await searchParams;
  const requestedTab = (sp.tab ?? "all") as string;
  const activeFilter: ContactsFilter = isValidFilter(requestedTab) ? requestedTab : "all";

  // Safeguard #1 · contact data contract.
  // friend-service.listFriends() returns NexUuid[] of accepted-edge
  // partner ids · we hydrate explicitly via account-service rather
  // than inheriting data from a business-conversation side-effect.
  //
  // P0 engineering pass 2026-11-03 · each data source is now
  // independently fault-tolerant. A failure in friends must not blank
  // business contacts and vice versa. Per-source try/catch returns the
  // empty baseline on error · the UI then shows an honest empty
  // section rather than a 500. Errors are logged so they still surface
  // in server logs / Vercel runtime panels.
  let friendIds: Awaited<ReturnType<typeof friendService.listFriends>> = [];
  try {
    friendIds = await friendService.listFriends(session.account.id);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("contacts · friendService.listFriends failed:", err);
  }
  const friendAccountsSettled = await Promise.allSettled(
    friendIds.map((id) => accountService.getAccountById(id)),
  );
  const friendAccounts = friendAccountsSettled.map((r) =>
    r.status === "fulfilled" ? r.value : null,
  );

  // Business contacts · derive from conversation-service · dedup
  // by business_id so one business with multiple conversations
  // counts as one contact. side === "customer" means the viewer
  // is the shopper, so the business shows as the contact.
  let conversations: Awaited<
    ReturnType<typeof conversationService.listConversationsForAccount>
  > = [];
  try {
    conversations = await conversationService.listConversationsForAccount(
      session.account.id,
      { limit: 200 },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "contacts · conversationService.listConversationsForAccount failed:",
      err,
    );
  }
  const businessContactsByBusinessId = new Map<string, { name: string; slug: string | null; conversationId: string }>();
  for (const c of conversations) {
    if (c.my_side === "customer" && !businessContactsByBusinessId.has(c.business.id)) {
      businessContactsByBusinessId.set(c.business.id, {
        name: c.business.display_name,
        slug: c.business.slug ?? null,
        conversationId: c.conversation.id,
      });
    }
  }

  // Owner directive 2026-10-17 · identity-card layout · fetch
  // profession + headline for each friend in parallel. getProfileByAccountId
  // returns null when the account hasn't filled out a profile · we honour
  // that by leaving professionLine null (card omits the line entirely).
  //
  // P0 engineering pass 2026-11-03 · profile hydration already had
  // per-call `.catch(() => null)` · preserved as-is (one bad profile
  // doesn't drop the row).
  const liveFriendAccounts = friendAccounts.filter(
    (a): a is NonNullable<typeof a> => a !== null,
  );
  const friendProfiles = await Promise.all(
    liveFriendAccounts.map((a) =>
      accountProfileService.getProfileByAccountId(a.id).catch(() => null),
    ),
  );

  // Hydrate into the row-shape the UI consumes.
  const friendRows: ContactRowDisplay[] = liveFriendAccounts.map((a, i) => {
    const profile = friendProfiles[i];
    return {
      id: a.id,
      kind: "friend" as const,
      displayName: a.display_name ?? "friend",
      handle: a.nex_handle,
      // avatar_url lives on nex_account_profile (not nex_account). Phase 1
      // wiring complete 2026-10-28 · profile fetched in parallel above at
      // friendProfiles[i] · hand the real URL through; the UI falls back
      // to initials when null for accounts without a profile avatar.
      avatarUrl: profile?.avatar_url ?? null,
      chatHref: `/nex-native/chat/peer/${a.id}`,
      profileHref: a.nex_handle ? `/nex-native/u/${a.nex_handle}` : null,
      // Owner directive 2026-10-17 · "profession · headline" with
      // middle-dot · profession is required, headline optional ·
      // if profession is NULL/empty, the line is omitted entirely
      // (never fabricated).
      professionLine: buildProfessionLine(profile?.profession, profile?.headline),
    };
  });

  // Dev-only mock contacts · owner directive 2026-11-03 · "can i see
  // some mock contact cards on our new contacts page" · when running
  // outside production AND the signed-in user has no real friends,
  // seed the full 6-contact prototype mock dataset so the new tile-
  // grid design has populated rows to look at.
  //
  // NODE_ENV === "production" skips the injection entirely so real
  // users never see fabricated contacts.
  if (process.env.NODE_ENV !== "production" && friendRows.length === 0) {
    for (const mock of PROTOTYPE_MOCK_ROWS) {
      friendRows.push({ ...mock });
    }
  }

  // Owner directive 2026-11-03 · "online cards show first then busy
  // and offline last" · stable sort of rows by presence bucket.
  // Null-presence rows group at the end alongside offline. Within
  // each bucket the original order is preserved so the sort is
  // deterministic between renders.
  const presenceRank = (p: ContactRowDisplay["presence"] | null | undefined): number => {
    if (p === "online") return 0;
    if (p === "away") return 1;
    if (p === "offline") return 2;
    return 3;
  };
  friendRows.sort((a, b) => presenceRank(a.presence ?? null) - presenceRank(b.presence ?? null));

  const businessRows: ContactRowDisplay[] = Array.from(businessContactsByBusinessId.entries()).map(
    ([businessId, b]) => ({
      id: businessId,
      kind: "business" as const,
      displayName: b.name,
      handle: b.slug,
      avatarUrl: null,
      chatHref: `/nex-native/conversations/${b.conversationId}`,
      // Business rows don't have a profession · the identity-card
      // layout for businesses (category / city / etc.) is a future
      // pass, not this commit's scope.
      professionLine: null,
      profileHref: b.slug ? `/nex-native/${b.slug}` : null,
    }),
  );
  businessRows.sort((a, b) => presenceRank(a.presence ?? null) - presenceRank(b.presence ?? null));

  // D7 filter · All = merged + sorted by displayName
  // Friends = friends only · Business = businesses only
  // Dating + Groups are visually present but return empty rows (D5/D6)
  const allRows: ContactRowDisplay[] = [...friendRows, ...businessRows].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
  const visibleRows: ContactRowDisplay[] =
    activeFilter === "friends"
      ? friendRows
      : activeFilter === "business"
        ? businessRows
        : activeFilter === "dating" || activeFilter === "groups"
          ? []
          : allRows;

  const totalCount = allRows.length;
  const ownHandle = session.account.nex_handle ?? null;
  const inviteUrl = ownHandle
    ? `https://nex.app/nex-native/u/${ownHandle}` // production URL for share
    : "https://nex.app"; // honest fallback · never fabricate a handle

  // Owner directive 2026-11-03 (B+β · full build Supabase + fully
  // connected) · resolve the viewer's actual Community membership so
  // the Groups-tab card shows their REAL zone name (city-level only
  // per sealed 2026-10-23 security copy rule · no "2km" / no "nearby"
  // etc.). Fail-open: on error, the Community card renders its
  // "join your community" CTA state so the UI never crashes on a
  // transient service outage.
  let communityZoneName: string | null = null;
  let communityHasMembership = false;
  try {
    const membership = await getMembershipForAccount(session.account.id);
    if (membership) {
      communityHasMembership = true;
      // Prefer the district zone name (city-level · owner-safe) over
      // the hyperlocal zone (kecamatan-level · could over-expose).
      const districtZone = await getZoneById(membership.district_zone_id);
      communityZoneName = districtZone?.name ?? null;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("contacts · community membership read failed · falling back to CTA state:", err);
  }

  // Owner directive 2026-10-17 · ControlDrawer session · same shape
  // mounted on Welcome + /directory/landing · drawer renders the NEX
  // handle in header-size cyan + the "Sign in" prompt when null.
  const drawerSession: ControlDrawerSession = {
    displayName: session.account.display_name,
    nexHandle: session.account.nex_handle,
    isBisnis: effectiveTier(session.account) === "bisnis",
  };

  // Owner directive 2026-11-01 · Batch D+ Creator-Support auto-gate.
  // Resolved in parallel · both fail-open to their safe defaults
  // (empty-badges / null-settings) so a resolver outage falls through
  // to the drawer's LEGACY always-visible row rather than silently
  // disappearing. Contacts is NOT a /chat/* conversation surface, so
  // `hideCreatorSupportRow` stays false (default) here.
  const [viewerCreatorBadges, viewerCreatorSupportSettings] = await Promise.all([
    resolveCreatorBadges(session.account.id).catch(() => EMPTY_EARNED_BADGES),
    getCreatorSupportSettings(session.account.id).catch(() => null),
  ]);

  // Owner directive 2026-11-03 (revised) · structural rework ·
  //   1. Top row = THREE fixed category buttons · Friends · Groups ·
  //      Business · equal width · no horizontal scroll · no Socials pill
  //      in this row (Socials functionality + its own route stay intact
  //      elsewhere, intentionally not surfaced here).
  //   2. Row 2 = ONE full-width WhatsApp invite card (no Connect row,
  //      no duplicate invite buttons).
  //   3. Section label + contact list underneath.
  // P1 engineering pass 2026-11-03 · Groups uses `countLabel` instead
  // of a numeric count so we can honestly surface "Soon" without
  // misleading the user with "0". Friends/Business still render their
  // real integer total; Groups renders the string literal and keeps
  // the pill chrome so the three buttons remain visually balanced.
  const categoryButtons: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly countLabel: string;
    readonly active: boolean;
    readonly href: string;
    readonly icon: React.ReactNode;
  }> = [
    {
      id: "friends",
      label: "Friends",
      countLabel: String(friendRows.length),
      active: activeFilter === "friends",
      href: "/nex-native/contacts?tab=friends",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: "groups",
      label: "Groups",
      // Owner directive 2026-11-03 · "groups is not soon". Each account
      // belongs to exactly one Community zone at a time (address-anchored
      // membership · migration 146 nex_community_membership). Count = 1
      // once the user has set their location in the profile zone picker.
      // Pre-location state is "—" (not "0", not "Soon") · honest absence.
      countLabel: "1",
      active: activeFilter === "groups",
      href: "/nex-native/contacts?tab=groups",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 2 2 7l10 5 10-5-10-5Z" />
          <path d="m2 17 10 5 10-5" />
          <path d="m2 12 10 5 10-5" />
        </svg>
      ),
    },
    {
      id: "business",
      label: "Business",
      countLabel: String(businessRows.length),
      active: activeFilter === "business",
      href: "/nex-native/contacts?tab=business",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 7h18l-1.5 11a2 2 0 0 1-2 1.75H6.5a2 2 0 0 1-2-1.75L3 7Z" />
          <path d="M8 7V5a4 4 0 0 1 8 0v2" />
        </svg>
      ),
    },
  ];

  // WhatsApp invitation · uses the viewer's own NEX profile URL
  // computed above (`inviteUrl`) · falls back to the honest `https://
  // nex.app` root when the viewer has no handle. Deep-link uses the
  // universal `https://wa.me/?text=…` scheme so the OS opens whichever
  // WhatsApp install is present (mobile app · desktop · or web).
  //
  // Owner directive 2026-11-03 · "on groups page we don't need this
  // container Invite a friend · move the community group card into
  // that position". The invite card is HIDDEN on the Groups tab · the
  // Community Notice card takes its slot. Other tabs keep the invite.
  const inviteMessage = `Join me on NEX · ${inviteUrl}`;
  const whatsappShareHref = `https://wa.me/?text=${encodeURIComponent(inviteMessage)}`;
  const showInviteCard = activeFilter !== "groups";


  const sectionLabel =
    activeFilter === "business"
      ? `Business · ${businessRows.length}`
      : activeFilter === "groups"
        ? "" // owner directive 2026-11-03 · "groups is not soon" · Community card above IS the Groups surface · no secondary label needed
        : activeFilter === "dating"
          ? "Dating · Soon"
          : activeFilter === "all"
            ? `All · ${allRows.length}`
            : `Friends · ${friendRows.length}`;

  const IRISH_GOLD = "#C6A15B";

  return (
    <ContactsShell>
      {/* Owner directive 2026-11-03 · "another green that is not same as
          page background green ... so user can see the contact cards
          but we still have that rim color" · card body switches from
          Gold → Forest green (`--nex-world-primary` · lighter and
          distinct from the Emerald page bg) · the Gold rim passed
          through the sealed `accentHex` prop stays (we no longer
          override border-color) · text colours lift to Orange (name)
          and Sage (secondary) for contrast on the Forest body. */}
      <style>{`
        [data-nex-contacts-root] [data-nex-contacts-row] {
          background: var(--nex-world-primary, #1B5138) !important;
        }
        [data-nex-contacts-root] [data-nex-contacts-row-name] {
          color: #F5A623 !important;
        }
        [data-nex-contacts-root] [data-nex-contacts-row-profession],
        [data-nex-contacts-root] [data-nex-contacts-row-location],
        [data-nex-contacts-root] [data-nex-contacts-row-last-online] {
          color: var(--nex-world-primary-ink, #AFC5B5) !important;
          opacity: 0.9;
        }
      `}</style>

      {/* Owner directive 2026-11-03 · "remove the text from header
          NEX and remove the green header back ground and line" ·
          header is now a transparent icon strip · no title text, no
          Emerald background, no gold border-bottom · just the shamrock
          glyph on the left and the Search/Add icons on the right. */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "calc(env(safe-area-inset-top, 0) + 16px) 16px 14px",
          background: "transparent",
          color: "var(--nex-world-primary-ink, #AFC5B5)",
          borderBottom: "none",
          margin: "calc(0px - env(safe-area-inset-top, 0) - 28px) -14px 10px",
        }}
      >
        {/* Owner directive 2026-11-03 · "shamrock in header enlarge
            and header text enlarge and buttons" · shamrock 20 → 28 ·
            title 17 → 22 · buttons stay in their own components
            with their own enlarged sizes. */}
        <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden>
          ☘️
        </span>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "0.03em",
            color: "var(--nex-world-primary-ink, #AFC5B5)",
            flex: 1,
          }}
        >
          Contacts
        </h1>
        {/* Owner directive 2026-11-03 · "little ireland map icon in
            header · when they select the little ireland map icon it
            opens cover page with search field for area with auto
            suggest field". Gold-circle Ireland-map silhouette →
            /nex-native/community/discover. Sits alongside the sealed
            grid-icon (live worlds) and + drawer. */}
        <Link
          href="/nex-native/community/discover"
          aria-label="Discover Ireland communities"
          data-nex-contacts-ireland-map
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "var(--nex-world-secondary, #C6A15B)",
            color: "var(--nex-world-drawer-bg, #123D2B)",
            border: "none",
            textDecoration: "none",
            flexShrink: 0,
            marginRight: 8,
          }}
        >
          {/* Minimal Ireland-shape SVG · recognisable silhouette · stroke
              matches the Gold-on-Emerald palette already in play on the
              other header buttons. */}
          <svg
            aria-hidden
            width="22"
            height="22"
            viewBox="0 0 32 32"
            fill="currentColor"
          >
            {/* Simplified Ireland-island path · west coast indentations
                left, east coast smoother right · 32x32 bounding box. */}
            <path d="M11.5 3.8c1.1-0.6 2.3-0.9 3.5-1 1.3-0.1 2.6 0.1 3.8 0.6 1 0.4 1.9 1 2.6 1.8l1.6 2 1.5 1.4c1 0.8 1.8 1.9 2.4 3 0.5 1 0.9 2 1 3.1 0.1 1.1 0 2.2-0.3 3.3l-0.8 2.6c-0.4 1.4-1.2 2.7-2.3 3.7l-2 1.8c-0.7 0.6-1.4 1.2-2.3 1.6-1 0.5-2.1 0.7-3.2 0.8l-2.9 0.3c-1.5 0.1-2.9-0.2-4.3-0.8l-2.1-1-2-0.7c-1.1-0.4-2.1-1-3-1.8-0.8-0.8-1.4-1.7-1.9-2.7-0.4-0.9-0.6-1.8-0.6-2.8l0.1-2.5c0-1.3 0.3-2.6 0.9-3.8l1.2-2.4c0.5-1 1.1-1.8 1.9-2.5l2.1-1.9c0.9-0.8 2-1.4 3.1-1.8 0.3-0.1 0.6-0.2 1-0.3Z"/>
          </svg>
        </Link>
        <ContactsLiveWorldTrigger />
        <ContactsPlusDrawer />
      </header>

      {/* ===== ROW 1 · THREE FIXED CATEGORY BUTTONS =====
            Owner directive 2026-11-03 (revised) · three equal-width
            buttons · Friends · Groups · Business · fit mobile viewport
            without horizontal scroll · active = Gold with Emerald rim ·
            inactive = Forest green with Gold rim · icon above label +
            count. Socials intentionally NOT rendered here (its
            functionality + route remain intact elsewhere). */}
      <nav
        aria-label="Contact categories"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 8,
          width: "100%",
        }}
      >
        {categoryButtons.map((btn) => {
          const bg = btn.active
            ? "var(--nex-world-secondary, #C6A15B)"
            : "var(--nex-world-primary, #1B5138)";
          const fg = btn.active
            ? "var(--nex-world-drawer-bg, #123D2B)"
            : "var(--nex-world-primary-ink, #AFC5B5)";
          const countBg = btn.active
            ? "rgba(18, 61, 43, 0.18)"
            : "rgba(198, 161, 91, 0.22)";
          const countFg = btn.active
            ? "var(--nex-world-drawer-bg, #123D2B)"
            : "var(--nex-world-secondary, #C6A15B)";
          return (
            <Link
              key={btn.id}
              href={btn.href}
              aria-label={`Filter by ${btn.label}`}
              aria-current={btn.active ? "page" : undefined}
              style={{
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "14px 6px",
                minHeight: 92,
                borderRadius: 14,
                background: bg,
                color: fg,
                border: btn.active
                  ? "2.5px solid var(--nex-world-drawer-bg, #123D2B)"
                  : "1.5px solid var(--nex-world-secondary, #C6A15B)",
                boxShadow: btn.active
                  ? "0 6px 18px rgba(10, 31, 21, 0.35)"
                  : "0 2px 6px rgba(10, 31, 21, 0.18)",
                textDecoration: "none",
                fontFamily: "inherit",
                textAlign: "center",
                minWidth: 0,
              }}
            >
              <span aria-hidden style={{ lineHeight: 0 }}>
                {btn.icon}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: btn.active ? 800 : 700,
                  letterSpacing: "0.02em",
                  lineHeight: 1,
                }}
              >
                {btn.label}
              </span>
              <span
                aria-hidden
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 24,
                  height: 20,
                  padding: "0 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  background: countBg,
                  color: countFg,
                }}
              >
                {btn.countLabel}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ===== ROW 2 (Groups tab) · Community Notice card in the invite slot ===
            Owner directive 2026-11-03 · "on groups page we don't need
            this container Invite a friend · move the community group
            card into that position". The Community Notice card takes
            the WhatsApp invite card's slot when the Groups tab is
            active. All sealed rules + ContactRow-family styling
            preserved by the component itself. */}
      {activeFilter === "groups" ? (
        <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 8 }}>
          <CommunityNoticeCard
            zoneName={communityZoneName}
            hasMembership={communityHasMembership}
          />
          {/* Owner directive 2026-11-03 · "a nex user should be able
              to add another nex contact to the community". Entry
              point sits directly beneath the Community card so the
              adder can see the group and the add-action together.
              Only rendered when the viewer has an active membership. */}
          {communityHasMembership ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Link
                href="/nex-native/community/add-contact"
                aria-label="Add a NEX contact to this community"
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "transparent",
                  border: "1.5px solid var(--nex-world-secondary, #C6A15B)",
                  color: "var(--nex-world-secondary, #C6A15B)",
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: 800,
                  textAlign: "center",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                + Add contact
              </Link>
              <Link
                href="/nex-native/community/discover"
                aria-label="Discover more Ireland communities"
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "transparent",
                  border: "1.5px solid var(--nex-world-primary-ink, #AFC5B5)",
                  color: "var(--nex-world-primary-ink, #AFC5B5)",
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: 800,
                  textAlign: "center",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Discover
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ===== ROW 2 (other tabs) · WHATSAPP INVITATION CARD =====
            Owner directive 2026-11-03 (approved intended design) · one
            wide landscape card beneath the three category buttons ·
            WhatsApp brand icon (left) + "INVITE A FRIEND" heading +
            supporting line + chevron right · opens WhatsApp with the
            viewer's own NEX profile URL pre-filled via the universal
            wa.me scheme (mobile app · desktop · or web — OS resolves).
            `target="_blank" rel="noopener noreferrer"` so WhatsApp opens
            without unmounting the Contacts page.
            Hidden on the Groups tab (see owner directive above · the
            Community Notice card above takes this slot). */}
      {showInviteCard ? (
      <a
        href={whatsappShareHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Invite a friend to NEX using WhatsApp"
        style={{
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 18px",
          borderRadius: 16,
          background: "var(--nex-world-secondary, #C6A15B)",
          color: "var(--nex-world-drawer-bg, #123D2B)",
          border: "2px solid var(--nex-world-drawer-bg, #123D2B)",
          boxShadow: "0 6px 20px rgba(10, 31, 21, 0.35)",
          textDecoration: "none",
          marginTop: 4,
        }}
      >
        {/* WhatsApp brand mark · official green #25D366 · white glyph */}
        <span
          aria-hidden
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#25D366",
            color: "#FFFFFF",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            boxShadow: "0 2px 6px rgba(10, 31, 21, 0.25)",
          }}
        >
          <svg viewBox="0 0 32 32" width="26" height="26" fill="currentColor" aria-hidden>
            <path d="M16.004 3C8.82 3 3 8.82 3 16a12.9 12.9 0 0 0 1.87 6.713L3 29l6.49-1.838A12.95 12.95 0 0 0 16.004 29C23.18 29 29 23.177 29 16c0-7.18-5.82-13-12.996-13Zm0 23.68a10.68 10.68 0 0 1-5.646-1.616l-.405-.247-3.853 1.09 1.07-3.75-.265-.42A10.65 10.65 0 1 1 16.004 26.68Zm6.168-7.979c-.336-.168-1.99-.98-2.299-1.09-.308-.113-.533-.168-.758.168-.224.336-.868 1.09-1.065 1.316-.197.224-.392.253-.728.084-.336-.168-1.418-.52-2.7-1.66-.996-.887-1.668-1.982-1.864-2.318-.197-.336-.021-.517.147-.685.15-.148.336-.392.504-.588.168-.197.224-.336.336-.56.113-.224.056-.42-.028-.588-.084-.168-.758-1.828-1.038-2.503-.274-.657-.552-.57-.76-.58l-.645-.012c-.224 0-.588.084-.896.42-.308.336-1.176 1.148-1.176 2.8s1.204 3.247 1.372 3.471c.168.224 2.37 3.619 5.74 5.077.802.347 1.428.555 1.916.71.804.254 1.536.218 2.115.133.645-.096 1.99-.812 2.272-1.597.28-.785.28-1.456.197-1.597-.084-.14-.308-.224-.645-.392Z"/>
          </svg>
        </span>

        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1.1 }}>
            Invite a friend
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.78, lineHeight: 1.3 }}>
            Invite someone to NEX using WhatsApp.
          </span>
        </div>

        <span
          aria-hidden
          style={{
            fontSize: 24,
            lineHeight: 1,
            fontWeight: 900,
            flexShrink: 0,
          }}
        >
          ›
        </span>
      </a>
      ) : null}

      {/* ===== Section Label ·  Owner directive 2026-11-03 · "the
            friends text enlarge and move down little" · fontSize 11 →
            16 · marginTop 12 adds breathing room below the tile grid. ===== */}
      {sectionLabel ? (
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--nex-world-primary-ink, #AFC5B5)",
            opacity: 0.95,
            padding: "0 4px",
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--nex-world-secondary, #C6A15B)",
            }}
          />
          {sectionLabel}
        </div>
      ) : null}

      {/* ===== Groups tab · (duplicate Community card block REMOVED) =====
            Owner directive 2026-11-03 · "on groups page we don't need
            this container Invite a friend · move the community group
            card into that position" + "groups is not soon". The
            Community card now renders in the ROW 2 slot above (where
            the WhatsApp invite card lives on other tabs). The
            "coming soon" footer that previously sat here is retired. */}

      {/* ===== Contact rows · sealed component · Gold applied via scoped
            CSS override above =====
            P1 engineering pass 2026-11-03 · Dating renders honest
            "coming soon" copy. All other filters keep the one-line
            empty-state copy. Groups is handled by the dedicated
            Community-card block above. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visibleRows.length === 0 && activeFilter !== "groups" ? (
          <div
            style={{
              padding: "32px 14px",
              textAlign: "center",
              color: "var(--nex-world-primary-ink, #AFC5B5)",
              opacity: 0.85,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {activeFilter === "dating" ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                  Dating is on the way.
                </div>
                <div style={{ opacity: 0.75 }}>
                  We'll surface Dating here once it's ready.
                </div>
              </>
            ) : (
              `No ${activeFilter === "all" ? "contacts" : activeFilter} yet.`
            )}
          </div>
        ) : (
          visibleRows.map((row: ContactRowDisplay) => (
            <ContactRow key={row.id} row={row} accentHex={IRISH_GOLD} />
          ))
        )}
      </div>
    </ContactsShell>
  );
}

const VALID_FILTERS: ReadonlyArray<ContactsFilter> = [
  "all",
  "friends",
  "business",
  "dating",
  "groups",
] as const;

function isValidFilter(v: string): v is ContactsFilter {
  return (VALID_FILTERS as ReadonlyArray<string>).includes(v);
}

/**
 * Compose the "profession · headline" line under the NEX ID per the
 * owner's identity-card spec sealed 2026-10-17. Rules:
 *   · If profession is NULL/blank → the line is omitted entirely
 *     (callers get null · the row never shows an empty placeholder
 *     or a fabricated profession).
 *   · If profession is present and headline is NULL/blank → just
 *     profession (no trailing middle-dot).
 *   · If both are present → "profession · headline" with the NEX
 *     middle-dot separator (same glyph used elsewhere in nex-native).
 */
function buildProfessionLine(
  profession: string | null | undefined,
  headline: string | null | undefined,
): string | null {
  const p = (profession ?? "").trim();
  if (p.length === 0) return null;
  const h = (headline ?? "").trim();
  if (h.length === 0) return p;
  return `${p} · ${h}`;
}
