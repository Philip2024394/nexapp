"use client";

// src/components/nex-native/music/MusicLibraryOverlay.tsx
//
// Owner-authorised 2026-10-30 · Main Feed → Creator Music feature.
// Full-screen library overlay that opens over the music preview
// surface when the user taps a track image (either the main music
// player cover or the "Up Next" banner's cover thumbnail).
//
// Operates per the Main Feed Constitution + the Universal Image
// Display Integrity doctrine:
//   · Full-image display (object-fit: contain) on card cover art.
//   · Shaded backdrop so the overlay feels layered, not pasted on.
//   · Current track visually indicated.
//   · Mobile safe-area respected.
//   · Keyboard + screen-reader friendly (role=dialog, Escape to close).
//
// Scope limits (deliberately narrow — see implementation report):
//   · The library tracks list is passed in as a prop. The caller
//     constructs it from the owner's own tracks today (see page.tsx)
//     because non-owner public music playback (D1) remains an
//     unauthorised held phase. When D1 lands, the caller can switch
//     to a public reader without changing this component's contract.
//   · Each track card uses its own signed cover URL, also provided
//     by the caller. This component does NOT mint signed URLs.
//   · Selecting a card calls `onSelect(trackId)` and leaves the
//     actual navigation to the caller. Keeps this component
//     navigation-router agnostic.

import * as React from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#F0F6FF";
const INK_DIM = "rgba(240, 246, 255, 0.72)";
const CYAN = "#4FC3FF";

export interface MusicLibraryTrack {
  readonly id: string;
  readonly title: string;
  readonly artist: string | null;
  readonly coverUrl: string | null;
  readonly viewCount: number;
  readonly isCurrent: boolean;
}

/**
 * Sealed NEX presence doctrine (2026-10-29):
 * - online  → green rim #16D66B + 1200ms heartbeat pulse
 * - busy    → orange rim #FF7200 + 1200ms heartbeat pulse
 * - offline → dark red rim #A60000 (static, no pulse)
 * - null    → neutral white rim (honest default when unknown)
 * Never render presence as a bottom-right dot.
 */
export type MusicLibraryCreatorPresence =
  | "online"
  | "busy"
  | "offline"
  | null;

export interface MusicLibraryOverlayProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly creatorName: string;
  readonly creatorNexHandle: string | null;
  readonly creatorAvatarUrl: string | null;
  readonly creatorPresence?: MusicLibraryCreatorPresence;
  readonly tracks: readonly MusicLibraryTrack[];
  readonly onSelect: (trackId: string) => void;
  /**
   * Prototype 2026-10-30 · optional handlers for the floating footer's
   * share + message actions. If a handler is omitted the corresponding
   * round button still renders but the tap is a no-op (dev stub).
   */
  readonly onShare?: () => void;
  readonly onSendMessage?: (text: string) => void;
}

const PRESENCE_RIM_GREEN = "#16D66B";
const PRESENCE_RIM_ORANGE = "#FF7200";
const PRESENCE_RIM_RED = "#A60000";
const PRESENCE_RIM_NEUTRAL = "rgba(255, 255, 255, 0.5)";

function resolvePresenceRim(
  presence: MusicLibraryCreatorPresence | undefined,
): { color: string; pulse: boolean } {
  switch (presence) {
    case "online":
      return { color: PRESENCE_RIM_GREEN, pulse: true };
    case "busy":
      return { color: PRESENCE_RIM_ORANGE, pulse: true };
    case "offline":
      return { color: PRESENCE_RIM_RED, pulse: false };
    default:
      return { color: PRESENCE_RIM_NEUTRAL, pulse: false };
  }
}

