"use client";

// src/app/nex-native/chat/peer/[accountId]/forward/[messageId]/_forward-picker-client.tsx
//
// Owner-authored 2026-11-05 later-same-day iter 9 · contact picker
// for the Forward Message flow. Picks a destination · writes the
// forwarded body into the destination's sealed draft-preservation
// key · navigates to the destination chat where the composer's
// mount-effect hydrates the text so the user hits Send to confirm.
//
// Rationale for the "pre-fill then user confirms" model:
//   · Lets the user edit the forwarded text (classic WhatsApp "add
//     a comment before forwarding").
//   · No server-side forward action to add · reuses the sealed
//     peer-message send pipeline exactly.
//   · No E2E posture change · body re-enters the destination's
//     own encrypted send flow.

import * as React from "react";
import { useRouter } from "next/navigation";

export interface ForwardCandidate {
  readonly id: string;
  readonly displayName: string;
  readonly handle: string | null;
  readonly avatarUrl: string | null;
}

export interface ForwardPickerClientProps {
  readonly friends: ReadonlyArray<ForwardCandidate>;
  readonly bodyToForward: string;
}

export function ForwardPickerClient({
  friends,
  bodyToForward,
}: ForwardPickerClientProps): React.JSX.Element {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.displayName.toLowerCase().includes(q) ||
        (f.handle?.toLowerCase().includes(q) ?? false),
    );
  }, [friends, query]);

  const onPick = React.useCallback(
    (destAccountId: string) => {
      try {
        window.localStorage.setItem(
          `nex-peer-draft:${destAccountId}`,
          bodyToForward,
        );
      } catch {
        // storage unavailable · still navigate, user retypes.
      }
      router.push(`/nex-native/chat/peer/${destAccountId}`);
    },
    [bodyToForward, router],
  );

  return (
    <div style={{ padding: "16px 12px 24px" }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        placeholder="Search contacts…"
        aria-label="Search contacts"
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 999,
          background: "rgba(2,9,20,0.6)",
          border: "1px solid rgba(255,255,255,0.14)",
          color: "#F2F5F8",
          fontSize: 14,
          outline: "none",
          marginBottom: 12,
          boxSizing: "border-box",
        }}
      />
      {filtered.length === 0 ? (
        <div
          style={{
            padding: "32px 24px",
            textAlign: "center",
            color: "#B5C3D6",
            fontSize: 14,
          }}
        >
          No contacts match "{query}".
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {filtered.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onPick(f.id)}
                data-nex-forward-pick
                data-nex-forward-pick-dest={f.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "12px",
                  borderRadius: 12,
                  background: "rgba(2,9,20,0.6)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: "#F2F5F8",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, var(--nex-world-secondary, #C6A15B)cc 0%, var(--nex-world-drawer-bg, #0A1526) 65%, var(--nex-world-drawer-bg, #050F1E) 100%)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFF",
                    fontSize: 14,
                    fontWeight: 900,
                    letterSpacing: "0.04em",
                    flexShrink: 0,
                  }}
                >
                  {initials(f.displayName)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {f.displayName}
                  </div>
                  {f.handle ? (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#B5C3D6",
                        marginTop: 2,
                      }}
                    >
                      {f.handle.replace(/^nex-/i, "NEX-")}
                    </div>
                  ) : null}
                </div>
                <span
                  aria-hidden
                  style={{
                    fontSize: 16,
                    color: "var(--nex-world-secondary, #C6A15B)",
                  }}
                >
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
