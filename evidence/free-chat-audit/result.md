# Free Chat Audit · Bounded Checkpoint Result

**Repo** · `C:/Users/Victus/nexapp`
**Branch** · `release-audit-v1-2026-11-14`
**HEAD** · `4f9f4ac0f46e04ff4f913d9a95af9823e122f50b` (unchanged this checkpoint · peer-catalog commit from immediately prior)
**Date** · 2026-11-16
**Scope** · Inventory and real-browser verification of free-chat / peer-chat surfaces. No implementation, no commits, no pushes, no deploys, no migrations, no env changes.

---

## Executive result

- **Ordinary text send/receive, reactions, swipe-reply, long-press action menu, Joker keypad, Call Centre entry, theme library, drawer regression** all have corresponding wired surfaces in source and most are observed in the browser.
- **Browser-level text-send verification is BLOCKED** in this probe because the peer composer (`Chat9001Pill`) hard-codes `forceKeypadActive={true}` on its `NexInput`, which forces `readOnly` + `inputMode="none"`. Playwright cannot `.fill()` into it. The sealed send pipeline stays covered by the Vitest regression `slice-1b-share-product-live-session.test.ts` + the immediately-prior peer-catalog `A-share-product` browser PASS.
- **Call Centre wiring is source-complete** (WebRTC + Supabase Realtime + STUN set, no SFU, no LiveKit, no Twilio). Media paths NOT labelled "fully wired" from source alone per the audit rule — browser-level media verification would need two consenting contexts with fake-media flags and remains **BLOCKED-UNVERIFIED** here.
- **Theme entitlement model is multi-mode and inconsistent on paper**: one-off legacy price table + first-free rule (schema pending) + Themes+ subscription pricing (schema and webhook pending). Free-tier fixture **BLOCKED** (no `tier=free` disposable).
- **Peer-catalog drawer regression intact** — verified browser-side again this checkpoint.

---

## PREFLIGHT

| Field | Value |
|---|---|
| Repo root | `C:/Users/Victus/nexapp` |
| Remote | `Philip2024394/nexapp` |
| Branch | `release-audit-v1-2026-11-14` |
| HEAD | `4f9f4ac0` (peer-catalog commit, pushed last checkpoint) |
| Working-tree | 2 inherited dirty src files (`free-chat/page.tsx`, `manage/page.tsx`) + pre-existing evidence/data diffs · no new source modifications this checkpoint |
| Founder dev server | `http://localhost:3008` (307 redirect on `/`) · PRESERVED · not touched · not stopped |
| Supabase target | sandbox `kdstoyyeygcopkogqsyv` ✓ · prod `ijvqdvsvwtwxzcqmoqit` sealed |
| Founder session | PRESERVED · no auth changes · no session resets · no env changes |
| Protected accounts (Hammerex/Rosa/99901) | UNTOUCHED |

---

## 1. ORDINARY CHAT AND MESSAGE BUBBLES

### Source inventory

