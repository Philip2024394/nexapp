// src/components/nex-native/chat-chrome/header-search.tsx
//
// NEX · Shared header search trigger + glass category overlay.
// Owner-authorised 2026-11-02 (revision 2 · no-container floating buttons).
// Relocated 2026-11-04 later-same-day · owner-authorised architectural
// cleanup · from /app/nex-native/free-chat/_header-search.tsx to this
// shared components path. Shared-component callers (FreeChatHeader,
// peer-chat future integration, Call Centre grid trigger, Contacts
// live-world trigger) no longer reach into an /app/ private module.
// -----------------------------------------------------------------------------
// Tapping the magnifying glass in the free-chat header opens a full-page
// glass-backdrop overlay. The overlay carries no inner panel · just the
// faded-glass backdrop + 6 floating round buttons centered on screen +
// a close × in the top-right corner.
//
// Visual language:
//   · backdrop · rgba(0,0,0,0.35) + blur(24px) saturate(140%) ·
//     byte-identical to the sealed MusicLibraryOverlay backdrop
//   · each button · 72px round · rim = sealed world-secondary CSS var
//     (Gold on Ireland · cyan fallback on Worldwide / Indonesia)
//   · live buttons pulse a 1200ms heartbeat ring · matches NEX presence
//     vocab (owner-sealed 2026-10-29)
//
// Grid · 2 rows × 3 columns = 6 buttons:
//   Row 1 · Live World · Live Ireland · Live Music
//   Row 2 · Live Food  · Live Stays   · Live Trades
//
// Destinations · all land in the single /nex-feed reel route · filter
// via query params (feed either honours the filter today or ignores it
// forward-compat for when the filter wiring lands):
//   Live World  → /nex-native/nex-feed
//   Live Ireland→ /nex-native/nex-feed?country=IE
//   Live Music  → /nex-native/nex-feed?kind=music
//   Live Food   → /nex-native/nex-feed?category=food
//   Live Stays  → /nex-native/nex-feed?category=stays
//   Live Trades → /nex-native/nex-feed?category=trades
//
// Country-aware: "Live World" explicitly drops any country filter · the
// user is choosing worldwide. "Live Ireland" sets country=IE regardless
// of the current app identity.

"use client";

import * as React from "react";
import Link from "next/link";

const BUTTON_COLOR = "var(--nex-world-secondary, #00AFFF)";
const BUTTON_FILL =
  "color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 18%, transparent)";
const BUTTON_RIM_FADED =
  "color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 40%, transparent)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTE = "#7D9BC0";

interface LiveTileDef {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly icon: React.ReactNode;
}

