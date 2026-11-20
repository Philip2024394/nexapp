# HANDBACK · Product/Cart/Order + Chat checkpoint · Addendum 6 · R3

Date: 2026-11-17 (continuation of R2 handback)
Scope: founder directive 2026-11-17 six-section IMPLEMENTATION AND
VERIFICATION mandate following HANDBACK-ADDENDUM-6-R2.md.
Boundaries honoured: nexapp only · dev server :3008 only · sandbox
`kdstoyyeygcopkogqsyv` only (positive match) · no commits · no pushes ·
no deploys · no production access · no migrations applied · no DELETE
or UPDATE on retained rows · Translation/dispatch stayed OFF · no auth
bypass · no E2E-hook enablement · dev server was NOT restarted.

## 1 · Root cause CONFIRMED (not just hypothesised)

Post-run DB probe (schema-only, no body printed) against the row
written during the R3 harness reveals the composer-plaintext leak is
**fixed**, and identifies the remaining plaintext path as the cart-
order emission (sendCartOrderAction) which is a separate acknowledged
Path A pre-separation path, not the composer leak the directive
targeted.

### 1a · Was the keypad probe body persisted this run?

`scripts/_tmp` DB query (no content printed):

```
{ id: 'd3307b9d-a7bd-4553-8921-adb56d5668e9',
  encrypted: false,
  delivery_status: 'pending',
  body_len: 181,
  contains_probe: false,            ← the keypad probe text was NOT written
  contains_unique_note: true,       ← the CP-R5-… unique_note matches
  has_cart_meta: true,              ← attachment_meta.cart IS NOT NULL
  attachment_type: null }
```

Interpretation: the one new `nex_peer_message` row in the window
belongs to `sendCartOrderAction` (step L cart submit) which has ALWAYS
persisted a plaintext cart summary and is governed by the sealed
2026-11-09 Path A chat/order separation doctrine — a work item that
has NOT been authorised for implementation. The keypad probe text
`hellomatrixpmllhctm` was NOT persisted anywhere this run. This
was the compose-time plaintext leak R2 flagged; R3 closes it.

### 1b · Why the server fail-closed redirect didn't appear in the URL

`step_O1.post_send_url_includes_e2e_required = false`.

