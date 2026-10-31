"use client";

// src/app/nex-native/status/_landing-client.tsx
//
// Status landing · lists my-active-statuses from IndexedDB · owner
// taps a status to view, or taps "+ Create new" to open the editor.
// Sweeps expired statuses on mount so the list stays truthful.

import * as React from "react";
import Link from "next/link";
import {
  listMyStatuses,
  sweepExpired,
} from "@/lib/nex-native/status-storage/store";
import type { StoredStatus } from "@/lib/nex-native/status-storage/types";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  text: "#F2F5F8",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.3)",
  cyanBorder: "rgba(0, 175, 255, 0.42)",
  red: "#FF3355",
} as const;

// Owner directive 2026-10-22 · identity-sealing · the signed-in NEX
// account id arrives as a prop from the server component page. No
// more prototype placeholder · the id below is the real session UUID.

export function StatusLandingClient({
  ownerAccountId,
}: {
  readonly ownerAccountId: string;
}): React.JSX.Element {
  const [statuses, setStatuses] = React.useState<StoredStatus[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      await sweepExpired();
      const mine = await listMyStatuses(ownerAccountId);
      setStatuses(mine);
      setError(null);
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Could not read status storage · your browser may not support it.",
      );
    } finally {
      setLoading(false);
    }
  }, [ownerAccountId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

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
          Status · 24h expiry · device-only
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 800,
            color: NEX.text,
          }}
        >
          Your statuses
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 13,
            color: NEX.textDim,
            lineHeight: 1.5,
          }}
        >
          Shared with contacts over the air · NEX never receives the media. Status is only visible while you're online.
        </p>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 10 }}>
        <Link
          href="/nex-native/status/create"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 16,
            borderRadius: 14,
            background: "rgba(0, 175, 255, 0.14)",
            border: `1px dashed ${NEX.cyanBorder}`,
            color: NEX.cyan,
            fontSize: 14,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          <span>+ Create new status</span>
          <span aria-hidden style={{ fontSize: 18 }}>→</span>
        </Link>

        {loading && (
          <div
            style={{
              padding: 24,
              borderRadius: 12,
              background: "rgba(2, 9, 20, 0.5)",
              border: `1px solid ${NEX.cyanSoft}`,
              color: NEX.textDim,
              fontSize: 12,
              textAlign: "center",
            }}
          >
            Reading your device storage…
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              padding: 16,
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

        {!loading && !error && statuses.length === 0 && (
          <div
            style={{
              padding: 24,
              borderRadius: 12,
              background: "rgba(2, 9, 20, 0.5)",
              border: `1px solid ${NEX.cyanSoft}`,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }} aria-hidden>📷</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: NEX.text }}>
              No active statuses
            </div>
            <div style={{ fontSize: 11, color: NEX.textMute, marginTop: 4 }}>
              Statuses you create appear here for 24 hours.
            </div>
          </div>
        )}

        {!loading && !error && statuses.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {statuses.map((s) => (
              <StatusRow key={s.id} status={s} onDeleted={refresh} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function StatusRow({
  status,
  onDeleted,
}: {
  readonly status: StoredStatus;
  readonly onDeleted: () => void;
}): React.JSX.Element {
  const remainingMs = status.expiresAtMs - Date.now();
  const remainingHours = Math.max(0, Math.floor(remainingMs / 3_600_000));
  const remainingMinutes = Math.max(0, Math.floor((remainingMs % 3_600_000) / 60_000));
  const remainingLabel =
    remainingHours > 0
      ? `${remainingHours}h ${remainingMinutes}m left`
      : `${remainingMinutes}m left`;

  return (
    <li>
      <Link
        href={`/nex-native/status/${status.id}`}
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
            width: 56,
            height: 56,
            borderRadius: 12,
            background: "linear-gradient(135deg, rgba(0, 175, 255, 0.3), #0A1526)",
            border: `1px solid ${NEX.cyanBorder}`,
            display: "grid",
            placeItems: "center",
            fontSize: 20,
          }}
        >
          {status.kind === "video" ? "🎬" : "🖼"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>
            {status.kind === "video" ? "Video status" : "Image status"}
          </div>
          <div style={{ fontSize: 11, color: NEX.textDim, marginTop: 2 }}>
            {remainingLabel} ·{" "}
            {status.overlays.length > 0
              ? `${status.overlays.length} overlay${status.overlays.length === 1 ? "" : "s"}`
              : "no overlays"}
          </div>
        </div>
        <span aria-hidden style={{ color: NEX.textMute, fontSize: 20 }}>→</span>
      </Link>
    </li>
  );
}