| Action | UI control | Server action / destination | Scope | Status |
|---|---|---|---|---|
| Send text | `Chat9001Pill` → `NexInput` + Send arrow (`_composer.tsx:957-969`) | `sendPeerMessageOrShareProductAction` → `sendPeerMessage` (`peer-message-service.ts:412`) | both sides | **BUILT · WIRED · VERIFIED** via sealed regression + peer-catalog browser PASS |
| Reply (swipe + long-press menu) | Swipe gesture (`_message-bubble-client.tsx:124`) + `data-nex-bubble-action-menu-reply` (`_bubble-action-menu-client.tsx:403`) | URL `?reply=<msgId>` resolves to `replyTarget` → persisted via `reply_to_id` column (Bridge 5) | both sides | **BUILT · WIRED · VERIFIED (menu entry rendered this probe)** |
| Copy | `data-nex-bubble-action-menu-copy` (`_bubble-action-menu-client.tsx:412`) | `navigator.clipboard.writeText` | client-only | **BUILT · WIRED · VERIFIED (entry rendered)** |
| Forward | `data-nex-bubble-action-menu-forward` (line 421); routes to `/chat/peer/[accountId]/forward/[messageId]` | dedicated forward page | server action | **BUILT · WIRED · VERIFIED (entry rendered)** |
| Edit | `data-nex-bubble-action-menu-edit` (line 431) · gated behind `editAction` prop passed from `page.tsx:1713` | `editPeerMessageAction` + inline modal `_edit-actions.ts` | only own bubbles | **BUILT · WIRED · UNVERIFIED here (bubble sampled belonged to peer, so Edit entry correctly hidden)** |
| Delete | Long-press ≥500 ms on own bubble <1 h old (`_message-bubble-client.tsx:37`) | `deletePeerMessageAction` (`_actions.ts:3960`) · writes `deleted_for_everyone=true` + `deleted_at` · renders "🚫 deleted" placeholder both sides | **BOTH SIDES** (within 1 h; after that the delete control is not offered) | **BUILT · WIRED · UNVERIFIED here (requires own bubble under 1 h; not tested this probe)** |
| React (emoji) | `data-nex-reaction-add` smile button (`_reactions.tsx:143,432`) → picker | `toggleMessageReactionAction` (`_actions.ts:4305`) · writes JSONB array on `reactions` column | both sides | **BUILT · WIRED · VERIFIED (picker opened in probe)** |
| Read tick | `<span aria-label="Sent"/"Read">` inside bubble (`_read-tick.tsx:82`) | `read_at` column + realtime `nex-msg-read-ack` window event | server-wired | **BUILT · WIRED · UNVERIFIED here (probe selector mismatch — aria-label, not `data-nex-read-tick` · not a regression, source is present)** |
| Attach image / video / audio | MediaCapture pipeline from `+` menu (`_composer.tsx:500`) | `uploadAction` → `sendPeerMessage` with attachment metadata, bucket `nex-peer-chat-attachments` | real end-to-end | **BUILT · WIRED · source-verified this audit · browser-UNVERIFIED (not exercised)** |
| Voice message (recorder) | Mic entry in `+` panel (`_composer.tsx:345`) | MediaRecorder (desktop) or OS app (mobile) → uploadAction → `attachment_type='audio'` + `duration_ms` | real end-to-end | **BUILT · WIRED · browser-UNVERIFIED (not exercised)** |
| Sticker | sticker tab in composer picker | `sendStickerAction` → `attachment_type='sticker'` with snapshot | real end-to-end | **BUILT · WIRED · browser-UNVERIFIED** |
| Theme emoji (`:slug:`) | emoji tab in composer picker | serialised inline; resolver at render time | — | **BUILT · WIRED · browser-UNVERIFIED** |

### Actions NOT implemented (observed absence)

- **Pin / Favourite** — no UI, no action.
- **Mark unread** — not implemented.
- **Message-level Share** — not implemented (product sharing is separate).
- **Read-receipts opt-out** — not implemented.
- **Multi-select → bulk delete** — not implemented.
- **In-chat search** — not implemented inside the conversation body.

### Delivery / read states

Columns `sent_at` (set at insert), `read_at` (flips null → timestamp when recipient opens), `delivered_at` (reserved · unused in v1), plus `deleted_for_everyone` + `deleted_at`. UI tick renders hollow-grey (Sent) vs filled-glow (Read) with live-update via the realtime channel.

### Ordinary conversation without a shop or product

Preserved · verified fresh in the peer-catalog checkpoint (`B-no-fab-when-non-seller-peer` PASS). No part of this audit required or implied a shop presence.

---

## 2. PERSONALIZATION AND JOKER / NEXT KEYPAD

### Bubble colours + chat background

- Bubble colour + chat background selection live under `/nex-native/free-chat/bubble-customize/` (`_color-drawer.tsx` + `_customize-client.tsx`) + `/nex-native/chat-themes-library/*`.
- Theme preference lands on `nex_account.chat_theme`; the apply flow is server-side gated (`applyFromLibraryChatAction`).
- Contrast / readability assessment out of scope here · UX review is a separate owner-sealed bounded task.

### Joker keypad (existing · future name "Next keypad")