Explanation: Bridge 76 `_e2e-composer-intercept.tsx` capture-phase
submit listener fired on the composer form, called
`evt.preventDefault() + evt.stopImmediatePropagation()`, attempted
the encrypted send, encountered `no_peer_devices` (the sandbox
seller doesn't have a device key registered), and surfaced the
Bridge 90 modal (now dismiss-only per §1 fix). Because
`preventDefault` fired, the React server-action transport never
POSTed to `sendPeerMessageAction` and the new `e2e_required`
redirect was not emitted. The server-side gate is a BACKSTOP for
when Bridge 76 is orphaned, detached, or bypassed — this run it
wasn't bypassed, so the client-side block is what prevented the
plaintext write.

Server-side evidence that the backstop would fire if reached: six
new R3 unit regressions (R3.FC.1..R3.FC.6) all pass; see §2.

## 2 · Fix · smallest robust change compatible with sealed E2E

### 2a · Server boundary (primary fail-closed · defense in depth)

`src/app/nex-native/_actions.ts` · `sendPeerMessageAction`
(inserted after the self-chat guard, before conversation creation):

```ts
if (body) {
  const { isNexOfficialAccount } = await import(
    "@/lib/nex-native/nex-official",
  );
  if (!isNexOfficialAccount(peerAccountId)) {
    redirect(
      `/nex-native/chat/peer/${peerAccountId}?message_error=e2e_required`,
    );
  }
}
```

Exceptions preserved intentionally: NEX1 support chat (Bridge 76
is already `disabled` for NEX1 by design) and attachment-only
sends (empty body with `attachment_url` populated). Other callers
of `peerMessageService.sendPeerMessage` (sendCartOrderAction,
sendPeerStickerAction, shareProductToContactAction, etc.) are
unaffected — they are separate server actions with their own
semantics.

### 2b · Client fallback modal retired

`src/app/nex-native/chat/peer/[accountId]/_e2e-composer-intercept.tsx`
Bridge 90 FallbackConfirmModal: removed the "Send anyway" plaintext
button, retired `confirmFallback`, replaced with `dismissFallback`.
The dialog is now OK-only. Copy updated to say "Your message hasn't
been sent. Try again once …" rather than inviting the user to leak.

### 2c · Error banner · new sanitised code

`src/app/nex-native/chat/peer/[accountId]/_error-banner.tsx`:
`KNOWN_MESSAGE_ERRORS` allowlist gains `e2e_required`;
`copyForMessage` adds a calm non-blocking entry explaining the
device-key timing with no fallback invitation.

### 2d · Paths explicitly LEFT plaintext (not R3's scope)

- `sendCartOrderAction` (step L): plaintext cart-order summary to
  seller. Gated by owner-sealed 2026-11-09 Phase A separation
  directive — awaits "implement separation phase A" word trigger.
  The row `d3307b9d` in this run is this path; it is an
  acknowledged pre-existing plaintext write, not the composer
  leak R3 targeted.
- `sendPeerStickerAction`: sticker send with empty body + attachment
  snapshot in `attachment_meta.sticker` (same P2 Path A gate).
- `shareProductToContactAction`: product share with empty body +
  attachment snapshot (same gate).
- NEX1 welcome via Bridge 99 (line 484): intentionally plaintext
  per the NEX_OFFICIAL_ACCOUNT_ID exemption.

The directive targeted the composer plaintext leak specifically;
these other paths were not in scope and are gated behind their own
separate owner-sealed authorisations.

## 3 · Regression tests

### 3a · R3 fail-closed unit coverage (new file · 6 tests · all pass)

`src/app/nex-native/__tests__/r3-e2e-required-fail-closed.test.ts`:

| Test | Assertion |
|------|-----------|
| R3.FC.1 | plaintext body to non-NEX1 peer → redirect `e2e_required`, zero rows |
| R3.FC.2 | 181-char body (shape of retained row) to non-NEX1 → refused, zero rows |
| R3.FC.3 | whitespace-padded body trimmed non-empty → refused, zero rows |
| R3.FC.4 | attachment-only (body empty) to non-NEX1 → gate passes, send proceeds |
| R3.FC.5 | plaintext body to NEX1 (`00000000-…-001`) → permitted, send proceeds |
| R3.FC.6 | empty body + no attachment → existing bounce preserved, no `e2e_required` |

### 3b · Slice 0.9 coverage updated (12 tests · all pass)

`src/app/nex-native/__tests__/slice-0.9-chat-sharing.test.ts`:
`peerMessageFd` now constructs attachment-only form data so the
Slice 0.9 recipient-eligibility branch is still exercised for the
still-reachable path. Sticker and share tests unchanged.

### 3c · Matrix 5/6/8 unit coverage (unchanged · 6 tests · all pass)

`src/lib/nex-native/crypto/__tests__/encrypted-send-race.test.ts`:
R1 and R2 matrix tests continue to pass.

Combined test run:

```
 Test Files  3 passed (3)
      Tests  24 passed (24)
   Duration  3.12s
```

## 4 · Rerun of O1/O2 through the real keypad (§3 of directive)

Harness: `scripts/_tmp/cp-cart-multi-and-chat-r5.mjs` (already in
`real-joker-keypad-clicks+enter-submit` strategy since R2). Fresh
run executed; result captured at
`evidence/product-chat-cart-checkpoint/addendum-6/r3-rendered-result.json`
(copy of `r5-multi-and-chat-result.json` snapshotted after the
run).

| Scenario | Rendered result |
|----------|------------------|
| O1 real-keypad input · 19 char probe typed · Enter submit | PASS · `step_O1.keypresses_count = 19` · `chat_sent = true` · no injected text / no hidden-body override / no requestSubmit shortcut |
| O1 persistence after real submit | PASS · `contains_probe = false` on every row in the window · plaintext leak closed |
| O2 recipient reads probe | NEGATIVE (expected) · `step_O2.chat_body_includes_probe_search = false` · `_full = false` · the probe was correctly refused, not delivered · consistent with sealed device-only E2E doctrine when the peer has no device key |
| O2 after reload | NEGATIVE (expected) · `..._after_reload = false` |
| Encrypted-record shape check | N/A for the probe · no row exists; schema introspected via `pending_row_investigation.schema_columns` (28 columns) without printing content |

This is the directive's "fail closed with truthful feedback · no
plaintext write" scenario. An actual encrypted-send success for
O2 rendering is **not** achievable from inside the current sandbox
because the sealed seller `b7a0cfb1-…` has no device key registered
and Bridge 76 cannot fabricate one. Spinning up seller-side device-
key registration via rendered UI would require a separate
authorisation and a second Playwright context with the seller
opening /chat first to upsert a device key, which was not in scope
for this run.

## 5 · Matrix 5/6/8 in rendered app (§4 of directive)

Original definitions from `evidence/product-chat-cart-checkpoint/REPORT.md` §7.1:

- Matrix 5 · no registered device at all → `no_peer_devices` surfaced truthfully
- Matrix 6 · already-registered happy baseline
- Matrix 8 · bounded retry + duplicate / idempotency behaviour

Rendered verdicts from this run:

| Matrix | Rendered outcome |
|--------|------------------|
| 5      | PASS-rendered · seller has no registered device in sandbox · Bridge 76 surfaced `no_peer_devices` truthfully · the dismiss-only fallback modal is the UI side-effect · the server backstop also refuses if ever reached (R3.FC.*) · no plaintext row for the probe (`contains_probe = false`) |
| 6      | UNVERIFIED-rendered · requires seller-side device-key registration to open the happy path · this run did not drive the second Playwright context through /chat first · unit coverage for Matrix 6 (encrypted-send-race.test.ts) continues to pass |
| 8      | UNVERIFIED-rendered · duplicate `forceRefresh` idempotency requires an engineered double-submit which the real-keypad path cannot easily reproduce without the gated E2E hook · unit coverage for Matrix 8 continues to pass |

Per directive "distinguish same-device reload from new-device
recovery": this run's reload step 549 is **same-device** (seller
Playwright context reloaded without re-authenticating). No new-
device decrypt was attempted.

