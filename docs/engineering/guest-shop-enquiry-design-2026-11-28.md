# Shop Chat First-Message / Guest Enquiry · Design Document (Rev 3)

**Owner-authorised:** 2026-11-28
**Author:** engineering
**Status:** DRAFT Rev 3 · first implementable revision · awaiting named approvals before mutating-code begins
**Scope:** X-Rated Tool Belts first, then every shop template, under the new owner constraint "separate from E2E NEX Chat unless an approved secure architecture supports integration · no plaintext storage · no encryption weakening".

---

## 0 · Revision history

| Rev | Date | Change | Driver |
|---|---|---|---|
| 1 | 2026-11-28 | Separate `nex_shop_enquiry` channel distinct from NEX Chat, plaintext storage intentional, email-only reply, guests stay guests. | Owner brief earlier 2026-11-28. |
| 2 | 2026-11-28 | Pop-up details activate NEX account, first message enters real NEX Chat. Required relaxing the E2E plaintext-freeze seal for `shop_first_message`. | Owner course-correction mid-session. |
| **3** | **2026-11-28** | **Final architecture.** Separate channel (Rev 1 shape) BUT with no plaintext storage anywhere — email is the single source of truth for the message body, DB stores only non-reversible metadata. Merchant replies via email thread. | Owner constraint 2026-11-28 (post-push 7eda0b7f): *"Keep this separate from ordinary E2E NEX Chat unless an approved secure architecture supports the integration. Do not introduce plaintext storage or weaken existing encryption."* |

Rev 2's "enters NEX Chat with account active" direction is **dropped** because it required relaxing the sealed 2026-11-09 plaintext-freeze on `nex_peer_message`, which the owner has now explicitly forbidden.

Rev 3 reconciles the two constraints: separate from NEX Chat ∧ no new plaintext storage. The reconciling pattern is **"email-as-body"** — the enquiry body is delivered directly to the merchant's email and never persisted in NEX. The DB stores only hashed sender-identity + timestamp + status for inbox listing and replay-prevention.

---

## 1 · Objective (Rev 3)

> Customer opens X-Rated shop → presses Contact Shop → enters name, telephone, email, country and message → submits → enquiry reaches X-Rated HQ inbox → merchant replies through a verified delivery channel. — Owner, 2026-11-28.

The pop-up is a single-step guest-enquiry form. On submit:

1. The message body is sent as an email to the shop owner's verified merchant email (verified delivery channel #1).
2. A metadata-only row is persisted in `nex_shop_enquiry` — hashed sender identity, timestamp, status, no body, no recoverable plaintext.
3. The HQ shop inbox displays the row with "message delivered to your email at <merchant-address>".
4. Merchant replies by replying to the email; reply hits the customer's submitted address (verified delivery channel #2).
5. Visitor is shown a confirmation and the existing "Install NEX" invitation per the 2026-11-24 PWA timing rules.

Scope is X-Rated Tool Belts first; the same pop-up, endpoint, and email adapter are reused unchanged by every shop template once X-Rated is proven.

This supersedes Rev 2's "message appears in NEX Chat" direction.

---

## 1A · Why email-as-body is the chosen reconciliation

The owner has two overlapping constraints that any Rev 3 must satisfy simultaneously:

- **C1** — no weakening of the 2026-11-09 device-only E2E seal for `nex_peer_message`.
- **C2** — no new plaintext storage anywhere.

C1 rules out Rev 2 (which persisted a plaintext row in `nex_peer_message` under a relaxed freeze flag).
C2 rules out Rev 1's original `nex_shop_enquiry.message_body text NOT NULL` column.

Three architectures were considered for Rev 3; only one meets both:

| Option | Body location | Verdict |
|---|---|---|
| (a) Encrypt-at-rest in a new table (server-side symmetric key) | Encrypted blob in DB | Rejected — "encrypted at rest" is not the same as the device-only E2E seal; it's a plaintext-equivalent for anyone with server access. Violates spirit of C2. |
| (b) Public-key encrypt to merchant's uploaded public key | Ciphertext in DB, decryption client-side | Rejected — merchants today don't have an NEX device-key chain; would require new keyring infra and reliable merchant device onboarding before shop enquiries are usable at all. Blocks launch. |
| **(c) Email-as-body · metadata-only DB row** | **Only in the email provider's transit** | **Chosen.** No DB plaintext. No new encryption subsystem. Reuses the already-planned email adapter. Verified delivery proof = provider's 2xx+message-id. Reply path is the email thread. |

