# Shop Chat First-Message Popup · Design Document (REVISED)

**Owner-authorised:** 2026-11-28
**Author:** engineering
**Status:** DRAFT · awaiting owner sign-off before implementation
**Scope:** ALL nexapp shop templates (course-correction 2026-11-28 supersedes X-Rated-first scope)

---

## 0 · Revision history

| Rev | Date | Change | Driver |
|---|---|---|---|
| 1 | 2026-11-28 | Initial design: separate `nex_shop_enquiry` channel distinct from NEX Chat, guests stay guests, email-only reply. | Owner brief earlier 2026-11-28. |
| 2 | 2026-11-28 | **Course correction** — pop-up details activate the visitor's NEX account, the first message enters real NEX Chat with the shop owner, same flow across every shop template. | Owner message 2026-11-28: *"same flow for all shop templates — user can send message into the chat after fill out the details on pop up container first time and it appears in chat and their account active. correct"* |

Rev 1's data-model (new `nex_shop_enquiry` tables, separate HQ "Shop Enquiry" channel) is **dropped**. Rev 2 layers on top of the existing peer-chat + provisional-account infrastructure instead of parallel tables.

---

## 1 · Objective (course-corrected)

Build a single pop-up container that lets a first-time shop visitor **send a chat message to the shop owner in one step**. Submitting the form:

1. Activates a NEX account using the submitted details (name, phone, email, country).
2. Delivers the visitor's first message into the real NEX Chat conversation with the shop owner.
3. Routes the visitor into that chat screen afterwards, with Install-NEX invitation shown per existing PWA rules.

This replaces the current two-button `ShopChatRegistrationPopup` (route-to-signup pattern) with an inline form + first-message pattern. The flow is identical on every shop template (X-Rated, cover, future verticals).

---

## 2 · Terms

| Term | Meaning |
|---|---|
| **Pop-up** | The inline modal that collects details + first message. Replaces today's two-button `ShopChatRegistrationPopup`. |
| **First-time visitor** | Any shop cover visitor whose session is not yet a NEX account AND not yet a provisional account. |
| **Returning provisional** | A visitor whose cookie already resolves to a provisional account (per `resolveNexAppOrProvisionalSession`). Pop-up is skipped; they land directly in the peer chat. |
| **Returning full account** | A signed-in NEX user. Pop-up is skipped; existing behaviour unchanged (`router.push('/nex-native/<slug>?open-chat=1')`). |
| **Shop owner** | `nex_business.owner_account_id`. |
| **Active account** | Whatever the owner's product decision §5.2 fixes to — provisional (fastest, lowest friction, no email verification) OR fully-verified (highest trust, requires email click). Both options analysed below. |

---

## 3 · User flows

### 3.1 · First-time visitor on any shop cover

1. Visitor taps the floating chat FAB on `/nex-native/<slug>`.
2. Server-resolved `isSignedIn === false` → pop-up appears (NOT the two-button one).
3. Pop-up fields in exact order: **Name · Phone · Email · Country · Message**.
4. Country defaults to `NEX_APP_COUNTRY` resolver output, visitor can change.
5. Visitor types message, taps **Send**.
6. Server: create/activate NEX account with submitted details + create peer-conversation with shop owner + store the first message in that conversation.
7. Client: close pop-up, navigate to `/nex-native/chat/peer/<ownerAccountId>` OR `/nex-native/chat/guest/<ownerAccountId>` (depending on §5.2 outcome).
8. Install-NEX invitation surfaced per `useShopInstallFlow` rules (§4 of 2026-11-24 install-timing memory). Never interrupts the chat step.

### 3.2 · Returning provisional visitor (same device, already submitted once)

- Cookie resolves to the previously-created provisional account.
- Pop-up is NOT shown on subsequent FAB taps on the same shop.
- Behaviour becomes identical to signed-in: `router.push('/nex-native/<slug>?open-chat=1')` which hands off to the peer chat page.

### 3.3 · Returning full account

- Unchanged: `router.push('/nex-native/<slug>?open-chat=1')`.

### 3.4 · Error paths

| Error | UI |
|---|---|
| Email already registered as full NEX account | Show "You already have a NEX account for <email>. Sign in to send." → secondary CTA routes to `/sign-in?next=/nex-native/<slug>?open-chat=1`. Message is held in local form state until sign-in returns. |
| Phone number taken by a different account | Soft warning with "use a different number or sign in" CTA. |
| Rate-limit tripped (`peer_message_guest`) | Inline "Try again in N minutes" per the sealed primitive's window/cap. |
| `PlaintextFrozenError` from `sendPeerMessage` (freeze ON) | **DECISION §5.3 blocker** — either the pop-up refuses to submit (honest error), or the backend takes an alternate path. Do NOT silently drop the message. |
| Validation (name < 1, phone malformed, email RFC shape, message length) | Per-field inline error. No submit until clean. |