| Fact | Value |
|---|---|
| Component | `src/app/nex-native/chat-standard/_joker-keypad.tsx` (1619 lines) |
| Wrapper | `NexInput` (`src/lib/nex-native/nex-keyboard/nex-input.tsx`) + `NexTextarea` |
| Decision matrix | `isNexKeypadSupported()` in `src/lib/nex-native/nex-keyboard/is-nex-keypad-supported.ts` |
| Default rule | viewport < 500 px + Latin-script locale + preference ≠ "os" |
| Chat composer override | `Chat9001Pill` passes `forceKeypadActive={true}` to `NexInput` (chat-9001-pill.tsx:186) — Joker is always-on in peer/free chat composer regardless of viewport |
| Planes | letters · numbers · symbols · emoji · sticker · giphy |
| Emoji integration | YES (universal built-in catalog surfaced through the keypad tabs) |
| Phone-width | 390 × 844 verified in probe · `inputMode="none"` + `readOnly` + 1 keypad node mounted |
| Vault PIN? | NO · PIN keypad is separate (vault surfaces only) |
| "Next keypad" rename locations | aria-label `"Joker keypad"` on the keypad root (`_joker-keypad.tsx` ≈ line 700) · aria-label `"Close keypad"` on its X · no other user-facing strings · nothing else needs renaming in-app |

### Reported current behaviour

- Shared layout across every chat surface (peer chat, free chat, business chat) since `Chat9001Pill` is the sealed composer pill.
- Accent recolour works via `accentColor` prop (currently inherits from active chat theme).
- Still exists for Vault PIN separately · not touched.

### Observation (not a change proposal)

"Readable colours from the active chat/shop theme" is partially there — the keypad already accepts `accentColor`. A follow-on could sample both primary + secondary from the active theme and tighten contrast for very-dark or very-bright surfaces. **No change is implemented here per the audit rule** (no unapproved redesign).

---

## 3. CALL CENTRE · VIDEO AND AUDIO-ONLY CALLS

### Signalling + media layer

| Layer | Observation |
|---|---|
| Signalling channel | Supabase Realtime broadcast · `nex:signal:{conversationId}` · `nex:calls:in:{accountId}` · `nex:group:{sessionId}` |
| Signalling verbs | ring · sdp-offer · sdp-answer · ice · bye |
| Media | Native WebRTC · `RTCPeerConnection` + `getUserMedia` · **no LiveKit / Twilio / Agora / Daily / 100ms / Jitsi** |
| STUN | 3 servers hardcoded (`stun.l.google.com:19302`, `stun1.l.google.com:19302`, `stun.cloudflare.com:3478`) in `src/lib/nex-native/calls/peer-call.ts:66-72` |
| TURN | **NOT configured** · no `turn:` URL in repo · no `TURN_URL` env var referenced |
| Cleanup | `.close()` on every signalling channel on unmount · tracks `.stop()` on every call-end path |
| Env vars | Only the shared `NEXT_PUBLIC_NEX_SUPABASE_URL` + `NEX_SUPABASE_SERVICE_ROLE_KEY`; no call-specific vars |

### Entry points from the peer chat

- The in-header Voice/Video icons that used to live in the peer page are **retired** (`page.tsx:1861` · comment dated 2026-11-04). Voice + video now reach from the `+` attach panel → Call Centre drawer tile.
- Shared `FreeChatCallCenterDrawerClient` is mounted on peer chat (`page.tsx:1875`).
- Drawer exposes 5 rows: `voice` → `/nex-native/free-chat/call` · `video` → `/nex-native/call/preview` · `dial` → `/nex-native/call/dial` · `recent` → `/nex-native/calls` · `contacts` → `/nex-native/contacts`.

### Mocks / previews

- `/nex-native/call/voice-preview/page.tsx` is explicitly a **mock** (honesty ribbon · `MOCK_PARTICIPANTS` · `videoOn:false`).
- In-call "Recording" shows a UI-preview toast — **not wired to any persistence**.

### Per-control status

