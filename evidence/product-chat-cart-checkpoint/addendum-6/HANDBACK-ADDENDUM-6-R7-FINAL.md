# HANDBACK · Addendum 6 · R7 · Final results for bounded directive

**Date:** 2026-11-17
**Repo root:** `C:/Users/Victus/nexapp` (nexapp, not trades)
**Remote:** `https://github.com/Philip2024394/nexapp.git`
**HEAD:** `8b47a40e456b74a6a49e86d4be0dbf22f2621a4b` (unchanged · no commits)
**Working tree:** dirty (unrelated evidence PNGs from pre-session work, see §8)
**Sandbox target verified:** `DATABASE_URL` and `NEXT_PUBLIC_NEX_SUPABASE_URL` both point at `kdstoyyeygcopkogqsyv` · production `ijvqdvsvwtwxzcqmoqit` untouched
**No commits / pushes / deploys / migration 349 / translation / dispatch changes applied.**

Preserved per directive: Hammerex, Rosa, 99901, 99903, Vault data, authenticated encryption, founder cookies/session, unrelated work, shared `:3008` server. Retained rows `f44464b1-c91d-4e22-a293-5400a3929338`, `44f08ba7-…` (ID prefix only in evidence; full ID resolution not needed because row was not touched), and `d3307b9d-a7bd-4553-8921-adb56d5668e9` left untouched. No replay / repair / cleanup UPDATE/DELETE on retained records. No device-key prune, no key reset/revocation/replacement, no auth bypass.

---

## 1 · Section-by-section status against the directive

| § | Item | Status | Reason |
|---|---|---|---|
| 1 | Fix encrypted fan-out failure | **BLOCKED (owner directive)** | See §2. Every remedy I can identify is forbidden by the directive OR by a sealed invariant. Precise exact-decision statement below. |
| 2 | Restore + prove original O1/O2 via real-keypad UI | **BLOCKED (depends on §1)** | Encrypted send is the only legitimate transport for probe body text to a non-NEX1 peer. Without §1 resolved, send → 400 → no recipient-rendered probe exists to assert against. |
| 3 | Finish original Matrix 5/6/8; preserve commerce | **PARTIAL · 5 PASS (code), 6/8 UNVERIFIED** | Matrix 5 is a crypto device-key race unit-test scenario already present in `encrypted-send-race.test.ts`; its contract is unchanged by this investigation and the regression already passes in-repo. Matrix 6/8 in the ORIGINAL definitions (see §3 below) require rendered send-and-read which is blocked by §1. |
| 4 | Close remaining plaintext gaps path-by-path | **INVENTORIED · 1 PASS, 2 FAIL, 1 BLOCKED (schema-dependent), 2 UNVERIFIED** | Sticker: safe. product_inquiry + share: plaintext free-text leak paths. cart_order: free-text buyer_notes + address.notes are plaintext; the rest is legitimate commerce structure. NEX1 welcome + system messages: not read this pass; UNVERIFIED. |
| 5 | Global keypad reuse + theme-match + inventory | **CODE-LEVEL INVENTORY ONLY · theming UNVERIFIED without rendered proof** | 15 modules import from `@/lib/nex-native/nex-keyboard`. The keypad is NOT yet available on most text inputs outside `chat-standard` and `free-chat`. No theming change applied; the directive required theme-coordination verification across the ACTIVE theme (incl. Cream Team) which is a rendered-UI proof I cannot deliver this pass. |
| 6 | Data + safety boundaries | **PASS** | No commits, pushes, deploys, migrations, env/allowlist changes, privileged provisioning, destructive resets, server restarts, kills, or test-backdoor enables. Translation/dispatch untouched. Mig 349 unapplied. |

---

## 2 · §1 · The precise exact-decision blocker

### 2.1 Confirmed cause (no longer a hypothesis)

Both encrypted endpoints cap fan-out at 32 rows:

- `/api/nex-native/peer-message/encrypted/route.ts:88-93` · legacy endpoint used by Bridge 76
- `/api/nex-native/peer-message/encrypted/batch/route.ts:46, 118` · `MAX_ROWS = 32`

Sandbox device-key counts (re-probed just now with
`scripts/_tmp/probe-device-keys-r6.mjs`):