Trade-offs of (c), documented honestly:

- The email provider (e.g. Resend/Postmark/Brevo) now holds the plaintext transiently in their logs. Their retention policy becomes part of NEX's data-handling surface. This must be disclosed in the shop's privacy copy.
- Merchants without a working email address cannot receive enquiries. Onboarding gate: `nex_business.public_email` must be a non-empty RFC-5322-shaped string before the shop's FAB enables the pop-up. Shops without `public_email` render the FAB in a disabled state with "This shop is not accepting enquiries yet" copy. No separate `contact_email_verified` column exists in the current schema (migration 014 introduced `public_email` only); if a merchant sets a wrong address, delivery fails loudly (`delivery_status = 'failed'`) and the HQ inbox surfaces the failure. Formal verification of the address is a Phase 2 enhancement (double opt-in during shop onboarding).
- Attachment flow is deferred — Phase 1 is text-only. Image attachments would require either the provider's inbound-mail features (complex) or a separate authenticated upload surface (out of scope).

---

> **Rev 3 sections below are the authoritative design.** All Rev 2 implementation instructions (account activation, peer-chat writes, plaintext-freeze relax) are removed from this document. The §0 revision history retains the trail of why.

---

## 2 · Terms

| Term | Meaning |
|---|---|
| **Pop-up** | Inline modal on every shop template that collects the visitor's first contact. Replaces today's two-button `ShopChatRegistrationPopup`. |
| **Enquiry** | One form submission. Produces exactly one email to the merchant and (on successful handoff to the provider) exactly one metadata-only row in `nex_shop_enquiry`. |
| **Email delivery proof** | Email provider returned a 2xx response **and** a provider message-id. Persisted on the metadata row so support debugging can prove that NEX handed the enquiry off. |
| **Shop owner email** | `nex_business.public_email`. Must be present (non-empty, RFC-5322-shaped). Shops without `public_email` render a disabled FAB state. No separate `_verified` column exists today (see §1 Trade-offs). |
| **Metadata-only row** | A `nex_shop_enquiry` row that intentionally does NOT store the message body, the visitor's email, phone, name, raw IP, or user-agent. It holds only values that are either public to the shop owner (`shop_business_id`, `created_at`, `delivery_status`, `email_provider_message_id`, `sender_country_code`) or non-reversible operational hashes (`sender_identity_hmac`, `rate_limit_key_hmac`) with an explicit purpose + retention policy (see §6). |
| **Guest** | A visitor who submitted the form. In Rev 3 a guest does NOT get a NEX account minted. The guest's identity, for the lifetime of this enquiry, is the email address they placed on the message — which only the merchant and the email provider see. |

---

## 3 · End-to-end flow (Rev 3)

### 3.1 · Happy path

1. Visitor opens `/nex-native/<shop-slug>`.
2. Server resolves `isSignedIn === false` and `shop.public_email` is a non-empty RFC-5322-shaped string. Pop-up mounts.
3. Visitor fills **Name · Phone · Email · Country · Message** and taps **Send**.
4. Client POSTs to `/api/nex-native/shop-enquiry` (not a server action — a proper route so rate-limit headers surface).
5. Server validates fields (§4), enforces rate-limit (§8), resolves the shop + merchant email, and calls `DEFAULT_ADAPTER.send(...)`.
   - While the Resend bridge is not activated, `DEFAULT_ADAPTER` is still `ConsoleAdapter`, so the call is a dry-run that returns `{ ok: true, dry_run_reason }`.
   - Under activation, the same call delivers to Resend.
