// src/components/nex-native/live-commerce/LiveCommentsOverlay.tsx
//
// NEX Live · premium ephemeral comment overlay.
// -----------------------------------------------------------------------------
// Owner spec 2026-10-24 (comments polish pass):
//   · Maximum THREE visible comment cards at once (down from 6).
//   · Each comment renders: avatar + display name + text + reply tap.
//   · ~6s per-comment lifetime · gentle fade/slide, no abrupt removal.
//   · Newest at the bottom · older rise up and fade.
//   · Rapid-burst protection: when 3 cards occupy the overlay, the
//     NEWEST tap-in evicts the oldest (never let the overlay grow).
//   · Reply affordance: tap a comment → the parent gets the comment
//     to drive composer reply mode. No reply-on-swipe to avoid
//     accidental sends.
//   · Respects prefers-reduced-motion.
//
// Doctrine honoured:
//   · Ephemeral · the overlay owns NO persistence · it's a derived
//     view of the Realtime stream.
//   · Identity rule: display name + avatar are OPTIONAL · when the
//     parent cannot resolve them we fall back to the opaque NEX-ID.
//     This keeps the overlay honest when a sender's identity is
//     unknown (late joiners, cross-session edge cases).
//
// What this file does NOT do:
//   · Does NOT persist comments. The 6s lifetime is a presentation
//     rule, not a server retention policy.
//   · Does NOT invent nested threads. Replies are flat · the reply
//     context is a visual pointer only (shown as "↪ Replying to X").

"use client";

import * as React from "react";
import type { LiveCommentPayload } from "@/lib/nex-native/live-broadcast/live-comments-channel";

/** Owner spec 2026-10-24 · "Maximum 3 on-screen". */
export const MAX_VISIBLE_COMMENTS = 3;
/** Owner spec 2026-10-24 · "About 6 seconds, then gently fades". */
export const COMMENT_LIFETIME_MS = 6000;
/** The exit animation duration · comments stay in the DOM this long
 *  after their lifetime expires so the fade is visible. */
const EXIT_ANIM_MS = 400;

export interface LiveCommentsOverlayProps {
  readonly comments: readonly LiveCommentPayload[];
  /** Resolve a display-friendly identifier. Default: opaque NEX-ID. */
  readonly resolveNexId?: (accountId: string) => string;
  /** Optional display-name resolver. When provided and non-empty,
   *  renders the display name alongside/instead of the NEX-ID. */
  readonly resolveDisplayName?: (accountId: string) => string | null;
  /** Optional avatar URL resolver. When provided, renders an avatar;
   *  otherwise an initial-based circle. */
  readonly resolveAvatarUrl?: (accountId: string) => string | null;
  /** Owner spec 2026-10-24 · tap a comment to reply. Receives the
   *  tapped comment · the parent decides whether to enter reply
   *  mode (e.g. only for signed-in viewers, not guests). */
  readonly onReplyRequested?: (comment: LiveCommentPayload) => void;
  /** Owner directive 2026-10-25 (F1) · opt-in SSR seed. When
   *  provided, the component initialises its visible-entries state
   *  with these comments so `renderToStaticMarkup` tests can inspect
   *  the rendered DOM. The seed is capped by `MAX_VISIBLE_COMMENTS`
   *  using the same tail-based rule the Realtime useEffect applies
   *  post-admit, so an SSR snapshot matches production behaviour
   *  after mount.
   *
   *  Production callers DO NOT pass this prop · the state starts
   *  empty, the useEffect admits comments as they arrive from
   *  `props.comments`, and the exit timer runs normally. The seed
   *  does NOT skip, bypass, or weaken the real comment-loading
   *  behaviour · it is additive and opt-in. */
  readonly initialVisibleEntries?: readonly LiveCommentPayload[];
}

/** Shape used internally · each comment gets a stable key + an
 *  arrival timestamp used to drive the lifetime timer. */
interface VisibleEntry {
  readonly key: string;
  readonly comment: LiveCommentPayload;
  readonly arrivedAt: number;
  readonly state: "live" | "exiting";
}

