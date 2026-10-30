// src/lib/nex-native/follow/follow-observability.ts
//
// Thin wrapper over the sealed NEX observability module per Stage 1
// preparation §12 O-7 + O-8. All Follow server actions and the
// repository emit through this module so operational counters +
// structured logs flow through the sealed `src/lib/nex/observability/`
// infrastructure.
//
// Owner-authorised 2026-10-30 · zero new infrastructure, reuses the
// sealed logger() factory and incr() counter primitives.
//
// Counter names (7 total) are added to the sealed CounterName union
// in `src/lib/nex/observability/counters.ts` in the same Stage 1
// commit.

import "server-only";
import { incr } from "@/lib/nex/observability/counters";
import { logger } from "@/lib/nex/observability/logger";
import type { NexFollowErrorCode } from "./types";

/** Sealed subsystem name per the sealed logger convention
 *  (dotted `<module>.<submodule>`). */
export const log = logger("nex-native.follow");

/** Translate an action outcome to the matching sealed counter name.
 *  Keeps counter names in one place so the sealed union in
 *  `counters.ts` is the single source of truth. */
export function emitActionCounter(
  outcome: "ok" | "rate-limited" | "blocked" | "self-follow" | "internal",
): void {
  switch (outcome) {
    case "ok":
      incr("follow.action_ok");
      return;
    case "rate-limited":
      incr("follow.action_rate_limited");
      return;
    case "blocked":
      incr("follow.action_blocked");
      return;
    case "self-follow":
      incr("follow.action_self_follow");
      return;
    case "internal":
      incr("follow.action_internal_error");
      return;
  }
}

/** Churn-signal flag emitted by the SOFT unfollow rate limit · the
 *  action still succeeds, but moderation observability sees the hit. */
export function emitChurnFlagged(): void {
  incr("follow.churn_flagged");
}

/** Counter-drift detected by the reconciliation RPC (manual-trigger
 *  in Stage 1 · scheduled in Stage 2+). */
export function emitCounterDrift(): void {
  incr("follow.counter_drift");
}

/** Translate a NexFollowErrorCode to the matching counter emission.
 *  Centralised so the action layer only has to pass through its
 *  error code without memorising the counter name mapping. */
export function emitErrorCounter(code: NexFollowErrorCode): void {
  switch (code) {
    case "rate-limited":
      emitActionCounter("rate-limited");
      return;
    case "blocked":
      emitActionCounter("blocked");
      return;
    case "self-follow":
      emitActionCounter("self-follow");
      return;
    case "internal":
      emitActionCounter("internal");
      return;
    case "churn-flagged":
      emitChurnFlagged();
      return;
    case "not-signed-in":
    case "invalid-input":
    case "not-found":
      // Not observability-interesting · caller is misusing or the
      // target is gone · no counter required.
      return;
  }
}