6. On adapter `ok: true`, the server inserts the metadata-only row (§6) with `delivery_status = 'delivered'` (or `'dry_run'`) and the provider's message-id.
7. On adapter `ok: false`, the server inserts the row with `delivery_status = 'failed'` and the error string. **No silent success.**
8. Server response is `{ ok: true, dry_run: boolean, delivery_status }` — the pop-up renders an honest confirmation that distinguishes "delivered" from "dry-run (console)" from "failed".
9. Merchant receives the email; replies by hitting Reply in their mail client. The reply arrives at the visitor's submitted address. NEX does not see or store the reply.
10. The pop-up shows the confirmation screen; the sealed 2026-11-24 PWA install-timing rules fire `useShopInstallFlow` once the first interaction is complete.

### 3.2 · Returning visitor on same device

The device cookie `nex-enquiry-session` carries a long-lived random ID (not derived from any PII). If the cookie is present, the pop-up pre-fills the last-used name + country only (never email or phone) and the server-side duplicate-check (§8) still runs.

### 3.3 · Signed-in visitor on a shop cover

Signed-in visitors never see the pop-up. The FAB routes them to `/nex-native/chat/peer/<ownerAccountId>` as it does today (unchanged). Rev 3 adds nothing to the signed-in path.

### 3.4 · Failure paths

| Condition | Visitor sees | Server action |
|---|---|---|
| Validation fails | Per-field inline error. No submit. | None. No DB write. |
| Shop has no `public_email` | FAB is disabled with "This shop is not accepting enquiries yet". | None. Pop-up never opens. |
| Rate-limit tripped | Inline "Try again in N minutes". | 429 response with `Retry-After`. No DB write. No email send. |
| Duplicate detected (same sender_identity_hmac + shop within 10 min) | "We just received an enquiry from you — the shop has it. Try again in a few minutes." | 429 response. No DB write. No email send. |
| Shop lookup failed | "This shop is not available right now." | 404 response. No DB write. |
| Adapter `ok: false` | "We couldn't deliver this right now. Please try again shortly." Confirmation screen does NOT say delivered. | Row inserted with `delivery_status = 'failed'`. No retry inside this request. |
| Server threw unexpected | "Something went wrong. Please try again." | 500 response. Error audit event. No partial row written (write is best-effort after adapter). |

Owner guardrail: there is **no fake-success path**. If the email didn't go, the UI says it didn't go.

---

## 4 · Form + validation (customer-facing)

Fields presented in exactly this order:

| Field | Shape | Server validation |
|---|---|---|
| Name | Short text | `1..80` chars, trimmed, no control characters. |
| Phone | International shape | E.164 pattern `^\+?[1-9]\d{6,14}$` after stripping spaces/dashes. Optional in Phase 1 (merchant may not need it); if present must pass. |
| Email | Email address | RFC 5322 shape check + MX host length ≤ 253. Normalised to lowercase for hashing only. Original casing used verbatim in the outgoing email's `To:`. |
| Country | ISO-3166 alpha-2 | Default from `NEX_APP_COUNTRY` env. Visitor may change. Stored as `sender_country_code`. |
| Message | Long text | `20..4000` chars. Trimmed. No HTML — rendered as `text/plain` in the outgoing email. |

Client-side validation mirrors server-side but is not trusted; the server re-validates every field.

Honesty copy (sealed 2026-11-27 rules apply):

- Pop-up header: "Send a message to this shop" (never "Chat with this shop" — Rev 3 is email, not chat).
- Helper under Message: "Your message is delivered by email. The shop owner will reply to the email address you enter above."
- Confirmation on success: "Delivered to this shop's inbox" — only shown when the adapter returned `ok: true` and the row is `delivery_status = 'delivered'`.
- Confirmation on dry-run: "Preview mode — your message was not sent. Email delivery is not yet active." — shown whenever the adapter is a dry-run adapter (console / mock).

No claim of "end-to-end encrypted". No claim of "private chat". No claim of "SMS verified".

---

## 5 · Email delivery mechanics

### 5.1 · Default path (not yet activated)

