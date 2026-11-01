"use client";

// src/app/nex-native/contacts/_my-private-groups-list.tsx
//
// Owner directive 2026-10-23 · Groups tab · badge "N private groups"
// + the viewer's private groups rendered as GroupCard rows. Mock-
// complete · reads from the mock-private-groups store.
//
// The Create Private Group hero used to live here · it was lifted to
// `_create-group-hero.tsx` and mounted at page level above the filter
// pills per owner directive "move the badges under this banner".
// This component now only owns the "my groups" badge + list.

import * as React from "react";
import { GroupCard } from "./_group-card";
import {
  loadGroups,
  PRIVATE_GROUPS_CHANGED_EVENT,
  type MockPrivateGroup,
} from "./_mock-private-groups";
import type { MockGroup } from "./_mock-groups";

const NEX = {
  textMute: "#7D9BC0",
  cyan: "var(--nex-world-secondary, #00AFFF)",
};

interface MyPrivateGroupsListProps {
  readonly viewerDisplayName: string;
  readonly viewerNexHandle: string;
}

export function MyPrivateGroupsList({
  viewerNexHandle,
}: MyPrivateGroupsListProps): React.ReactElement {
  const [groups, setGroups] = React.useState<ReadonlyArray<MockPrivateGroup>>([]);

  React.useEffect(() => {
    const sync = () => setGroups(loadGroups());
    sync();
    window.addEventListener(PRIVATE_GROUPS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PRIVATE_GROUPS_CHANGED_EVENT, sync);
  }, []);

  // Groups the viewer is a member of (seed group + any they created
  // + any they accepted an invite into).
  const myGroups = React.useMemo(
    () => groups.filter((g) => g.members.some((m) => m.accountId === viewerNexHandle)),
    [groups, viewerNexHandle],
  );

  return (
    <div
      data-nex-my-private-groups
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      {/* Viewer's groups · rendered as GroupCards keyed to the private
          groups store. Owner directive 2026-10-23 · "/nex-native/group-
          chat/[groupId]" is the chat surface. The "N private groups"
          badge used to sit here · it was hoisted to a separate
          `<MyPrivateGroupsBadge>` component mounted ABOVE the groups
          grid per owner directive "move up". */}
      {myGroups.map((g) => (
        <GroupCard
          key={g.id}
          group={toCardShape(g)}
          href={`/nex-native/group-chat/${g.id}`}
          accent="cyan"
        />
      ))}
    </div>
  );
}

/**
 * Standalone "N private groups" badge · same state source as the
 * sibling list component · mounted at the top of the Groups tab
 * so it reads directly under the Contacts / Business / Groups filter
 * pills. Hidden when the viewer is in zero groups.
 *
 * Owner directive 2026-10-23 · "move up - my private group" · the
 * badge was previously nested inside `MyPrivateGroupsList` between
 * the hero (now retired from this component) and the group cards ·
 * it now sits one layout tier higher so the count is the first
 * thing the viewer sees after the badge-group filter row.
 */
export function MyPrivateGroupsBadge({
  viewerNexHandle,
}: {
  readonly viewerNexHandle: string;
}): React.ReactElement | null {
  const [groups, setGroups] = React.useState<ReadonlyArray<MockPrivateGroup>>([]);
  React.useEffect(() => {
    const sync = () => setGroups(loadGroups());
    sync();
    window.addEventListener(PRIVATE_GROUPS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PRIVATE_GROUPS_CHANGED_EVENT, sync);
  }, []);
  const count = React.useMemo(
    () =>
      groups.filter((g) => g.members.some((m) => m.accountId === viewerNexHandle))
        .length,
    [groups, viewerNexHandle],
  );
  if (count === 0) return null;
  return (
    <div
      data-nex-my-private-groups-badge
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 2px",
      }}
    >
      <span
        data-nex-my-private-groups-count
        style={{ fontSize: 12, color: NEX.textMute }}
      >
        {count} {count === 1 ? "private group" : "private groups"}
      </span>
      <div style={{ flex: 1, minWidth: 0 }} />
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: `1.5px solid ${NEX.cyan}`,
          color: NEX.cyan,
          fontSize: 10,
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        {count}
      </span>
    </div>
  );
}

/** Translate a MockPrivateGroup into the MockGroup shape consumed by
 *  the sealed `GroupCard` chrome. Keeps GroupCard untouched. */
function toCardShape(g: MockPrivateGroup): MockGroup {
  return {
    id: g.id,
    name: g.name,
    location: g.description ?? "Private group",
    memberCount: g.members.length,
    members: g.members.slice(0, 4).map((m) => ({
      id: m.accountId,
      initials: m.initials,
    })),
    minutesSinceLastPost: g.minutesSinceLastPost ?? undefined,
  };
}
