"use client";

// src/app/nex-native/contacts/_contacts-filter-pills.tsx
//
// Horizontally-scrollable row of 5 filter pills · All · Friends ·
// Business · Dating · Groups. Owner directives:
//   · D6 · Dating pill visible but disabled (coming-soon state) ·
//          rendered as a <span>, not a <Link>, so it cannot be tapped
//   · D5 · Groups pill visible · routes to the Contacts page with
//          ?tab=groups which renders the empty-state honest card
//
// Active pill = cyan filled, white text (actually dark navy for
// contrast on cyan). Inactive = translucent navy + cyan border.
//
// Converted to Client Component 2026-10-23 so it can subscribe to
// the Create Group flip singleton and hide the toggle while the
// hero is showing the create form (owner directive · "clear the
// groups cards and toggle from under the page"). The filter state
// is still URL-driven and bookmarkable; only the chrome is hidden.

import * as React from "react";
import Link from "next/link";
import {
  getCreateGroupFlipped,
  subscribeCreateGroupFlipped,
} from "./_create-group-flip-state";

export type ContactsFilter = "all" | "friends" | "business" | "dating" | "groups";

const NEX = {
  cyan: "var(--nex-world-secondary, #00AFFF)",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  textPrimary: "#F2F5F8",
  textMuted: "#7D9BC0",
  panel: "rgba(3, 16, 29, 0.72)",
  bgDark: "var(--nex-world-background-base, #020914)",
};

interface FilterOption {
  readonly value: ContactsFilter;
  readonly label: string;
  readonly disabled?: boolean;
  readonly comingSoon?: boolean;
}

/** Owner directive 2026-10-23 · "update all" polish · each filter
 *  pill now carries a trailing count badge so users see at a glance
 *  which tabs are populated. Dating is omitted because the pill was
 *  retired on 2026-10-23 ("remove the date badge"). */
export interface ContactsFilterCounts {
  readonly friends: number;
  readonly business: number;
  readonly groups: number;
}

// Owner directive 2026-10-17 · "All" pill removed · default view
// (no ?tab param) shows merged contacts without a selected pill.
// Each pill filters to its specific category when tapped.
//
// Owner directive 2026-10-23 · pill LABELS updated · "Friends" →
// "Contacts" + "Dating" → "Date". Underlying filter VALUES stay the
// same (friends, dating) so the server-side tab resolution, data
// predicates and sealed URL params don't change · only the public
// labels on the pill chips swap.
//
// Owner directive 2026-10-23 · "remove the date badge" · the Date
// pill is retired from the filter row entirely · bringing it back
// is a one-line restore when the dating schema lands. The `dating`
// filter VALUE stays in the ContactsFilter union + server-side
// tab resolver (someone linking `?tab=dating` still resolves · just
// nothing in the UI exposes it right now).
const OPTIONS: ReadonlyArray<FilterOption> = [
  // Owner directive 2026-10-24 · "where is our contacts toggle gone
  // for contacts page" · the friends-pill label reverts to
  // "Contacts" now that Create Group has its own dedicated hero on
  // the Groups tab. Previously renamed to "Create Group" on
  // 2026-10-23 · reverted today because the duplicate "Create
  // Group" label (pill + Groups-tab hero) was confusing.
  { value: "friends", label: "Contacts" },
  { value: "business", label: "Business" },
  { value: "groups", label: "Groups" },
];

interface ContactsFilterPillsProps {
  readonly active: ContactsFilter;
  readonly counts: ContactsFilterCounts;
  /** Owner directive 2026-10-23 · "business contacts is not flipping
   *  when select the business badge" · the pill `<Link href>` must
   *  preserve the current query string (particularly `?dev=1` in
   *  dev) so the filter navigation doesn't drop the dev-bypass flag
   *  and bounce the viewer to /sign-in. Server resolves this once
   *  from the request and passes down. */
  readonly extraQuery?: Readonly<Record<string, string>>;
}

export function ContactsFilterPills({ active, extraQuery }: ContactsFilterPillsProps) {
  // Owner directive 2026-10-23 · hide the toggle while the Create
  // Group hero is flipped to show the form. Clean workspace.
  const [flipped, setFlipped] = React.useState<boolean>(getCreateGroupFlipped);
  React.useEffect(() => subscribeCreateGroupFlipped(setFlipped), []);
  if (flipped) return null;
  // Owner directive 2026-10-23 · "add toggle without badge and use
  // blue line under the highlighted" · the filter row is now a tab
  // bar · no count chip, no pill background, no border · the active
  // tab is marked by a 2px cyan underline + white text, inactive is
  // muted grey. `counts` is still accepted on the props shape so
  // page.tsx doesn't need to change · it's not consumed anywhere.
  return (
    <nav
      aria-label="Filter contacts"
      data-nex-contacts-filter-pills
      style={{
        display: "flex",
        alignItems: "stretch",
        // Even-weight distribution so the three labels fill the row
        // without horizontal scrolling · each tab is a flex:1 cell.
        // Owner directive 2026-10-23 · "we dont need line under the
        // toggle that is not selected" · nav baseline retired · only
        // the active tab's underline is visible now.
        gap: 0,
      }}
    >
      {OPTIONS.map((opt) => (
        <FilterTab
          key={opt.value}
          opt={opt}
          active={active}
          extraQuery={extraQuery}
        />
      ))}
    </nav>
  );
}

function FilterTab({
  opt,
  active,
  extraQuery,
}: {
  readonly opt: FilterOption;
  readonly active: ContactsFilter;
  readonly extraQuery?: Readonly<Record<string, string>>;
}) {
  const isActive = opt.value === active;
  const baseStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    padding: "0 10px",
    fontSize: 13,
    textDecoration: "none",
    whiteSpace: "nowrap",
    userSelect: "none",
    // Underline sits inside the tab via borderBottom · active = 2px
    // cyan · inactive = 2px transparent so the baseline height stays
    // stable when switching tabs (no vertical shift of the label).
    borderBottom: isActive
      ? `2px solid ${NEX.cyan}`
      : "2px solid transparent",
  };
  const activeStyle: React.CSSProperties = {
    color: NEX.textPrimary,
    fontWeight: 800,
    letterSpacing: 0.2,
  };
  const inactiveStyle: React.CSSProperties = {
    color: NEX.textMuted,
    fontWeight: 600,
    letterSpacing: 0.2,
  };
  const disabledStyle: React.CSSProperties = {
    color: NEX.textMuted,
    fontWeight: 600,
    opacity: 0.55,
    cursor: "not-allowed",
    letterSpacing: 0.2,
  };

  if (opt.disabled) {
    return (
      <span
        data-nex-contacts-filter-pill={opt.value}
        data-nex-contacts-filter-pill-state="disabled"
        aria-disabled="true"
        title={opt.comingSoon ? "Coming soon" : undefined}
        style={{ ...baseStyle, ...disabledStyle }}
      >
        {opt.label}
      </span>
    );
  }

  const params = new URLSearchParams({ tab: opt.value });
  if (extraQuery) {
    for (const [k, v] of Object.entries(extraQuery)) params.set(k, v);
  }
  return (
    <Link
      href={`/nex-native/contacts?${params.toString()}`}
      data-nex-contacts-filter-pill={opt.value}
      data-nex-contacts-filter-pill-state={isActive ? "active" : "inactive"}
      aria-current={isActive ? "page" : undefined}
      style={{ ...baseStyle, ...(isActive ? activeStyle : inactiveStyle) }}
    >
      {opt.label}
    </Link>
  );
}
