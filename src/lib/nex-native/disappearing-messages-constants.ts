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
  | 7776000
  | number;

/** Owner-locked preset set exposed in the UI. Migration 282's CHECK
 *  constraint is `default_disappearing_messages_seconds >= -1`, so the
 *  list below can be extended without a schema change.
 *
 *  Owner directive 2026-11-12 · 90-day preset (7776000 seconds) added
 *  per the Chat Settings Control Centre spec. Default-timer change in
 *  the UI MUST NOT silently rewrite existing per-chat timers · the
 *  server-side disappearing-messages-service only resolves the default
 *  for NEW sends where no per-chat override exists. */
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
  {
    value: 7776000,
    label: "90 days",
    description:
      "Expire 90 days after send. Does not touch existing per-chat timer overrides.",
  },
];

/** Sealed default · OFF (0) · applied when migration 282 is unapplied
 *  OR when a service-layer read error forces fail-safe. Changing this
 *  requires a sealed doctrine revision. */
export const DEFAULT_DISAPPEARING_SECONDS: DisappearingSeconds = 0;
