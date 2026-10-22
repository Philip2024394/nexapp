"use client";

// src/app/nex-native/live-commerce/go-live/_go-live-client.tsx
//
// Broadcaster surface for NEX Live Commerce. Captures camera via
// LiveBroadcastEngine (pure device-side), announces presence on
// Supabase Realtime, and relays WebRTC offers to each viewer that
// joins. Zero NEX media storage · zero per-minute vendor cost.
//
// Pilot constraints (sealed in engine):
//   · 10 viewer cap (bandwidth math on 4G broadcaster uplink)
//   · STUN only · TURN relay deferred to Phase 2
//
// Featured product: broadcaster-side picker lives in this file ·
// `openFeaturedProductChannel` broadcasts the currently-featured
// product to every viewer. For the demo we read the catalog from
// CRISPY_CHICKEN_MOCK · when the broadcaster surface is wired to a
// real nex_business, the product list will come from the owner's
// nex_product rows.

import * as React from "react";
import { useRouter } from "next/navigation";
import { LiveBroadcastEngine } from "@/lib/nex-native/live-broadcast/broadcast-engine";
import type { LiveBroadcastState } from "@/lib/nex-native/live-broadcast/types";
import {
  openFeaturedProductChannel,
  type FeaturedProductChannelHandle,
} from "@/lib/nex-native/live-broadcast/featured-product-channel";
import type { LiveProductSnapshot } from "@/components/nex-native/live-commerce/ProductOverlayCard";
import { CRISPY_CHICKEN_MOCK } from "@/app/nex-native/cover/mock-data";

const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.3)",
  cyanBorder: "rgba(0, 175, 255, 0.42)",
  orange: "#FF7200",
  red: "#FF3355",
  green: "#16D66B",
} as const;

/** Build a stable LiveProductSnapshot from the mock-data product shape.
 *  Keeps the mapping local so when real nex_product rows arrive we edit
 *  one function here (not every call-site) to produce the snapshot. */
function toSnapshot(
  product: (typeof CRISPY_CHICKEN_MOCK.products)[number],
  shopName: string,
): LiveProductSnapshot {
  const stock: LiveProductSnapshot["stockStatus"] =
    product.stock_status === "sold_out"
      ? "sold_out"
      : product.stock_status === "low_stock"
        ? "low_stock"
        : "in_stock";
  return {
    productId: product.id,
    name: product.name,
    imageUrl: product.image_url ?? null,
    // Demo formatter · Rp cents → Rp xxx,xxx. Real pricing uses the
    // shared formatter at /lib/nex-native/pricing · wired in Phase 2.
    priceLabel: formatIdrFromCents(product.price_pence),
    shopName,
    stockStatus: stock,
    hasVariants: false,
  };
}

function formatIdrFromCents(cents: number): string {
  const whole = Math.round(cents / 100);
  const grouped = whole.toLocaleString("id-ID");
  return `Rp ${grouped}`;
}

