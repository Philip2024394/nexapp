// src/app/nex-native/contacts/_contacts-sub-filter-pills.tsx
//
// NEX Contacts · sub-filter pills · owner directive 2026-11-13.
// -----------------------------------------------------------------------
// Three-pill row beneath the invite banner · narrows the current
// category tab (Friends / Groups / Business) by relationship state:
//
//   All         · everything in the current tab (default)
//   Active      · online presence OR exchanged a message within 7 days
//   Favourites  · pinned contacts (requires `nex_friend_link.is_favourite`)
//
// URL-driven · the `sub` query string param is the single source of
// truth so tabs are bookmarkable and server-rendered. Default "all"
// when the param is missing or unknown. Pairs with the top-level
// category buttons (?tab=friends/groups/business).
//
// Favourites-column migration · NOT YET APPLIED. The pill is visible
// and tappable today; the filter returns an empty set with an honest
// empty-state note on the list ("No favourites yet · tap the star on
// any contact to pin them here"). Once the migration + star button
// land, the pill becomes fully functional with no UI change here.

import Link from "next/link";

export type ContactsSubFilter = "all" | "active" | "favourites";

export const CONTACTS_SUB_FILTERS: ReadonlyArray<ContactsSubFilter> = [
  "all",
  "active",
  "favourites",
];

export function isValidSubFilter(
  value: unknown,
): value is ContactsSubFilter {
  return (
    value === "all" || value === "active" || value === "favourites"
  );
}

/** Build a URL that preserves the current ?tab= value and sets ?sub=.
 *  Omits `sub=all` from the URL so the default state has a clean
 *  bookmarkable URL. */
export function subFilterHref(
  tab: string | null,
  sub: ContactsSubFilter,
): string {
  const parts: string[] = [];
  if (tab && tab !== "all") parts.push(`tab=${encodeURIComponent(tab)}`);
  if (sub !== "all") parts.push(`sub=${encodeURIComponent(sub)}`);
  return parts.length === 0
    ? "/nex-native/contacts"
    : `/nex-native/contacts?${parts.join("&")}`;
}

interface ContactsSubFilterPillsProps {
  readonly activeTab: string;
  readonly activeSub: ContactsSubFilter;
  /** Count of rows that would render in each sub-filter · lets the
   *  pills show "(3)" style counters so the user sees which pills
   *  have content before tapping. */
  readonly counts: Readonly<Record<ContactsSubFilter, number>>;
}

export function ContactsSubFilterPills({
  activeTab,
  activeSub,
  counts,
}: ContactsSubFilterPillsProps) {
  const PILLS: ReadonlyArray<{
    readonly value: ContactsSubFilter;
    readonly label: string;
    readonly icon: string;
  }> = [
    { value: "all", label: "All", icon: "·" },
    { value: "active", label: "Active", icon: "●" },
    { value: "favourites", label: "Favourites", icon: "★" },
  ];

  return (
    <nav
      aria-label="Filter contacts by state"
      data-nex-contacts-sub-filter-pills
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "nowrap",
        width: "100%",
        marginTop: 2,
      }}
    >
      {PILLS.map((pill) => {
        const active = pill.value === activeSub;
        const count = counts[pill.value];
        return (
          <Link
            key={pill.value}
            href={subFilterHref(activeTab, pill.value)}
            prefetch={false}
            aria-pressed={active}
            data-nex-contacts-sub-pill={pill.value}
            data-nex-contacts-sub-pill-active={active ? "true" : "false"}
            style={{
              flex: 1,
              minWidth: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 10px",
              borderRadius: 999,
              background: active
                ? "var(--nex-world-primary-ink, #2A1F0F)"
                : "#FFFFFF",
              color: active
                ? "var(--nex-world-background-base, #F5EDD3)"
                : "var(--nex-world-primary-ink, #2A1F0F)",
              border: `1px solid ${
                active
                  ? "var(--nex-world-primary-ink, #2A1F0F)"
                  : "rgba(42, 31, 15, 0.22)"
              }`,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.02em",
              textDecoration: "none",
              whiteSpace: "nowrap",
              boxShadow: active
                ? "0 2px 6px rgba(42, 31, 15, 0.22)"
                : "0 1px 2px rgba(42, 31, 15, 0.08)",
            }}
          >
            <span
              aria-hidden
              style={{
                fontSize: pill.value === "favourites" ? 11 : 9,
                lineHeight: 1,
                color: active
                  ? "var(--nex-world-background-base, #F5EDD3)"
                  : pill.value === "active"
                    ? "#16D66B"
                    : pill.value === "favourites"
                      ? "#C6A15B"
                      : "rgba(42, 31, 15, 0.5)",
              }}
            >
              {pill.icon}
            </span>
            <span>{pill.label}</span>
            <span
              aria-hidden
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 20,
                height: 16,
                padding: "0 5px",
                borderRadius: 999,
                background: active
                  ? "var(--nex-world-background-base, #F5EDD3)"
                  : "rgba(42, 31, 15, 0.08)",
                color: active
                  ? "var(--nex-world-primary-ink, #2A1F0F)"
                  : "rgba(42, 31, 15, 0.7)",
                fontSize: 10,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              {count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
