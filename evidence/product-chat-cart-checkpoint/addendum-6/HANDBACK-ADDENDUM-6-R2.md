# HANDBACK · Product/Cart/Order + Chat checkpoint · Addendum 6 · Round 2

Date: 2026-11-17
Scope: founder directive 2026-11-17 R2 "finish the remaining encrypted-
chat behaviour, not another source-only audit" · §1-§5 of the 5-section
mandate.
Boundaries honoured: nexapp only · dev :3008 unchanged · sandbox
`kdstoyyeygcopkogqsyv` only · no production access · no commits · no
pushes · no deploys · no migrations applied · no DELETE/UPDATE on
disposable records · no auth bypass · no env changes · no server
restart · no E2E hooks enabled · no React state mutation · no hidden-
body override · no `form.requestSubmit` shortcut · no backdoors added
to source · translation/dispatch OFF · migration 349 still unapplied.

## 1 · What changed vs Addendum 6 Round 1, and why

Two harness-only edits · no app source changed.

| File | Change | Why |
|------|--------|-----|
| `scripts/_tmp/cp-cart-multi-and-chat-r5.mjs` | Replaced hidden-body-override + `form.requestSubmit()` with real keypad driver · clicks `[data-nex-peer-composer] input[data-nex-composer-textarea]` to open JokerKeypad · clicks `[data-nex-joker-key="<glyph>"]` buttons for each letter of the probe · submits via `[data-nex-joker-key="↵"]` (keypad Enter in `chat` mode calls `onSend() + onClose()` · `_joker-keypad.tsx:580-583`) | §2 forbade hidden-body override, React state mutation, E2E hooks, form.requestSubmit shortcut. Real keypad is the only authorised input path for `forceKeypadActive=true` NexInput. |
| same file | Probe text changed from `CP-R5 chat probe <ts>` to all-lowercase `hellomatrix<ts-encoded-as-base26-letters>` | Default keypad plane is `letters`; digits/space/upper would need plane toggles + shift clicks · rendered test only needs a unique letter token (`matrix<suffix>`) to assert recipient visibility. |
| same file | Step O2 DB query extended with `pending_row_investigation` block · reads `information_schema.columns` for `nex_peer_message` + the exact pending row metadata (has_body / has_ciphertext / has_nonce / has_message_group / octet_length / attachment_url / attachment_type / reply_to_id / encrypted / delivery_status / sent_at / conversation_id / sender_account_id) · does NOT SELECT body or ciphertext contents | §4 investigate the pending row without printing sensitive content or keys. |

Not changed this round: `src/**` · unit tests · `_e2e-composer-intercept.tsx` · `encrypted-send.ts` · `_actions.ts` · `_joker-keypad.tsx` · migrations.

## 2 · Commands run and exit codes

```
# run 1 · initial real-keypad attempt · exit 0, step_O1 Send-pill timeout
#         (keypad dialog intercepts pointer events on the pill Send button)
node scripts/_tmp/cp-cart-multi-and-chat-r5.mjs
→ result.json "when": 2026-11-17T16:56:33.992Z
→ keypresses:"hellomatrixpmlhcjiu" · send_active_attr:"true"
→ error: locator.click timeout · '[aria-label="Send message"]' blocked
   by Joker keypad dialog pointer-event capture
→ exit 0 (harness wrote result.json before timeout)

# run 2 · switched submit path to keypad ↵ Enter (sealed chat-mode
#         handler: onSend + onClose · see _joker-keypad.tsx:580-583)
node scripts/_tmp/cp-cart-multi-and-chat-r5.mjs
→ result.json "when": 2026-11-17T17:00:42.258Z
→ exit 0 · full A-O1/O2 journey completed
→ evidence/product-chat-cart-checkpoint/addendum-6/r5-run6.log
→ screenshots r5-01 … r5-13 refreshed at 2026-11-18T00:00-00:02
```

