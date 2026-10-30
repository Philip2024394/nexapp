# NEX World-Class Mobile · Phase B · Prioritised Rollout Plan

**Status:** DRAFT (plan — Phase C implementation NOT YET APPROVED)
**Issued:** 2026-10-30
**Parent standard:** `docs/doctrine/nex-world-class-mobile-engineering-standard-2026-10-30.md`
**Audit method:** 4 parallel read-only Explore agents · scope `C:/Users/Victus/nexapp` only · no files edited

---

## A · Honest limitations of this audit

- Based on **code inspection only**. No real-device measurement; no LCP / CLS / FID numbers; no network-waterfall captures.
- Agent findings have been **re-classified by severity on synthesis** — some agent-labelled "P0" items turned out to be lower-impact on independent re-read (noted inline below).
- Some surfaces (Live, Vault, Family Safety) were only sampled, not exhaustively walked.
- No typecheck or test run as part of this audit.
- `C:/Users/Victus/nexapp/CLAUDE.md` + project memory confirm this is the correct active NEX repo (not `D:/trades`).

---

## B · Tier 1 + Tier 2 verification result (music player)

**Verdict:** PASS on all 8 verification criteria defined in the Engineering Standard §4.

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Placeholder colour `#020914` everywhere intended | PASS | `MusicLibraryOverlay.tsx:625` · `NexMusicPlayerOverlay.tsx:673` · `_preview-client.tsx:315-317, 996, 1036` |
| 2 | Hero image `fetchPriority="high"` + eager | PASS | `NexMusicPlayerOverlay.tsx:683-688` |
| 3 | Library tiles: first 4 high / rest lazy | PASS | `MusicLibraryOverlay.tsx:645-647` |
| 4 | Up-Next thumbnail eager + priority "low" | PASS | `_preview-client.tsx:1079-1085` |
| 5 | `prevCoverUrl` + `prevBackgroundUrl` signed symmetric to next | PASS | `page.tsx:174-207` |
| 6 | `SiblingPreloader` honours Save-Data + 2G/slow-2g | PASS | `_preview-client.tsx:1553-1556` |
| 7 | Preload `<link>` cleanup on unmount | PASS | `_preview-client.tsx:1602-1610` |
| 8 | `router.prefetch` guarded on nullable trackIds | PASS | `_preview-client.tsx:1587, 1594` |

**Does NOT prove end-to-end performance.** No measured LCP delta. Real-device testing required before any "world-class" claim.

---

## C · P0 CRITICAL

### P0-1 · Silent localStorage write failure on Add-to-Cart
- **Files:** `src/app/nex-native/_add-to-cart-button.tsx:108-111` · `src/app/nex-native/chat/_product-detail-sheet.tsx:499-501` · `src/app/nex-native/_floating-cart-pill.tsx:43-45`
- **Observed:** Empty `catch {}` swallows localStorage errors (private mode, quota exceeded). Button shows green ✓ "Added" even when the cart write actually failed → user believes item is in cart.
- **Proposed:** Detect `localStorage` availability + visible banner on failure. No silent success feedback when write fails.
- **Regression risk:** LOW (adds error surface; does not change happy path).
- **Verification:** Private-mode Safari + storage-quota mock; confirm banner shows.
- **Standards cited:** S2 (immediate honest feedback) · S4 (reliability before cleverness).

---

## D · P1 ESSENTIAL

### P1-1 · Directory listing cards universally `loading="lazy"` (LCP blocker)
- **File:** `src/components/nex-native/directory/listing-card.tsx:165`
- **Observed:** Every product card is lazy including featured-deals row above the fold. Landing shows blank slots ~500ms.
- **Proposed:** Split by index: first row eager + high; rest lazy.
- **Regression risk:** LOW. **Verification:** WebVitals LCP delta on landing, mobile 4G. **Standard:** S1.

