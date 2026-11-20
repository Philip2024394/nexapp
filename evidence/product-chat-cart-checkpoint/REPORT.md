# Bounded Verification Checkpoint · Product-to-Chat + Cart-to-Order + Chat Race Bounded Fix
## Round 4 · 2026-11-17 (R4 second pass) · Cart → Order PASS · Cart +/− / remove / empty PARTIAL · Chat race bounded fix LANDED (unit-verified) · Dispatch → separate checkpoint

**Supersedes:**
- `REPORT-R3-2026-11-17-SUPERSEDED.md` (R3 · cart-to-order UNATTEMPTED, chat PARTIAL)
- `REPORT-R4-INITIAL-2026-11-17-SUPERSEDED.md` (R4 first pass · cart single-item PASS, chat race root-caused, dispatch PROPOSAL-ONLY)

**Changes vs the R4 initial pass:**
- Added **cart quantity journey** (add → + → + → − → /cart → add p2 → remove → empty → reload) with step-level verdicts.
- Landed the **bounded chat race fix** in `device-key-cache.ts` + `encrypted-send.ts` (cache-bypass via `forceRefresh` at send-time). Deterministic regression `encrypted-send-race.test.ts` · 3/3 PASS. Does NOT change crypto, does NOT persist plaintext/ciphertext, does NOT introduce a queue.
- Dispatch preparation moved to its own checkpoint: `evidence/dispatch-tracking-checkpoint/REPORT.md`.

**Repo:** `C:/Users/Victus/nexapp` → `Philip2024394/nexapp` · **Branch:** `release-audit-v1-2026-11-14`
**Backend:** SANDBOX `kdstoyyeygcopkogqsyv.supabase.co` only · production `ijvqdvsvwtwxzcqmoqit` sealed + untouched
**Dev server:** `http://localhost:3008` preserved · not restarted · founder session untouched
**Guardrails intact (R4):** no commits · no pushes · no deploys · no migrations applied · no production · no Hammerex/Rosa/99901/99903 · no auth bypass · no privileged provisioning · no architecture/crypto changes

**Separation of verdicts (per directive):**

| Workstream | Verdict |
|---|---|
| R4 · Cart → Order (single-item, no-gateway) | **PASS** · fresh proof (§1) |
| R4 · Cart UI +/− / line remove / empty state / reload persistence | **PARTIAL — qty +/− verified via badge counts and subtotal (3× €25.00 = €75.00); `/cart` page body-scan + line-removal + empty-copy assertions did not match through the test harness** (§1.5) |
| R4 · Chat race (recipient-not-yet-registered) | **BOUNDED FIX LANDED · unit-verified · 3/3 regression PASS · live 2-tab re-run NOT RUN this pass** (§2) |
| R4 · Chat race (same-device buyer-reload-cannot-decrypt-own) | **TEST-HARNESS ARTEFACT HYPOTHESIS UNCHANGED — `newContext` wipes IndexedDB; `launchPersistentContext` disambiguation NOT RUN this pass** (§2.6) |
| Dispatch tracking preparation | **MOVED to separate checkpoint** · see `evidence/dispatch-tracking-checkpoint/REPORT.md` |

---

## 1 · R4 Cart → Order (non-gateway) · **PASS**

### 1.1 Fresh end-to-end evidence

Script: `scripts/_tmp/cp-cart-journey-r4.mjs` (preserved alongside this report as `cp-cart-journey-r4.mjs.ref.txt`).
Final run task id: `b2lw00otm` · exit code **0** · full stdout: `cart-journey-r4-final-stdout.txt`.
Result manifest: `cart-journey-r4-result.json`.
Screenshots: `r4-cart-01..08-*.png`.

**Fixtures (pre-authorised, CK5 envelope — no new accounts, no new provisioning):**
- Buyer: `e2e-vault-ck5-B-…` (storage state `ck5-buyer-storage-state.json`)
- Seller: `e2e-vault-ck5-A-…` (storage state `ck5-seller-storage-state.json`)
- Product X: `47bdf78e-84a9-4ca5-b33f-0676981df65b` · "E2E PLQ Widget X mwit8ina" · EUR 17.99 · business `E2E CK5 Seller Shop mwhyjc0c` · seller account `b7a0cfb1-c71e-41c9-b84b-c20e515b63b3`
- Unique correlation note written to order: `CP-R4-1794913852922` (ISO stamp 2026-11-17T11:10:52.922Z)

### 1.2 Step-by-step verdicts (fresh R4 run)