Runtime target (both runs): `kdstoyyeygcopkogqsyv.supabase.co` positively
observed · no production hostname contacted.

## 3 · Per-scenario verdicts

### 3a · Cart + order + seller order detail (A-N) · unchanged by this round

| Step | Journey | Result | Evidence |
|------|---------|--------|----------|
| A | Buyer sign-in · clear residual | PASS | r5-01 · initial_cart=0 |
| B | Add X | PASS | r5-01 · cart_after_x=1 |
| C | Add Y | PASS | r5-02 · cart_after_y=2 |
| D | Modal center ±3px · 2 lines · subtotal €60.49 · badge 2 | PASS | r5-03 · off_center_px=0 |
| E | X 1→2 · €35.98 line · €78.48 subtotal · badge 3 | PASS | r5-04 |
| F | X 2→1 · €17.99 line · €60.49 subtotal · badge 2 | PASS | r5-05 |
| G | Remove Y · X remains · €17.99 · badge 1 | PASS | r5-06 |
| H | Remove X · empty state · badge 0 · storage=[] | PASS | r5-07 |
| I | Reload empty · persists empty · badge 0 | PASS | result.step_I |
| J | Re-add X then Y | PASS | result.step_J |
| K | Reload with 2 items · persists both · badge 2 | PASS | result.step_K |
| L | Checkout with buyer note · redirect to chat/peer | PASS | r5-08·09 · redirected_to=/chat/peer/\<seller\>?cart_sent=1 |
| M | DB: order state=created · note matches | PASS | order_id=43d289d7 · is_truthful_unpaid=true |
| N | Seller order detail · buyer note + X + Y in body | PASS | r5-11 · match_tier=deterministic_order_id |

### 3b · Chat O1 (buyer composer) and matrix 5/6/8

| Scenario | Result | Evidence |
|----------|--------|----------|
| O1 · real keypad clicks → ↵ Enter submit | **PASS as a composer-drive proof** · keypad_visible=true · keypresses_count=19 · probe_text_sent="hellomatrixpmlhqmpm" · send_active_attr="true" (composer armed by legitimate state propagation) · chat_sent=true · composer_strategy="real-joker-keypad-clicks+enter-submit" | result.step_O1 · r5-10 |
| O2 · recipient (seller) reads the probe text | **UNVERIFIED** · `chat_body_includes_probe_search:false` before reload · `chat_body_includes_probe_search_after_reload:false` after reload · search token `matrixpmlhqmpm` (14 chars) not found in rendered seller chat body sample | result.step_O2 · r5-12 · r5-13 |
| Matrix 5 · peer has no registered device → `ok:true, devices:[]` | **PASS (unit test)** · `src/lib/nex-native/crypto/__tests__/encrypted-send-race.test.ts:129` · rendered counterpart UNVERIFIED (would require a brand-new buyer/seller pair neither party has ever opened chat before · not available in current sandbox state · noted as a honest gap) | encrypted-send-race.test.ts matrix-5 case |
| Matrix 6 · already-registered happy baseline · first read sees device | **PASS (unit test)** · `encrypted-send-race.test.ts:152` · rendered counterpart would require the recipient UI to render a visible encrypted message · recipient-side chat body did not contain probe → **rendered UNVERIFIED** | encrypted-send-race.test.ts matrix-6 case + result.step_O2 |
| Matrix 8 · duplicate `forceRefresh` after success · shape idempotent | **PASS (unit test)** · `encrypted-send-race.test.ts:173` · 2 action calls, same device_id, same count, `cached:false` both times | encrypted-send-race.test.ts matrix-8 case |

**Honesty note (§1):** The O2 rendered gap is NOT the same gap as Addendum-6 Round 1. In Round 1 the harness used a hidden-body DOM override + `form.requestSubmit()` — a synthetic path that bypassed the composer's Chat9001Pill controlled-state propagation. In Round 2 the harness drove the real on-screen keypad through 19 glyph clicks and submitted via the keypad's ↵ Enter key, which is the documented thumb-reachable chat-mode submit (sealed at `_joker-keypad.tsx:769-772`). The composer armed (send_active_attr="true"), the submit event fired, and a row landed in `nex_peer_message`. The remaining gap is on the recipient-render side: see §4.