- `DEFAULT_ADAPTER` is `ConsoleAdapter` until the owner activates the Resend bridge (§5.3).
- In this default state, a `shop-enquiry` submission runs the full validation + ownership + rate-limit + DB-write pipeline, invokes `DEFAULT_ADAPTER.send(...)`, receives `{ ok: true, dry_run_reason }`, writes the row with `delivery_status = 'dry_run'`, and surfaces the honest "Preview mode" copy.
- No real customer is misled, no real email is sent, and the integration is fully exercised against the sandbox.

### 5.2 · Activated path (Resend)

- `DEFAULT_ADAPTER` becomes `ResendBridgeAdapter` (committed `0b10f8e4`, inactive) by calling `setDefaultAdapter(new ResendBridgeAdapter())` at a single boot location.
- Delivery semantics:
  - `From:` is `${NEX_EMAIL_DEFAULT_FROM}` — owner-controlled verified domain sender.
  - `Reply-To:` is the visitor's submitted email. This is what makes the merchant "reply directly to the customer" workflow work. **This is a deliberate exposure of the visitor's email to the merchant — it is the entire point of the feature.** It is not stored in the NEX DB.
  - `To:` is the merchant's `nex_business.public_email`.
  - `Subject:` is `"New enquiry via NEX · <shop name>"`.
  - Body is `text/plain` with a short header line (country, enquiry id) followed by the visitor's message verbatim. No HTML.
  - A footer line reminds the merchant that Reply goes directly to the visitor's email and does not route through NEX.
- Provider return value: the Resend wrapper returns `ok: true` with a message-id on 2xx, else `ok: false` with `reason`. The bridge forwards both.

### 5.3 · Sandbox configuration required to activate

For a developer to stand up a sandbox-activated Resend path:

1. Set `RESEND_API_KEY` in the sandbox environment. **Never** commit the value. The `.env.local` file is gitignored.
2. Set `NEX_EMAIL_DEFAULT_FROM` to a Resend-verified sender on the sandbox domain, e.g. `NEX Sandbox <no-reply@sandbox.example.invalid>`.
3. Confirm `src/lib/nex/email/adapters/resend.ts` resolves the key without throwing on module load.
4. Call `setDefaultAdapter(new ResendBridgeAdapter())` from one boot location (e.g. a dedicated `src/lib/nex-native/email-send-adapter-boot.ts` imported from `src/instrumentation.ts`).
5. Smoke: issue one enquiry with a sandbox merchant whose `public_email` is a test inbox you own. Verify the message-id in Resend's dashboard matches the row written to `nex_shop_enquiry.email_provider_message_id`.

**Activation is not performed in this cycle.** Doing so requires a named owner approval and a verified sandbox sender address. Until then the ConsoleAdapter dry-run path is the only path exercised.

---

## 6 · `nex_shop_enquiry` — the metadata-only record

### 6.1 · Purpose statement (why the row exists at all)

A metadata-only row is written **only** because these four operational needs cannot be met by the email provider alone:

1. **HQ inbox listing.** HQ operators need to see "N enquiries received in the last 7 days for this shop", scoped per business, without granting them access to any email provider dashboard or the visitor's email content.
2. **Duplicate-submission detection.** Without a short-lived identity hash, an abusive client can hammer the same shop with identical submissions and drive the merchant's email provider bill up, even inside the rate limit window.
3. **Delivery accountability.** If a visitor says "my enquiry didn't arrive", NEX needs to be able to say "we did (or did not) hand it to the provider at time T with message-id M". Without the message-id on file, this is unanswerable.
4. **Failure visibility.** The row with `delivery_status = 'failed'` plus the provider error is the only in-NEX signal that enquiries are failing. Without it, we cannot detect provider outages.

If any of these four needs ceases to apply, the corresponding column must be dropped.

### 6.2 · Exact column list (metadata-only — no PII)

