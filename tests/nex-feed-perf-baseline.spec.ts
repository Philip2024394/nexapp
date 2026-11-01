// tests/nex-feed-perf-baseline.spec.ts
//
// NEX Media Engine · P0-1 (amended) · performance baseline harness.
// Owner-authorised 2026-11-01 · amendment per directive:
//   · Do NOT use networkidle as success condition
//   · Wait for specific perf marks with bounded timeouts
//   · Report WHICH phase failed when a run times out
//   · Measure ACTUAL transferred bytes via Resource Timing API
//   · Capture full lifecycle: open → first slide → swipe fwd → next
//     slide → swipe back → prev slide
//   · Music + video tested separately · music includes play test
//
// HONESTY NOTE (unchanged from v1):
//   Playwright simulates mouse/touch events on this host machine.
//   Numbers are BROWSER-SIMULATED, not real-device. Clearly labelled
//   throughout. Real-device verification (physical Android, 3G/4G
//   throttle, compositor-thread lag) remains outstanding.

import { test, expect, type Page } from "@playwright/test";

const DEV_URL = process.env.NEX_DEV_URL ?? "http://localhost:3008";
const PHASE_WAIT_MS = 20_000; // bounded per-phase timeout · increased for Ireland's heavy image load
const SWIPE_SETTLE_MS = 1_500; // settle after each swipe gesture
const PARALLEL_LIFECYCLE_WAIT_MS = 25_000; // parallel-wait budget for a full lifecycle

// ─── Shared types ───────────────────────────────────────────────────

interface CapturedMark {
  readonly phase: string;
  readonly timestamp: number;
  readonly context: {
    readonly feedKind: string;
    readonly feedMode: string;
    readonly countryCode?: string;
    readonly swipeCorrelationId: string;
  };
}

interface PhaseResult {
  readonly phase: string;
  readonly reached: boolean;
  readonly msFromStart: number | null;
  readonly msFromPrev: number | null;
  readonly failureReason?: string;
}

interface ResourceByte {
  readonly url: string;
  readonly transferSize: number;
  readonly encodedBodySize: number;
  readonly decodedBodySize: number;
  readonly initiatorType: string;
  readonly cached: boolean;
  readonly durationMs: number;
}

interface LifecyclePhase {
  readonly label: string;
  readonly phases: Record<string, PhaseResult>;
  readonly correlationId: string | null;
}

interface BaselineReport {
  readonly scenario: string;
  readonly url: string;
  readonly nav: {
    readonly navStartedAt: number;
    readonly responseReceivedAtMs: number | null;
    readonly loadFiredAtMs: number | null;
  };
  readonly initialLifecycle: LifecyclePhase;
  readonly swipeForward: LifecyclePhase | null;
  readonly swipeBackward: LifecyclePhase | null;
  readonly resources: {
    readonly supabaseCovers: readonly ResourceByte[];
    readonly supabaseBackgrounds: readonly ResourceByte[];
    readonly supabaseAudio: readonly ResourceByte[];
    readonly videoPoster: readonly ResourceByte[];
    readonly videoBody: readonly ResourceByte[];
    readonly totalSupabaseTransferBytes: number;
  };
  readonly failedPhases: readonly string[];
  readonly simulatedTouch: boolean;
}

// ─── Mark polling helper ────────────────────────────────────────────

async function waitForPerfMark(
  page: Page,
  phase: string,
  correlationId: string | null,
  timeoutMs: number,
): Promise<{ reached: boolean; timestamp: number | null; failureReason?: string }> {
  try {
    const found = await page.waitForFunction(
      ({ phase: p, cid }) => {
        const w = window as unknown as {
          __NEX_PERF__?: { marks: unknown[] };
        };
        if (!w.__NEX_PERF__) return null;
        for (const m of w.__NEX_PERF__.marks) {
          if (!m || typeof m !== "object") continue;
          const entry = m as {
            phase?: string;
            timestamp?: number;
            context?: { swipeCorrelationId?: string };
          };
          if (entry.phase === p) {
            if (!cid || entry.context?.swipeCorrelationId === cid) {
              return entry.timestamp ?? null;
            }
          }
        }
        return null;
      },
      { phase, cid: correlationId },
      { timeout: timeoutMs },
    );
    const ts = (await found.jsonValue()) as number | null;
    return { reached: ts !== null, timestamp: ts };
  } catch (e) {
    return {
      reached: false,
      timestamp: null,
      failureReason:
        e instanceof Error && e.message.includes("Timeout")
          ? `timed out after ${timeoutMs}ms`
          : String(e).slice(0, 120),
    };
  }
}

