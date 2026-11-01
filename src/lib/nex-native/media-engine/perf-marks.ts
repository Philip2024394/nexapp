// src/lib/nex-native/media-engine/perf-marks.ts
//
// NEX Media Engine · performance instrumentation primitive · owner-
// authorised 2026-11-01 (P0-1 of the shared Media Engine).
// --------------------------------------------------------------------
// SHARED measurement surface for Worldwide / Ireland / Indonesia /
// future country feeds · music + video viewers. Country selection
// changes the DATA that flows through this instrumentation, never
// forks the instrumentation itself.
//
// Owner constraints honoured (owner directive 2026-11-01):
//   · Privacy-safe · NEVER record account IDs, media URLs, signed
//     tokens, track titles, or any content identifier. Correlation
//     IDs are per-swipe random v4 UUIDs with no account linkage.
//   · Lightweight · when no PerfSink listener is attached (production
//     default) the mark path collapses to a single `performance.mark`
//     call. No React state churn, no window event dispatch, no HTTP.
//   · Does NOT change feed, playback, privacy, or country architecture ·
//     all marks are additive observers of existing event hooks.
//
// How this is consumed:
//   · Dev-mode overlay (`NexPerfOverlay`) subscribes via a window
//     ring buffer attached below · reads marks + computes spans.
//   · Playwright harness attaches BEFORE page load, listens to the
//     same ring buffer, and emits JSON for a report.
//   · Browser DevTools can also view marks via the Performance API
//     (`performance.getEntriesByType('mark').filter(m => m.name.
//      startsWith('nex-perf:'))`).
//
// Phase enum is EXHAUSTIVE per owner directive · do not add phases
// without an update here + a corresponding viewer wire-in.

// ─── Phase enum ─────────────────────────────────────────────────────

export type PerfPhase =
  // Swipe lifecycle · fires on both music + video viewers
  | "swipe-start" // pointer down (first contact)
  | "pointerup" // pointer released (gesture committed)
  | "nav-begin" // router.push() invoked
  | "nav-complete" // next slide's shell has mounted on the client
  | "slide-visible" // first paint of the new slide's hero area

  // Music-specific phases
  | "cover-loaded" // <img onLoad> fired for the cover
  | "cover-decoded" // await img.decode() resolved
  | "audio-play-requested" // play() invoked (user intent or autoplay)
  | "audio-canplay" // <audio onCanPlay> fired
  | "audio-first-audible" // currentTime > 0 AND !muted AND !paused

  // Video-specific phases
  | "poster-loaded" // poster image onLoad
  | "poster-decoded" // poster img.decode() resolved
  | "video-loadeddata" // <video onLoadedData> fired
  | "video-first-frame" // RVFC callback OR onPlaying as fallback
  | "video-playback-start" // <video onPlaying> fired
  | "video-buffer-stall-start" // <video onWaiting> fired mid-playback
  | "video-buffer-stall-end"; // <video onPlaying> fired after a waiting

// ─── Privacy-safe context fields ────────────────────────────────────

/** Minimal context attached to every mark · PRIVACY-SAFE by design:
 *  no account IDs, no URLs, no track IDs. `countryCode` is public
 *  (IE / ID / etc. OR undefined for worldwide). `feedKind` is which
 *  viewer type. `swipeCorrelationId` is a per-swipe UUID so marks
 *  from the same swipe gesture can be grouped post-hoc. */
export interface PerfMarkContext {
  readonly feedKind: "music" | "video";
  readonly feedMode: "worldwide" | "country";
  readonly countryCode?: string; // "IE" | "ID" | undefined
  readonly swipeCorrelationId: string;
}

// ─── Ring buffer attached to window for Playwright + DevTools ───────

interface PerfMarkEntry {
  readonly phase: PerfPhase;
  readonly timestamp: number; // performance.now() when the mark fired
  readonly context: PerfMarkContext;
}

// Ring buffer size · 500 marks is plenty for a typical dev session
// without pinning memory. The buffer is dropped when the page unloads.
const RING_SIZE = 500;

interface NexPerfGlobals {
  marks: PerfMarkEntry[];
  nextIdx: number;
  listeners: Set<(entry: PerfMarkEntry) => void>;
}

