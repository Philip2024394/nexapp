// src/lib/nex-voice.ts
//
// 2026-11-21 · Recovered shim for `@/lib/nex-voice`.
//
// Background: `src/components/nexapp/NexVoiceOrb.tsx` and
// `src/components/nexapp/NexHudFrame.tsx` import `type NexVoiceState`
// from this path. The underlying module was lost during the NEX
// nexapp carve-out from the D:/trades monorepo (per CLAUDE.md "Fork
// hygiene"), leaving TS2307 "Cannot find module" errors on two files
// that are reachable from the live `src/app/nex-native/_shell.tsx`
// via NexHudFrame.
//
// The union below is NOT guessed — it is pinned by the keys of the
// `PALETTE` and `TIMING` `Record<NexVoiceState, …>` maps declared in
// NexVoiceOrb.tsx (lines 72–78 and 100–106). Any value not present in
// those maps would raise a runtime lookup error, so this is the
// complete runtime contract as of today's `NexVoiceOrb.tsx`.
//
// This file intentionally exposes only the type — no runtime surface,
// no provider wiring. If a full voice runtime is restored in a later
// pass, it should live alongside this type without replacing it.

export type NexVoiceState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";
