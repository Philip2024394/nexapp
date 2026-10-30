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
  openLiveCommentsChannel,
  type LiveCommentsChannelHandle,
  type LiveCommentPayload,
} from "@/lib/nex-native/live-broadcast/live-comments-channel";
import {
  openJailChannel,
  type JailChannelHandle,
  type JailEventPayload,
} from "@/lib/nex-native/live-broadcast/jail-channel";
import { JailOverlay } from "@/components/nex-native/live-commerce/JailOverlay";
import {
  ProductOverlayCard,
  type LiveProductSnapshot,
} from "@/components/nex-native/live-commerce/ProductOverlayCard";
import { LiveCommentsOverlay } from "@/components/nex-native/live-commerce/LiveCommentsOverlay";
import {
  LiveViewerFooter,
  type LiveReplyContext,
  type ShareEvidence,
} from "@/components/nex-native/live-commerce/LiveViewerFooter";
import { MessagePanel } from "@/components/nex-native/live-commerce/MessagePanel";
import { getLiveInviteTargetAction } from "@/app/nex-native/live-commerce/_invite-target-action";
import type { InviteTarget } from "@/lib/nex-native/live-broadcast/invite-target";
import { FollowButton } from "@/components/nex-native/follow/FollowButton";
import {
  isFollowingAction,
  getFollowCountsAction,
} from "@/lib/nex-native/follow/follow-actions";

/** Compact k/M formatter for the inline Live follower-count chip.
 *  Owner-authorised 2026-10-30 · Stage 2b · duplicates the sealed
 *  formatter in `FollowersCountChip.formatCount` with the same
 *  thresholds so the display is consistent across Profile + Live. */
function formatLiveCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

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
  incomingProductHint,
  siblingSessionIds,
}: {
  readonly sessionId: string;
  readonly viewerAccountId: string;
  /* Phase 2 · G2 · ?product= URL hint. The caller (shop / product
     page / central feed) suggests which product the viewer was
     expecting to see when they clicked the link. Honest contract:
     the hint is NOT authoritative · the broadcaster's currently-
     pinned product (delivered via the Realtime channel) is always
     the source of truth. We attach the hint as a data attribute
     for future telemetry and no visible UI claim is made from it
     at this stage. */
  readonly incomingProductHint?: string | null;
  /** Ordered list of currently-open session ids (fetched server-
   *  side at page load). Powers the vertical swipeable feed on the
   *  viewer surface: swipe up → next session, swipe down → previous.
   *  Guaranteed to include the current `sessionId` so index lookup
   *  is defined. Length 1 means no siblings · swipes are no-ops. */
  readonly siblingSessionIds?: readonly string[];
}): React.JSX.Element {
  void incomingProductHint;
  const router = useRouter();
  const [state, setState] = React.useState<LiveViewerState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [broadcasterAccountId, setBroadcasterAccountId] = React.useState<string | null>(null);
  // Owner-authorised 2026-10-30 · Stage 2 Follow seed. Live resolves
  // the broadcaster identity client-side via the presence channel, so
  // the pure-SSR seed used on Music + Profile is architecturally
  // unavailable here. Pattern: once the broadcaster id resolves, we
  // call isFollowingAction once and feed the result into FollowButton
  // via a key-remount so the button repaints with correct state.
  // Until the resolution completes, FollowButton shows "Follow" (same
  // behaviour as before this seed existed) · idempotent follow actions
  // ensure a tap during the pending window reconciles honestly either
  // way.
  const [resolvedFollowState, setResolvedFollowState] = React.useState<
    "not-following" | "following" | null
  >(null);
  // Owner-authorised 2026-10-30 · Stage 2b · broadcaster follower
  // count (null = unresolved, number = trigger-maintained value from
  // nex_account.followers_count). Fetched in parallel with the
  // follow-state effect once broadcasterAccountId resolves.
  const [broadcasterFollowersCount, setBroadcasterFollowersCount] = React.useState<
    number | null
  >(null);
  // Owner directive 2026-10-25 (Phase B) · Message panel state. The
  // broadcaster InviteTarget is resolved on-demand when the viewer
  // taps Message in the 3-dot slide-out · we do NOT prefetch to avoid
  // an extra DB roundtrip on every viewer mount. Cached once resolved
  // so subsequent opens are instant. `isSignedIn` toggled from the
  // existing `isGuest` sentinel so the panel can route guests through
  // sign-in rather than attempt an unauthenticated invite.
  const [messagePanelOpen, setMessagePanelOpen] = React.useState(false);
  const [inviteTarget, setInviteTarget] = React.useState<InviteTarget | null>(
    null,
  );
  const inviteTargetFetchedRef = React.useRef<string | null>(null);
  const [featuredProduct, setFeaturedProduct] =
    React.useState<LiveProductSnapshot | null>(null);
  const [comments, setComments] = React.useState<readonly LiveCommentPayload[]>([]);
  const [isLiked, setIsLiked] = React.useState(false);
  // Jail state · owner-authorised 2026-10-25. Only populated if the
  // broadcaster has targeted THIS viewer. Non-null = full-screen
  // overlay active + composer disabled + comments hidden.
  const [jailEvent, setJailEvent] = React.useState<JailEventPayload | null>(
    null,
  );
  // Tap-to-pause state · owner-authorised 2026-10-25. Centre-tap on
  // the video area toggles playback for the viewer only. The broadcaster
  // keeps streaming; resuming jumps back to the live edge (standard
  // MediaStream behaviour). Reset to false whenever the viewer state
  // leaves "live" so a stale pause doesn't persist across reconnects.
  const [isPaused, setIsPaused] = React.useState(false);
  // Hold-to-immersive state · owner-authorised 2026-10-25. A 3-second
  // press-and-hold on the stream area hides ALL chrome (comments
  // overlay, product card, footer, LIVE pill, pause icon, swipe
  // hints, self-indicator) · just the raw video remains. The next
  // tap exits immersive and brings the chrome back. Pause state is
  // NOT changed by entering/exiting immersive · the two gestures are
  // orthogonal: short tap = pause, long hold = immersive.
  const [isImmersive, setIsImmersive] = React.useState(false);
  // Owner spec 2026-10-24 · reply mode state. When set, the footer
  // shows "Replying to X" and attaches the context on next send.
  const [replyContext, setReplyContext] =
    React.useState<LiveReplyContext | null>(null);
  // Guest derivation · empty / sentinel viewerAccountId means the
  // page component couldn't resolve a signed-in session. The page
  // can still mount the viewer so a guest can WATCH · composer is
  // locked.
  const isGuest = !viewerAccountId || viewerAccountId.length === 0;
  const viewerClientRef = React.useRef<LiveViewerClient | null>(null);
  const featuredChannelRef =
    React.useRef<FeaturedProductChannelHandle | null>(null);
  const commentsChannelRef =
    React.useRef<LiveCommentsChannelHandle | null>(null);
  const jailChannelRef = React.useRef<JailChannelHandle | null>(null);
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

    // Live comments channel · ephemeral (no DB persistence per the
    // sealed feature-contract §4). Only the last ~6 are rendered via
    // LiveCommentsOverlay.
    const commentsChannel = openLiveCommentsChannel({
      sessionId,
      role: "viewer",
      selfAccountId: viewerAccountId,
      onComment: (payload) => {
        setComments((prev) => {
          // Cap retained history client-side at 50 · tail is what the
          // overlay renders.
          const next = [...prev, payload];
          return next.length > 50 ? next.slice(-50) : next;
        });
      },
    });
    commentsChannelRef.current = commentsChannel;

    // Jail channel · owner-authorised 2026-10-25 · the broadcaster
    // can issue a 10-minute timeout targeted at a specific viewer.
    // All viewers subscribe · only the targeted viewer renders the
    // full-screen overlay. Cross-session guard is enforced inside
    // openJailChannel so a stale subscription cannot leak events
    // between sessions.
    const jailChannel = openJailChannel({
      sessionId,
      role: "viewer",
      onJail: (event) => {
        if (event.targetAccountId !== viewerAccountId) return;
        setJailEvent(event);
      },
      onRelease: (targetAccountId) => {
        if (targetAccountId !== viewerAccountId) return;
        setJailEvent(null);
      },
    });
    jailChannelRef.current = jailChannel;

    return () => {
      void client.leave();
      void featuredChannel.close();
      void commentsChannel.close();
      void jailChannel.close();
      viewerClientRef.current = null;
      featuredChannelRef.current = null;
      commentsChannelRef.current = null;
      jailChannelRef.current = null;
    };
  }, [sessionId, viewerAccountId]);

  // Footer handlers · Like / Comment / Share-evidence.
  //
  // Doctrine: these are the ONLY engagement signals that generate a
  // Shop-Contacts card entitlement at session end. Fire-and-forget
  // here · the actual participation-ledger write happens server-side
  // when the broadcaster ends the session (batch materialisation).
  // This client surface is responsible for emitting the evidence
  // itself (comment via Realtime channel · like + share-evidence
  // local-only for now; the ledger wiring is a follow-up slice that
  // the owner has gated on the share-evidence enum approval).
  const handleLike = React.useCallback(() => {
    setIsLiked((prev) => !prev);
    // Fire-and-forget · the server action is idempotent (ON CONFLICT
    // DO NOTHING) so repeated taps are no-ops. A failed network call
    // leaves the UI optimistic state unchanged · the next like still
    // tries and the ledger simply does not record this viewer if
    // every attempt fails.
    void import("@/app/nex-native/live-commerce/enter-broadcast-room/_actions").then(
      ({ recordLiveEngagementAction }) =>
        recordLiveEngagementAction({ sessionId, kind: "like" }).catch(() => {}),
    );
  }, [sessionId]);

  const handleSendComment = React.useCallback(
    (text: string, replyFromFooter?: LiveReplyContext) => {
      const channel = commentsChannelRef.current;
      if (!channel) return;
      // Hard-guard · guest sentinel never produces a Realtime write.
      if (isGuest) return;
      // Pass reply context through to the channel · the channel
      // validates both-or-neither on the wire. We DROP the display
      // name from the Realtime payload (receivers resolve names
      // locally · the payload stays identity-minimal).
      channel.post(
        text,
        replyFromFooter
          ? {
              replyToAuthorAccountId: replyFromFooter.replyToAuthorAccountId,
              replyToTextPreview: replyFromFooter.replyToTextPreview,
            }
          : undefined,
      );
      // Echo locally since the Realtime config has `self: false`.
      setComments((prev) => {
        const next = [
          ...prev,
          {
            authorAccountId: viewerAccountId,
            text,
            clientSentAt: new Date().toISOString(),
            ...(replyFromFooter && {
              replyToAuthorAccountId: replyFromFooter.replyToAuthorAccountId,
              replyToTextPreview: replyFromFooter.replyToTextPreview,
            }),
          },
        ];
        return next.length > 50 ? next.slice(-50) : next;
      });
      // Record once per session via the server action · subsequent
      // comments in the same session are idempotent no-ops at the
      // DB level.
      void import("@/app/nex-native/live-commerce/enter-broadcast-room/_actions").then(
        ({ recordLiveEngagementAction }) =>
          recordLiveEngagementAction({ sessionId, kind: "comment" }).catch(
            () => {},
          ),
      );
    },
    [viewerAccountId, sessionId, isGuest],
  );

  // Owner spec 2026-10-24 · tapping a comment selects it for reply.
  // The footer renders "Replying to X" and attaches the context on
  // next send. Guards:
  //   · Guests cannot enter reply mode (composer is locked anyway).
  //   · Can't reply to one's own comment (silent no-op).
  const handleReplyRequested = React.useCallback(
    (comment: LiveCommentPayload) => {
      if (isGuest) return;
      if (comment.authorAccountId === viewerAccountId) return;
      setReplyContext({
        replyToAuthorAccountId: comment.authorAccountId,
        // Overlay resolves identity; we fall back to NEX-ID for the
        // composer chip. A richer resolver can replace this.
        replyToAuthorDisplayName: `nex-${comment.authorAccountId.slice(0, 8)}`,
        replyToTextPreview: comment.text.slice(0, 60),
      });
    },
    [isGuest, viewerAccountId],
  );

  const handleShareEvidence = React.useCallback(
    (evidence: ShareEvidence) => {
      // Expose for Playwright diagnostics (not authoritative).
      if (typeof document !== "undefined") {
        document.body.dataset.nexLiveLastShareEvidence = evidence;
      }
      // Record validated share-evidence via the server action. Only
      // the FIRST evidence tag wins per session (ON CONFLICT DO
      // NOTHING on the (session, viewer, 'share') unique key).
      //
      // Owner spec 2026-10-24 share-sheet added 3 user-facing options
      // (nex-contact · whatsapp · copy-link). The server-side enum is
      // the older {native-share · copy-link · chat-send} shape. Map
      // the new names to the compatible existing enum so we don't
      // need a migration for the UI change:
      //   nex-contact → chat-send  (same intent · routes to chat)
      //   whatsapp    → native-share (external share handoff)
      //   copy-link   → copy-link
      //   native-share/copy-link/chat-send → passthrough
      const mapped: "native-share" | "copy-link" | "chat-send" =
        evidence === "nex-contact"
          ? "chat-send"
          : evidence === "whatsapp"
            ? "native-share"
            : evidence;
      void import("@/app/nex-native/live-commerce/enter-broadcast-room/_actions").then(
        ({ recordLiveEngagementAction }) =>
          recordLiveEngagementAction({
            sessionId,
            kind: "share",
            shareEvidence: mapped,
          }).catch(() => {}),
      );
    },
    [sessionId],
  );

  const viewShopHref = broadcasterAccountId
    ? `/nex-native/u/${broadcasterAccountId}`
    : "#";
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/nex-native/live-commerce/${sessionId}`
      : `/nex-native/live-commerce/${sessionId}`;

  /* Context-aware button rule 2026-10-24: when the signed-in viewer
     is actually the broadcaster of this session (opening the viewer
     URL on their own stream · typically accidental or via self-link),
     we do NOT render the customer-facing View Shop button. The
     broadcaster has their own controls at /live-commerce/enter-broadcast-room.
     The footer stays mounted (Like/Share still make no sense on
     one's own stream · so Like + Share hide too; the composer stays
     so the broadcaster can at least SEE the comments overlay they're
     authoring from the viewer side). */
  const isSelf = broadcasterAccountId !== null
    && broadcasterAccountId === viewerAccountId;

  // Owner-authorised 2026-10-30 · Stage 2 Follow seed effect.
  // Resolves the viewer's follow state against the broadcaster once
  // both identities are known + viewer is signed-in + not self.
  // Cancellation guard protects against the broadcaster swap during
  // the vertical-swipe navigation (siblings) · we clear the resolved
  // state immediately on dependency change so the stale answer never
  // leaks between sessions.
  React.useEffect(() => {
    if (!broadcasterAccountId) {
      setResolvedFollowState(null);
      setBroadcasterFollowersCount(null);
      return;
    }
    let cancelled = false;
    setResolvedFollowState(null);
    setBroadcasterFollowersCount(null);
    // Follow-state query is auth-gated · skip for guests + self-view.
    // Count query is public · always fetch when broadcaster is known
    // (viewers want to see the broadcaster's follower count even if
    // they're the broadcaster themself inspecting their own stream).
    const followStatePromise =
      viewerAccountId !== null && !isSelf
        ? isFollowingAction({ followeeId: broadcasterAccountId })
            .then((r) => {
              if (cancelled) return;
              if (r.ok) {
                setResolvedFollowState(r.data.state === "following" ? "following" : "not-following");
              }
            })
            .catch(() => {
              /* fail-open · leave null */
            })
        : Promise.resolve();
    const countPromise = getFollowCountsAction({ accountId: broadcasterAccountId })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) setBroadcasterFollowersCount(r.data.followersCount);
      })
      .catch(() => {
        /* fail-open · leave null · chip stays hidden */
      });
    void Promise.all([followStatePromise, countPromise]);
    return () => {
      cancelled = true;
    };
  }, [broadcasterAccountId, viewerAccountId, isSelf]);

  /* Vertical swipeable feed · 2026-10-24.
     TikTok-Live-style navigation: swipe up → next live broadcast,
     swipe down → previous. The current session's index in the
     server-provided `siblingSessionIds` list is the anchor; swipes
     navigate via router.push to the adjacent URL so each snap is a
     fresh viewer client with its own WebRTC connection (prevents
     multiple simultaneous mesh connections). Each session renders
     at 100dvh × 100dvw — no internal scroll · comments and footer
     are chrome overlays, not scroll content.
     Threshold: 60px of vertical travel + ignore if horizontal
     travel dominates (prevents accidental swipes during a tap).
     Edge behaviour: swiping up at the end OR down at the start is
     a no-op (no wraparound; honest "end of list" feel). */
  const siblings = React.useMemo(
    () => siblingSessionIds ?? [sessionId],
    [siblingSessionIds, sessionId],
  );
  const currentIndex = React.useMemo(() => {
    const idx = siblings.indexOf(sessionId);
    return idx === -1 ? 0 : idx;
  }, [siblings, sessionId]);
  const nextSessionId = currentIndex < siblings.length - 1
    ? siblings[currentIndex + 1]
    : null;
  const prevSessionId = currentIndex > 0 ? siblings[currentIndex - 1] : null;

  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);
  const handleTouchEnd = React.useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      touchStartRef.current = null;
      // Ignore if horizontal travel dominated (not a vertical swipe).
      if (Math.abs(dx) > Math.abs(dy)) return;
      // Ignore if below threshold (treat as tap · don't eat clicks).
      if (Math.abs(dy) < 60) return;
      if (dy < 0 && nextSessionId) {
        // Swipe UP · advance.
        router.push(`/nex-native/live-commerce/${nextSessionId}`);
      } else if (dy > 0 && prevSessionId) {
        // Swipe DOWN · go back.
        router.push(`/nex-native/live-commerce/${prevSessionId}`);
      }
    },
    [nextSessionId, prevSessionId, router],
  );

  // Keyboard nav for desktop testing · ArrowUp/ArrowDown mirror the
  // swipe gesture. PageUp/PageDown too for trackpad users without a
  // touch surface.
  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      // Don't hijack keys when the composer textarea is focused.
      const target = ev.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) {
        return;
      }
      if ((ev.key === "ArrowDown" || ev.key === "PageDown") && nextSessionId) {
        ev.preventDefault();
        router.push(`/nex-native/live-commerce/${nextSessionId}`);
      } else if ((ev.key === "ArrowUp" || ev.key === "PageUp") && prevSessionId) {
        ev.preventDefault();
        router.push(`/nex-native/live-commerce/${prevSessionId}`);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    return undefined;
  }, [nextSessionId, prevSessionId, router]);

  // Tap-to-pause · toggle video.play()/video.pause() for this viewer.
  // Side-effect isolated to a useCallback so the tap-catch button
  // doesn't allocate a new fn each render.
  //
  // Design: use the LOCAL `isPaused` state as the source of truth for
  // the toggle direction, not `video.paused`. Reasons:
  //   · In pre-live states the video element has no `srcObject` yet;
  //     `video.paused` returns `true` by default, so every tap would
  //     invoke `play()` (never pause). Using local state lets the
  //     viewer rehearse the gesture + see the pause icon even before
  //     the stream has fully negotiated.
  //   · In jsdom tests the video element has no play/pause plumbing;
  //     local state keeps the hook deterministic.
  // The real `video.play()` / `video.pause()` calls are still issued
  // against the DOM element so the stream freezes/resumes correctly
  // when a stream IS attached; failures are swallowed (autoplay
  // policy, no stream) · the chip + icon still reflect the viewer's
  // intent.
  const togglePause = React.useCallback(() => {
    const video = videoRef.current;
    setIsPaused((prev) => {
      const next = !prev;
      if (video) {
        if (next) {
          try {
            video.pause();
          } catch {
            /* no-op · video element rejected pause (unlikely) */
          }
        } else {
          // Resuming a MediaStream jumps to the live edge · no
          // buffered "catch-up" is possible. Honest to the viewer:
          // pausing is a local display pause, not a DVR.
          void video.play().catch(() => {
            /* autoplay policy or no stream · UI stays in sync via
               the state we just set */
          });
        }
      }
      return next;
    });
  }, []);

  // Reset pause state when the viewer enters a dead state (nothing
  // to pause anymore). Pause stays available in waiting / connecting
  // / live so a viewer can toggle the state before the stream has
  // fully connected and the UI remains consistent across reconnects.
  React.useEffect(() => {
    if (
      (state === "ended" || state === "at-capacity" || state === "offline") &&
      isPaused
    ) {
      setIsPaused(false);
    }
  }, [state, isPaused]);

  // Reset immersive mode when the viewer enters a dead state · same
  // rationale as pause reset. Also auto-exit immersive if a jail
  // event lands so the jail overlay is not hidden.
  React.useEffect(() => {
    if (
      state === "ended" ||
      state === "at-capacity" ||
      state === "offline" ||
      jailEvent !== null
    ) {
      if (isImmersive) setIsImmersive(false);
    }
  }, [state, jailEvent, isImmersive]);

  // ─── Hold-to-immersive + tap-to-pause state machine ─────────────
  //
  // Short tap (click, < 3 s) → togglePause()
  // Long hold (≥ 3 s)         → enter immersive (hides all chrome)
  // Click while immersive     → exit immersive (does NOT toggle pause)
  // Pointer move > HOLD_MOVE_THRESHOLD_PX → cancel the hold timer
  //
  // Design: we use `onClick` as the primary short-tap trigger because
  // it is the most reliable React cross-platform synthetic event
  // (desktop mouse + mobile tap release both fire it, and React 19
  // handles its delegation consistently). The hold timer is managed
  // by `onMouseDown`/`onTouchStart` + `onMouseUp`/`onTouchEnd` +
  // movement cancels. When a 3-second hold completes, we SUPPRESS the
  // subsequent `onClick` via `holdSuppressClickRef` so pause does not
  // double-fire. All timing is `setTimeout`-based · no wall-clock
  // arithmetic (consistent with `useLiveClockTick` discipline).
  const HOLD_IMMERSIVE_MS = 3000;
  const HOLD_MOVE_THRESHOLD_PX = 10;
  const immersiveTimerRef = React.useRef<number | null>(null);
  const immersiveStartRef = React.useRef<{ x: number; y: number } | null>(
    null,
  );
  // When true, the next `click` event is swallowed · set when a 3 s
  // hold fires so the pointerup/click pair doesn't also toggle pause.
  const holdSuppressClickRef = React.useRef(false);

  const clearImmersiveTimer = React.useCallback(() => {
    if (immersiveTimerRef.current !== null) {
      window.clearTimeout(immersiveTimerRef.current);
      immersiveTimerRef.current = null;
    }
  }, []);

  // Clean up on unmount (defence against leaking timers).
  React.useEffect(() => {
    return () => {
      clearImmersiveTimer();
    };
  }, [clearImmersiveTimer]);

  // Shared logic for mousedown / touchstart · arm the hold timer
  // when the stream is live. Pre-live / dead states keep tap-to-pause
  // via onClick but don't arm immersive-enter.
  const beginHold = React.useCallback(
    (x: number, y: number) => {
      // In immersive mode, holding doesn't do anything useful · the
      // onClick path handles exit. Still track the start position so
      // move-cancel works, but don't arm the immersive timer.
      immersiveStartRef.current = { x, y };
      if (state === "live" && !isImmersive) {
        clearImmersiveTimer();
        immersiveTimerRef.current = window.setTimeout(() => {
          holdSuppressClickRef.current = true;
          setIsImmersive(true);
          immersiveTimerRef.current = null;
        }, HOLD_IMMERSIVE_MS);
      }
    },
    [clearImmersiveTimer, isImmersive, state],
  );

  const moveMaybeCancel = React.useCallback(
    (x: number, y: number) => {
      const start = immersiveStartRef.current;
      if (start === null) return;
      const dx = x - start.x;
      const dy = y - start.y;
      if (Math.hypot(dx, dy) > HOLD_MOVE_THRESHOLD_PX) {
        clearImmersiveTimer();
        immersiveStartRef.current = null;
      }
    },
    [clearImmersiveTimer],
  );

  const endHold = React.useCallback(() => {
    clearImmersiveTimer();
    immersiveStartRef.current = null;
  }, [clearImmersiveTimer]);

  const handleTapCatchMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      beginHold(e.clientX, e.clientY);
    },
    [beginHold],
  );

  const handleTapCatchMouseMove = React.useCallback(
    (e: React.MouseEvent) => {
      // mousemove without a button pressed on the button is fine ·
      // the start-ref gate inside moveMaybeCancel handles no-op cases.
      moveMaybeCancel(e.clientX, e.clientY);
    },
    [moveMaybeCancel],
  );

  const handleTapCatchMouseUp = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      endHold();
    },
    [endHold],
  );

  const handleTapCatchTouchStart = React.useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      const t = e.touches[0];
      if (!t) return;
      beginHold(t.clientX, t.clientY);
    },
    [beginHold],
  );

  const handleTapCatchTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      moveMaybeCancel(t.clientX, t.clientY);
    },
    [moveMaybeCancel],
  );

  const handleTapCatchTouchEnd = React.useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      endHold();
    },
    [endHold],
  );

  const handleTapCatchClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // If a 3-second hold just fired, swallow this click once.
      if (holdSuppressClickRef.current) {
        holdSuppressClickRef.current = false;
        return;
      }
      // In immersive mode, any click exits immersive · does NOT also
      // toggle pause (owner spec: "tap again shows overlay again").
      if (isImmersive) {
        setIsImmersive(false);
        return;
      }
      togglePause();
    },
    [isImmersive, togglePause],
  );

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
      data-nex-live-viewer-main
      data-nex-live-viewer-swipe-prev={prevSessionId ?? ""}
      data-nex-live-viewer-swipe-next={nextSessionId ?? ""}
      data-nex-live-viewer-index={currentIndex}
      data-nex-live-viewer-sibling-count={siblings.length}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        height: "100dvh",
        width: "100vw",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        touchAction: "pan-y",
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
        {/* Tap-to-pause overlay · owner-authorised 2026-10-25 ·
            a full-size invisible button that toggles video playback
            whenever a `<video>` element exists on the page.
            Suppressed during jail (viewer is in a muted state) and
            when a StateOverlay is showing (nothing to pause yet).
            Stacking order:
              · ProductOverlayCard (zIndex 20) · still swallows its
                own taps.
              · JailOverlay (zIndex 60) · covers everything.
              · LiveCommentsOverlay (pointer-events: none wrapper) ·
                empty space passes clicks through to this button;
                comment rows re-enable pointer-events for reply.
            Touch handling: we handle `onPointerDown` (modern unified
            pointer path · works for mouse + touch + pen on all
            modern browsers including iOS Safari). `onClick` is NOT
            used because iOS Safari sometimes suppresses synthetic
            click under `touchAction: pan-y` or buffers it behind a
            300 ms delay. `onPointerDown` fires immediately. The
            touch handler guards against swipe-vs-tap by tracking
            `touchStartRef` on the outer <main>; a tap that doesn't
            move past the swipe threshold has already been emitted
            when the pointer went down. */}
        {/* Non-immersive: large VISIBLE central circular tap zone.
            Visible subtle outline so the user can see where to tap.
            Click toggles pause; hold 3 s enters immersive. */}
        {state !== "ended" &&
          state !== "at-capacity" &&
          state !== "offline" &&
          !jailEvent &&
          !isImmersive && (
            <button
              type="button"
              onClick={handleTapCatchClick}
              onMouseDown={handleTapCatchMouseDown}
              onMouseMove={handleTapCatchMouseMove}
              onMouseUp={handleTapCatchMouseUp}
              onMouseLeave={handleTapCatchMouseUp}
              onTouchStart={handleTapCatchTouchStart}
              onTouchMove={handleTapCatchTouchMove}
              onTouchEnd={handleTapCatchTouchEnd}
              onTouchCancel={handleTapCatchTouchEnd}
              data-nex-live-tap-to-pause
              data-nex-live-tap-to-pause-state={isPaused ? "paused" : "playing"}
              aria-label={
                isPaused
                  ? "Resume live stream"
                  : "Pause live stream · hold 3 seconds for immersive view"
              }
              aria-pressed={isPaused}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                // Owner-authorised 2026-10-25 · "make the center
                // radius large". A 70vmin circle fits comfortably
                // inside the phone-frame viewport without touching
                // the LIVE pill or the viewer footer, and is still
                // the largest-possible visible target. Capped at
                // 480 px so very large tablets / desktops do not get
                // a dinner-plate button.
                width: "min(70vmin, 480px)",
                height: "min(70vmin, 480px)",
                borderRadius: "50%",
                zIndex: 50,
                // Subtle visible chrome so the user sees the tap
                // target. Low opacity so the video is still legible
                // through the circle.
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                boxShadow:
                  "inset 0 0 32px rgba(255,255,255,0.04), 0 0 24px rgba(0,0,0,0.18)",
                padding: 0,
                margin: 0,
                cursor: "pointer",
                appearance: "none",
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
              }}
            />
          )}
        {/* Immersive: full-screen invisible exit catch. Any click
            exits immersive view. The non-immersive central circle is
            NOT rendered during immersive · hiding it is the whole
            point of immersive mode. */}
        {isImmersive && !jailEvent && (
          <button
            type="button"
            onClick={handleTapCatchClick}
            data-nex-live-immersive="true"
            aria-label="Exit immersive view"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 50,
              background: "transparent",
              border: 0,
              padding: 0,
              margin: 0,
              cursor: "pointer",
              appearance: "none",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          />
        )}
        {/* Centre pause icon · renders only while paused. Non-
            interactive · the tap-catch button beneath it handles the
            resume tap. `prefers-reduced-motion` leaves the icon
            static (no entry animation). */}
        {isPaused && !jailEvent && !isImmersive && (
          <div
            aria-hidden
            data-nex-live-pause-icon
            style={{
              position: "absolute",
              inset: 0,
              // Z-index 51 so the icon paints ABOVE the invisible
              // tap-catch button (z=50). The icon has
              // pointer-events: none so clicks pass through to the
              // button beneath · the icon is purely decorative.
              zIndex: 51,
              display: "grid",
              placeItems: "center",
              pointerEvents: "none",
            }}
          >
            <style>{`
              @keyframes nexLivePauseIconIn {
                from { opacity: 0; transform: scale(0.82); }
                to   { opacity: 1; transform: scale(1); }
              }
              @media (prefers-reduced-motion: reduce) {
                [data-nex-live-pause-icon] > div {
                  animation: none !important;
                }
              }
            `}</style>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: "rgba(2, 9, 20, 0.62)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.45)",
                display: "grid",
                placeItems: "center",
                animation: "nexLivePauseIconIn 220ms ease-out",
              }}
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <rect
                  x="7"
                  y="5"
                  width="3.5"
                  height="14"
                  rx="1"
                  fill="#F2F5F8"
                />
                <rect
                  x="13.5"
                  y="5"
                  width="3.5"
                  height="14"
                  rx="1"
                  fill="#F2F5F8"
                />
              </svg>
            </div>
          </div>
        )}
        {state !== "live" && (
          <StateOverlay state={state} error={error} />
        )}
        {state === "live" && featuredProduct && !jailEvent && !isImmersive && (
          <ProductOverlayCard
            product={featuredProduct}
            onOrderNow={handleOrderNow}
          />
        )}
        {state === "live" && !jailEvent && !isImmersive && (
          <LiveCommentsOverlay
            comments={comments}
            onReplyRequested={handleReplyRequested}
          />
        )}
        {/* Jail overlay · owner-authorised 2026-10-25 · renders ONLY
            when the broadcaster has targeted this viewer. Covers the
            stream, product card, and comments overlay. Footer is
            separately suppressed below. Video asset path is a future
            commit; the overlay falls back to a static dark panel
            while the asset is unconfirmed. */}
        {jailEvent && (
          <>
            {/* Owner directive 2026-10-28 · the sealed `onComplete`
                callback (fired at the END of the 10-minute jail) is
                renamed to `onDismiss` which now fires at the 8-second
                overlay-dismiss window. The jail state itself persists
                for the full durationMs · a follow-up Phase A2 edit
                will replace the composer with a muted-state pill
                until the full countdown ends. For now, keep the
                setJailEvent(null) handler so the overlay still clears
                honestly · once the muted-composer wire is in place
                we'll separate the two state transitions. */}
            <JailOverlay
              startedAtMs={jailEvent.startedAtMs}
              durationMs={jailEvent.durationMs}
              onDismiss={() => setJailEvent(null)}
              /* Owner directive 2026-10-29 · full-bleed background MP4
                 copied to public/nex-jail-background.mp4 · plays while
                 the 8-s dismiss window elapses. */
              videoSrc="/nex-jail-background.mp4"
            />
          </>
        )}
      </div>
      {/* Footer sits OUTSIDE the video div so the StateOverlay
          (position:absolute inset:0 on the video surface) does not
          cover it. Visible in pre-live states (idle/waiting/
          connecting) in a disabled layout so viewers see the Like /
          View Shop / Share / text-input affordances arrive · taps
          are disabled until state === "live" so no engagement fires
          against a session that isn't yet broadcasting. Hidden in
          dead states (ended / at-capacity / offline) where there is
          nothing to engage with. */}
      {/* Owner-authorised 2026-10-30 · Stage 1 Follow surface on Live
          viewer. Floats top-right · visible when state is live/
          waiting/connecting · hidden on self-view · hidden when
          jailed · hidden in immersive mode (same gates as the
          footer below). Follow source is 'live' per the sealed
          D11/D12 scope. */}
      {(state === "idle" || state === "waiting" || state === "connecting" || state === "live")
        && !isSelf
        && !jailEvent
        && !isImmersive
        && broadcasterAccountId !== null && (
        <div
          data-nex-live-viewer-follow-slot
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0px) + 14px)",
            right: 12,
            zIndex: 25,
            pointerEvents: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          <FollowButton
            // Owner-authorised 2026-10-30 · Stage 2 Follow seed ·
            // key-remount with the resolved state so the button
            // repaints honestly once isFollowingAction returns.
            // Pending window = "pending-<id>" · once resolved the
            // key flips and FollowButton re-seeds its own useState
            // from the new `initialState` prop.
            key={`live-follow-${broadcasterAccountId}-${resolvedFollowState ?? "pending"}`}
            followeeId={broadcasterAccountId}
            source="live"
            size="sm"
            initialState={resolvedFollowState ?? "not-following"}
            isSelfAccount={false}
          />
          {/* Owner-authorised 2026-10-30 · Stage 2b · compact
              broadcaster follower-count chip for the Live overlay.
              Inlined (not FollowersCountChip which is a two-number
              side-by-side layout for Profile) · Live shows only
              the follower number, right-aligned under the Follow
              button. Hidden until the server returns a count. */}
          {broadcasterFollowersCount !== null && (
            <div
              data-nex-live-broadcaster-followers
              style={{
                background: "rgba(0, 0, 0, 0.55)",
                padding: "3px 10px",
                borderRadius: 999,
                backdropFilter: "blur(8px)",
                fontSize: 11,
                fontWeight: 700,
                color: "#F0F6FF",
                letterSpacing: "0.04em",
                lineHeight: 1.3,
              }}
            >
              {formatLiveCount(broadcasterFollowersCount)} followers
            </div>
          )}
        </div>
      )}

      {(state === "idle" || state === "waiting" || state === "connecting" || state === "live") && !isSelf && !jailEvent && !isImmersive && (
        <LiveViewerFooter
          viewShopHref={viewShopHref}
          shareUrl={shareUrl}
          shareTitle="Watch this NEX Live"
          onLike={handleLike}
          onComment={handleSendComment}
          onShareEvidence={handleShareEvidence}
          isLiked={isLiked}
          disabled={state !== "live" || !broadcasterAccountId}
          isGuest={isGuest}
          replyContext={replyContext}
          onReplyCancel={() => setReplyContext(null)}
          /* Owner directive 2026-10-25 (Phase B) · the Message pill
             opens the sealed NEX connection-invitation flow via the
             existing createFriendRequestAction (NOT a new system).
             Resolves the broadcaster InviteTarget lazily on first
             open · caches so re-opens are instant. */
          onMessagePressed={() => {
            setMessagePanelOpen(true);
            if (
              broadcasterAccountId
              && inviteTargetFetchedRef.current !== broadcasterAccountId
            ) {
              inviteTargetFetchedRef.current = broadcasterAccountId;
              void getLiveInviteTargetAction(broadcasterAccountId).then(
                (result) => {
                  if (result.kind === "ok") setInviteTarget(result.target);
                  else setInviteTarget(null);
                },
              );
            }
          }}
          /* Owner directive 2026-10-25 · composer-header author
             identity. Live viewer uses the resolved broadcaster
             display name when available · otherwise falls back to
             "Broadcaster" so the placeholder-rotation UX still works.
             authorIsLive mirrors the real session state so the red
             ping is honest: it only shows while state === "live". */
          authorDisplayName={inviteTarget?.displayName ?? "Broadcaster"}
          authorAvatarUrl={inviteTarget?.avatarUrl ?? undefined}
          authorIsLive={state === "live"}
        />
      )}
      {/* Owner directive 2026-10-25 (Phase B) · MessagePanel reuses the
          sealed NEX connection-invitation system. It opens when the
          viewer taps Message in the footer's 3-dot slide-out. When
          `inviteTarget` is still resolving we pass null · the panel
          renders a graceful "not invitable yet" state until the
          server action responds. */}
      {messagePanelOpen && (
        <MessagePanel
          open={messagePanelOpen}
          onClose={() => setMessagePanelOpen(false)}
          target={inviteTarget}
          isGuest={isGuest}
          signInHref={
            typeof window !== "undefined"
              ? `/nex-native/sign-in?returnTo=${encodeURIComponent(
                  window.location.pathname + window.location.search,
                )}`
              : "/nex-native/sign-in"
          }
        />
      )}
      {isSelf && state === "live" && !isImmersive && (
        <div
          data-nex-live-viewer-self-indicator
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)",
            background: "rgba(2, 9, 20, 0.82)",
            borderTop: "1px solid rgba(255, 114, 0, 0.42)",
            color: "#FF7200",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textAlign: "center",
            zIndex: 2,
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          You&apos;re the broadcaster · use the Go Live controls to end this stream
        </div>
      )}

      {/* Swipe affordance · subtle chevron hints · hidden when there
          are no siblings to navigate to. Positioned mid-screen edges
          so they do not fight with the footer or the live indicator. */}
      {prevSessionId !== null && !isImmersive && (
        <div
          data-nex-live-viewer-swipe-up-hint
          aria-hidden
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0px) + 48px)",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 18,
            color: "rgba(242, 245, 248, 0.4)",
            fontWeight: 700,
            letterSpacing: "0.1em",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 1,
          }}
        >
          ⌃
        </div>
      )}
      {nextSessionId !== null && !isImmersive && (
        <div
          data-nex-live-viewer-swipe-down-hint
          aria-hidden
          style={{
            position: "absolute",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 140px)",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 18,
            color: "rgba(242, 245, 248, 0.4)",
            fontWeight: 700,
            letterSpacing: "0.1em",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 1,
          }}
        >
          ⌄
        </div>
      )}

      {/* Top-right live indicator · hidden during immersive view */}
      {state === "live" && !isImmersive && (
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
