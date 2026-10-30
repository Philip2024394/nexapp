"use client";

// src/components/nex-native/music/MusicLibraryCard.tsx
//
// Owner-authorised 2026-10-29 · the music-library card.
// Matches the Live library card family (BroadcasterLibrarySheet) ·
// cover thumbnail · title · artist · duration · three stat chips
// (views · likes · shares) · visibility badge.
//
// Gestures:
//   · Tap        → navigate to the preview page (view the track as
//                  it will appear on Live).
//   · Swipe left → navigate to the preview page in edit mode
//                  (`?edit=1`), so the author lands on the title /
//                  artist save panel.
//   · Hold 1.5s  → fingerprint-ring countdown · release after full
//                  rotation to confirm delete · release early to
//                  cancel. Haptic + visual countdown.
//
// The gesture handlers deliberately coexist via a single
// `pointerdown` → `pointermove` → `pointerup` state machine so a
// slow tap, a quick swipe, and a long press can be disambiguated in
// one pointer stream without stealing each other's touches.

import * as React from "react";
import { useRouter } from "next/navigation";
import type { NexMusicTrackRow } from "@/lib/nex-native/music/types";

const CYAN = "#4FC3FF";
const BLUE = "#1E6AA8";
const INK = "#0A1B33";
const INK_DIM = "#4A6080";
const RED = "#FF3355";
const AMBER = "#FFC24B";

const DELETE_HOLD_MS = 1500;
const SWIPE_THRESHOLD_PX = 56;
const TAP_MAX_MS = 240;
const TAP_MAX_MOVE_PX = 10;

type GestureState =
  | { kind: "idle" }
  | {
      kind: "pressing";
      startX: number;
      startY: number;
      startedAt: number;
      lastX: number;
      lastY: number;
      holdProgress: number; // 0..1
      swipeOffset: number;  // negative = leftward
    };