function getGlobals(): NexPerfGlobals {
  if (typeof window === "undefined") {
    // SSR path · no window · return a disposable scratch buffer. Marks
    // emitted on the server don't persist (there's no observer anyway).
    return { marks: [], nextIdx: 0, listeners: new Set() };
  }
  const w = window as unknown as { __NEX_PERF__?: NexPerfGlobals };
  if (!w.__NEX_PERF__) {
    w.__NEX_PERF__ = {
      marks: new Array<PerfMarkEntry>(RING_SIZE),
      nextIdx: 0,
      listeners: new Set(),
    };
  }
  return w.__NEX_PERF__;
}

// ─── Correlation ID generation ──────────────────────────────────────

function generateCorrelationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback · unlikely on modern browsers but harmless
  return `nex-perf-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

// ─── Public API · start swipe · creates a correlation ID ───────────

/** Call this when a swipe gesture starts · returns the correlation ID
 *  the caller MUST thread through subsequent marks. Automatically
 *  emits the "swipe-start" phase. */
export function startPerfSwipe(
  feedKind: PerfMarkContext["feedKind"],
  feedMode: PerfMarkContext["feedMode"],
  countryCode: string | undefined,
): string {
  // Clear any previous swipe's lingering context before starting fresh.
  clearSwipeContext();
  const swipeCorrelationId = generateCorrelationId();
  const context: PerfMarkContext = {
    feedKind,
    feedMode,
    countryCode,
    swipeCorrelationId,
  };
  markPerfPhase("swipe-start", context);
  // Persist for the next slide to read on mount.
  persistSwipeContext(context);
  return swipeCorrelationId;
}

// ─── Public API · mark a phase ──────────────────────────────────────

/** Emit a perf mark. In production this is lightweight (one
 *  `performance.mark()` call + ring-buffer push). In dev the overlay
 *  listens on the ring buffer for live display. */
export function markPerfPhase(
  phase: PerfPhase,
  context: PerfMarkContext,
): void {
  const timestamp =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  // 1 · emit a native Performance API mark · DevTools can read these.
  //    Name format: `nex-perf:<phase>:<correlationIdShort>`
  //    PRIVACY-SAFE: no track IDs, no URLs. The correlation ID is a
  //    random UUID per-swipe · it has no linkage to the account.
  if (typeof performance !== "undefined" && typeof performance.mark === "function") {
    try {
      const shortCorr = context.swipeCorrelationId.slice(0, 8);
      performance.mark(`nex-perf:${phase}:${shortCorr}`, {
        detail: {
          phase,
          feedKind: context.feedKind,
          feedMode: context.feedMode,
          countryCode: context.countryCode ?? null,
          swipeCorrelationId: context.swipeCorrelationId,
        },
        startTime: timestamp,
      });
    } catch {
      // performance.mark can throw if options are rejected · ignore.
    }
  }

  // 2 · push to ring buffer so overlay + Playwright can read.
  const g = getGlobals();
  const entry: PerfMarkEntry = { phase, timestamp, context };
  g.marks[g.nextIdx] = entry;
  g.nextIdx = (g.nextIdx + 1) % RING_SIZE;

  // 3 · notify listeners (dev overlay subscribes here).
  for (const l of g.listeners) {
    try {
      l(entry);
    } catch {
      // Listener errors must never break the hot path.
    }
  }
}

// ─── Public API · measure a span ────────────────────────────────────

/** Compute the elapsed ms from phase A to phase B for a given swipe
 *  correlation ID. Returns `null` if either phase hasn't been seen
 *  yet (common during an in-flight swipe). */
export function measurePerfSpan(
  fromPhase: PerfPhase,
  toPhase: PerfPhase,
  swipeCorrelationId: string,
): number | null {
  const g = getGlobals();
  let fromTs: number | null = null;
  let toTs: number | null = null;
  for (const entry of g.marks) {
    if (!entry || entry.context.swipeCorrelationId !== swipeCorrelationId) continue;
    if (entry.phase === fromPhase && fromTs === null) fromTs = entry.timestamp;
    if (entry.phase === toPhase && toTs === null) toTs = entry.timestamp;
  }
  if (fromTs === null || toTs === null) return null;
  return toTs - fromTs;
}

// ─── Public API · subscribe to live marks (dev overlay) ─────────────

/** Register a listener for every new mark. Returns an unsubscribe
 *  callback. Use ONLY in dev-mode components · production code paths
 *  should not subscribe (keeps the hot path listener-free in prod). */
export function subscribePerfMarks(
  listener: (entry: PerfMarkEntry) => void,
): () => void {
  const g = getGlobals();
  g.listeners.add(listener);
  return () => {
    g.listeners.delete(listener);
  };
}

// ─── Public API · snapshot last-N marks ─────────────────────────────

/** Return the last N marks in chronological order (most-recent last).
 *  Used by Playwright to export a snapshot after a test. Returns an
 *  empty array on the server. */
export function getPerfMarksSnapshot(): readonly PerfMarkEntry[] {
  const g = getGlobals();
  // Preserve chronological order by walking from nextIdx (oldest).
  const out: PerfMarkEntry[] = [];
  for (let i = 0; i < RING_SIZE; i++) {
    const idx = (g.nextIdx + i) % RING_SIZE;
    const e = g.marks[idx];
    if (e) out.push(e);
  }
  return out;
}

// ─── Public API · clear the buffer (test resets) ────────────────────

/** Zero the ring buffer. Playwright calls this between test cases
 *  so each measurement starts from a clean slate. */
export function clearPerfMarks(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __NEX_PERF__?: NexPerfGlobals };
  if (!w.__NEX_PERF__) return;
  w.__NEX_PERF__.marks = new Array<PerfMarkEntry>(RING_SIZE);
  w.__NEX_PERF__.nextIdx = 0;
}

// ─── Swipe-context persistence across router.push boundaries ────────
//
// Problem: a swipe starts on slide A (pointerdown) and ends on slide B
// (post-nav paint). Each slide is a separate React tree · the
// correlation ID must survive the client-side router.push transition
// so the swipe-start mark on A and the nav-complete / slide-visible
// marks on B share the same ID.
//
// Solution: sessionStorage. One key · lightweight · scoped to the tab.
// Cleared when the NEXT swipe starts (startPerfSwipe wipes it before
// generating a new correlation ID).

const ACTIVE_SWIPE_KEY = "nex-perf-active-swipe";

/** Persist a swipe context so the next-slide mount can read it. */
export function persistSwipeContext(context: PerfMarkContext): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ACTIVE_SWIPE_KEY, JSON.stringify(context));
  } catch {
    // Private-browsing modes block sessionStorage · silently no-op.
  }
}

/** Read the swipe context persisted by the previous slide (if any).
 *  Returns null when no swipe is in flight (fresh page load, or the
 *  context has been cleared by a new swipe). */
export function readSwipeContext(): PerfMarkContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_SWIPE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "swipeCorrelationId" in parsed &&
      typeof (parsed as PerfMarkContext).swipeCorrelationId === "string"
    ) {
      return parsed as PerfMarkContext;
    }
    return null;
  } catch {
    return null;
  }
}

/** Explicitly clear any persisted swipe context. Called by
 *  `startPerfSwipe` before a new swipe begins · also safe to call
 *  manually when the viewer leaves a swipe-eligible surface. */
export function clearSwipeContext(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ACTIVE_SWIPE_KEY);
  } catch {
    // no-op
  }
}

/** Build an "initial-load" context for the FIRST slide mount after a
 *  cold navigation (direct URL, refresh, external link). No swipe
 *  preceded this mount, so swipe-start / pointerup / nav-begin
 *  SHOULD NOT appear in the ring buffer for this correlation ID ·
 *  only the post-mount lifecycle marks (slide-visible, cover-loaded,
 *  cover-decoded, audio-canplay, video-first-frame, …) will fire.
 *  The amended P0-1 measurement harness relies on this so the first
 *  slide of a cold page load can be measured too, not just swipes. */
export function makeInitialLoadContext(
  feedKind: PerfMarkContext["feedKind"],
  feedMode: PerfMarkContext["feedMode"],
  countryCode: string | undefined,
): PerfMarkContext {
  return {
    feedKind,
    feedMode,
    countryCode,
    swipeCorrelationId: generateCorrelationId(),
  };
}
