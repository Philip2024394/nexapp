// src/lib/nex-native/live-broadcast/stale-session-policy.ts
//
// Phase 2 · G2 · stale-session recovery FOUNDATION.
// -----------------------------------------------------------------------------
// Owner-authorised 2026-10-24 per the Final Local Completion Pass.
//
// What this module IS
//   · Pure, deterministic helpers that decide whether a persisted
//     `nex_live_session` row is CURRENTLY LIVE for display purposes.
//     The DB `status` column stays `'open'` until a real end-of-
//     session write arrives; this module answers the different
//     question: "is this broadcaster meaningfully live RIGHT NOW?"
//
// What this module is NOT
//   · NOT a scheduled worker. No cron, no edge function, no DB job
//     flips sessions to `'ended'`. Doing so is out of scope · the
//     saved doctrine (§5.4) names cleanup as a Phase 2 Slice 2 scope.
//   · NOT a hard-timeout. The policy intentionally errs toward
//     keeping a session live when there is any plausible chance it
//     still is · see the two-condition rule below.
//
// Policy
//   isSessionCurrentlyLive(session, now) is TRUE iff ALL of:
//     1 · session.status === 'open'
//     2 · one of:
//         a · last_heartbeat_at is null AND
//             started_at > now - STARTUP_GRACE_MS
//             (a just-started session has not pinged yet · we grant
//              a grace window so the first-tick latency doesn't blink
//              the chip off)
//         b · last_heartbeat_at > now - STALENESS_WINDOW_MS
//             (ongoing session · a recent heartbeat means the client
//              is still live)
//
// Timings
//   · HEARTBEAT_INTERVAL_MS   = 15_000  (client pings every 15 s)
//   · STALENESS_WINDOW_MS     = 90_000  (ignore sessions quiet for 90 s)
//   · STARTUP_GRACE_MS        = 30_000  (first-heartbeat tolerance)
//
// Why these numbers
//   · Pings every 15 s · the staleness window is 6× that so a single
//     dropped ping (bad network blip) does not evict a real broadcast.
//   · The startup grace catches the gap between `startLiveSessionAction`
//     persisting and the first heartbeat landing. 30 s is enough even
//     on cold-start mobile networks · if the first ping has not arrived
//     by then, something is wrong and keeping the chip up is dishonest.

export const HEARTBEAT_INTERVAL_MS = 15_000;
export const STALENESS_WINDOW_MS = 90_000;
export const STARTUP_GRACE_MS = 30_000;

export interface StaleSessionPolicyInput {
  readonly status: "open" | "ended";
  readonly started_at: string;
  readonly last_heartbeat_at: string | null;
}

/** Discriminated-union verdict · Plan v4 · AC-2 + AC-3 + AC-10.
 *
 *  When a session is NOT currently live, callers get `{ isLive: false }`
 *  with no further fields · prevents accidental reads of a stale TTL.
 *
 *  When live, callers get `{ isLive: true, liveExpiresInMs }` where
 *  `liveExpiresInMs` is the server-computed time-to-expiry in
 *  milliseconds AS OF `nowMs` (the SAME `nowMs` used for the liveness
 *  decision · AC-2). This TTL is RELATIVE · it has NO absolute wall-
 *  clock anchor.
 *
 *  TIMING ORIGIN · important honest limitation:
 *    `liveExpiresInMs` is measured against the server's `nowMs` at
 *    resolver time. By the time a client reads this value (after
 *    serialisation, network transit, HTML parse, hydration), that
 *    many milliseconds have already elapsed. A client that treats
 *    `liveExpiresInMs` as remaining time "from this moment" WILL
 *    display the LIVE indicator for approximately that transit
 *    duration past the real server-side expiry. Plan v4 AC-5
 *    specifies anchoring the client countdown to the browser's
 *    navigation-timing `responseEnd` to compress this drift to the
 *    network-first-byte lag only (~35–170 ms typical, up to 1–2 s on
 *    degraded connections). THAT WORK IS STEP 3 · it is NOT included
 *    in Step 2. Until Step 3 lands, this field is a server-side
 *    contract with no client consumer. */
