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
// Contacts intentionally does NOT wrap in `NexNativeShell` (and
// therefore not in `NexHudFrame`). The HUD renders a floating
// "NEX · ready" console-viewport button that the owner called out
// as a "floating orb" above the Contacts content. The Contacts
// surface is a dedicated hub with its own identity-forward layout
// via `ContactsShell` · it does not need the HUD chrome.
import { NEX_CONTACTS_V2_ENABLED } from "@/lib/nex-native/launch-flags";
import { ContactsShell } from "./_contacts-shell";
import { ContactsHeader } from "./_contacts-header";
import { ContactsSearchBar } from "./_contacts-search-bar";
import { ContactsFilterPills, type ContactsFilter } from "./_contacts-filter-pills";
// Owner directive 2026-10-17 (revised later same day) · the Invite
// Friends banner card is restored to the top of /contacts. The NEX
// Community card has been moved INSIDE the Groups filter tab (under
// the Groups button) · see `_contacts-list.tsx` → GroupsPlaceholderGrid.
import { InviteFriendsCard } from "./_invite-friends-card";
// Owner directive 2026-10-17 · the stand-alone My Groups card is
// retired · the Groups filter pill in the header is the sole entry
// point for the Groups surface. `_my-groups-card.tsx` is kept on
// disk for history but has no live consumer.
import { ContactsList, type ContactRowDisplay } from "./_contacts-list";
// Owner-authorised 2026-10-18 · S4 · minimal NEX1 welcome banner.
// Rendered above the sealed InviteFriendsCard · uses the sealed
// first-contact predicate, dismissible without touching the
// underlying conversation. Zero changes to the sealed D9
// friend/business contacts list.
import { Nex1WelcomeBanner } from "./_nex1-welcome-banner";

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

  const session = await resolveNexAppSessionFromContext();
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
  const friendIds = await friendService.listFriends(session.account.id);
  const friendAccounts = await Promise.all(
    friendIds.map((id) => accountService.getAccountById(id)),
  );

  // Business contacts · derive from conversation-service · dedup
  // by business_id so one business with multiple conversations
  // counts as one contact. side === "customer" means the viewer
  // is the shopper, so the business shows as the contact.
  const conversations = await conversationService.listConversationsForAccount(
    session.account.id,
    { limit: 200 },
  );
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
      // avatar_url lives on nex_account_profile (not nex_account) · Phase 1
      // falls back to initials for every row · profile-service wiring deferred.
      avatarUrl: null,
      chatHref: `/nex-native/chat/peer/${a.id}`,
      profileHref: a.nex_handle ? `/nex-native/u/${a.nex_handle}` : null,
      // Owner directive 2026-10-17 · "profession · headline" with
      // middle-dot · profession is required, headline optional ·
      // if profession is NULL/empty, the line is omitted entirely
      // (never fabricated).
      professionLine: buildProfessionLine(profile?.profession, profile?.headline),
    };
  });

  // Dev-only mock contact · owner directive 2026-10-17 · "see 1 mock
  // contact seeded". Appears ONLY when:
  //   · NODE_ENV !== "production" (never in prod)
  //   · AND the current viewer has zero real friends (so we don't
  //     overlay a fake name on real data in dev with real friends)
  // The row carries data-nex-contacts-row-kind="friend-mock" so it
  // is visually indistinguishable from a real row but mock-greppable.
  if (process.env.NODE_ENV !== "production" && friendRows.length === 0) {
    friendRows.push({
      id: "00000000-0000-0000-0000-000000000mock",
      kind: "friend",
      displayName: "Daniel Carter",
      handle: "nex-00042",
      avatarUrl: null,
      chatHref: "/nex-native/chat/peer/00000000-0000-0000-0000-000000000mock",
      profileHref: "/nex-native/u/nex-00042",
      // Dev mock · matches the owner's spec example verbatim so the
      // identity-card layout can be visually verified in dev before
      // a real friend fills in their profile. Dev-only · prod is
      // gated by NODE_ENV !== "production" above.
      professionLine: "Electrician · Electrical Services",
    });
  }

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

  // Owner directive 2026-10-17 · ControlDrawer session · same shape
  // mounted on Welcome + /directory/landing · drawer renders the NEX
  // handle in header-size cyan + the "Sign in" prompt when null.
  const drawerSession: ControlDrawerSession = {
    displayName: session.account.display_name,
    nexHandle: session.account.nex_handle,
    isBisnis: effectiveTier(session.account) === "bisnis",
  };

  return (
    <ContactsShell>
      <ContactsHeader drawerSession={drawerSession} />
      <ContactsSearchBar />
      <ContactsFilterPills active={activeFilter} />
      {/* Owner-authorised 2026-10-18 · S4 · NEX1 welcome banner.
          Server-rendered · returns null when the sealed first-contact
          predicate says the user has already acted (replied), OR when
          the user dismissed the banner. Lives above the sealed
          InviteFriendsCard · never a synthetic contacts row. */}
      <Nex1WelcomeBanner
        accountId={session.account.id}
        firstName={
          session.account.display_name?.split(/\s+/)[0] ??
          session.account.display_name ??
          null
        }
      />
      <InviteFriendsCard inviteUrl={inviteUrl} ownHandle={ownHandle} />
      <ContactsList
        rows={visibleRows}
        totalCount={totalCount}
        activeFilter={activeFilter}
      />
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