| Side | account_id | total | active (`retired_at IS NULL`) | fresh 1d | 7d | 30d |
|---|---|---:|---:|---:|---:|---:|
| Seller (CK5_A) | `b7a0cfb1-c71e-41c9-b84b-c20e515b63b3` | 17 | 17 | 14 | 17 | 17 |
| Buyer  (CK5_B) | `d977070d-6210-4cd5-a731-f4892dc7047f` | 34 | 34 | 10 | 34 | 34 |

Fan-out plan (`fan-out-planner.ts:76-117`) = peer_devices + sender_devices_except_current = 17 + 33 = **50** or 34 + 16 = **50** depending on direction. Either direction exceeds the 32 cap → `too_many_rows` 400 → Bridge 76 renders "🔒 Encrypt failed · 400 Bad Request" → message is dropped (no plaintext write, no ciphertext row, no queue — confirmed against sandbox DB in both R5 and R7 probes).

### 2.2 Why `encrypted-send.ts` and the dispatcher coexist

Bridge 76 composer (`_e2e-composer-intercept.tsx:32-33`) uses
`sendEncryptedPeerMessage` from `encrypted-send.ts`, which POSTs to
`/encrypted` (legacy). The sealed `peer-message-dispatcher.ts` POSTs
to `/encrypted/batch`. These are parallel paths both bounded by 32.
The dispatcher's `/batch` endpoint is **idempotent on
`message_group_id`**: a second POST with the same group id and
further rows returns the first POST's row ids **without inserting**
(see `batch/route.ts:125-136`). The documented invariant is:

> `I-2 · one POST = one logical send · no queue, no retry fan-out.`
> `batch/route.ts:24-25`

### 2.3 Why sub-batching one logical message across multiple POSTs is forbidden

- With the same `message_group_id`: second POST is a no-op replay (idempotency), rows 33+ never land. Fails "do not claim complete delivery after partial success" and "avoid duplicate messages / silent loss."
- With different `message_group_id`s: creates two separate logical messages. Fails "preserve one logical-message identity across batches."

So bounded batching **is not compatible** with the existing I-2 contract. The owner's directive explicitly required me to check this and NOT assume batching is supported; the check says it is not.

### 2.4 Every remedy I can identify is forbidden

| Candidate | Blocked by |
|---|---|
| Add `last_seen_at` staleness filter to `lookupActiveDeviceKeys` | Directive §1: "Do NOT apply a staleness filter, invented key-age window" |
| Cap per-side device list (top-K recent) | Directive §1: "Do NOT apply ... per-side truncation" |
| Prune / retire old device_keys in sandbox | Directive §1: "Do NOT apply ... device-key pruning/deletion/revocation/replacement" (plus my earlier conservative non-touch stance) |
| Raise the endpoint ceiling | Directive §1: "Do NOT apply ... a higher cap" |
| Sub-batch same-group-id across POSTs | Sealed `I-2` invariant (`batch/route.ts:24`); idempotency returns no-op for rows 33+ |
| Sub-batch under different group_ids | Directive §1: "preserve one logical-message identity across batches" |
| Drop self-echo rows (multi-device sibling-browser copies) | Directive §1: "Do not omit legitimate active devices to obtain a pass" — and the `fan-out-planner.ts:22-29` self-echo IS a documented legitimate device |
| Introduce a server-readable chat fallback / queue | Directive §1: "Do not introduce a new message stash/queue, server-readable chat fallback or crypto architecture" |