| Column | Type | Content | Purpose | Retention |
|---|---|---|---|---|
| `id` | `uuid` | Random v4. | Primary key, idempotency token in logs. | 30 days after `created_at`. |
| `shop_business_id` | `uuid` | FK → `nex_business.id`. | Scope the row to one merchant for HQ listing + ownership checks. | 30 days. |
| `created_at` | `timestamptz` | Row insert time, server clock. | HQ listing + duplicate-window bound. | 30 days. |
| `delivery_status` | `text` CHECK IN (`'dry_run'`, `'delivered'`, `'failed'`) | What happened at the adapter. | Failure visibility + support debugging. | 30 days. |
| `email_provider_message_id` | `text` NULL | Provider's id when `delivery_status` ∈ `delivered`. | Support debugging ("did it leave NEX?"). | 30 days. |
| `email_provider_error` | `text` NULL | Short provider error when `delivery_status = 'failed'`. | Failure visibility. | 30 days. |
| `sender_identity_hmac` | `text` | HMAC-SHA256 of the lowercase-normalised visitor email, keyed by a daily-rotated server secret `NEX_SHOP_ENQUIRY_HMAC_KEY` with a per-day salt (`YYYYMMDD`). | Duplicate detection within the 10-min window. **Not reversible back to the email** — the daily rotation means the hash loses dedup value after midnight server time and is operationally useless for identifying the visitor a day later. | 30 days (but value is already stale after one day). |
| `rate_limit_key_hmac` | `text` | HMAC-SHA256 of the request IP, same keying. | Correlate rate-limit evictions with enquiry rows (never the IP itself). | 30 days. |
| `sender_country_code` | `text` CHECK length = 2 | Visitor-submitted ISO-3166 alpha-2 (defaults to `NEX_APP_COUNTRY`). | HQ listing + regional analytics. Not PII on its own. | 30 days. |

Columns **explicitly excluded** — these must never be added without reopening the privacy design:

- Message body / subject / any derivative thereof.
- Raw email address, raw phone, raw IP, raw user-agent, geolocation.
- Visitor display name.
- Permanent hash of email/phone (permanent-salt hashes are trivially reversed against a dictionary and are not anonymous).

Owner guardrail captured verbatim 2026-11-28: *"a hash is not automatically anonymous data"*. The design treats `sender_identity_hmac` and `rate_limit_key_hmac` as operational tokens that expire — see §6.3.

### 6.3 · Retention + deletion

- Hard retention cap: **30 days** from `created_at`. After that the row serves none of the four needs in §6.1.
- Deletion mechanism (Phase 1): a sweep SQL function `nex_shop_enquiry_purge_old()` deletes rows with `created_at < now() - interval '30 days'`. Called daily by a sandbox cron (scheduled by the same mechanism as `nex_purge_delivered_encrypted` from mig-094).
- Key rotation: `NEX_SHOP_ENQUIRY_HMAC_KEY` is a server env secret. It is appended with `YYYYMMDD` before HMAC so the hashing scheme rotates automatically every midnight UTC. Past hashes cannot be re-generated after the day ends, which means dedup only works inside the day (acceptable — dedup window is 10 min).
- HQ visibility: HQ reviewers see count + `delivery_status` + country + timestamp. HQ admins can delete a specific row early via an audit-logged admin action (useful for GDPR-style erasure requests).
- Erasure request: because no email is stored, a visitor requesting erasure of their enquiry needs to identify the row by `id` (which the pop-up echoes back on the confirmation screen). This is called out in §10.

### 6.4 · RLS

- Service-role writes (API route uses `nexSupabaseAdmin` after HQ-independent ownership check).
- Authenticated reads restricted to `nex_business.owner_account_id = auth.uid()`.
- HQ reviewer reads bypass RLS via service-role in `fetchShopEnquiryMeta()` helper; HQ gate checked upstream.
- No public read.

---

## 7 · HQ inbox + merchant reply

### 7.1 · What the HQ operator sees

- The HQ per-shop command surface (`/nex-native/hq/shops/<slug>`) gains an **Enquiries** panel sibling to the existing **Peer messages** panel. These are two distinct inboxes because they are two distinct delivery mechanisms — presenting them together would be dishonest.
- Each row shows: `created_at` (local time), `delivery_status` badge (delivered / dry-run / failed), `email_provider_message_id` truncated, `sender_country_code`. **No body. No sender identity.**
- A failed row surfaces the provider error.
- A delivered row links to the provider dashboard (one-click, opens a new tab) for the HQ operator to see the actual email if required — but this is an operator-only action, not part of the merchant view.

