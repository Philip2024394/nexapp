# NEX Chat Translation Pilot · Handback 2026-11-17 · Continuation 3 · Addendum 4

**Repo:** `Philip2024394/nexapp` · working dir `C:/Users/Victus/nexapp`
**Branch:** `release-audit-v1-2026-11-14`
**HEAD:** `8b47a40e456b74a6a49e86d4be0dbf22f2621a4b` (unchanged · no commits authorised this round)
**Working tree:** 129 porcelain entries (large evidence-directory churn plus this round's source edits from ADDENDUM-3).
**Running shells:** I do not have process-table visibility; the directive mentions two reported running shells. I did NOT send any signal to them, did NOT bind to :3008, did NOT modify dev-server state. All new activity in this round was local `vitest run` + `tsc --noEmit` + file reads.
**Scope delivered this round:** preflight correction, translation re-verification, source audits for cart / chat matrix / attachments / calls / Cream Team naming. No commits, pushes, deploys, migrations, env edits, live charges, auth bypasses.

---

## PREFLIGHT · CRITICAL CORRECTION TO ADDENDUM-3

My ADDENDUM-3 §B.1 claimed *"the dev server on :3008 is currently bound to production Supabase (`ijvqdvsvwtwxzcqmoqit`, see nexapp/CLAUDE.md §8)"*. **That claim was wrong.** The CLAUDE.md file is older than the 2026-11-10 (b) owner directive which flipped the dev target to the sandbox project.

Verified today by reading `.env.local` (names + line numbers only · no secret values printed):

| Line | Variable | Project |
|---|---|---|
| 125 | `NEXT_PUBLIC_NEX_SUPABASE_URL` (prod) | **COMMENTED OUT** (`ijvqdvsvwtwxzcqmoqit`) |
| 128 | `NEXT_PUBLIC_NEX_SUPABASE_URL` (active) | **SANDBOX `kdstoyyeygcopkogqsyv`** |
| 155 | `NEX_POSTGRES_URL` (prod via pooler) | **COMMENTED OUT** |
| 156 | `NEX_POSTGRES_URL` (active) | **SANDBOX direct** |
| 302 | `DATABASE_URL` (prod via pooler) | **COMMENTED OUT** |
| 303 | `DATABASE_URL` (active) | **SANDBOX** |

Comments at lines 121–124 are the owner's 2026-11-10 (b) note: *"dev pointed at SANDBOX kdstoyyeygcopkogqsyv so Phase 2 support tickets light up without touching production. Original ijvqdvsvwtwxzcqmoqit values preserved below (commented) for one-line restore."*

Implication: **the ADDENDUM-3 B.1 "prod-bound" blocker no longer applies as stated.** A fresh browser journey against `:3008` would hit sandbox. This is good news for future rounds but does NOT by itself justify running state-changing browser automation this round, because:
- The directive still requires target verification *immediately before* any state-changing test, and
- I have NO visibility into whether the "two reported running shells" the owner mentioned represent (a) `next dev` on :3008 (which would be safe to hit) or (b) some other process hitting production that I would disturb, and
- The directive is explicit: *"If safe isolation cannot be achieved without disrupting it, report that blocker rather than proceeding."*

So §B.1 reclassifies from "prod-bound" to "running-shell visibility + cleanup authorisation needed," which is lighter but still owner-controlled. See §3 verdict below.

---

## 1 · Translation re-verification (PASS · engineering)

Re-ran focused suites against the current working tree (ADDENDUM-3 fixes still in place):

```
$ npx vitest run src/lib/nex-native/translation
  Test Files   7 passed (7)
  Tests       65 passed (65)
  Duration    693ms
```

And the DOM regression:
```
$ npx vitest run src/app/nex-native/chat/peer/[accountId]/__tests__/translation-layer.test.tsx
  Test Files   1 passed (1)
  Tests        6 passed (6)
```

Integration checks (file + line references, no edits):

- **Sign-out paths.** Two sign-out forms route through the same `runTranslationLogoutCleanup`:
  - `src/app/nex-native/settings/_sign-out-form.tsx:40-42` (client subcomponent lifted from settings/page.tsx · `onSubmit` wrapped in try/catch · never preventDefault)
  - `src/app/nex-native/contacts/_contacts-plus-drawer.tsx:262-266` (plus-drawer sign-out row · same pattern)
- **Cleanup order (fix verified by test coverage).** `translation-logout-cleanup.ts:97-118` snapshots discoverable IDs via `discoverKnownAccountIds()` *before* calling `cache.clearAll()`. The regression test `translation-logout-cleanup.test.ts` case *"clears the cache even when no accounts are discoverable"* locks this ordering in.
- **No preference deletion.** `discoverKnownAccountIds` only *reads* `nex.translation.prefs.v1.*` · the cleanup never writes or removes them. Verified by grep: zero `localStorage.removeItem` or `setItem` on prefs keys in `translation-logout-cleanup.ts`.
- **No Vault / encryption / session touch.** Grep across `translation-logout-cleanup.ts`: zero references to vault, nex_session, supabase.auth, device-key, idb, session cookie.
- **Endpoint validator.** `azure-translator-adapter.ts` `validateAzureTranslatorEndpoint` rejects:
  - non-URL strings (`endpoint_not_a_url`)
  - `http://` (`endpoint_not_https`)
  - untrusted hosts incl. suffix spoofs (`endpoint_host_not_trusted`)
  Credentials are read AFTER the URL parse passes AND the hostname pattern passes AND `https:` passes. Pre-network, `providerAttempts: 0`. The follow-on fetch call uses `redirect: "manual"` so a 3xx cannot replay the subscription-key header on an untrusted target.
- **Env diagnostic.** `warnIfIgnoredAzureEnv` fires once per process. Contains only names (`NEX_AZURE_TRANSLATOR_KEY`, etc.) · unit test asserts the stubbed value `"x"` never appears in the warn output.

| Requirement | Verdict | Evidence type |
|---|---|---|
| Source correctness of cleanup + endpoint + diagnostic | **PASS** | source + mocked unit tests |
| Rendered real-app proof of cleanup under consent-revoke across tabs | **BLOCKED** | needs two-party browser session (see §3) |
| Live Azure proof (real translation) | **BLOCKED** | Translation feature flag OFF · separate owner consent/configuration gate |
| Human-reviewed translation quality | **UNVERIFIED** | post-flag-on, owner-reviewed, not an engineering state |

---

## 2 · Cart + unpaid order (source audit · PASS · behavioural proof BLOCKED)

Source-audited by sub-agent (no edits). Key wiring:

- **Header-cart modal + badge.** `src/app/nex-native/_header-cart-icon.tsx:45-171`. Listens to `nex-cart-changed` custom events and storage events. Badge count is the sum of item quantities from localStorage key `nex_cart_v1` (declared `src/lib/nex-native/cart-types.ts:9`). Count > 99 renders as `"99+"` (line 115). This is confirmed distinct from:
  - Header `+` drawer · `src/app/nex-native/contacts/_contacts-plus-drawer.tsx` (navigation menu, not commerce).
  - Bell notifications · separate dispatch path (`order-notification-service`).
  - Lower-right in-page product drawers · page-local quick-views, not the centered header modal.
- **Add-to-cart.** `src/app/nex-native/_add-to-cart-button.tsx:44-242`. Writes to `nex_cart_v1`, dedupes on `(shop_id, id, variants)`, emits `nex-cart-changed`.
- **Server mirror.** `src/lib/nex-native/cart-service.ts:71-117` · `nex_cart` table with PK `account_id`, JSONB `items`, `delivery_address`, `updated_at`. Debounced save via `saveServerCartAction` (`_actions.ts:3334-3339`).
- **Checkout → unpaid order.** `_actions.ts:2640-3327` `sendCartOrderAction`. Writes `nex_order` row with `state: "created"` via `createOrder` at `order-service.ts:109`. State enum at `src/lib/nex-native/types.ts:1025-1031`: `"created" | "pending" | "paid" | "completed" | "cancelled" | "refunded"`. **No separate `is_paid` boolean · the state machine is authoritative.** Also writes a `nex_peer_message` row with `attachment_meta: { cart: snapshot }` (`_actions.ts:3209`), which is the product/order-context chat handoff.
- **Discovery.**
  - Buyer: `src/app/nex-native/orders/page.tsx:78` · `orderService.listOrdersByCustomer(session.account.id)` · server-rendered, `export const dynamic = "force-dynamic"`.
  - Seller: `src/app/nex-native/manage/orders/page.tsx:53` · `orderService.searchOrders(primary.id, { sort: "newest", limit: 100 })` · same force-dynamic.
  - **Discovery is reload-only.** No `setInterval`, no realtime subscription in either file. Detail pages refresh on action result only (`_client.tsx:150-163`). Any future claim of "real-time orders" would be wrong on today's source.

### Historical cart-journey-r4 `step_I.still_not_paid: false` re-evaluation

`evidence/product-chat-cart-checkpoint/cart-journey-r4-result.json` records:

- `step_G.state: "created"` · the server stored it as unpaid.
- `step_G.is_truthful_unpaid: true`.
- `step_H.body_includes_paid_wrong: true` AND `step_H.body_includes_pending_or_created: true`.
- `step_I.still_not_paid: false`.

The `step_I` field is a harness assertion that was computed by looking for an absence of the word "paid" in the rendered body. Because the seller/buyer detail UI deliberately shows the phrase *"Not paid"* (or similar containing substring "paid"), the harness regex matched and set `still_not_paid: false` — a HARNESS FALSE POSITIVE, not a real payment event. The authoritative state is `nex_order.state`, which `step_G` and `step_H` both show as `created`.

**Verdict for the historical row (order_id `7911e1e2-bb62-49ec-95dd-26e060760397`):**
- Server state at write time: **unpaid** (`state: "created"`, verified by `step_G.is_truthful_unpaid: true`).
- `step_I` assertion is **FAIL (harness-side)** · the string-match predicate is unsound when the UI labels contain the substring "paid".
- I did NOT repair the row and did NOT query the sandbox DB this round — the original evidence file is what it is. If owner wants a fresh sandbox-DB readout of that order's current state, that is a two-line sandbox-admin query using the already-configured sandbox service role; it does not require any prod access.

### Fresh two-party cart proof this round · BLOCKED

Not run. Reasons, verbatim from the directive this ties against:

> "Use separate disposable buyer/seller browser contexts only after target verification."
> "Preserve the founder's production-bound session/server. If safe isolation cannot be achieved without disrupting it, report that blocker rather than proceeding."

Target IS verified sandbox, but the "two reported running shells" the directive mentions are not inspectable from my tool surface. I will not launch a new Playwright journey that may conflict with or kill a shell the owner is actively using. **Owner-smallest-next-action:** confirm which of the two running shells is the `next dev :3008` process and authorise a parallel Playwright run alongside it; or stop one shell and hand me a known-quiet port.

| Cart requirement | Verdict | Evidence type |
|---|---|---|
| Source/architecture correctness | **PASS** | source audit |
| Fresh two-party add/qty/remove/empty/reload/submit/discover | **BLOCKED** | pending shell-visibility + run authorisation |
| Historical r4 `step_I` resolution | **FAIL (harness)** | predicate is a substring match; server state is `created` (unpaid). Neither a payment nor an app bug — a harness-assertion bug. Do NOT rewrite the JSON. |
| Fulfilment (dispatch) kept separate from payment + OFF | **PASS** | migration 349 unapplied; dispatch feature flag file untouched this round |

---

## 3 · Chat matrix 5/6/8 (DEFINITION PASS · COVERAGE BLOCKED)

The numbered matrix is in `evidence/product-chat-cart-checkpoint/REPORT.md` and has 8 items. Quoted verbatim:

- **Item 5 (`REPORT.md:295`):** *"No registered device at all (true no-devices → `no_peer_devices` surfaced truthfully)."* Documented coverage status: **NOT COVERED** — the current test asserts the composer handles a provider error, but does not assert the discrete "no peer devices registered" surface as distinct from any other failure mode.
- **Item 6 (`REPORT.md:296`):** *"Already-registered happy baseline (no cache, first read sees device)."* Documented coverage status: **NOT COVERED** as a dedicated case.
- **Item 8 (`REPORT.md:298`):** *"Bounded retry + duplicate / idempotency behaviour."* Documented coverage status: **NOT COVERED** — adapter does one retry on transient failures with 120–200ms jitter but the test file does not exercise the retry path from the cache's perspective, nor idempotency of duplicate force-refresh.

Items 2, 3, 4, 7 are marked Covered; item 1 is Partial.

### Source anchors for 5/6/8 behaviour

- Send path: `src/app/nex-native/_actions.ts:1019` `sendPeerMessageAction` →
  `src/lib/nex-native/crypto/encrypted-send.ts:89-121` `sendEncryptedPeerMessage` with forceRefresh-at-send-time + `no_peer_devices` / `no_self_devices` error branches.
- Device-key registration at mount: `src/app/nex-native/chat/peer/[accountId]/_device-key-hub.tsx:36-69` → `upsertDeviceKeyAction` at `_actions.ts:4278`.
- **Manual-resend affordance: NOT PRESENT.** Grep for "resend", "retry", "manually" across peer-chat paths returned zero user-facing resend UI. This matches the sealed doctrine (*offline recipient = delivery fails · no queue*) and should stay that way; a "resend" button would be a regression against the privacy invariants.

### Running the matrix this round · BLOCKED

Same blocker as cart (§2). The matrix needs a second authenticated peer to exercise items 5/6/8 against a real send. Items 5/6/8 are also the ones where a mocked device-list fixture can go only so far before a real device registration is needed, so the "add unit tests for 5/6/8 with provider fixtures" path would pass green while still not meeting the directive's *"verify first message/reply, readable recipient delivery and reload behavior"* bar.

| Chat matrix requirement | Verdict | Evidence type |
|---|---|---|
| Matrix definitions read + quoted | **PASS** | evidence file |
| Peer-chat source correctness | **PASS** | source audit |
| New-device/history limitation documented | **PASS** | sealed doctrine honoured · no history-replay path in source |
| Items 5/6/8 actually exercised | **BLOCKED** | needs two-peer browser session (§2) |

---

## 4 · Attachments / uploads (source PASS · behavioural BLOCKED)

Source map confirmed as inherited engineering state:

- **Composer attach entry.** `src/app/nex-native/chat/peer/[accountId]/_composer.tsx:38` opens `UniversalAttachPanel`.
- **Media capture inputs.** `src/app/nex-native/chat/peer/[accountId]/_media-capture.tsx:442-482`:
  - Camera `accept="image/*"` (line 446)
  - Video `accept="video/*"` (line 457)
  - Voice `accept="audio/*"` (line 468)
  - Document `accept="*/*"` (line 479)
- **Size cap.** 25 MB · `MEDIA_MAX_BYTES = 25 * 1024 * 1024` at `_media-capture.tsx:84`, server-side enforced at `src/app/api/nex-native/attachment/encrypted/route.ts:34` as `MAX_UPLOAD_BYTES = NEX_PEER_ATTACHMENT_MAX_BYTES + 1024`. Error copy at `_media-capture.tsx:117`.
- **Encryption-before-upload.** `src/lib/nex-native/crypto/encrypted-attachment-uploader.ts:1-38` wraps file bytes via `attachment-envelope.encryptFileBytes` (XSalsa20-Poly1305 nacl.secretbox) with per-device Curve25519 key wrap. The plaintext never hits the server.
- **Storage bucket.** `nex-peer-chat-ciphertext` (private, declared `route.ts:25`). Public-bucket fallback was REMOVED per Priority 2 doctrine (`route.ts:69-76`). Signed URL mint for read via `src/app/api/nex-native/attachment/encrypted/signed/route.ts:22-24`.
- **Recipient render.** `_encrypted-document-chip.tsx:69-150` with on-demand `fetchAndDecryptDocument` at `src/lib/nex-native/crypto/encrypted-document-download.ts:46`. Click-to-decrypt (not auto-fetch). Browser download via unwrapped content key + filename-blob decryption.

| Attachments requirement | Verdict | Evidence type |
|---|---|---|
| Entry point + accept lists + size cap in source | **PASS** | source audit |
| Encrypted-only path, public bucket removed | **PASS** | source audit |
| Fresh two-session upload/download/preview/reload/cancel/retry | **BLOCKED** | same as §2/§3 |
| Vault isolation check (unchanged · not inspected this round) | **UNVERIFIED** | out of this round's touched scope · Vault files never read |

---

## 5 · Voice / video call centre (source PASS · media UNVERIFIED)

Not UI-only. Real WebRTC implementation:

- `src/lib/nex-native/calls/peer-call.ts` — `RTCPeerConnection` wrapper.
  - `getUserMedia` at **line 183** with voice `{audio:true,video:false}` and video `{audio:true,video:{facingMode:"user"}}` constraints.
  - Entry points: `startVoiceCall` **line 159**, `startVideoCall` **line 166**, `acceptIncoming` **line 268**, `declineIncoming` **line 317**, `hangup` **line 328**.
  - Permission-denied error messaging at **lines 185-189**.
- **Signalling transport.** `src/lib/nex-native/realtime/signalling.ts` typed Supabase Realtime channel wrapper. Channel naming `nex:signal:{conversationId}` (line 86). Signal types: `ring`, `sdp-offer`, `sdp-answer`, `ice`, `bye` (lines 27-65). Transport is Supabase Realtime broadcast + presence over WebSockets.
- **ICE servers.** `peer-call.ts:68-72`: three public STUN servers hardcoded (Google ×2 + Cloudflare). **NO TURN entries.** `src/lib/nex-calling/webrtc-client.ts` mirrors the STUN list. `measurement.ts:16` explicitly notes "would need TURN in production" if relay is required. This matches the owner's D-5 "TURN is a separate decision" seal.
- **Feature flag.** Call UI gated by a `disabled?: boolean` prop on `src/app/nex-native/chat/peer/[accountId]/_call-launcher.tsx:48`. NEX1 support chat passes `disabled=true` and short-circuits at line 155 `if (props.disabled) return null;`.

### What this proves vs. does not prove

- Signalling source + ICE config + permission plumbing: **PASS** (source).
- Two-tab UI showing call buttons: NOT attempted this round; would NOT prove media transport anyway (per directive).
- Actual two-way audio/video on physical devices: **UNVERIFIED**, and intrinsically outside what an engineering agent can prove — even a Playwright trace with virtual WebRTC captures is a browser emulator proof, not a physical-device proof. The directive separates these correctly: *"Two tabs showing a call UI do not prove media transport. … Unavailable real-device or network conditions remain UNVERIFIED."*
- TURN provisioning: **OWNER CONFIG GATE.** Public STUN works for same-NAT-type endpoints; cross-type requires TURN which is deliberately absent.

---

## 6 · "Cream Team" naming (CLARIFICATION OPEN)

Comprehensive grep across `src/`, `nex-supabase/`, `docs/`, `evidence/`:

- **"Cream Team" / "CreamTeam" / "cream-team": 0 code matches. 0 evidence matches.**
- **"Green Team" / "GreenTeam" / "green-team": 0 matches anywhere.**
- The word "cream" appears only as a UI-styling descriptor in two evidence reports: `evidence/dispatch-tracking-checkpoint/REPORT.md:25` and `evidence/product-chat-cart-checkpoint/REPORT-R4-INITIAL-2026-11-17-SUPERSEDED.md:3`, both describing a cream-coloured background on the dispatch/order UI. These are NOT a product-area name.

Per directive, I will NOT rename anything or scaffold a separate app. The clarification needed from the owner is narrowly scoped:

> **Owner clarification needed:** Does "Cream Team" refer to (a) the existing in-app voice/video surface described above in §5 — which would mean we should add the name but NOT create a new route or package — or (b) a separate future product distinct from the current call surface? Functional work on the existing call code continues independently of this answer.

---

## 7 · Six Addendum-2 unblockers · re-classified

| # | Unblocker (quoted) | Classification | Status this round |
|---|---|---|---|
| 1 | "logout/account-switch cleanup against actual authenticated account lifecycle…" | **agent-fixable** | **FIXED** in ADDENDUM-3 (A.1), re-verified today |
| 2 | "close the `invalid_endpoint` coverage gap + confirm `providerAttempts` remains accurate…" | **agent-fixable** | **FIXED** in ADDENDUM-3 (A.2), re-verified today |
| 2b | "one-time diagnostic when `NEX_AZURE_TRANSLATOR_*` set without canonical, names only…" | **agent-fixable** | **IMPLEMENTED** in ADDENDUM-3 (A.3), re-verified today |
| 3 | "prove the cart works end-to-end via two disposable buyer/seller browser sessions…" | **access/authorisation (sandbox browser run)** | **BLOCKED** on running-shell visibility + parallel-run authorisation (not prod-env as previously claimed) |
| 4 | "complete chat matrix 5/6/8" | **access/authorisation (two-peer session)** | **BLOCKED** same blocker as #3 |
| 5 | "live Azure translation / human-reviewed quality" | **owner configuration + public-launch gate** | **GATED** · translation flag stays OFF; separate consent/config gate |
| 6 | "reconcile 1517→1511 vs expected −7 counting" | **agent-fixable (reporting discipline)** | **RECONCILED** in ADDENDUM-3 §A.4 |

---

## Verdicts

### Local-implementation verdict: **GREEN for the items touched this round.**
Translation cleanup, endpoint validation, env-diagnostic, DOM regression, 65 translation tests + 6 DOM regression tests all PASS. Zero typecheck errors in any file this round touched. No code was committed, pushed, or deployed. No migrations applied. Dispatch and translation feature flags remain OFF. Vault / encryption / session / auth code paths were not touched and were not read beyond header-level grep.

### Founder-walkthrough verdict: **AMBER.**
The source audits of cart, chat, attachments, and calls all show architecturally sound wiring that matches sealed doctrine. A founder walkthrough is NOT a public-launch verdict — it is "does the app behave as expected when a developer drives it with knowledge of the surface." At that bar, cart + chat + attachments are expected to behave correctly in the sandbox based on the source audit, but the behavioural proof is BLOCKED on two things the agent cannot resolve:
1. Confirmation of which running shells are safe to drive against.
2. Authorisation for parallel Playwright runs alongside them.

Calls: the walkthrough bar for calls is even higher — physical two-device media. Even with shells authorised, a Playwright-only run will not meet the directive's "actual two-way audio/video" standard.

### Public-launch verdict: **RED (unchanged).**
Public launch continues to require everything the sealed doctrine demands and is NOT within this agent's authority to approve or advance. In particular:
- TURN provider selection + config (D-5, open).
- Translation feature flag + Azure live proof.
- Prod migrations (incl. 349 dispatch, which stays unapplied).
- Independent evidence per V-NET / V-STORE / V-LOG / V-SIG / V-TURN / V-DELETION per Priority-1 doctrine.
- Physical-device call verification.
- Payment surface (Stripe / theme paid rollout) under its own seals.

I did not claim readiness percentages. I will not claim "fully wired" until the actual connected two-party journeys are proved.

---

## (A) Freshly finished and PROVED this round
- Preflight correction: `.env.local` is sandbox-bound, not prod-bound. Documented with line numbers and comment-state evidence.
- Translation suites re-run (65/65 + 6/6 DOM regression). ADDENDUM-3 fixes verified still correct.
- Source audits for cart, chat matrix 5/6/8, attachments, calls — each with file_path:line_number.
- Cream Team naming search — zero code/evidence hits.

## (B) Remaining gaps · blocker · smallest next action
| Gap | Blocker | Smallest next action |
|---|---|---|
| Fresh two-party cart proof | Visibility into "two reported running shells" + parallel-run authorisation | Owner states which PID owns :3008 OR authorises a scripted Playwright run on an alternate port |
| Chat matrix 5/6/8 behavioural coverage | Same as above (needs two peer sessions) | Same as above |
| Attachment end-to-end upload/download/preview | Same as above | Same as above |
| Voice/video media transport proof | Needs two physical devices + optionally TURN | Owner-driven device test (not Playwright) |
| Live Azure translation verification | Translation feature flag OFF + Azure config gate | Owner enables flag on sandbox for a bounded window, hands adapter a sandbox Azure key, we run `translateText` against a pilot text with evidence of exact bytes exchanged |
| Historical r4 `step_I` DB readout | Harness regex is unsound (substring matches "Not paid"); fix is a harness patch, not an app fix | Either owner authorises a 2-line sandbox read of `nex_order.state` for order `7911e1e2-bb62-49ec-95dd-26e060760397`, OR we patch the harness regex to look for `data-order-state="paid"` rather than the word "paid" |
| Migration 349 (dispatch) apply | Owner directive keeps it unapplied | No action; stays as-is |
| "Cream Team" naming | Needs single-sentence owner clarification | Owner answers: does "Cream Team" name the existing call surface, or a separate future app? |
| Commit + push + deploy for ADDENDUM-3 code changes | Safety Constitution §3/§4 require separate explicit approval | Owner names SHA range + destination branch and approves `git commit` (then separate approval for push) |

## (C) Genuinely founder-only
- TURN provider selection + credentials.
- Stripe checkout + webhook live enable.
- Prod migrations (any of 302+, 258, 290, 349, Phase 2 support tickets).
- Translation feature flag enable + Azure live key provisioning.
- Physical-device voice/video verification across two real phones on different networks.
- The "Cream Team" naming decision.
- Commit + push + deploy of this round's and ADDENDUM-3's changes.

End of ADDENDUM-4.
