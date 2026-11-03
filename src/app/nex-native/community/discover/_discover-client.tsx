"use client";

// src/app/nex-native/community/discover/_discover-client.tsx
//
// Client · search filter + Join buttons for the Discover page.
// Join routes to /community/select with ?prefill=<zoneId> so the user
// confirms via the sealed select flow (which already writes the
// membership with district resolution). We don't short-circuit the
// membership insert here · the select page is the single authority.

import * as React from "react";
import Link from "next/link";

interface Community {
  readonly id: string;
  readonly name: string;
  readonly memberCount: number;
  readonly isMember: boolean;
}

interface Props {
  readonly communities: ReadonlyArray<Community>;
}

const C = {
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  success: "#16D66B",
};

export function DiscoverCommunitiesClient({ communities }: Props): React.ReactElement {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      q.length === 0
        ? communities
        : communities.filter((c) => c.name.toLowerCase().includes(q)),
    [communities, q],
  );

  return (
    <>
      {/* Search field */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 12,
          background: C.panel,
          border: `1.5px solid ${C.borderSoft}`,
          marginBottom: 14,
        }}
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke={C.secondary}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx={11} cy={11} r={7} />
          <line x1={21} y1={21} x2={16.65} y2={16.65} />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for your county (e.g. Dublin, Cork, Galway)"
          aria-label="Search communities"
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            color: C.textPrimary,
            fontSize: 14,
          }}
        />
        {query.length > 0 ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            style={{
              background: "transparent",
              border: "none",
              color: C.textMuted,
              fontSize: 18,
              cursor: "pointer",
              lineHeight: 1,
              padding: 2,
            }}
          >
            ×
          </button>
        ) : null}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: "28px 20px",
            borderRadius: 14,
            background: C.panel,
            border: `1px solid ${C.borderSoft}`,
            textAlign: "center",
            fontSize: 13,
            color: C.textMuted,
          }}
        >
          No communities match "{query}". Try another spelling.
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 10,
          }}
        >
          {filtered.map((c) => (
            <li key={c.id}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: 14,
                  borderRadius: 14,
                  background: C.panel,
                  border: `1.5px solid ${c.isMember ? C.success : C.borderSoft}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: C.textPrimary }}>
                    {c.name}
                  </span>
                  {c.isMember ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: C.success,
                      }}
                    >
                      ✓ joined
                    </span>
                  ) : null}
                </div>
                <span style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
                </span>
                {c.isMember ? (
                  <Link
                    href="/nex-native/community/chat"
                    style={{
                      marginTop: 4,
                      padding: "8px 14px",
                      borderRadius: 999,
                      background: "transparent",
                      border: `1.5px solid ${C.success}`,
                      color: C.success,
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    Open chat
                  </Link>
                ) : (
                  <Link
                    href={`/nex-native/community/select?prefill=${c.id}`}
                    style={{
                      marginTop: 4,
                      padding: "8px 14px",
                      borderRadius: 999,
                      background: C.secondary,
                      border: `1.5px solid ${C.secondary}`,
                      color: C.drawerBg,
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 800,
                      textAlign: "center",
                    }}
                  >
                    Join community
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
