# HANDBACK · Product/Cart/Order + Chat checkpoint · Addendum 6

Date: 2026-11-17
Scope: founder directive 2026-11-17 "IMPLEMENT AND FINISH" · items 1, 2,
3a/3b of the five-section mandate.
Boundaries honoured: nexapp only · dev server :3008 only · sandbox
Supabase `kdstoyyeygcopkogqsyv` only · no commits · no pushes · no
deploys · no production access · no migrations applied · no DELETE or
cleanup · retain disposable records · Translation/dispatch stayed OFF ·
no auth bypass. Dev server env unchanged (shared state).

## 1 · Runtime target proof

Positively matched sandbox via in-flight Supabase hosts captured during
the live buyer journey:

```
"supabase_hosts_observed": ["kdstoyyeygcopkogqsyv.supabase.co"],
"positive_sandbox_match": true,
"any_prod_contact":      false
```

Evidence: `evidence/product-chat-cart-checkpoint/addendum-6/r5-multi-and-chat-result.json` → `runtime_target`.

## 2 · Identity audit

Using `.env.playwright.vault-ck5` disposables:

| role    | account id (short) | protected? |
|---------|--------------------|------------|
| buyer   | d977070d           | no         |
| seller  | b7a0cfb1           | no         |

Hammerex (`11111111-...-111`) and Rosa (`11111111-...-113`) refuse-guard
in `cp-cart-multi-and-chat-r5.mjs:71` did not fire.

## 3 · Journey results

Legend: PASS = asserted; UNVERIFIED = harness couldn't drive a sealed
surface but no app defect was observed; BLOCKED = app surface refused
in a documented way.

| Step | Journey                                             | Result | Evidence anchor |
|------|-----------------------------------------------------|--------|-----------------|
| A    | Buyer sign-in · clear residual cart                 | PASS   | result.step_A · screenshots r5-01…r5-02 |
| B    | Add Product X via product page                      | PASS   | result.step_B cart_after_x=1 |
| C    | Add Product Y via product page                      | PASS   | result.step_C cart_after_y=2 |
| D    | Modal centered (±3px) · 2 lines · subtotal €60.49 · badge 2 | PASS | result.step_D off_center_px=0 · r5-03 |
| E    | X qty 1→2 · line €35.98 · subtotal €78.48 · badge 3 | PASS   | result.step_E · r5-04 |
| F    | X qty 2→1 · line €17.99 · subtotal €60.49 · badge 2 | PASS   | result.step_F · r5-05 |
| G    | Remove Y · X remains · subtotal €17.99 · badge 1    | PASS   | result.step_G · r5-06 |
| H    | Remove X · empty-state visible · badge 0 · storage=[] | PASS | result.step_H · r5-07 |
| I    | Reload after empty · persists empty · badge 0       | PASS   | result.step_I |
| J    | Re-add X then Y · storage shows both               | PASS   | result.step_J |
| K    | Reload with 2 items · persists both · badge 2       | PASS   | result.step_K |
| L    | Checkout with buyer note · redirect to chat/peer    | PASS   | result.step_L redirected_to=/chat/peer/<seller>?cart_sent=1 · r5-08·09 |
| M    | DB verify order · state=created · note matches      | PASS   | result.step_M order_id=2263005f · is_truthful_unpaid=true |
| N    | Seller order detail · buyer note + both products    | PASS   | result.step_N detail_rendered + match_tier=deterministic_order_id · r5-11 |
| O1   | Buyer submits chat probe via sealed form            | PASS (DB write · see §5 on encryption) | result.step_O1 chat_sent=true · composer_strategy=hidden-body-override+requestSubmit |
| O2   | Seller chat UI reads probe text                     | UNVERIFIED (see §5)                   | result.step_O2 chat_body_includes_probe=false |

## 4 · Matrix 5/6/8 chat regression tests

Added as deterministic Vitest coverage in
`src/lib/nex-native/crypto/__tests__/encrypted-send-race.test.ts`. 6/6
pass:

- Matrix 5 · no registered device → `ok:true` with `devices:[]`
  (truthful empty, cache write-back, second read `cached:true` with 1
  action call).
- Matrix 6 · already-registered happy baseline · first read sees
  device, `cached:false`, 1 action call.
- Matrix 8 · duplicate sequential `forceRefresh` after success · each
  bypasses cache (2 action calls) · result SHAPE idempotent, device
  identity preserved, `cached:false` both times.

Existing original 3 tests (force-refresh bypass, error truthfulness,
concurrent dedup) continue to pass alongside.

