"use client";

// src/app/nex-native/contacts/_open-groups-discovery.tsx
//
// Owner directive 2026-10-23 · Groups-tab discovery surface · the
// user picks a country via the flag chip + types a query in the
// search bar · we list all OPEN mock groups in that country that
// the viewer hasn't joined, with a one-tap Join CTA on each row.
//
// Owns:
//   · The country + query state (shared with GroupDiscoverySearch)
//   · The one-tap join handler (writes to the mock store, which
//     dispatches PRIVATE_GROUPS_CHANGED_EVENT so the user's own
//     groups list refreshes automatically)
//
// Does NOT own:
//   · The Create Private Group hero (that's at page level above)
//   · The MyPrivateGroupsBadge / MyPrivateGroupsList (those render
//     the viewer's own joined groups, below this section)

import * as React from "react";
import {
  flagEmojiForIso,
  countryNameForIso,
} from "@/lib/nex-native/user-location/country-labels";
import {
  joinOpenGroup,
  listDiscoverableOpenGroups,
  PRIVATE_GROUPS_CHANGED_EVENT,
  type MockPrivateGroup,
  type PrivateGroupMember,
} from "./_mock-private-groups";
import {
  getGroupDiscoveryFilterState,
  subscribeGroupDiscoveryFilterState,
} from "./_group-discovery-filter-state";

const NEX = {
  bgPanel: "rgba(2,9,20,0.92)",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  cyan: "var(--nex-world-secondary, #00AFFF)",
  acceptGreen: "#16D66B",
};

interface OpenGroupsDiscoveryProps {
  readonly viewerDisplayName: string;
  readonly viewerNexHandle: string;
}