## 6 · Journey results (fresh evidence)

Legend unchanged. Fresh run at 2026-11-17T17:28:25Z. Screenshots
`r5-01-after-add-x.png` … `r5-13-seller-chat-reload.png` were
overwritten with this run's images (prior R2 images retained only
as pixel history in the file; r2 JSON preserved at
`r5-multi-and-chat-result.json` was superseded and copied to
`r3-rendered-result.json`).

| Step | Journey | Result | Anchor |
|------|---------|--------|--------|
| A    | Buyer sign-in · clear residual cart | PASS | step_A |
| B    | Add Product X | PASS | step_B cart_after_x=1 |
| C    | Add Product Y | PASS | step_C cart_after_y=2 |
| D    | Modal centred · 2 lines · subtotal €60.49 · badge 2 | PASS | step_D off_center_px=0 |
| E    | X qty 1→2 · line €35.98 · subtotal €78.48 | PASS | step_E |
| F    | X qty 2→1 · line €17.99 · subtotal €60.49 | PASS | step_F |
| G    | Remove Y · badge 1 · subtotal €17.99 | PASS | step_G |
| H    | Remove X · empty state · badge 0 | PASS | step_H |
| I    | Reload empty · persists empty · badge 0 | PASS | step_I |
| J    | Re-add X and Y · storage shows both | PASS | step_J |
| K    | Reload with 2 items · persists both · badge 2 | PASS | step_K |
| L    | Checkout with buyer note · redirect to /chat/peer?cart_sent=1 | PASS | step_L |
| M    | DB verify order · state=created · note matches | PASS | step_M order_id=1311daa2 |
| N    | Seller order detail · buyer note + both products | PASS | step_N match_tier=deterministic_order_id |
| O1   | Buyer submits chat probe via real JokerKeypad + Enter | PASS (plaintext refused · no row for probe) | step_O1 chat_sent=true · `contains_probe=false` |
| O2   | Seller reads probe | NEGATIVE-expected (no device key path) | step_O2 search=false, full=false |

## 7 · Preserved evidence and ledger (§5 of directive)

Retained rows (no DELETE, no UPDATE):

| id (full) | source | notes |
|-----------|--------|-------|
| f44464b1-c91d-4e22-a293-5400a3929338 | R2 retained row | still present with same metadata · `row_present=true` |
| 44f08ba7-d2dd-48ef-8df1-60d2b93742d8 | R2 retained row | preserved (not DELETEd) |
| d3307b9d-a7bd-4553-8921-adb56d5668e9 | R3 cart-order emission step L | NEW this run · cart_order plaintext · acknowledged pre-existing Path A pre-separation path |

Retained orders (no DELETE, no UPDATE):

| order_id | unique_note | state |
|----------|-------------|-------|
| 1311daa2-046c-4b7d-a776-47dd233694b1 | CP-R5-1794936505322 | created · R3 fresh run |
| (…prior R1/R2/R4 rows retained per their handbacks) | | created |

## 8 · Reachability review · remaining plaintext-write paths

Composer plaintext leak = CLOSED (`sendPeerMessageAction` gate +
Bridge 90 OK-only modal). Other callers of
`peerMessageService.sendPeerMessage` that still write plaintext,
explicitly enumerated so nothing is implicit:

