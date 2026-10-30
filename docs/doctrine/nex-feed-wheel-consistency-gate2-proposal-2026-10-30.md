# NEX Feed · Wheel Consistency · Gate 2 Proposal

**Status:** DRAFT · READ-ONLY PROPOSAL · 2026-10-30
**Authorises:** nothing · requires owner review before any implementation
**Scope:** desktop wheel navigation on the single NEX feed · behaviour on video slides vs music slides
**Explicitly NOT in scope:** pointer handling (Gate 1 complete), prepaint, shared hook, feed ordering, video playback coordination, publishing

---

## 1 · Current state · side-by-side

| Dimension | Video viewer `_video-viewer-client.tsx:519-535` | Music viewer `_music-viewer-client.tsx` wheel handler |
|---|---|---|
| **Model** | Immediate-commit with cooldown | Accumulate-and-settle |
| **Per-event threshold** | `|deltaY| >= 20 px` or ignored | none (every event enters the accumulator) |
| **Direction trigger** | commit immediately when ≥20px | after 120 ms of no new events, if total `|accumulated|` ≥ 60 px |
| **Multi-skip prevention** | `wheelCooldownRef = now + 700 ms` set after each commit | `inFlightNavRef` (post Gate 1 with safety release) + the 120 ms settle naturally collapses a trackpad flick to one accumulation |
| **Interactive-descendant guard on wheel** | ✓ `target.closest("textarea, input, button, a")` returns | ✗ none |
| **Perceived latency, mouse wheel click (single ~100 px detent)** | ~instant · fires within one event | ~120 ms · must wait for settle timer |
| **Perceived latency, trackpad flick (continuous stream of 2-20 px events over 100-300 ms)** | First event in the flick commits immediately; remaining events are absorbed by the 700 ms cooldown. The commit happens AT THE START of the user's gesture. | Entire flick accumulates until the user stops, then settle timer fires 120 ms later. Commit happens AT THE END of the gesture. |
| **Rapid consecutive mouse-wheel clicks (3 clicks in 400 ms)** | First commits immediately, next two are inside the 700 ms cooldown and are IGNORED → user intent "advance 3" collapses to "advance 1" | All three events accumulate (deltaY totals 300-ish). Settle timer fires. Total exceeds 60 → one navigation. User intent "advance 3" collapses to "advance 1". |
| **Wheel over interactive controls** | handler returns early · no accidental navigation when scrolling inside embedded widget | handler accumulates and commits · a wheel over a creator-library button could trigger navigation if the user ever scrolls there |

Different implementation details · same **functional outcome** for most practical cases (one navigation per flick) but different **felt latency** and different **guard coverage**.

---

## 2 · The honest trade-offs

### Immediate-commit (video model)

**Pros:**
- First mouse-wheel click feels instant
- Simple to reason about: one wheel event ≥ threshold = one navigation
- Hard upper bound on nav rate: at most one every 700 ms

**Cons:**
- On trackpads with inertial scroll (macOS, modern Windows precision touchpads), a single physical flick generates 20-50+ wheel events spread over 200-500 ms. The video model commits on the first, locks out the rest — but if the user flicks TWICE in quick succession (common "chase" gesture to skip two entries), the second flick is swallowed because its events arrive inside the 700 ms cooldown.
- Fixed 700 ms is pessimistic for a user who flicks deliberately twice; feels sluggish.
- The 20 px per-event threshold is well above a slow trackpad event (which can emit 1-5 px per tick), so a slow trackpad SCROLL (as opposed to a flick) is ignored entirely until the user crosses the threshold on one event — this can feel unresponsive on low-speed trackpad gestures.

### Accumulate-and-settle (music model)

**Pros:**
- Trackpad continuous-stream handled naturally: the whole gesture gets summed, one navigation fires per gesture.
- Low per-event threshold (any delta accumulates) means slow trackpad SCROLLS also commit when total crosses 60 px.
- Rapid consecutive flicks still collapse to one navigation (same as video), so no skip-the-feed risk.

**Cons:**
- Fixed 120 ms settle imposes a floor on perceived latency even for a crisp single mouse-wheel click.
- No upper bound on nav rate under weird conditions: if a user flicks, waits 150 ms, flicks again, that could register as two commits in 300 ms.
- No interactive-descendant guard · scrolling over a button could unintentionally navigate the feed.

### Reality check · which model is "right"?

