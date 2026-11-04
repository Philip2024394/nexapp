"use client";

// src/components/nex-native/chat-chrome/universal-attach-panel.tsx
//
// NEX Universal Attach Panel · the SINGLE shared "+" modal rendered by
// every NEX chat composer (free-chat · peer-chat · community-chat).
// Owner-authorised 2026-11-04 later-same-day · Global Chat UI Standard
// (Chat 9001).
// -----------------------------------------------------------------------------
// Design rule: one implementation. Surfaces call `<UniversalAttachPanel />`
// and pass handlers for the tiles their backend supports. Tiles with no
// handler fall through to a canonical Link href · guaranteeing every
// tile is always LIVE (never a dead/disabled button).
//
// Tile order (sealed · matches the free-chat 6-tile set 2026-11-04):
//   1. Call Centre   → /nex-native/call-centre          (fixed route)
//   2. Gallery       → onPickGallery   OR /nex-native/status/create
//   3. Contact       → onPickContact   OR /nex-native/contacts
//   4. Document      → onPickDocument  OR /nex-native/vault
//   5. Voice         → onPickVoice     OR /nex-native/status/create
//   6. Location      → onPickLocation  OR /nex-native/community/discover
//
// Ireland palette: --nex-world-* CSS vars with sensible fallbacks. On
// non-Ireland deployments the panel renders with the fallback hex values
// but the structure stays identical.
//
// Accessibility: role="dialog" · aria-modal · Esc closes · backdrop tap
// closes · focus returned to invoker is the caller's responsibility
// (pass an onClose that restores focus if needed).

import * as React from "react";
import Link from "next/link";

const IRELAND = {
  text: "#F2F5F8",
  textMute: "rgba(175, 197, 181, 0.72)",
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  primary: "var(--nex-world-primary, #1B5138)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  panelBorder: "rgba(198, 161, 91, 0.3)",
  heatRim: "var(--nex-kp-accent, #FF7200)",
  heatRimSoft: "rgba(255, 114, 0, 0.42)",
};

export interface UniversalAttachPanelProps {
  /** Controlled open state. Panel renders nothing when false. */
  readonly open: boolean;
  /** Fired when user requests close (backdrop tap, Esc, × button, tile tap). */
  readonly onClose: () => void;
  /** Gallery handler · when provided the Gallery tile fires it. When
   *  omitted the tile Link-navigates to /nex-native/status/create. */
  readonly onPickGallery?: () => void;
  /** Contact handler · typically opens the contact picker sheet. */
  readonly onPickContact?: () => void;
  /** Document handler · typically triggers a file input + upload action. */
  readonly onPickDocument?: () => void;
  /** Voice handler · typically starts MediaRecorder capture. */
  readonly onPickVoice?: () => void;
  /** Location handler · typically triggers navigator.geolocation. */
  readonly onPickLocation?: () => void;
  /** Title rendered at the top of the panel. Default "Add to chat". */
  readonly title?: string;
}

interface TileDef {
  readonly key: "call-centre" | "gallery" | "contact" | "document" | "voice" | "location";
  readonly label: string;
  readonly fallbackHref: string;
  readonly icon: React.ReactElement;
  readonly handler?: () => void;
}

