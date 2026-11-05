"use client";

// src/app/nex-native/live-commerce/enter-broadcast-room/_go-live-client.tsx
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
import { useRouter, useSearchParams } from "next/navigation";
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
// Owner directive 2026-10-28 (revised · "this page will show
// immediately after user press live streaming" · "remove the nex
// profile and text should be Starting Live") · the splash is no
// longer a doorway shown before entry · it is a transitional
// "Starting Live" indicator that fires AFTER the broadcaster taps
// "Enter broadcast room" on the idle surface. It auto-dismisses
// after visibleMs = 3000 ms. Mounts only while `showStartingSplash`
// is true (see below).
import { NexLiveFirstVisitSplash } from "@/components/nex-native/live-commerce/NexLiveFirstVisitSplash";
import { LiveFinishedRecap } from "./_live-finished-recap";
import {
  startLiveSessionAction,
  endLiveSessionAction,
  setLiveFeaturedProductAction,
  clearLiveFeaturedProductAction,
  touchLiveHeartbeatAction,
  issueJailAction,
} from "./_actions";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/nex-native/product-video/stale-session-policy";
// Owner-authorised 2026-10-29 · NEX Music live overlay wiring.
import { NexMusicPlayerOverlay } from "@/components/nex-native/music/NexMusicPlayerOverlay";
import { MusicPlayerDock } from "@/components/nex-native/music/MusicPlayerDock";
import {
  createLiveAudioMixer,
  type LiveAudioMixerHandle,
} from "@/lib/nex-native/music/live-audio-mixer";
import type { NexMusicTrackRow } from "@/lib/nex-native/music/types";
import { getMusicPlayUrlAction } from "@/app/nex-native/create/upload-music/_actions";

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
  bg: "var(--nex-world-background-base, #020914)",
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
  selfAvatarUrl,
  selfDisplayName,
  devMockViewers,
  musicLibrary,
}: {
  readonly selfAccountId: string;
  /* Phase 2 · G2 · broadcaster's own nex_product rows, projected
     server-side in page.tsx. Empty array = free-tier broadcaster
     (no owned business) → no featured-product UI. */
  readonly realCatalog: readonly RealLiveCatalogEntry[];
  readonly businessDisplayName: string | null;
  /** Owner directive 2026-10-28 · broadcaster's `avatar_url` from
   *  the sealed `nex_account` row. Rendered inside the viewer-style
   *  composer pill avatar chip + the Live Finished recap. Null falls
   *  back to the sealed navy-gradient + initial letter. */
  readonly selfAvatarUrl: string | null;
  /** Owner directive 2026-10-29 (Options C + D) · broadcaster's
   *  personal `nex_account.display_name` · rendered in the idle
   *  header identity chip (beside the "Go Live" label) + the
   *  live-state identity caption above the viewer-footer-pill.
   *  Null when the account was unresolved (dev-fallback nil UUID). */
  readonly selfDisplayName: string | null;
  /** Owner-authorised 2026-10-29 (NEX Music · Live overlay) ·
   *  server-rendered shared-live tracks for this broadcaster. Empty
   *  array = no shared tracks yet · the Music right-rail button
   *  renders a hint-and-link to the upload page. */
  readonly musicLibrary: readonly NexMusicTrackRow[];
  /** Owner directive 2026-10-28 · dev-only mock viewers injected
   *  into the broadcaster's presence roster so the Jail picker +
   *  viewerCount pill show seeded personas as if they're watching.
   *  Null in production or when the broadcaster isn't a mock
   *  persona. Each entry carries a real seeded Supabase account id
   *  so the sealed jail-channel broadcasts to the correct target
   *  address (even though no real viewer is listening in dev). */
  readonly devMockViewers:
    | ReadonlyArray<{
        readonly accountId: string;
        readonly displayName: string;
        readonly avatarUrl: string | null;
      }>
    | null;
}): React.JSX.Element {
  const router = useRouter();
  const [state, setState] = React.useState<LiveBroadcastState>("idle");
  const [viewerCount, setViewerCount] = React.useState<number>(0);
  const [muted, setMuted] = React.useState(false);
  const [cameraOff, setCameraOff] = React.useState(false);
  /* Owner directive 2026-10-28 · "this page will show immediately
     after user press live streaming" · the "Starting Live" splash is
     gated on this flag · the idle-state CTA sets it true (and also
     kicks off startBroadcast in parallel so the camera request runs
     under the splash). The splash's own onDismiss handler sets it
     back to false after visibleMs. */
  const [showStartingSplash, setShowStartingSplash] = React.useState(false);

  /* Owner directive 2026-10-28 · "Live Finished" recap · tracks
     start/end timestamps + peak viewer count across the session so
     the recap screen can show honest stats sourced from what we
     actually measure. `peakViewers` is the running max of the
     Realtime presence `viewerCount` (max 10 by sealed engine cap).
     `sessionStartedAt` sets on first live transition and clears on
     recap dismiss so repeat broadcasts in the same mount track
     independently. */
  const [sessionStartedAt, setSessionStartedAt] = React.useState<number | null>(null);
  const [sessionEndedAt, setSessionEndedAt] = React.useState<number | null>(null);
  const [peakViewers, setPeakViewers] = React.useState<number>(0);
  const [showEndedRecap, setShowEndedRecap] = React.useState(false);

  /* Owner directive 2026-10-28 · broadcaster-side jail confirmation
     overlay. When Hendra confirms a jail in the picker sheet, the
     sealed `jailChannelRef.current?.jail(accountId)` fires AND we
     set `jailedUser` so the broadcaster sees a confirmation card
     on her own screen with the target's avatar + name + a live
     10-minute countdown. Auto-dismisses when the countdown hits
     zero (or on manual close). Multiple jails replace the current
     card · one-at-a-time is honest for the pilot. */
  const [jailedUser, setJailedUser] = React.useState<{
    readonly accountId: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
    readonly endsAt: number;
  } | null>(null);
  const [jailRemainingSeconds, setJailRemainingSeconds] = React.useState<number>(0);

  /* Owner-authorised 2026-10-29 · NEX Music · Live overlay state.
     Four UI states + a current-track pointer + the mixer handle.
     "closed" (no overlay, mic-only), "picking" (choose a track),
     "open" (full overlay), "minimised" (dock chip). The mixer is
     constructed lazily on first track selection and torn down on
     explicit close OR when the Live session ends. */
  const [musicUiState, setMusicUiState] = React.useState<
    "closed" | "picking" | "open" | "minimised"
  >("closed");
  const [musicTrackIndex, setMusicTrackIndex] = React.useState<number>(-1);
  const [musicPlayUrl, setMusicPlayUrl] = React.useState<string | null>(null);
  const [musicCoverUrl, setMusicCoverUrl] = React.useState<string | null>(null);
  const [musicBackgroundUrl, setMusicBackgroundUrl] = React.useState<string | null>(null);
  const [musicError, setMusicError] = React.useState<string | null>(null);
  const searchParams = useSearchParams();
  const autoPlayMusic = searchParams?.get("autoPlayMusic") ?? null;
  const autoPlayHandledRef = React.useRef<string | null>(null);
  const musicMixerRef = React.useRef<LiveAudioMixerHandle | null>(null);
  const musicMicTrackRef = React.useRef<MediaStreamTrack | null>(null);
  // Owner-authorised 2026-10-29 (Live analyser exposure) · the
  // mixer's AnalyserNode is populated after `attachMusicElement`
  // completes · the overlay reads from this ref each RAF frame to
  // drive its beat-responsive bars from the one shared audio graph
  // (no second MediaElementSource).
  const musicAnalyserRef = React.useRef<AnalyserNode | null>(null);
  const activeMusicTrack =
    musicTrackIndex >= 0 && musicTrackIndex < musicLibrary.length
      ? musicLibrary[musicTrackIndex]!
      : null;

  /* Owner-authorised 2026-10-29 (preview-first flow) · when the
     author lands here with ?autoPlayMusic={id}, auto-open the
     overlay on that track as soon as state === "live". One-shot
     via `autoPlayHandledRef` so the author can later close the
     overlay without re-firing. */
  React.useEffect(() => {
    if (!autoPlayMusic) return;
    if (state !== "live") return;
    if (autoPlayHandledRef.current === autoPlayMusic) return;
    const idx = musicLibrary.findIndex((t) => t.id === autoPlayMusic);
    if (idx < 0) {
      autoPlayHandledRef.current = autoPlayMusic;
      return;
    }
    autoPlayHandledRef.current = autoPlayMusic;
    void (async () => {
      const r = await getMusicPlayUrlAction({ trackId: autoPlayMusic });
      if (!r.ok) {
        setMusicError(r.message);
        return;
      }
      setMusicTrackIndex(idx);
      setMusicPlayUrl(r.data.signedUrl);
      setMusicCoverUrl(r.data.coverUrl);
      setMusicBackgroundUrl(r.data.backgroundUrl);
      setMusicUiState("open");
    })();
  }, [autoPlayMusic, state, musicLibrary]);

  /* Owner directive 2026-10-28 · "the live stream page control page
     for owner is url - go live" · the broadcaster lands at
     /enter-broadcast-room (idle · the entry screen) and the URL morphs
     to /go-live client-side once the broadcast actually goes live.
     Uses `history.replaceState` instead of router.push so the engine
     + WebRTC + Realtime channels stay mounted across the URL swap.
     On direct refresh of /go-live, the sibling /go-live/page.tsx
     redirect sends the user back here (idle), so there is no stuck
     state. */
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip URL morph while the Live Finished recap is visible · the
    // caller is about to router.push("/feed") on recap dismiss, so a
    // live → idle morph in between would flash the URL back to
    // /enter-broadcast-room before the real navigation lands.
    if (showEndedRecap) return;
    const target =
      state === "live"
        ? "/nex-native/live-commerce/go-live"
        : "/nex-native/live-commerce/enter-broadcast-room";
    if (window.location.pathname !== target) {
      window.history.replaceState(null, "", target);
    }
  }, [state, showEndedRecap]);

  /* Owner directive 2026-10-28 · "Live Finished" session timers.
     Capture startedAt on first live transition. Capture peak viewer
     count as the max of `viewerCount` across the session. Both reset
     when the recap dismisses (see dismissRecap below). */
  React.useEffect(() => {
    if (state === "live" && sessionStartedAt === null) {
      setSessionStartedAt(Date.now());
    }
  }, [state, sessionStartedAt]);
  React.useEffect(() => {
    if (viewerCount > peakViewers) setPeakViewers(viewerCount);
  }, [viewerCount, peakViewers]);

  /* Owner directive 2026-10-28 · "pick 3 names and activate · i
     need to see hendra select a profile" · when the broadcast is
     live AND page.tsx has resolved dev-mock viewers (Hendra +
     NODE_ENV !== production), inject the 3 named personas into
     `presenceViewers` so the Jail picker lists them with avatars
     + the sealed `viewerCount` pill reflects their presence. We
     also set `peakViewers` to at least 3 so the Live Finished
     recap shows an honest number against the mock session. */
  React.useEffect(() => {
    if (state !== "live" || !devMockViewers || devMockViewers.length === 0) return;
    const mapped: readonly LivePresenceMember[] = devMockViewers.map((m) => ({
      accountId: m.accountId,
      displayName: m.displayName,
      role: "viewer" as const,
      joinedAt: Date.now(),
      rejected: null,
    }));
    setPresenceViewers((prev) => {
      // Merge · prefer real presence if it already carries this id.
      const have = new Set(prev.map((p) => p.accountId));
      const additions = mapped.filter((m) => !have.has(m.accountId));
      if (additions.length === 0) return prev;
      return [...prev, ...additions];
    });
    setViewerCount((prev) => Math.max(prev, mapped.length));
  }, [state, devMockViewers]);

  /* Owner directive 2026-10-28 · broadcaster-side jail countdown.
     Ticks every second while `jailedUser` is set. On reaching 0,
     clears the card. The sealed server-side jail duration is 10
     minutes (600 s) · the broadcaster-side countdown mirrors it
     purely visually (no second server timer involved). */
  React.useEffect(() => {
    if (!jailedUser) return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((jailedUser.endsAt - Date.now()) / 1000));
      setJailRemainingSeconds(remaining);
      if (remaining <= 0) setJailedUser(null);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [jailedUser]);
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

  // Owner directive 2026-10-27 · "lock screen from scrolling" · the
  // broadcaster surface is full-bleed over the camera · any residual
  // page scroll (document, body, OR the sealed `.nex-native-frame`
  // scroll container) breaks the immersive feel + lets touch gestures
  // escape into pull-to-refresh. Lock all three while this component
  // is mounted · restore on unmount so other routes (landing, admin,
  // chat) scroll normally again.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    const body = document.body;
    const frame = document.querySelector<HTMLElement>(".nex-native-frame");
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      bodyTouchAction: body.style.touchAction,
      frameOverflow: frame?.style.overflowY ?? "",
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.touchAction = "none";
    if (frame) frame.style.overflowY = "hidden";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      body.style.touchAction = prev.bodyTouchAction;
      if (frame) frame.style.overflowY = prev.frameOverflow;
    };
  }, []);

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
              } else if (r.reason.startsWith("not-eligible:")) {
                // Owner directive 2026-10-27 (R9) · Shop gate rejection ·
                // surface the sealed upsell copy so the broadcaster
                // sees why "Enter broadcast room" refused. We do NOT
                // keep this error silent · unlike not-signed-in, this
                // is a hard product gate, not a dev-only hiccup.
                setError(
                  "Live is a Shop member tool. Shop members can broadcast from their own device to their customers.",
                );
              } else if (r.reason === "not-signed-in") {
                // Owner troubleshoot 2026-10-27 · "we have red live
                // in header saying we are not signed in" · suppress
                // the red error strip on the pilot broadcaster
                // surface when the only reason is "no real Supabase
                // cookie". Dev impersonation (NEX_DEV_IMPERSONATE_
                // HANDLE) and real production sessions both resolve
                // correctly · if neither is present, the WebRTC
                // mesh still works for a demo stream, we just can't
                // persist the row to nex_live_session. That's a
                // dev-only cosmetic miss · logging it to the
                // console keeps devs informed without putting a red
                // "something's wrong" chrome on an otherwise working
                // broadcast.
                // eslint-disable-next-line no-console
                console.warn(
                  "[go-live] live-session persist skipped · not-signed-in · set NEX_DEV_IMPERSONATE_HANDLE in .env.local + restart to persist for a seeded persona",
                );
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
    /* Owner-authorised 2026-10-29 · NEX Music teardown. Close the
       overlay first so the <audio> element unmounts cleanly, then
       destroy the mixer. The engine will stop every outgoing track
       in `.leave()` so no explicit replaceAudioTrack is needed here. */
    setMusicUiState("closed");
    setMusicPlayUrl(null);
    setMusicCoverUrl(null); setMusicBackgroundUrl(null);
    setMusicTrackIndex(-1);
    if (musicMixerRef.current) {
      try {
        musicMixerRef.current.destroy();
      } catch {
        /* ignore */
      }
      musicMixerRef.current = null;
    }
    musicMicTrackRef.current = null;
    if (engine) {
      await engine.leave();
      engineRef.current = null;
    }
    /* Owner directive 2026-10-28 · "will turn off the camera and
       display this screen image ... Live Finished with streaming
       time under" · the sealed `router.push("/nex-native/chat")`
       exit is replaced with the Live Finished recap screen. The
       recap renders over the broadcast surface, captures the end
       timestamp, and auto-dismisses to the live feed after 8s
       (owner-confirmed). */
    setSessionEndedAt(Date.now());
    setShowEndedRecap(true);
  }, []);

  React.useEffect(() => {
    return () => {
      const engine = engineRef.current;
      if (engine) void engine.leave();
      const featuredChannel = featuredChannelRef.current;
      if (featuredChannel) void featuredChannel.close();
      const jailChannel = jailChannelRef.current;
      if (jailChannel) void jailChannel.close();
      /* Owner-authorised 2026-10-29 · NEX Music mixer cleanup on
         unmount · AudioContext resources released. */
      if (musicMixerRef.current) {
        try {
          musicMixerRef.current.destroy();
        } catch {
          /* ignore */
        }
        musicMixerRef.current = null;
      }
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
      void touchLiveHeartbeatAction({ sessionId: sid }).catch((err: unknown) => {
        // Fail-open · one dropped heartbeat is tolerated by the
        // staleness window (6× the ping interval). Emit a warn so a
        // run of failures is observable in production diagnostics
        // (2026-10-28 · silent-catch observability batch).
        if (typeof console !== "undefined" && typeof console.warn === "function") {
          console.warn("[nex-live-heartbeat] ping failed", err);
        }
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

  /* Owner-authorised 2026-10-31 (Decision 3) · deep-link auto-feature.
     Mirrors the sealed autoPlayMusic precedent at line 244 but acts
     on the product picker instead of the music overlay.

     When the broadcaster lands here with `?product=<id>` (passed by
     the Live Product Library tile hrefs), find the matching entry in
     realCatalog and call handlePickProduct so the chosen product is
     already featured BEFORE the broadcaster hits Go Live. One-shot
     via autoFeatureHandledRef so a later manual re-pick stays
     authoritative — the ref remembers the id we've already handled
     and never re-fires for the same id.

     Narrow boundary (per owner approval):
       · No change to handlePickProduct, autoPlayMusic, picker UX, or
         any other existing effect.
       · If `?product=` is absent → effect no-ops (every pre-brief
         broadcast journey is byte-identical).
       · If the id doesn't match an entry in realCatalog → effect
         marks the id handled and no-ops (never throws, never
         re-fires).

     Complementary to the sealed server-shell re-order (commit
     ac5326e, local-only) which also honours ?product= by putting the
     chosen product first in the picker. Both work together; this
     effect simply upgrades "first in list" to "already featured". */
  const autoFeatureProductId = searchParams?.get("product") ?? null;
  const autoFeatureHandledRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!autoFeatureProductId) return;
    if (autoFeatureHandledRef.current === autoFeatureProductId) return;
    const entry = realCatalog.find((p) => p.id === autoFeatureProductId);
    if (!entry) {
      autoFeatureHandledRef.current = autoFeatureProductId;
      return;
    }
    autoFeatureHandledRef.current = autoFeatureProductId;
    const snapshot = toSnapshotFromReal(entry, businessDisplayName ?? "Your shop");
    handlePickProduct(snapshot);
  }, [autoFeatureProductId, realCatalog, businessDisplayName, handlePickProduct]);

  return (
    <main
      style={{
        /* Owner directive 2026-10-27 · "this is the back ground
           image for broadcast room full height and width · NEX Neon
           Broadcast Room.png" · the broadcast-room backdrop now
           shows the sealed neon-studio artwork edge-to-edge whenever
           the camera preview isn't actively covering it (idle,
           requesting-media). Camera preview still sits on top via
           `position: absolute; inset: 0; zIndex: 0` so the live feed
           replaces the backdrop seamlessly once the broadcaster
           hits "Enter broadcast room". The dark navy `NEX.bg` fill
           stays as a fallback color behind the image · hidden under
           the cover-sized backdrop in normal conditions.
           Owner directive 2026-10-24 · the camera preview becomes
           an absolute fullscreen layer and the header + controls
           overlay on top via zIndex. The main container is
           position-relative + height 100dvh + overflow:hidden so no
           page scroll leaks around the live surface. */
        position: "relative",
        /* Owner directive 2026-10-28 · "the page ui must fit on the
           height". The sealed `.nex-native-frame` wrapper (see
           src/app/nex-native/layout.tsx) already clamps to
           min(780px, 100dvh - 32px) on desktop and 100dvh on mobile.
           Using `100dvh` here overflowed the frame on desktop (main
           = 100dvh = full window ~900 px, frame = 780 px) which
           bled content past the sealed phone-frame bezel. `100%`
           adapts to whatever the frame provides, keeping the
           broadcast surface flush. */
        height: "100%",
        overflow: "hidden",
        // Owner directive 2026-10-27 · "broadcast room back ground
        // image must be full width of image and height" · switched
        // from `center / cover` (which crops the image to fill the
        // frame) to `0 0 / 100% 100%` so the image stretches to the
        // full container width AND full container height · the
        // sealed Neon Broadcast Room artwork now shows in its
        // entirety on every viewport without cropping.
        background: `${NEX.bg} url("/nex-broadcast-room.png") 0 0 / 100% 100% no-repeat`,
        color: NEX.text,
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Owner directive 2026-10-27 · "remove header strip" · the
          sealed "Nex Live" title + viewer-count pill is retired. The
          broadcaster surface is now full-bleed over the camera feed.
          The sealed red LIVE indicator (dot + ping + text) lives on
          the right side of the camera canvas · see below. */}

      {/* Owner directive 2026-10-27 · "for the live screen for owner
          add dot red with ping and red text right side LIVE" · a
          vertically-centred LIVE badge on the right edge confirms
          the broadcaster is actually transmitting. Red dot (sealed
          NEX.red) + outward ping (box-shadow spread, same family as
          the sealed broadcaster-avatar ping) + "LIVE" wordmark. Only
          renders in the live state · the idle / requesting-media
          overlays already own the attention when not live. */}
      {state === "live" && (
        <div
          data-nex-go-live-live-badge
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0px) + 20px)",
            right: 16,
            zIndex: 26,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            pointerEvents: "none",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "relative",
              display: "inline-block",
              width: 10,
              height: 10,
            }}
          >
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 999,
                background: NEX.red,
                boxShadow: "0 0 8px rgba(255, 51, 85, 0.9)",
                animation: "nexGoLiveDot 1200ms ease-in-out infinite",
              }}
            />
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 999,
                background: "transparent",
                border: `1.5px solid ${NEX.red}`,
                animation: "nexGoLivePing 1800ms ease-out infinite",
              }}
            />
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: "0.1em",
              color: NEX.red,
              textShadow: "0 1px 3px rgba(0, 0, 0, 0.72)",
              fontFamily: "inherit",
            }}
          >
            LIVE
          </span>
          <style>{`
            @keyframes nexGoLiveDot {
              0%, 100% { opacity: 1;    transform: scale(1); }
              50%      { opacity: 0.6;  transform: scale(0.85); }
            }
            @keyframes nexGoLivePing {
              0%   { transform: scale(1);   opacity: 0.9; }
              70%  { transform: scale(2.4); opacity: 0;   }
              100% { transform: scale(2.4); opacity: 0;   }
            }
            @media (prefers-reduced-motion: reduce) {
              [data-nex-go-live-live-badge] * { animation: none !important; }
            }
          `}</style>
        </div>
      )}

      {/* Camera preview · owner directive 2026-10-24 · "full height
         image view and width on live" · absolute inset-0 so the video
         fills the entire viewport under the overlaid header + controls
         + footer. zIndex 0 keeps it as the base layer. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          /* Owner directive 2026-10-27 · broadcast-room backdrop
             reveal · the camera-preview container no longer paints
             a solid black fill behind the <video> · it stays
             transparent so the sealed `/nex-broadcast-room.png`
             artwork on the <main> background reads through while the
             camera is idle. Once the <video> source attaches it
             covers the full area via `objectFit: cover` and the
             backdrop is hidden anyway. */
          background: "transparent",
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
          /* Owner directive 2026-10-28 · "move the red ping on
             broadcast room to header left with red text on the right
             Go Live · move down the text from center to footer area".
             The idle overlay no longer centers everything in a stack ·
             it now has a top header row (ping left · "Go Live" red
             right) and a bottom footer block (Ready to broadcast copy +
             Enter broadcast room button). The sealed red ping-with-dot
             indicator and sealed "Ready to broadcast" copy are
             preserved verbatim · only their layout anchors change. */
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(2, 9, 20, 0.42)",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              /* Owner directive 2026-10-28 · "page no scrolling" ·
                 belt-and-suspenders on top of the sealed main-container
                 overflow:hidden (line ~496). Blocks any internal
                 overflow from bleeding into a scroll gesture on tall
                 content. */
              overflow: "hidden",
            }}
          >
            {/* Header · ping left · "Go Live" red right. */}
            <div
              data-nex-go-live-idle-header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "env(safe-area-inset-top, 0px)",
              }}
            >
              <div
                data-nex-go-live-pre-live-indicator
                style={{
                  position: "relative",
                  width: 44,
                  height: 44,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 999,
                    border: `2px solid ${NEX.red}`,
                    animation: "nexPreLivePing 2400ms ease-out infinite",
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 999,
                    border: `2px solid ${NEX.red}`,
                    animation: "nexPreLivePing 2400ms ease-out 800ms infinite",
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 999,
                    border: `2px solid ${NEX.red}`,
                    animation: "nexPreLivePing 2400ms ease-out 1600ms infinite",
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    position: "relative",
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: NEX.red,
                    boxShadow: "0 0 8px rgba(255, 51, 85, 0.9)",
                    animation: "nexPreLiveDot 1200ms ease-in-out infinite",
                  }}
                />
                <style>{`
                  @keyframes nexPreLiveDot {
                    0%, 100% { opacity: 1;   transform: scale(1);   }
                    50%      { opacity: 0.6; transform: scale(0.85); }
                  }
                  @keyframes nexPreLivePing {
                    0%   { transform: scale(0.4); opacity: 0.95; }
                    80%  { transform: scale(1.4); opacity: 0;    }
                    100% { transform: scale(1.4); opacity: 0;    }
                  }
                  @media (prefers-reduced-motion: reduce) {
                    [data-nex-go-live-pre-live-indicator] * {
                      animation: none !important;
                    }
                  }
                `}</style>
              </div>
              {/* Owner directive 2026-10-29 (Option D · host identity
                  in idle header) · avatar + personal display_name chip
                  sits beside the sealed "Go Live" label so the owner
                  confirms which account is live-ready before the
                  camera engages. Chip hides gracefully when both
                  selfAvatarUrl and selfDisplayName are null (guest /
                  dev-fallback flow). */}
              <div
                data-nex-go-live-idle-header-right
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                }}
              >
                {(selfAvatarUrl || selfDisplayName) && (
                  <div
                    data-nex-go-live-idle-identity-chip
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    {selfAvatarUrl && (
                      <span
                        aria-hidden
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          overflow: "hidden",
                          flexShrink: 0,
                          background:
                            "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)",
                          boxShadow:
                            "0 0 0 2px rgba(255, 255, 255, 0.18), 0 2px 6px rgba(0, 0, 0, 0.5)",
                        }}
                      >
                        {/* Owner directive 2026-10-27 (sealed) · the
                            nex-mock-personas PNGs carry 10-15% white
                            padding on the top + bottom edges · the
                            sealed scale(1.4) translateY(-2%) crop
                            matches the viewer-footer-pill chip and
                            NexLiveFirstVisitSplash::PersonaChip. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selfAvatarUrl}
                          alt=""
                          draggable={false}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                            transform: "scale(1.4) translateY(-2%)",
                            transformOrigin: "center 48%",
                          }}
                        />
                      </span>
                    )}
                    {selfDisplayName && (
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#FFFFFF",
                          letterSpacing: "0.01em",
                          textShadow: "0 1px 3px rgba(0, 0, 0, 0.7)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 160,
                          fontFamily: "inherit",
                        }}
                      >
                        {selfDisplayName}
                      </span>
                    )}
                  </div>
                )}
                <div
                  data-nex-go-live-idle-header-label
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    color: NEX.red,
                    letterSpacing: "0.04em",
                    textShadow: "0 1px 3px rgba(0, 0, 0, 0.72)",
                    fontFamily: "inherit",
                  }}
                >
                  Go Live
                </div>
              </div>
            </div>

            {/* Owner directive 2026-10-28 (revised) · "remove jail
                button" on the idle entry surface. The sealed idle-
                state jail affordance is retired · the Jail button on
                the live-state owner-rail (search this file for
                `label="Jail"`) remains as the single jail entry point
                during an active broadcast. */}

            {/* Footer · sealed copy + CTA. Owner directive 2026-10-28
                · "move the footer button and text up little" · 48px
                lift above the safe-area bottom inset so the CTA sits
                closer to thumb-reach without hugging the bottom edge. */}
            <div
              data-nex-go-live-idle-footer
              style={{
                textAlign: "center",
                maxWidth: 320,
                width: "100%",
                marginInline: "auto",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 48px)",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                Ready to broadcast
              </div>
              <div style={{ fontSize: 13, color: NEX.textDim, lineHeight: 1.5, marginBottom: 20 }}>
                Your video and microphone will stream directly to viewers who join · NEX never receives the video.
              </div>
              <button
                type="button"
                /* Owner directive 2026-10-28 · "this page will show
                   immediately after user press live streaming" · tap
                   raises the "Starting Live" splash first, THEN
                   kicks off startBroadcast() in parallel so the
                   camera request happens under the splash and the
                   viewer sees a 3-s brand-free status beacon before
                   the live preview resolves. */
                onClick={() => {
                  setShowStartingSplash(true);
                  startBroadcast();
                }}
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
                Enter broadcast room
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

        {/* Owner directive 2026-10-27 · "move the buttons on the
           right for live controls up to center" · the right-rail no
           longer anchors to the bottom-right corner. It now sits
           vertically centred on the right edge of the camera canvas
           (`top: 50%; transform: translateY(-50%)`), giving the
           broadcaster thumb-reach access without the controls
           crowding the bottom gesture area. Icon-only per the next
           directive · the OwnerRailButton's background chip is
           retired. */}
        {state === "live" && (
          <div
            data-nex-live-owner-rail
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 18,
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
              /* Owner directive 2026-10-28 · "we need jail button on
                 this page connected to footer jail slider" (/go-live
                 is the live-state URL · same component as
                 /enter-broadcast-room). The sealed 2026-10-25
                 "Timeout" rename is partially unwound to match today's
                 directive · owner-rail now labelled "Jail" with the
                 same jail-bars icon used on the idle-state right-
                 side button (see idle-jail-button around line ~760).
                 Still fires the sealed `setJailPickerOpen` state so
                 the footer JailPickerSheet slides up with its sealed
                 "Jail · Select user to block from live feed posting
                 for 10 minute" header. */
              label="Jail"
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
                  {/* Jail-cell icon · 3 vertical bars + 2 horizontal
                      rails · matches the sealed idle-state jail
                      button so the owner recognises the same
                      affordance in both states. */}
                  <path d="M4 5h16M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M7 5v14M12 5v14M17 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              }
            />
            {/* Owner-authorised 2026-10-29 · NEX Music right-rail
                button. Opens the picker (if the library has any
                shared tracks) or links to upload. The music overlay
                mounts separately below the viewer-footer-pill. */}
            <OwnerRailButton
              label="Music"
              active={musicUiState !== "closed"}
              activeFill={NEX.cyan}
              onClick={() => {
                setMusicError(null);
                if (musicUiState === "open") {
                  setMusicUiState("minimised");
                  return;
                }
                if (musicUiState === "minimised") {
                  setMusicUiState("open");
                  return;
                }
                if (musicLibrary.length === 0) {
                  router.push("/nex-native/create/upload-music");
                  return;
                }
                setMusicUiState("picking");
                setPickerOpen(false);
                setJailPickerOpen(false);
              }}
              ariaControls="nex-live-music"
              ariaExpanded={musicUiState !== "closed"}
              testid="nex-live-music-button"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M9 18V5l10-2v13" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <circle cx="7" cy="18" r="2.2" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="17" cy="16" r="2.2" stroke="currentColor" strokeWidth="1.8" />
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

        {/* Owner-authorised 2026-10-29 · NEX Music picker sheet.
            Opens when the Music rail button is tapped and the
            library has at least one shared track. Mutually
            exclusive with the Product + Jail pickers. */}
        {state === "live" && musicUiState === "picking" && (
          <div
            id="nex-live-music"
            role="dialog"
            aria-label="Choose a track"
            style={{
              position: "absolute",
              left: 10,
              right: 10,
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
              zIndex: 26,
              background: "rgba(7,18,38,0.92)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(79,195,255,0.45)",
              borderRadius: 16,
              padding: 14,
              color: "#F0F6FF",
              fontFamily: "inherit",
              boxShadow: "0 20px 50px -14px rgba(0,10,30,0.6)",
              maxHeight: "60%",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: "#4FC3FF", textTransform: "uppercase" }}>
                Choose a track
              </span>
              <button
                type="button"
                onClick={() => setMusicUiState("closed")}
                aria-label="Close"
                style={{
                  width: 26, height: 26, borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#F0F6FF", cursor: "pointer",
                }}
              >×</button>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {musicLibrary.map((t, i) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={async () => {
                      setMusicError(null);
                      const r = await getMusicPlayUrlAction({ trackId: t.id });
                      if (!r.ok) {
                        setMusicError(r.message);
                        return;
                      }
                      setMusicTrackIndex(i);
                      setMusicPlayUrl(r.data.signedUrl);
                      setMusicCoverUrl(r.data.coverUrl); setMusicBackgroundUrl(r.data.backgroundUrl);
                      setMusicUiState("open");
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#F0F6FF",
                      fontFamily: "inherit",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.title}
                      </span>
                      <span style={{ color: "#4FC3FF", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em" }}>
                        {t.source_type === "uploaded_audio" ? "MP3" : t.source_type === "spotify_url" ? "SPOTIFY" : "YOUTUBE"}
                      </span>
                    </div>
                    <small style={{ color: "rgba(240,246,255,0.6)", fontWeight: 500 }}>
                      {t.artist ?? "Unknown artist"}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
            {musicError && (
              <div style={{ marginTop: 10, color: "#FF3355", fontSize: 12 }}>
                {musicError}
              </div>
            )}
          </div>
        )}

        {/* Owner-authorised 2026-10-29 · NEX Music overlay (full)
            and minimised dock. The overlay mounts only in the live
            state. */}
        {/* Owner-authorised 2026-10-29 (preview-first flow) ·
            full-bleed background image shown behind the player
            overlay when the active music track has one. zIndex 1
            puts it above the camera video (zIndex 0) but below
            every overlay (identity caption, Stop Live, viewer
            footer, overlay itself). */}
        {state === "live" && !showEndedRecap && musicUiState === "open" && musicBackgroundUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={musicBackgroundUrl}
            alt=""
            aria-hidden
            data-nex-go-live-music-background
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 1,
              pointerEvents: "none",
            }}
          />
        )}

        {state === "live" && !showEndedRecap && musicUiState === "open" && activeMusicTrack && (
          <NexMusicPlayerOverlay
            track={activeMusicTrack}
            coverUrl={musicCoverUrl}
            audioSrcUrl={musicPlayUrl}
            /* Owner-authorised 2026-10-29 (Live analyser exposure) ·
               passing this ref opts the overlay OUT of its local
               MediaElementSource path · the mixer owns the one and
               only audio graph on Live. */
            externalAnalyserRef={musicAnalyserRef}
            /* Owner-authorised 2026-10-29 (Stage 5A · volume defect fix) ·
               route the slider through the mixer so viewers hear the
               gain change. The mixer's musicGain sits between the
               MediaElementSource and the MediaStreamDestination that
               feeds the WebRTC audio sender · and also connects to
               ctx.destination for the broadcaster's own monitor ·
               so one slider controls both audible paths. Mic gain
               is NOT touched here (sealed at 1.0 in the mixer). */
            onVolumeChange={(v) => {
              const mixer = musicMixerRef.current;
              if (mixer) {
                try {
                  mixer.setMusicGain(v);
                } catch {
                  /* best-effort · don't block the UI on a WebAudio hiccup */
                }
              }
            }}
            onMinimise={() => setMusicUiState("minimised")}
            onClose={() => {
              // Stop playback via the audio element (handled by
              // onAudioElement cleanup when the overlay unmounts) ·
              // tear the mixer down and restore the mic-only track.
              const mixer = musicMixerRef.current;
              const mic = musicMicTrackRef.current;
              musicMixerRef.current = null;
              musicAnalyserRef.current = null;
              if (mixer) {
                try {
                  mixer.destroy();
                } catch {
                  /* ignore */
                }
              }
              if (mic) {
                void engineRef.current?.replaceAudioTrack(mic);
              }
              setMusicUiState("closed");
              setMusicPlayUrl(null);
              setMusicCoverUrl(null); setMusicBackgroundUrl(null);
              setMusicTrackIndex(-1);
            }}
            onNext={
              musicLibrary.length > 1
                ? async () => {
                    const nextIdx = (musicTrackIndex + 1) % musicLibrary.length;
                    const next = musicLibrary[nextIdx]!;
                    const r = await getMusicPlayUrlAction({ trackId: next.id });
                    if (!r.ok) {
                      setMusicError(r.message);
                      return;
                    }
                    setMusicTrackIndex(nextIdx);
                    setMusicPlayUrl(r.data.signedUrl);
                    setMusicCoverUrl(r.data.coverUrl); setMusicBackgroundUrl(r.data.backgroundUrl);
                  }
                : null
            }
            onPrev={
              musicLibrary.length > 1
                ? async () => {
                    const prevIdx =
                      (musicTrackIndex - 1 + musicLibrary.length) %
                      musicLibrary.length;
                    const prev = musicLibrary[prevIdx]!;
                    const r = await getMusicPlayUrlAction({ trackId: prev.id });
                    if (!r.ok) {
                      setMusicError(r.message);
                      return;
                    }
                    setMusicTrackIndex(prevIdx);
                    setMusicPlayUrl(r.data.signedUrl);
                    setMusicCoverUrl(r.data.coverUrl); setMusicBackgroundUrl(r.data.backgroundUrl);
                  }
                : null
            }
            onAudioElement={(audio) => {
              if (!audio) return;
              if (activeMusicTrack.source_type !== "uploaded_audio") return;
              try {
                const engine = engineRef.current;
                if (!engine) return;
                const localStream = engine.getLocalStream();
                if (!localStream) return;
                const micTrack = localStream.getAudioTracks()[0] ?? null;
                if (!micTrack) return;
                if (!musicMixerRef.current) {
                  // First tap · build mixer, swap audio track.
                  const mixer = createLiveAudioMixer({
                    micStream: new MediaStream([micTrack]),
                    initialMusicGain: 0.8,
                  });
                  musicMicTrackRef.current = micTrack;
                  musicMixerRef.current = mixer;
                  void engine.replaceAudioTrack(mixer.outputTrack);
                }
                musicMixerRef.current.attachMusicElement(audio);
                // Owner-authorised 2026-10-29 (Live analyser exposure) ·
                // after attach, the mixer's analyser is connected
                // downstream of musicGain. Expose it to the overlay
                // via the ref · the overlay re-reads it each frame.
                musicAnalyserRef.current =
                  musicMixerRef.current.getMusicAnalyser();
              } catch (err) {
                setMusicError(
                  err instanceof Error ? err.message : "Audio mixer unavailable",
                );
              }
            }}
          />
        )}

        {state === "live" && !showEndedRecap && musicUiState === "minimised" && activeMusicTrack && (
          <div
            style={{
              position: "absolute",
              right: 14,
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
              zIndex: 22,
            }}
          >
            <MusicPlayerDock
              coverUrl={musicCoverUrl}
              title={activeMusicTrack.title}
              progress={0}
              isPlaying={true}
              onOpen={() => setMusicUiState("open")}
            />
          </div>
        )}

        {/* Owner directive 2026-10-27 · "we need same view for owner
            live oh their screen as user is seeing" · a viewer-style
            header (title left · search + messages + 3-dot icons on
            the right) + a viewer-style composer pill at the bottom
            (broadcaster avatar + read-only "You are live · viewers
            see this" placeholder + Like counter on the right). Pure
            visual replica so the broadcaster feels what the audience
            sees · all elements are read-only on this surface
            (search / 3-dot / composer / like are not interactive).
            Only mounts in the live state · idle / requesting-media
            overlays keep the attention when not transmitting.
            Owner directive 2026-10-28 · "the page that live has
            ended should showing also for owner with all over lay
            buttons and footer and header · so the owner can see
            also what the viewers are seeing" · the viewer-style
            header + composer pill stay mounted during the Live
            Finished recap too. Their zIndex is boosted above the
            recap (220 → 230) so the chrome reads over the
            after-hours backdrop. The owner-rail (mute/video/
            product/timeout/end) is NOT mounted during recap · it is
            broadcaster-only, viewers do not see it. */}
        {(state === "live" || showEndedRecap) && (
          <>
            {/* Viewer-style header row · satellite icon + "Live NEX" +
                "Broadcasting now" subtitle, 🔍 + 💬 + ⋮ on the right.
                Positioned to clear the LIVE badge on the top-right. */}
            <div
              data-nex-go-live-viewer-header
              style={{
                position: "absolute",
                top: "calc(env(safe-area-inset-top, 0px) + 10px)",
                left: 10,
                right: 72,
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 10,
                alignItems: "center",
                zIndex: showEndedRecap ? 230 : 24,
                pointerEvents: "none",
                textShadow: "0 1px 4px rgba(0,0,0,0.65)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: NEX.text,
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>📡</span>
                  <span>Live NEX</span>
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 11,
                    color: "#D9E6F5",
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Broadcasting now · {viewerCount} viewer{viewerCount === 1 ? "" : "s"}
                </div>
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  pointerEvents: "none",
                }}
              >
                {/* Search icon stub · broadcaster surface doesn't open
                    the category sheet, but the visual slot mirrors
                    the viewer so the "my audience sees this" feel is
                    preserved. */}
                <span
                  aria-hidden
                  data-nex-go-live-viewer-header-search
                  style={{
                    width: 32,
                    height: 32,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.6))",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                {/* Messages icon stub · same silhouette the viewer sees. */}
                <span
                  aria-hidden
                  data-nex-go-live-viewer-header-messages
                  style={{
                    width: 32,
                    height: 32,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    lineHeight: 1,
                    filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.6))",
                  }}
                >
                  💬
                </span>
                {/* 3-dot stub · visual only on broadcaster surface. */}
                <span
                  aria-hidden
                  data-nex-go-live-viewer-header-more
                  style={{
                    width: 32,
                    height: 32,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    fontSize: 22,
                    fontWeight: 900,
                    lineHeight: 1,
                    letterSpacing: "0.08em",
                    filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.6))",
                  }}
                >
                  ⋮
                </span>
              </div>
            </div>

            {/* Owner directive 2026-10-28 · "when live will turn to
                button stop live when pressed will stop live streaming"
                · the sealed idle "Go Live" button toggles conceptually
                to a prominent red "Stop Live" button once broadcasting
                starts. Positioned above the sealed viewer-style
                composer pill (which uses bottom:14+safeArea, height
                ~44) with a 20px gap · zIndex 25 keeps it above the
                composer (which is zIndex 24, pointer-events:none). */}
            {state === "live" && !showEndedRecap && (
              <button
                type="button"
                data-nex-go-live-stop-live-button
                aria-label="Stop live stream"
                onClick={() => { void endBroadcast(); }}
                style={{
                  position: "absolute",
                  bottom: "calc(env(safe-area-inset-bottom, 0px) + 78px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  minHeight: 48,
                  padding: "0 28px",
                  borderRadius: 12,
                  background: NEX.red,
                  color: "#FFFFFF",
                  border: "none",
                  fontSize: 14,
                  fontWeight: 900,
                  letterSpacing: "0.02em",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                  boxShadow:
                    "0 0 18px rgba(255, 51, 85, 0.5), 0 4px 12px rgba(0, 0, 0, 0.55)",
                  zIndex: 25,
                }}
              >
                Stop Live
              </button>
            )}

            {/* Owner directive 2026-10-29 (Option C · host identity
                while live) · two-line identity caption pinned
                immediately above the viewer-footer-pill. Line 1 is
                the broadcaster's personal display_name · line 2 is
                the businessDisplayName. Preserves the sealed "You are
                live · viewers see this" status text in the pill
                below. Left-aligned + max-width constrained so the
                centred Stop Live button (bottom: safe-area+78px,
                zIndex: 25) stays visually clear. zIndex sits beneath
                the pill (24) and the Stop Live button so overlap
                falls behind, not in front of, the sealed controls.
                Only mounts during an active live broadcast · the
                Live Finished recap carries its own identity chrome. */}
            {state === "live" && !showEndedRecap && musicUiState === "closed" &&
              (selfDisplayName || businessDisplayName) && (
                <div
                  data-nex-go-live-self-identity-caption
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 14,
                    bottom:
                      "calc(env(safe-area-inset-bottom, 0px) + 64px)",
                    maxWidth: "calc(50% - 24px)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    pointerEvents: "none",
                    zIndex: 23,
                    fontFamily: "inherit",
                  }}
                >
                  {selfDisplayName && (
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: "#FFFFFF",
                        letterSpacing: "0.01em",
                        lineHeight: 1.15,
                        textShadow: "0 1px 3px rgba(0, 0, 0, 0.72)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {selfDisplayName}
                    </span>
                  )}
                  {businessDisplayName && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "rgba(255, 255, 255, 0.82)",
                        letterSpacing: "0.01em",
                        lineHeight: 1.15,
                        textShadow: "0 1px 2px rgba(0, 0, 0, 0.65)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {businessDisplayName}
                    </span>
                  )}
                </div>
              )}

            {/* Viewer-style composer pill at the bottom · broadcaster
                avatar (navy gradient + green rim + outer ping · same
                sealed online-presence family) + a read-only "You are
                live · viewers see this" placeholder + a Like heart
                counter on the right. Hooks up ZERO interactivity ·
                this is a visual replica of what the audience sees. */}
            <div
              data-nex-go-live-viewer-footer-pill
              style={{
                position: "absolute",
                left: 10,
                right: 10,
                bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                /* Owner directive 2026-10-28 · the composer pill
                   stays mounted during the Live Finished recap so
                   the owner sees the viewer-side chrome · zIndex
                   boosts above the recap (220) when ended. */
                zIndex: showEndedRecap ? 230 : 24,
                pointerEvents: "none",
              }}
            >
              <div
                data-nex-go-live-viewer-footer-pill-composer
                style={{
                  flex: "1 1 auto",
                  minWidth: 0,
                  minHeight: 44,
                  padding: "0 10px 0 50px",
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 14,
                  background: "rgba(2, 9, 20, 0.55)",
                  backdropFilter: "blur(8px) saturate(140%)",
                  WebkitBackdropFilter: "blur(8px) saturate(140%)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  position: "relative",
                  color: "rgba(255,255,255,0.78)",
                  fontSize: 13,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {/* Broadcaster avatar · 36 px navy gradient chip with
                    the sealed green rim + outward ping (same box-
                    shadow family as the viewer composer). Owner
                    directive 2026-10-28 · "why his profile image is
                    not displaying in the profile image container" ·
                    renders the real `selfAvatarUrl` when available ·
                    falls back to the first letter of businessDisplayName
                    (or "Y" when neither is set) so the chip always
                    carries honest identity. */}
                <span
                  aria-hidden
                  data-nex-go-live-viewer-footer-avatar
                  style={{
                    position: "absolute",
                    left: 4,
                    top: 4,
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    fontSize: 14,
                    fontWeight: 800,
                    boxShadow:
                      "0 0 0 2px #16D66B, 0 0 10px rgba(22, 214, 107, 0.4)",
                    animation:
                      "nexGoLiveFooterAvatarPing 1800ms ease-out infinite",
                    overflow: "hidden",
                  }}
                >
                  {selfAvatarUrl ? (
                    /* Owner troubleshoot 2026-10-27 (sealed) · the
                       nex-mock-personas PNGs carry 10-15% white
                       padding on the top + bottom edges from the
                       source-grid crop. `scale(1.4) translateY(-2%)`
                       zooms the face up inside the chip · the
                       chip's `overflow: hidden` clips the padding
                       cleanly. Same transform used in
                       NexLiveFirstVisitSplash::PersonaChip. */
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={selfAvatarUrl}
                      alt=""
                      draggable={false}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                        transform: "scale(1.4) translateY(-2%)",
                        transformOrigin: "center 48%",
                      }}
                    />
                  ) : (
                    <span aria-hidden>
                      {(businessDisplayName ?? "Y").trim().slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                You are live · viewers see this
              </div>
              {/* Like heart counter on the right · pure count, no tap. */}
              <div
                data-nex-go-live-viewer-footer-likes
                aria-hidden
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  width: 44,
                }}
              >
                <span
                  style={{
                    fontSize: 22,
                    lineHeight: 1,
                    color: NEX.red,
                    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
                  }}
                >
                  ❤
                </span>
                {/* Owner-side like count · the broadcaster has no
                    live-aggregated likes channel yet (see roadmap
                    doctrine) · surface a 0 placeholder for the
                    visual replica so the viewer-feel is honest about
                    the counter affordance. */}
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: "#FFFFFF",
                    lineHeight: 1,
                    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                  }}
                >
                  0
                </span>
              </div>
              <style>{`
                @keyframes nexGoLiveFooterAvatarPing {
                  0%   { box-shadow: 0 0 0 2px #16D66B, 0 0 0 2px rgba(22, 214, 107, 0.75), 0 0 10px rgba(22, 214, 107, 0.4); }
                  70%  { box-shadow: 0 0 0 2px #16D66B, 0 0 0 12px rgba(22, 214, 107, 0),   0 0 10px rgba(22, 214, 107, 0.2); }
                  100% { box-shadow: 0 0 0 2px #16D66B, 0 0 0 12px rgba(22, 214, 107, 0),   0 0 10px rgba(22, 214, 107, 0.2); }
                }
                @media (prefers-reduced-motion: reduce) {
                  [data-nex-go-live-viewer-footer-avatar] { animation: none !important; }
                }
              `}</style>
            </div>
          </>
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
            best-effort (same pattern as featured-product).
            Owner directive 2026-10-28 · the sheet mount is no
            longer gated on `state === "live"` so the right-side
            jail icon on the idle broadcast-room surface can open
            it too. In idle state `presenceViewers` is empty · the
            sheet renders its sealed "No viewers are watching right
            now." empty state honestly. In live state the sealed
            jailChannelRef is open and `onConfirm` triggers the
            viewer-side jail animation. */}
        <JailPickerSheet
          open={jailPickerOpen}
          viewers={presenceViewers.map((m) => {
            // Owner directive 2026-10-28 · when the viewer id matches
            // one of the dev-mock entries, pass its avatar URL
            // through so the picker row renders the face chip.
            const mock = devMockViewers?.find((dm) => dm.accountId === m.accountId);
            return {
              accountId: m.accountId,
              displayName: m.displayName ?? null,
              avatarUrl: mock?.avatarUrl ?? null,
            };
          })}
          onCancel={() => setJailPickerOpen(false)}
          onConfirm={(accountId) => {
            setJailPickerOpen(false);
            // Fire the Realtime broadcast (viewer-side overlay path).
            void jailChannelRef.current?.jail(accountId);
            /* Owner directive 2026-10-29 · Jail Phase B · persist
               the jail to `public.nex_live_jail` so the sealed
               comment-send + DM-send server gates can enforce the
               10-minute block beyond the Realtime channel. Needs
               the DB session UUID · if the broadcaster hasn't
               reached live yet (dbSessionIdRef unset), skip the
               persist · the Realtime path still fires. */
            const dbSid = dbSessionIdRef.current;
            if (dbSid) {
              void issueJailAction({
                viewerAccountId: accountId,
                sessionId: dbSid,
              }).then((r) => {
                if (!r.ok) {
                  console.warn("[jail] persist failed:", r.reason);
                }
              });
            }
            /* Owner directive 2026-10-28 · broadcaster sees the
               jail confirmation overlay. Look up the target's
               display name + avatar from the current roster /
               mock list so the card reads honest identity. */
            const target =
              presenceViewers.find((v) => v.accountId === accountId) ?? null;
            const mock = devMockViewers?.find((dm) => dm.accountId === accountId) ?? null;
            setJailedUser({
              accountId,
              displayName:
                target?.displayName ?? mock?.displayName ?? "This viewer",
              avatarUrl: mock?.avatarUrl ?? null,
              /* 10 minutes · matches the sealed jail-channel
                 duration (see JailPickerSheet confirm copy). */
              endsAt: Date.now() + 10 * 60 * 1000,
            });
          }}
        />
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


      {/* Owner directive 2026-10-27 · "remove this and lock screen
          from scrolling · Session · 37dd724d · share …" · the pilot-
          only session-id + share-URL footer is retired · the viewer-
          style composer pill at the bottom + the LIVE badge on the
          top-right are the broadcaster's status surfaces now. The
          session id is still available in `sessionId` for the share
          sheet / clipboard copy affordance when that lands. */}

      {/* Owner directive 2026-10-28 (revised · "this page will show
          immediately after user press live streaming") · the
          "Starting Live" splash only mounts while showStartingSplash
          is true · the idle-state CTA raises the flag · the splash
          auto-dismisses after visibleMs = 3000 ms (sealed component
          default) and clears the flag so repeat starts work. */}
      {showStartingSplash && (
        <NexLiveFirstVisitSplash
          onDismiss={() => setShowStartingSplash(false)}
        />
      )}

      {/* Owner directive 2026-10-28 · Live Finished recap · fires when
          the owner taps Stop Live. Full-bleed after-hours studio
          backdrop + owner avatar + "Live Finished" + streaming time +
          peak viewer stat + bottom tap-anywhere affordance with 8-s
          countdown bar. On dismiss (tap OR auto) · router.push to
          /nex-native/live-commerce/feed per owner-confirmed destination. */}
      {/* Owner directive 2026-10-28 · broadcaster jail confirmation
          overlay. "owner can see container over lay of the video
          with text confirmed user blocked from posting for 10
          minute and also see the countdown timer". Floating card
          pinned to the top-right under the LIVE badge · auto-
          dismisses when the 10-minute countdown hits zero. Tap-
          close affordance on the right. */}
      {jailedUser && (
        <div
          data-nex-go-live-jail-confirmation
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0px) + 68px)",
            left: 12,
            right: 12,
            zIndex: 240,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            borderRadius: 14,
            background: "rgba(2, 9, 20, 0.88)",
            border: `1.5px solid ${NEX.red}`,
            backdropFilter: "blur(8px) saturate(140%)",
            WebkitBackdropFilter: "blur(8px) saturate(140%)",
            boxShadow:
              "0 0 18px rgba(255, 51, 85, 0.35), 0 8px 24px rgba(0, 0, 0, 0.55)",
            animation: "nexGoLiveJailCardSlideIn 220ms ease-out",
            color: NEX.text,
            fontFamily: "inherit",
          }}
        >
          <style>{`
            @keyframes nexGoLiveJailCardSlideIn {
              from { opacity: 0; transform: translateY(-6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <span
            aria-hidden
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: 800,
              flexShrink: 0,
              overflow: "hidden",
              border: `2px solid ${NEX.red}`,
            }}
          >
            {jailedUser.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={jailedUser.avatarUrl}
                alt=""
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scale(1.4) translateY(-2%)",
                  transformOrigin: "center 48%",
                }}
              />
            ) : (
              <span aria-hidden>
                {jailedUser.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                lineHeight: 1.25,
                color: "#FFFFFF",
              }}
            >
              Confirmed · {jailedUser.displayName} blocked
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 11,
                color: NEX.textDim,
                lineHeight: 1.35,
              }}
            >
              Blocked from posting for 10 minute
            </div>
          </div>
          <div
            data-nex-go-live-jail-countdown
            style={{
              flexShrink: 0,
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              padding: "4px 10px",
              borderRadius: 8,
              background: "rgba(255, 51, 85, 0.14)",
              border: `1px solid ${NEX.red}`,
              color: NEX.red,
              fontVariantNumeric: "tabular-nums",
              minWidth: 56,
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 900,
                lineHeight: 1.1,
              }}
            >
              {Math.floor(jailRemainingSeconds / 60)
                .toString()
                .padStart(1, "0")}
              :
              {(jailRemainingSeconds % 60).toString().padStart(2, "0")}
            </span>
            <span
              style={{
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                opacity: 0.8,
              }}
            >
              Left
            </span>
          </div>
          <button
            type="button"
            aria-label="Dismiss jail confirmation"
            onClick={() => setJailedUser(null)}
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#FFFFFF",
              fontSize: 14,
              lineHeight: 1,
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            ×
          </button>
        </div>
      )}

      {showEndedRecap && (
        <LiveFinishedRecap
          startedAt={sessionStartedAt}
          endedAt={sessionEndedAt}
          peakViewers={peakViewers}
          selfAvatarUrl={selfAvatarUrl}
          selfDisplayName={businessDisplayName}
          onDismiss={() => {
            setShowEndedRecap(false);
            router.push("/nex-native/nex-feed");
          }}
        />
      )}
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
  // Owner directive 2026-10-27 · "remove the background buttons and
  // add the icons only" · the sealed round-black chip + border is
  // retired. Each control is now a bare icon over the camera feed
  // with a drop-shadow pair for legibility (same shadow pattern as
  // the sealed header magnifying-glass). Active state tints the
  // icon via `activeFill` instead of the former background chip,
  // so the "muted" / "camera off" affordance stays visible without
  // the chrome.
  const iconColor = props.forcedFill
    ? props.forcedFill
    : props.active
      ? props.activeFill
      : "#FFFFFF";
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
          width: 44,
          height: 44,
          background: "transparent",
          border: "none",
          color: iconColor,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          fontFamily: "inherit",
          touchAction: "manipulation",
          padding: 0,
          filter:
            "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.75)) drop-shadow(0 0 2px rgba(0, 0, 0, 0.5))",
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
