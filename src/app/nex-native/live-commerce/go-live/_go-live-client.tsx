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
import type {
  LiveBroadcastState,
  LivePresenceMember,
} from "@/lib/nex-native/live-broadcast/types";
import {
  openFeaturedProductChannel,
  type FeaturedProductChannelHandle,
} from "@/lib/nex-native/live-broadcast/featured-product-channel";
import {
  openJailChannel,
  type JailChannelHandle,
} from "@/lib/nex-native/live-broadcast/jail-channel";
import type { LiveProductSnapshot } from "@/components/nex-native/live-commerce/ProductOverlayCard";
import { JailPickerSheet } from "@/components/nex-native/live-commerce/JailPickerSheet";
import {
  startLiveSessionAction,
  endLiveSessionAction,
  setLiveFeaturedProductAction,
  clearLiveFeaturedProductAction,
  touchLiveHeartbeatAction,
} from "./_actions";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/nex-native/live-broadcast/stale-session-policy";

/* Phase 2 · G2 · real-catalog entry shape produced by page.tsx.
 * Server component reads nex_product via productService and projects
 * the subset the broadcaster surface needs. Keeps the client bundle
 * free of DB types. */
export interface RealLiveCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly price_pence: number;
  readonly currency: string;
  readonly image_url: string | null;
}

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

/** Build a stable LiveProductSnapshot from a real nex_product row.
 *  Phase 2 · G2 · replaces the sealed CRISPY_CHICKEN_MOCK path.
 *  The seller-insight dashboard conventions use the same price-pence
 *  → formatted-string shape · kept here to avoid a cross-slice import. */
function toSnapshotFromReal(
  product: RealLiveCatalogEntry,
  shopName: string,
): LiveProductSnapshot {
  return {
    productId: product.id,
    name: product.name,
    imageUrl: product.image_url,
    priceLabel: formatPrice(product.price_pence, product.currency),
    shopName,
    // Phase 2 pilot: stock-status + variant signals not yet threaded
    // through the Live surface. Default to "in_stock" so the viewer
    // badge is honest-neutral (no overclaim).
    stockStatus: "in_stock",
    hasVariants: false,
  };
}

function formatPrice(cents: number, currency: string): string {
  const whole = Math.round(cents / 100);
  const grouped = whole.toLocaleString("id-ID");
  const sym = currency === "IDR" ? "Rp " : `${currency} `;
  return `${sym}${grouped}`;
}