export function UniversalAttachPanel({
  open,
  onClose,
  onPickGallery,
  onPickContact,
  onPickDocument,
  onPickVoice,
  onPickLocation,
  title = "Add to chat",
}: UniversalAttachPanelProps): React.JSX.Element | null {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Call Centre is always a Link (navigation only · never a handler).
  // The other 5 tiles accept an optional handler · fall back to Link.
  const tiles: ReadonlyArray<TileDef> = [
    {
      key: "call-centre",
      label: "Call Centre",
      fallbackHref: "/nex-native/call-centre",
      icon: <CallCentreIcon />,
    },
    {
      key: "gallery",
      label: "Gallery",
      fallbackHref: "/nex-native/status/create",
      icon: <GalleryIcon />,
      handler: onPickGallery,
    },
    {
      key: "contact",
      label: "Contact",
      fallbackHref: "/nex-native/contacts",
      icon: <ContactIcon />,
      handler: onPickContact,
    },
    {
      key: "document",
      label: "Document",
      fallbackHref: "/nex-native/vault",
      icon: <DocumentIcon />,
      handler: onPickDocument,
    },
    {
      key: "voice",
      label: "Voice",
      fallbackHref: "/nex-native/status/create",
      icon: <VoiceIcon />,
      handler: onPickVoice,
    },
    {
      key: "location",
      label: "Location",
      fallbackHref: "/nex-native/community/discover",
      icon: <LocationIcon />,
      handler: onPickLocation,
    },
  ];

  const handleTileTap = (tile: TileDef): void => {
    if (tile.handler) {
      tile.handler();
      onClose();
    }
    // When tile uses fallback Link, the Link itself closes the panel
    // on navigation. We also close on tap just in case the navigation
    // is cancelled (modifier keys etc.) — Link's default onClick runs
    // first so this is idempotent.
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-nex-universal-attach-panel
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2, 9, 20, 0.72)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 360,
          background: IRELAND.drawerBg,
          border: `1.5px solid ${IRELAND.panelBorder}`,
          borderRadius: 20,
          padding: "20px 18px 18px",
          boxShadow: "0 18px 40px rgba(0, 0, 0, 0.55)",
          color: IRELAND.text,
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 800,
              color: IRELAND.secondary,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close attach panel"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "transparent",
              border: `1px solid ${IRELAND.panelBorder}`,
              color: IRELAND.secondary,
              cursor: "pointer",
              fontSize: 17,
              lineHeight: 1,
              fontFamily: "inherit",
            }}
          >
            ×
          </button>
        </div>

        <div
          data-nex-attach-tile-grid
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}
        >
          {tiles.map((tile) => {
            const isLink = !tile.handler;
            const common = {
              "data-nex-attach-tile": tile.key,
              "aria-label": tile.label,
              style: {
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center" as const,
                justifyContent: "center" as const,
                gap: 6,
                padding: "12px 6px",
                minHeight: 92,
                borderRadius: 14,
                background: "rgba(27, 81, 56, 0.55)",
                border: `1px solid ${IRELAND.panelBorder}`,
                color: IRELAND.text,
                cursor: "pointer",
                fontFamily: "inherit",
                textDecoration: "none",
                textAlign: "center" as const,
                WebkitTapHighlightColor: "transparent",
                transition:
                  "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
                boxShadow:
                  "0 4px 10px -8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
              },
            };
            const content = (
              <>
                <span
                  aria-hidden
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    background: `radial-gradient(circle at 32% 28%, ${IRELAND.heatRim} 0%, color-mix(in srgb, ${IRELAND.heatRim} 68%, #1A0808) 100%)`,
                    color: "#FFFFFF",
                    boxShadow: `0 6px 14px -6px ${IRELAND.heatRimSoft}, inset 0 2px 4px rgba(255, 255, 255, 0.25)`,
                  }}
                >
                  {tile.icon}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: IRELAND.text,
                    letterSpacing: "0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  {tile.label}
                </span>
              </>
            );

            return isLink ? (
              <Link
                key={tile.key}
                href={tile.fallbackHref}
                onClick={onClose}
                {...common}
              >
                {content}
              </Link>
            ) : (
              <button
                key={tile.key}
                type="button"
                onClick={() => handleTileTap(tile)}
                {...common}
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        [data-nex-attach-tile]:hover {
          transform: translateY(-1px);
          border-color: ${IRELAND.secondary} !important;
          box-shadow: 0 10px 18px -10px rgba(0, 0, 0, 0.55),
                      0 0 0 1px ${IRELAND.panelBorder};
        }
        [data-nex-attach-tile]:active {
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-attach-tile] { transition: none !important; }
          [data-nex-attach-tile]:hover { transform: none; }
        }
      `}</style>
    </div>
  );
}

// ─── Inline SVG icons ─────────────────────────────────────────────

function CallCentreIcon(): React.ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4.5 3.5a2 2 0 0 1 2-2h2.4a1 1 0 0 1 .97.76l1.18 4.72a1 1 0 0 1-.5 1.13l-1.9 1.03a13 13 0 0 0 5.72 5.72l1.03-1.9a1 1 0 0 1 1.13-.5l4.72 1.18a1 1 0 0 1 .76.97V18a2 2 0 0 1-2 2A17.5 17.5 0 0 1 4.5 3.5z" />
    </svg>
  );
}
function GalleryIcon(): React.ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
function ContactIcon(): React.ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function DocumentIcon(): React.ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}
function VoiceIcon(): React.ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}
function LocationIcon(): React.ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