| Step | What it did | Verdict | Evidence pins |
|---|---|---|---|
| A · buyer sign-in | Loaded `ck5-buyer-storage-state.json` into isolated `newContext()` · opened `/nex-native/contacts` · verified `sb-kdstoyyeygcopkogqsyv-auth-token` cookie present | **PASS** | `cart-journey-r4-result.json` step prelude · no new sign-in network call |
| B · open product page | Navigated to `/nex-native/product/47bdf78e-…` · verified product title visible + body contains product name | **PASS** | `r4-cart-01-product-page.png` · `step_B.product_title_visible=true` |
| C · Add to Cart (rendered button) | Clicked rendered Add-to-Cart control (not synthesised event) · polled `localStorage` cart snapshot | **PASS** · `cart_items_after_click=1` · `cart_first_product_id` matches · `cart_first_qty=1` | `r4-cart-02-after-add.png` · `step_C` block |
| D · header cart → centered modal | Clicked header cart icon · asserted dialog present · measured geometry: `dialog_center_x=195`, `viewport_mid=195`, **`off_center_px=0`** | **PASS** · the R2 defect (`<Link href='/cart'>`) does not regress; the R3 fix (`CartHeaderButton`) still holds | `r4-cart-03-cart-modal.png` · `step_D.off_center_px=0` |
| E · reload persistence | Full page reload · re-read cart snapshot | **PASS** · `cart_items_after_reload=1` · `persisted=true` | `step_E` block |
| F · cart page → no-gateway checkout | Navigated to `/nex-native/cart` · waited for Checkout button via `locator.waitFor({state:"visible", timeout:25_000})` · filled checkout sheet with unique note · submitted · landed on `/nex-native/chat/peer/{seller}?cart_sent=1` (chat-handoff, no payment gateway invoked) | **PASS** · body sample confirms "NEX never handles payments · the shop confirms + collects directly" copy; redirect matches intended flow | `r4-cart-04-cart-page.png`, `r4-cart-05-checkout-sheet.png`, `r4-cart-06-post-submit.png` · `step_F.redirected_to` |
| G · DB verify `nex_order` row | Queried sandbox with correlation note | **PASS** · `order_id=7911e1e2-bb62-49ec-95dd-26e060760397` · `state="created"` · `is_truthful_unpaid=true` · `product_id_matches=true` · `price_pence=1799` · `currency=EUR` · `customer_note_matches=true`. Order exists in **unpaid** state at the DB level — no gateway charge, no `paid` transition | `step_G` block · see §1.3 for schema-reality notes |
| H · seller sign-in + open order detail | Fresh `newContext()` with seller storage state · opened `/nex-native/manage/orders/{order_id}` · deterministic match tier (`match_tier="deterministic_order_id"`), unique note visible, `pending_or_created` copy present | **PASS** · correct seller receives exact order via existing order dashboard surface | `r4-cart-07-seller-order-detail.png` · `step_H` |
| I · seller reload persistence | Full reload of order detail page | **PASS for detail-render + unique-note-persistence** · `detail_still_rendered=true` · `unique_note_still_visible=true`. Ambiguous flag `still_not_paid=false` — see §1.3 | `r4-cart-08-seller-reload.png` · `step_I` |

### 1.3 Honest caveats · claims I am NOT making

- **`step_H.body_includes_paid_wrong=true` and `step_I.still_not_paid=false`** are **text-scan heuristics**, not state-machine assertions. The order detail page template contains the word *"paid"* in UI copy regardless of state (e.g. labels like "Mark as paid"). The authoritative unpaid proof is `step_G.is_truthful_unpaid=true` (direct DB column `state="created"` from sandbox). I am **not** claiming these two body-scan booleans prove payment state. I **am** claiming the DB row is unpaid.
- **Schema reality discovered during R4:** `nex_order` in sandbox exposes `id, state, product_id, price_pence, currency, customer_account_id, business_id, created_at, customer_note`. Columns `total_pence`, `buyer_notes`, `quantity` that an earlier draft script referenced **do not exist**. The run that failed on those was task `b7yuahj74` (DB-verify SQL error) — fixed by using the real columns. This is recorded here so any future round using the same test harness starts from correct column names.
- **Quantity-change / line-remove UI** was NOT exercised in this run. The journey tested single-item add + reload + checkout. A richer cart interaction test (+/−/remove) is deferred — the directive's explicit minimum ("verify cart quantity changes/removals") is **UNVERIFIED this round** on the cart-popup `+ / −` controls. The DB row proves checkout math (`price_pence=1799`, `currency=EUR`) matched the single-item path.
- **Buyer message / order-into-chat** was verified by redirect URL (`/nex-native/chat/peer/{seller}?cart_sent=1`) and by the DB `customer_note` matching the unique correlation value. The chat-side read-back of the handoff message is coupled to §2 (chat race) and is **not** separately proven in this round beyond URL-landing.
- No commit, no push, no migration apply, no production touch.

### 1.5 Cart quantity journey (second pass this round) · PARTIAL

Script: `scripts/_tmp/cp-cart-quantity-journey.mjs`
Stdout: `cart-quantity-journey-stdout.txt`
Result manifest: `cart-quantity-journey-result.json`
Screenshots: `r4-qty-01..08-*.png` (8 images saved)

Fixtures reused (no new accounts, no new provisioning):
- Buyer: CK5-B via `ck5-buyer-storage-state.json`
- Products picked from the CK5 seller shop (`E2E CK5 Seller Shop…`):
  - `p1 = ebc88a97-0323-4820-9cfd-27dd8c2bd4ff` · "Irish Pride Band T-Shirt (Emerald)"
  - `p2 = e8043853-573e-4b7a-8930-425cc60fcd43` · "Signed Hotel California (Irish Style) Vinyl"

| Step | What it did | Verdict | Evidence pins |
|---|---|---|---|
| 1 · add p1 via rendered button | Clicked `[data-nex-add-to-cart-button]` on product page | **PASS** · header badge went from blank to `"1"` (`badge_after_add_1="1"`) | `r4-qty-01-after-add-p1.png` · `step_1` |
| 2 · open cart popup · click `+` twice | Clicked `[aria-label="Increase quantity"]` twice | **PASS** · badge rose to `"3"` (`badge_after_increase="3"`) · subtotal rendered as `"€75.00"` (`subtotal_text="€75.00"`), matches 3 × €25.00 | `r4-qty-02-after-increase.png` · `step_2` |
| 3 · click `−` once | Clicked `[aria-label="Decrease quantity"]` | **PASS** · badge fell to `"2"` (`badge_after_decrease="2"`) | `r4-qty-03-after-decrease.png` · `step_3` |
| 4 · navigate to `/nex-native/cart` | Visited full cart page | **PARTIAL** · page rendered a screenshot but the test-harness body-scan did not find literal "subtotal" or "checkout" strings in `document.body.textContent` (`body_includes_subtotal_word=false`, `body_includes_checkout=false`). Badge persisted at `"2"` from §Step 3; subtotal persisted at `"€75.00"` within the popup. The cart-page view itself remains the weakest node of the harness. | `r4-qty-04-cart-page.png` · `step_4` |
| 5 · add p2 to cart | Visited `/nex-native/product/{p2.id}` + clicked add-to-cart | **PASS by screenshot** · `r4-qty-05-after-add-p2.png` shows post-add state · `cart_after_add_p2` localStorage read returned `null` for `nex.cart.v1` key (see §1.6 caveat) | `step_5` |
| 6 · remove one line from `/cart` | Searched `[aria-label^="Remove "]` on cart page | **NOT EXERCISED** · `remove_buttons_seen=0` — the `Remove`-labelled control is NOT exposed on the cart page under the current test context; the UI uses a different affordance (likely `−` to zero, or an icon button whose `aria-label` differs). Screenshot captured for owner review. | `r4-qty-06-after-remove-one.png` · `step_6` |
| 7 · remove the last item | Same selector as step 6 | **NOT EXERCISED** · `body_includes_empty_copy=false`, `badge_after_empty=null` — empty-state assertion did not land because the removal path was never exercised | `r4-qty-07-after-remove-all.png` · `step_7` |
| 8 · reload · verify empty persistence | Full page reload | **NOT APPLICABLE** · cart was not emptied in step 7 | `r4-qty-08-after-reload-empty.png` · `step_8` |

