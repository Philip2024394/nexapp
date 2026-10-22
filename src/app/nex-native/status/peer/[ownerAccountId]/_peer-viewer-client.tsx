"use client";

// src/app/nex-native/status/peer/[ownerAccountId]/_peer-viewer-client.tsx
//
// Full-screen P2P status viewer for someone else's statuses.
//
// Flow (sealed per build task 2026-10-22):
//   1. Mount StatusFetchClient({ownerAccountId, viewerAccountId}).
//   2. connect() on mount.
//   3. onStatusList fires · we auto-fetch the first unseen status.
//   4. onStatusBlob fires with a Blob · render via createObjectURL +
//      overlays via the shared StatusOverlayRender.
//   5. If onStateChange === "offline", show "Owner is not online".
//
// Owner directive 2026-10-22 · identity-sealing · the viewer self id
// is now the signed-in NEX account id resolved server-side and passed
// as a prop.
//
// HONEST FLAGS:
//   · "Seen" tracking is NOT persisted · it's a per-mount Set so
//     chapter advance works within a single visit.
//   · We render ONE status at a time with Prev/Next buttons · no auto-
//     advance timer in this slice.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  StatusFetchClient,
  type StatusFetchState,
} from "@/lib/nex-native/status-p2p/fetch-from-owner";
import type { StatusListItem } from "@/lib/nex-native/status-p2p/types";
import type { StatusOverlay } from "@/lib/nex-native/status-storage/types";
import { StatusOverlayRender } from "@/components/nex-native/status/StatusOverlayRender";

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

interface LoadedStatus {
  statusId: string;
  blob: Blob;
  overlays: StatusOverlay[];
  kind: "image" | "video";
}