---

## 4 · Reuse map

Everything in this design is wiring existing primitives — no new tables, no new RPCs, no new encryption pathways.

| Function | Path | Role in the new flow |
|---|---|---|
| `resolveNexAppOrProvisionalSession` | `src/lib/nex-native/first-conversation/provisional-session.ts` | Decide whether to show the pop-up or skip it. |
| Provisional account creation | `src/lib/nex-native/first-conversation/provisional-account-service.ts` | Mint the account from submitted details on Send. |
| `first-message-orchestrator` | `src/lib/nex-native/first-conversation/first-message-orchestrator.ts` | **Likely already the complete end-to-end orchestration.** Audit required (§7) before writing anything new. |
| `getOrCreatePeerConversation` | `src/lib/nex-native/peer-conversation-service.ts` | Resolve conversation between provisional account and shop owner. |
| `sendPeerMessage` | `src/lib/nex-native/peer-message-service.ts` | The sole enforced write path. Honors `NEX_CHAT_PLAINTEXT_FREEZE`. |
| `sendGuestMessageAction` | `src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts` | Server action already wired for "provisional account sends plaintext to shop owner" with rate-limit + freeze guard. |
| `recordIfAllowed` | `src/lib/nex-native/community/rate-limit.ts` | Rate-limit `peer_message_guest`. Already applied. |
| `useShopInstallFlow` | (per 2026-11-24 PWA memo) | PWA install invitation after the first message, not before. |
| `ShopChatRegistrationPopup` | `src/components/nex-native/business-chat/ShopChatRegistrationPopup.tsx` | **Current two-button popup — to be augmented or replaced** with the inline form variant. |

---

## 5 · Open decisions blocking implementation

These MUST be resolved by the owner before code is written. Each has material security/UX implications.

### 5.1 · Which popup — augment or replace?

- **(a) Replace** the current `ShopChatRegistrationPopup` with a single inline-form variant everywhere. All three callers (FAB, product sheet, anon preview) get the new flow uniformly. Simpler, one surface to test.
- **(b) Add a new popup** (`ShopChatFirstMessagePopup`) and keep the two-button one as a fallback for cases where instant activation isn't acceptable (e.g. regulated verticals).

Recommendation: **(a) Replace**. Matches owner's "same flow for all shop templates".

### 5.2 · What does "account active" mean? (critical)

- **(α) Provisional account** — fastest, zero friction, no email verification. Leverages the existing fully-working `provisional-account-service` + `sendGuestMessageAction` pipeline. Visitor's account is "active for chat" but limited (no device key, no E2E, no sign-in from another device without a verification upgrade step). This is what today's `/chat/guest/[ownerAccountId]` flow does.
- **(β) Fully-verified account** — email verification click required before first message is visible to merchant. Higher trust, matches brand integrity, but adds a "please check your email" step between Send and merchant delivery.
- **(γ) Instant-activated-with-deferred-verification** — account is active immediately for sending, email verification runs in parallel and account is downgraded if verification isn't completed in N hours. Hybrid.

Recommendation: **(α) Provisional** — because (1) it's already built and tested, (2) matches "appears in chat" UX expectation with no email detour, (3) the existing freeze-guard already prevents silent plaintext persistence, (4) merchants can still see the submitted email + phone on the sender's profile row and verify out-of-band.

### 5.3 · Reconcile with the 2026-11-09 device-only E2E seal (**blocker**)

The sealed `NEX_CHAT_PLAINTEXT_FREEZE` policy defaults fail-closed. `sendPeerMessage` throws `PlaintextFrozenError` for provisional senders. Today's `/chat/guest` surface renders this as "guest chat not available · please sign in" — i.e. guest messaging is gated OFF by default.

Three ways forward, each with trade-offs:

- **(P) Keep the freeze ON** — the pop-up collects details, the Send button is permanently disabled with "Chat with us is temporarily unavailable". This makes the feature non-functional in production. Not viable for launch.
- **(Q) Relax the freeze for `shop_first_message` only** — a narrow, logged, rate-limited exception at the `sendPeerMessage` choke point. New typed action `peer_message_shop_first` with its own rate-limit bucket. Audit event `nex_shop_first_message_relaxed_send` for every write. Preserves E2E for all other peer traffic.
- **(R) Client-side device key bootstrap at submit** — generate a device key in the pop-up, encrypt the first message, upload ciphertext. Preserves E2E. BUT requires the shop owner's public key to be fetchable anonymously (new public endpoint) and requires a full key-ceremony inside a tap flow (keygen + Diffie-Hellman + first-message encryption) that today's anon surface doesn't do.