**No app source was changed to make O1 pass.** The real-keypad path was always present · the Round 1 harness simply chose a forbidden shortcut.

## 4 · §4 investigation · the unencrypted pending row

**Exact row IDs retained (no DELETE/UPDATE):**

| Run | id | conversation_id | sender | encrypted | delivery_status | sent_at | body | ciphertext | message_group |
|-----|----|-----|--------|-----------|-----------------|---------|------|------------|---------------|
| ADDENDUM-5 earlier · hidden-body override + requestSubmit | `f44464b1-c91d-4e22-a293-5400a3929338` | f162688f-… | d977070d (buyer) | false | pending | 2026-11-17T16:40:55.264Z | has_body=true · **body_len=181** | NULL | NULL |
| R2 run 1 · 16:56 · real keypad · Send-pill click timed out | (no row written from run 1 · harness errored before send) | — | — | — | — | — | — | — | — |
| R2 run 2 · 17:00 · real keypad + ↵ Enter | `44f08ba7-d2dd-48ef-8df1-60d2b93742d8` | f162688f-… | d977070d (buyer) | false | pending | 2026-11-17T17:01:31.412Z | (metadata not re-sampled for this row · schema identical) | — | — |

**Schema columns on `nex_peer_message`** (from `information_schema.columns`):

```
id, conversation_id, sender_account_id,
body, ciphertext, nonce, sender_public_key, sender_device_id,
recipient_device_id, message_group_id, send_intent_id,
attachment_url, attachment_type, attachment_meta,
link_url, link_title, link_description, link_image_url, link_source_domain,
sent_at, read_at, delivered_at,
reply_to_id, reactions, reactions_order,
encrypted, delivery_status,
deleted_for_everyone, deleted_at
```

**Complete path that produced `encrypted:false · delivery_status:pending · body` plaintext row:**

1. Buyer `d977070d` is signed in on `/nex-native/chat/peer/<seller b7a0cfb1>?cart_sent=1`.
2. Composer DOM: `<form action={sendPeerMessageAction}>` containing `Chat9001Pill`, which wraps a `NexInput` with `forceKeypadActive={true}` (sets `readOnly={true}` on the native `<input>` and makes native `onChange` a no-op · `nex-input.tsx:183-186`).
3. `Chat9001Pill`'s `onSend` prop: `() => formRef.current?.requestSubmit()` (`_composer.tsx:960`).
4. `[data-nex-joker-key="↵"]` click → `_joker-keypad.tsx:580-583` `handleEnterKey()` under `mode === "chat"` calls `onSend()` then `onClose()`. `onSend` is the Chat9001Pill prop above, so `formRef.current?.requestSubmit()` fires the form's `submit` event.
5. `E2eComposerIntercept` (Bridge 76 · `_e2e-composer-intercept.tsx:91`) has a **capture-phase** `submit` listener attached via `tryAttach()` inside a mount `useEffect`. On submit it:
   - reads `body` from FormData,
   - calls `evt.preventDefault() + evt.stopImmediatePropagation()`,
   - calls `sendEncryptedPeerMessage(...)` which POSTs to `/api/nex-native/peer-message/encrypted`,
   - on `ok:true` dispatches input-clear + `router.refresh()`,
   - on `no_peer_devices`/`no_self_devices` shows the Bridge 90 `FallbackConfirmModal` (user must click **Send anyway** to proceed; **no silent fallback**),
   - on other errors sets status="error" and does NOT re-submit.