export function StatusPeerViewerClient({
  ownerAccountId,
  viewerAccountId,
}: {
  readonly ownerAccountId: string;
  readonly viewerAccountId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [state, setState] = React.useState<StatusFetchState>("idle");
  const [items, setItems] = React.useState<StatusListItem[]>([]);
  const [current, setCurrent] = React.useState<LoadedStatus | null>(null);
  const [currentUrl, setCurrentUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [index, setIndex] = React.useState(0);
  const clientRef = React.useRef<StatusFetchClient | null>(null);
  const seenRef = React.useRef<Set<string>>(new Set());

  // Hold a stable reference to the item array for the auto-fetch
  // callback below so we can pick the first unseen without re-wiring
  // handlers on every re-render.
  const itemsRef = React.useRef<StatusListItem[]>([]);
  itemsRef.current = items;

  React.useEffect(() => {
    const client = new StatusFetchClient({
      ownerAccountId,
      viewerAccountId,
      handlers: {
        onStateChange: (s) => setState(s),
        onStatusList: (next) => {
          setItems(next);
          if (next.length === 0) return;
          // Auto-fetch the first status we have not already loaded.
          const firstIdx = next.findIndex((i) => !seenRef.current.has(i.statusId));
          if (firstIdx >= 0) {
            setIndex(firstIdx);
            seenRef.current.add(next[firstIdx].statusId);
            void client.fetchStatus(next[firstIdx].statusId);
          }
        },
        onStatusBlob: (statusId, blob, overlays, kind) => {
          setCurrent({ statusId, blob, overlays, kind });
        },
        onError: (msg) => setError(msg),
      },
    });
    clientRef.current = client;
    void client.connect();
    return () => {
      clientRef.current = null;
      void client.close();
    };
  }, [ownerAccountId, viewerAccountId]);

  React.useEffect(() => {
    if (!current) {
      setCurrentUrl(null);
      return;
    }
    const url = URL.createObjectURL(current.blob);
    setCurrentUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [current]);

  const goTo = React.useCallback(
    (nextIndex: number) => {
      const list = itemsRef.current;
      if (list.length === 0) return;
      const clamped = Math.max(0, Math.min(list.length - 1, nextIndex));
      setIndex(clamped);
      const item = list[clamped];
      if (!item) return;
      seenRef.current.add(item.statusId);
      setCurrent(null);
      setError(null);
      const client = clientRef.current;
      if (client) void client.fetchStatus(item.statusId);
    },
    [],
  );

  const isOffline = state === "offline";
  const isEnded = state === "ended";
  const isLoading =
    state === "connecting" ||
    state === "listing" ||
    state === "fetching" ||
    (state === "ready" && !current);
  const hasItems = items.length > 0;

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#000",
        color: NEX.text,
        fontFamily: "Inter, system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 14px)",
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/nex-native/status/contacts")}
          aria-label="Back"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "rgba(2, 9, 20, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            color: NEX.text,
            fontSize: 18,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ←
        </button>
        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(2, 9, 20, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            color: NEX.text,
            fontSize: 11,
            fontWeight: 800,
            maxWidth: 220,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {ownerAccountId}
        </div>
      </div>

      {/* Chapter progress */}
      {hasItems && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "max(env(safe-area-inset-top, 0px), 8px)",
            left: 16,
            right: 16,
            display: "flex",
            gap: 4,
            zIndex: 9,
          }}
        >
          {items.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 999,
                background:
                  i < index
                    ? "rgba(255, 255, 255, 0.9)"
                    : i === index
                      ? NEX.cyan
                      : "rgba(255, 255, 255, 0.25)",
              }}
            />
          ))}
        </div>
      )}

      {/* Media + overlays · or state screen */}
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {isOffline && (
          <StateScreen
            icon="📡"
            title="Owner is not online"
            body="Status is only visible while the owner's device is online. Try again later."
          />
        )}
        {isEnded && !current && !isOffline && (
          <StateScreen
            icon="🏁"
            title="Session ended"
            body="The owner's device has gone away."
          />
        )}
        {!isOffline && !isEnded && isLoading && !current && (
          <div style={{ color: NEX.textDim, fontSize: 13, textAlign: "center" }}>
            {state === "connecting" && "Connecting to owner…"}
            {state === "listing" && "Reading status list…"}
            {state === "fetching" && "Receiving status…"}
            {state === "ready" && !hasItems && "No active statuses"}
            {state === "ready" && hasItems && "Preparing…"}
          </div>
        )}
        {error && !current && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "absolute",
              bottom: 100,
              left: 16,
              right: 16,
              padding: 12,
              borderRadius: 12,
              background: "rgba(255, 51, 85, 0.18)",
              border: "1px solid rgba(255, 51, 85, 0.42)",
              color: NEX.red,
              fontSize: 12,
              textAlign: "center",
              zIndex: 9,
            }}
          >
            {error}
          </div>
        )}
        {current && currentUrl && (
          <>
            {current.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentUrl}
                alt="Peer status"
                style={{ maxWidth: "100%", maxHeight: "100dvh", objectFit: "contain" }}
              />
            ) : (
              <video
                src={currentUrl}
                autoPlay
                loop
                playsInline
                controls={false}
                style={{ maxWidth: "100%", maxHeight: "100dvh", objectFit: "contain" }}
              />
            )}
            {current.overlays.map((o) => (
              <StatusOverlayRender key={o.layerIndex} overlay={o} />
            ))}
          </>
        )}
      </div>

      {/* Bottom nav · prev / next · only when we have items */}
      {hasItems && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)",
            background: "linear-gradient(0deg, rgba(0, 0, 0, 0.7), transparent)",
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index <= 0}
            style={navBtnStyle(index > 0)}
          >
            ← Prev
          </button>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              background: "rgba(2, 9, 20, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: NEX.text,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {index + 1} / {items.length}
          </div>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={index >= items.length - 1}
            style={navBtnStyle(index < items.length - 1)}
          >
            Next →
          </button>
        </div>
      )}
    </main>
  );
}

function navBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 999,
    background: enabled ? "rgba(0, 175, 255, 0.14)" : "rgba(255, 255, 255, 0.06)",
    border: `1px solid ${enabled ? NEX.cyanBorder : "rgba(255, 255, 255, 0.1)"}`,
    color: enabled ? NEX.cyan : NEX.textMute,
    fontSize: 12,
    fontWeight: 800,
    cursor: enabled ? "pointer" : "default",
    fontFamily: "inherit",
    minHeight: 40,
  };
}

function StateScreen({
  icon,
  title,
  body,
}: {
  readonly icon: string;
  readonly title: string;
  readonly body: string;
}): React.JSX.Element {
  return (
    <div style={{ textAlign: "center", padding: 24, maxWidth: 320 }}>
      <div style={{ fontSize: 36, marginBottom: 10 }} aria-hidden>
        {icon}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: NEX.text }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: NEX.textDim, lineHeight: 1.5 }}>
        {body}
      </div>
    </div>
  );
}