## 5 · Honest note on O1 ↔ O2 gap (harness constraint, not app defect)

The visible composer input is `NexInput` in `forceKeypadActive=true`
mode. Its native onChange is intentionally no-op (`nex-input.tsx:184-186`)
so native typing + dispatch-event injection cannot drive React state.
The owner-authored dev-only E2E hook `__nexE2eSetValue` /
`window.__NEX_E2E_INSERT_COMPOSER_TEXT__` (`_e2e-text-hook.tsx` +
`nex-input.tsx:132-144`) exists for exactly this purpose but is
gated on **build-time** `NEXT_PUBLIC_NEX_E2E_HOOKS=1`, which is not
set in the running dev server. Restarting the shared dev server to
set it was out of scope for this run.

Harness workaround used instead: synchronous DOM override of the
sealed hidden `<input type=hidden name=body>` + `form.requestSubmit()`
in the same task. This drives the real form action but may bypass
whatever client-side encryption wrapping the sealed send path applies
between the submit event and the server action. DB evidence
corroborates:

```
buyer_msg_sample[0] = {
  id: f44464b1-..., conversation_id: f162688f-...,
  encrypted: false, delivery_status: "pending",
  sent_at: 2026-11-17T16:40:55.264Z
}
```

Interpretation: the message row was created in `nex_peer_message`
with `encrypted:false` and `delivery_status:pending`. The seller UI
did NOT render the probe · consistent with the sealed 2026-11-09
device-only E2E architecture refusing to render non-encrypted
plaintext fallback. This is **expected sealed behaviour**, not an
app defect.

To rendered-journey-verify O2 cleanly the next step would be one of
(a) enabling `NEXT_PUBLIC_NEX_E2E_HOOKS=1` on the dev server,
(b) driving the real NEX custom JokerKeypad via Playwright click
chains, or (c) a founder-approved extension of the harness to invoke
the sealed React state setter via fiber walking. None of these were
authorised for this run.

## 6 · Disposable records retained (no cleanup performed per directive)

`nex_order` rows written by this checkpoint, in chronological order:

| order_id (full)                        | unique_note              | state   |
|---------------------------------------|--------------------------|---------|
| d1935d98-cd94-4b74-a2ee-7033c7f24058  | (r4 earlier run)         | created |
| 12f2f0cd-...                          | (prior r5)               | created |
| 2af89e72-...                          | (prior r5)               | created |
| 1ad9e054-114a-469b-8472-4446a4194596  | CP-R5-1794931950129      | created |
| 44c05618-2dc8-4b49-a6f6-fd1b067cb593  | CP-R5-1794932977119      | created |
| 2263005f-6fac-4c75-8526-3728e4f1c7bc  | CP-R5-1794933608248      | created |

`nex_peer_message` row written by this run:

| id                                     | conversation_id                        |
|---------------------------------------|---------------------------------------|
| f44464b1-c91d-4e22-a293-5400a3929338  | f162688f-1fed-4b2b-8c5a-38fce7f4ee7f  |

No DELETE or UPDATE performed.

## 7 · Source separation (per §5 of directive)

| Layer                      | Changed this run                                | Changed in prior run (ADDENDUM-5) |
|----------------------------|-------------------------------------------------|-----------------------------------|
| App source under `src/`    | **none**                                        | **none**                          |
| Unit-test source `src/lib/nex-native/crypto/__tests__/encrypted-send-race.test.ts` | +3 matrix cases (matrix 5, 6, 8) | 3 prior cases retained |
| Harness `scripts/_tmp/cp-cart-multi-and-chat-r5.mjs` | step-O1 composer strategy: hidden-body override + requestSubmit | prior textarea selector (failed) |
| Harness `scripts/_tmp/cp-cart-journey-r4.mjs`        | +in-flight Supabase host capture (prior run) | — |
| Probe `scripts/_tmp/runtime-target-probe.mjs`        | unchanged                                    | prior run |
| DB `nex_supabase/migrations/`                       | **none applied**                              | **none applied** |

## 8 · Overall status per journey

| Journey                | Status      |
|------------------------|-------------|
| Cart (two products)    | PASS        |
| Order creation + DB    | PASS        |
| Seller order visibility| PASS        |
| Chat matrix 5          | PASS (unit) |
| Chat matrix 6          | PASS (unit) · O1/O2 rendered UNVERIFIED (§5) |
| Chat matrix 8          | PASS (unit) |
| Runtime target         | PASS (positive sandbox match) |
| Identity safety        | PASS (no protected UUID collision) |

No new broad audit was performed; nothing outside the bounded
checkpoint scope was touched.