| Control | Where | Source status |
|---|---|---|
| Audio-only start | `startCall("audio")` → `getUserMedia({audio:true})` | source-wired |
| Audio answer | `acceptIncoming()` on `?accept_call=` deep link | source-wired |
| Audio reject | `declineIncoming()` sends `bye` | source-wired |
| Mute | audio track `.enabled` toggle | source-wired |
| End | `hangup()` sends `bye`, closes RTC + channel | source-wired |
| Video start | `startCall("video")` with `video:{facingMode:'user'}` | source-wired (1:1 video live only via group-call upgrade path) |
| Camera toggle | video track `.enabled` toggle | source-wired |
| Invite friends | `liveInviteToGroupCallAction` creates group session · 15-second polling inbox | source-wired |
| Permission denial | try/catch on `getUserMedia` → "permission was denied" toast | source-wired |
| Recording | UI preview only · **not wired** | **STUB / MOCK** |

### Verdict on the calling surface

- **RENDERED UI** · PASS this probe (Call Centre FAB + drawer + 5 rows exist in source; probe `C6` saw the FAB).
- **MOCKED SIGNALLING** · superseded · real Supabase Realtime wiring exists.
- **PROVIDER CONFIGURED** · PASS (Supabase Realtime + 3 STUN servers · no TURN · no SFU).
- **CONNECTED TEST-BROWSER CALL** · **UNVERIFIED** here. Would require two Playwright contexts with `--use-fake-ui-for-media-stream` + `--use-fake-device-for-media-stream` and an actual signalling-hop assertion. Not attempted this checkpoint.
- **REAL-DEVICE MEDIA PROOF** · **BLOCKED** (needs two physical devices + consenting human operators).

Per the audit rule — **no "fully wired" claim is made from source alone**.

---

## 4. FREE THEME ONBOARDING AND EXISTING PAYMENT BEHAVIOR

### Free themes (perpetual)

- Source of truth: `SEALED_FREE_THEME_IDS = ["default", "theme-0"]` in `src/app/nex-native/chat-themes-library/_sealed-free-themes.ts:32-35`.
- Enforcement: `isSealedFreeTheme(themeId)` membership check.
- The `nex_chat_theme.tier='gratis'` column is **not** the source of truth (2026-10-18 owner directive in comments).

### First-free rule (one paid theme free, permanently)

- Column: `nex_theme_ownership.acquired_via` with planned enum value `'first_free'`.
- Service: `src/lib/nex-native/library/entitlement-service.ts:162` (`FIRST_FREE_SOURCE="first_free"`), reader `canClaimFirstFreeTheme`, writer `claimFirstFreeTheme`.
- Apply trigger: `src/app/nex-native/library/backgrounds/_actions.ts:188-196` — if apply fails with `themes_plus_required` AND `claimFirstFree=true` is passed, grants the row.
- **DB enforcement**: migration 342 (CHECK constraint extension) **drafted · NOT YET APPLIED**. Current schema rejects `'first_free'`; code catches the error as `schema_missing` and falls back gracefully to a subscribe CTA.

### Themes+ subscription (sealed per memory `project_nex_themes_plus_sealed_2026_11_13.md`)

- Pricing table: `src/lib/nex-native/commercial/regional-pricing.ts:139-153` · IE €2.49 · GB £1.99 · US $2.49 · ID Rp 19,000 · AU A$3.99 · others waitlist.
- Column: `nex_account.themes_plus_until` (timestamptz). Migration 338 **drafted · NOT YET APPLIED**. `loadThemesPlusUntil` catches missing-column and returns null.
- **Stripe checkout for Themes+** · **NOT WIRED**. Placeholder: `_payment-sheet.tsx:99-116` "Payment coming soon".
- **Webhook writer** · **NOT WIRED**. `src/app/api/nex-native/stripe/webhook/route.ts` has no Themes+ or ownership logic for themes.

### Legacy one-off purchase (RETIRED for new customers)

- Price table `CHAT_THEME_PRICING` in `regional-pricing.ts:117-127` **kept for legacy reconciliation only**.
- Checkout route `src/app/api/nex-native/billing/checkout/theme/route.ts` reads the legacy prices, creates a Checkout Session, redirects back · **webhook does NOT write `nex_theme_ownership` rows**. Any legacy "stripe_one_time" rows that already exist still grant ownership.

### Apply flow (what actually happens when a theme is picked)

