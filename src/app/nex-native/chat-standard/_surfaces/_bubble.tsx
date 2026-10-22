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
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

/** Owner directive 2026-10-19 · brand red used for the reaction
 *  counter when the same emoji has 2+ pickers. Matches the
 *  cross-platform convention for "notification badge" visibility. */
const NEX_REACTION_COUNT_RED = "#FF3B30";

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
   *  row rendered under the bubble. Empty / omitted hides the row.
   *  Owner directive 2026-10-19 · key format accepts both raw Unicode
   *  glyphs ("👍", "❤️") AND sealed theme-emoji slugs (":burger:",
   *  ":glossy-cool:") so image reactions can be added via the main
   *  emoji+sticker panel the react trigger opens. */
  reactions?: Record<string, number>;
  /** Owner directive 2026-10-19 · tap handler for the top-right
   *  smiley icon · the parent (StandardExperience) opens its main
   *  emoji+sticker picker in reaction mode and routes the next pick
   *  back as a new reaction on this bubble. */
  onReactTrigger?: () => void;
  /** Owner directive 2026-10-19 · lookups so the chip row can
   *  resolve ":slug:" reaction keys to their image URL. Falls
   *  through to text rendering when no match (keeps the pure-
   *  Unicode case working). */
  themeEmojis?: readonly { slug: string; imageUrl: string; label: string }[];
  themeStickers?: readonly {
    slug: string;
    imageUrl: string;
    label: string;
    aspectRatio: number;
  }[];
  /** Owner directive 2026-10-19 · fired after the user long-presses
   *  a reaction chip AND confirms "yes" on the "Delete Emoji"
   *  prompt. Parent (StandardExperience) removes the key from the
   *  message's reaction map so the chip disappears. Omit the prop
   *  to disable the long-press-to-delete affordance. */
  onRemoveReaction?: (key: string) => void;
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
  onReactTrigger,
  themeEmojis,
  themeStickers,
  onRemoveReaction,
}: StandardBubbleProps): React.JSX.Element {
  const t = engine.bubbleTreatment({ mine, isReacting: reacting });
  const [showTrail, setShowTrail] = React.useState(false);
  const accent = engine.colours.primary;

  /* Owner directive 2026-10-19 · long-press a reaction chip opens a
     "Delete Emoji" yes/no prompt · yes removes the reaction via
     onRemoveReaction(key). State lives on the bubble because only
     one chip can be in confirm-mode at a time per message · we track
     the key currently in the confirm state. Press-hold timer uses
     the standard 500ms long-press threshold. */
  const [deleteConfirmKey, setDeleteConfirmKey] = React.useState<
    string | null
  >(null);
  const longPressTimerRef = React.useRef<number | null>(null);
  const clearLongPressTimer = React.useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);
  const startLongPress = React.useCallback(
    (key: string) => {
      if (!onRemoveReaction) return;
      clearLongPressTimer();
      longPressTimerRef.current = window.setTimeout(() => {
        setDeleteConfirmKey(key);
        longPressTimerRef.current = null;
      }, 500);
    },
    [onRemoveReaction, clearLongPressTimer],
  );
  React.useEffect(() => clearLongPressTimer, [clearLongPressTimer]);
  /* Owner directive 2026-10-19 · the Delete Emoji confirm panel
     stays OPEN until the user explicitly chooses Yes or No · the
     previous click-outside auto-dismiss is retired so an accidental
     tap elsewhere doesn't collapse the prompt mid-decision. */
  /* Owner directive 2026-10-19 · delivery-tick colour reads from the
     package's optional `deliveryTickColor` first, falling back to
     the primary accent so themes without an override stay sealed-
     equivalent. Crispy Chicken sets it to dark red (#8B1A1A). */
  const tickColor = engine.colours.deliveryTickColor ?? accent;

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
  /* Owner directive 2026-10-19 · reactionEntries now reads from the
     prop · parent (StandardExperience) owns the aggregated map so
     the react-trigger button can route picks from the main emoji+
     sticker panel back into this bubble's chip row. */
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
    /* Owner directive 2026-10-19 · "chat bubble font bold font
       always" · force 700 regardless of the engine's per-theme
       typography.fontWeight · pair with the sealed NEX_FONT_SANS
       stack so Windows browsers render bold convincingly (default
       serif fallback made 700 look thin · same issue the header
       primitive hit at session start). */
    fontFamily: NEX_FONT_SANS,
    fontWeight: 700,
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
        {/* Owner directive 2026-10-19 · reaction add icon at the
            top-right corner of the bubble · tap now opens the MAIN
            emoji+sticker panel owned by the parent StandardExperience
            (not a per-bubble small container). The parent routes the
            next pick back here as a new reaction via the `reactions`
            prop. Previous inline quick-strip was retired per
            owner feedback. */}
        {onReactTrigger && !mine && (
          /* Owner directive 2026-10-19 · react trigger shows ONLY on
             peer bubbles · dark-red solid circular button at the
             bubble's top-right corner · white smiley icon inside.
             Dark-red tint (`#8B1A1A`) matches the sealed
             deliveryTickColor used elsewhere in the Crispy Chicken
             theme so the button reads as part of the warm palette
             instead of a foreign black chip. */
          <button
            type="button"
            aria-label="Add reaction"
            data-nex-se-bubble-react-trigger
            onClick={(ev) => {
              ev.stopPropagation();
              onReactTrigger();
            }}
            style={{
              position: "absolute",
              top: -8,
              right: -8,
              zIndex: 3,
              width: 24,
              height: 24,
              padding: 0,
              borderRadius: 999,
              background: "#8B1A1A",
              border: "none",
              color: "#FFFFFF",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 2px 6px rgba(0,0,0,0.55)",
            }}
          >
            <SmileyGlyph />
          </button>
        )}
        {/* Owner directive 2026-10-19 · combined bottom row ·
            reactions on the LEFT (grow rightward · chip plays the
            3-second enlarge-then-settle pop on mount / count-change
            remount) · timestamp + delivery ticks pinned to the
            RIGHT via `marginLeft: auto`. Entire row hidden when
            there are no reactions AND no timestamp AND no delivery
            ticks (keeps empty bubbles compact). */}
        {(reactionEntries.length > 0 ||
          timeLabel ||
          (mine && delivery)) && (
          <>
            <style>{`
              @keyframes nex-se-reaction-pop {
                0%   { transform: scale(1); }
                8%   { transform: scale(2.4); }
                70%  { transform: scale(2.4); }
                100% { transform: scale(1); }
              }
            `}</style>
            <div
              data-nex-se-bubble-bottom-row
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 8,
                marginTop: 6,
              }}
            >
              <div
                data-nex-se-bubble-reactions-inline
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "flex-start",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 6,
                  minWidth: 0,
                  flex: "1 1 auto",
                }}
              >
                {reactionEntries.map(([key, count]) => {
                const slugMatch =
                  typeof key === "string" &&
                  /^:([a-z0-9][a-z0-9_-]*):$/i.exec(key);
                const slug = slugMatch ? slugMatch[1] : null;
                const imageEmoji = slug
                  ? themeEmojis?.find((e) => e.slug === slug)
                  : null;
                const imageSticker = slug
                  ? themeStickers?.find((s) => s.slug === slug)
                  : null;
                const image = imageEmoji ?? imageSticker;
                return (
                  <span
                    key={`${key}-${count}`}
                    data-nex-se-bubble-reaction={key}
                    data-nex-se-bubble-reaction-count={count}
                    onMouseDown={() => startLongPress(key)}
                    onMouseUp={clearLongPressTimer}
                    onMouseLeave={clearLongPressTimer}
                    onTouchStart={() => startLongPress(key)}
                    onTouchEnd={clearLongPressTimer}
                    onTouchCancel={clearLongPressTimer}
                    onContextMenu={(ev) => {
                      /* Right-click (desktop) ALSO opens the delete
                         prompt · long-press is mobile-friendly, right
                         click is the desktop equivalent · same intent. */
                      if (!onRemoveReaction) return;
                      ev.preventDefault();
                      setDeleteConfirmKey(key);
                    }}
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: 0,
                      background: "transparent",
                      border: "none",
                      /* Owner directive 2026-10-19 · bump reaction
                         chip size · Unicode glyph 22→30 · image
                         28→38 · count badge 12→14. Gives the chat
                         reactions a comfortable glance size on the
                         420px phone column without crowding the
                         timestamp above.
                         Owner directive 2026-10-21 (iteration 24) ·
                         reduce emoji-in-bubble sizes by 30% · unicode
                         30→21 · image 38→27 · count badge unchanged
                         (text, not emoji). */
                      fontSize: 21,
                      lineHeight: 1,
                      color: t.typography.color,
                      animation: "nex-se-reaction-pop 3000ms ease-out",
                      transformOrigin: "bottom left",
                      cursor: onRemoveReaction ? "pointer" : undefined,
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      WebkitTouchCallout: "none",
                    }}
                  >
                    {image ? (
                      <img
                        src={image.imageUrl}
                        alt={image.label || slug || key}
                        draggable={false}
                        style={{
                          width: 27,
                          height: 27,
                          objectFit: "contain",
                          display: "block",
                          pointerEvents: "none",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 21, lineHeight: 1 }}>
                        {key}
                      </span>
                    )}
                    {count > 1 && (
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: NEX_REACTION_COUNT_RED,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {count}
                      </span>
                    )}
                    {/* Owner directive 2026-10-19 · Delete Emoji
                        confirm · opens on long-press (500ms) or
                        right-click. Yes removes the key via
                        onRemoveReaction · No / outside-tap dismisses. */}
                    {deleteConfirmKey === key && onRemoveReaction && (
                      /* Owner directive 2026-10-19 · panel stays open
                         until Yes/No · BLACK FROSTED background with
                         strong blur · Yes button dark red (#8B1A1A)
                         · No button DARK green (#0A6B0A). */
                      <div
                        role="dialog"
                        aria-label="Delete Emoji"
                        onClick={(ev) => ev.stopPropagation()}
                        style={{
                          position: "absolute",
                          bottom: "calc(100% + 6px)",
                          left: 0,
                          zIndex: 5,
                          minWidth: 180,
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "rgba(0,0,0,0.65)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          boxShadow: "0 10px 28px rgba(0,0,0,0.65)",
                          backdropFilter: "blur(18px) saturate(1.4)",
                          WebkitBackdropFilter: "blur(18px) saturate(1.4)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          color: "#F2F5F8",
                          fontFamily: NEX_FONT_SANS,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            letterSpacing: "0.04em",
                            textAlign: "center",
                            whiteSpace: "nowrap",
                            color: "#FFFFFF",
                          }}
                        >
                          Delete Emoji
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            data-nex-se-bubble-delete-emoji-yes
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onRemoveReaction(key);
                              setDeleteConfirmKey(null);
                            }}
                            style={{
                              flex: 1,
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: "none",
                              background: "#8B1A1A",
                              color: "#FFFFFF",
                              fontSize: 11,
                              fontWeight: 800,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              cursor: "pointer",
                              fontFamily: NEX_FONT_SANS,
                              boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
                            }}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            data-nex-se-bubble-delete-emoji-no
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setDeleteConfirmKey(null);
                            }}
                            style={{
                              flex: 1,
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: "none",
                              background: "#0A6B0A",
                              color: "#FFFFFF",
                              fontSize: 11,
                              fontWeight: 800,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              cursor: "pointer",
                              fontFamily: NEX_FONT_SANS,
                              boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
                            }}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    )}
                  </span>
                );
              })}
              </div>
              {(timeLabel || (mine && delivery)) && (
                <div
                  data-nex-se-bubble-meta
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    marginLeft: "auto",
                    fontSize: 10,
                    opacity: 0.7,
                    color: t.typography.color,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    alignSelf: "flex-end",
                  }}
                >
                  {timeLabel && <span>{timeLabel}</span>}
                  {mine && delivery && (
                    <DeliveryTicks state={delivery} accent={tickColor} />
                  )}
                </div>
              )}
            </div>
          </>
        )}
        {showTrail && <StandardBubbleTrail engine={engine} />}
      </div>
      {/* Owner directive 2026-10-19 · reactions moved INSIDE the
          bubble (bottom-right chip row) + the add-reaction icon
          moved to the bubble's top-right corner. The previous
          below-bubble sibling row + end-of-row "+" button are
          retired · see the inline markup above. */}
    </div>
  );
}

/** Owner directive 2026-10-19 · smiley face icon for the react-trigger
 *  button at the top-right of each bubble · reads as "add a reaction"
 *  without the ambiguity of a plus (plus could mean add text / add
 *  user). Replaces the retired PlusGlyph. */
function SmileyGlyph(): React.JSX.Element {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="0.8" fill="currentColor" stroke="none" />
      <path d="M8.5 14.5 c1 1.4 2.2 2 3.5 2 s2.5 -0.6 3.5 -2" />
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
        /* Owner directive 2026-10-19 · in-bubble peer avatar now
           carries a visible rim · 2px solid theme accent (opaque,
           not 40%-alpha) + soft glow halo so the circle reads as
           presence/identity, matching the sealed ChatIdentityHeader
           avatar treatment at smaller scale. */
        flexShrink: 0,
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: `2px solid ${accent}`,
        boxShadow: `0 0 0 1px rgba(0,0,0,0.35), 0 0 6px ${accent}55`,
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