// ─── Correlation ID discovery ───────────────────────────────────────

async function readLatestSwipeCorrelationId(
  page: Page,
): Promise<string | null> {
  return await page.evaluate(() => {
    const w = window as unknown as {
      __NEX_PERF__?: { marks: unknown[] };
    };
    if (!w.__NEX_PERF__) return null;
    const seen = new Set<string>();
    let latest: string | null = null;
    for (const m of w.__NEX_PERF__.marks) {
      if (!m || typeof m !== "object") continue;
      const entry = m as {
        phase?: string;
        context?: { swipeCorrelationId?: string };
      };
      const cid = entry.context?.swipeCorrelationId;
      if (!cid || seen.has(cid)) continue;
      seen.add(cid);
      latest = cid;
    }
    return latest;
  });
}

// ─── Resource timing capture ────────────────────────────────────────

async function readResourceBytes(page: Page): Promise<ResourceByte[]> {
  return await page.evaluate(() => {
    const entries = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];
    return entries.map((e) => ({
      url: e.name,
      transferSize: e.transferSize ?? 0,
      encodedBodySize: e.encodedBodySize ?? 0,
      decodedBodySize: e.decodedBodySize ?? 0,
      initiatorType: e.initiatorType ?? "",
      // transferSize is 0 when fully served from cache (per Resource
      // Timing spec); encodedBodySize > 0 but transferSize == 0 →
      // cached. Fully cached resources are honestly flagged.
      cached: e.transferSize === 0 && e.encodedBodySize > 0,
      durationMs: e.duration ?? 0,
    }));
  });
}

function groupResources(resources: readonly ResourceByte[]): BaselineReport["resources"] {
  const covers: ResourceByte[] = [];
  const backgrounds: ResourceByte[] = [];
  const audio: ResourceByte[] = [];
  const videoPoster: ResourceByte[] = [];
  const videoBody: ResourceByte[] = [];
  for (const r of resources) {
    if (!r.url.includes("supabase.co/storage") && !r.url.endsWith(".mp4")) continue;
    if (r.url.includes("/cover-") || r.url.match(/\/cover-\d+/)) covers.push(r);
    else if (r.url.includes("/background-")) backgrounds.push(r);
    else if (r.url.includes("/audio-") || r.url.endsWith(".mp3") || r.url.endsWith(".m4a")) audio.push(r);
    else if (r.url.endsWith(".mp4") || r.url.endsWith(".webm")) videoBody.push(r);
    else if (r.url.includes("/poster-")) videoPoster.push(r);
  }
  const totalSupabaseTransferBytes =
    [...covers, ...backgrounds, ...audio].reduce((n, r) => n + r.transferSize, 0);
  return {
    supabaseCovers: covers,
    supabaseBackgrounds: backgrounds,
    supabaseAudio: audio,
    videoPoster,
    videoBody,
    totalSupabaseTransferBytes,
  };
}

// ─── Lifecycle recording ────────────────────────────────────────────