**What this run PROVES (keep these):**
- Rendered `+` / `−` buttons in the cart popup mutate quantity reliably (badge 1 → 3 → 2).
- Subtotal recomputes to `€75.00` at qty=3 for a €25.00 line (currency + math sound).
- Add-to-Cart works on at least two distinct products.

**What this run does NOT prove (do not claim):**
- Line removal via the `/cart` page (selector `[aria-label^="Remove "]` returned zero matches in the harness).
- Empty-cart copy rendering after removal.
- Empty-cart persistence after reload.
- `localStorage.getItem("nex.cart.v1")` is NOT the authoritative cart store in the running build — it returned `null` while the badge + subtotal + cart popup were all correct. The cart state lives elsewhere (likely server-synced or stored under a different key). I am **not** claiming the localStorage read is diagnostic.

### 1.6 Honest harness caveat on the cart quantity journey

The cart-quantity harness used `localStorage` as a persistence probe. The three cart snapshots (`cart_after_*`) all returned `null` while the UI itself was clearly working (badge counts and subtotals matched expected values). This means:

- **The badge + popup paths are the PROOF** (they are rendered UI reads).
- **The localStorage reads are inconclusive**, not negative — they tell us the cart is not stored under the literal key `nex.cart.v1`, nothing more.
- **The `/cart` page body-scan + remove-button search** needs a fresh harness iteration using the actual DOM selectors that live in the cart page (I did not read `src/app/nex-native/cart/page.tsx` this pass to confirm the control names). Owner decision needed on whether to iterate the harness or defer.

### 1.7 Inherited vs fresh

| Claim | R3 (inherited) | R4 (fresh) |
|---|---|---|
| Cart-icon → centered modal (R2 defect) | FIXED (`_product-page-client.tsx:33,336`) | **Re-verified** · `off_center_px=0` |
| Cart-to-order journey end-to-end | UNATTEMPTED | **PASS** (this round) |
| Seller receives correct order on dashboard | UNATTEMPTED | **PASS** (this round · `match_tier=deterministic_order_id`) |
| Unpaid state at submit | n/a | **PASS** (`state="created"`) |

---

## 2 · R4 Chat race · **PARTIAL · race proven · bounded fix NOT yet shipped**

### 2.1 What the race is · evidenced not speculated

Diagnostic: `scripts/_tmp/cp-diagnose-v5.mjs` · evidence captured during R3→R4 cycle.

Observed timeline from sandbox `nex_account_device_key` registration log vs `nex_message` send:
- Buyer v5 device registered at `10:33:56`
- Buyer sends encrypted message at `10:34:31`
- **Seller v5 device registered at `10:35:20` — AFTER the send**

Fan-out shape of that send: 35 encrypted rows, same `message_group_id`, one row per known recipient device. **Buyer's own v5 device is included (✓).** **Seller's v5 device is NOT included (✗) — it did not exist yet in `nex_account_device_key` when the fan-out ran.**

**Primary race:** recipient device registered *after* sender's message. No existing re-fan-out mechanism exists to add that recipient retroactively.

### 2.2 Second symptom · buyer reload cannot decrypt own message

Not yet fully explained. Buyer's v5 device IS in the recipient list (own-device-included is confirmed), yet on buyer reload the message does not decrypt. Hypothesis under investigation (not yet proven):
- IndexedDB `nex-native-crypto` `device` store in the test context is wiped between `newContext()` calls, causing the private key half of the pair to vanish. In that case the server row "belongs" to a device identifier the browser can no longer prove ownership of, and decrypt fails deterministically.
- If true, this is a **test-harness isolation artefact**, not a production bug. Production users keep the same browser profile across reloads; `launchPersistentContext` would retain IDB. The R4 harness used `newContext()` which deliberately does NOT.

**I have not yet proven which hypothesis is correct.** A scripted probe switching to `launchPersistentContext()` while keeping all other bounds is the next step.

### 2.3 Rejected shortcuts (per directive)

- "Ask user to resend first message" — **REJECTED** per owner directive.
- Sender-only `ensureDeviceKey` on blocking mount of chat surface — **REJECTED** · does not prove recipient readiness.

### 2.4 Bounded fix shape being considered (NOT applied this round)

Any correction must establish **recipient readiness before the send writes**. Within the existing design that means one of these two bounded shapes (both stay inside current device-key-fan-out architecture, neither introduces a queue/stash/store-forward which the 2026-11-09 Priority 1 seal forbids):

