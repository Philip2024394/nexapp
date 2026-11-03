// src/app/nex-native/contacts/_card-variants/_shared.tsx
//
// Shared primitives for the 5 contact-card prototype variants.
// -----------------------------------------------------------------------
// AvatarWithRim · the sealed presence RIM pattern as a reusable primitive.
// Every card variant mounts this so the owner-sealed vocabulary from
// 2026-10-29 is preserved: presence shows on the AVATAR RIM, never as a
// dot / corner lamp / badge. Universal across all worlds · never themed.
//
// Keyframe · `nex-card-variants-heartbeat` is the same 1200ms scale +
// opacity curve used by the sealed `_contact-row.tsx`. Injected once per
// card instance via a <style> tag (deduplicated by the browser CSS
// engine · identical rule, zero cost).

import type * as React from "react";
import type { ContactRowDisplay } from "../_contacts-list";

/** Sealed presence vocabulary · universal across worlds · do NOT theme. */
export const PRESENCE_PALETTE = {
  online: "#16D66B",
  busy: "#FF7200",
  offline: "#A60000",
} as const;

export function resolveRimColor(
  presence: ContactRowDisplay["presence"],
): string | null {
  if (presence === "online") return PRESENCE_PALETTE.online;
  if (presence === "away") return PRESENCE_PALETTE.busy;
  if (presence === "offline") return PRESENCE_PALETTE.offline;
  return null; // honest neutral
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

interface AvatarProps {
  readonly row: ContactRowDisplay;
  readonly size: number;
  /** Accent used for the inner avatar border on verified / default · the
   *  rim colour switches to the sealed presence colour when presence is
   *  known. */
  readonly accentHex: string;
  /** Background colour behind initials when no image. Caller should pass
   *  a world-token-aware value so Ireland reads emerald, etc. */
  readonly fallbackBg?: string;
}

/** Round avatar with the sealed presence RIM + heartbeat animation.
 *  Honest absence: when presence is null, renders a neutral white rim
 *  with no animation. Never a dot. Never a corner lamp. */
export function AvatarWithRim({
  row,
  size,
  accentHex,
  fallbackBg,
}: AvatarProps): React.JSX.Element {
  const rim = resolveRimColor(row.presence ?? null);
  const hasHeartbeat = row.presence === "online" || row.presence === "away";
  const neutralRim = "rgba(255,255,255,0.55)";
  const initials =
    row.initials && row.initials.trim().length > 0
      ? row.initials.toUpperCase()
      : initialsFromName(row.displayName);

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
      aria-hidden
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: `2px solid ${rim ?? neutralRim}`,
          overflow: "hidden",
          background:
            fallbackBg ??
            `linear-gradient(135deg, ${accentHex}cc 0%, #180012 65%, #050F1E 100%)`,
          display: "grid",
          placeItems: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
        }}
      >
        {row.avatarUrl ? (
          <img
            src={row.avatarUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span
            style={{
              color: "#FFF",
              fontSize: Math.round(size * 0.34),
              fontWeight: 900,
              letterSpacing: "0.04em",
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            }}
          >
            {initials}
          </span>
        )}
      </div>
      {hasHeartbeat ? (
        <div
          style={{
            position: "absolute",
            inset: -3,
            borderRadius: "50%",
            border: `2px solid ${rim ?? neutralRim}`,
            animation:
              "nex-card-variants-heartbeat 1200ms cubic-bezier(0.4,0,0.2,1) infinite",
            pointerEvents: "none",
          }}
        />
      ) : null}
    </div>
  );
}

/** Inject the heartbeat keyframe · mount at the page level once (or
 *  per-card · duplicate rules are a no-op in the browser). */
export function HeartbeatKeyframeStyle(): React.JSX.Element {
  return (
    <style>{`
      @keyframes nex-card-variants-heartbeat {
        0%   { transform: scale(1);    opacity: 0.9; }
        75%  { transform: scale(1.35); opacity: 0;   }
        100% { transform: scale(1.35); opacity: 0;   }
      }
    `}</style>
  );
}

/** Small inline verified check pill · world-token-aware. */
export function VerifiedPill(): React.JSX.Element {
  return (
    <span
      aria-label="Verified"
      title="Verified NEX account"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: "var(--nex-world-secondary, #FFD700)",
        color: "var(--nex-world-drawer-bg, #050F1E)",
        fontSize: 9,
        fontWeight: 900,
        flexShrink: 0,
      }}
    >
      ✓
    </span>
  );
}

/** Red map-pin icon · reused by variants that show city. */
export function MapPinIcon({ size = 10 }: { readonly size?: number }): React.JSX.Element {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0, display: "block" }}
    >
      <path
        fill="#B30000"
        d="M12 2c-4.418 0-8 3.582-8 8 0 5.25 7 12 7.4 12.3a1 1 0 0 0 1.2 0C13 22 20 15.25 20 10c0-4.418-3.582-8-8-8zm0 10.75a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5z"
      />
    </svg>
  );
}

/** Extract the single-word skill (profession) from a composed
 *  professionLine like "Electrician · Residential rewires". Returns
 *  just the leading profession token · drops the trailing headline.
 *  Owner directive 2026-11-03 · "skill set should be 1 word" · dense
 *  cards show skill + location only, no headline. */
export function skillOnly(line: string | null | undefined): string | null {
  if (!line) return null;
  const [first] = line.split(/\s*·\s*/);
  const trimmed = (first ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Format the last-online label (identical semantics to sealed row). */
export function presenceLabel(row: ContactRowDisplay): string | null {
  if (row.presence === "online") return null;
  const mins = row.lastSeenMinsAgo;
  if (mins === null || mins === undefined) return null;
  if (row.presence === "away") {
    if (mins < 60) return `${mins}m ago`;
    return `${Math.round(mins / 60)}h ago`;
  }
  if (mins < 60) return `Offline · ${mins}m ago`;
  if (mins < 60 * 24) return `Offline · ${Math.round(mins / 60)}h ago`;
  return `Offline · ${Math.round(mins / (60 * 24))}d ago`;
}