**Neither is objectively correct.** The honest answer depends on:
- Whether the typical user is on a mouse wheel (immediate-commit wins on latency) or trackpad (accumulate-settle wins on gesture coherence)
- Whether the user considers "flick, flick, flick to skip three" a natural gesture (immediate-commit penalises this; accumulate-settle also penalises it)
- Whether the user ever scrolls over an embedded button (video's guard prevents accidental nav; music's doesn't)

NEX's user mix is not measured. The W-C-M-E Standard sealed 2026-10-30 says *"Never claim measured performance until measured."* — the same applies to interaction preference.

---

## 3 · Proposed user-facing interaction contract

**One contract for both slide types, device-adaptive implementation.**

### Contract (what the user experiences)

| Contract point | Specified behaviour |
|---|---|
| C1 | One deliberate wheel gesture = exactly one feed-entry navigation (regardless of device). |
| C2 | A "deliberate wheel gesture" is any wheel activity whose summed vertical delta meets or exceeds **60 px** within a single continuous activity window. |
| C3 | A single continuous activity window ENDS when there is no new wheel event for ≥ 100 ms. |
| C4 | After a successful navigation, a cooldown of **500 ms** prevents a second navigation from firing. This allows deliberate "two flicks to skip two" to work (if the user waits ≥ 500 ms between flicks) while absorbing accidental trailing events. |
| C5 | Wheel events whose target DOM element is inside `button`, `a`, `input`, `textarea`, OR an element with the `data-nex-feed-no-swipe` attribute, do NOT contribute to navigation. |
| C6 | Direction: positive accumulated deltaY = advance next; negative = advance prev. |
| C7 | At the first/last feed entry, a gesture in the invalid direction has no effect (no error, no bounce animation unless separately authorised). |
| C8 | Navigation never fires while a prior navigation lock is still active (either the Gate 1 safety-timed lock OR a wheel cooldown). |

### Implementation suggestion (not authorised to build)

A SINGLE wheel handler shape that both viewers can host. Captures BOTH the trackpad-friendly accumulate behaviour AND the mouse-wheel-friendly immediate commit:

```ts
const WHEEL_GESTURE_THRESHOLD_PX = 60;
const WHEEL_SETTLE_MS = 100;
const WHEEL_POST_COMMIT_COOLDOWN_MS = 500;

const handleWheel = (e: React.WheelEvent) => {
  // Guard · wheel over interactive descendants is ignored
  const target = e.target as HTMLElement | null;
  if (target?.closest("button, a, input, textarea, [data-nex-feed-no-swipe]"))
    return;

  const now = Date.now();
  if (now < cooldownUntilRef.current) return;

  accumRef.current += e.deltaY;
  if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  settleTimerRef.current = setTimeout(() => {
    const dy = accumRef.current;
    accumRef.current = 0;
    settleTimerRef.current = null;
    if (Math.abs(dy) < WHEEL_GESTURE_THRESHOLD_PX) return;
    cooldownUntilRef.current = Date.now() + WHEEL_POST_COMMIT_COOLDOWN_MS;
    if (dy > 0) navigate("next"); else navigate("prev");
  }, WHEEL_SETTLE_MS);
};
```

**Why this shape:**
- Trackpad flick (continuous stream): settle collapses to one commit at gesture end · consistent with music today.
- Mouse-wheel click (single large delta): settle fires 100 ms later, commits · marginally slower than video today but the extra 100 ms is below the human just-noticeable threshold (~150 ms).
- Two deliberate clicks ≥ 500 ms apart: both commit · video today loses the second one.
- Rapid stream in a single flick: all events accumulate before settle fires · one commit · same as music today.
- Wheel over a button: ignored · adds guard parity with video.

**Honest limitation:** this would REPLACE the music viewer's current 120 ms settle with the 100 ms+500ms shape AND REPLACE the video viewer's current 20 px+700 ms shape with the same. Changing the video viewer is explicitly out of Gate 1 scope and would need separate authorisation.

### Alternative · keep implementations distinct, align contract only

If the owner prefers minimum risk, align ONLY the user-facing surface:
- Both viewers: hit same 60 px threshold → one navigation per gesture
- Both viewers: ignore wheel over interactive controls → add the `target.closest(...)` guard to music (one line)
- Keep video's 20 px per-event threshold + 700 ms cooldown
- Keep music's 120 ms settle (but lift to 150 ms to match video's "feels responsive after one wheel" window better)

**Smallest possible change:** add the interactive-descendant guard to the music viewer's wheel handler. That's a one-line safety fix; the rest of the behaviour divergence is debatable but not harmful.

---

## 4 · Measurable acceptance criteria (for whichever path is chosen)

If any wheel work is authorised, these are the measurable criteria the Playwright + manual verification should satisfy:

| ID | Criterion | How measured |
|---|---|---|
| M1 | A single mouse-wheel detent (deltaY ~100 px) commits one navigation within 200 ms | Playwright: `page.mouse.wheel(0, 100)` then measure URL change latency |
| M2 | A rapid trackpad flick (10 events of deltaY 10 px over 100 ms) commits exactly one navigation | Playwright: 10 `wheel` dispatches with 10 ms waits, then assert exactly one URL change |
| M3 | Two deliberate wheel clicks ≥ 500 ms apart commit two navigations | Playwright: `wheel(0, 100)`, wait 600 ms, `wheel(0, 100)`, assert URL changed twice |
| M4 | Three wheel clicks within 300 ms commit at most one navigation | Playwright: three `wheel(0, 100)` with 100 ms waits, assert exactly one URL change |
| M5 | Wheel over a button inside the slide does NOT navigate | Playwright: `mouse.move` to a button's rect, `wheel(0, 400)`, assert URL unchanged |
| M6 | At the first feed entry, downward wheel (deltaY < 0) does NOT navigate | Visit `/nex-native/nex-feed/dev-video-1` → `wheel(0, -400)` → URL unchanged |
| M7 | At the last feed entry, upward wheel (deltaY > 0) does NOT navigate | Visit the last sibling id → `wheel(0, 400)` → URL unchanged |
| M8 | Wheel navigation DOES NOT fire while the Gate 1 navigation lock is active | After a successful swipe, immediate wheel within 200 ms is absorbed |

---

## 5 · Focused test plan (if authorised)

Three new scenarios in an additive spec file (`tests/e2e/nex-feed-gate2-wheel-consistency.spec.ts`), each run on BOTH desktop + mobile projects:

1. **Scenario G2-A · Equivalence across slide types**
   - Visit video slide, wheel one detent, assert exactly one URL change
   - Visit music slide, wheel one detent, assert exactly one URL change
   - **Pass:** both slide types commit at approximately the same cadence (within 100 ms of each other).

2. **Scenario G2-B · Multi-skip protection**
   - Three rapid wheels in 300 ms on each slide type
   - **Pass:** exactly one URL change on both slide types.

3. **Scenario G2-C · Interactive-control guard**
   - Position cursor over a visible button on each slide type
   - Wheel one detent
   - **Pass:** URL unchanged on both slide types.

Each scenario should use `page.mouse.wheel` directly (not `dispatchEvent`) because mouse-wheel is the actual production trigger; dispatchEvent is a test-synthesis shortcut.

---

## 6 · Explicit risks + regression areas

If a wheel-handler change is implemented after this proposal:

| Risk | Area |
|---|---|
| Changing the video viewer's wheel behaviour could regress the sealed R6a prepaint behaviour (`navigateWithPrepaint` currently fires on wheel) | `_video-viewer-client.tsx:463-535` — prepaint is tightly coupled to the wheel's immediate-commit model |
| Lifting music's settle timer could make rapid "flick, flick" skip entries, which is contrary to C1 | `_music-viewer-client.tsx` wheel handler |
| Adding `data-nex-feed-no-swipe` as a convention requires updating any component that wants to opt out · incidental scope creep | cross-cutting |
| Testing with `page.mouse.wheel` must respect the new cooldown; existing visual-verify spec test 04's 400 ms cadence would still fail | `tests/e2e/nex-feed-visual-verify.spec.ts` |
| On older trackpads that emit `deltaMode = DOM_DELTA_LINE` (unitless), the 60 px threshold becomes 60 lines ≈ 60 wheel clicks · never commits | wheel handler needs `deltaMode` normalisation |
| Debouncing wheel means first-flick latency rises by at most 100 ms vs the current video model's immediate-commit · a measurable regression against the current video surface | user-perceived · would need a short real-device A/B check |

---

## 7 · My specific recommendation

**Smallest-viable change:** add the interactive-descendant guard to the music viewer's wheel handler ONLY. One line. Fixes the known safety gap flagged in the Gate 1 audit without changing the model.

**Second-smallest:** align the music settle timer with video's cooldown model (replace 120 ms settle with 500 ms post-commit cooldown, keep accumulation) so both viewers behave identically on rapid-flick inputs.

**Not recommended without more measurement:** replacing the video viewer's immediate-commit with music's accumulate-settle. The video viewer's sealed R6a prepaint is tuned to the immediate-commit timing; a shape change there is a bigger risk.

Each of these three options can be isolated and authorised separately. The audit above establishes the trade-offs; the owner decides which (if any) to proceed with.

---

## 8 · Boundaries honoured by this proposal

- No source edits
- No test or configuration edits (this is a Markdown proposal only)
- No migration or database changes
- No commits, pushes, deploys
- No video-viewer changes
- No implementation ANYWHERE in the music viewer

**Waiting for your authorisation to proceed OR to defer.**