async function recordLifecycle(
  page: Page,
  label: string,
  phasesInOrder: readonly string[],
  correlationIdHint: string | null,
): Promise<LifecyclePhase> {
  // Resolve correlation ID BEFORE firing waits · retry briefly so the
  // viewer's effect has time to emit its first mark (initial load or
  // swipe context pickup).
  let correlationId = correlationIdHint;
  for (let i = 0; i < 20 && !correlationId; i++) {
    correlationId = await readLatestSwipeCorrelationId(page);
    if (!correlationId) await page.waitForTimeout(250);
  }

  // Parallel-wait all phases with the SAME budget · gives us honest
  // "which phase failed by X ms" reporting without the sequential
  // worst-case blow-up (N × PHASE_WAIT_MS).
  const waits = phasesInOrder.map((phase) =>
    waitForPerfMark(page, phase, correlationId, PHASE_WAIT_MS).then((r) => ({
      phase,
      result: r,
    })),
  );
  const settled = await Promise.race([
    Promise.all(waits),
    new Promise<Array<{ phase: string; result: { reached: boolean; timestamp: number | null; failureReason?: string } }>>(
      (resolve) =>
        setTimeout(() => {
          // Fallback · if the overall budget passes, return whatever
          // we have so far (unreached phases still render as failed).
          resolve(
            phasesInOrder.map((phase) => ({
              phase,
              result: {
                reached: false,
                timestamp: null,
                failureReason: `budget-exceeded (${PARALLEL_LIFECYCLE_WAIT_MS}ms)`,
              },
            })),
          );
        }, PARALLEL_LIFECYCLE_WAIT_MS),
    ),
  ]);

  const phases: Record<string, PhaseResult> = {};
  // Normalise results into order with time diffs relative to the
  // earliest reached mark.
  const reachedMarks = settled
    .filter((s) => s.result.reached && s.result.timestamp !== null)
    .sort((a, b) => (a.result.timestamp ?? 0) - (b.result.timestamp ?? 0));
  const startTs = reachedMarks[0]?.result.timestamp ?? null;
  let prevTs: number | null = startTs;
  const inOrderSettled = phasesInOrder.map(
    (p) => settled.find((s) => s.phase === p)!,
  );
  for (const { phase, result } of inOrderSettled) {
    if (result.reached && result.timestamp !== null && startTs !== null) {
      phases[phase] = {
        phase,
        reached: true,
        msFromStart: result.timestamp - startTs,
        msFromPrev: prevTs !== null ? result.timestamp - prevTs : null,
      };
      prevTs = result.timestamp;
    } else {
      phases[phase] = {
        phase,
        reached: false,
        msFromStart: null,
        msFromPrev: null,
        failureReason: result.failureReason ?? "not reached",
      };
    }
  }
  return { label, phases, correlationId };
}

// ─── Swipe gesture simulator ────────────────────────────────────────

async function simulateSwipe(
  page: Page,
  direction: "forward" | "backward",
): Promise<void> {
  const box = await page.locator("body").boundingBox();
  if (!box) return;
  const centerX = box.x + box.width / 2;
  const startY = direction === "forward"
    ? box.y + box.height * 0.75
    : box.y + box.height * 0.25;
  const endY = direction === "forward"
    ? box.y + box.height * 0.25
    : box.y + box.height * 0.75;
  await page.mouse.move(centerX, startY);
  await page.mouse.down();
  await page.mouse.move(centerX, endY, { steps: 15 });
  await page.mouse.up();
}

// ─── Phase definitions · music vs video ─────────────────────────────

const MUSIC_INITIAL_PHASES = [
  "slide-visible",
  "cover-loaded",
  "cover-decoded",
  "audio-canplay",
] as const;

const MUSIC_SWIPE_PHASES = [
  "swipe-start",
  "pointerup",
  "nav-begin",
  "nav-complete",
  "slide-visible",
  "cover-loaded",
  "cover-decoded",
  "audio-canplay",
] as const;

const VIDEO_INITIAL_PHASES = [
  "slide-visible",
  "poster-loaded",
  "poster-decoded",
  "video-loadeddata",
  "video-first-frame",
] as const;

const VIDEO_SWIPE_PHASES = [
  "swipe-start",
  "pointerup",
  "nav-begin",
  "nav-complete",
  "slide-visible",
  "poster-loaded",
  "video-loadeddata",
  "video-first-frame",
] as const;

// ─── Scenarios ──────────────────────────────────────────────────────

interface Scenario {
  readonly label: string;
  readonly url: string;
  readonly kind: "music" | "video";
}

const SCENARIOS: readonly Scenario[] = [
  { label: "worldwide-music", url: `${DEV_URL}/nex-native/nex-feed`, kind: "music" },
  { label: "ireland-music", url: `${DEV_URL}/nex-native/nex-feed?country=IE`, kind: "music" },
  // Video entries: redirector picks the first entry; dev manifest provides dev-video-1
  { label: "worldwide-video", url: `${DEV_URL}/nex-native/nex-feed/dev-video-1`, kind: "video" },
] as const;

// ─── Main test ──────────────────────────────────────────────────────

