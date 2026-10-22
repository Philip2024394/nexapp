"use client";

// src/app/nex-native/status/contacts/_contacts-client.tsx
//
// Contact discovery feed · subscribes to `nex:status-owners` presence
// via StatusOwnerPresence and renders the owners currently online with
// at least one active status.
//
// Prototype scope:
//   · Roster is populated purely from presence (no DB). Display names
//     come from the presence meta row. The owner is responsible for
//     populating displayName when they announce themselves · empty
//     strings fall back to the account id.
//   · This surface is read-only. We join as an observer (announceSelf:
//     false) · a viewer who happens to also be an owner has their own
//     StatusOwnerPresence instance running elsewhere.
//
// Owner directive 2026-10-22 · identity-sealing · the viewer self id
// is now the signed-in NEX account id resolved server-side and passed
// as a prop. The parent surface guards sign-in so this prop is
// always a real UUID.

import * as React from "react";
import Link from "next/link";
import {
  StatusOwnerPresence,
  type StatusOwnerPresenceSnapshot,
} from "@/lib/nex-native/status-p2p/presence";

const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.3)",
  cyanBorder: "rgba(0, 175, 255, 0.42)",
  red: "#FF3355",
} as const;

export function StatusContactsClient({
  viewerAccountId,
}: {
  readonly viewerAccountId: string;
}): React.JSX.Element {
  const [owners, setOwners] = React.useState<StatusOwnerPresenceSnapshot[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    const presence = new StatusOwnerPresence({
      ownerAccountId: viewerAccountId,
      handlers: {
        onPresenceChange: (rows) => {
          setOwners(rows.filter((r) => r.hasActive === true));
        },
        onError: (msg) => setError(msg),
        onSubscribed: () => setConnected(true),
      },
    });
    void presence.start({ announceSelf: false });
    return () => {
      void presence.stop();
    };
  }, [viewerAccountId]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: "Inter, system-ui, sans-serif",
        padding: "20px 16px 120px",
        boxSizing: "border-box",
      }}
    >
      <header style={{ marginBottom: 24, maxWidth: 760, margin: "0 auto 24px" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.5,
            color: NEX.cyan,
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Status · contacts · live now
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: NEX.text }}>
          Contacts with statuses
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 13,
            color: NEX.textDim,
            lineHeight: 1.5,
          }}
        >
          Status is served over the air directly from each contact&rsquo;s device.
          You&rsquo;ll only see them here while they&rsquo;re online.
        </p>
      </header>

      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          display: "grid",
          gap: 10,
        }}
      >
        <Link
          href="/nex-native/status"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 14,
            borderRadius: 12,
            background: "rgba(2, 9, 20, 0.5)",
            border: `1px solid ${NEX.cyanSoft}`,
            color: NEX.text,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          <span>&larr; My statuses</span>
          <span style={{ fontSize: 11, color: NEX.textDim }}>
            {connected ? "live" : "connecting…"}
          </span>
        </Link>

        {error && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: 14,
              borderRadius: 12,
              background: "rgba(255, 51, 85, 0.14)",
              border: "1px solid rgba(255, 51, 85, 0.42)",
              color: NEX.red,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {owners.length === 0 && !error && (
          <div
            style={{
              padding: 24,
              borderRadius: 12,
              background: "rgba(2, 9, 20, 0.5)",
              border: `1px solid ${NEX.cyanSoft}`,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }} aria-hidden>
              👥
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: NEX.text }}>
              No contacts live right now
            </div>
            <div style={{ fontSize: 11, color: NEX.textMute, marginTop: 4 }}>
              Status is only visible while the owner is online. Try again later.
            </div>
          </div>
        )}

        {owners.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {owners.map((o) => (
              <OwnerRow key={o.ownerAccountId} owner={o} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function OwnerRow({
  owner,
}: {
  readonly owner: StatusOwnerPresenceSnapshot;
}): React.JSX.Element {
  const label =
    owner.displayName && owner.displayName.length > 0
      ? owner.displayName
      : owner.ownerAccountId;
  const freshMinutes = Math.max(
    0,
    Math.floor((Date.now() - owner.lastActiveAt) / 60_000),
  );
  const freshLabel =
    freshMinutes === 0 ? "just now" : `${freshMinutes}m ago`;
  return (
    <li>
      <Link
        href={`/nex-native/status/peer/${encodeURIComponent(owner.ownerAccountId)}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 12,
          borderRadius: 12,
          background: "rgba(2, 9, 20, 0.5)",
          border: `1px solid ${NEX.cyanSoft}`,
          color: NEX.text,
          textDecoration: "none",
        }}
      >
        <div
          aria-hidden
          style={{
            flexShrink: 0,
            width: 48,
            height: 48,
            borderRadius: 999,
            background: "linear-gradient(135deg, rgba(0, 175, 255, 0.3), #0A1526)",
            border: `1px solid ${NEX.cyanBorder}`,
            display: "grid",
            placeItems: "center",
            fontSize: 18,
            fontWeight: 800,
            color: NEX.cyan,
          }}
        >
          {initial(label)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {label}
          </div>
          <div style={{ fontSize: 11, color: NEX.textDim, marginTop: 2 }}>
            Active {freshLabel}
          </div>
        </div>
        <span
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(0, 175, 255, 0.14)",
            border: `1px solid ${NEX.cyanBorder}`,
            color: NEX.cyan,
            fontSize: 11,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          View status
        </span>
      </Link>
    </li>
  );
}

function initial(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}
