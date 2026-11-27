"use client";

// src/app/nex-native/contacts/_contacts-list.tsx
//
// "My Contacts" section · header + list of ContactRow.
// Client Component · subscribes to the CONTACTS_SEARCH_EVENT from
// the ContactsSearchBar + filters the already-rendered rows by
// case-insensitive display-name substring match.
//
// D5/D6 · Dating + Groups tabs show honest empty state (never
// fabricate rows). D8 · zero contacts shows "No contacts yet"
// empty state with next-action, never a fabricated count.

import * as React from "react";
import { ContactRow } from "./_contact-row";
// Owner directive 2026-10-23 · the sealed CommunityCard is retired
// in favour of the new client-side `CommunityNoticeCard` which
// carries the mute toggle + unread badge + conditional-tap behaviour
// per the full Community Notice doctrine. The old file stays on
// disk for history.
import { CommunityNoticeCard } from "./_community-notice-card";
import { MyPrivateGroupsList, MyPrivateGroupsBadge } from "./_my-private-groups-list";
import { OpenGroupsDiscovery } from "./_open-groups-discovery";
import {
  getCreateGroupFlipped,
  subscribeCreateGroupFlipped,
} from "./_create-group-flip-state";
import { GroupCard } from "./_group-card";
import { MOCK_GROUPS } from "./_mock-groups";
import { CONTACTS_SEARCH_EVENT } from "./_contacts-search-bar";
import type { ContactsFilter } from "./_contacts-filter-pills";
import {
  loadAccepted,
  MOCK_ACCEPTED_EVENT,
  type MockAcceptedContact,
} from "./_mock-accepted-contacts";

export interface ContactRowDisplay {
  readonly id: string;
  readonly kind: "friend" | "business";
  readonly displayName: string;
  readonly handle: string | null;
  readonly avatarUrl: string | null;
  readonly chatHref: string;
  readonly profileHref: string | null;
  /**
   * Owner-sealed 2026-10-17 identity-card line · composed from the
   * person's nex_account_profile (profession · headline). NULL when
   * the person hasn't filled in a profession yet · row omits the
   * line entirely in that case · never fabricated. Businesses carry
   * NULL today · a business-specific identity line is a future pass.
   */
  readonly professionLine: string | null;
  /**
   * Owner directive 2026-10-23 · "same cards on the contact slider"
   * — the picker-card features below are OPTIONAL enrichment data.
   * Rendered when present, honestly omitted when null. No fabrication
   * on real rows · the dev-only mock fills them to show the full card.
   */
  readonly presence?: "online" | "away" | "offline" | null;
  readonly lastSeenMinsAgo?: number | null;
  readonly hasShop?: boolean;
  readonly shopHref?: string | null;
  readonly isVerified?: boolean;
  readonly unreadCount?: number;
  readonly city?: string | null;
  readonly initials?: string | null;
  /** Owner-authored 2026-11-05 · when true, the row renders at the top
   *  of the list with a gold "Invited · waiting" chip · the chat href
   *  still works (lands on the peer's chat page which shows the welcome
   *  pill until they accept). */
  readonly pending?: boolean;
  /** Owner directive 2026-11-13 · dormant-nudge chip · when set, the
   *  row shows a quiet "Haven't spoken in Nd" chip so the viewer sees
   *  which relationships have gone quiet. NULL means either they're
   *  active (last message within 30 days) or there has never been a
   *  conversation (we don't label never-chatted contacts as dormant —
   *  it would be noisy for new friends). Computed server-side from
   *  nex_peer_conversation.last_message_at · reads only the timestamp,
   *  never the message body (respects the 2026-11-09 device-only E2E
   *  seal). */
  readonly dormantDays?: number | null;
}

const NEX = {
  cyan: "var(--nex-world-secondary, #00AFFF)",
  textPrimary: "#F2F5F8",
  textMuted: "#7D9BC0",
};

