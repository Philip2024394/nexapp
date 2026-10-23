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
import { CommunityCard } from "./_community-card";
import { GroupCard } from "./_group-card";
import { MOCK_GROUPS } from "./_mock-groups";
import { CONTACTS_SEARCH_EVENT } from "./_contacts-search-bar";
import type { ContactsFilter } from "./_contacts-filter-pills";

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
}

const NEX = {
  cyan: "#00AFFF",
  textPrimary: "#F2F5F8",
  textMuted: "#7D9BC0",
};

interface ContactsListProps {
  readonly rows: ReadonlyArray<ContactRowDisplay>;
  readonly totalCount: number;
  readonly activeFilter: ContactsFilter;
}

export function ContactsList({ rows, totalCount, activeFilter }: ContactsListProps) {
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    function onSearch(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      setQuery(typeof detail === "string" ? detail : "");
    }
    window.addEventListener(CONTACTS_SEARCH_EVENT, onSearch);
    return () => window.removeEventListener(CONTACTS_SEARCH_EVENT, onSearch);
  }, []);

  const filtered = React.useMemo(() => {
    if (query.trim().length === 0) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => r.displayName.toLowerCase().includes(q));
  }, [rows, query]);

  const sectionLabel = sectionLabelForFilter(activeFilter);

  return (
    <section
      data-nex-contacts-list-section
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 2px",
        }}
      >
        <PeopleIcon color={NEX.cyan} />
        <h2
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: NEX.textPrimary,
            flex: 1,
            minWidth: 0,
          }}
        >
          {sectionLabel}
        </h2>
        {rows.length > 0 ? (
          <span
            data-nex-contacts-list-count
            style={{
              fontSize: 12,
              color: NEX.textMuted,
            }}
          >
            {filtered.length === rows.length
              ? `${rows.length} ${rows.length === 1 ? "contact" : "contacts"}`
              : `${filtered.length} of ${rows.length}`}
          </span>
        ) : null}
      </header>

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
        <GroupsPlaceholderGrid />
      ) : totalCount === 0 ? (
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
          style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}
        >
          {filtered.map((row) => (
            <li key={`${row.kind}:${row.id}`} style={{ margin: 0, padding: 0 }}>
              <ContactRow row={row} />
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

function GroupsPlaceholderGrid() {
  return (
    <div
      data-nex-contacts-groups-grid
      style={{ display: "grid", gap: 10 }}
    >
      {/* Owner directive 2026-10-23 · "same for community group" ·
          NEX Community now renders via the shared GroupCard chrome
          with orange accent · uses the live /community route. */}
      <CommunityCard />
      {/* Owner directive 2026-10-23 · "same card design for groups
          but for groups the card will show small profile images
          round and total members in group last circle with count ·
          under the group location". MOCK_GROUPS (4 mock entries ·
          swap for a real group-service call when nex_group schema
          lands). */}
      {MOCK_GROUPS.map((group) => (
        <GroupCard key={group.id} group={group} />
      ))}
    </div>
  );
}

function PeopleIcon({ color }: { readonly color: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