Recommendation: **(Q) Relax-for-this-one-action** with explicit audit event. The seal's purpose is to prevent *silent* plaintext persistence; a named, logged, rate-limited, single-action exception for the publicly-advertised "chat with this shop" flow is architecturally honest. Reversible — if abused, flip `NEX_CHAT_PLAINTEXT_FREEZE_SHOP_FIRST=0` and the Send button goes grey.

**This decision cannot be made by engineering** — it adjusts a sealed security invariant and requires named owner approval.

### 5.4 · Email reply invitation

- Does the shop owner see the visitor's email on the Nex Chat sender profile row only? Or do we send the owner an email notification "you have a new shop-chat message, reply via NEX"?
- Recommendation: **profile-only in Phase 1**. Avoids email-adapter wiring (console-only today) and matches "it appears in NEX Chat" scope.
- Phase 2 (separate authorisation): email notification to merchant + courtesy email to visitor with the Install-NEX link.

### 5.5 · Country field default

- Use `NEX_APP_COUNTRY` env default OR `Accept-Language` header OR IP-geo? Recommendation: `NEX_APP_COUNTRY` env (deterministic per deployment identity), visitor overrides freely.

### 5.6 · Rate-limit bucket

- Use existing `peer_message_guest` bucket OR create a new `shop_first_message` bucket with its own window/cap?
- Recommendation: new bucket `shop_first_message` with tighter window (e.g. 1 per 60s per IP-hash, 5 per 24h per IP-hash) because anonymous abuse surface is wider than the authed-provisional case. Needs sealed primitive extension — a sandbox-only migration for the CHECK constraint.

### 5.7 · Multiple-shop scoping

- Does a provisional account minted on Shop A let the visitor instantly chat Shop B without the pop-up? Recommendation: **yes** — once they have a NEX identity on this device, don't re-ask for details. New shop → FAB tap → direct chat. Matches "same flow across all shops" reading of the course correction.

### 5.8 · Install-NEX invitation ordering

Per 2026-11-24 install-timing seal: install prompt ONLY after "meaningful interaction (add contact or send first message)". Sending the first shop message IS the meaningful interaction, so the invitation fires at that moment. Confirm: should the invitation sit inside the chat screen after navigation, OR be the final frame of the pop-up before navigation? Recommendation: **inside the chat screen** — doesn't interrupt the Send→see-reply flow.

### 5.9 · Honesty copy (sealed honesty invariants)

The existing popup's unit tests (`shop-chat-registration-popup.test.ts`) assert:

- Explains the account is the customer's OWN NEX, not the shop's.
- Promises replies arrive in customer's own NEX Chat.
- Never claims SMS / phone / push verification is in place.

New copy must maintain all three. Additional honesty: do NOT claim "end-to-end encrypted" on the first-message pop-up if decision §5.3 chooses option (Q). Say instead "your message is delivered directly to the shop owner's NEX account".

### 5.10 · Account linking on later full-signup

If the visitor later completes full registration (same email), do we merge the provisional account's chat history into the new full account? Recommendation: **yes, merge**, via the existing provisional-upgrade pathway (if it exists — audit required). Otherwise, document as Phase 2.

---

## 6 · Non-objectives (explicit)

- **No new tables.** Rev 1's `nex_shop_enquiry` + `nex_shop_enquiry_reply` are dropped.
- **No new migration** unless §5.6 chooses the new rate-limit bucket (sandbox-only, owner-approved via named phrase).
- **No HQ "Shop Enquiry" surface.** Messages appear in the shop owner's normal NEX Chat inbox.
- **No separate email-reply channel.** Owner replies through NEX Chat like any other peer.
- **No weakening of the device-only chat storage rule** for anything other than the single `shop_first_message` action, if §5.3 picks (Q).
- **No live Stripe/PayPal.** Payments are a separate journey.
- **No touching the sealed Emergency Help SOS flow.**

---

## 7 · Required audits before implementation

Must complete these reads before writing code (owner directive: "inspect first"):