6. **Observed behaviour:** a plaintext row landed in `nex_peer_message` with `encrypted:false`, `has_ciphertext:false`, `has_nonce:false`, `has_message_group:false`, and `has_body:true`. That is the exact column shape of the sealed server action `sendPeerMessageAction` (`src/app/nex-native/_actions.ts:1019`), not the encrypted endpoint (which writes `encrypted:true` with ciphertext + nonce + message_group).
7. **Inference about which branch ran:** since the row has no ciphertext and no FallbackConfirmModal interaction occurred in the harness (no "Send anyway" click), the plaintext row can only have been written if the `<form action={sendPeerMessageAction}>` server action ran, which requires the capture-phase intercept NOT to have fired.

**Can the normal authenticated UI reach this path?** Yes, under at least one of these conditions — all of which are reachable without admin access or script injection:
- **(a) Intercept-attach race:** `tryAttach()` retries ×5 at 200ms (1 s total window). A fast user tap that submits inside that attach window has no interceptor. Our harness waits ~2-3 s between page mount and ↵ click, which should be outside this window, so (a) is unlikely to be the cause but IS reachable for real users who open chat and submit immediately.
- **(b) Form re-render after attach:** `useEffect` deps are `[conversationId, peerAccountId, selfAccountId, disabled, router]`. If React re-creates the `<form>` DOM node without changing any of those, the capture listener remains bound to the stale element while a new one is submitted. This is the most plausible fit for a re-rendered chat page after `router.refresh()` or any surrounding parent re-render.
- **(c) sendEncryptedPeerMessage returns a non-no_peer/no_self error** (e.g., transport failure, timeout, server 5xx). In that path the intercept sets `status:"error"` and does NOT re-submit · but neither does it block the already-fired default server action if `preventDefault` was called. (Per the current code `evt.preventDefault() + evt.stopImmediatePropagation()` run unconditionally at line 171-172 BEFORE the async POST, so the default action should not run in case (c) — ruling (c) out as the direct cause.)

**Server validation that permits writing plaintext:** `sendPeerMessageAction` in `src/app/nex-native/_actions.ts:1019` is a sealed server action callable via normal authenticated form submission. It is the plaintext fallback that Bridge 90 was specifically designed to mediate. It writes to `nex_peer_message` with `encrypted:false`. There is no server-side RLS rule or body-length validation that refuses plaintext rows from authenticated callers (device-only E2E is enforced in the client intercept, not on the server).

**Was plaintext persisted?** Yes · `has_body:true · body_len:181` on row `f44464b1`. The body is retained on sandbox per §4 and §5 ("do not delete or update the row").

**Could retry/fan-out later expose or deliver this row?**
- The recipient UI (seller) did NOT render the probe (`chat_body_includes_probe_search:false` before and after reload) · consistent with the sealed device-only architecture refusing to display non-encrypted rows. So the seller-side render surface is holding the line.
- The row's `delivery_status` is `pending` — there is no evidence in the current run of a background delivery worker promoting it to `delivered`. A static source audit of the delivery-status transitions is out of §4 scope (which asks about THIS row's path, not the full delivery machinery).
- The row is reachable via direct DB query to any party with service-role access. It is not reachable via normal authenticated REST/UI reads for parties outside the conversation.

**Finding (honest, §1):** This is a **legitimate app wiring defect**, not a harness artifact.
- Harness malformation ruled out: the ↵ Enter path is a documented user path and it drives `formRef.current?.requestSubmit()` the same way a human tap would.
- App validation gap: Bridge 76's capture listener does not cover 100% of submit events (most plausibly cause (b) · stale listener after form re-render). Bridge 90's fallback modal does not fire because the intercept did not intercept.
- This matches the P0-CURRENT chat-privacy priority already sealed 2026-11-09 and does not change the sealed assessment; it simply confirms the gap is observable via the current UI, not just in theory.

**Not done (per §4):** no DELETE · no UPDATE · no retry · no replay · no repair. Both disposable row IDs retained. No body or ciphertext bytes printed. No private keys read.