### P1-2 · Universal Image Display Integrity breach at scale
- **Files:** ~100 call sites of `objectFit: "cover"` across chat / directory / calls / live-commerce (sample: `directory/listing-card.tsx:578` · multiple chat composer sites)
- **Observed:** Sealed doctrine 2026-10-30 §3 requires per-site classification (Class A full-fidelity, Class B intentional crop, Class C chrome). Current usage is uncategorised.
- **Proposed:** Classify each site per §3. Build shared `<NexImage>` wrapper (§3 opportunity). Owner-exception §3.1a (music backgrounds) remains intact.
- **Regression risk:** MED (visible visual change at some sites).
- **Verification:** Grep inventory + classification register.
- **Standard:** S1, S4.

### P1-3 · AddToCartButton (sheet variant) lacks pending feedback
- **File:** `_product-detail-sheet.tsx:486-526`
- **Observed:** Synchronous call with no `useTransition` or disabled-on-pending. Rapid taps possible.
- **Proposed:** Wrap in `useTransition` + `disabled={pending}` + dim opacity.
- **Regression risk:** LOW. **Verification:** Rapid-tap test. **Standard:** S2.

### P1-4 · SendInChatCtaButton pending state missing text swap
- **File:** `_product-detail-sheet.tsx:528-598`
- **Observed:** Cursor + opacity change on pending but text stays "Send in chat" (not "Sending…").
- **Proposed:** Text swap on pending.
- **Regression risk:** LOW. **Verification:** Visual tap. **Standard:** S2.

### P1-5 · Product sheet scroll position not preserved on back
- **File:** `_product-detail-sheet.tsx:217-223`
- **Observed:** Opening next product resets scroll to top; expected: restore or scroll-to-top-announced.
- **Proposed:** Ref-based scroll capture + restore.
- **Regression risk:** LOW. **Verification:** Deep-scroll + back + reopen flow. **Standard:** S2.

### P1-6 · Modal overlay doesn't lock body scroll
- **File:** `_product-detail-sheet.tsx` (no `body.style.overflow` set)
- **Observed:** Backdrop fixed but page can scroll behind on some browsers. `SafeTradeConsentModal` has the correct pattern.
- **Proposed:** Port `SafeTradeConsentModal`'s scroll-lock useEffect.
- **Regression risk:** LOW. **Verification:** iOS + Chrome mobile scroll-behind test. **Standard:** S2.

### P1-7 · FloatingCartPill SSR hydration mismatch risk
- **File:** `_floating-cart-pill.tsx:22-55`
- **Observed:** `useEffect` reads `window.localStorage` without `typeof window` guard. Vercel SSR may hydrate-mismatch.
- **Proposed:** `if (typeof window === "undefined") return () => {};` guard at top.
- **Regression risk:** MED (prevents a real hydration bug). **Verification:** Deploy preview + console error check. **Standard:** S4.

### P1-8 · Share clipboard failures invisible to user
- **Files:** `_preview-client.tsx:226-234, 709-717`
- **Observed:** Clipboard copy inside bare `catch {}` with no toast. User gets no feedback positive or negative.
- **Proposed:** Honest toast on success + on failure path.
- **Regression risk:** LOW. **Verification:** Permission-denied clipboard mock. **Standard:** S2, S4.

### P1-9 · Server-action errors live in local panels only
- **Files:** music `_preview-client.tsx:173-191` + widespread
- **Observed:** `{ok:false, message}` returned by server actions set only local state; closing the panel loses the error entirely.
- **Proposed:** Shared `<ActionErrorBanner>` or global error-toast primitive.
- **Regression risk:** LOW (additive). **Verification:** Force server-action failure + close panel + confirm error still visible. **Standard:** S4.

### P1-10 · Scroll-lock + focus-restore inconsistent across overlays
- **Files:** 8+ overlay/sheet files; `SafeTradeConsentModal` is the correct pattern, others diverge.
- **Observed:** Some overlays lock scroll, some don't. Some restore focus, some don't. No shared contract.
- **Proposed:** Define overlay contract (lock body, trap focus, restore scroll + focus on close, `aria-hidden` siblings). Port everywhere.
- **Regression risk:** MED (touches multiple surfaces). **Verification:** Keyboard-only navigation + VoiceOver traversal per overlay. **Standard:** S2.