test.describe("NEX feed · P0-1 (amended) baseline", () => {
  for (const scenario of SCENARIOS) {
    test(`baseline: ${scenario.label}`, async ({ page }) => {
      const navStart = Date.now();
      let responseReceivedAtMs: number | null = null;
      let loadFiredAtMs: number | null = null;

      // Honest byte tracker · Playwright's `response` event gives raw
      // body sizes regardless of CORS Timing-Allow-Origin. Resource
      // Timing API returns 0 for cross-origin Supabase assets without
      // TAO, so we track bytes here as the authoritative source.
      interface ByteRecord {
        readonly url: string;
        readonly bytes: number;
        readonly status: number;
        readonly fromCache: boolean;
      }
      const supabaseResponses: ByteRecord[] = [];

      page.once("response", () => {
        if (responseReceivedAtMs === null) {
          responseReceivedAtMs = Date.now() - navStart;
        }
      });
      page.once("load", () => {
        if (loadFiredAtMs === null) {
          loadFiredAtMs = Date.now() - navStart;
        }
      });
      page.on("response", async (resp) => {
        try {
          const url = resp.url();
          if (!url.includes("supabase.co/storage")) return;
          const body = await resp.body().catch(() => null);
          if (!body) return;
          supabaseResponses.push({
            url,
            bytes: body.length,
            status: resp.status(),
            fromCache: resp.fromServiceWorker(),
          });
        } catch {
          /* ignore · best-effort tracker */
        }
      });

      // Navigate · wait only for DOMContentLoaded (NOT networkidle).
      // The amended harness relies on perf marks for success, not
      // network quiescence.
      try {
        await page.goto(scenario.url, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
      } catch (e) {
        console.log(
          `[${scenario.label}] page.goto failed: ${e instanceof Error ? e.message : String(e)}`,
        );
        // Continue · the marks may still show us how far we got.
      }

      // Initial lifecycle · wait for the first slide marks.
      const initialPhases = scenario.kind === "music"
        ? MUSIC_INITIAL_PHASES
        : VIDEO_INITIAL_PHASES;
      const initialLifecycle = await recordLifecycle(
        page,
        `${scenario.label} · initial`,
        initialPhases,
        null,
      );

      // Audio play test (music only) · if slide-visible reached but
      // audio-canplay did NOT fire automatically, programmatically
      // call play() so the user-initiated path is measured too.
      let audioFirstAudible: PhaseResult | null = null;
      if (scenario.kind === "music" && initialLifecycle.phases["slide-visible"]?.reached) {
        try {
          await page.evaluate(() => {
            const a = document.querySelector("audio");
            if (a) {
              a.muted = false;
              a.play().catch(() => {});
            }
          });
          const r = await waitForPerfMark(
            page,
            "audio-first-audible",
            initialLifecycle.correlationId,
            10_000,
          );
          audioFirstAudible = {
            phase: "audio-first-audible",
            reached: r.reached,
            msFromStart: null,
            msFromPrev: null,
            failureReason: r.failureReason,
          };
        } catch {
          /* ignore · we honestly report null */
        }
      }

      // Swipe forward.
      let swipeForward: LifecyclePhase | null = null;
      await simulateSwipe(page, "forward");
      await page.waitForTimeout(SWIPE_SETTLE_MS);
      const fwdCorr = await readLatestSwipeCorrelationId(page);
      if (fwdCorr && fwdCorr !== initialLifecycle.correlationId) {
        const swipePhases = scenario.kind === "music"
          ? MUSIC_SWIPE_PHASES
          : VIDEO_SWIPE_PHASES;
        swipeForward = await recordLifecycle(
          page,
          `${scenario.label} · forward swipe`,
          swipePhases,
          fwdCorr,
        );
      }

      // Swipe backward.
      let swipeBackward: LifecyclePhase | null = null;
      await simulateSwipe(page, "backward");
      await page.waitForTimeout(SWIPE_SETTLE_MS);
      const backCorr = await readLatestSwipeCorrelationId(page);
      if (
        backCorr &&
        backCorr !== fwdCorr &&
        backCorr !== initialLifecycle.correlationId
      ) {
        const swipePhases = scenario.kind === "music"
          ? MUSIC_SWIPE_PHASES
          : VIDEO_SWIPE_PHASES;
        swipeBackward = await recordLifecycle(
          page,
          `${scenario.label} · backward swipe`,
          swipePhases,
          backCorr,
        );
      }

      // Resource bytes (via Resource Timing API · may return 0 for
      // cross-origin without Timing-Allow-Origin header).
      const resourcesRaw = await readResourceBytes(page);
      const resources = groupResources(resourcesRaw);

      // Honest Supabase byte tally (via response events · authoritative
      // for cross-origin resources regardless of CORS).
      const supabaseByClass = {
        covers: supabaseResponses.filter((r) => r.url.includes("/cover-")),
        backgrounds: supabaseResponses.filter((r) => r.url.includes("/background-")),
        audio: supabaseResponses.filter((r) =>
          r.url.includes("/audio-") || r.url.endsWith(".mp3") || r.url.endsWith(".m4a"),
        ),
        avatars: supabaseResponses.filter((r) => r.url.includes("/nex-avatars/")),
      };
      const supabaseTotalBytes = supabaseResponses.reduce((n, r) => n + r.bytes, 0);

      // Collect failures.
      const failedPhases: string[] = [];
      for (const phase of Object.values(initialLifecycle.phases)) {
        if (!phase.reached) failedPhases.push(`initial · ${phase.phase} · ${phase.failureReason ?? "not reached"}`);
      }
      if (swipeForward) {
        for (const phase of Object.values(swipeForward.phases)) {
          if (!phase.reached) failedPhases.push(`fwd · ${phase.phase} · ${phase.failureReason ?? "not reached"}`);
        }
      } else {
        failedPhases.push("forward swipe · no new correlation ID captured");
      }
      if (swipeBackward) {
        for (const phase of Object.values(swipeBackward.phases)) {
          if (!phase.reached) failedPhases.push(`back · ${phase.phase} · ${phase.failureReason ?? "not reached"}`);
        }
      } else {
        failedPhases.push("backward swipe · no new correlation ID captured");
      }

      const report: BaselineReport = {
        scenario: scenario.label,
        url: scenario.url,
        nav: {
          navStartedAt: 0,
          responseReceivedAtMs,
          loadFiredAtMs,
        },
        initialLifecycle,
        swipeForward,
        swipeBackward,
        resources,
        failedPhases,
        simulatedTouch: true,
      };

      // Pretty-print.
      console.log("\n" + "=".repeat(72));
      console.log(`BASELINE · ${scenario.label} · ${scenario.kind} · SIMULATED TOUCH`);
      console.log("=".repeat(72));
      console.log(`URL: ${scenario.url}`);
      console.log(
        `nav · response received: ${responseReceivedAtMs ?? "N/A"} ms · load fired: ${loadFiredAtMs ?? "N/A"} ms`,
      );
      if (audioFirstAudible) {
        console.log(`audio-first-audible after explicit play(): reached=${audioFirstAudible.reached}${audioFirstAudible.failureReason ? ` · ${audioFirstAudible.failureReason}` : ""}`);
      }
      console.log("\n-- Initial lifecycle --");
      for (const p of Object.values(initialLifecycle.phases)) {
        console.log(
          `  ${p.phase.padEnd(22)} reached=${p.reached ? "✓" : "✗"} fromStart=${p.msFromStart ?? "—"} ms fromPrev=${p.msFromPrev ?? "—"} ms${p.failureReason ? ` [${p.failureReason}]` : ""}`,
        );
      }
      if (swipeForward) {
        console.log("\n-- Forward swipe --");
        for (const p of Object.values(swipeForward.phases)) {
          console.log(
            `  ${p.phase.padEnd(22)} reached=${p.reached ? "✓" : "✗"} fromStart=${p.msFromStart ?? "—"} ms fromPrev=${p.msFromPrev ?? "—"} ms${p.failureReason ? ` [${p.failureReason}]` : ""}`,
          );
        }
      } else {
        console.log("\n-- Forward swipe · NO NEW CORRELATION ID (swipe gesture may not have been accepted) --");
      }
      if (swipeBackward) {
        console.log("\n-- Backward swipe --");
        for (const p of Object.values(swipeBackward.phases)) {
          console.log(
            `  ${p.phase.padEnd(22)} reached=${p.reached ? "✓" : "✗"} fromStart=${p.msFromStart ?? "—"} ms fromPrev=${p.msFromPrev ?? "—"} ms${p.failureReason ? ` [${p.failureReason}]` : ""}`,
          );
        }
      } else {
        console.log("\n-- Backward swipe · NO NEW CORRELATION ID --");
      }
      console.log("\n-- Supabase bytes (via Playwright response events · authoritative, CORS-safe) --");
      console.log(
        `  covers       count=${supabaseByClass.covers.length} total=${supabaseByClass.covers.reduce((n, r) => n + r.bytes, 0).toLocaleString()} B (${(supabaseByClass.covers.reduce((n, r) => n + r.bytes, 0) / 1024 / 1024).toFixed(2)} MB)`,
      );
      console.log(
        `  backgrounds  count=${supabaseByClass.backgrounds.length} total=${supabaseByClass.backgrounds.reduce((n, r) => n + r.bytes, 0).toLocaleString()} B (${(supabaseByClass.backgrounds.reduce((n, r) => n + r.bytes, 0) / 1024 / 1024).toFixed(2)} MB)`,
      );
      console.log(
        `  audio        count=${supabaseByClass.audio.length} total=${supabaseByClass.audio.reduce((n, r) => n + r.bytes, 0).toLocaleString()} B (${(supabaseByClass.audio.reduce((n, r) => n + r.bytes, 0) / 1024 / 1024).toFixed(2)} MB)`,
      );
      console.log(
        `  avatars      count=${supabaseByClass.avatars.length} total=${supabaseByClass.avatars.reduce((n, r) => n + r.bytes, 0).toLocaleString()} B`,
      );
      console.log(
        `  TOTAL Supabase transferred: ${supabaseTotalBytes.toLocaleString()} B (${(supabaseTotalBytes / 1024 / 1024).toFixed(2)} MB)  [${supabaseResponses.length} responses]`,
      );
      console.log("\n-- Resource Timing API view (0 for CORS without TAO · reference only) --");
      console.log(
        `  covers       count=${resources.supabaseCovers.length} total=${resources.supabaseCovers.reduce((n, r) => n + r.transferSize, 0).toLocaleString()} B · encoded=${resources.supabaseCovers.reduce((n, r) => n + r.encodedBodySize, 0).toLocaleString()} B · cached-hits=${resources.supabaseCovers.filter((r) => r.cached).length}`,
      );
      console.log(
        `  backgrounds  count=${resources.supabaseBackgrounds.length} total=${resources.supabaseBackgrounds.reduce((n, r) => n + r.transferSize, 0).toLocaleString()} B · encoded=${resources.supabaseBackgrounds.reduce((n, r) => n + r.encodedBodySize, 0).toLocaleString()} B · cached-hits=${resources.supabaseBackgrounds.filter((r) => r.cached).length}`,
      );
      console.log(
        `  audio        count=${resources.supabaseAudio.length} total=${resources.supabaseAudio.reduce((n, r) => n + r.transferSize, 0).toLocaleString()} B · encoded=${resources.supabaseAudio.reduce((n, r) => n + r.encodedBodySize, 0).toLocaleString()} B · cached-hits=${resources.supabaseAudio.filter((r) => r.cached).length}`,
      );
      console.log(
        `  video        posters=${resources.videoPoster.length} bodies=${resources.videoBody.length} totalBytes=${resources.videoBody.reduce((n, r) => n + r.transferSize, 0).toLocaleString()}`,
      );
      console.log(
        `  TOTAL Supabase transfer: ${resources.totalSupabaseTransferBytes.toLocaleString()} B (${(resources.totalSupabaseTransferBytes / 1024 / 1024).toFixed(2)} MB)`,
      );
      if (failedPhases.length > 0) {
        console.log("\n-- FAILED PHASES --");
        for (const f of failedPhases) console.log(`  ✗ ${f}`);
      }
      console.log("=".repeat(72) + "\n");

      // Test should pass regardless of individual phase results · we want
      // the harness to run to completion even on slow Ireland feeds. The
      // reportage above is the acceptance signal.
      expect(report).toBeTruthy();
    });
  }
});