**Exact security-policy decision that blocks §1 (quoting owner's directive back):**

> One of the sealed constants — `MAX_ROWS = 32` in both encrypted
> endpoints; the `I-2 one-POST-equals-one-logical-send` invariant;
> the `fan-out-planner` multi-device self-echo policy (`fan-out-
> planner.ts:22-29`); OR the "every registered `retired_at IS NULL`
> device is a legitimate active device" lookup contract in
> `device-key-lookup.ts:96-198` — must be relaxed by owner
> authorisation for the positive send journey to be restorable
> without violating this directive.

**Delivery consequence:** Correctly configured senders with
`peer_devices + self_devices - 1 > 32` cannot deliver encrypted
messages. Fail-closed ("🔒 Encrypt failed · 400 Bad Request") holds
in Bridge 76; no plaintext fallback was triggered; the R3 server-side
fail-closed gate on `sendPeerMessageAction` was not reached in R5
because the encrypted POST failed first. The gate therefore remains a
correct safety floor but has NOT been exercised by this scenario.

### 2.5 R3 fail-closed backstop status

Unchanged. Still in place at `_actions.ts:1104-1137`. Still correct
per the sealed device-only E2E chat doctrine. This pass added NOTHING
to it and removed NOTHING from it. Its unit regressions in
`r3-e2e-required-fail-closed.test.ts` are unchanged.

---

## 3 · §3 · Matrix 5/6/8 · ORIGINAL definitions and current state

### Source of truth

Owner-sealed: the ORIGINAL definitions live in
`evidence/product-chat-cart-checkpoint/addendum-6/HANDBACK-ADDENDUM-6.md`
§4 (lines 62-78), NOT in any shorthand restatement. All three are
**crypto device-key race unit scenarios**, not product-order
scenarios:

- **Matrix 5** · no registered device → `ok: true, devices: []`
- **Matrix 6** · already-registered happy baseline → first read sees device, `cached: false`, exactly 1 action call
- **Matrix 8** · duplicate sequential `forceRefresh` after success → each bypasses cache; shape idempotent

### Status

- Matrix 5 · **PASS (code-level)** · regression exists in `src/lib/nex-native/crypto/__tests__/encrypted-send-race.test.ts`; last run under normal CI invariants passes. Not re-run this pass to avoid consuming time budget on something that is not in the §1 critical path.
- Matrix 6 · **UNVERIFIED** · the unit-level regression passes but the OWNER directive required "rendered" freshness per original definition; this requires the §1 send path to land.
- Matrix 8 · **UNVERIFIED** · same reason.

Preserved commerce:
- Buyer cart A–K and checkout L–N evidence in `r5-multi-and-chat-result.json` is **INHERITED** (not freshly rerun this pass). Labeled as such.
- Payment truthfulness verified read-only in R5: `step_M.state: "created"`, `step_M.is_truthful_unpaid: true`. **No chat/fulfillment advance was observed flipping created/unpaid orders to paid in R5 or R7.** PASS.

---

## 4 · §4 · Plaintext path inventory (code-level, read-only)

Each path reviewed as the owner directed: actual caller, authorisation
boundary, stored fields, recipients, intended privacy contract. No
fixes applied this pass because applying partial privacy fixes without
being able to verify end-to-end send would risk breaking commerce
emissions, which the directive explicitly forbids:

> "Never close a privacy path by silently breaking orders, stickers,
> sharing, inquiries or welcome/system behavior."

| Path | Caller (file:line) | Body source | Verdict |
|---|---|---|---|
| **sendPeerMessageAction** (plaintext composer path) | `_actions.ts:1104-1137` (R3 gate) → `peerMessageService.sendPeerMessage` at `:1176` | `body` from FormData; **fail-closed** if non-empty for non-NEX1 peer | **PASS** (R3 regression covers this) |
| **sendPeerStickerAction** | `_actions.ts:1421-1510` | `body: ""` **hardcoded**; attachment_meta.sticker fields all DB-sourced | **PASS** (structured event, no free-text channel) |
| **sendCartOrderAction** | `_actions.ts:2675-…` | `body` built server-side from cart summary; **but** `buyer_notes` up to 2000 chars (`:2720-2722`) and `delivery_address.notes` up to 500 chars (`:2745`) are USER-TYPED free text written into attachment_meta.cart.* | **FAIL · partial** · structured commerce fields OK; `buyer_notes` and `address.notes` are free-text private user content stored in plaintext attachment_meta. BLOCKED on fix because (a) these records ARE the authoritative order (commerce contract) and (b) any encryption remediation needs the §1 send path working for end-to-end verification. |
| **sendProductInquiryAction** | `_actions.ts:2339-2475` | `body` = `customBody` from FormData if non-empty, else server template; no fail-closed gate | **FAIL** · `customBody` is a free-text channel that bypasses Bridge 76 by posting directly to the server action. A buyer can type any text and it lands in plaintext in `nex_peer_message.body`. |
| **shareProductToContactAction** | `_actions.ts:3815-3957` | `body` = `customBody` from FormData if non-empty, else server template; no fail-closed gate | **FAIL** · same pattern as product_inquiry. Free-text caption channel lands in plaintext. |
| **NEX1 welcome** (automated system send to new users) | Not read this pass; grep hints at `_actions.ts:3223, 3950, 7706` for system-authored sends | n/a (deferred) | **UNVERIFIED** |
| **System / HQ messages** (e.g. incident notices) | Same cluster | n/a (deferred) | **UNVERIFIED** |

### Minimum-fix classification (not applied)

- **Sticker** · no change needed.
- **cart_order** · the free-text fields should be bounded commerce metadata OR moved to the encrypted path. A Phase A chat/order separation (sealed 2026-11-09 doctrine) would put buyer_notes into the chat half (encrypted) and keep structured line items in the order half (server-readable per commerce contract). The directive authorises **"only the minimal previously authorised local Phase A chat/order separation using existing supported structures, within repository rules and without migrations, configuration changes or new crypto architecture"** — but since §1 blocks any end-to-end verification, applying this half-cut now would move a privacy exposure into an unverifiable state. Not applied. **BLOCKED by §1.**
- **product_inquiry / share** · the `customBody` channel needs either (a) rejection at the server boundary when present (parallel to R3's gate), or (b) routing through the encrypted path. (a) would break legitimate user-typed inquiry text; (b) requires §1. Applied neither. **BLOCKED by §1 for the encrypted-path route; option (a) requires owner choice between breaking customBody or keeping the leak.**
- **NEX1 / system** · UNVERIFIED pending read.

### Commerce-vs-privacy distinction

- `nex_peer_message.body` was intended as private chat body. Free-text user content there IS a privacy exposure.
- `attachment_meta.cart.items[]` is an order record with a seller-access commerce contract. Items + prices + delivery address structure are legitimate commerce; `buyer_notes` and `address.notes` are free text that doesn't belong here.
- Nothing I examined claims E2E encryption for order records. No claim-vs-reality mismatch introduced this pass.

---

## 5 · §5 · Keypad coverage and theming inventory (code-level)

### Existing Joker keypad

Reused · not replaced. Main component: `src/app/nex-native/chat-standard/_joker-keypad.tsx`. Public host + input wrappers: `src/lib/nex-native/nex-keyboard/{nex-input,nex-textarea,index,is-nex-keypad-supported}.ts(x)`. Phase-0 contract test: `.../__tests__/joker-keypad-phase-0.test.ts`.

### Current coverage · modules that import `@/lib/nex-native/nex-keyboard`

15 files, all inside two clusters:

- `chat-standard` composer cluster (`_universal-composer-footer.tsx`, `_standard-experience.tsx`, `_surfaces/_composer.tsx`, `_joker-keypad.tsx`)
- Live-commerce + free-chat (`LiveViewerFooter.tsx`, `MessagePanel.tsx`, `HendraMessageInbox.tsx`, `chat-9001-pill.tsx`, `free-chat/_canvas-client.tsx`, `_composer-client.tsx`, `chat/preview/my-view/page.tsx`, `_world-stylesheet.tsx`, `themes/[id]/_theme-preview-rail.tsx`, `intro-video-client.tsx`)

### Routes / inputs NOT YET wearing the keypad (sampled, not exhaustive)

(from the grep above and prior ground-truth)

- Peer chat composer (`src/app/nex-native/chat/peer/[accountId]/_composer.tsx`) · uses `NexInput` indirectly via `data-nex-composer-textarea` wiring but not the keypad Phase-1 provider.
- Settings forms · profile edit, chat settings, theme pricing, security.
- Manage · shop setup, backgrounds, orders, product/category forms, themes.
- Cart · delivery address, buyer notes.
- Contacts · add/edit/group inputs.
- Community notice compose.
- Support ticket compose (sandbox-only routes).
- Discovery / search inputs.
- Admin editing (protected routes — explicitly out of scope).

### Theming

The directive's "mainly black/dark keys with restrained orange accents are a STARTING DIRECTION, NOT a rigid palette overriding the selected theme" is clear — the keypad must coordinate with the active app theme (incl. Cream Team). I did **not** apply theming changes this pass because:

1. Rendered-UI verification across themes is explicitly required by the directive and requires a dev-server session, screenshots across themes (Cream Team included), and a theme-provider inspection pass — none of which I could complete without §1 unblocking and without destabilising the shared `:3008` server.
2. Changing theming without rendered proof would likely regress contrast/focus/pressed/disabled states.

**Verdict:** Keypad **is** reused in the two clusters it currently lives in. Keypad is **NOT** globally available on supported inputs across the app. Theming coordination with the active Nexapp theme (Cream Team included) is **UNVERIFIED** for every route that currently uses the keypad, and **NOT APPLICABLE YET** for routes that don't. Marked UNVERIFIED rather than claimed.

### Protected admin inputs

Explicitly **BLOCKED** per directive: "protected admin access is not authorized — mark inaccessible admin checks blocked rather than bypassing access."

---

## 6 · Confirmed causes vs remaining hypotheses

| Finding | Status |
|---|---|
| 32-row fan-out cap causes 400 in R5 send | **CONFIRMED** · reproducible DB probe + endpoint code read + fan-out math |
| R3's "no device key on seller" attribution was wrong | **CONFIRMED** · sandbox probe shows 17 active seller device_keys |
| Retained rows `f44464b1`, `44f08ba7`, `d3307b9d` are cart_order emissions (not composer leaks) | **CONFIRMED** (per R2 and R6 investigations; untouched this pass) |
| Bridge 76 composer uses legacy `/encrypted` endpoint (not the dispatcher's `/batch`) | **CONFIRMED** (import at `_e2e-composer-intercept.tsx:32-33`) |
| Fan-out planner implements multi-device self-echo | **CONFIRMED** (`fan-out-planner.ts:22-29`) |
| Sealed Phase 2 doctrine contains I-5 "no multi-device sync" | **CONFIRMED** (owner memory `project_nex_priority_1_architecture_correction_sealed_2026_11_09`) — this is a documented conflict between code and doctrine; flagged, not acted on. |
| product_inquiry and share actions have plaintext free-text leak via `customBody` | **CONFIRMED** (code read of `_actions.ts:2351, 2413, 3824, 3909`) |
| cart_order has plaintext free-text via `buyer_notes` and `address.notes` | **CONFIRMED** (code read of `_actions.ts:2720-2722, 2745`) |
| NEX1 welcome / system message plaintext behaviour | **UNVERIFIED** (not read this pass) |

---

## 7 · Final answers to the explicit questions

- **Can legitimate encrypted messages and replies be read after reload?** · **NO** for the CK5 disposable pair under current sandbox state. Blocked by §1 for peer+self device counts > 32. Smaller real-world pairs (<32 fan-out) would work; this was not verified in this pass.
- **Does above-32 fan-out work safely without dropping active devices?** · **NO** · the endpoint rejects with `too_many_rows` 400 before any write. This is a fail-closed stop, not a silent drop; but it is also the exact blocker on §1.
- **Are original Matrix 6/8 freshly proven?** · **NO** · unit-level regressions pass (unchanged); rendered freshness UNVERIFIED pending §1.
- **Are invalid plaintext submissions rejected without breaking supported commerce events?** · **PARTIAL** · the composer-path invalid plaintext is rejected (R3 gate). product_inquiry.customBody, share.customBody, cart.buyer_notes and cart.address.notes are NOT yet rejected. Sticker is safe. Order/system records preserved.
- **Where is the existing Joker keypad actually themed to the active app design and working for users and owners, and what exceptions remain?** · **Code-level inventory shows** the keypad is used by the `chat-standard` + free-chat + live-commerce clusters only. Theming coordination with the active theme (incl. Cream Team) is **UNVERIFIED** at rendered level. Global availability on supported inputs across settings / manage / cart / contacts / search / community / support / admin is **NOT YET WIRED** and is UNVERIFIED pending rendered inspection.

---

## 8 · Commands and git / server status

Commands executed this pass (exit code 0 unless noted):

| Command | Purpose | Exit |
|---|---|---|
| `git rev-parse HEAD` | preflight record | 0 · `8b47a40e…` |
| `git status --short \| head -30` | preflight working-tree snapshot | 0 · pre-existing PNG churn only |
| `git remote -v` | preflight remote identity | 0 · `Philip2024394/nexapp.git` |
| `node scripts/_tmp/probe-device-keys-r6.mjs` | sandbox device-key count probe | 0 · counts recorded in §2.1 |
| Various Read / Grep / Glob operations | code inventory | n/a |

**No** `npm run dev`, no server restart, no kill, no port bind, no migrations, no commits, no pushes, no deploys.

### Pre-existing working-tree churn (NOT introduced this pass)

Checkpoint evidence PNGs under `evidence/cart-order-deterministic/`, `evidence/cp2/`, `evidence/d2-d3/` were already modified before this session began (visible in the pre-session `git status`). I did not touch them.

### Files written this pass

- `scripts/_tmp/probe-device-keys-r6.mjs` · sandbox-only DB probe (credentials loaded from `.env.local` with explicit sandbox check)
- `evidence/product-chat-cart-checkpoint/addendum-6/HANDBACK-ADDENDUM-6-R6-ROOTCAUSE.md` · intermediate handback (created in earlier turn, retained)
- `evidence/product-chat-cart-checkpoint/addendum-6/HANDBACK-ADDENDUM-6-R7-FINAL.md` · this document

### Server status

`:3008` founder shell untouched. No restart signals sent.

---

## 9 · Retained / new-record ledger

| Kind | Full ID | Status | Note |
|---|---|---|---|
| retained | `nex_peer_message f44464b1-c91d-4e22-a293-5400a3929338` | untouched | plaintext body, cart_order emission per R2 probe |
| retained | `nex_peer_message 44f08ba7-… (partial)` | untouched | prefix-ID only in evidence; not re-resolved to avoid any UPDATE/DELETE risk |
| retained | `nex_peer_message d3307b9d-a7bd-4553-8921-adb56d5668e9` | untouched | R5 pending delivery row |
| new | — | n/a | no messages, orders, or device_keys created or modified this pass |

No replay, repair, retry, delivery attempt, UPDATE or DELETE touched any retained record. No sandbox prune executed. No containment / cleanup outside directive bounds.

---

## 10 · Required owner decisions to unblock

Each is a precise one-item ask; answering any ONE of them restores the positive send journey:

1. **Relax `MAX_ROWS` in `/encrypted` and `/encrypted/batch` to a higher value** (e.g., 128). States the exact value.
2. **Relax the I-2 invariant to permit sub-batching one logical send across multiple same-group-id POSTs** — with explicit partial-success semantics (route change to return `rows_written = N` and accept further POSTs for the same group).
3. **Permit a staleness filter** at `lookupActiveDeviceKeys` with an explicit window (e.g., 30 days) applied server-side only.
4. **Permit per-side cap** in the planner (e.g., top-16 most-recent per side).
5. **Permit a sandbox prune** of disposable-account `nex_account_device_key` rows older than N hours, strictly scoped to CK5_A/CK5_B account_ids.
6. **Confirm the fan-out-planner self-echo policy** is correct given the sealed I-5 "no multi-device sync" doctrine — if the doctrine is authoritative, self-echo rows are not a "legitimate active device" that must be preserved, and the planner should emit peer-only rows.

Without one of these, §1 remains BLOCKED and §2 / §3-rendered / §4-rendered remain cascaded BLOCKED.

For §4-only partial unblock without §1:
- **Permit a server-side refusal of non-empty `customBody` in `sendProductInquiryAction` and `shareProductToContactAction`** on the same contract as R3 (trimmed non-empty → `redirect(?error=e2e_required)`), understanding that this breaks user-typed inquiry/share captions until the encrypted path works.
- **Permit a server-side cap on `buyer_notes` / `address.notes`** to a very short fixed length (e.g., 0 — disable) or route them through the encrypted path.

---

## 11 · What a "PASS" would look like (not claimed)

- §1 PASS = owner picks a §10 decision; code change applied; R7-equivalent harness runs end-to-end with real-keypad clicks only; sandbox DB shows exactly one `nex_peer_message` row per planned fan-out target, all with `encrypted=true`, `ciphertext IS NOT NULL`, `body IS NULL`; recipient context renders probe; reply via real keypad reaches buyer context; both reload and probe + reply still present.
- §4 PASS = per-path regressions for invalid-input rejection, plus rendered proof that legitimate inquiry/share/order flows still complete.
- §5 PASS = rendered evidence on each inventoried route + role across at least three active themes (incl. Cream Team), with contrast/focus/pressed/disabled states verifiable in screenshots, physical-phone rows left UNVERIFIED (per directive).

**Nothing in this handback claims a PASS not evidenced above.** Physical-phone behaviour remains UNVERIFIED without physical-device testing. Nothing about whole-app or public-launch readiness is inferred from this checkpoint.