---

## E · P2 OPTIMISATION

### P2-1 · Background image not Save-Data-gated
- **File:** `_preview-client.tsx:291-307`
- **Observed:** Hero background always `fetchPriority="high"` + `loading="eager"` even on 2G/Save-Data.
- **Proposed:** Mirror SiblingPreloader's `navigator.connection` gate; fall through to gradient on constrained networks.
- **Risk:** LOW. **Verification:** Network throttle test. **Standard:** S3.

### P2-2 · SiblingPreloader bandwidth-scale missing
- **File:** `_preview-client.tsx:1553-1556`
- **Observed:** Save-Data + 2G gated. 4G/LTE always preloads all 4 images. On constrained LTE this could save 200-400ms.
- **Proposed:** `navigator.connection.downlink < 2 Mbps` → preload next-cover only; `>5 Mbps` → preload all 4.
- **Risk:** LOW. **Verification:** LTE profile test. **Standard:** S3.

### P2-3 · Request fan-out on page mount
- **File:** `preview/[trackId]/page.tsx` + `_preview-client.tsx:268-276`
- **Observed:** Server component signs 8+ signed URLs on every page load (current + next + prev + library covers). No batching.
- **Proposed:** Batch into one server action returning a `{ trackId → URLs }` map.
- **Risk:** MED (contract change page.tsx → client). **Verification:** Network waterfall count. **Standard:** S1, S3.

### P2-4 · Add-to-cart success feedback too long
- **File:** `_add-to-cart-button.tsx:106-107`
- **Observed:** 1400ms timeout; user may re-tap before clear.
- **Proposed:** 800ms + `navigator.vibrate?.(100)` haptic.
- **Risk:** LOW. **Verification:** Rapid-tap. **Standard:** S2.

### P2-5 · Revoke-custody confirm/cancel missing aria-labels
- **File:** `family-safety/custody/[custodyId]/_revoke-button.tsx:79-112`
- **Observed:** Role=group has label but children bare.
- **Proposed:** Add `aria-label` to each button.
- **Risk:** LOW. **Verification:** Axe/WAVE. **Standard:** S2.

### P2-6 · Dial pad backspace emoji-only
- **File:** `call/dial/_dial-pad-client.tsx:188-206`
- **Observed:** `aria-label` present, button content is `⌫`. Some AT read the emoji unreliably.
- **Proposed:** Hidden text companion.
- **Risk:** LOW. **Verification:** Screen reader. **Standard:** S2.

### P2-7 · Dial pad touch target not pinned to ≥44px
- **File:** `call/dial/_dial-pad-client.tsx:104-147`
- **Observed:** No explicit `min-width/min-height` on digit keys; relies on flex grid.
- **Proposed:** `minWidth: 44, minHeight: 44` on digit buttons.
- **Risk:** LOW. (Noted that dial pad is prototype per 2026-10-21 seal.) **Verification:** 320px viewport. **Standard:** S2.

### P2-8 · AudioContext cleanup silent-swallows errors
- **File:** `NexMusicPlayerOverlay.tsx:327-345`
- **Observed:** Cleanup correctly disconnects but each try/catch is silent. If graph never initialised the ref is null and errors are hidden.
- **Proposed:** Dev-only `console.warn` for dangling refs.
- **Risk:** LOW. **Verification:** Mount/unmount with active audio. **Standard:** S4.

### P2-9 · No object-URL revocation
- **Scope:** Media upload paths (`src` grep returns zero `URL.revokeObjectURL`).
- **Observed:** Blob URLs created for file-picker previews never revoked; GC handles eventually.
- **Proposed:** Explicit revoke on file deselect + upload complete.
- **Risk:** MED (requires audit of blob-URL creation points). **Verification:** DevTools memory snapshot. **Standard:** S4.