### 7.2 · How the merchant replies

- The email arrives in the merchant's regular email inbox.
- `Reply-To:` is set to the visitor's address, so a plain Reply goes to the visitor directly.
- NEX does not see or store the reply. It does not appear in NEX Chat. It does not appear in the HQ Enquiries panel.
- UI copy in the Enquiries panel states this explicitly: *"Replies go directly between the shop owner and the customer by email. NEX does not retain the content of either message."*

### 7.3 · Why this is deliberately not NEX Chat

- NEX Chat is device-only E2E encrypted (2026-11-09 seal). The guest enquiry flow does not have a device key on either side at first contact, so routing through `nex_peer_message` would either (a) require relaxing the seal (dropped in Rev 2) or (b) require a full key-ceremony inside an anonymous pop-up (rejected — blocks launch).
- Email is the honest second-best: the content is in the email provider's logs during transit, is visible to merchant + visitor only, is not persisted in NEX, and the merchant's existing email workflow is reused.
- The Enquiries panel's visual language is deliberately distinct from the Peer-messages panel so no operator confuses the two channels.

### 7.4 · Later upgrade path

Once a visitor becomes a NEX account holder (via a separate signed-in signup, not through this flow), subsequent enquiries from the same email use the normal NEX Chat flow and bypass this path. The upgrade is one-way; past email enquiries do not retrospectively enter NEX Chat.

### 7.5 · Verifiability of merchant-reply delivery

Owner directive 2026-11-28: *"an explicit, verifiable delivery mechanism that distinguishes email delivery from normal NEX Chat; preserve merchant identity in HQ UI; preserve conversation history."* Addressed in exactly three parts — each is a verifiable artefact:

1. **Outgoing-direction verification (NEX → merchant).** The authoritative signal is `nex_shop_enquiry.delivery_status`:
   - `'delivered'` requires the adapter to have returned `ok: true` AND `is_dry_run === false`. For the activated Resend path, the provider's 2xx response is the external truth; the message-id goes into `email_provider_message_id` and is independently verifiable in the Resend dashboard.
   - `'dry_run'` is the honest "we would have delivered" state when `DEFAULT_ADAPTER` is the ConsoleAdapter. The UI shows **"Preview mode — your message was not sent"** verbatim (sealed in §4).
   - `'failed'` carries the provider error in `email_provider_error`, capped at 500 chars by the DB CHECK.
   No status is ever synthesised client-side. The HQ panel renders `delivery_status` from the server; a faked positive requires modifying the DB row.

2. **Merchant identity in HQ UI.** The HQ Enquiries panel always shows the owning shop's display name + slug + `public_email` (the destination the enquiry was routed to). When a merchant later migrates their `public_email` or when an HQ operator wants to reconcile "did Shop X actually receive this?", the stored `public_email` at write-time is NOT recorded in `nex_shop_enquiry` — the merchant's current `public_email` in `nex_business` is the source of truth. Rationale: storing a snapshot would require a new column that is itself PII of the merchant and would drift from the merchant's actual mailbox. If a merchant later changes their address, the HQ panel shows the current address; the enquiry's `email_provider_message_id` is the audit trail of what was actually sent.

3. **Return-direction conversation history (merchant → visitor).** By design, NEX does not retain the merchant's reply. This is a deliberate boundary, not a limitation:
   - The HQ Enquiries panel shows ONE row per outbound enquiry · never an unfolding thread.
   - The panel copy states explicitly: *"NEX does not retain replies between the merchant and the customer. The email thread lives in both parties' email clients."*
   - For "preserve conversation history" in the owner-directive sense, the enduring record is: (a) the `nex_shop_enquiry` metadata row within its 30-day retention window, and (b) the merchant's own mail client's thread. Together these two sources reconstruct any audit need without NEX ever being a middleware that reads merchant replies.
   - If a merchant deletes the email from their mail client AND the retention window elapses, the record is gone from NEX by design. This is called out in the shop's privacy copy (see §10).