const LIVE_TILES: readonly LiveTileDef[] = [
  // Owner directive 2026-11-05 iter 21 · "Live World" + "Live Ireland"
  // collapsed to a SINGLE "NEX Live" tile. Ireland was a country-
  // curated subset of the same base pool · end users now see the
  // full worldwide pool from one entry. nex_country_placement table +
  // the Ireland feed reader are kept intact for the sealed future HQ
  // country-moderation surface (see sealed memory
  // project_nex_hq_countries_future_section_2026_11_01.md).
  {
    key: "live",
    label: "NEX Live",
    href: "/nex-native/nex-feed",
    icon: (
      <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    key: "live-music",
    label: "Live Music",
    href: "/nex-native/nex-feed?kind=music",
    icon: (
      <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    key: "live-food",
    label: "Live Food",
    href: "/nex-native/nex-feed?category=food",
    icon: (
      <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 3v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" />
        <path d="M6 13v8" />
        <path d="M18 3c-2 0-4 2-4 5s2 5 4 5v8" />
      </svg>
    ),
  },
  {
    key: "live-stays",
    label: "Live Stays",
    href: "/nex-native/nex-feed?category=stays",
    icon: (
      <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 14v6" />
        <path d="M21 14v6" />
        <path d="M3 14a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4" />
        <path d="M7 10V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" />
      </svg>
    ),
  },
  {
    key: "live-trades",
    label: "Live Trades",
    href: "/nex-native/nex-feed?category=trades",
    icon: (
      <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
];

export function HeaderSearch(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open NEX directory"
        aria-expanded={open}
        data-nex-free-chat-header-search
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          padding: 0,
          background: "transparent",
          border: "none",
          color: BUTTON_COLOR,
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <SearchIcon />
      </button>
      {open ? <SearchOverlay onClose={() => setOpen(false)} /> : null}
    </>
  );
}

// Owner directive 2026-11-03 · "the free chat page has button in
// header that opens page with buttons round · this page is the same
// page that should show when user selects the grid button in header
// of contacts page" · exported so the Contacts header can mount the
// identical overlay (same 6 tiles · same visuals · same routes) with
// its own Gold grid-icon trigger. The sealed free-chat HeaderSearch
// continues to work exactly as before.
export function SearchOverlay({
  onClose,
}: {
  readonly onClose: () => void;
}): React.JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="NEX live feeds"
      data-nex-free-chat-search-overlay
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
      }}
    >
      {/* Faded glass backdrop · byte-identical to the sealed Music
          Library overlay look (24px blur · 35% dark). Tapping the
          backdrop dismisses the overlay. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.35)",
          backdropFilter: "blur(24px) saturate(140%)",
          WebkitBackdropFilter: "blur(24px) saturate(140%)",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      />

      {/* Close × · top-right · universal exit, matches NEX overlay
          vocab (same corner as the music-library close). */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 16px)",
          right: 16,
          width: 40,
          height: 40,
          borderRadius: "50%",
          // Owner directive 2026-11-03 · solid NEX Orange close
          // button · unified across every modal / sheet.
          background: "#FF7200",
          border: "1px solid rgba(0, 0, 0, 0.35)",
          color: "#1a0a00",
          cursor: "pointer",
          fontSize: 22,
          fontWeight: 800,
          lineHeight: 1,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 10px rgba(255, 114, 0, 0.5)",
          zIndex: 1,
        }}
      >
        ×
      </button>

      {/* Centered buttons · no container · just floating on the glass.
          3 columns × 2 rows. Centered vertically + horizontally. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 20px 40px",
          gap: 28,
          color: INK,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: INK_MUTE,
            }}
          >
            Discover
          </p>
          <h2
            style={{
              margin: "6px 0 0",
              fontSize: 22,
              fontWeight: 700,
              color: INK,
              textShadow: "0 2px 10px rgba(0, 0, 0, 0.6)",
            }}
          >
            What&apos;s live right now?
          </h2>
        </div>

        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "grid",
            gridTemplateColumns: "repeat(3, auto)",
            gap: "28px 20px",
            justifyItems: "center",
          }}
        >
          {LIVE_TILES.map((t) => (
            <li key={t.key}>
              <Link
                href={t.href}
                onClick={onClose}
                aria-label={t.label}
                data-nex-free-chat-search-tile={t.key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  textDecoration: "none",
                  color: INK,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span
                  data-nex-live-pulse-ring
                  aria-hidden
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    background: BUTTON_FILL,
                    border: `2px solid ${BUTTON_COLOR}`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: BUTTON_COLOR,
                  }}
                >
                  {t.icon}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: 0.2,
                    color: INK,
                    textShadow: "0 1px 3px rgba(0, 0, 0, 0.7)",
                  }}
                >
                  {t.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: INK_DIM,
            textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
          }}
        >
          Tap outside or press Esc to close
        </p>
      </div>

      {/* Heartbeat pulse keyframes · matches the NEX presence vocab ·
          1200ms ease-in-out. Applied to every Live tile ring. Owner-
          sealed 2026-10-29 presence doctrine · ring breathing cadence.
          Keyframe is scoped to this overlay only. */}
      <style>{`
        @keyframes nex-live-tile-pulse {
          0%, 100% {
            box-shadow:
              0 0 0 0 var(--nex-world-secondary, #00AFFF),
              0 0 10px 2px color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 40%, transparent);
          }
          50% {
            box-shadow:
              0 0 0 6px transparent,
              0 0 24px 6px color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 70%, transparent);
          }
        }
        [data-nex-live-pulse-ring] {
          animation: nex-live-tile-pulse 1400ms ease-in-out infinite;
        }
        /* Reduced-motion opt-out · users with vestibular sensitivity
           see a static button instead of the pulse. */
        @media (prefers-reduced-motion: reduce) {
          [data-nex-live-pulse-ring] {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

function SearchIcon(): React.JSX.Element {
  // Owner directive 2026-11-03 · magnifying-glass retired · header
  // trigger now uses an open-directory icon (open book / list spine)
  // so the affordance reads as "browse NEX directories", not "search".
  // Opens the same Live-categories glass overlay.
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Open-book directory · two facing pages with a centre spine */}
      <path d="M2 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H2z" />
      <path d="M22 4h-7a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h7z" />
      <path d="M12 7v13" />
    </svg>
  );
}
