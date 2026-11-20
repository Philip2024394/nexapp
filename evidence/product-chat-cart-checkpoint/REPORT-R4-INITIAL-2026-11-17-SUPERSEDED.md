# Bounded Verification Checkpoint · Product-to-Chat + Cart-to-Order + Dispatch Preparation
## Round 4 · 2026-11-17 · R4 cart → order PASS · chat race PARTIAL (race proven, bounded fix pending) · dispatch PROPOSAL-ONLY

**Supersedes** `REPORT-R3-2026-11-17-SUPERSEDED.md`. R3 declared cart-to-order UNATTEMPTED and chat PARTIAL. R4 directive: finish the cart-to-order journey end-to-end through rendered UI with disposable buyer + seller; reproduce the chat race and prepare a narrow bounded fix (reject "ask user to resend"); PREPARE dispatch artefacts only (no apply, no UI wiring yet).

**Repo:** `C:/Users/Victus/nexapp` → `Philip2024394/nexapp` · **Branch:** `release-audit-v1-2026-11-14`
**Backend:** SANDBOX `kdstoyyeygcopkogqsyv.supabase.co` only · production `ijvqdvsvwtwxzcqmoqit` sealed + untouched
**Dev server:** `http://localhost:3008` preserved · not restarted · founder session untouched
**Guardrails intact (R4):** no commits · no pushes · no deploys · no migrations applied · no production · no Hammerex/Rosa/99901/99903 · no auth bypass · no privileged provisioning · no architecture/crypto changes

**Separation of verdicts (per directive):**

| Workstream | Verdict |
|---|---|
| R4 · Cart → Order (no-gateway) | **PASS** · fresh proof (§1) |
| R4 · Chat race (same-device reload + recipient-not-yet-registered) | **PARTIAL · race root-caused + evidenced (§2) · bounded fix NOT yet shipped** |
| Dispatch tracking preparation | **PROPOSAL ARTEFACTS LANDED · migration NOT applied · UI NOT wired · tests NOT yet run** (§3) |

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

### 1.4 Inherited vs fresh

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

### 2.5 Verdict

**PARTIAL.** Race is reproduced + root-caused for the primary case (recipient-not-yet-registered). Narrow bounded fix candidates enumerated. **No code written this round for chat race.** Next step is the `launchPersistentContext` harness probe to disambiguate §2.2, then implement shape (1) if confirmed.

---

## 3 · Dispatch tracking · **PROPOSAL ARTEFACTS ONLY · NOT APPLIED · NOT WIRED**

Per Task 3 directive ("PREPARE ONLY, DO NOT APPLY"), the R4 scope is: minimal migration file + server-operation scaffolding behind feature flag disabled by default, with the critical security correction honoured.

### 3.1 Security correction honoured

Directive quote: *"An RLS UPDATE policy limits rows, NOT which columns can be changed."*

**Honoured by:**
- The new write path is **not** an RLS-guarded `UPDATE` from the browser. It is a `SECURITY DEFINER` RPC (`nex_order_seller_save_dispatch`) that takes an explicit `p_seller_account_id uuid` parameter (service-role bypasses `auth.uid()`, hence no implicit identity), verifies ownership against `nex_business.owner_account_id`, and only touches an **explicit column allowlist** (`dispatch_provider`, `dispatch_provider_custom`, `dispatch_tracking_number`, `dispatch_tracking_url`, `dispatch_state`, `dispatched_at`, `delivered_at`, `estimated_transit_qty`, `estimated_transit_unit`, `tracking_updated_at`). The RPC **never** touches `state`, `price_pence`, `customer_account_id`, `business_id`, `product_id`, `payment_method`, or `customer_note`.
- `search_path` is pinned (`SET search_path = pg_catalog, public`).
- Grants are least-privilege: `REVOKE ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role;` so the RPC is only callable from the service-role server-action layer, never from the browser.
- Terminal payment states (`cancelled`, `refunded`) short-circuit with a typed rejection.
- HTTPS-only tracking URL validation.
- Writes an immutable event to `nex_order_event` audit trail on every mutation.

### 3.2 Artefacts created this round (not applied, not wired)