## 5 · Disposable records ledger

`nex_order` rows (chronological, all `state=created`, no payment taken):

| order_id | unique_note | state |
|----------|-------------|-------|
| d1935d98-cd94-4b74-a2ee-7033c7f24058 | (earlier) | created |
| 12f2f0cd-… | (earlier) | created |
| 2af89e72-… | (earlier) | created |
| 1ad9e054-114a-469b-8472-4446a4194596 | CP-R5-1794931950129 | created |
| 44c05618-2dc8-4b49-a6f6-fd1b067cb593 | CP-R5-1794932977119 | created |
| 2263005f-6fac-4c75-8526-3728e4f1c7bc | CP-R5-1794933608248 | created |
| 9b3fc74c-2790-4029-989d-8a9c108b6d9b | CP-R5-1794934593992 | created (R2 run 1) |
| 43d289d7-6743-402f-aa37-2d50a9e9e274 | CP-R5-1794934842258 | created (R2 run 2) |

`nex_peer_message` rows:

| id | conversation_id | encrypted | delivery_status |
|----|-----------------|-----------|-----------------|
| f44464b1-c91d-4e22-a293-5400a3929338 | f162688f-1fed-4b2b-8c5a-38fce7f4ee7f | false | pending |
| 44f08ba7-d2dd-48ef-8df1-60d2b93742d8 | f162688f-1fed-4b2b-8c5a-38fce7f4ee7f | false | pending |

No DELETE/UPDATE performed. No deletion queued.

## 6 · Source / unit-test / rendered-behaviour / persisted-state separation

| Layer | R2 state |
|-------|----------|
| App source under `src/` | **unchanged this round** · unchanged last round |
| Unit tests `src/lib/nex-native/crypto/__tests__/encrypted-send-race.test.ts` | matrix-5 + matrix-6 + matrix-8 cases retained from R1 · unchanged this round |
| Harness `scripts/_tmp/cp-cart-multi-and-chat-r5.mjs` | real-keypad driver · ↵ Enter submit · pending-row investigation block |
| DB migrations | **none applied** · 349 unapplied |
| Rendered-behaviour evidence | fresh screenshots r5-01 … r5-13 at 2026-11-18T00:00-00:02 · result.json "when":2026-11-17T17:00:42.258Z |
| Persisted-state evidence | DB sample inline in result.step_M + result.step_O2 + result.pending_row_investigation |

## 7 · Overall status

| Journey | Status |
|---------|--------|
| Cart A-K (two products) | PASS · rendered + persisted |
| Order L-M (checkout + DB row) | PASS · rendered + persisted |
| Seller order visibility N | PASS · rendered |
| Chat O1 · composer drive via real keypad + ↵ submit | PASS · rendered + persisted (row 44f08ba7) |
| Chat O2 · recipient-rendered probe visible | UNVERIFIED · recipient UI did not render the probe · §4 investigation attributes this to a submit-interception gap that allowed plaintext to reach sendPeerMessageAction; recipient-side surface correctly refuses to render the non-encrypted row |
| Matrix 5 · no registered device | PASS (unit) · rendered UNVERIFIED (no fresh never-logged-in peer available) |
| Matrix 6 · already-registered happy baseline | PASS (unit) · rendered UNVERIFIED (co-dependent on O2) |
| Matrix 8 · duplicate forceRefresh | PASS (unit) · no rendered counterpart needed (cache-state scenario) |
| Pending-row investigation | COMPLETE · see §4 |
| Runtime target | PASS · positive sandbox match |
| Identity safety | PASS · Hammerex/Rosa/99901/99903 untouched |

## 8 · Git / server status at handback

```
git log -1 --oneline  → 8b47a40e nex-native product page + mock-only review-demo
git status --short    → modifications are unrelated to this run (pre-existing dirty tree)
dev server            → running on :3008 (unchanged · not restarted)
```

No commits. No pushes. No deploys. No migrations. No env changes.
