"use client";

// src/app/nex-native/call-centre/_client.tsx
//
// Interactive tile grid for the Call Centre decision page. Each tile
// is a large tap target with inline SVG icon · Ireland palette ·
// gentle hover/press animations · reduced-motion respected.

import * as React from "react";
import Link from "next/link";

interface Tile {
  readonly key: "voice" | "video" | "camera";
  readonly label: string;
  readonly subtitle: string;
  readonly href: string;
  readonly icon: React.ReactElement;
  readonly accent: string;
}

function PhoneIcon(): React.ReactElement {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 3.5a2 2 0 0 1 2-2h2.4a1 1 0 0 1 .97.76l1.18 4.72a1 1 0 0 1-.5 1.13l-1.9 1.03a13 13 0 0 0 5.72 5.72l1.03-1.9a1 1 0 0 1 1.13-.5l4.72 1.18a1 1 0 0 1 .76.97V18a2 2 0 0 1-2 2A17.5 17.5 0 0 1 4.5 3.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function VideoIcon(): React.ReactElement {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="6" width="14" height="12" rx="2.5" fill="currentColor" />
      <path
        d="M16 10.5v3l4.3 2.4a1 1 0 0 0 1.5-.87V9a1 1 0 0 0-1.5-.87L16 10.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function CameraIcon(): React.ReactElement {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 3.5 7.7 5.5H4.5A2.5 2.5 0 0 0 2 8v10a2.5 2.5 0 0 0 2.5 2.5h15A2.5 2.5 0 0 0 22 18V8a2.5 2.5 0 0 0-2.5-2.5h-3.2L15 3.5H9z"
        fill="currentColor"
      />
      <circle cx="12" cy="13" r="4" fill="#EAE6DD" />
    </svg>
  );
}

// Owner directive 2026-11-04 later-same-day · NEX Ireland Call Centre ·
// Voice and Video routes point at the GUEST-ACCESSIBLE call surfaces
// (same destinations the sealed free-chat call-center drawer uses)
// so Ireland visitors don't bounce to /sign-in on tap. The signed-in
// multi-party WebRTC flow at /call/g/[sessionId] stays reachable from
// inside the chat-peer AddToCall modal · unchanged · the Call Centre
// is the pre-auth decision layer.
const TILES: ReadonlyArray<Tile> = [
  {
    key: "voice",
    label: "Voice call",
    subtitle: "Start a 1:1 or group voice call",
    href: "/nex-native/free-chat/call",
    icon: <PhoneIcon />,
    accent: "var(--nex-kp-accent, #FF7200)",
  },
  {
    key: "video",
    label: "Video call",
    subtitle: "Face-to-face · HD when connection allows",
    href: "/nex-native/call/preview",
    icon: <VideoIcon />,
    accent: "var(--nex-kp-accent, #FF7200)",
  },
  {
    key: "camera",
    label: "Camera",
    subtitle: "Take a photo or short video for your status",
    href: "/nex-native/status/create",
    icon: <CameraIcon />,
    accent: "var(--nex-kp-accent, #FF7200)",
  },
];

export function CallCentreClient(): React.JSX.Element {
  return (
    <>
      <style>{`
        [data-nex-call-centre-tile] {
          transition: transform 180ms ease, box-shadow 180ms ease,
                      border-color 180ms ease, background 180ms ease;
        }
        [data-nex-call-centre-tile]:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 114, 0, 0.6);
          background: #E8E4DB;
          box-shadow: 0 10px 28px rgba(255, 114, 0, 0.18),
                      0 2px 6px rgba(0, 0, 0, 0.12);
        }
        [data-nex-call-centre-tile]:active {
          transform: translateY(0);
          box-shadow: 0 4px 14px rgba(255, 114, 0, 0.22),
                      0 1px 3px rgba(0, 0, 0, 0.12);
        }
        [data-nex-call-centre-tile]:focus-visible {
          outline: 2px solid var(--nex-kp-accent, #FF7200);
          outline-offset: 3px;
        }
        [data-nex-call-centre-tile-icon] {
          transition: transform 180ms ease;
        }
        [data-nex-call-centre-tile]:hover [data-nex-call-centre-tile-icon] {
          transform: scale(1.08);
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-call-centre-tile],
          [data-nex-call-centre-tile-icon] {
            transition: none !important;
          }
          [data-nex-call-centre-tile]:hover {
            transform: none;
          }
        }
      `}</style>

      <div
        role="list"
        aria-label="Call Centre choices"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {TILES.map((tile) => (
          <Link
            key={tile.key}
            href={tile.href}
            role="listitem"
            aria-label={`${tile.label} · ${tile.subtitle}`}
            data-nex-call-centre-tile
            data-nex-call-centre-tile-key={tile.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "18px 20px",
              borderRadius: 18,
              // Owner directive 2026-11-21 (iter 2) · tiles are
              // light-gray containers on the cream page background ·
              // the orange accent lives in the icon pod + chevron, not
              // in the container fill. Supersedes the black-container
              // interpretation earlier same day.
              background: "#EAE6DD",
              border: "1.5px solid rgba(26, 26, 26, 0.08)",
              color: "#1A1A1A",
              textDecoration: "none",
              minHeight: 88,
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
            }}
          >
            <span
              data-nex-call-centre-tile-icon
              aria-hidden
              style={{
                display: "grid",
                placeItems: "center",
                width: 56,
                height: 56,
                borderRadius: "50%",
                flexShrink: 0,
                background:
                  "linear-gradient(140deg, var(--nex-kp-accent, #FF7200), color-mix(in srgb, var(--nex-kp-accent, #FF7200) 65%, #000))",
                color: "#FFFFFF",
                boxShadow:
                  "0 6px 16px color-mix(in srgb, var(--nex-kp-accent, #FF7200) 45%, transparent)",
              }}
            >
              {tile.icon}
            </span>
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                flex: 1,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  letterSpacing: "-0.01em",
                  color: "#1A1A1A",
                }}
              >
                {tile.label}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: "#4A4A4A",
                  lineHeight: 1.4,
                  opacity: 0.92,
                }}
              >
                {tile.subtitle}
              </span>
            </span>
            <span
              aria-hidden
              style={{
                color: "var(--nex-kp-accent, #FF7200)",
                fontSize: 22,
                fontWeight: 700,
                flexShrink: 0,
                opacity: 0.95,
              }}
            >
              →
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
