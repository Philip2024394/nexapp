"use client";

// src/components/nex-native/live-commerce/VideoCommentsOverlay.tsx
//
// NEX Live · TikTok-style floating comments overlay for the
// uploaded-video viewer. Owner directive 2026-10-24:
//   "live post feed should be active for user to post to screen
//    overlay like tiktok with profile image and name".
//
// Scope:
//   · Client-only · no Supabase Realtime channel · no DB write.
//   · Comments live in viewer memory for the session · fade out
//     after ~6s like the sealed LiveCommentsOverlay.
//   · Each comment carries author display name + avatar initial +
//     text. The composer provides the text; the parent supplies
//     the author identity (default "You" for anonymous viewers).
//   · Max 3 visible at once. New comment slides in at the bottom,
//     older ones rise up. Rapid-burst protection: oldest live goes
//     to "exiting" when a 4th arrives.
//
// Honest non-claim:
//   · This is NOT the Live-session comments channel (which uses
//     Supabase Realtime per session_id). Uploaded videos are not
//     live sessions · this overlay is single-viewer local state
//     only so a viewer can SEE what they're posting. Multi-viewer
//     fan-out needs the real-time channel wired up (requires an
//     uploaded_video_id → channel mapping, out of scope this turn).

import * as React from "react";

const MAX_VISIBLE = 3;
const COMMENT_LIFETIME_MS = 6000;
const EXIT_ANIM_MS = 400;

export interface VideoComment {
  readonly id: string;
  readonly authorDisplayName: string;
  readonly text: string;
}

interface Entry {
  readonly key: string;
  readonly comment: VideoComment;
  readonly arrivedAt: number;
  readonly state: "live" | "exiting";
}

export interface VideoCommentsOverlayProps {
  readonly comments: readonly VideoComment[];
}

export function VideoCommentsOverlay(
  props: VideoCommentsOverlayProps,
): React.JSX.Element | null {
  const [entries, setEntries] = React.useState<readonly Entry[]>([]);
  const lastConsumedIdRef = React.useRef<string | null>(null);

  // Admit new comments into the overlay (bounded by MAX_VISIBLE).
  React.useEffect(() => {
    if (props.comments.length === 0) {
      setEntries([]);
      lastConsumedIdRef.current = null;
      return;
    }
    const lastConsumed = lastConsumedIdRef.current;
    const startIdx =
      lastConsumed === null
        ? 0
        : (() => {
            const idx = props.comments.findIndex((c) => c.id === lastConsumed);
            return idx === -1 ? 0 : idx + 1;
          })();
    const fresh = props.comments.slice(startIdx);
    if (fresh.length === 0) return;
    const now = Date.now();
    setEntries((prev) => {
      const admitted: Entry[] = fresh.map((c, i) => ({
        key: c.id,
        comment: c,
        arrivedAt: now + i,
        state: "live",
      }));
      const admittedKeys = new Set(admitted.map((e) => e.key));
      const kept = prev.filter((e) => !admittedKeys.has(e.key));
      const combined = [...kept, ...admitted];
      const liveCount = combined.filter((e) => e.state === "live").length;
      if (liveCount > MAX_VISIBLE) {
        let toEvict = liveCount - MAX_VISIBLE;
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
    lastConsumedIdRef.current = fresh[fresh.length - 1]!.id;
  }, [props.comments]);

  // Lifetime timer · transitions live → exiting after 6s and drops
  // after an extra 400ms fade. One interval drives all entries.
  React.useEffect(() => {
    if (entries.length === 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      setEntries((prev) => {
        let changed = false;
        const next: Entry[] = [];
        for (const e of prev) {
          if (e.state === "live" && now - e.arrivedAt >= COMMENT_LIFETIME_MS) {
            next.push({ ...e, state: "exiting" });
            changed = true;
          } else if (
            e.state === "exiting" &&
            now - e.arrivedAt >= COMMENT_LIFETIME_MS + EXIT_ANIM_MS
          ) {
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
      data-nex-video-comments-overlay
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: "absolute",
        left: 12,
        // Sits above the footer action row.
        bottom: 150,
        right: 72,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        gap: 8,
        pointerEvents: "none",
        maxWidth: 420,
        zIndex: 2,
      }}
    >
      <style>{`
        @keyframes nexVideoCommentIn {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes nexVideoCommentOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-8px) scale(0.98); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-video-comment] {
            animation: none !important;
            transition: opacity 150ms linear !important;
          }
        }
      `}</style>
      {entries.map((e) => {
        const initial =
          e.comment.authorDisplayName
            .replace(/[^A-Za-z0-9]/g, "")[0]
            ?.toUpperCase() ?? "N";
        return (
          <div
            key={e.key}
            data-nex-video-comment
            data-nex-video-comment-state={e.state}
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
              border: "1px solid rgba(255,255,255,0.1)",
              animation:
                e.state === "exiting"
                  ? `nexVideoCommentOut ${EXIT_ANIM_MS}ms ease-in forwards`
                  : "nexVideoCommentIn 240ms ease-out",
              boxShadow: "0 6px 18px -8px rgba(0, 0, 0, 0.7)",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              // Owner directive 2026-10-24 · "page wont swipe with text
              // is running . each page live has its own live feed and
              // live and should not prevent swipe". The wrapper is
              // pointer-events:none but some browsers still treat the
              // children with their own backdrop + animation as hit
              // targets · explicit none on each bubble guarantees
              // every tap/drag that lands on a comment passes through
              // to the swipe surface underneath.
              pointerEvents: "none",
            }}
          >
            <span
              aria-hidden
              data-nex-video-comment-avatar-fallback
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
              {initial}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                data-nex-video-comment-author-label
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#F2F5F8",
                  marginRight: 6,
                }}
              >
                {e.comment.authorDisplayName}
              </span>
              <span
                data-nex-video-comment-text
                style={{
                  fontSize: 13,
                  color: "#F2F5F8",
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
          </div>
        );
      })}
    </div>
  );
}