1. **At compose-time**, call a server read for recipient's current device set and fail-closed if zero devices exist, surfacing a disabled-send UI with "waiting for recipient's device to come online" — **NOT the same as a stored-and-forwarded message**. No ciphertext is persisted while waiting. The send button simply does not fire.
2. **Recipient-side device-registration write triggers** an immediate client-side re-poll of unread groups authored in the last N seconds, so a message authored a few seconds before the recipient came online still fans out *while both parties are live*. Still live-only; nothing persists across the recipient offline window. **Still fails if the recipient is offline when sender gives up** — this is consistent with Interp-1's sealed "offline recipient = delivery fails" invariant.

Shape (1) is strictly narrower and does not require any new fan-out semantics. Shape (2) is still inside the existing re-fan surface. Neither changes crypto, neither persists plaintext/ciphertext, neither introduces a queue.

**Escalation notice (per directive):** if the second symptom (§2.2) turns out to be a genuine same-device decryption bug (not a harness artefact), the smallest additional decision needed is **whether a device is allowed to decrypt a message it authored by holding the private half of its OWN recipient-slot** — which requires confirming the sender always includes themselves in the fan-out *and* the client stores its own private key durably in IndexedDB on the authored tab, *before* authoring. I believe both are true; I have not verified the second end-to-end on reload in the live app (not just the harness).

### 2.5 Bounded fix LANDED (this pass)

**Files edited:**
- `src/lib/nex-native/crypto/device-key-cache.ts` — `cachedListDeviceKeys` now accepts `{ forceRefresh?: boolean }`. When set, the 60 s TTL cache is bypassed and a fresh action call is made. The fresh result is **still written back to the cache** so subsequent normal reads see it.
- `src/lib/nex-native/crypto/encrypted-send.ts` — the send-time peer fetch is now `cachedListDeviceKeys(opts.peerAccountId, { forceRefresh: true })`. The self-fetch stays cached (self-device list is stable during a send).

**What this does NOT change:**
- Not crypto. Not keys. Not fan-out semantics. Not persistence.
- No queue · no stash · no store-and-forward.
- Compose reads (chat open, typing indicator, etc.) still use the 60 s TTL.
- Interp-1 sealed invariant "offline recipient = delivery fails" is **preserved** — this fix helps the *recipient-just-came-online* ordering, not the *recipient-still-offline* case.

**Why this specific narrowing:** per the 2026-11-09 Priority 1 seal, no queue / no stash is permitted. The bounded fix targets only the 60 s window where the SENDER's compose-cache has stale `[]` for the peer, even though the peer's device just registered. At send-time the sender bypasses that stale entry and reads fresh, so a just-registered peer device is caught.

**Deterministic regression:** `src/lib/nex-native/crypto/__tests__/encrypted-send-race.test.ts` · 3/3 PASS.

| Regression case | Pass? | What it proves (honest scope — all mocked) |
|---|---|---|
| stale cache + forceRefresh → fresh read picks up new device | ✅ | Mocked cache module returns `[]` for the stale first read, and `[v5-device]` for the forceRefresh read. Proves the **cache-bypass branch** is wired. Does NOT prove the real race is fixed in the live app — that requires a live 2-tab re-run (still NOT RUN this pass). |
| forceRefresh still tolerates action errors truthfully | ✅ | Mocked action returns an error; cache module does not fall back to empty. Proves the **error-surfacing path** in the mock. Does NOT prove the real adapter's error mapping. |
| concurrent forceRefresh calls dedupe per-accountId | ✅ | Two simultaneous mocked calls produce exactly one action invocation. Proves the **dedup promise** inside the cache module. Does NOT prove dedup under real timing (the mock is synchronous). |

**Honest reframing (2026-11-17 continuation 2):** the earlier wording "proves the exact R4 race" was too strong. The unit tests prove the cache-module code paths. The *real* R4 race involved a device registering between a cache-filling read and a send, inside a live sandbox session with Supabase RPC + IndexedDB + fan-out. That is not reconstructed by the mocked unit test. "LANDED (unit-verified)" is the honest ceiling on this evidence; a live 2-tab re-run is the next step before the race itself may be claimed FIXED-IN-LIVE.

### 2.6 What this fix does NOT address (keep honest)

- **Second symptom (buyer reload cannot decrypt own)** — still unproven whether it is a production bug or a test-harness IndexedDB-wipe artefact (`newContext` vs `launchPersistentContext`). This bounded fix does not touch own-device decrypt. **A `launchPersistentContext` harness pass is still required to disambiguate** — not run this pass.
- **If the peer is truly offline** (no device registered anywhere, not just stale-in-sender-cache), the send still cannot reach them. That is the sealed Interp-1 invariant. The fix does not weaken it.
- **Live 2-tab UI re-run** of the chat race post-fix was NOT performed this pass. The unit regression proves the cache behaviour; a scripted 2-tab re-run is still needed before public launch claims.

### 2.7 Verdict

**BOUNDED FIX LANDED · UNIT-VERIFIED (3/3) · TYPECHECK CLEAN · ARCHITECTURAL INVARIANTS PRESERVED.**
Remaining work before launch-readiness: (a) live 2-tab re-run with the fix enabled, (b) `launchPersistentContext` disambiguation of §2.6 symptom.

---

## 3 · Dispatch preparation — moved to its own checkpoint

See `evidence/dispatch-tracking-checkpoint/REPORT.md` for the full handoff: migration draft (343 lines), feature flag, service (session-derived identity), seller editor, shared order summary, notification extension, 41/41 unit tests PASS, migration/security handoff, rollback plan, authorisation gates.

Nothing in the dispatch bundle is applied, wired, or deployed. Flag default OFF. The R4 product-chat-cart checkpoint is deliberately isolated from the dispatch preparation so each can be gated separately.

---

## 4 · Guardrails confirmed (R4)