### P2-10 · Escape handler not guarded against post-unmount events
- **File:** `MusicLibraryOverlay.tsx:119-130`
- **Observed:** Listener removed on cleanup but a keystroke queued before cleanup could still fire.
- **Proposed:** `if (!mounted) return;` guard inside handler.
- **Risk:** LOW. **Verification:** Rapid toggle + keypress. **Standard:** S4.

### P2-11 · Save-Data read once (one-shot, not reactive)
- **File:** `_preview-client.tsx:1537-1557` (SiblingPreloader)
- **Observed:** `navigator.connection` sampled at mount; a user moving off WiFi mid-session isn't re-evaluated.
  (Note: agent flagged this as "P0 stale authorization bypass"; on re-read there is no authorization concern — only a network-constraint read. Correctly P2.)
- **Proposed:** Subscribe to `change` event on `navigator.connection`; re-decide on transition.
- **Risk:** MED. **Verification:** Toggle WiFi mid-page. **Standard:** S3.

---

## F · P3 ARCHITECTURAL

### P3-1 · Shared `<NexImage>` wrapper (missing)
- **Scope:** Universal — all `<img>` sites.
- **Observed:** Image load priority + Class A/B/C classification + fetchPriority + lazy strategy + srcset are scattered. ~100 `objectFit: cover` sites need classification.
- **Proposed:** `<NexImage src surface priority aspect />` wrapper centralising defaults per surface. Opt-in migration (does NOT force all sites at once).
- **Risk:** LOW (new component, opt-in). **Verification:** Migrate 3 highest-traffic surfaces + measure. **Standard:** S1, S4.
- **Note:** This unlocks P1-1, P1-2, P2-1, and gradual compliance with the Universal Image doctrine.

### P3-2 · Shared `<NexPressable>` + `useAbortableAction` hook (missing)
- **Scope:** Every button bound to a server action or async side-effect.
- **Observed:** `SubmitButton` (Wave 10), `AddToCartButton`, `SendInChatCtaButton`, `ActionButtons.ConnectButton` all solve the same problem differently. Inconsistent pending, no debounce, no cancellation.
- **Proposed:** `<NexPressable>` primitive bundling 44×44 target + pending feedback + abortable action + a11y defaults.
- **Risk:** HIGH (eventually 30+ call-site refactor). **Verification:** Rapid-tap test, HTTP 0 cancellation. **Standard:** S2, S3, S4.
- **Note:** Unlocks P0-1 permanent fix, P1-3, P1-4.

### P3-3 · Shared error toast primitive (missing)
- **Scope:** Every surface that calls server actions or network.
- **Observed:** No global error-UX. Each surface rolls its own, mostly `catch {}`.
- **Proposed:** `<ErrorToastProvider>` at root + `useErrorToast()` hook.
- **Risk:** LOW (additive). **Verification:** Trigger server-action failure. **Standard:** S2, S4.
- **Note:** Unlocks P1-8, P1-9.

### P3-4 · Routing contract (missing)
- **Scope:** 254+ router call sites in `nex-native`.
- **Observed:** No systematic rule for `router.push` vs `router.replace` vs `<Link>`. Browser Back semantics variable.
- **Proposed:** Document `routing-contract.md` → chat/product/back pops stack; checkout uses `replace`; profile visits push.
- **Risk:** LOW (document only). **Verification:** Audit after document. **Standard:** S2, S4.

### P3-5 · Request cancellation on fast navigation (missing)
- **Scope:** All `_*-client.tsx`.
- **Observed:** No `AbortController` discipline on server-action callers. Rapid navigation discards response but doesn't abort network.
- **Proposed:** `useAbortableServerAction` hook (part of P3-2 or standalone).
- **Risk:** HIGH (refactor). **Verification:** Network waterfall during rapid nav. **Standard:** S3.

### P3-6 · Stale cache keys on account transitions
- **Scope:** Overlays receiving pre-signed URLs as props.
- **Observed:** No account-id in cache keys. Sign-out → sign-in as different account could show prior account's data briefly.
- **Proposed:** Account-id in all cache keys + auth-context invalidation hook.
- **Risk:** MED. **Verification:** Sign-out + sign-in as different user. **Standard:** S4.