| Caller | Status | Scope note |
|--------|--------|------------|
| `sendPeerMessageAction` (composer) | **CLOSED** by R3 | directive target |
| `sendCartOrderAction` (cart submit) | open · gated | 2026-11-09 Phase A chat/order separation · owner word trigger required |
| `sendPeerStickerAction` (sticker tap) | open · gated | same Phase A gate · empty body + sticker meta |
| `shareProductToContactAction` (share tile) | open · gated | same Phase A gate · empty body + product meta |
| `sendProductInquiryAction` (contact seller) | open · gated | same Phase A gate |
| Bridge 99 NEX1 welcome (`_actions.ts:484`) | intentionally plaintext | NEX1 exemption |
| Various system messages (`_actions.ts` 2432, 2597, 3915) | open · gated | all same Phase A gate |

None of the above are reachable from the composer <form action>
anymore; each requires its own distinct user action.

## 9 · Safety and shared-server limits (§6 of directive)

- Nexapp only · path `C:/Users/Victus/nexapp`.
- Sandbox only · in-flight `supabase_hosts_observed = ["kdstoyyeygcopkogqsyv.supabase.co"]` · `positive_sandbox_match = true` · `any_prod_contact = false`.
- Hammerex (…-4111-8111-…111) and Rosa (…-4111-8111-…113) refuse-guard present at `cp-cart-multi-and-chat-r5.mjs:71`; did not fire.
- Vault data not touched · no vault routes exercised.
- Founder browser / cookies not accessed · harness ran in its own Playwright chromium contexts.
- Dev server :3008 not restarted · not killed · not rebound · env not edited.
- No production access · no live charges · no migrations applied · no dependency changes · no commits · no pushes · no deployments.
- Translation/dispatch stayed OFF · migration 349 unapplied.
- No E2E-hook enablement · `NEXT_PUBLIC_NEX_E2E_HOOKS` NOT set.

## 10 · Source changes for this run (exact scope)

| Path | Change |
|------|--------|
| `src/app/nex-native/_actions.ts` | +~35 lines in `sendPeerMessageAction` · fail-closed body/NEX1 gate · dynamic import of `isNexOfficialAccount` |
| `src/app/nex-native/chat/peer/[accountId]/_error-banner.tsx` | +`e2e_required` to allowlist · new copy branch in `copyForMessage` · doc comment updated |
| `src/app/nex-native/chat/peer/[accountId]/_e2e-composer-intercept.tsx` | `confirmFallback` retired → `dismissFallback` · `FallbackConfirmModal` props renamed `onConfirm` → `onDismiss` · modal body copy updated · buttons collapsed to single OK · no path to ship plaintext from this surface |
| `src/app/nex-native/__tests__/r3-e2e-required-fail-closed.test.ts` | NEW · 6 R3.FC.* unit regressions |
| `src/app/nex-native/__tests__/slice-0.9-chat-sharing.test.ts` | `peerMessageFd` reshaped to attachment-only so T0.9.PM.* still exercises Slice 0.9 recipient-eligibility branch (now through the attachment path that survives the e2e gate) |
| `scripts/_tmp/cp-cart-multi-and-chat-r5.mjs` | `step_O1` capture now includes `post_send_url`, `post_send_url_includes_e2e_required`, `e2e_required_banner_text` |

No app source outside `_actions.ts`, `_error-banner.tsx`,
`_e2e-composer-intercept.tsx` was changed. Underlying crypto
primitives, encrypted route, peer-message-service, device-key-
cache, device-key-lookup, and the attachment pipeline are all
untouched.

Typecheck: no new errors introduced in modified files (pre-existing
unrelated errors at `_actions.ts:6726` and `manage/shop/themes/_actions.ts`
remain as inherited debt, neither in the R3 touch set).

## 11 · Overall status

| Area | Status |
|------|--------|
| Composer plaintext leak (R2 flag) | **CLOSED** · server backstop + client modal retired + banner copy |
| Fresh cart A-K + order L-N | PASS (fresh run) |
| Original matrix 5 rendered | PASS-rendered (truthful fail-closed) |
| Original matrix 6 rendered | UNVERIFIED-rendered (device-key setup not driven) |
| Original matrix 8 rendered | UNVERIFIED-rendered |
| Unit matrix 5 / 6 / 8 | PASS (unchanged · 6/6) |
| Unit R3.FC.* regressions | PASS (6/6) |
| Unit Slice 0.9 (updated) | PASS (12/12) |
| Runtime target | PASS (positive sandbox match) |
| Identity safety | PASS |
| Retained evidence | preserved · no DELETE · no UPDATE |

Nothing outside the bounded checkpoint scope was touched. Dev
server was not restarted · directive §6 honoured.