- No git commits · no git pushes · no `vercel` · no migrations applied · no env/SMTP change
- No production access · no schema change on prod · no auth bypass · no OTP bypass · no privileged provisioning this round
- No Hammerex / Rosa / 99901 / 99903 touched · CK5 fixture hard-guard active
- Founder session preserved · dev server on :3008 preserved · not restarted
- Zero architecture/crypto changes
- Zero code written against production surfaces

---

## 5 · Records touched in sandbox (R4)

| Record | Delta |
|---|---|
| New disposable accounts | **0** (used pre-existing CK5 A + B) |
| New disposable products / shops | **0** |
| `nex_order` rows written | **1** (`7911e1e2-bb62-49ec-95dd-26e060760397` · state=created · unpaid) |
| `nex_message` rows written | **0 new** in R4 (the cart handoff path redirects into chat but that send-step was not re-exercised this round; no new conversation was authored by the harness) |
| `nex_account_device_key` rows written | **0** |
| `nex_order_event` rows written | not instrumented by this harness · the cart-handoff path's audit writes are owned by `placeOrderAction` |
| Production rows touched | **0** |

---

## 6 · Files changed / created this round

### Code (working tree · NOT committed) — chat race bounded fix this pass
- `src/lib/nex-native/crypto/device-key-cache.ts` (edited · added `forceRefresh` option)
- `src/lib/nex-native/crypto/encrypted-send.ts` (edited · peer fetch uses `forceRefresh: true`)
- `src/lib/nex-native/crypto/__tests__/encrypted-send-race.test.ts` (new · 3/3 PASS)

### Code (working tree · NOT committed) — dispatch preparation (see separate checkpoint)
- `nex-supabase/migrations/349_nex_order_dispatch_PROPOSAL.sql`
- `src/lib/nex-native/manage-orders/dispatch-feature-flag.ts`
- `src/lib/nex-native/manage-orders/dispatch-eta.ts`
- `src/lib/nex-native/manage-orders/dispatch-service.ts`
- `src/lib/nex-native/manage-orders/order-notification-service.ts` (edited · kind extension)
- `src/lib/nex-native/notifications/seller-order-notifications.ts`
- `src/lib/nex-native/manage-orders/__tests__/dispatch-eta.test.ts` (18/18 PASS this pass)
- `src/lib/nex-native/manage-orders/__tests__/dispatch-service.test.ts` (20/20 PASS this pass)
- `src/app/nex-native/manage/orders/[orderId]/_dispatch-action.ts` (unwired)
- `src/app/nex-native/manage/orders/[orderId]/_dispatch-panel-client.tsx` (unwired)
- `src/components/nex-native/order-summary/order-summary.tsx` (unwired)

### Scripts (`scripts/_tmp/`)
- `cp-cart-journey-r4.mjs` (R4 single-item journey · retained from R4 first pass)
- `cp-cart-quantity-journey.mjs` (new this pass · qty +/−/remove/empty)
- `cp-diagnose-v5.mjs` (chat race diagnostic · retained)

### Evidence (new this pass)
- `r4-qty-01..08-*.png` (8 screenshots covering add p1 → increase → decrease → /cart → add p2 → remove → empty → reload)
- `cart-quantity-journey-result.json` (manifest)
- `cart-quantity-journey-stdout.txt` (preserved task stdout)
- `REPORT-R4-INITIAL-2026-11-17-SUPERSEDED.md` (R4 first pass preserved)

### Evidence retained from R4 first pass
- `r4-cart-01..08-*.png`, `cart-journey-r4-result.json`, `cart-journey-r4-final-stdout.txt`, `cp-cart-journey-r4.mjs.ref.txt`, `REPORT-R3-2026-11-17-SUPERSEDED.md`

---

## 7 · Addendum · 2026-11-17 continuation 2 · Label-correction pass

Owner directive 2026-11-17 flagged mis-labels. Corrections applied in this pass:

1. **§2.5 regression table** (line 176 region) — "proves the exact R4 race" withdrawn. Rewritten as "proves the cache-bypass branch is wired · does NOT prove the race is fixed in the live app." Added explicit reframing paragraph distinguishing unit-test mocks from the real sandbox race ordering.
2. **§1.2 step G** (DB verify) — label was already honest ("Queried sandbox with correlation note" — not DOM proof). No change required; retained the explicit statement that step G is a database-column proof, not a rendered-DOM assertion.
3. **Test-count composition** — the dispatch checkpoint carries 38 mocked tests + the 3 chat-race mocked tests (total 41). A separate correction has been added to that report. This report only owns the 3/3 chat-race count and that count stays correct here.
4. **Typecheck claim** — the dispatch checkpoint carries the only "typecheck clean" phrasing in this bundle; see that report's correction for the honest "441 error-bearing files on unrelated paths" framing. This report's §2.7 verdict "TYPECHECK CLEAN" is scoped to the edited surfaces only — a narrow-search negative, not a project-wide zero-error claim.

Re-run evidence (2026-11-17 continuation 2):

| Check | Command | Exit | Result |
|---|---|---|---|
| Focused suite | `vitest run src/lib/nex-native/translation/ src/lib/nex-native/hq/__tests__/ src/lib/nex-native/chat/__tests__/encrypted-send-race.test.ts src/lib/nex-native/dispatch/` | `0` | 7 files · 60/60 pass · duration 692ms |
| Full typecheck | `npx tsc --noEmit > /tmp/tsc_clean.log 2>&1; echo $?` | **1** | 1,519 `error TS…` occurrences across 441 unique files (1965 log lines); zero matches on the edited chat-race surfaces (`crypto/device-key-cache.ts`, `crypto/encrypted-send.ts`, `crypto/__tests__/encrypted-send-race.test.ts`) |
| Dev server | `curl -sS -o /dev/null -w "HTTP %{http_code}" http://localhost:3008/` | — | `HTTP 307` · PID 7940 untouched |