The three parts above are the whole "verifiable delivery" story. Any proposal to persist reply content, mirror to NEX Chat tables, or synthesise a thread view must reopen the 2026-11-28 privacy seal explicitly.

---

## 8 · Rate limiting + abuse prevention

### 8.1 · New action bucket `shop_enquiry_submit`

Extends the sealed `SECURITY_RATE_LIMITS` map in `src/lib/nex-native/security-rate-limit.ts`:

```
shop_enquiry_submit: {
  windowMinutes: 15,
  maxPerWindow: 5,          // per hashed IP
  fallback: "in_memory",
  rationale: "Per hashed IP · the public enquiry endpoint has an unlimited anonymous surface. 5 per 15 min is enough for a legitimate visitor who mistyped and retried; caps a script-driven mail-bomb at 480/day per IP. Daily cap enforced additionally via duplicate hash."
}
```

The DB-table CHECK constraint on `nex_security_rate_limit.action` enumerates allowed values. Adding a new value requires a sandbox migration — see §11 approval gates.

### 8.2 · Duplicate suppression

- Within 10 minutes of a `delivered` row for the same `(shop_business_id, sender_identity_hmac)`, further submissions return 429 before touching the adapter.
- Window intentionally short — the daily HMAC key rotation already clips the horizon.

### 8.3 · Other abuse surfaces addressed

- **Mail-bomb a single merchant**: capped by the rate-limit bucket + duplicate suppression.
- **Spam a dictionary of shops**: the 5-per-15-min IP cap stops drive-by scans. Captcha is deferred to Phase 2; rate-limit is sufficient for launch per owner directive "merchant-owned, not Google-owned".
- **Reflect abusive content to merchants**: outgoing email is `text/plain`, no HTML rendering. The merchant's own mail client is the final filter.
- **Harvest shop contact emails via the pop-up**: merchant email is never echoed to the client. The form only knows "this shop accepts enquiries".
- **Bypass the duplicate check by rotating email case/format**: email is normalised to lowercase + trimmed before HMAC.

---

## 9 · Failure + retry behaviour

### 9.1 · Within-request semantics

- Adapter call is **not retried in the request**. A `failed` row is written, the 2xx response carries `delivery_status: 'failed'`, and the UI invites the visitor to try again.
- Rationale: retry-on-failure masks provider outages from the operator and double-charges on a transient timeout where the message actually went through.

### 9.2 · Out-of-band retry

Deferred to Phase 2. An HQ admin may manually re-send a `failed` row via a future admin action; no automatic retry worker in Phase 1.

### 9.3 · Partial failure recovery

- **Adapter succeeded but DB write failed**: the email left NEX, so we cannot deny delivery. The route logs the orphan `message_id` to the server audit log so an HQ operator can reconcile manually. The visitor is still shown "Delivered" because, from their vantage, it was.
- **DB write succeeded but adapter failed**: reflected honestly as `failed` row + "could not be delivered" copy.

---

## 10 · Privacy + security boundaries

### 10.1 · What NEX stores

- `nex_shop_enquiry` metadata-only row for 30 days.
- Server-side audit log entries (success/failure counts, no PII) via the existing security-audit service.
- Nothing in NEX Chat tables. No key material. No message body anywhere in NEX.

### 10.2 · What the email provider sees

- Visitor name (in the body of the outgoing email).
- Visitor email, used as `Reply-To:`.
- Visitor phone (in the body, optional).
- Visitor country.
- Visitor message body.
- Merchant email (in `To:`).

This is explicitly disclosed in the shop's privacy copy. The design does not pretend the email is end-to-end encrypted.

### 10.3 · What the merchant sees