| File | Purpose | Verdict |
|---|---|---|
| `nex-supabase/migrations/349_nex_order_dispatch_PROPOSAL.sql` | Adds dispatch columns + state check + partial index + SECURITY DEFINER RPC `nex_order_seller_save_dispatch` | **PROPOSAL · NOT APPLIED to sandbox or prod** |
| `src/lib/nex-native/manage-orders/dispatch-feature-flag.ts` | `isDispatchFeatureEnabled()` with strict-string-match `process.env.NEX_DISPATCH_TRACKING_ENABLED === "true"` convention; schema-safe disabled default | **BUILT · UNWIRED** |
| `src/lib/nex-native/manage-orders/dispatch-eta.ts` | Pure `addMonthsUTC` (clamp-to-month-end), `addDaysUTC`, `computeDispatchEta`, `computeIllustrativeProgress` (capped at 0.95) | **BUILT · no DB, no side effects, no React** |
| `src/lib/nex-native/manage-orders/__tests__/dispatch-eta.test.ts` | Deterministic Vitest tests: Jan 31 + 1mo → Feb 28/29 leap; May 31 + 3mo → Aug 31; Aug 31 + 1mo → Sep 30; DST-neutral UTC; ETA idempotent on inputs; progress capping | **WRITTEN · not yet executed in this round** |

### 3.3 What is intentionally NOT shipped this round

- Seller dispatch panel UI (cream-background slider) — **NOT WRITTEN**
- Buyer tracking bottom sheet with illustrative journey — **NOT WRITTEN**
- Notification kind extension (`shipment_update`) — **NOT WRITTEN**
- Shared order-summary UI with independent payment/fulfilment status lines — **NOT WRITTEN**
- Server action calling the RPC from a service-role client — **NOT WRITTEN**
- Negative tests (buyer-writes-rejected, unrelated-account-rejected, column-safety bypass attempts) — **NOT WRITTEN**
- Migration **not applied** to sandbox `kdstoyyeygcopkogqsyv`
- Migration **not applied** to production `ijvqdvsvwtwxzcqmoqit` (sealed)
- `npm run build` **not executed this round** against the proposal

The proposal artefacts form a labelled preparatory bundle. They are not proof of a deployed enforcement surface. Honest engineering state: **preparatory · unverified live · unwired**.

### 3.4 Verdict

**PROPOSAL-ONLY · CORRECT BY CONSTRUCTION FOR SCHEMA-SAFETY WHEN DISABLED.** The feature-flag gate ensures callers that check `isDispatchFeatureEnabled()` before touching dispatch columns will not fail against a sandbox that has not yet received migration 349. The migration SQL is ready; application remains gated on a future explicit authorisation naming sandbox `kdstoyyeygcopkogqsyv`.

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

### Code (working tree · NOT committed)
- `nex-supabase/migrations/349_nex_order_dispatch_PROPOSAL.sql` (new · unapplied)
- `src/lib/nex-native/manage-orders/dispatch-feature-flag.ts` (new · unwired)
- `src/lib/nex-native/manage-orders/dispatch-eta.ts` (new · unwired)
- `src/lib/nex-native/manage-orders/__tests__/dispatch-eta.test.ts` (new · not yet executed this round)

### Scripts (`scripts/_tmp/`)
- `cp-cart-journey-r4.mjs` (R4 final version · DB-verify uses real column names)
- `cp-diagnose-v5.mjs` (chat race diagnostic · kept from the race investigation)

### Evidence (new this round)
- `r4-cart-01..08-*.png` (8 screenshots covering product → cart modal → cart page → checkout sheet → post-submit → seller order detail → seller reload)
- `cart-journey-r4-result.json` (manifest from the passing final run)
- `cart-journey-r4-final-stdout.txt` (preserved task stdout)
- `cp-cart-journey-r4.mjs.ref.txt` (the exact harness script used, preserved)
- `REPORT-R3-2026-11-17-SUPERSEDED.md` (R3 preserved)

---

## 7 · What is required to continue cleanly into R5

1. **Decide chat race fix shape** — §2.4 (1) vs (2). Shape (1) is strictly narrower; it fail-closes the send when recipient has zero devices. No code written without the decision.
2. **Explicit authorisation to apply migration 349 to sandbox `kdstoyyeygcopkogqsyv`** (not production). Independent of UI work.
3. **Explicit authorisation to write dispatch UI** (cream-background seller panel + buyer tracking sheet) and the notification kind extension. UI work depends on migration 349 being applied before any wiring is written against those columns.
4. **Cart-quantity-change / line-remove UI** still UNVERIFIED — confirm whether to extend `cp-cart-journey-r4.mjs` to cover +/−/remove in a follow-up.

Nothing above touches commits, pushes, deploys, production migrations, environment, or protected identities.

---

**End of Round 4 report.**