---

## G · Tier 3 (music player client-side state swap) — architecture facts, no implementation

### Existing APIs discovered — Tier 3 **does not require a new endpoint**:
- `toggleMusicTrackLikeAction` — `{trackId}` → `{liked, likeCount}`.
- `recordMusicTrackShareAction` — `{trackId}` → `{shareCount}`.
- `recordMusicTrackViewAction` — `{trackId}` → `{viewCount}`.
- `getMusicTrackLikeStateAction` — `{trackId}` → `{liked}`.
- `getMusicPlayUrlAction` — `{trackId}` → `{signedUrl, coverUrl, backgroundUrl, sourceUrl}`.

A client-side swap can call `getMusicPlayUrlAction` + `getMusicTrackLikeStateAction` on next/prev. **A combined action is NOT required** — it would be a small optimisation (one round trip vs two), not a prerequisite. Recommendation per Standard §5.2: use the existing endpoints first; only add a combined action if measured RTT becomes a problem.

### Current navigation state loss on `router.push`:
Audio element unmounts (location: `NexMusicPlayerOverlay.tsx:1015-1029`). Position / isPlaying / barLevels / AudioContext all lost. The `navigationCommittedRef` pattern (`_preview-client.tsx:652-661`) correctly suppresses stale `onAudioEnded` auto-advance.

### Browser Back today:
`router.push` adds a history entry per track. User can Back through track history to Feed/Library. Originating context (Feed scroll, Library filter) is NOT currently preserved on return — depends on each surface's scroll-restoration.

### Autoplay today:
`NexMusicPlayerOverlay.tsx:1019` honours `autoPlayOnMount` prop. `_preview-client.tsx:594` sets `autoPlayOnMount={true}` unconditionally. Fresh direct URL hit will attempt autoplay and browser may silently block (no visible failure).

### Tier 3 implementation NOT APPROVED. Needs separately:
1. Documented history behaviour (per Standard §5.1 safeguard).
2. "Active listening session" signal (per Standard §5.3) that distinguishes fresh visit from in-session swipe/auto-advance.
3. Preserve-originating-context mechanism (Feed/Library) so Back doesn't trap users.

---

## H · Recommended smallest first batch (awaiting owner approval)

**Phase C-1 proposal: Build `<NexImage>` wrapper + migrate 3 highest-traffic surfaces.**

Rationale:
- Directly addresses the "blue flash before images load" complaint the owner raised.
- Unlocks a scalable path to Universal Image Display Integrity compliance (P1-2) without forcing an all-at-once migration.
- Also unlocks P1-1 (directory LCP) and P2-1 (Save-Data on background) as free follow-ups.
- Risk is LOW — new component, opt-in, zero breaking change to non-migrated surfaces.
- Visible, measurable win on real-device test.

Scope of first batch (would be):
1. Create `src/components/nex-native/image/NexImage.tsx` with surface tokens (hero, library-tile, directory-card, chat-thumbnail, avatar, music-background).
2. Centralise `fetchPriority`, `loading`, `decoding`, `objectFit` defaults per surface (Universal Image doctrine Class A/B/C compliant).
3. Migrate 3 surfaces: music preview cover (hero), directory listing card (above-fold grid), one chat message thumbnail path.
4. Report measured LCP delta on migrated surfaces + leave the other ~97 sites untouched.

**NOT in this batch:** `<NexPressable>`, routing contract, request cancellation, error-toast primitive, batched URL signing, Tier 3 music nav — each separately proposed when C-1 is reviewed.

**Awaiting owner decision:** approve C-1 as proposed? Pick a different first batch (e.g., P0-1 silent cart failure, P3-3 error toast primitive)? Modify C-1 scope?

---

## I · Open gates (unchanged)

All sealed holds remain in force. Deployment is a separate gate. No migration / schema / production-data changes without separate authorisation. Target repo = `C:/Users/Victus/nexapp` (confirmed).