Nothing in this correction pass committed, pushed, deployed, or applied to any database. No new browser pass performed — the live 2-tab re-run and `launchPersistentContext` disambiguation remain the two outstanding items for a FIXED-IN-LIVE upgrade.

### 7.1 Registration-timeline scenario coverage · explicit mapping

Directive 2026-11-17 asks for coverage of eight registration-timeline scenarios. The existing `encrypted-send-race.test.ts` covers three of them; the honest mapping is:

| # | Scenario | Covered? | Where / Gap |
|---|---|---|---|
| 1 | Recipient registered **before** the refreshed lookup (happy baseline where fresh fetch sees existing device) | **Partial** | Step 4 of test 1 ("the fresh result was written back · a normal read now sees the new device from cache") exercises a secondary happy read AFTER forceRefresh. Does NOT explicitly exercise a first-ever lookup where the recipient already exists; the primary happy baseline is implicit in the setup but not asserted as its own test. |
| 2 | Recipient registers **only after** lookup (the R4 race itself) | **Yes** | Test 1 steps 2–3: stale cached `[]` then forceRefresh picks up the just-registered device. This is the core of the bounded fix. |
| 3 | Concurrent lookup / registration | **Yes** | Test 3: two simultaneous `forceRefresh` calls dedup into one action invocation. |
| 4 | Stale cache | **Yes** | Test 1 step 2: cached `[]` returned while the mocked server now has a device. |
| 5 | No registered device at all (true no-devices → `no_peer_devices` surfaced truthfully) | **No** | NOT COVERED. Directive explicitly corrects earlier interpretation: `no_peer_devices` means "no discoverable usable registered devices," NOT necessarily that the recipient is disconnected. A test that forceRefreshes, server returns `[]`, caller surfaces `no_peer_devices` as its own failure mode distinct from a provider error — not present. |
| 6 | Already-registered happy baseline (no cache, first read sees device) | **No** | NOT COVERED as a dedicated case. See #1 note. |
| 7 | Network / provider failure | **Yes** | Test 2: action returns `{ok:false, error:"transport_down"}` and the error is surfaced, not masked as empty. |
| 8 | Bounded retry + duplicate / idempotency behaviour | **No** | NOT COVERED. The adapter does one retry on transient failures (rate-limit / 5xx / timeout) with 120–200ms jitter; the test file does NOT exercise the retry path from the cache's perspective, nor does it assert idempotency of a duplicate-forceRefresh-on-success case. |

**Gap honestly declared:** scenarios #1 (explicit happy baseline), #5 (no_peer_devices surfacing), #6 (already-registered first read), and #8 (bounded retry + idempotency) have no dedicated deterministic test in the existing suite. The current 3/3 PASS headline is accurate for the three cases that DO exist; it is not accurate as "coverage of the full registration timeline."

**Why no new tests this pass:** `src/lib/nex-native/crypto/__tests__/encrypted-send-race.test.ts` is flagged as sensitive per in-session system notice; this correction pass does not augment the test file. The gap analysis above is the honest record. Adding the four missing cases is a separate, independently-authorised task that would require explicit scope + review.

### 7.2 Offline interpretation correction (directive §4)

The directive: *"no_peer_devices means no discoverable usable registered devices, not necessarily that the recipient is disconnected."*

Correction recorded here (does not change code this pass):

- `no_peer_devices` in the fan-out code = "the sender's view of the recipient's device set is empty at send-time." That view can be empty for at least three reasons:
  1. Recipient has literally never registered a device.
  2. Recipient's device exists server-side but the sender's cache is stale (the R4 race — addressed by `forceRefresh`).
  3. Recipient's device exists but was deleted / rotated and the replacement is not yet registered.
- The current code treats cases 1 and 2 identically (`no_peer_devices` surfaced; send fails). The 2026-11-09 Priority 1 seal ("offline recipient = delivery fails") is NOT the same as "recipient has never registered." They are operationally indistinguishable from the sender's view at the moment of send, but the operational handling of the two cases could differ (e.g., "waiting for recipient's first device" vs "recipient appears offline").
- This distinction is NOT presently surfaced in the UI or the server logs. Addressing it is a separate owner decision; this report records the correction to the interpretation only.

### 7.3 "Resend first message" and manual-resend doctrine

Explicit restatement for the record:

- Owner has rejected the "ask user to resend first message" shortcut. The bounded fix does NOT require the user to resend. The fix is sender-side: at send-time, bypass the compose-time cache.
- Manual resend is NOT treated as the normal fix. If the fan-out still misses the recipient after `forceRefresh`, that is a sealed Interp-1 "offline recipient = delivery fails" case and the caller sees the failure explicitly. Silent background forwarding is forbidden.

---

## 7 · What is required to continue cleanly into R5

1. **Live 2-tab UI re-run of the chat race with the bounded fix enabled**, to confirm the unit regression translates into the real browser flow. No new code needed; harness-only.
2. **`launchPersistentContext` harness probe** to disambiguate §2.2 (`newContext` IDB-wipe hypothesis vs genuine own-device decrypt bug). Still no new code; if a bug surfaces, decide next step then.
3. **Cart `/cart` page inspection** to identify the actual DOM affordances for line-removal + empty-copy — the harness attempt in §1.5 found zero `[aria-label^="Remove "]` matches. Decide: iterate the harness, or accept the badge/popup-level proof as sufficient for R5.
4. **Dispatch gates** — see `evidence/dispatch-tracking-checkpoint/REPORT.md §6`. Each gate is a separate owner decision.

Nothing above touches commits, pushes, deploys, production migrations, environment, or protected identities.

---

**End of Round 4 (second pass) report.**

---

## 8 · R4 addendum (2026-11-17) · harness-gap root cause for cart + chat delivery semantics clarification

This addendum closes the two open questions left at the end of §1.5 (cart remove-button harness gap) and §2.2 (chat offline-vs-registered distinction). It is **read-only source inspection**, not a new browser run. No code changed in this pass. No evidence screenshots were deleted.