interface ContactsListProps {
  readonly rows: ReadonlyArray<ContactRowDisplay>;
  readonly totalCount: number;
  readonly activeFilter: ContactsFilter;
  /**
   * Owner directive 2026-10-23 · "follow the chat theme color from
   * home page chat screen" · resolved on the server from the
   * nex-free-chat-wallpaper cookie via resolveFreeChatAccentHex.
   * Defaults to NEX cyan (#00AFFF) when no theme is picked.
   */
  readonly accentHex: string;
  /**
   * Owner directive 2026-10-23 · viewer identity needed by the Groups
   * tab's mock Private-Groups surface (Create Group hero · initial
   * invitee · "my groups" filter). Passed through from the server page.
   */
  readonly viewerDisplayName: string;
  readonly viewerNexHandle: string;
}

export function ContactsList({ rows, totalCount, activeFilter, accentHex, viewerDisplayName, viewerNexHandle }: ContactsListProps) {
  // Owner directive 2026-10-23 · "when the create groups flip · clear
  // the groups cards and toggle from under the page" · hide the
  // whole contacts list while the Create Group hero is flipped so
  // the form has a clean workspace. Hooks MUST stay unconditional ·
  // we gate on `flipped` at the final JSX return, not before the
  // other hooks (rules of hooks).
  const [flipped, setFlipped] = React.useState<boolean>(getCreateGroupFlipped);
  React.useEffect(() => subscribeCreateGroupFlipped(setFlipped), []);
  const [query, setQuery] = React.useState("");

  // Owner directive 2026-10-23 · "i just saved 1 contact to business
  // but is not showing in the business page contacts" · ContactsList
  // now reads the client-side mock-accepted store on mount AND
  // listens for `nex-contacts-mock-accepted-changed` so a Confirm
  // from PendingInvitesSection flows straight into the list without
  // a reload. The store starts empty on both server and client, so
  // SSR output matches first-paint hydration byte-for-byte.
  const [acceptedContacts, setAcceptedContacts] =
    React.useState<ReadonlyArray<MockAcceptedContact>>([]);
  React.useEffect(() => {
    const sync = () => setAcceptedContacts(loadAccepted());
    sync();
    window.addEventListener(MOCK_ACCEPTED_EVENT, sync);
    return () => window.removeEventListener(MOCK_ACCEPTED_EVENT, sync);
  }, []);

  React.useEffect(() => {
    function onSearch(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      setQuery(typeof detail === "string" ? detail : "");
    }
    window.addEventListener(CONTACTS_SEARCH_EVENT, onSearch);
    return () => window.removeEventListener(CONTACTS_SEARCH_EVENT, onSearch);
  }, []);

  // Merge the server-provided rows with any client-accepted mock
  // contacts · acceptedContacts is tagged with its category · we
  // map it into ContactRowDisplay shape so the renderer treats them
  // identically. Mock rows pin to the top within their category so
  // the user sees their just-saved contact immediately.
  const mergedRows = React.useMemo<ReadonlyArray<ContactRowDisplay>>(() => {
    if (acceptedContacts.length === 0) return rows;
    const mapped: ContactRowDisplay[] = acceptedContacts.map((c) => ({
      id: c.id,
      kind: c.category === "business" ? "business" : "friend",
      displayName: c.displayName,
      handle: c.nexId,
      avatarUrl: c.avatarUrl,
      chatHref: `/chat/${c.nexId}`,
      profileHref: `/nex-native/u/${c.nexId}`,
      professionLine: c.profession ?? null,
      presence: null,
      lastSeenMinsAgo: null,
      hasShop: c.hasShop,
      shopHref: c.shopHref,
      isVerified: c.isVerified,
      unreadCount: 0,
      city: c.city,
      initials: c.initials,
    }));
    return [...mapped, ...rows];
  }, [rows, acceptedContacts]);

  const filtered = React.useMemo(() => {
    if (query.trim().length === 0) return mergedRows;
    const q = query.trim().toLowerCase();
    return mergedRows.filter((r) => r.displayName.toLowerCase().includes(q));
  }, [mergedRows, query]);

  // Owner directive 2026-10-23 · "remove ... my contacts text" ·
  // the section-label resolution + `sectionLabelForFilter()` helper
  // are retained below but no longer consumed · the <h2> that used
  // to render them was retired this pass. Keep for a one-line
  // restore if the section title ever comes back.


  // Owner directive 2026-10-23 · gate at the JSX return (NOT via
  // early-return before the hooks above) so the hook order stays
  // stable across renders. Rules of Hooks compliance.
  if (flipped) return null;

  return (
    <section
      data-nex-contacts-list-section
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      {/* Owner directive 2026-10-23 · spacing audit · the section
          header is only rendered when there's a count to show. On
          the Groups tab + Dating tab + zero-contacts empty state the
          count span was already hidden AND the right-anchored
          PeopleIcon was retired · an empty 8px block was adding
          dead space above the first content row. Skipping the
          <header> entirely closes that gap cleanly. */}
      {mergedRows.length > 0 ? (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 2px",
          }}
        >
          <span
            data-nex-contacts-list-count
            style={{
              fontSize: 12,
              color: NEX.textMuted,
            }}
          >
            {filtered.length === mergedRows.length
              ? `${mergedRows.length} ${mergedRows.length === 1 ? "contact" : "contacts"}`
              : `${filtered.length} of ${mergedRows.length}`}
          </span>
          <div style={{ flex: 1, minWidth: 0 }} />
        </header>
      ) : null}

      {/* Content branches · prioritise honest empty states (D5/D6/D8).
          Groups tab (owner directive 2026-10-17 · "show the groups
          cards") renders placeholder group cards + a Create flow,
          not a bare coming-soon message. Dating stays coming-soon
          per D6 · no dating schema exists yet. */}
      {activeFilter === "dating" ? (
        <EmptyState
          title="Dating is coming soon"
          body="Dating profiles, preferences and matching will launch in a future NEX update. Thanks for your patience."
          dataAttr="dating-coming-soon"
        />
      ) : activeFilter === "groups" ? (
        <GroupsPlaceholderGrid
          viewerDisplayName={viewerDisplayName}
          viewerNexHandle={viewerNexHandle}
        />
      ) : mergedRows.length === 0 && totalCount === 0 ? (
        <EmptyState
          title="No contacts yet"
          body="Add friends by their NEX handle or start a conversation with a business from NEX Discover."
          dataAttr="contacts-empty"
          cta={{ href: "/nex-native/friends", label: "Add a friend" }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No contacts match your search"
          body={`Nothing matched "${query.trim()}". Try a different name.`}
          dataAttr="contacts-search-empty"
        />
      ) : (
        <ul
          data-nex-contacts-list
          /* Owner directive 2026-10-23 · "why is the contacts cards
             touching each other - we need little space" · list gap
             8 → 16 so the overlapping chips on each card (top:-24)
             get clean breathing room between rows · matches the
             Waiting + Inbound sections' spacing rhythm.
             Owner directive 2026-10-24 · "business contacts cards
             are not fitting screen width" · `gridTemplateColumns:
             minmax(0, 1fr)` forces the single column to shrink to
             the container width · without it, grid items auto-size
             to content and can push past the mobile frame edge. */
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: 16,
            gridTemplateColumns: "minmax(0, 1fr)",
          }}
        >
          {filtered.map((row) => (
            <li key={`${row.kind}:${row.id}`} style={{ margin: 0, padding: 0 }}>
              <ContactRow row={row} accentHex={accentHex} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function sectionLabelForFilter(filter: ContactsFilter): string {
  switch (filter) {
    case "friends":
      return "Friends";
    case "business":
      return "Business contacts";
    case "dating":
      return "Dating";
    case "groups":
      return "Groups";
    case "all":
    default:
      return "My Contacts";
  }
}

interface EmptyStateProps {
  readonly title: string;
  readonly body: string;
  readonly dataAttr: string;
  readonly cta?: { readonly href: string; readonly label: string };
}

function EmptyState({ title, body, dataAttr, cta }: EmptyStateProps) {
  return (
    <div
      data-nex-contacts-empty-state={dataAttr}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 8,
        padding: "28px 20px",
        borderRadius: 14,
        background: "rgba(3, 16, 29, 0.72)",
        border: `1px dashed rgba(0, 175, 255, 0.30)`,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: NEX.textPrimary }}>{title}</div>
      <div style={{ fontSize: 12, lineHeight: 1.5, color: NEX.textMuted, maxWidth: 320 }}>{body}</div>
      {cta ? (
        <a
          href={cta.href}
          style={{
            marginTop: 6,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 36,
            padding: "0 16px",
            borderRadius: 999,
            background: "rgba(0, 175, 255, 0.14)",
            border: `1px solid rgba(0, 175, 255, 0.35)`,
            color: NEX.cyan,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {cta.label}
        </a>
      ) : null}
    </div>
  );
}

/* ─── Groups placeholder grid ────────────────────────────────────
   Owner directive 2026-10-17 · tapping the Groups filter pill
   routes to /contacts?tab=groups which renders this placeholder
   grid. The group schema does NOT exist yet (zero nex_group /
   nex_group_member tables), so this view shows:
     · The NEX Community entry card (owner directive 2026-10-17 ·
       "nex community is under the groups badge button") · links
       to the active /nex-native/community surface
     · The "Create your first group" CTA (groups schema pending)

   The three illustrative "preview" cards (Neighbours Yogyakarta,
   Weekend Coffee Club, Design Guild · NEX) were retired on
   2026-10-17 · they looked too much like real groups the user could
   enter, which was dishonest while the feature is not yet shipped. */

function GroupsPlaceholderGrid({
  viewerDisplayName,
  viewerNexHandle,
}: {
  readonly viewerDisplayName: string;
  readonly viewerNexHandle: string;
}) {
  return (
    <div
      data-nex-contacts-groups-grid
      /* Gap aligned to the contacts list (16) · overlapping chips on
         each GroupCard need the same breathing room between rows.
         `grid-template-columns: minmax(0, 1fr)` forces one full-width
         column · without it, each row defaults to auto-width based on
         content and GroupCard's `width: 100%` resolves to the auto
         column (narrower than the shell), causing visible fit-off. */
      style={{
        display: "grid",
        gap: 16,
        gridTemplateColumns: "minmax(0, 1fr)",
      }}
    >
      {/* Owner directive 2026-10-23 · "add search bar under the
          header over the banner with country round map on the
          outside at right side" · open-groups discovery UI · owns
          its own country + query state + Join handler. */}
      <OpenGroupsDiscovery
        viewerDisplayName={viewerDisplayName}
        viewerNexHandle={viewerNexHandle}
      />
      {/* Owner directive 2026-10-23 · "move up - my private group" ·
          count badge for viewer's own joined private groups. */}
      <MyPrivateGroupsBadge viewerNexHandle={viewerNexHandle} />
      {/* Owner directive 2026-10-23 · "community notice should be the
          first card on groups page always" · NEX Community sits
          above viewer's private groups + the illustrative mock groups.
          2026-11-27 · Founder scope-simplification seal · NEX launches
          with three pillars: Chat · Shop · Themes. Community is ON HOLD.
          The NEX Community notice card is suppressed from the contacts /
          groups tab. Underlying routes (`/nex-native/community/select`,
          `/notices/[id]`), migrations, DB tables, HQ admin surface, and
          the `CommunityNoticeCard` component itself are preserved. Delete
          the `false &&` guard to re-expose when Community launches. */}
      {false && <CommunityNoticeCard />}
      {/* Viewer's private groups · rendered as GroupCards. */}
      <MyPrivateGroupsList
        viewerDisplayName={viewerDisplayName}
        viewerNexHandle={viewerNexHandle}
      />
      {/* Illustrative mock groups kept for visual breadth. These are
          NOT in the viewer's groups store · they render regardless. */}
      {MOCK_GROUPS.map((group) => (
        <GroupCard key={group.id} group={group} />
      ))}
    </div>
  );
}

