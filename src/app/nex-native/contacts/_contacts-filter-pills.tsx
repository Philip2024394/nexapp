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
// Server Component · uses Link navigation (?tab=...) so filter state
// is URL-driven and bookmarkable.

import type * as React from "react";
import Link from "next/link";

export type ContactsFilter = "all" | "friends" | "business" | "dating" | "groups";

const NEX = {
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  textPrimary: "#F2F5F8",
  textMuted: "#7D9BC0",
  panel: "rgba(3, 16, 29, 0.72)",
  bgDark: "#020914",
};

interface FilterOption {
  readonly value: ContactsFilter;
  readonly label: string;
  readonly disabled?: boolean;
  readonly comingSoon?: boolean;
}

// Owner directive 2026-10-17 · "All" pill removed · default view
// (no ?tab param) shows merged contacts without a selected pill.
// Each pill filters to its specific category when tapped.
const OPTIONS: ReadonlyArray<FilterOption> = [
  { value: "friends", label: "Friends" },
  { value: "business", label: "Business" },
  { value: "dating", label: "Dating", disabled: true, comingSoon: true },
  { value: "groups", label: "Groups" },
];

interface ContactsFilterPillsProps {
  readonly active: ContactsFilter;
}

export function ContactsFilterPills({ active }: ContactsFilterPillsProps) {
  return (
    <nav
      aria-label="Filter contacts"
      data-nex-contacts-filter-pills
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        overflowX: "auto",
        paddingBottom: 2,
        // Hide scrollbar visually but keep accessible
        scrollbarWidth: "none",
      }}
    >
      {OPTIONS.map((opt) => (
        <FilterPill key={opt.value} opt={opt} active={active} />
      ))}
    </nav>
  );
}

function FilterPill({ opt, active }: { readonly opt: FilterOption; readonly active: ContactsFilter }) {
  const isActive = opt.value === active;
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    height: 32,
    padding: "0 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    textDecoration: "none",
    whiteSpace: "nowrap",
    flexShrink: 0,
    userSelect: "none",
  };
  const activeStyle: React.CSSProperties = {
    background: NEX.cyan,
    color: NEX.bgDark,
    border: `1px solid ${NEX.cyan}`,
  };
  const inactiveStyle: React.CSSProperties = {
    background: NEX.panel,
    color: NEX.textPrimary,
    border: `1px solid ${NEX.cyanSoft}`,
  };
  const disabledStyle: React.CSSProperties = {
    background: NEX.panel,
    color: NEX.textMuted,
    border: `1px solid rgba(125, 155, 192, 0.25)`,
    cursor: "not-allowed",
    opacity: 0.6,
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

  return (
    <Link
      href={`/nex-native/contacts?tab=${opt.value}`}
      data-nex-contacts-filter-pill={opt.value}
      data-nex-contacts-filter-pill-state={isActive ? "active" : "inactive"}
      aria-current={isActive ? "page" : undefined}
      style={{ ...baseStyle, ...(isActive ? activeStyle : inactiveStyle) }}
    >
      {opt.label}
    </Link>
  );
}