- Everything the email provider delivered: name + email + phone + country + body.
- Nothing else about the visitor. No NEX account (there isn't one).

### 10.4 · Erasure requests

- A visitor who wants their NEX-side row deleted can do so using the enquiry id echoed on the confirmation screen.
- NEX cannot erase the email content from the provider or from the merchant's inbox — that is disclosed in the privacy copy.
- An HQ admin may delete a specific row before the 30-day sweep via an audit-logged admin action.

### 10.5 · What goes in the shop's privacy copy

Minimum text under the pop-up's Send button:

> Your enquiry is delivered to the shop owner by email. NEX does not store the content of your message or your phone number. The shop owner will see your name, email, phone and country. Your email becomes the Reply-To so the shop owner can respond directly. NEX stores a 30-day anonymous record of this enquiry for duplicate-prevention and support.

---

## 11 · Owner approval gates (Rule 7)

| # | Change | Approval phrase |
|---|---|---|
| A | Apply the new migration `372_nex_shop_enquiry.sql` (metadata-only table + CHECK widening for the new rate-limit action) in sandbox `kdstoyyeygcopkogqsyv`. | `APPROVE MIG 372 SANDBOX APPLY (shop enquiry metadata table + shop_enquiry_submit rate-limit action)` |
| B | Activate the Resend bridge by calling `setDefaultAdapter(new ResendBridgeAdapter())` from a single boot location **and** setting `NEX_EMAIL_DEFAULT_FROM` to a verified sender. Sandbox only. | `APPROVE RESEND BRIDGE SANDBOX ACTIVATE (NEX_EMAIL_DEFAULT_FROM=<verified-sender-address>)` |
| C | Set `NEX_SHOP_ENQUIRY_HMAC_KEY` (32+ random bytes, base64) in the sandbox env. Owner holds the secret; engineering never sees it. | `APPROVE HMAC KEY SANDBOX SET (NEX_SHOP_ENQUIRY_HMAC_KEY)` |
| D | Mount the new `ShopEnquiryPopup` component inside the FAB callers (replacing the two-button `ShopChatRegistrationPopup` for the unsigned-in case). | No separate approval — covered by the standing 2026-11-27 source-control policy on `release-audit-v1-2026-11-14`. |
| E | Any production move (apply mig 372 on `ijvqdvsvwtwxzcqmoqit`, set env vars on prod, point `DEFAULT_ADAPTER` at a prod verified sender). | **Not requested in this cycle.** Will require a separate named approval and is strictly out of scope for sandbox engineering. |

No code weakens authentication, RLS, encryption, account isolation, payment protections, or privacy controls to make tests pass. No live Stripe / PayPal. No touching the sealed Emergency Help flow. No touching the device-only E2E seal on `nex_peer_message`.

---

## 12 · Rollout (Rev 3)

Phase 1 — Independent engineering foundation (this cycle, authorised):
1. Design document completed (this file).
2. Migration `372_nex_shop_enquiry.sql` drafted (not applied).
3. `/api/nex-native/shop-enquiry` route built. Uses `DEFAULT_ADAPTER` which is still `ConsoleAdapter` — dry-run visible to the visitor.
4. `MockSendAdapter` + endpoint tests: validation · ownership · duplicate · rate-limit · metadata-only privacy.
5. HQ inbox query `fetchShopMessageInboxMeta` corrected (shipped in `8f29b4d8`).
6. HQ Enquiries panel (read-side only; mounts after mig 372 is applied).

Phase 2 — Activation (requires owner approvals A, B, C above):
7. Owner applies mig 372 in sandbox.
8. Owner sets env vars + activates the Resend bridge.
9. Smoke test: one real sandbox enquiry → real inbox → row written with real provider message-id.
10. Playwright E2E across `/nex-native/x-rated-tool-belts` + one other template.

Phase 3 — Production (separate approval, out of scope today):
11. Owner-executed migration apply + env propagation on `ijvqdvsvwtwxzcqmoqit`.

---

## 13 · Non-objectives (Rev 3)

- No account minting from this flow.
- No message body stored in NEX, ever.
- No reply channel inside NEX. Replies live in the merchant's and visitor's email clients.
- No HTML email. Plain text only.
- No automatic retry on adapter failure.
- No real email send in this cycle. ConsoleAdapter remains the default until the owner issues approval B.
- No touching the sealed Emergency Help SOS flow, the 2026-11-09 device-only E2E seal on `nex_peer_message`, or the 2026-11-24 PWA install-timing rules.
- No live Stripe / PayPal.
- No attachments in Phase 1. Phase 2 will address text-only limit if the owner authorises.
