"use client";

// src/app/nex-native/status/[statusId]/_viewer-client.tsx
//
// Full-screen status viewer · reads from IndexedDB only · zero
// server round-trip. Device-local v1 · the P2P data-channel delivery
// to other viewers is a follow-up slice.
//
// Interactions:
//   · tap center → does nothing (single-slide v1)
//   · back button → return to /nex-native/status
//   · delete button → removes the record from IndexedDB

import * as React from "react";
import { useRouter } from "next/navigation";
import { getStatus, deleteStatus } from "@/lib/nex-native/status-storage/store";
import type {
  StatusOverlay,
  StoredStatus,
} from "@/lib/nex-native/status-storage/types";

const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  red: "#FF3355",
} as const;

export function StatusViewerClient({
  statusId,
}: {
  readonly statusId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = React.useState<StoredStatus | null>(null);
  const [mediaUrl, setMediaUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let revoke: string | null = null;
    void (async () => {
      try {
        const row = await getStatus(statusId);
        if (!row) {
          setError("This status has expired or no longer exists on this device.");
          setLoading(false);
          return;
        }
        if (row.expiresAtMs < Date.now()) {
          setError("This status has expired.");
          setLoading(false);
          return;
        }
        setStatus(row);
        const url = URL.createObjectURL(row.mediaBlob);
        revoke = url;
        setMediaUrl(url);
        setLoading(false);
      } catch (err) {
        setError(
          err && typeof err === "object" && "message" in err
            ? String(err.message)
            : "Could not read status storage.",
        );
        setLoading(false);
      }
    })();
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [statusId]);

  const handleDelete = React.useCallback(async () => {
    try {
      await deleteStatus(statusId);
      router.push("/nex-native/status");
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Could not delete.",
      );
    }
  }, [statusId, router]);

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
      {/* Top bar · minimal */}
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
          onClick={() => router.push("/nex-native/status")}
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
        {status && (
          <ExpiryChip expiresAtMs={status.expiresAtMs} />
        )}
      </div>

      {/* Progress bar · single-slide v1 so just a static bar */}
      {status && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "max(env(safe-area-inset-top, 0px), 8px)",
            left: 16,
            right: 16,
            height: 3,
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.3)",
            zIndex: 9,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 999,
              background: NEX.text,
            }}
          />
        </div>
      )}

      {/* Media + overlays */}
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {loading && (
          <div style={{ color: NEX.textDim, fontSize: 13 }}>Reading…</div>
        )}
        {error && (
          <div style={{ textAlign: "center", padding: 24, maxWidth: 320 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }} aria-hidden>⌛</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
              Not available
            </div>
            <div style={{ fontSize: 12, color: NEX.textDim, lineHeight: 1.5 }}>
              {error}
            </div>
          </div>
        )}
        {!loading && !error && mediaUrl && status && (
          <>
            {status.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl}
                alt="Status"
                style={{ maxWidth: "100%", maxHeight: "100dvh", objectFit: "contain" }}
              />
            ) : (
              <video
                src={mediaUrl}
                autoPlay
                loop
                playsInline
                controls={false}
                style={{ maxWidth: "100%", maxHeight: "100dvh", objectFit: "contain" }}
              />
            )}
            {status.overlays.map((o) => (
              <OverlayRender key={o.layerIndex} overlay={o} />
            ))}
          </>
        )}
      </div>

      {/* Bottom action bar · delete */}
      {status && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)",
            background: "linear-gradient(0deg, rgba(0, 0, 0, 0.7), transparent)",
            display: "flex",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={handleDelete}
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              background: "rgba(255, 51, 85, 0.14)",
              border: "1px solid rgba(255, 51, 85, 0.42)",
              color: NEX.red,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Delete status
          </button>
        </div>
      )}
    </main>
  );
}

function ExpiryChip({ expiresAtMs }: { readonly expiresAtMs: number }): React.JSX.Element {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);
  void tick;
  const remainingMs = Math.max(0, expiresAtMs - Date.now());
  const h = Math.floor(remainingMs / 3_600_000);
  const m = Math.floor((remainingMs % 3_600_000) / 60_000);
  const label = h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  return (
    <div
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(2, 9, 20, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        color: NEX.text,
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      {label}
    </div>
  );
}

function OverlayRender({ overlay }: { readonly overlay: StatusOverlay }): React.JSX.Element {
  const fontMap: Record<StatusOverlay["fontId"], string> = {
    sans: "Inter, system-ui, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    display: "'Bebas Neue', Impact, sans-serif",
    handwriting: "'Caveat', 'Comic Sans MS', cursive",
  };
  const sizeMap = { s: 18, m: 26, l: 38 } as const;
  const anchor =
    overlay.position === "top"
      ? { top: "max(env(safe-area-inset-top, 0px) + 60px, 60px)" }
      : overlay.position === "middle"
        ? { top: "50%", transform: "translateY(-50%)" }
        : { bottom: "max(env(safe-area-inset-bottom, 0px) + 70px, 70px)" };
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: 20,
        right: 20,
        textAlign: overlay.align,
        pointerEvents: "none",
        zIndex: 5,
        ...anchor,
      }}
    >
      <span
        style={{
          display: "inline-block",
          padding: overlay.backgroundTreatment === "none" ? "0" : "6px 12px",
          borderRadius: overlay.backgroundTreatment === "none" ? 0 : 10,
          background:
            overlay.backgroundTreatment === "scrim"
              ? "rgba(2, 9, 20, 0.55)"
              : overlay.backgroundTreatment === "solid"
                ? "rgba(2, 9, 20, 0.9)"
                : "transparent",
          color: overlay.colorHex,
          fontFamily: fontMap[overlay.fontId],
          fontSize: sizeMap[overlay.sizeId],
          fontWeight: overlay.weight === "bold" ? 800 : 500,
          lineHeight: 1.2,
          textShadow: overlay.shadow ? "0 2px 10px rgba(0, 0, 0, 0.7)" : "none",
          wordBreak: "break-word",
        }}
      >
        {overlay.text}
      </span>
    </div>
  );
}
