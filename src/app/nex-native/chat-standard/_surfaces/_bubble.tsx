"use client";

// src/app/nex-native/chat-standard/_surfaces/_bubble.tsx
//
// Phase 2A.0 · Standard bubble surface.
//
// Reads EVERY visual decision from engine.bubbleTreatment. Never reads
// theme.id, wallpaper_config, or hex colours directly. Theme personality
// drives entrance / idle / reaction animations.
//
// Owner directive 2026-10-18 · "all themes chat bubble from other user
// must show their profile image in chat bubble same as joker chat
// bubble - all themes and time of message and if delivered tick marks
// - same as joker and emoji under each bubble chat same as joker".
// Feature additions (all preview-visual-only · no real reaction wiring):
//   · 24px peer avatar rendered to the LEFT of peer bubbles · falls
//     back to displayName initials when peerAvatarUrl is null (same
//     fallback the sealed ChatIdentityHeader uses).
//   · Timestamp line INSIDE the bubble bottom-right · HH:MM 24h ·
//     paired with delivery ticks on `mine` bubbles.
//   · Delivery ticks on `mine` bubbles · "sent" = single ✓ ·
//     "delivered" = ✓✓ grey · "read" = ✓✓ theme-accent.
//   · Emoji reactions row under the bubble · theme-tinted chip row ·
//     visual-only · taps are no-op in preview.

import * as React from "react";
import type { ResolvedEngine } from "../_engine/theme-engine";

export type StandardBubbleDelivery = "sent" | "delivered" | "read";

export interface StandardBubbleProps {
  engine: ResolvedEngine;
  mine: boolean;
  /** When true, triggers the per-reaction animation (ripple for Ocean,
   *  sprinkle-burst for Cakes, etc). */
  reacting?: boolean;
  children: React.ReactNode;
  /** Enable the per-personality idle animation (shimmer / wobble / etc).
   *  Off by default to keep the gallery calm; on in the live-feel preview. */
  idle?: boolean;
  /** Owner directive 2026-10-18 · peer avatar shown to the LEFT of
   *  peer (not-mine) bubbles · null falls back to initials from
   *  peerName. Ignored for `mine` bubbles (user's own messages
   *  don't need an avatar). */
  peerAvatarUrl?: string | null;
  /** Owner directive 2026-10-18 · peer display name · drives initials
   *  fallback when peerAvatarUrl is null. Ignored for `mine` bubbles. */
  peerName?: string;
  /** Owner directive 2026-10-18 · epoch ms of send-time · rendered as
   *  HH:MM 24h inside the bubble bottom-right. Omit to hide the row. */
  sentAtMs?: number;
  /** Owner directive 2026-10-18 · delivery state for `mine` bubbles ·
   *  "sent" shows ✓ · "delivered" shows ✓✓ grey · "read" shows ✓✓
   *  in the theme accent. Omit to hide ticks. */
  delivery?: StandardBubbleDelivery;
  /** Owner directive 2026-10-18 · emoji → count map for the reactions
   *  row rendered under the bubble. Empty / omitted hides the row. */
  reactions?: Record<string, number>;
}

