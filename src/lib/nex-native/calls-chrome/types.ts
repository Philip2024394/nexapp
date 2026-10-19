// src/lib/nex-native/calls-chrome/types.ts
//
// NEX Calls Chrome · shared type contract.
// Owner-authorised 2026-10-19.
// -----------------------------------------------------------------------------
// Companion to the sealed chat-chrome pattern (`chat-identity-header`
// + `chat-composer-pill`). This module is the MASTER chrome for NEX
// video + voice call surfaces · themes compose their call UI from
// these primitives and MUST NOT reimplement header / tile / control-
// bar / footer locally. Themes may skin colours / backgrounds / rim
// accent via props, never the structure.

/** Participant tile size · determines grid span + name-badge scale.
 *  "primary"  · one large tile at the top of the grid · the current
 *               featured speaker.
 *  "medium"   · side-by-side tiles below the primary.
 *  "small"    · self-view · typically bottom-right. */
export type CallsTileSize = "primary" | "medium" | "small";

/** The single-source-of-truth participant shape consumed by every
 *  tile and the participant counter. */
export interface CallsParticipant {
  /** Stable id · used for React keys and future mic-mute toggles. */
  readonly id: string;
  /** Display name shown in the tile's bottom-left badge. */
  readonly name: string;
  /** Optional avatar / live-video poster URL · null renders a honest
   *  monogram fallback (no fabricated face). */
  readonly imageUrl: string | null;
  /** True when THIS participant has their mic unmuted and is
   *  actively transmitting audio. Drives the 🎤 badge indicator. */
  readonly micOn: boolean;
  /** True when THIS participant's camera is streaming. False renders
   *  the honest no-video monogram instead of a frozen poster. */
  readonly videoOn: boolean;
  /** True for the viewer's own self-view tile · forces size "small"
   *  and the badge label to "You" regardless of `name`. */
  readonly isSelf: boolean;
}

/** Call connection quality label shown in the footer. Mirrors the
 *  WebRTC reporting states exposed by the sealed peer-call engine. */
export type CallsConnectionQuality =
  | "good"
  | "fair"
  | "poor"
  | "reconnecting";

/** Overall call status · used by the header timer + status pill. */
export type CallsSessionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "ended";

/** Props the sealed theme-callback contract passes to any custom
 *  skinning of a call surface. A theme that wants to override the
 *  rim accent (e.g. Pink Dream → pink rim, Joker → purple rim) sets
 *  `themeAccent` and leaves the rest of the chrome alone. */
export interface CallsThemeSkin {
  readonly themeAccent?: string;
  readonly themeAccentSoft?: string;
}
