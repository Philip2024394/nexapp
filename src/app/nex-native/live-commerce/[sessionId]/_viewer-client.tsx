"use client";

// src/app/nex-native/live-commerce/[sessionId]/_viewer-client.tsx
//
// Viewer surface · receives the broadcaster's camera via WebRTC
// (sendonly from broadcaster · recvonly here). State-overlay copy is
// state-aware. Order-now routing lives on top of this shell · the
// featured-product overlay renders via `openFeaturedProductChannel`
// (a dedicated Supabase Realtime channel · see
// src/lib/nex-native/live-broadcast/featured-product-channel.ts).
//
// Honest states (map to engine):
//   · waiting · we're on the presence channel, broadcaster not seen yet
//   · connecting · offer received, SDP exchanged
//   · live · remote stream rendering
//   · ended · broadcaster left
//   · at-capacity · we were rejected (10-viewer pilot cap reached)
//   · offline · no broadcaster seen within 10 seconds

import * as React from "react";
import { useRouter } from "next/navigation";
import { LiveViewerClient } from "@/lib/nex-native/live-broadcast/viewer-client";
import type {
  LivePresenceMember,
  LiveViewerState,
} from "@/lib/nex-native/live-broadcast/types";
import {
  openFeaturedProductChannel,
  type FeaturedProductChannelHandle,
} from "@/lib/nex-native/live-broadcast/featured-product-channel";
import {
  ProductOverlayCard,
  type LiveProductSnapshot,
} from "@/components/nex-native/live-commerce/ProductOverlayCard";

const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  red: "#FF3355",
  amber: "#F59E0B",
} as const;

export function LiveViewerPage({
  sessionId,
  viewerAccountId,
}: {
  readonly sessionId: string;
  readonly viewerAccountId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [state, setState] = React.useState<LiveViewerState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [broadcasterAccountId, setBroadcasterAccountId] = React.useState<string | null>(null);
  const [featuredProduct, setFeaturedProduct] =
    React.useState<LiveProductSnapshot | null>(null);
  const viewerClientRef = React.useRef<LiveViewerClient | null>(null);
  const featuredChannelRef =
    React.useRef<FeaturedProductChannelHandle | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  // Owner directive 2026-10-22 · identity-sealing · the viewer id is
  // now the signed-in NEX account id resolved server-side. The old
  // sessionStorage/crypto.randomUUID fallback is removed · a signed-
  // in UUID is always available by the time this client mounts.

  React.useEffect(() => {
    const client = new LiveViewerClient({
      onStateChange: (next) => setState(next),
      onRemoteStream: (stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      },
      onPresenceChange: (members: readonly LivePresenceMember[]) => {
        const broadcaster = members.find((m) => m.role === "broadcaster");
        setBroadcasterAccountId(broadcaster ? broadcaster.accountId : null);
      },
      onError: (msg) => setError(msg),
    });
    viewerClientRef.current = client;
    void client.join({
      sessionId,
      viewerAccountId,
      viewerDisplayName: "Viewer",
    });

    // Featured-product channel · opens alongside the viewer client so
    // overlay propagation is independent of WebRTC readiness. A
    // late-joiner sees the current featured state via the presence
    // sync on this channel (see featured-product-channel.ts).
    const featuredChannel = openFeaturedProductChannel({
      sessionId,
      role: "viewer",
      onFeaturedChange: (p) => setFeaturedProduct(p),
    });
    featuredChannelRef.current = featuredChannel;

    return () => {
      void client.leave();
      void featuredChannel.close();
      viewerClientRef.current = null;
      featuredChannelRef.current = null;
    };
  }, [sessionId, viewerAccountId]);

  // Order-now routing · the chat page accepts live_session_id and
  // pending_product so the overlay card can hand off into the existing
  // peer-chat surface without a separate order primitive.
  const handleOrderNow = React.useCallback(
    (productId: string) => {
      if (!broadcasterAccountId) {
        setError("Can't open chat yet · broadcaster not identified.");
        return;
      }
      const params = new URLSearchParams({
        pending_product: productId,
        live_session_id: sessionId,
      });
      router.push(`/nex-native/chat/peer/${broadcasterAccountId}?${params.toString()}`);
    },
    [broadcasterAccountId, sessionId, router],
  );

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Video surface · fills the viewport */}
      <div
        style={{
          flex: 1,
          position: "relative",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
        {state !== "live" && (
          <StateOverlay state={state} error={error} />
        )}
        {state === "live" && featuredProduct && (
          <ProductOverlayCard
            product={featuredProduct}
            onOrderNow={handleOrderNow}
          />
        )}
      </div>

      {/* Top-right live indicator */}
      {state === "live" && (
        <div
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0px) + 14px)",
            right: 14,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(255, 51, 85, 0.14)",
            border: `1px solid rgba(255, 51, 85, 0.42)`,
            color: NEX.red,
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 0.4,
          }}
        >
          ● LIVE
        </div>
      )}
    </main>
  );
}

function StateOverlay({
  state,
  error,
}: {
  readonly state: LiveViewerState;
  readonly error: string | null;
}): React.JSX.Element {
  const copy = (() => {
    switch (state) {
      case "idle":
      case "waiting":
        return { title: "Connecting to live stream…", body: "Looking for the broadcaster · one moment." };
      case "connecting":
        return { title: "Negotiating…", body: "Connecting the video stream to your device." };
      case "live":
        return { title: "Live", body: "" };
      case "ended":
        return { title: "Stream ended", body: "The broadcaster has gone offline. Tap below to go back." };
      case "at-capacity":
        return { title: "At capacity", body: "This stream is at its 10-viewer pilot limit. Try again shortly." };
      case "offline":
        return { title: "No one broadcasting", body: "This session is not live right now." };
      default:
        return { title: "", body: "" };
    }
  })();

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(2, 9, 20, 0.78)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 320 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }} aria-hidden>
          {state === "ended" ? "📺" : state === "at-capacity" ? "👥" : state === "offline" ? "💤" : "⌛"}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
          {copy.title}
        </div>
        <div style={{ fontSize: 13, color: NEX.textDim, lineHeight: 1.5 }}>
          {copy.body}
        </div>
        {error && (
          <div
            style={{
              marginTop: 14,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(255, 51, 85, 0.14)",
              border: `1px solid rgba(255, 51, 85, 0.42)`,
              color: NEX.red,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