export function LiveCommentsOverlay(
  props: LiveCommentsOverlayProps,
): React.JSX.Element | null {
  const resolveNex =
    props.resolveNexId ?? ((id: string) => `nex-${id.slice(0, 8)}`);
  const resolveName = props.resolveDisplayName ?? (() => null);
  const resolveAvatar = props.resolveAvatarUrl ?? (() => null);

  // Build a stable key per comment: {authorAccountId}:{clientSentAt}.
  // Hoisted above the useState so the lazy initialiser can call it.
  const stableKeyFor = (c: LiveCommentPayload): string =>
    `${c.authorAccountId}:${c.clientSentAt}`;

  // Internal state · what the overlay is currently showing. The
  // parent feeds the full Realtime list via `props.comments`; the
  // overlay projects that into a bounded, timer-driven view.
  //
  // Owner directive 2026-10-25 (F1) · opt-in SSR seed. When
  // `initialVisibleEntries` is provided we initialise entries with
  // the tail-capped seed so renderToStaticMarkup can inspect visible
  // content. In production this prop is omitted and entries starts
  // empty · identical to the original behaviour.
  const [entries, setEntries] = React.useState<readonly VisibleEntry[]>(() => {
    if (
      !props.initialVisibleEntries ||
      props.initialVisibleEntries.length === 0
    ) {
      return [];
    }
    const seed = props.initialVisibleEntries.slice(-MAX_VISIBLE_COMMENTS);
    const now = Date.now();
    return seed.map((c, i) => ({
      key: stableKeyFor(c),
      comment: c,
      arrivedAt: now + i,
      state: "live" as const,
    }));
  });
  const lastConsumedKeyRef = React.useRef<string | null>(
    props.initialVisibleEntries && props.initialVisibleEntries.length > 0
      ? stableKeyFor(
          props.initialVisibleEntries[props.initialVisibleEntries.length - 1]!,
        )
      : null,
  );

  // Alias for the hoisted key fn · keeps the useEffect body readable
  // without a second declaration.
  const stableKey = stableKeyFor;

  // Admit new comments: when `props.comments` grows at the tail,
  // ingest the new comments (bounded by the visible cap). This
  // runs synchronously inside a passive effect to keep render pure.
  React.useEffect(() => {
    if (props.comments.length === 0) {
      setEntries([]);
      lastConsumedKeyRef.current = null;
      return;
    }
    const tail = props.comments.slice(-MAX_VISIBLE_COMMENTS * 2); // small over-fetch
    // Find the index of the last-consumed comment · ingest everything
    // after it.
    const lastConsumed = lastConsumedKeyRef.current;
    const startIdx =
      lastConsumed === null
        ? 0
        : (() => {
            const idx = tail.findIndex((c) => stableKey(c) === lastConsumed);
            return idx === -1 ? 0 : idx + 1;
          })();
    const fresh = tail.slice(startIdx);
    if (fresh.length === 0) return;
    const now = Date.now();
    setEntries((prev) => {
      const admitted: VisibleEntry[] = fresh.map((c, i) => ({
        key: stableKey(c),
        comment: c,
        // Stagger arrival timestamps by 1ms so lifetimes don't
        // identical-tick the exit timer.
        arrivedAt: now + i,
        state: "live",
      }));
      // Dedupe · drop any prev entries whose key appears in `admitted`.
      const admittedKeys = new Set(admitted.map((e) => e.key));
      const kept = prev.filter((e) => !admittedKeys.has(e.key));
      const combined = [...kept, ...admitted];
      // Rapid-burst protection · keep the NEWEST MAX_VISIBLE_COMMENTS
      // live entries. Older ones go into "exiting" state so they
      // fade out gracefully instead of disappearing.
      const liveCount = combined.filter((e) => e.state === "live").length;
      if (liveCount > MAX_VISIBLE_COMMENTS) {
        let toEvict = liveCount - MAX_VISIBLE_COMMENTS;
        return combined.map((e) => {
          if (toEvict > 0 && e.state === "live") {
            toEvict -= 1;
            return { ...e, state: "exiting" };
          }
          return e;
        });
      }
      return combined;
    });
    lastConsumedKeyRef.current = stableKey(fresh[fresh.length - 1]!);
  }, [props.comments]);

  // Lifetime timers · each live entry transitions to "exiting" after
  // COMMENT_LIFETIME_MS, then is removed after EXIT_ANIM_MS. One
  // interval drives both so we don't leak dozens of setTimeouts
  // under heavy comment bursts.
  React.useEffect(() => {
    if (entries.length === 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      setEntries((prev) => {
        let changed = false;
        const next: VisibleEntry[] = [];
        for (const e of prev) {
          if (e.state === "live" && now - e.arrivedAt >= COMMENT_LIFETIME_MS) {
            next.push({ ...e, state: "exiting" });
            changed = true;
          } else if (
            e.state === "exiting" &&
            now - e.arrivedAt >= COMMENT_LIFETIME_MS + EXIT_ANIM_MS
          ) {
            // Drop · don't push.
            changed = true;
          } else {
            next.push(e);
          }
        }
        return changed ? next : prev;
      });
    }, 250);
    return () => clearInterval(id);
  }, [entries.length]);

  if (entries.length === 0) return null;

  return (
    <div
      data-nex-live-comments-overlay
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: "absolute",
        left: 12,
        bottom: 128,
        right: 72,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        gap: 8,
        pointerEvents: "none",
        maxWidth: 420,
      }}
    >
      <style>{`
        @keyframes nexLiveCommentIn {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes nexLiveCommentOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-8px) scale(0.98); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-live-comment] {
            animation: none !important;
            transition: opacity 150ms linear !important;
          }
        }
      `}</style>
      {entries.map((e) => {
        const nexId = resolveNex(e.comment.authorAccountId);
        const name = resolveName(e.comment.authorAccountId);
        const avatar = resolveAvatar(e.comment.authorAccountId);
        const displayLabel = name && name.length > 0 ? name : nexId;
        const replyAuthor = e.comment.replyToAuthorAccountId;
        const replyPreview = e.comment.replyToTextPreview;
        const hasReply =
          typeof replyAuthor === "string" &&
          replyAuthor.length > 0 &&
          typeof replyPreview === "string" &&
          replyPreview.length > 0;
        const replyAuthorLabel = hasReply
          ? resolveName(replyAuthor) ?? resolveNex(replyAuthor)
          : null;
        const initial = displayLabel.replace(/[^A-Za-z0-9]/g, "")[0] ?? "N";

        return (
          <button
            key={e.key}
            type="button"
            data-nex-live-comment
            data-nex-live-comment-state={e.state}
            data-nex-live-comment-author={e.comment.authorAccountId}
            aria-label={`Reply to ${displayLabel}`}
            onClick={() => {
              if (props.onReplyRequested) {
                props.onReplyRequested(e.comment);
              }
            }}
            style={{
              background: "rgba(0, 0, 0, 0.56)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              color: "#F2F5F8",
              fontFamily:
                "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
              borderRadius: 16,
              padding: "7px 11px 7px 7px",
              lineHeight: 1.3,
              fontSize: 13,
              textAlign: "left",
              border: "1px solid rgba(255,255,255,0.1)",
              animation:
                e.state === "exiting"
                  ? `nexLiveCommentOut ${EXIT_ANIM_MS}ms ease-in forwards`
                  : "nexLiveCommentIn 240ms ease-out",
              boxShadow: "0 6px 18px -8px rgba(0, 0, 0, 0.7)",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              pointerEvents: "auto",
              cursor: props.onReplyRequested ? "pointer" : "default",
            }}
          >
            {/* Avatar · prefer resolved URL, fall back to initial. */}
            {avatar ? (
              <img
                data-nex-live-comment-avatar
                src={avatar}
                alt=""
                width={28}
                height={28}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              />
            ) : (
              <span
                aria-hidden
                data-nex-live-comment-avatar-fallback
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, #1A2642 0%, #0A1424 100%)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#8BA9D1",
                  flexShrink: 0,
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                {initial.toUpperCase()}
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Reply context pill · present only when payload has
                  BOTH replyToAuthorAccountId AND replyToTextPreview. */}
              {hasReply && (
                <div
                  data-nex-live-comment-reply-ref
                  style={{
                    fontSize: 10,
                    color: "#8BA9D1",
                    letterSpacing: "0.02em",
                    marginBottom: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  <span aria-hidden style={{ fontSize: 10 }}>↪</span>
                  <span style={{ fontWeight: 700 }}>
                    Replying to {replyAuthorLabel}
                  </span>
                  <span
                    style={{
                      opacity: 0.76,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 160,
                    }}
                  >
                    · {replyPreview}
                  </span>
                </div>
              )}
              <span
                data-nex-live-comment-author-label
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#F2F5F8",
                  marginRight: 6,
                }}
              >
                {displayLabel}
              </span>
              <span
                data-nex-live-comment-text
                style={{
                  fontSize: 13,
                  color: "#F2F5F8",
                  // Prevent runaway long messages from blowing the overlay.
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 3,
                  overflow: "hidden",
                  wordBreak: "break-word",
                }}
              >
                {e.comment.text}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