1. **`first-message-orchestrator.ts`** — confirm whether it already does `(create provisional + create conversation + send first message)` as a single atomic action. If yes, the new pop-up calls this one function; if no, we document the missing piece before building it.
2. **`provisional-account-service.ts`** — confirm the exact input shape it needs (name/email/phone/country?) and whether it supports idempotent re-use (same email on later shop).
3. **`first-message-http.ts`** — check if there's already an HTTP endpoint we can post to from the pop-up; prefer this over a new API route.
4. **Full `nex_peer_conversation` + `nex_peer_message` read path** — confirm the shop owner's inbox already renders provisional-sender rows (i.e. no HQ-side work required to show the message).
5. **`ShopChatRegistrationPopup` callers** — enumerate every mount site (3 known: FAB, product sheet, anon preview). All three must get the new flow when §5.1 resolves (a).
6. **Install-flow hook** — read `useShopInstallFlow` to see where the "meaningful interaction" signal is accepted and confirm the first-message submit fires it correctly.

---

## 8 · Verification plan (Rule 6 / Rule 8)

| Layer | Test | Status enum target |
|---|---|---|
| Unit | Form validation (name, phone E.164, email, country ISO-3166, message length). | BUILT → VERIFIED |
| Unit | Honesty copy invariants hold on the new popup variant. | BUILT → VERIFIED |
| Integration | Server action: first submit creates provisional account + peer conversation + inserts first message row. | BUILT → VERIFIED |
| Integration | Second submit from same device skips account creation (idempotent). | BUILT → VERIFIED |
| Integration | Rate-limit kicks in at configured threshold. | BUILT → VERIFIED |
| Integration | Freeze policy honored: with freeze ON and no §5.3 exception, submit is rejected with honest UI (no silent drop). | BUILT → VERIFIED |
| E2E (Playwright) | Visitor fills pop-up on `/nex-native/x-rated-tool-belts` → Send → navigates to chat → message visible. | BUILT → VERIFIED |
| E2E | Shop owner (HQ) sees the message in their normal NEX Chat inbox with the provisional sender identified. | BUILT → VERIFIED |
| E2E | Install-NEX invitation fires AFTER first message, not before. | BUILT → VERIFIED |
| Adversarial | Submit with same email that already has a full NEX account → cannot silently take it over. | BUILT → VERIFIED |

No `VERIFIED` status set without recorded command + evidence per Rule 8.

---

## 9 · Approval gates (Rule 7)

- Reading/auditing existing files: no approval needed.
- Writing the new popup component + server action handler: no approval needed (sandbox dev, no DB schema change).
- **Named approval needed** if §5.3 resolves (Q) — relaxing the plaintext freeze for `shop_first_message`. Proposed phrase: `APPROVE SHOP FIRST-MESSAGE PLAINTEXT RELAX (shop_first_message action · logged · rate-limited · 2026-11-28)`.
- **Named approval needed** if §5.6 resolves "new rate-limit bucket" — sandbox migration applying a CHECK-constraint widening on the sealed rate-limit primitive. Proposed phrase: `APPROVE MIG XXX SANDBOX APPLY (shop_first_message rate-limit bucket)` once migration number assigned.
- No prod DB. No commits/pushes outside the standing 2026-11-27 policy on `release-audit-v1-2026-11-14`. No live-mode Stripe/PayPal.

---

## 10 · Rollout

1. Audit (§7) — report findings to owner. No code changes.
2. Owner decisions on §5.1 / §5.2 / §5.3 / §5.4 / §5.6 / §5.10.
3. If §5.3 (Q) and §5.6 chosen — draft migration (no apply) + draft the freeze-policy env var extension. Owner review.
4. Implement new popup variant + server action + navigation wire.
5. Playwright + unit tests per §8.
6. Full regression against `/nex-native/x-rated-tool-belts`, `/nex-native/<another-template>` to prove "same flow for all shop templates".
7. Rule 9 report with exact files / tests / evidence.
8. Commit under standing 2026-11-27 policy to `release-audit-v1-2026-11-14`.

---

## 11 · Open questions for the owner (delta vs Rev 1)

1. **§5.1** — Replace the current popup, or add alongside? (Recommendation: replace.)
2. **§5.2** — Provisional account (α), full-verified (β), or hybrid (γ)? (Recommendation: α.)
3. **§5.3** — How to reconcile with the E2E plaintext-freeze seal? (Recommendation: Q, with named approval phrase.)
4. **§5.4** — Email notification to merchant in Phase 1, or profile-only? (Recommendation: profile-only.)
5. **§5.6** — New rate-limit bucket or reuse existing? (Recommendation: new, sandbox migration behind named approval.)
6. **§5.7** — Shop-scoped or device-scoped provisional identity? (Recommendation: device-scoped.)
7. **§5.10** — Auto-merge provisional into full account on later signup? (Recommendation: yes if pathway exists; else Phase 2.)

Answers unblock implementation. No code is written until §5.3 is resolved — that is the sealed-invariant decision only the owner can take.