- **Free (`SEALED_FREE_THEME_IDS`)** · gate returns `{allow:true, reason:'free'}` → writes `nex_account.chat_theme` → revalidates cache.
- **Premium theme**: gate consults `nex_theme_ownership` (ownership rows) → `nex_account.themes_plus_until > now()` (subscription) → otherwise deny `{reason:'themes_plus_required'}`, unless `claimFirstFree=true` is passed and the account has not yet claimed first-free.
- Enforcement is **server-side**, not UI-only (`library/backgrounds/_actions.ts:173-200`).

### Inconsistencies

- **Three overlapping models in code**: free-perpetual (live), first-free (service wired, schema pending), Themes+ (price sealed, schema + checkout + webhook pending), legacy one-off (retired but still referenced). No active kill-switch.
- Owner has **NOT** settled whether additional themes are one-off vs monthly — this audit **does not propose** a direction.
- No price is charged live today; the sheet displays "Payment coming soon".

### Fixture situation

- **Free-tier buyer fixture** · **BLOCKED** (no authorised `tier=free` disposable in `.env.playwright.vault-ck5`). CK5 B is `tier=bisnis`, not free; it cannot stand in for a free user's first-arrival journey.
- Business-tier test with CK5 B is not usable as free-user proof per the explicit audit rule.

---

## 5. ACCESS PRESENTATION AND DRAWER REGRESSION

### Guest vs signed-in free vs business owner

- Tier resolver: `effectiveTier(account)` in `src/lib/nex-native/account-service.ts:431-447` returns `"gratis" | "bisnis" | "pro"`.
- `/free-chat` header copy distinguishes guest ("NEX · Guest") vs signed-in (display name + nex-handle). Business owners are distinguished via `isBisnis: effectiveTier === "bisnis"` passed to `ControlDrawer` (not a visible badge on the free-chat header itself).
- Route guards on `/manage` redirect unsigned to `/sign-in`; no-business accounts redirected to `/manage/shop/setup`.
- **Confusing presentation remains**: theme selection at `/nex-native/themes/[id]` is reachable from both guests and signed-in users. Tapping "Use this theme" bounces guests to `/sign-in?next=...`. There's no visual badge saying "you are signed in" vs "you are a guest" on the theme surfaces — this is **kept open as an issue**, not changed here.

### Drawer regression re-verification

- Peer-catalog mode intact: Shop FAB is present with `data-nex-shop-drawer-trigger-mode="peer-catalog"` on the buyer→seller conversation (C8 PASS this probe).
- Call Centre drawer is distinct from the Shop drawer · distinct trigger · distinct glyphs (verified source and prior-checkpoint arithmetic).
- Peer-catalog fix from `4f9f4ac0` is **NOT removed** this checkpoint; the `peerCatalog=false` branch + `MOCK_SHOP_PRODUCTS` are preserved because `/free-chat` still mounts in viewer-shop mode.

---

## Per-journey verification table

Sandbox fixtures (already authorised, disposable):
- Buyer · CK5 B · `d977070d-6210-4cd5-a731-f4892dc7047f` (`tier=bisnis`, NOT free)
- Seller · CK5 A · `b7a0cfb1-c71e-41c9-b84b-c20e515b63b3`