export function OpenGroupsDiscovery({
  viewerDisplayName,
  viewerNexHandle,
}: OpenGroupsDiscoveryProps): React.ReactElement {
  // Owner directive 2026-10-23 · the search bar + country-flag chip
  // now live at page level under the ContactsHeader · this results
  // list subscribes to the same singleton so country / query changes
  // up top drive the filtered list down here.
  const [filter, setFilter] = React.useState(getGroupDiscoveryFilterState);
  React.useEffect(() => subscribeGroupDiscoveryFilterState(setFilter), []);
  const country = filter.country;
  const query = filter.query;
  const [results, setResults] = React.useState<ReadonlyArray<MockPrivateGroup>>([]);
  const [joinedToast, setJoinedToast] = React.useState<string | null>(null);

  const viewer = React.useMemo<PrivateGroupMember>(
    () => ({
      accountId: viewerNexHandle,
      nexId: viewerNexHandle,
      displayName: viewerDisplayName,
      initials: initialsFromName(viewerDisplayName),
      avatarUrl: null,
      role: "member",
      joinedAt: new Date().toISOString(),
    }),
    [viewerDisplayName, viewerNexHandle],
  );

  // Re-run the discovery read whenever country/query change OR
  // the store dispatches a change (another viewer joined, a new
  // group created). The viewer-side filter also drops groups the
  // viewer has already joined.
  React.useEffect(() => {
    const sync = () => {
      setResults(
        listDiscoverableOpenGroups({
          country,
          query,
          viewerAccountId: viewer.accountId,
        }),
      );
    };
    sync();
    window.addEventListener(PRIVATE_GROUPS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PRIVATE_GROUPS_CHANGED_EVENT, sync);
  }, [country, query, viewer.accountId]);

  React.useEffect(() => {
    if (!joinedToast) return;
    const t = window.setTimeout(() => setJoinedToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [joinedToast]);

  const handleJoin = (group: MockPrivateGroup): void => {
    joinOpenGroup(group.id, viewer);
    setJoinedToast(`Joined ${group.name}`);
  };

  const countryName = countryNameForIso(country) ?? country;

  return (
    <div
      data-nex-open-groups-discovery
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {/* Owner directive 2026-10-23 · the search bar + country flag
          chip moved to page level (under ContactsHeader) · this
          block renders only the filtered results list + section
          header + join-toast. */}

      {/* Section header + list · owner directive 2026-10-23 ·
          "remove this No open groups in Indonesia yet / Be the first
          · create an open group in Indonesia" · both the empty-state
          header AND the dashed empty-state card are retired · when
          the discovery query has no results, this section renders
          nothing. The country-aware header still shows a count when
          there IS at least one match. */}
      {results.length > 0 ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 2px",
            }}
          >
            <span style={{ fontSize: 12, color: NEX.textMute }}>
              {results.length} open group{results.length === 1 ? "" : "s"} in {countryName}
            </span>
            <div style={{ flex: 1, minWidth: 0 }} />
          </div>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {results.map((g) => (
              <li key={g.id} style={{ margin: 0, padding: 0 }}>
                <OpenGroupRow group={g} onJoin={() => handleJoin(g)} />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {joinedToast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            left: 14,
            right: 14,
            bottom: 24,
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(22,214,107,0.14)",
            border: `1px solid ${NEX.acceptGreen}66`,
            color: NEX.acceptGreen,
            fontSize: 12,
            fontWeight: 700,
            textAlign: "center",
            zIndex: 900,
          }}
        >
          {joinedToast}
        </div>
      ) : null}
    </div>
  );
}

/* ─── Open-group discovery row ─────────────────────────────────── */

function OpenGroupRow({
  group,
  onJoin,
}: {
  readonly group: MockPrivateGroup;
  readonly onJoin: () => void;
}): React.ReactElement {
  const memberCount =
    group.discoveryMemberCount ?? group.members.length;
  const flag = flagEmojiForIso(group.country ?? "") ?? "🏳️";
  return (
    <article
      data-nex-open-group-row={group.id}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "2px 14px 2px 70px",
        width: "100%",
        boxSizing: "border-box",
        borderRadius: 10,
        background: NEX.bgPanel,
        border: `1.5px solid ${NEX.cyan}`,
        boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
        color: NEX.text,
        marginTop: 14,
        overflow: "visible",
      }}
    >
      {/* Country-flag chip overlapping top-left · same geometry as
          the GroupCard chip so visual rhythm matches the Groups-tab
          list below. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -24,
          left: 12,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${NEX.cyan}cc 0%, #050F1E 100%)`,
          border: `2px solid ${NEX.cyan}`,
          display: "grid",
          placeItems: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          zIndex: 2,
        }}
      >
        <span style={{ fontSize: 24, lineHeight: 1 }}>{flag}</span>
      </div>

      {/* Name + description + member count · lifted onto the top
          rim identically to GroupCard. */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          position: "relative",
          zIndex: 1,
          transform: "translateY(-12px)",
        }}
      >
        <div
          data-nex-open-group-row-eyebrow
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: 1.2,
            color: NEX.cyan,
            textTransform: "uppercase",
            lineHeight: 1.1,
          }}
        >
          Open group · {countryNameForIso(group.country ?? "") ?? group.country}
        </div>
        <div
          data-nex-open-group-row-name
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: NEX.text,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            letterSpacing: 0.2,
          }}
        >
          {group.name}
        </div>
        {group.description ? (
          <div
            style={{
              fontSize: 11,
              color: NEX.textMute,
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 1,
            }}
          >
            {group.description}
          </div>
        ) : null}
        <div
          style={{
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.2,
            letterSpacing: 0.2,
          }}
        >
          {formatMemberCount(memberCount)} members
        </div>
      </div>

      {/* Join button · floating pill top-right, mirrors the Confirm
          button on inbound-invite rows for visual consistency. */}
      <button
        type="button"
        onClick={onJoin}
        data-nex-open-group-join
        aria-label={`Join ${group.name}`}
        style={{
          position: "absolute",
          top: -14,
          right: 10,
          padding: "4px 14px",
          borderRadius: 999,
          background: `linear-gradient(135deg, ${NEX.acceptGreen}, ${NEX.acceptGreen}cc)`,
          border: `1px solid ${NEX.acceptGreen}`,
          color: "#07140A",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          cursor: "pointer",
          boxShadow: `0 2px 6px ${NEX.acceptGreen}66`,
          zIndex: 3,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        Join
      </button>
    </article>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function formatMemberCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) {
    const k = (n / 1000).toFixed(1).replace(/\.0$/, "");
    return `${k}k`;
  }
  return `${Math.round(n / 1000)}k`;
}
