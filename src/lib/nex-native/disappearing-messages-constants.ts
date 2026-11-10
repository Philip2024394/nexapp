// src/lib/nex-native/disappearing-messages-constants.ts
//
// Non-server constants for disappearing-messages. The service module
// (disappearing-messages-service.ts) is "server-only" · importing
// anything from it into a client component pulls the whole server
// surface which fails the Next.js build. This module holds the
// client-safe pieces: the preset list + the shared type + the sealed
// OFF default.

/** Seconds value · 0 = off, -1 = immediately after view, >0 = seconds after send. */
export type DisappearingSeconds =
  | 0
  | -1
  | 300
  | 1800
  | 3600
  | 86400
  | 604800
  | number;

/** Owner-locked preset set exposed in the UI. Keep in sync with the
 *  CHECK-allowed sentinels in migration 282. */
export const DISAPPEARING_PRESETS: ReadonlyArray<{
  readonly value: DisappearingSeconds;
  readonly label: string;
  readonly description: string;
}> = [
  { value: 0, label: "Off", description: "Messages never expire." },
  {
    value: -1,
    label: "Immediately after view",
    description:
      "Expire shortly after the recipient reads them (30s grace to render once).",
  },
  { value: 300, label: "5 minutes", description: "Expire 5 minutes after send." },
  { value: 1800, label: "30 minutes", description: "Expire 30 minutes after send." },
  { value: 3600, label: "1 hour", description: "Expire 1 hour after send." },
  { value: 86400, label: "24 hours", description: "Expire 24 hours after send." },
  {
    value: 604800,
    label: "7 days",
    description: "Expire 7 days after send.",
  },
];

/** Sealed default · OFF (0) · applied when migration 282 is unapplied
 *  OR when a service-layer read error forces fail-safe. Changing this
 *  requires a sealed doctrine revision. */
export const DEFAULT_DISAPPEARING_SECONDS: DisappearingSeconds = 0;