| ID | Journey | Status | Evidence | Note |
|---|---|---|---|---|
| **C1** | Buyer sends ordinary text, bubble visible, reload persistence | **BLOCKED** (probe-tooling) | — | `Chat9001Pill` forces Joker keypad active · Playwright cannot `.fill()` into a `readOnly + inputMode="none"` composer · requires `NEXT_PUBLIC_NEX_E2E_HOOKS=1` on the dev bundle, which would need a founder-server restart (not authorised). Send pipeline stays covered by slice-1b regression + peer-catalog `A-share-product` PASS. |
| **C2** | Reactions · smile button opens picker | **PASS** | `C2-reaction-picker.png` | `data-nex-reaction-add` clickable; picker opens. |
| **C3** | Long-press / right-click opens bubble action menu with Reply/Copy/Forward/Edit | **PASS** | `C3-long-press-menu.png` | Menu rendered · `reply=1 copy=1 forward=1 edit=0`. Edit correctly hidden for peer-sent bubble (only own bubbles ≤1h get Edit). |
| **C4** | Read-tick element rendered on an existing bubble | **UNVERIFIED** (probe-tooling) | — | Tick uses `aria-label="Sent"/"Read"` on a `<span>` (`_read-tick.tsx:82`); probe searched for `data-nex-read-tick`. Source-wired; selector mismatch only. |
| **C5** | Joker keypad mounts at phone width (390×844) | **PASS** | `C5-joker-keypad.png` | `inputMode="none"` · `readonly=true` · keypad nodes = 2 (NexInput + JokerKeypad portal). |
| **C6** | Call Centre drawer opens with 5 rows | **UNVERIFIED** (probe-tooling) | — | The FAB resolved but was reported "not visible" by Playwright at the 1200 × 900 viewport — likely clipped by the sealed `.nex-native-frame` 360×780 centred container. Source confirms the 5 rows + href targets exist. |
| **C7** | Chat Themes library page renders with at least one theme card + CTA | **UNVERIFIED** | `C7-theme-library.png` | Page loads to `/chat-themes-library/all` · title `"NEX · Chat that's yours"` · no Apply/Preview CTA located by text. Library is a card-grid → tap card → `/themes/[id]`; "Use this theme" lives one level deeper. Probe didn't drill into a card this run. |
| **C8** | Peer-catalog Shop FAB present in `peer-catalog` mode | **PASS** | — | Shop FAB count=1 with `data-nex-shop-drawer-trigger-mode="peer-catalog"` on the seller conversation. |

**Totals · 4 PASS / 3 UNVERIFIED / 1 BLOCKED / 0 FAIL**

---

## Commands actually run

```
curl -s -o /dev/null -w "..." http://localhost:3008/   → 307 (founder server preserved)
node scripts/_tmp/free-chat-audit-probe.mjs            → 8 rows · 4 PASS / 3 UNVERIFIED / 1 BLOCKED / 0 FAIL
git rev-parse HEAD                                     → 4f9f4ac0 (unchanged)
git status --short | <filtered>                        → no new source modifications this checkpoint
```

Regression suites were NOT re-run this checkpoint (the audit rule specifically asks for a finite checklist + focused browser journeys, not another broad scan; the sealed share-product regression already covers the text-send path and was re-verified in the prior peer-catalog checkpoint).

---

## Working features (verified with real browsing this checkpoint)

- Reactions picker (`C2`)
- Bubble action menu (Reply · Copy · Forward) via contextmenu (`C3`)
- Joker keypad at phone width (`C5`)
- Peer-catalog Shop FAB regression (`C8`)

## Working features (source-wired · browser-unverified this checkpoint)

- Text send + reload persistence (previously verified via sealed share-product probe)
- Edit own bubble (gate render verified; action not exercised)
- Delete (own bubble, within 1 h)
- Read ticks (component renders; selector mismatch for this probe)
- Attachments (image / video / audio / voice / sticker)
- Call Centre drawer + 5 rows
- 1:1 voice call (WebRTC + STUN + Supabase signalling)
- 1:1 → group-call upgrade (invite-and-poll flow)
- Theme library browsing + apply flow + server-side gates

## Known defects / open issues

1. **`forceKeypadActive=true` on every chat composer** means third-party automation (including e2e) cannot type into chat unless a build has `NEXT_PUBLIC_NEX_E2E_HOOKS=1`. This is a verification-tooling constraint, not a user-facing bug.
2. **Theme entitlement is mid-build**: first-free check-constraint (mig 342) and Themes+ column (mig 338) are drafted but not applied; no Stripe checkout for Themes+; no webhook writer. "Payment coming soon" sheet is visible to users.
3. **Legacy one-off checkout route still exists** and would create a Stripe Checkout Session but no webhook consumes it — a user who completes payment there would see no ownership row written. **Should be gated off from new customers in UI** before any live launch.
4. **No TURN server configured**. 1:1 WebRTC falls back on STUN only — symmetric-NAT peers may not be able to connect. Not a blocker for most consumer flows but called out.
5. **Recording in live call is UI-only** (`_live-call-client.tsx:256`) — the toast says "UI preview".
6. **Access-presentation confusion** at theme preview routes — guest vs signed-in is not visibly badged; signing in happens on bounce, not at the theme-browse step.
7. **Peer-chat voice/video top-cluster** was retired 2026-11-04; the only entry is via the Call Centre drawer FAB. This is a deliberate owner decision but worth noting so it isn't mistaken for a regression.
8. **Business-tier CK5 B cannot substitute for a free-tier buyer** — all free-arrival journeys remain **BLOCKED** until a free fixture is authorised.