export function MusicLibraryOverlay(
  props: MusicLibraryOverlayProps,
): React.JSX.Element | null {
  // Hoist all hooks ABOVE any early return (React enforces consistent
  // hook order across every render of the same component instance).
  const [mounted, setMounted] = React.useState(false);
  const [isComposerOpen, setIsComposerOpen] = React.useState(false);
  const [composerDraft, setComposerDraft] = React.useState("");
  React.useEffect(() => {
    setMounted(true);
  }, []);
  React.useEffect(() => {
    if (!props.isOpen) {
      setIsComposerOpen(false);
      setComposerDraft("");
    }
  }, [props.isOpen]);
  // Escape key closes the overlay. Owner-approved standard
  // close-affordance on top of the explicit X button.
  const onCloseRef = React.useRef(props.onClose);
  onCloseRef.current = props.onClose;
  React.useEffect(() => {
    if (!props.isOpen) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [props.isOpen]);

  if (!mounted) return null;
  if (!props.isOpen) return null;

  return (
    <div
      data-nex-music-library-overlay
      role="dialog"
      aria-modal="true"
      aria-label={`${props.creatorName}'s music library`}
      style={{
        position: "fixed",
        inset: 0,
        // Prototype 2026-10-30 · "more blur, less dark" — song page
        // colour mood stays visible beneath, library feels layered
        // premium rather than a slab of ink. Readability of the
        // cards is still safe because each tile carries its own
        // dark backing + border.
        background: "rgba(0, 0, 0, 0.35)",
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
        // Owner directive · "hide the Main Feed footer completely
        // while the library is active." On this surface the
        // preview-page chrome lives at z-index ≤ 30 and the overlay
        // z-index ≥ 50 is enough to visually cover everything.
        // Chose a value high enough to clip any accidental sibling
        // stacking contexts, but below the heart-rain portal
        // (2147483000) so the two cannot collide.
        zIndex: 100,
        color: INK,
        fontFamily: NEX_FONT_SANS,
        display: "flex",
        flexDirection: "column",
        padding:
          "calc(env(safe-area-inset-top, 0px) + 14px) calc(env(safe-area-inset-right, 0px) + 14px) calc(env(safe-area-inset-bottom, 0px) + 14px) calc(env(safe-area-inset-left, 0px) + 14px)",
        boxSizing: "border-box",
        // Owner directive 2026-10-30 · "lock header from scrolling."
        // The overlay root itself must never scroll; only the inner
        // grid scrolls. This prevents the OS virtual keyboard (when
        // the message composer opens) from shifting the whole surface.
        overflow: "hidden",
        animation: "nex-music-library-overlay-in 180ms ease-out",
      }}
    >
      {/* Header · creator identity + close */}
      <header
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          marginBottom: 14,
          minWidth: 0,
        }}
      >
        {/* Sealed presence rim · one visual vocabulary across every
            avatar surface. Rim colour reflects status, 1200ms heartbeat
            pulse plays while online or busy. Never a bottom-right dot. */}
        {(() => {
          const presence = resolvePresenceRim(props.creatorPresence);
          const rim = `2px solid ${presence.color}`;
          return (
            <span
              aria-label={
                props.creatorPresence
                  ? `${props.creatorName} · ${props.creatorPresence}`
                  : props.creatorName
              }
              style={{
                position: "relative",
                display: "inline-grid",
                placeItems: "center",
                width: 44,
                height: 44,
                borderRadius: "50%",
                flexShrink: 0,
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: rim,
                  boxShadow: presence.pulse
                    ? `0 0 0 1px ${presence.color}44`
                    : undefined,
                  animation: presence.pulse
                    ? `nex-music-library-rim-pulse 1200ms ease-out infinite`
                    : undefined,
                }}
              />
              {props.creatorAvatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={props.creatorAvatarUrl}
                  alt=""
                  aria-hidden
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "rgba(10, 27, 51, 0.65)",
                    color: INK,
                    fontSize: 15,
                    fontWeight: 800,
                  }}
                >
                  {props.creatorName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
          );
        })()}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            flex: 1,
            gap: 1,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: INK,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              lineHeight: 1.2,
            }}
          >
            {props.creatorName}
          </span>
          <span
            style={{
              fontSize: 11,
              color: INK_DIM,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {props.creatorNexHandle ? `${props.creatorNexHandle} · ` : ""}
            {props.tracks.length} track{props.tracks.length === 1 ? "" : "s"}
          </span>
        </div>
        {/* Close affordance moved to the floating footer prototype. */}
      </header>

      {/* Track grid · scrolls inside remaining viewport. Bottom pad
          leaves room for the floating footer (prototype 2026-10-30).
          `scrollbar-gutter: stable` + `min-width: 0` keeps the right-
          hand column safely off the screen edge when the scrollbar
          appears on desktop; `boxSizing: border-box` keeps the grid
          itself from exceeding its allotted width. */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarGutter: "stable",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: 12,
          paddingBottom: 120,
          boxSizing: "border-box",
        }}
      >
        {props.tracks.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              color: INK_DIM,
              fontSize: 13,
              padding: "48px 0",
            }}
          >
            No tracks yet.
          </div>
        ) : (
          props.tracks.map((t, idx) => (
            <LibraryCard
              key={t.id}
              track={t}
              /* First 4 tiles get eager-high priority (visible on open);
                 the rest are lazy + async so they stream in without
                 blocking the overlay's first paint. */
              priority={idx < 4 ? "high" : "low"}
              onClick={() => props.onSelect(t.id)}
            />
          ))
        )}
      </div>

      {/* Prototype 2026-10-30 · Floating footer bar with 3 round
          buttons (close · share · message). Mirrors the NEX-live
          composer vocabulary — tapping Message docks a pill-style
          composer directly above the footer. Nothing is sent in the
          prototype unless the caller wires `onSendMessage`. */}
      <LibraryFloatingFooter
        isComposerOpen={isComposerOpen}
        composerDraft={composerDraft}
        onComposerDraftChange={setComposerDraft}
        onToggleComposer={() => setIsComposerOpen((v) => !v)}
        onClose={props.onClose}
        onShare={() => {
          if (props.onShare) props.onShare();
        }}
        onSend={() => {
          const text = composerDraft.trim();
          if (text.length === 0) return;
          if (props.onSendMessage) props.onSendMessage(text);
          setComposerDraft("");
          setIsComposerOpen(false);
        }}
        creatorName={props.creatorName}
      />

      {/* Keyframes · soft fade + rise. Scoped via name only — safe
          because the overlay unmounts when closed so there's no
          lingering `nex-music-library-overlay-in` effect to collide. */}
      <style>{`
        @keyframes nex-music-library-overlay-in {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes nex-music-library-footer-rise {
          0%   { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes nex-music-library-vinyl-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes nex-music-library-rim-pulse {
          0%   { transform: scale(1);    opacity: 0.9; }
          100% { transform: scale(1.35); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}

/**
 * Prototype 2026-10-30 · Floating footer bar for the music library
 * overlay. Three round buttons: close · share · message. Tapping
 * Message docks a NEX-chat-style composer pill directly above the
 * footer. Pure presentation — the caller decides what Share and
 * Send actually do.
 */
function LibraryFloatingFooter(props: {
  readonly isComposerOpen: boolean;
  readonly composerDraft: string;
  readonly onComposerDraftChange: (next: string) => void;
  readonly onToggleComposer: () => void;
  readonly onClose: () => void;
  readonly onShare: () => void;
  readonly onSend: () => void;
  readonly creatorName: string;
}): React.JSX.Element {
  const canSend = props.composerDraft.trim().length > 0;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding:
          "0 14px calc(env(safe-area-inset-bottom, 0px) + 14px) 14px",
        pointerEvents: "none",
      }}
    >
      {props.isComposerOpen && (
        <div
          style={{
            pointerEvents: "auto",
            width: "100%",
            maxWidth: 520,
            minHeight: 44,
            padding: "6px 6px 6px 14px",
            background: "rgba(2, 9, 20, 0.72)",
            border: "1px solid rgba(79, 195, 255, 0.45)",
            boxShadow: "0 0 0 1px rgba(79, 195, 255, 0.18), 0 10px 28px rgba(0,0,0,0.55)",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
            animation: "nex-music-library-footer-rise 160ms ease-out",
          }}
        >
          <input
            type="text"
            value={props.composerDraft}
            onChange={(e) => props.onComposerDraftChange(e.target.value)}
            placeholder={`Message ${props.creatorName}…`}
            aria-label={`Message ${props.creatorName}`}
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              outline: "none",
              color: INK,
              fontSize: 16,
              fontFamily: "inherit",
            }}
          />
          <button
            type="button"
            onClick={props.onSend}
            disabled={!canSend}
            aria-label="Send message"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "none",
              background: canSend ? CYAN : "rgba(79, 195, 255, 0.25)",
              color: canSend ? "#0A1B33" : "rgba(240, 246, 255, 0.4)",
              cursor: canSend ? "pointer" : "default",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={16}
              height={16}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      )}
      <div
        style={{
          pointerEvents: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px",
          background: "rgba(2, 9, 20, 0.65)",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          borderRadius: 999,
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
          boxShadow: "0 8px 22px rgba(0,0,0,0.45)",
        }}
      >
        <FooterRoundButton
          label="Close library"
          onClick={props.onClose}
          variant="neutral"
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </FooterRoundButton>
        <FooterRoundButton
          label="Share this library"
          onClick={props.onShare}
          variant="neutral"
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </FooterRoundButton>
        <FooterRoundButton
          label={props.isComposerOpen ? "Hide message composer" : `Message ${props.creatorName}`}
          onClick={props.onToggleComposer}
          variant={props.isComposerOpen ? "active" : "neutral"}
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </FooterRoundButton>
      </div>
    </div>
  );
}

function FooterRoundButton(props: {
  readonly label: string;
  readonly onClick: () => void;
  readonly variant: "neutral" | "active";
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const isActive = props.variant === "active";
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={props.label}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: isActive
          ? `1.5px solid ${CYAN}`
          : "1px solid rgba(255, 255, 255, 0.22)",
        background: isActive ? "rgba(79, 195, 255, 0.18)" : "rgba(10, 27, 51, 0.6)",
        color: INK,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        boxShadow: isActive
          ? "0 0 10px rgba(79, 195, 255, 0.45)"
          : "0 2px 6px rgba(0,0,0,0.4)",
      }}
    >
      {props.children}
    </button>
  );
}

function LibraryCard(props: {
  readonly track: MusicLibraryTrack;
  readonly onClick: () => void;
  readonly priority: "high" | "low";
}): React.JSX.Element {
  const t = props.track;
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={`Play ${t.title}${t.artist ? " by " + t.artist : ""}`}
      aria-current={t.isCurrent ? "true" : undefined}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 6,
        padding: 0,
        minWidth: 0,
        maxWidth: "100%",
        background: "transparent",
        border: "none",
        color: "inherit",
        fontFamily: "inherit",
        textAlign: "left",
        cursor: "pointer",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 10,
          overflow: "hidden",
          background: "var(--nex-world-background-base, #020914)",
          border: t.isCurrent
            ? `2px solid ${CYAN}`
            : "1px solid rgba(255, 255, 255, 0.14)",
          boxShadow: t.isCurrent
            ? `0 0 14px rgba(79, 195, 255, 0.55)`
            : "0 2px 8px rgba(0, 0, 0, 0.45)",
          // Border previously added 2–4px past width:100% (content-box
          // default) and pushed the right-hand column off-screen. Lock
          // the frame to border-box so the border is included in the
          // 100% width.
          boxSizing: "border-box",
        }}
      >
        {t.coverUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={t.coverUrl}
            alt=""
            aria-hidden
            loading={props.priority === "high" ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={props.priority}
            style={{
              width: "100%",
              height: "100%",
              // Universal Image Display Integrity doctrine 2026-10-30 ·
              // clause 1 "preserve the entire image." Cover cards use
              // `contain` and letterbox against the tile's dark
              // background rather than silently cropping.
              objectFit: "contain",
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "rgba(240, 246, 255, 0.5)",
              fontSize: 24,
            }}
          >
            ♪
          </div>
        )}
        {t.isCurrent && (
          <>
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 18,
                left: "42%",
                padding: "2px 7px",
                borderRadius: 999,
                background: CYAN,
                color: "#0A1B33",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                lineHeight: 1,
                zIndex: 3,
              }}
            >
              Playing
            </span>
            {/* Owner-authorised 2026-10-30 · Spinning vinyl record
                anchored INSIDE the Now-Playing card at the top-left
                corner. 6-second linear rotation, soft drop-shadow,
                `pointer-events: none` so the card remains tappable. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dev/music/vinyl-neon-blue.png"
              alt=""
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "38%",
                height: "38%",
                animation: "nex-music-library-vinyl-spin 6s linear infinite",
                pointerEvents: "none",
                // "Angel" glow · cyan halo built from stacked
                // drop-shadows (grows outward from the spinning disc),
                // plus a dark grounding shadow so the record still
                // reads against pale covers.
                filter:
                  "drop-shadow(0 0 6px rgba(79,195,255,0.9)) drop-shadow(0 0 14px rgba(79,195,255,0.55)) drop-shadow(0 0 26px rgba(79,195,255,0.35)) drop-shadow(0 3px 8px rgba(0,0,0,0.55))",
                zIndex: 2,
              }}
            />
          </>
        )}
        {/* Owner-authorised 2026-10-30 · plays-count pill on each
            track card so the viewer sees reach at a glance. Pattern
            mirrors the Up-Next banner's plays pill (sealed earlier)
            — speaker icon + short-form count. Dark translucent chip
            sits bottom-left so it reads over any cover art. */}
        <span
          aria-label={`${t.viewCount} plays`}
          style={{
            position: "absolute",
            left: 6,
            bottom: 6,
            padding: "2px 7px",
            borderRadius: 999,
            background: "rgba(0, 0, 0, 0.72)",
            border: "1px solid rgba(255, 255, 255, 0.22)",
            color: "#FFFFFF",
            fontSize: 10,
            fontWeight: 800,
            lineHeight: 1.2,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            textShadow: "0 1px 2px rgba(0, 0, 0, 0.75)",
          }}
        >
          <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
          {formatShortCount(t.viewCount)}
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: INK,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.3,
        }}
      >
        {t.title}
      </div>
      {t.artist && (
        <div
          style={{
            fontSize: 10,
            color: INK_DIM,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.3,
          }}
        >
          {t.artist}
        </div>
      )}
    </button>
  );
}

// Owner-authorised 2026-10-30 · short-form plays count. Mirrors the
// shape used elsewhere in the music surface (Up-Next banner).
function formatShortCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