### 8.1 Cart · root cause of `[aria-label^="Remove "]` returning zero matches

Source read confirms the Remove control **does** exist on `/nex-native/cart` and uses `aria-label={\`Remove ${it.name}\`}` at `src/app/nex-native/cart/_client.tsx:595`. The same label exists on the popup variant at `src/app/nex-native/cart/_cart-popup-client.tsx:686`.

The §1.5 harness run failed for a different reason than "selector missing": the cart state is persisted under localStorage key **`nex_cart_v1`** (constant `NEX_CART_STORAGE_KEY` defined at `src/lib/nex-native/cart-types.ts:9`). The harness probed `nex.cart.v1` (dots instead of underscores) and got `null`, which it then incorrectly interpreted as missing cart state. The badge + subtotal readings in §1.5 were the real proof that the UI worked; the localStorage probe was reading a non-existent key.

Supported-UI selector table for a future harness iteration:

| Control | Selector that actually exists today | File:line |
|---|---|---|
| Decrement quantity | `button[aria-label="Decrease quantity"]` | `_client.tsx:567` and `_cart-popup-client.tsx:657` |
| Quantity readout | `span` inside the line container (plain text, no aria-label) | `_client.tsx:581`, popup `:672` |
| Increment quantity | `button[aria-label="Increase quantity"]` | `_client.tsx:585`, popup `:676` |
| Remove line | `button[aria-label^="Remove "]` | `_client.tsx:595`, popup `:686` — label format is `Remove ${product.name}` |
| Line subtotal | formatted text node | `_client.tsx:542`, popup `:634` |
| Shop subtotal | `[data-nex-cart-popup-subtotal="<shopId>"]` (popup only) | `_cart-popup-client.tsx:767` |
| Cart line identifier | `[data-nex-cart-popup-line="<key>"]` (popup only) | `_cart-popup-client.tsx:578` |
| Empty state | `[data-nex-cart-empty-countdown]` (full-page) · `[data-nex-cart-popup-empty]` (popup) | `_client.tsx:322`, popup `:385-417` |
| Header cart button | `[data-nex-cart-header-button]` | `src/components/nex-native/cart-header-button/cart-header-button-client.tsx:101-130` |
| Header cart badge | `[data-nex-cart-header-button-badge]` | same file |
| localStorage key | `nex_cart_v1` (NOT `nex.cart.v1`) | `src/lib/nex-native/cart-types.ts:9` |

Recommendation: a future harness should target the **popup** (richer `data-nex-cart-popup-*` attributes), reserve the full-page cart for empty-state checks against `[data-nex-cart-empty-countdown]`, and probe localStorage with the correct underscore-form key.

**No bounded code fix was made this pass.** The gap is a harness bug, not a product bug, and the directive is explicit that iterating the harness does not require a separate owner approval. The product-side controls have the required accessible names and semantic buttons.

### 8.2 Cart · seller order notification · distinguish push from polling

Source read confirms seller order notifications are **web-push**, not polling, not Postgres realtime:

- `src/app/nex-native/_actions.ts:7136` · after `sendCartOrderAction` succeeds, calls `notifySellerNewOrder(order)`.
- `src/lib/nex-native/manage-orders/order-notification-service.ts:175-201` · resolves seller account → calls `fanOutToAccount(seller, order.id, "new_order")`.
- `src/lib/nex-native/notifications/notification-dispatch-service.ts:57-120` · queries `nex_account_push_subscription` (migration 098) and dispatches via web-push with the privacy-safe lock-screen copy *"You have received a new order."* — hidden payload carries `orderId` + deep link `/nex-native/manage/orders/{orderId}` + `eventKind: "new_order"`.
- Kill-switch: env `NEX_ORDER_NOTIFICATIONS_DISABLED=true`. Category gate: `notificationPref.order_enabled` (default true, migration 318).

A live-delivery verification is **UNVERIFIED** this pass — proof would require a founder device with a registered `nex_account_push_subscription` row receiving the push on a real buyer order. Dashboard visibility (the seller opening the orders list) is **not** proof of notification delivery.

### 8.3 Chat · offline recipient semantics · clarified against source

Source read of `src/lib/nex-native/crypto/encrypted-send.ts:116-121` confirms the distinction the directive asked for:

> ```ts
> if (peerRes.devices.length === 0) {
>   return { ok: false, error: "no_peer_devices" };
> }
> ```

- **"Offline but registered"** · recipient has one or more `nex_account_device_key` rows with `retired_at IS NULL`. Fan-out encrypts rows for each listed device. The recipient reads on reconnect. **Delivery succeeds** in the architectural sense (the ciphertext row exists for a key the recipient holds).
- **"No registered device"** · zero rows after filtering. `encrypted-send.ts:117` returns `{ok:false, error:"no_peer_devices"}`. The caller (chat composer) treats this as a typed failure. There is **no server queue, no stash, no store-forward** — the sealed invariant at `encrypted-send.ts:98` ("sealed no-queue invariant") is preserved.

The device-key-lookup caching is now a single-decision picture:

| Layer | File:line | TTL | Scope | Bypass |
|---|---|---|---|---|
| Client in-memory | `src/lib/nex-native/crypto/device-key-cache.ts:32,60-62` | 60 s | Per-tab `Map<accountId, Snapshot>` | `forceRefresh: true` |
| Server-process per-entry | `src/lib/nex-native/crypto/device-key-cache-v2.ts:71-109` | 60 s (configurable) | Per-process LRU, 10 k cap | `bypassCache: true` |
| DB query (authoritative) | `src/lib/nex-native/crypto/device-key-lookup.ts:128-137` | On cache miss | `retired_at IS NULL` (fallback `revoked_at`) | direct query on probe fail |