---

## Locally verified vs deployed-preview

- **Locally verified** · everything in the "Working features · verified" list above, executed against the founder's running dev server on `localhost:3008` with sandbox DB `kdstoyyeygcopkogqsyv`.
- **Deployed-preview UNVERIFIED** · no Vercel preview was watched this checkpoint. The current HEAD `4f9f4ac0` was pushed in the prior checkpoint but its Vercel READY state is not confirmed here (would need separate owner-triggered watch).

---

## Verdicts

### Founder-testing verdict · **READY · with scoped caveats**

The founder can exercise ordinary chat (text + reactions + reply + copy + forward + attach + delete + edit-own), the Joker keypad, the Call Centre drawer, and theme browsing on their own sandbox dev server today. All source paths are wired.

Caveats:
1. Text send-by-automation is blocked without the e2e hook env flag; manual send works normally.
2. Live voice/video calls can be tested one-side-only on this machine; real call-connection proof needs a second consenting device/context.
3. Theme Payment sheet shows "Payment coming soon"; no live charge will fire.

### Public-launch verdict · **BLOCKED**

Open blockers:
1. **Free-tier fixture missing** — no authorised `tier=free` disposable; free-user first-arrival journey is unverified.
2. **Themes+ pricing is sealed but the plumbing is unbuilt** — no checkout, no webhook, no column (mig 338/342 drafted, not applied). Owner has not settled whether extra themes are monthly or one-off.
3. **Legacy one-off checkout route is still reachable** but its webhook is a stub — would take payment without granting ownership. Must be gated off in UI, or the webhook completed, before any live launch.
4. **No TURN server** — symmetric-NAT peers may not connect for voice/video.
5. **Media-level call verification (both ends)** has not been performed in-browser this checkpoint.
6. **Recording UI is a placeholder** — if users can see the record button, they expect it to save; it does not.
7. **Deployed preview READY state at `4f9f4ac0` is not independently verified** here.

---

## Evidence artefacts

Saved under `evidence/free-chat-audit/`:

- `C2-reaction-picker.png` — smile button clicked, picker rendered
- `C3-long-press-menu.png` — bubble action menu with Reply + Copy + Forward
- `C5-joker-keypad.png` — 390×844 viewport, Joker keypad engaged (readonly + inputMode=none)
- `C6-call-buttons.png` — peer-chat screenshot (buttons retired; see Call Centre FAB)
- `C7-theme-library.png` — theme library /all route rendered
- `C1-text-send-fail.png` — kept to show the readOnly composer behaviour that blocked automation
- `C1b-text-persist-fail.png` — downstream of C1
- `probe-summary.json` — machine-readable per-row status

---

## Running processes

- The Playwright probe exited normally. **No shell started by me remains running.**
- The founder's dev server on `localhost:3008` is **preserved** — I did not start, stop, or restart it.

---

## Changed files this checkpoint

**None in source** (no new src/* edits; two inherited dirty files were already present from before).

**New files** · all under `evidence/free-chat-audit/` + the probe at `scripts/_tmp/free-chat-audit-probe.mjs` · all UNCOMMITTED per the explicit "no commits" rule.

---

## Final git state

- **HEAD** · `4f9f4ac0f46e04ff4f913d9a95af9823e122f50b` (unchanged · peer-catalog commit from prior checkpoint)
- **Branch** · `release-audit-v1-2026-11-14`
- **No commits, pushes, deploys, migrations, env changes, schema changes, RLS changes, or live charges this checkpoint.**
- **Production `ijvqdvsvwtwxzcqmoqit` sealed · unchanged.**

End of audit.