export type LivenessVerdict =
  | { readonly isLive: false }
  | { readonly isLive: true; readonly liveExpiresInMs: number };

/** Pure helper · returns the discriminated-union verdict for a session
 *  row. See the comment on `LivenessVerdict` for the timing contract.
 *
 *  Branches:
 *    1 · status !== 'open' → not live
 *    2 · heartbeat known · live iff within STALENESS_WINDOW_MS,
 *                          TTL = STALENESS_WINDOW_MS - (nowMs - heartbeatMs)
 *    3 · heartbeat null  · live iff within STARTUP_GRACE_MS from started_at,
 *                          TTL = STARTUP_GRACE_MS - (nowMs - startedMs)
 *    4 · AC-10 fail-safe · if the computed TTL would be strictly
 *                          negative (edge-case internal drift) the
 *                          verdict is `{ isLive: false }`. The boundary
 *                          at exactly 0 remains inclusive-live (matches
 *                          `isSessionCurrentlyLive`'s existing <=
 *                          semantics). */
export function evaluateLiveness(
  session: StaleSessionPolicyInput,
  nowMs: number = Date.now(),
): LivenessVerdict {
  if (session.status !== "open") return { isLive: false };

  if (session.last_heartbeat_at === null) {
    const startedMs = Date.parse(session.started_at);
    if (!Number.isFinite(startedMs)) return { isLive: false };
    const liveExpiresInMs = STARTUP_GRACE_MS - (nowMs - startedMs);
    if (liveExpiresInMs < 0) return { isLive: false };
    return { isLive: true, liveExpiresInMs };
  }

  const heartbeatMs = Date.parse(session.last_heartbeat_at);
  if (!Number.isFinite(heartbeatMs)) return { isLive: false };
  const liveExpiresInMs = STALENESS_WINDOW_MS - (nowMs - heartbeatMs);
  if (liveExpiresInMs < 0) return { isLive: false };
  return { isLive: true, liveExpiresInMs };
}

/** True when the session is treated as currently live by UI readers.
 *  Pure · deterministic · same input → same output on every call.
 *
 *  `nowMs` is a monotonic epoch value injected by the caller so a single
 *  request can thread one `nowMs` through every resolver (Plan v4 · AC-1).
 *  Default `Date.now()` preserves backward-compatibility for ad-hoc
 *  callers that have not yet been threaded.
 *
 *  Delegates to `evaluateLiveness` so the boolean and verdict paths
 *  can never diverge (same branch structure, same boundary semantics).
 */
export function isSessionCurrentlyLive(
  session: StaleSessionPolicyInput,
  nowMs: number = Date.now(),
): boolean {
  return evaluateLiveness(session, nowMs).isLive;
}

/** Convenience filter · returns the sessions that pass the policy. */
export function filterCurrentlyLiveSessions<
  T extends StaleSessionPolicyInput,
>(sessions: readonly T[], nowMs: number = Date.now()): T[] {
  return sessions.filter((s) => isSessionCurrentlyLive(s, nowMs));
}

/** Observational classifier · exposes the human-readable reason a
 *  session was filtered out. Used by diagnostics + the next-phase
 *  recovery design (not by the live UI render path). */
export type StaleReason =
  | "live"
  | "status-ended"
  | "startup-grace-expired"
  | "heartbeat-stale"
  | "malformed-timestamp";

export function classifySessionLiveness(
  session: StaleSessionPolicyInput,
  nowMs: number = Date.now(),
): StaleReason {
  if (session.status !== "open") return "status-ended";

  if (session.last_heartbeat_at === null) {
    const startedMs = Date.parse(session.started_at);
    if (!Number.isFinite(startedMs)) return "malformed-timestamp";
    return nowMs - startedMs <= STARTUP_GRACE_MS
      ? "live"
      : "startup-grace-expired";
  }

  const heartbeatMs = Date.parse(session.last_heartbeat_at);
  if (!Number.isFinite(heartbeatMs)) return "malformed-timestamp";
  return nowMs - heartbeatMs <= STALENESS_WINDOW_MS ? "live" : "heartbeat-stale";
}