export function GoLiveClient({
  selfAccountId,
  realCatalog,
  businessDisplayName,
}: {
  readonly selfAccountId: string;
  /* Phase 2 · G2 · broadcaster's own nex_product rows, projected
     server-side in page.tsx. Empty array = free-tier broadcaster
     (no owned business) → no featured-product UI. */
  readonly realCatalog: readonly RealLiveCatalogEntry[];
  readonly businessDisplayName: string | null;
}): React.JSX.Element {
  const router = useRouter();
  const [state, setState] = React.useState<LiveBroadcastState>("idle");
  const [viewerCount, setViewerCount] = React.useState<number>(0);
  const [muted, setMuted] = React.useState(false);
  const [cameraOff, setCameraOff] = React.useState(false);
  /* Phase 2 · G2 · the DB-side session UUID returned by
     startLiveSessionAction. Distinct from the Realtime channel
     discriminator `sessionId` below (which is a client-generated
     string used only for Supabase Realtime topic names). The DB id
     is required to call setFeaturedProduct / endSession on the
     server. Fail-open: if the server action fails, the Realtime
     broadcast still works · the featured-product state is just not
     persisted (viewer UI continues to reconcile via Realtime). */
  const dbSessionIdRef = React.useRef<string | null>(null);
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
  // Jail controls · owner-authorised 2026-10-25 · broadcaster can
  // issue a 10-minute timeout to a specific viewer. Picker sheet
  // shares the owner rail with the Product picker; the two are
  // mutually exclusive (opening Jail closes Product and vice versa).
  const [jailPickerOpen, setJailPickerOpen] = React.useState(false);
  const [presenceViewers, setPresenceViewers] = React.useState<
    readonly LivePresenceMember[]
  >([]);
  const engineRef = React.useRef<LiveBroadcastEngine | null>(null);
  const localVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const featuredChannelRef =
    React.useRef<FeaturedProductChannelHandle | null>(null);
  const jailChannelRef = React.useRef<JailChannelHandle | null>(null);

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
          // Jail channel · broadcaster-side · owner-authorised
          // 2026-10-25. Opens alongside the featured-product channel
          // because both are tied to the live state transition. We
          // open on "live" so no jail event can be issued before
          // viewers can receive it.
          jailChannelRef.current = openJailChannel({
            sessionId: sid,
            role: "broadcaster",
          });
          /* Phase 2 · G2 · once Realtime signalling is live, persist
             the session to nex_live_session so the central Live feed,
             profile heartbeat and product indicator see it. Fire-and-
             await: if the server action fails, we surface a non-fatal
             error but the live stream continues (viewers still connect
             via Realtime). This is the saved-plan §5.4 "DB remains
             authoritative" contract. */
          void startLiveSessionAction()
            .then((r) => {
              if (r.ok) {
                dbSessionIdRef.current = r.data.sessionId;
              } else {
                setError(`live-session persist failed: ${r.reason}`);
              }
            })
            .catch((e) => {
              setError(
                `live-session persist error: ${
                  e instanceof Error ? e.message : String(e)
                }`,
              );
            });
        }
      },
      onLocalStream: (stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      },
      onViewerCountChange: (count) => setViewerCount(count),
      onPresenceChange: (members) => {
        // Keep the full roster so the jail picker can list each
        // viewer by display name. Filter out the broadcaster
        // themselves (role === "broadcaster") so a self-jail is
        // impossible. The 10-viewer cap on the engine side already
        // bounds this list.
        setPresenceViewers(
          members.filter((m) => m.role !== "broadcaster"),
        );
      },
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
    /* Phase 2 · G2 · persist 'ended' status BEFORE closing the
       Realtime channel so the DB and the viewer transport agree on
       the transition. Fire-and-await · a failure here means the DB
       keeps the session marked 'open' (a future stale-session worker
       auto-ends it). The engine still leaves, viewers still see the
       stream drop. */
    const dbSid = dbSessionIdRef.current;
    if (dbSid) {
      try {
        await endLiveSessionAction({ sessionId: dbSid });
      } catch {
        // Non-fatal · documented limitation.
      }
      dbSessionIdRef.current = null;
    }
    if (featuredChannel) {
      await featuredChannel.close();
      featuredChannelRef.current = null;
    }
    const jailChannel = jailChannelRef.current;
    if (jailChannel) {
      await jailChannel.close();
      jailChannelRef.current = null;
    }
    setFeatured(null);
    setPickerOpen(false);
    setJailPickerOpen(false);
    setPresenceViewers([]);
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
      const jailChannel = jailChannelRef.current;
      if (jailChannel) void jailChannel.close();
      engineRef.current = null;
      featuredChannelRef.current = null;
      jailChannelRef.current = null;
    };
  }, []);

  /* Phase 2 · G2 · stale-session recovery FOUNDATION · while the
     broadcaster is in `live` state, ping touchLiveHeartbeatAction
     every HEARTBEAT_INTERVAL_MS so `nex_live_session.last_heartbeat_at`
     advances. The server read path (stale-session-policy.ts) filters
     out sessions whose heartbeat has aged beyond STALENESS_WINDOW_MS
     so a crashed/closed tab silently disappears from the Live set
     without needing an auto-end worker. See
     src/lib/nex-native/live-broadcast/stale-session-policy.ts.

     Visibility-change handling: when the tab becomes hidden the
     interval pauses to save battery/bandwidth · when the tab
     returns visible we fire an IMMEDIATE catch-up ping (so a
     real broadcast resumes within one ping of focus-return, long
     before the stale-session window elapses) and then resume the
     interval. The engine's WebRTC + Realtime channels are
     unaffected by this effect · the broadcaster peer loop keeps
     running. The heartbeat is purely a liveness signal for READ
     surfaces (directory, profile, product indicator). */
  React.useEffect(() => {
    if (state !== "live") return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const ping = () => {
      const sid = dbSessionIdRef.current;
      if (!sid || cancelled) return;
      void touchLiveHeartbeatAction({ sessionId: sid }).catch(() => {
        // Fail-open · one dropped heartbeat is tolerated by the
        // staleness window (6× the ping interval).
      });
    };

    const startInterval = () => {
      if (timer !== null) return;
      ping();
      timer = setInterval(ping, HEARTBEAT_INTERVAL_MS);
    };
    const stopInterval = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const handleVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        startInterval();
      } else {
        stopInterval();
      }
    };

    // Start · also attach visibility listener so a hidden tab doesn't
    // burn Supabase round-trips. The listener is a no-op in SSR.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      // Tab started hidden · wait for it to become visible before
      // the first ping (STARTUP_GRACE_MS covers the gap on the read
      // side so a visible viewer still sees the session as live for
      // 30s after start).
    } else {
      startInterval();
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    return () => {
      cancelled = true;
      stopInterval();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };
  }, [state]);

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
      // Realtime fast-path (unchanged).
      void featuredChannelRef.current?.setFeatured(snapshot);
      // Phase 2 · G2 · persist to nex_live_featured_product so the
      // product-level Live indicator in the shop stays consistent
      // with what viewers see. Fail-open · UI continues on error.
      const dbSid = dbSessionIdRef.current;
      if (dbSid) {
        void setLiveFeaturedProductAction({
          sessionId: dbSid,
          productId: snapshot.productId,
        }).catch(() => undefined);
      }
    },
    [],
  );

  const handleClearProduct = React.useCallback(() => {
    setFeatured(null);
    void featuredChannelRef.current?.setFeatured(null);
    // Phase 2 · G2 · close the current pin in the DB.
    const dbSid = dbSessionIdRef.current;
    if (dbSid) {
      void clearLiveFeaturedProductAction({ sessionId: dbSid }).catch(
        () => undefined,
      );
    }
  }, []);

  return (
    <main
      style={{
        /* Owner directive 2026-10-24 · "full height image view and
           width on live" · the camera preview becomes an absolute
           fullscreen layer and the header + controls + featured chip
           overlay on top via zIndex. The main container is now
           position-relative + height 100dvh + overflow:hidden so no
           page scroll leaks around the live surface. */
        position: "relative",
        height: "100dvh",
        overflow: "hidden",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          /* Owner directive 2026-10-24 · "remove container from
             header" · header is now overlay-only · no gradient / no
             border / no background · title + viewer-count float
             directly over the fullscreen video. Text drop-shadow
             preserves legibility against any video content. */
          position: "relative",
          zIndex: 2,
          padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          boxSizing: "border-box",
          textShadow: "0 1px 4px rgba(0,0,0,0.55)",
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
            Nex Live
          </h1>
          {/* Owner directive 2026-10-24 · pilot subtitle removed. */}
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

      {/* Camera preview · owner directive 2026-10-24 · "full height
         image view and width on live" · absolute inset-0 so the video
         fills the entire viewport under the overlaid header + controls
         + footer. zIndex 0 keeps it as the base layer. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
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
                Your video and microphone will stream directly to viewers who join · NEX never receives the video · 10 viewer limit for the pilot.
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
              Requesting video access…
            </div>
          </div>
        )}

        {/* Right-rail owner controls · owner directive 2026-10-24 ·
           round black buttons stacked on the right side of the
           fullscreen video. Each item is an icon-circle plus a
           one-word caption. Mute · Video · Product · End. Replaces
           the bottom controls row AND the earlier "Feature a
           product" FAB. */}
        {state === "live" && (
          <div
            data-nex-live-owner-rail
            style={{
              position: "absolute",
              right: 12,
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              zIndex: 25,
            }}
          >
            <OwnerRailButton
              label={muted ? "Unmute" : "Mute"}
              active={muted}
              activeFill={NEX.red}
              onClick={toggleMute}
              icon={
                muted ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M19 11a7 7 0 0 1-14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M19 11a7 7 0 0 1-14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )
              }
            />
            <OwnerRailButton
              label="Video"
              active={cameraOff}
              activeFill={NEX.red}
              onClick={toggleCamera}
              icon={
                cameraOff ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="2" y="7" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M16 10l6-3v10l-6-3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="2" y="7" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M16 10l6-3v10l-6-3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  </svg>
                )
              }
            />
            <OwnerRailButton
              label="Product"
              active={pickerOpen}
              activeFill={NEX.cyan}
              onClick={() => setPickerOpen((v) => !v)}
              ariaControls="nex-live-product-picker"
              ariaExpanded={pickerOpen}
              testid="nex-live-feature-button"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 8h16l-1.5 10a2 2 0 0 1-2 1.75H7.5a2 2 0 0 1-2-1.75L4 8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M9 8V6a3 3 0 1 1 6 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              }
            />
            {/* Timeout · 10-minute viewer mute (sealed name 2026-10-25
                per owner Q1 decision; prior "Jail" wording retired).
                Mutually exclusive with Product picker so the owner
                rail never opens two sheets at once. Internal
                identifiers (jailChannelRef, JailOverlay, data-nex-
                live-jail-button) remain as implementation hooks and
                are not user-visible. */}
            <OwnerRailButton
              label="Timeout"
              active={jailPickerOpen}
              activeFill={NEX.red}
              onClick={() => {
                setJailPickerOpen((v) => !v);
                setPickerOpen(false);
              }}
              ariaControls="nex-jail-picker"
              ariaExpanded={jailPickerOpen}
              testid="nex-live-jail-button"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  {/* Clock-face icon · pairs with the 10-minute timer
                      metaphor on the viewer-side countdown. */}
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            />
            <OwnerRailButton
              label="End"
              active={false}
              activeFill={NEX.red}
              forcedFill={NEX.red}
              onClick={endBroadcast}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                </svg>
              }
            />
          </div>
        )}

        {/* Product picker · owner directive 2026-10-24 · bottom-up
           sheet with landscape product cards (image 112x112 LEFT ·
           meta column RIGHT) mirroring the sealed cover-template
           Template-11 "Product Seller · Landscape" variant from
           src/app/nex-native/cover/primitives.tsx (`isLandscape`
           branch). The sheet anchors to the bottom of the viewport,
           slides up on open, and spans the frame width. Backdrop
           tap closes. */}
        {/* Jail picker sheet · owner-authorised 2026-10-25 · pairs
            with the broadcaster-side jailChannelRef opened on the
            live-state transition. Fire-and-forget: the broadcast is
            best-effort (same pattern as featured-product). */}
        {state === "live" && (
          <JailPickerSheet
            open={jailPickerOpen}
            viewers={presenceViewers.map((m) => ({
              accountId: m.accountId,
              displayName: m.displayName ?? null,
            }))}
            onCancel={() => setJailPickerOpen(false)}
            onConfirm={(accountId) => {
              setJailPickerOpen(false);
              void jailChannelRef.current?.jail(accountId);
            }}
          />
        )}
        {state === "live" && pickerOpen && (
          <>
            <style>{`
              @keyframes nexLiveProductSheetSlideUp {
                from { transform: translateY(100%); }
                to   { transform: translateY(0); }
              }
            `}</style>
            {/* Backdrop · tap to dismiss */}
            <button
              type="button"
              aria-label="Close product picker"
              onClick={() => setPickerOpen(false)}
              data-nex-live-product-picker-backdrop
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0, 0, 0, 0.42)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                zIndex: 23,
                WebkitTapHighlightColor: "transparent",
              }}
            />
            <div
              id="nex-live-product-picker"
              role="dialog"
              aria-label="Pick a product to feature"
              data-nex-live-product-picker
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                maxHeight: "66vh",
                overflowY: "auto",
                background: "rgba(2, 9, 20, 0.94)",
                borderTop: `1px solid ${NEX.cyanBorder}`,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: `14px 14px calc(env(safe-area-inset-bottom, 0px) + 18px)`,
                zIndex: 24,
                boxShadow: "0 -16px 40px -8px rgba(0, 0, 0, 0.72)",
                backdropFilter: "blur(16px) saturate(140%)",
                WebkitBackdropFilter: "blur(16px) saturate(140%)",
                animation:
                  "nexLiveProductSheetSlideUp 220ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {/* Grab handle */}
              <div
                aria-hidden
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.18)",
                  margin: "0 auto 10px",
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 2px 12px",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 0.5,
                    color: NEX.cyan,
                    textTransform: "uppercase",
                  }}
                >
                  {businessDisplayName ?? "Your shop"} · pick a product
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  aria-label="Close"
                  style={{
                    minHeight: 28,
                    minWidth: 28,
                    padding: "0 10px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.08)",
                    color: NEX.textDim,
                    border: "1px solid rgba(255,255,255,0.18)",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    touchAction: "manipulation",
                  }}
                >
                  Close
                </button>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {realCatalog.length === 0 && (
                  <div
                    data-nex-live-product-picker-empty
                    style={{
                      padding: "16px 10px",
                      textAlign: "center",
                      color: NEX.textDim,
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    {businessDisplayName
                      ? "No products in your shop yet · add one in Manage to feature it live."
                      : "Free-tier Live · product features need a Business account + shop."}
                  </div>
                )}
                {realCatalog.map((p) => {
                  const snapshot = toSnapshotFromReal(
                    p,
                    businessDisplayName ?? "Your shop",
                  );
                  const isActive = featured?.productId === snapshot.productId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePickProduct(snapshot)}
                      data-nex-live-product-pick={p.id}
                      style={{
                        /* Landscape card · mirrors the sealed
                           cover-template landscape variant · image
                           112x112 LEFT · meta column RIGHT. */
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "stretch",
                        gap: 0,
                        padding: 0,
                        borderRadius: 12,
                        overflow: "hidden",
                        background: isActive
                          ? "rgba(0, 175, 255, 0.14)"
                          : "rgba(255, 255, 255, 0.04)",
                        border: `1px solid ${
                          isActive ? NEX.cyanBorder : "rgba(255, 255, 255, 0.10)"
                        }`,
                        color: NEX.text,
                        textAlign: "left",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        touchAction: "manipulation",
                        boxShadow: "0 8px 20px -8px rgba(0,0,0,0.5)",
                      }}
                    >
                      <div
                        aria-hidden
                        style={{
                          flex: "0 0 112px",
                          width: 112,
                          height: 112,
                          background: snapshot.imageUrl
                            ? `url(${snapshot.imageUrl}) center / cover no-repeat, #0A1526`
                            : "linear-gradient(135deg, rgba(0, 175, 255, 0.22), #0A1526)",
                          borderRight: `1px solid ${
                            isActive
                              ? NEX.cyanBorder
                              : "rgba(255, 255, 255, 0.08)"
                          }`,
                          display: "grid",
                          placeItems: "center",
                          color: NEX.cyan,
                          fontSize: 18,
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
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          gap: 4,
                          padding: "10px 14px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
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
                            fontSize: 14,
                            fontWeight: 900,
                            color: NEX.cyan,
                            letterSpacing: 0.2,
                          }}
                        >
                          {snapshot.priceLabel}
                        </div>
                        {isActive && (
                          <div
                            style={{
                              marginTop: "auto",
                              fontSize: 9,
                              fontWeight: 900,
                              letterSpacing: 0.5,
                              textTransform: "uppercase",
                              color: NEX.cyan,
                            }}
                          >
                            ● Featured
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {error && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "relative",
            zIndex: 2,
            padding: "10px 16px",
            background: "rgba(255, 51, 85, 0.72)",
            borderTop: `1px solid rgba(255, 51, 85, 0.42)`,
            color: "#FFFFFF",
            fontSize: 12,
            fontWeight: 800,
            backdropFilter: "blur(8px)",
          }}
        >
          {error}
        </div>
      )}

      {/* Spacer · owner directive 2026-10-24 · pushes the live chip +
         controls + footer to the bottom of the viewport once the video
         has become an absolute fullscreen layer. */}
      <div style={{ flex: 1, pointerEvents: "none" }} />

      {/* Currently-featured chip · above the controls bar */}
      {state === "live" && featured && (
        <div
          data-nex-live-featured-chip
          style={{
            position: "relative",
            zIndex: 2,
            padding: "10px 16px",
            background: "rgba(2, 9, 20, 0.70)",
            borderTop: `1px solid ${NEX.cyanSoft}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 12,
            color: NEX.text,
            fontWeight: 700,
            flexShrink: 0,
            boxSizing: "border-box",
            backdropFilter: "blur(10px)",
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

      {/* Owner directive 2026-10-24 · bottom controls pill-row removed.
         The owner-rail (Mute · Video · Product · End) now lives on the
         right side of the fullscreen video, rendered inside the
         camera-preview layer. */}


      {/* Pilot-only footer honesty */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "8px 16px calc(env(safe-area-inset-bottom, 0px) + 8px)",
          fontSize: 10,
          color: NEX.textMute,
          textAlign: "center",
          lineHeight: 1.5,
          flexShrink: 0,
          boxSizing: "border-box",
          background:
            "linear-gradient(0deg, rgba(2,9,20,0.72) 0%, rgba(2,9,20,0.32) 70%, rgba(2,9,20,0) 100%)",
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

/* ─── Owner right-rail round button ─────────────────────────────
 * Owner directive 2026-10-24 · round black icon buttons stacked on
 * the right side of the fullscreen Nex Live view. Each item is an
 * icon-circle plus a one-word caption below. Caller supplies the
 * SVG · label · active state · active-fill colour.
 * ──────────────────────────────────────────────────────────── */
function OwnerRailButton(props: {
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly onClick: () => void;
  readonly active: boolean;
  readonly activeFill: string;
  readonly forcedFill?: string;
  readonly ariaControls?: string;
  readonly ariaExpanded?: boolean;
  readonly testid?: string;
}): React.JSX.Element {
  const fill = props.forcedFill
    ? props.forcedFill
    : props.active
      ? props.activeFill
      : "rgba(0, 0, 0, 0.68)";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <button
        type="button"
        aria-label={props.label}
        aria-controls={props.ariaControls}
        aria-expanded={props.ariaExpanded}
        data-nex-live-rail-button={props.testid ?? undefined}
        onClick={props.onClick}
        style={{
          width: 54,
          height: 54,
          borderRadius: "50%",
          background: fill,
          border: `1px solid ${
            props.active
              ? "rgba(255, 255, 255, 0.32)"
              : "rgba(255, 255, 255, 0.18)"
          }`,
          color: "#FFFFFF",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          fontFamily: "inherit",
          touchAction: "manipulation",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 8px 18px -6px rgba(0, 0, 0, 0.65)",
          padding: 0,
        }}
      >
        {props.icon}
      </button>
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.3,
          color: "#FFFFFF",
          textShadow: "0 1px 3px rgba(0, 0, 0, 0.72)",
          lineHeight: 1,
        }}
      >
        {props.label}
      </span>
    </div>
  );
}