function formatDuration(ms: number | null): string {
  if (!ms || !Number.isFinite(ms)) return "—";
  const total = Math.round(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function MusicLibraryCard(props: {
  readonly track: NexMusicTrackRow;
  readonly coverPreviewUrl: string | null;
  readonly onDelete: (trackId: string) => Promise<void> | void;
}): React.JSX.Element {
  const router = useRouter();
  const [gesture, setGesture] = React.useState<GestureState>({ kind: "idle" });
  const [deleting, setDeleting] = React.useState(false);
  const [errText, setErrText] = React.useState<string | null>(null);
  // Owner-authorised 2026-10-29 (Stage 5C · M3) · explicit-confirm
  // modal for keyboard-triggered deletion. The hold gesture retains
  // its own release-based confirmation; the keyboard path uses a
  // visible OK/Cancel dialog so that assistive technology users
  // never trigger a destructive action from a single keypress.
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const rafRef = React.useRef<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Clean up any pending RAF on unmount.
  React.useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const t = props.track;
  const kindBadge =
    t.source_type === "uploaded_audio"
      ? "MP3"
      : t.source_type === "spotify_url"
      ? "SPOTIFY"
      : "YOUTUBE";

  const nav = React.useCallback(
    (edit: boolean) => {
      const base = `/nex-native/create/upload-music/preview/${t.id}`;
      router.push(edit ? `${base}?edit=1` : base);
    },
    [router, t.id],
  );

  const confirmDelete = React.useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    setErrText(null);
    try {
      await props.onDelete(t.id);
    } catch (e) {
      setErrText(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  }, [deleting, props, t.id]);

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (deleting) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const now = performance.now();
    setGesture({
      kind: "pressing",
      startX: e.clientX,
      startY: e.clientY,
      startedAt: now,
      lastX: e.clientX,
      lastY: e.clientY,
      holdProgress: 0,
      swipeOffset: 0,
    });

    const step = () => {
      setGesture((prev) => {
        if (prev.kind !== "pressing") return prev;
        const elapsed = performance.now() - prev.startedAt;
        const holdProgress = Math.min(1, elapsed / DELETE_HOLD_MS);
        return { ...prev, holdProgress };
      });
      // Keep stepping until pointerup OR we hit 1.0.
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    setGesture((prev) => {
      if (prev.kind !== "pressing") return prev;
      const dx = e.clientX - prev.startX;
      const dy = e.clientY - prev.startY;
      // If the user starts swiping horizontally beyond threshold,
      // cancel the hold-timer visually by locking holdProgress at 0.
      const horizontal = Math.abs(dx) > Math.abs(dy) + 4;
      const swipeOffset = horizontal ? Math.min(0, dx) : 0;
      return {
        ...prev,
        lastX: e.clientX,
        lastY: e.clientY,
        swipeOffset,
        // If we're clearly swiping, zero out the hold progress so
        // the ring doesn't fire delete during a swipe.
        holdProgress: horizontal ? 0 : prev.holdProgress,
      };
    });
  };

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const g = gesture;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (g.kind !== "pressing") return;
    const elapsed = performance.now() - g.startedAt;
    const movedX = e.clientX - g.startX;
    const movedY = e.clientY - g.startY;

    // 1) Delete gesture: completed hold.
    if (g.holdProgress >= 1 && elapsed >= DELETE_HOLD_MS) {
      setGesture({ kind: "idle" });
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          (navigator as unknown as { vibrate: (p: number[]) => void }).vibrate([
            24, 32, 24,
          ]);
        }
      } catch {
        /* ignore */
      }
      void confirmDelete();
      return;
    }

    // 2) Swipe-left gesture.
    if (movedX <= -SWIPE_THRESHOLD_PX && Math.abs(movedX) > Math.abs(movedY)) {
      setGesture({ kind: "idle" });
      nav(true);
      return;
    }

    // 3) Tap: short duration, little movement.
    if (
      elapsed <= TAP_MAX_MS &&
      Math.abs(movedX) <= TAP_MAX_MOVE_PX &&
      Math.abs(movedY) <= TAP_MAX_MOVE_PX
    ) {
      setGesture({ kind: "idle" });
      nav(false);
      return;
    }

    // Default: cancel.
    setGesture({ kind: "idle" });
  };

  const onPointerCancel: React.PointerEventHandler<HTMLDivElement> = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setGesture({ kind: "idle" });
  };

  // Progress ring geometry
  const holdProgress =
    gesture.kind === "pressing" ? gesture.holdProgress : deleting ? 1 : 0;
  const swipeOffset = gesture.kind === "pressing" ? gesture.swipeOffset : 0;
  const circumference = 2 * Math.PI * 20; // radius 20
  const dashoffset = circumference * (1 - holdProgress);

  return (
    <li style={{ listStyle: "none", position: "relative" }}>
      {/* Swipe-reveal hint behind the card · appears on left-swipe */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 14,
          background: "linear-gradient(90deg, transparent 0%, rgba(79,195,255,0.15) 60%, rgba(79,195,255,0.3) 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 20,
          opacity: Math.min(1, Math.abs(swipeOffset) / SWIPE_THRESHOLD_PX),
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: CYAN,
            letterSpacing: "0.1em",
          }}
        >
          ← EDIT
        </span>
      </div>

      <div
        ref={containerRef}
        role="button"
        tabIndex={0}
        aria-label={`${t.title} · tap to view · swipe left to edit · hold to delete`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") nav(false);
          if (e.key === "e" || e.key === "E") nav(true);
          // Owner-authorised 2026-10-29 (Stage 5C · M3) · keyboard-
          // accessible delete. Opens an explicit modal · the key
          // alone never deletes.
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            if (!deleting) setConfirmOpen(true);
          }
        }}
        style={{
          position: "relative",
          background: "#FFFFFF",
          padding: 12,
          borderRadius: 14,
          border: "1px solid rgba(90, 110, 140, 0.18)",
          boxShadow: "0 2px 8px -4px rgba(10, 27, 51, 0.15)",
          display: "flex",
          gap: 12,
          alignItems: "center",
          transform: `translateX(${swipeOffset}px)`,
          transition:
            gesture.kind === "pressing" && swipeOffset !== 0
              ? "none"
              : "transform 180ms ease-out",
          touchAction: "pan-y",
          userSelect: "none",
          WebkitUserSelect: "none",
          cursor: "pointer",
          opacity: deleting ? 0.5 : 1,
        }}
      >
        {/* Thumbnail · cover art or kind-badge fallback */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            overflow: "hidden",
            flexShrink: 0,
            background: `linear-gradient(135deg, ${CYAN} 0%, ${BLUE} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFFFFF",
            fontWeight: 900,
            fontSize: 10,
            letterSpacing: "0.08em",
          }}
        >
          {props.coverPreviewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={props.coverPreviewUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span>{kindBadge}</span>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 15,
              color: INK,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {t.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: INK_DIM,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginBottom: 6,
            }}
          >
            {t.artist ?? "Unknown artist"}
            {t.duration_ms ? ` · ${formatDuration(t.duration_ms)}` : ""}
          </div>
          {/* Stat chips row */}
          <div
            style={{
              display: "flex",
              gap: 10,
              fontSize: 11,
              color: INK_DIM,
              fontWeight: 700,
            }}
          >
            <StatChip
              icon={
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M1 10c2.5-4 5.5-6 9-6s6.5 2 9 6c-2.5 4-5.5 6-9 6s-6.5-2-9-6z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              }
              value={formatCount(t.view_count)}
              label="previews"
            />
            <StatChip
              icon={
                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 17s-6-3.5-6-8a3.5 3.5 0 0 1 6-2.5A3.5 3.5 0 0 1 16 9c0 4.5-6 8-6 8z" />
                </svg>
              }
              value={formatCount(t.like_count)}
              label="likes"
              accent={t.like_count > 0 ? RED : undefined}
            />
            <StatChip
              icon={
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M4 10v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-6M10 2v10M10 2L7 5M10 2l3 3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              value={formatCount(t.share_count)}
              label="shares"
            />
            {t.visibility === "shared_live" && (
              <span
                style={{
                  marginLeft: "auto",
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(79, 195, 255, 0.14)",
                  color: CYAN,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                }}
              >
                LIVE-READY
              </span>
            )}
          </div>
          {errText && (
            <div style={{ color: RED, fontSize: 11, marginTop: 4 }}>{errText}</div>
          )}
        </div>

        {/* Delete-countdown ring · fades in while holding */}
        {holdProgress > 0.02 && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              width: 48,
              height: 48,
              pointerEvents: "none",
            }}
          >
            <svg
              viewBox="0 0 48 48"
              width={48}
              height={48}
              style={{ transform: "rotate(-90deg)" }}
            >
              <circle
                cx={24}
                cy={24}
                r={20}
                fill="rgba(255,51,85,0.08)"
                stroke="rgba(255,51,85,0.25)"
                strokeWidth={2}
              />
              <circle
                cx={24}
                cy={24}
                r={20}
                fill="none"
                stroke={holdProgress >= 1 ? RED : AMBER}
                strokeWidth={3}
                strokeDasharray={circumference}
                strokeDashoffset={dashoffset}
                strokeLinecap="round"
              />
            </svg>
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 900,
                color: holdProgress >= 1 ? RED : AMBER,
              }}
            >
              {holdProgress >= 1 ? "✕" : Math.ceil((1 - holdProgress) * 1.5) || 1}
            </span>
          </div>
        )}
      </div>

      {/* Owner-authorised 2026-10-29 (Stage 5C · M3 · M4) · explicit-
          confirm delete dialog for keyboard-triggered deletion.
          Opens only via the Delete/Backspace key handler on the card.
          The hold gesture retains its own release-based confirmation.
          Deletion fires through the parent's `onDelete` which, per
          Stage 5C, is wired to the sealed §9.2 SOFT-delete path
          (visibility='removed' · removed_at=now()) · not hard-delete.
          Hard-delete + 30-day sweep remains a separate authorisation
          gate per doctrine. */}
      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`music-delete-title-${t.id}`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setConfirmOpen(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 27, 51, 0.6)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            fontFamily: "inherit",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 14,
              padding: 20,
              maxWidth: 360,
              width: "100%",
              boxShadow: "0 20px 50px -14px rgba(0,10,30,0.5)",
            }}
          >
            <h3
              id={`music-delete-title-${t.id}`}
              style={{
                margin: "0 0 8px 0",
                fontSize: 16,
                fontWeight: 800,
                color: INK,
              }}
            >
              Delete “{t.title}”?
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: 13, color: INK_DIM, lineHeight: 1.5 }}>
              This moves the track to the removed state and hides it
              from your library. It is not immediately purged from
              storage.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(10,27,51,0.14)",
                  background: "#F6F8FB",
                  color: INK,
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  void confirmDelete();
                }}
                disabled={deleting}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: `1px solid ${RED}`,
                  background: RED,
                  color: "#FFFFFF",
                  fontSize: 13,
                  fontWeight: 800,
                  fontFamily: "inherit",
                  cursor: deleting ? "not-allowed" : "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function StatChip(props: {
  readonly icon: React.ReactNode;
  readonly value: string;
  readonly label: string;
  readonly accent?: string;
}): React.JSX.Element {
  return (
    <span
      title={props.label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color: props.accent ?? "#4A6080",
      }}
    >
      {props.icon}
      <span>{props.value}</span>
    </span>
  );
}