export function StandardBubble({
  engine,
  mine,
  reacting,
  children,
  idle = true,
  peerAvatarUrl,
  peerName,
  sentAtMs,
  delivery,
  reactions,
}: StandardBubbleProps): React.JSX.Element {
  const t = engine.bubbleTreatment({ mine, isReacting: reacting });
  const [showTrail, setShowTrail] = React.useState(false);
  const accent = engine.colours.primary;

  React.useEffect(() => {
    if (mine && t.effects.bubbleTrailOnSend) {
      setShowTrail(true);
      const id = window.setTimeout(() => setShowTrail(false), 2600);
      return () => window.clearTimeout(id);
    }
  }, [mine, t.effects.bubbleTrailOnSend]);

  const animations: string[] = [];
  if (t.motion.entrance) animations.push(`${t.motion.entrance} 420ms ease-out both`);
  if (idle && t.motion.idle)
    animations.push(`${t.motion.idle} 6s ease-in-out infinite`);
  if (t.motion.reaction && reacting)
    animations.push(`${t.motion.reaction} 700ms ease-out`);

  const timeLabel = sentAtMs ? formatHM24(sentAtMs) : null;
  const reactionEntries = reactions
    ? Object.entries(reactions).filter(([, n]) => n > 0)
    : [];

  const bubble: React.CSSProperties = {
    position: "relative",
    padding: t.geometry.padding,
    borderRadius: t.geometry.borderRadius,
    background: t.material.background,
    backdropFilter: t.material.backdropFilter,
    WebkitBackdropFilter: t.material.backdropFilter,
    border: t.material.border,
    boxShadow: t.material.boxShadow,
    color: t.typography.color,
    textShadow: t.typography.textShadow,
    fontWeight: t.typography.fontWeight,
    fontSize: 14,
    animation: animations.join(", "),
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };

  return (
    <div
      data-nex-se-bubble={mine ? "mine" : "peer"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "88%",
        /* Owner directive 2026-10-18 · "chat theme chat must be able
           scrolling up or down". The messages container is a flex
           column · default flex-shrink:1 on children compresses
           bubbles so content fits = no overflow = no scroll. Pin
           bubble to its natural height so content overflows cleanly
           and the sealed overflow-y:auto on the parent enables scroll. */
        flexShrink: 0,
      }}
    >
      <div style={bubble}>
        {t.innerLightOverlay && (
          <span aria-hidden style={t.innerLightOverlay} />
        )}
        {/* Owner directive 2026-10-18 (refined) · peer avatar sits
            INSIDE the bubble at the top-left · sender name on the
            right of the avatar · timestamp pinned bottom-right on
            the same line as any delivery ticks. */}
        {!mine && (
          <div
            data-nex-se-bubble-header
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 2,
            }}
          >
            <PeerAvatar
              url={peerAvatarUrl ?? null}
              name={peerName ?? "?"}
              accent={accent}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: accent,
                letterSpacing: "0.02em",
              }}
            >
              {peerName ?? "Peer"}
            </span>
          </div>
        )}
        <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
        {(timeLabel || (mine && delivery)) && (
          <div
            data-nex-se-bubble-meta
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 4,
              marginTop: 2,
              fontSize: 10,
              opacity: 0.7,
              color: t.typography.color,
              whiteSpace: "nowrap",
            }}
          >
            {timeLabel && <span>{timeLabel}</span>}
            {mine && delivery && (
              <DeliveryTicks state={delivery} accent={accent} />
            )}
          </div>
        )}
        {showTrail && <StandardBubbleTrail engine={engine} />}
      </div>

      {reactionEntries.length > 0 && (
        <div
          data-nex-se-bubble-reactions
          style={{
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
            alignSelf: mine ? "flex-end" : "flex-start",
          }}
        >
          {reactionEntries.map(([emoji, count]) => (
            <span
              key={emoji}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                padding: "2px 7px",
                borderRadius: 999,
                background: `${accent}22`,
                border: `1px solid ${accent}55`,
                fontSize: 13,
                lineHeight: 1,
                color: t.typography.color,
              }}
            >
              <span style={{ fontSize: 13 }}>{emoji}</span>
              {count > 1 && (
                <span style={{ fontSize: 10, fontWeight: 700 }}>{count}</span>
              )}
            </span>
          ))}
          {/* Owner directive 2026-10-18 · "+" react button at the end
              of the row · preview no-op · lets the layout read as a
              functional reaction surface not just display chrome. */}
          <button
            type="button"
            aria-label="Add reaction"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              padding: 0,
              borderRadius: 999,
              background: `${accent}11`,
              border: `1px solid ${accent}44`,
              color: accent,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <PlusGlyph />
          </button>
        </div>
      )}
    </div>
  );
}

function PlusGlyph(): React.JSX.Element {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ─── Peer avatar · 24px · wallpaper-crop (shared with the identity
//     header's avatar fallback pattern) ─────

function PeerAvatar({
  url,
  name,
  accent,
}: {
  url: string | null;
  name: string;
  accent: string;
}): React.JSX.Element {
  const initials = React.useMemo(() => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0 || parts[0].length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);
  return (
    <span
      aria-hidden
      data-nex-se-bubble-avatar
      style={{
        flexShrink: 0,
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: `1px solid ${accent}66`,
        background: url
          ? `center/cover url(${url})`
          : `linear-gradient(135deg, ${accent}44, #05101f)`,
        display: "grid",
        placeItems: "center",
        fontSize: 8,
        fontWeight: 700,
        color: "#F2F5F8",
      }}
    >
      {!url && initials}
    </span>
  );
}

// ─── Delivery ticks · ✓ / ✓✓ / ✓✓-accent ─────

function DeliveryTicks({
  state,
  accent,
}: {
  state: StandardBubbleDelivery;
  accent: string;
}): React.JSX.Element {
  const colour = state === "read" ? accent : "currentColor";
  return (
    <svg
      width="14"
      height="10"
      viewBox="0 0 18 12"
      fill="none"
      stroke={colour}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="1 6 5 10 11 2" />
      {state !== "sent" && <polyline points="6 6 10 10 16 2" />}
    </svg>
  );
}

// ─── Date → HH:MM 24h ─────

function formatHM24(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function StandardBubbleTrail({
  engine,
}: {
  engine: ResolvedEngine;
}): React.JSX.Element {
  const highlight = engine.colours.highlight;
  const primary = engine.colours.primary;
  const trail = [
    { right: 4, size: 11, dur: 1900, delay: 0 },
    { right: 12, size: 7, dur: 2100, delay: 120 },
    { right: 20, size: 9, dur: 2000, delay: 260 },
    { right: 28, size: 6, dur: 2200, delay: 420 },
    { right: 38, size: 5, dur: 1800, delay: 580 },
    { right: 46, size: 4, dur: 2300, delay: 740 },
  ];
  return (
    <>
      {trail.map((b, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            right: b.right,
            bottom: -2,
            width: b.size,
            height: b.size,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), ${highlight} 55%, ${primary})`,
            boxShadow: `inset 0 1px 2px rgba(255,255,255,0.6), 0 0 ${b.size * 1.5}px ${highlight}`,
            opacity: 0,
            animation: `nex-se-bubble-trail ${b.dur}ms ease-out ${b.delay}ms`,
          }}
        />
      ))}
    </>
  );
}