export function GoLiveClient({
  selfAccountId,
}: {
  readonly selfAccountId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [state, setState] = React.useState<LiveBroadcastState>("idle");
  const [viewerCount, setViewerCount] = React.useState<number>(0);
  const [muted, setMuted] = React.useState(false);
  const [cameraOff, setCameraOff] = React.useState(false);
  // Generated on client mount only · a useState initializer runs on
  // the server too and produces a different UUID at hydration, which
  // triggers a React hydration mismatch on the sessionId code line.
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (sessionId) return;
    setSessionId(
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `live-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    );
  }, [sessionId]);
  const [error, setError] = React.useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [featured, setFeatured] =
    React.useState<LiveProductSnapshot | null>(null);
  const engineRef = React.useRef<LiveBroadcastEngine | null>(null);
  const localVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const featuredChannelRef =
    React.useRef<FeaturedProductChannelHandle | null>(null);

  const startBroadcast = React.useCallback(() => {
    if (!sessionId) return;
    const sid = sessionId;
    setError(null);
    const engine = new LiveBroadcastEngine({
      onStateChange: (next) => {
        setState(next);
        // Featured-product channel opens AFTER engine.start() succeeds
        // (state === "live"). Opening it here (as a side-effect of the
        // state transition) keeps the "channel open iff live" invariant
        // without racing engine.start().
        if (next === "live" && !featuredChannelRef.current) {
          featuredChannelRef.current = openFeaturedProductChannel({
            sessionId: sid,
            role: "broadcaster",
          });
        }
      },
      onLocalStream: (stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      },
      onViewerCountChange: (count) => setViewerCount(count),
      onError: (msg) => setError(msg),
    });
    engineRef.current = engine;
    void engine.start({
      sessionId: sid,
      selfAccountId,
      selfDisplayName: "Me",
    });
  }, [sessionId, selfAccountId]);

  const endBroadcast = React.useCallback(async () => {
    const engine = engineRef.current;
    const featuredChannel = featuredChannelRef.current;
    if (featuredChannel) {
      await featuredChannel.close();
      featuredChannelRef.current = null;
    }
    setFeatured(null);
    setPickerOpen(false);
    if (!engine) return;
    await engine.leave();
    engineRef.current = null;
    router.push("/nex-native/chat");
  }, [router]);

  React.useEffect(() => {
    return () => {
      const engine = engineRef.current;
      if (engine) void engine.leave();
      const featuredChannel = featuredChannelRef.current;
      if (featuredChannel) void featuredChannel.close();
      engineRef.current = null;
      featuredChannelRef.current = null;
    };
  }, []);

  const toggleMute = React.useCallback(() => {
    const next = !muted;
    setMuted(next);
    engineRef.current?.setMuted(next);
  }, [muted]);

  const toggleCamera = React.useCallback(() => {
    const next = !cameraOff;
    setCameraOff(next);
    engineRef.current?.setCameraOff(next);
  }, [cameraOff]);

  const handlePickProduct = React.useCallback(
    (snapshot: LiveProductSnapshot) => {
      setFeatured(snapshot);
      setPickerOpen(false);
      void featuredChannelRef.current?.setFeatured(snapshot);
    },
    [],
  );

  const handleClearProduct = React.useCallback(() => {
    setFeatured(null);
    void featuredChannelRef.current?.setFeatured(null);
  }, []);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${NEX.cyanSoft}`,
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.5,
              color: state === "live" ? NEX.red : NEX.cyan,
              textTransform: "uppercase",
            }}
          >
            {state === "live" ? "● Live" : "Broadcaster"}
          </div>
          <h1
            style={{
              margin: "2px 0 0",
              fontSize: 20,
              fontWeight: 800,
              color: NEX.text,
            }}
          >
            Go Live
          </h1>
          <div style={{ fontSize: 11, color: NEX.textMute, marginTop: 2 }}>
            Pilot · 10 viewer cap · streams from your device · nothing stored on NEX
          </div>
        </div>
        {state === "live" && (
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(0, 175, 255, 0.14)",
              border: `1px solid ${NEX.cyanBorder}`,
              fontSize: 11,
              fontWeight: 800,
              color: NEX.cyan,
              flexShrink: 0,
            }}
          >
            👁 {viewerCount} viewer{viewerCount === 1 ? "" : "s"}
          </div>
        )}
      </header>

      {/* Camera preview */}
      <div
        style={{
          flex: 1,
          position: "relative",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scaleX(-1)",
          }}
        />
        {state === "idle" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "rgba(2, 9, 20, 0.72)",
              padding: 24,
            }}
          >
            <div style={{ textAlign: "center", maxWidth: 320 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }} aria-hidden>📺</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                Ready to broadcast
              </div>
              <div style={{ fontSize: 13, color: NEX.textDim, lineHeight: 1.5, marginBottom: 20 }}>
                Your camera and microphone will stream directly to viewers who join · NEX never receives the video · 10 viewer limit for the pilot.
              </div>
              <button
                type="button"
                onClick={startBroadcast}
                style={{
                  minHeight: 48,
                  padding: "0 24px",
                  borderRadius: 12,
                  background: NEX.cyan,
                  color: "#031018",
                  border: "none",
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  touchAction: "manipulation",
                }}
              >
                Start broadcast
              </button>
            </div>
          </div>
        )}
        {state === "requesting-media" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "rgba(2, 9, 20, 0.72)",
            }}
          >
            <div style={{ fontSize: 14, color: NEX.textDim }}>
              Requesting camera permission…
            </div>
          </div>
        )}

        {/* Feature-a-product floating button · live only · bottom-right */}
        {state === "live" && (
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            aria-controls="nex-live-product-picker"
            data-nex-live-feature-button
            style={{
              position: "absolute",
              bottom: 20,
              right: 14,
              minHeight: 44,
              padding: "0 16px",
              borderRadius: 999,
              background: pickerOpen
                ? NEX.cyan
                : "rgba(2, 9, 20, 0.78)",
              color: pickerOpen ? "#031018" : NEX.cyan,
              border: `1px solid ${NEX.cyanBorder}`,
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 0.3,
              cursor: "pointer",
              fontFamily: "inherit",
              touchAction: "manipulation",
              boxShadow: "0 10px 28px -10px rgba(0, 0, 0, 0.6)",
              zIndex: 25,
            }}
          >
            {featured ? "Change product" : "Feature a product"}
          </button>
        )}

        {/* Product picker tray · inline anchored above the floating button */}
        {state === "live" && pickerOpen && (
          <div
            id="nex-live-product-picker"
            role="dialog"
            aria-label="Pick a product to feature"
            data-nex-live-product-picker
            style={{
              position: "absolute",
              bottom: 76,
              right: 14,
              width: "min(340px, calc(100vw - 28px))",
              maxHeight: "min(60vh, 420px)",
              overflowY: "auto",
              background: "rgba(2, 9, 20, 0.92)",
              border: `1px solid ${NEX.cyanBorder}`,
              borderRadius: 14,
              padding: 10,
              zIndex: 24,
              boxShadow: "0 14px 36px -12px rgba(0, 0, 0, 0.72)",
              backdropFilter: "blur(14px) saturate(140%)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 0.5,
                color: NEX.cyan,
                textTransform: "uppercase",
                padding: "4px 6px 10px",
              }}
            >
              {CRISPY_CHICKEN_MOCK.businessName} · pick a product
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {CRISPY_CHICKEN_MOCK.products.map((p) => {
                const snapshot = toSnapshot(
                  p,
                  CRISPY_CHICKEN_MOCK.businessName,
                );
                const isActive = featured?.productId === snapshot.productId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePickProduct(snapshot)}
                    data-nex-live-product-pick={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 8,
                      borderRadius: 10,
                      background: isActive
                        ? "rgba(0, 175, 255, 0.18)"
                        : "rgba(255, 255, 255, 0.04)",
                      border: `1px solid ${
                        isActive ? NEX.cyanBorder : "rgba(255, 255, 255, 0.08)"
                      }`,
                      color: NEX.text,
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      touchAction: "manipulation",
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        flexShrink: 0,
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: snapshot.imageUrl
                          ? `url(${snapshot.imageUrl}) center / cover no-repeat, #0A1526`
                          : "linear-gradient(135deg, rgba(0, 175, 255, 0.22), #0A1526)",
                        border: `1px solid ${NEX.cyanBorder}`,
                        display: "grid",
                        placeItems: "center",
                        color: NEX.cyan,
                        fontSize: 14,
                        fontWeight: 900,
                      }}
                    >
                      {!snapshot.imageUrl
                        ? snapshot.name
                            .split(" ")
                            .map((w) => w[0])
                            .filter(Boolean)
                            .slice(0, 2)
                            .join("")
                        : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: NEX.text,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {snapshot.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 900,
                          color: NEX.cyan,
                        }}
                      >
                        {snapshot.priceLabel}
                      </div>
                    </div>
                    {isActive && (
                      <div
                        aria-hidden
                        style={{
                          fontSize: 10,
                          fontWeight: 900,
                          letterSpacing: 0.4,
                          textTransform: "uppercase",
                          color: NEX.cyan,
                        }}
                      >
                        Featured
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: "10px 16px",
            background: "rgba(255, 51, 85, 0.14)",
            borderTop: `1px solid rgba(255, 51, 85, 0.42)`,
            color: NEX.red,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      {/* Currently-featured chip · above the controls bar */}
      {state === "live" && featured && (
        <div
          data-nex-live-featured-chip
          style={{
            padding: "10px 16px",
            background: "rgba(0, 175, 255, 0.08)",
            borderTop: `1px solid ${NEX.cyanSoft}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 12,
            color: NEX.text,
            fontWeight: 700,
            flexShrink: 0,
            boxSizing: "border-box",
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: NEX.cyan,
            }}
          >
            Featuring
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {featured.name}
          </span>
          <span style={{ color: NEX.cyan, fontWeight: 900 }}>
            {featured.priceLabel}
          </span>
          <button
            type="button"
            onClick={handleClearProduct}
            data-nex-live-feature-hide
            style={{
              minHeight: 32,
              padding: "0 12px",
              borderRadius: 999,
              background: "transparent",
              color: NEX.textDim,
              border: `1px solid rgba(255, 255, 255, 0.18)`,
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              touchAction: "manipulation",
            }}
          >
            Hide product
          </button>
        </div>
      )}

      {/* Controls */}
      {state === "live" && (
        <div
          style={{
            padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)",
            background: "rgba(2, 9, 20, 0.92)",
            borderTop: `1px solid ${NEX.cyanSoft}`,
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            flexShrink: 0,
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            onClick={toggleMute}
            style={{
              minHeight: 44,
              padding: "0 14px",
              borderRadius: 999,
              background: muted ? NEX.red : "rgba(255, 255, 255, 0.08)",
              color: muted ? "#FFFFFF" : NEX.text,
              border: `1px solid ${muted ? NEX.red : "rgba(255, 255, 255, 0.14)"}`,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              touchAction: "manipulation",
            }}
          >
            {muted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            onClick={toggleCamera}
            style={{
              minHeight: 44,
              padding: "0 14px",
              borderRadius: 999,
              background: cameraOff ? NEX.red : "rgba(255, 255, 255, 0.08)",
              color: cameraOff ? "#FFFFFF" : NEX.text,
              border: `1px solid ${cameraOff ? NEX.red : "rgba(255, 255, 255, 0.14)"}`,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              touchAction: "manipulation",
            }}
          >
            {cameraOff ? "Camera on" : "Camera off"}
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={endBroadcast}
            style={{
              minHeight: 44,
              padding: "0 18px",
              borderRadius: 999,
              background: NEX.red,
              color: "#FFFFFF",
              border: "none",
              fontSize: 12,
              fontWeight: 900,
              cursor: "pointer",
              fontFamily: "inherit",
              touchAction: "manipulation",
            }}
          >
            End broadcast
          </button>
        </div>
      )}

      {/* Pilot-only footer honesty */}
      <div
        style={{
          padding: "8px 16px calc(env(safe-area-inset-bottom, 0px) + 8px)",
          fontSize: 10,
          color: NEX.textMute,
          textAlign: "center",
          lineHeight: 1.5,
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      >
        {sessionId ? (
          <>
            Session ·{" "}
            <code style={{ fontFamily: "monospace" }}>
              {sessionId.slice(0, 8)}
            </code>{" "}
            · share{" "}
            <code style={{ fontFamily: "monospace" }}>
              /nex-native/live-commerce/{sessionId}
            </code>{" "}
            with viewers
          </>
        ) : (
          <>Preparing session…</>
        )}
      </div>
    </main>
  );
}
