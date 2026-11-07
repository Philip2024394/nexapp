"use client";

// src/app/nex-native/settings/see-my-theme/_client.tsx
//
// NEX See My Theme · interactive per-contact toggle list.
// Owner-authorised 2026-11-07.
// -----------------------------------------------------------------------------
// Each row submits its own <form action={toggleThemeShareForContactAction}>
// so progressive enhancement works without JS and the server stays the
// source of truth for the saved state. Optimistic UI uses React
// `useTransition` + a local optimistic set so tap feels immediate while
// the server round-trip completes.

import * as React from "react";
import { toggleThemeShareForContactAction } from "./_actions";
import { NEX_SETTINGS } from "../_settings-shell";
import type { ContactRow } from "./page";

interface Props {
  readonly rows: ReadonlyArray<ContactRow>;
}

export function SeeMyThemeClient({ rows }: Props): React.JSX.Element {
  // Local optimistic state · maps accountId → pending bool. When a
  // tap fires, we flip the UI immediately. The server response
  // triggers a full revalidation (see _actions · revalidatePath) and
  // this map is discarded on the next render.
  const [pending, setPending] = React.useState<Record<string, boolean>>({});
  const [filter, setFilter] = React.useState("");

  const visible = React.useMemo(
    () =>
      rows.filter((r) => {
        if (!filter.trim()) return true;
        const needle = filter.trim().toLowerCase();
        return (
          r.displayName.toLowerCase().includes(needle) ||
          (r.nexHandle?.toLowerCase().includes(needle) ?? false)
        );
      }),
    [rows, filter],
  );

  return (
    <>
      {/* Search · filter the list when it grows beyond one screen.
          Hidden when fewer than 6 rows · the list is short enough
          to scan at a glance. */}
      {rows.length >= 6 ? (
        <div
          style={{
            marginTop: 14,
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 2px",
          }}
        >
          <input
            type="search"
            placeholder="Search contacts…"
            value={filter}
            onChange={(e) => setFilter(e.currentTarget.value)}
            data-nex-see-my-theme-search
            style={{
              flex: 1,
              padding: "10px 14px",
              fontSize: 13,
              color: NEX_SETTINGS.textPrimary,
              background: NEX_SETTINGS.panel,
              border: `1px solid ${NEX_SETTINGS.panelAccent}`,
              borderRadius: 999,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <span
            aria-hidden
            style={{
              fontSize: 11,
              color: NEX_SETTINGS.textSecondary,
            }}
          >
            {visible.length}/{rows.length}
          </span>
        </div>
      ) : null}

      <ul
        data-nex-see-my-theme-list
        style={{
          listStyle: "none",
          padding: 0,
          margin: "10px 0 0",
          display: "grid",
          gap: 8,
        }}
      >
        {visible.length === 0 ? (
          <li
            style={{
              padding: "16px 14px",
              fontSize: 12,
              color: NEX_SETTINGS.textSecondary,
              background: NEX_SETTINGS.panel,
              border: `1px dashed ${NEX_SETTINGS.panelAccent}`,
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            No contacts match &ldquo;{filter}&rdquo;
          </li>
        ) : null}
        {visible.map((row) => {
          const currentOn =
            pending[row.accountId] ?? row.shareOn;
          const next = currentOn ? "off" : "on";
          return (
            <li key={row.accountId} style={{ margin: 0 }}>
              <form
                action={async (fd) => {
                  setPending((prev) => ({
                    ...prev,
                    [row.accountId]: next === "on",
                  }));
                  await toggleThemeShareForContactAction(fd);
                }}
                data-nex-see-my-theme-row={row.accountId}
                style={rowStyle}
              >
                <input type="hidden" name="contact_id" value={row.accountId} />
                <input type="hidden" name="enabled" value={next} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      color: NEX_SETTINGS.textPrimary,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {row.displayName}
                  </div>
                  {row.nexHandle ? (
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 11,
                        color: NEX_SETTINGS.textSecondary,
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      {row.nexHandle}
                    </div>
                  ) : null}
                </div>
                <div
                  aria-hidden
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: currentOn
                      ? NEX_SETTINGS.cyan
                      : NEX_SETTINGS.textSecondary,
                    marginRight: 2,
                  }}
                >
                  {currentOn ? "Sharing" : "Hidden"}
                </div>
                <button
                  type="submit"
                  aria-pressed={currentOn}
                  aria-label={`${row.displayName} · currently ${
                    currentOn ? "sees" : "doesn't see"
                  } your theme · tap to turn ${next}`}
                  style={{
                    flexShrink: 0,
                    width: 52,
                    height: 30,
                    borderRadius: 999,
                    border: "none",
                    cursor: "pointer",
                    background: currentOn
                      ? NEX_SETTINGS.cyan
                      : "rgba(125,155,192,0.20)",
                    position: "relative",
                    transition: "background 160ms ease",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: 3,
                      left: currentOn ? 25 : 3,
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "#F2F5F8",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      transition: "left 160ms ease",
                    }}
                  />
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  background: NEX_SETTINGS.panel,
  border: `1px solid ${NEX_SETTINGS.panelAccent}`,
  borderRadius: 12,
  minHeight: 64,
  margin: 0,
};