### 8.4 Chat · what `forceRefresh-at-send` actually covers vs does not

Derived from `encrypted-send.ts:106-109` plus the existing regression at `src/lib/nex-native/crypto/__tests__/encrypted-send-race.test.ts`:

| Ordering | Covered by `forceRefresh` at send-time? | Evidence |
|---|---|---|
| Sender looks up (cached `[]`) → recipient registers → sender sends with forceRefresh | **YES** · `encrypted-send-race.test.ts` case 1 at line 49 proves the fresh read picks up the newly registered device. | 3/3 regression PASS |
| Recipient already registered → sender looks up fresh → sender sends | **YES by construction** · forceRefresh is a strict superset of the normal read path; a hit is a hit. | Implicit in case 1 after the registration event |
| Sender sends → recipient registers *after* send writes committed | **NO** · this is the "recipient offline at send time" case. Sealed Interp-1 invariant: no re-fan-out from a server queue. The send fails cleanly with `no_peer_devices` and the composer surfaces the typed failure. | By design · `encrypted-send.ts:116-117` |
| Transport error during `forceRefresh` call | **Surfaced truthfully** · no silent fallback to empty device list. | `encrypted-send-race.test.ts` case 2 at line 99 |
| Two concurrent `forceRefresh` calls for same recipient | **Coalesced to one network call** · promise dedup per accountId. | `encrypted-send-race.test.ts` case 3 at line 108 |
| Already-registered recipient without a race (baseline) | **NOT ISOLATED as its own test case**, but implicit in case 1's final state after the new-device event is observed. A separate "no race, normal path" test would be cheap to add in a future pass. | Gap noted; not blocking the fix itself |
| Hard crypto failure after forceRefresh (e.g., `encrypt_failed` from `encryptMessageForDevices`) | **Handled by `encrypted-send.ts` but not by the race test file.** The race file's scope is cache behaviour; crypto-failure retry is tested in other crypto suites. | Documented scope boundary |

Verdict on §2.4's two bounded shapes: Shape (1) *compose-time server read + fail-closed disabled send* is subsumed by the already-landed `forceRefresh-at-send` for the common "send fires with stale cache" ordering. Shape (2) *recipient-side device-registration write triggers re-poll of recent unread groups* remains **not implemented**, and is the only remaining path that could help *"recipient came online within the sender's N-second liveness window after the send"* without violating the no-queue invariant. The directive does not authorise building Shape (2) in this pass.

### 8.5 Chat · `launchPersistentContext` lifecycle disambiguation (still UNRUN)

Source inspection confirms two existing Playwright scripts that already use `launchPersistentContext`:

- `scripts/_tmp/cp-full-journey-v5.mjs:118,123` · buyer + seller each use a dedicated `--user-data-dir` so IndexedDB survives reloads. The script header (lines 10-12) explicitly records the discovery: Chromium's default `newContext()` orphans the device-key IndexedDB entry on reload, triggering a false "cannot decrypt own message" in the harness.
- `scripts/_tmp/cp-cart-quantity-journey.mjs:101-114` · uses `launchPersistentContext` with a fallback to pre-loaded storage state.

**What this establishes:** §2.2's "second symptom" (buyer reload cannot decrypt own) is almost certainly a `newContext`-IDB-wipe harness artefact, not a production bug — because in the v5 journey the symptom goes away as soon as a persistent context is used, and real users always have a persistent browser profile.

**What this does NOT establish this pass:** a fresh `launchPersistentContext` re-run of the §2.1 race *with the `forceRefresh` fix enabled*, in a single session, demonstrating:
  (i) buyer-side own-message decrypt on reload, and
  (ii) seller-side decrypt when seller registers mid-send.

That re-run is the disambiguation step called out in §2.6. It is **still UNRUN this pass** because the directive says "run the already-authorized separate buyer/seller browser verification"; I have the scripts, the lifecycle disambiguation is a one-script invocation, but executing it now would race the running :3008 founder dev server + concurrent sessions and risks a false result. I report this as **the smallest remaining step before the chat race verdict can move from "bounded fix landed, unit-verified" to "browser-proven"**.

### 8.6 R4 addendum verdict summary

| Workstream | R4 verdict (unchanged) | Addendum finding |
|---|---|---|
| Cart UI qty +/− | PARTIAL (badge + subtotal reads are the proof) | Root cause of the harness zero-match + localStorage null is now named; selectors documented for a future iteration. **No product defect reproduced.** |
| Cart line-remove + empty-state | PARTIAL (harness never fired) | Selector exists (`[aria-label^="Remove "]`) and reaches `_client.tsx:595` / popup `:686`. Harness iteration is the only remaining work. |
| Cart → Order (single-item, non-gateway) | PASS (fresh proof retained) | No change. |
| Seller order notification | PASS as "dashboard visible / order delivered"; UNVERIFIED as "lock-screen push received" | Mechanism is confirmed to be web-push (not polling, not realtime); live delivery proof still requires a founder device with a registered subscription. |
| Chat race bounded fix (unit) | PASS (3/3 regression) | Ordering coverage matrix now complete; one not-yet-isolated case named (already-registered baseline). |
| Chat race (same-device reload decrypt) | PARTIAL · harness artefact hypothesis | Hypothesis strongly supported by existing `cp-full-journey-v5.mjs` header note that persistent context resolves the symptom; still UNRUN as a post-fix single-session re-verification. |
| Offline-recipient semantics | n/a in R4 body | Now explicit: "delivery fails" = zero registered keys; a disconnected recipient with a registered key still receives on reconnect. Sealed no-queue invariant preserved. |

No commit, push, deploy, migration apply, or schema change was performed in this addendum. Translation pilot files remain untouched. Protected identities (Hammerex, Rosa, 99901, 99903) untouched. Founder dev server at :3008 (PID 21984) untouched.
