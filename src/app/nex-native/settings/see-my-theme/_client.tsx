"use client";

// src/app/nex-native/settings/see-my-theme/_client.tsx
//
// Theme Visibility · contact list in the sealed contacts-row style.
// Owner-sealed 2026-11-13 iter 2.
//
// Each row mirrors the /nex-native/contacts card vocabulary:
//   · peach / ivory card bg · 1px navy border · 12px radius
//   · 60px circular avatar on the left with a neutral rim · initials
//     fall-through when no avatar_url is set
//   · display name + @nex_handle to the right
// The right side carries the sealed green/red toggle (visual match
// of the Chat Settings controls). Tap flips the toggle optimistically
// and submits toggleThemeShareForContactAction server-side.

import * as React from "react";
import { toggleThemeShareForContactAction } from "./_actions";
import type { ContactRow } from "./page";

const AVATAR_SIZE = 60;
const CARD_MIN_HEIGHT = 76;
const INK = "#2A1F0F";
const INK_MUTE = "rgba(42,31,15,0.62)";
const NEUTRAL_RIM = "rgba(42,31,15,0.35)";

interface Props {
  readonly rows: ReadonlyArray<ContactRow>;
}

export function SeeMyThemeClient({ rows }: Props): React.JSX.Element {
  // Optimistic map · maps accountId → pending bool. Discarded on the
  // next server render when revalidatePath fires.
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
      {/* Search bar · X/Y count on the right. Always rendered so the
          page feels consistent regardless of friend count. */}
      <div
        style={{
          margin: "0 0 10px",
          display: "flex",
          alignItems: "center",
          gap: 8,
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
            color: INK,
            background: "#FFFFFF",
            border: `1px solid ${INK}`,
            borderRadius: 999,
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 800,
            color: INK_MUTE,
          }}
        >
          {visible.length}/{rows.length}
        </span>
      </div>

      <ul
        data-nex-see-my-theme-list
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gap: 8,
        }}
      >
        {visible.length === 0 ? (
          <li
            style={{
              padding: "14px",
              fontSize: 12,
              color: INK_MUTE,
              background: "#FFFFFF",
              border: `1px dashed ${INK}`,
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            No contacts match &ldquo;{filter}&rdquo;
          </li>
        ) : null}
        {visible.map((row) => {
          const currentOn = pending[row.accountId] ?? row.shareOn;
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  minHeight: CARD_MIN_HEIGHT,
                  background: "#F5EDD3",
                  border: `1px solid ${INK}`,
                  borderRadius: 10,
                  boxShadow: "0 1px 3px rgba(42, 31, 15, 0.08)",
                }}
              >
                <input type="hidden" name="contact_id" value={row.accountId} />
                <input type="hidden" name="enabled" value={next} />

                {/* Avatar · 60px circle with neutral rim · initials
                    fall-through · matches the contacts card. */}
                <div
                  aria-hidden
                  style={{
                    position: "relative",
                    width: AVATAR_SIZE,
                    height: AVATAR_SIZE,
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      border: `2px solid ${NEUTRAL_RIM}`,
                      overflow: "hidden",
                      background:
                        "linear-gradient(135deg, #C6A15Bcc 0%, #180012 65%, #050F1E 100%)",
                      display: "grid",
                      placeItems: "center",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                    }}
                  >
                    {row.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={row.avatarUrl}
                        alt=""
                        width={AVATAR_SIZE}
                        height={AVATAR_SIZE}
                        loading="lazy"
                        decoding="async"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          color: "#FFF",
                          fontSize: 15,
                          fontWeight: 900,
                          letterSpacing: "0.04em",
                          textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                        }}
                      >
                        {row.initials}
                      </span>
                    )}
                  </div>
                </div>

                {/* Identity · name + handle */}
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      lineHeight: 1.2,
                      color: INK,
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
                        fontSize: 11,
                        color: INK_MUTE,
                        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                      }}
                    >
                      @{row.nexHandle}
                    </div>
                  ) : null}
                </div>

                {/* Green/red toggle · identical visual to Chat Settings. */}
                <button
                  type="submit"
                  aria-pressed={currentOn}
                  aria-label={`${row.displayName} · currently ${
                    currentOn ? "sees" : "doesn't see"
                  } your theme · tap to turn ${next}`}
                  data-nex-see-my-theme-toggle={currentOn ? "on" : "off"}
                  style={{
                    flexShrink: 0,
                    position: "relative",
                    width: 42,
                    height: 22,
                    borderRadius: 999,
                    background: currentOn ? "#0E6B3A" : "#7F1D1D",
                    border: "none",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.25)",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: 2,
                      left: currentOn ? 22 : 2,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#FFFFFF",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
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
