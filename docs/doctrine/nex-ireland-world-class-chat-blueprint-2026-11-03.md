# NEX Ireland · World-Class Chat Blueprint
### 2026-11-03 · READ-ONLY planning document · NOT implementation authorisation

---

## § 0 · Preamble

### 0.1 · What this document is

A traceable implementation blueprint for making NEX Ireland a complete, production-ready communications experience. Every claim is anchored to a file path, migration number, or doctrine reference. Every unresolved item is explicitly named.

### 0.2 · What this document is NOT

- Implementation authorisation.
- Legal advice.
- A cryptographic specification.
- Launch acceptance.
- Permission to install software, run migrations, access production, or deploy.
- A commitment to numerical SLOs — all performance targets are **PROPOSED**, require owner approval before becoming binding.

### 0.3 · Observed restrictions

- No source-code change · no SQL · no migration drafting · no database access · no software install · no server start · no commit/push/deploy · no credential access.
- Preserved all existing working-tree changes (verified: engineering pass on `_contact-row.tsx` · `_contacts-shell.tsx` · `page.tsx` from the earlier task left intact).
- Did not touch `scripts/_tmp/`.
- Did not modify Bridges 76 · 77 · 78 · 88 (identities located and listed in § 2).
- Did not modify any Option 2 doctrine document.

### 0.4 · Honest disclosure of this blueprint's scope limits

- The owner's authorisation referenced "all **eight** blocker findings" from the Option 2 challenge. The source document explicitly lists **six** BLOCKER-class findings in its §11 enumeration (A.1 · A.2 · A.3 · A.4 · A.5 · C.1). Two further findings (D.1 · D.2) are tagged BLOCKER inline in §4D but are catalogued under a separate heading. This blueprint classifies **all eight** inline-tagged BLOCKER mentions so no finding is lost, and flags the count discrepancy for owner reconciliation.
- Presence-truth and offline-first sections are grounded in file-path evidence; where no definitive implementation was found, the finding is NOT VERIFIED, not FAIL.
- Compliance exposure is a **programmer's map of risks**, not legal advice. Every row needs a qualified EU-licensed solicitor's confirmation before relying on it.

---

## § 1 · Reconciled current-state baseline

### 1.1 · Reconciled parent-feature inventory

**Scoring method**: one status per parent feature. "Verified components within" is a sub-column, not a second score. Verified components do NOT inherit parent status; a parent remains PARTIAL even when individual components are VERIFIED.

| # | Parent feature | Single status | Verified components within | Why not higher |
|---|---|---|---|---|
| 1 | **Account & profile identity** | VERIFIED WORKING | migrations 001 · 042 · 046 · WebAuthn 043 · account-service · account-profile-service | — |
| 2 | **Chat & messaging** | PARTIAL | SSR + per-message realtime nudge · ciphertext storage (Bridge 76) · IndexedDB plaintext (Bridge 77) · encrypted purge (Bridge 78) · attachment attachments 055/144/259 | **Option 2 architecture challenge · 6+2 BLOCKERS unresolved · no cryptographer sign-off · no real-device acceptance** |
| 3 | **Device identity & trust** | PARTIAL | `nex_account_device_key` 092 · `nex_webauthn_credential` 043 · device-key cache | **Proof-of-possession undefined (A.4) · no dormancy policy · no auditable registration event** |
| 4 | **Chat themes & ownership** | VERIFIED WORKING | marketplace 048/051/085/191-196 · Stripe wiring · commission tracking | — |
| 5 | **Live / video** | PARTIAL | `nex_live_session` 219 · engagement 222 · participation 226 · jail 234 · uploaded video 223 | **No WebRTC signalling layer verified · no real-device call test** |
| 6 | **Calling / video calling** | PARTIAL | `nex_call_log` 131 · `nex_call_link` 132 · `nex_group_call` 133 · routing | **Same WebRTC gap — persistence without transport** |
| 7 | **Notifications** | PARTIAL | push-subscription-service · notification-dispatch-service test exists · prefs 198 | **No FCM/APNs wiring verified · no delivery observability · in-app badge dispatch unverified** |
| 8 | **Membership / billing** | PARTIAL | Stripe adapter · webhook · reconciliation cron · entitlements · country pricing · migration 258 | **"Not linked from navigation yet" · no customer-facing path · no production acceptance test** |
| 9 | **Vault / attachments / storage** | VERIFIED WORKING | 128 · 129 · 140-143 · envelope rotation · PIN lock · device recovery | — |
| 10 | **HQ administration** | VERIFIED WORKING | `requireHqAdmin` · country roles 254/255 · action log | — |
| 11 | **Privacy / account security** | VERIFIED WORKING | privacy prefs 199-201 · safe-trade consent 069 · WebAuthn | — |
| 12 | **Family Safety / minors** | PARTIAL | emergency schema 224 · emergency profile 225 · hub + flows | **No guardian_managed / child_profile / custody tables verified** |
| 13 | **Ireland branding** | VERIFIED WORKING | country column 244 · country RLS 245 · country registry 252 · placement 253 · HQ selector | — |
| 14 | **Mobile navigation / responsive** | VERIFIED WORKING | sealed phone-frame · 44px touch · system font stack | — |
| 15 | **NEX Socials** | VERIFIED WORKING | 4-intent chooser · follow graph 237/238 · discovery signals 208/216 | — |

**Totals (reconciled):**
- VERIFIED WORKING: 8 (account, themes, vault, HQ, privacy, Ireland, mobile nav, Socials)
- PARTIAL: 7 (chat, device trust, live, calling, notifications, billing, family safety)
- NOT IMPLEMENTED: 0 at parent level (Groups is counted inside "chat" since it has no schema)
- FAIL: 0
- BLOCKED BY DECISION: implicitly 1 (chat, until Option 2 decisions resolve)

**Counting method:** each parent appears exactly once. "Verified components within" is informational, not a second vote. Prior summary (9 PASS · 6 PARTIAL) was wrong because chat-foundation-only was double-counted; this reconciliation gives chat exactly one classification (PARTIAL) and flags the Option 2 gate.

### 1.2 · Known pre-existing test failures (not introduced here)

| Test | Status | Why | Fix path |
|---|---|---|---|
| `src/app/nex-native/contacts/__tests__/header-mounted.test.ts` | 7/10 pass · 3/10 fail | Asserts the retired Phase-1 2026-10-17 component tree + D1 "no city" + D2 "no presence" — all three superseded by owner directives Oct 23 → Nov 3 | Owner decides: update to current design · or remove · requires separate authorisation |
| `src/lib/nex-native/__tests__/vault-contacts.test.ts` | 35/36 pass · 1/36 fail | `expect(maxVersion).toBeLessThanOrEqual(144)` — project now at 259 migrations · test cap is stale | Bump cap · or remove assertion · requires separate authorisation |

---

## § 2 · Preserved bridge register

### 2.1 · Bridges identified in `C:/Users/Victus/nexapp` (this repo)

| Bridge | Identity | Evidence | Status |
|---|---|---|---|
| **Bridge 2** | NEX identity / discovery profile · `nex_account_profile` | `nex-supabase/migrations/042_nex_account_profile.sql:6` · comment "Bridge 2 · Founder-authorised 2026-09-26" | SEALED · DO NOT MODIFY |
| **Bridge 2b** | Face sign-in with WebAuthn + `/sign-in` surface · commit `7991095c` | `docs/doctrine/nex-integration-verification-ledger-2026-10-27.md:579` references sealed commit | SEALED · DO NOT MODIFY |
| **Bridge 76** | Device-key fan-out encrypted peer messaging · per-recipient ciphertext rows · `content_key_wrapped` field | `nex-supabase/migrations/092_nex_account_device_key.sql` · referenced across `_e2e-decryptor` · `first-message-http.ts:FirstMessageRequestBody.ciphertext_rows` | SEALED · DO NOT MODIFY |
| **Bridge 77** | IndexedDB plaintext canonical storage (sender's device holds plaintext · server never does) | `docs/doctrine/nex-option-2-architecture-review-draft-2026-11-03.md:44` · `docs/doctrine/nex-option-2-decision-register-reconciliation-2026-11-03.md:143` | SEALED · DO NOT MODIFY |
| **Bridge 78** | ACK-based purge of delivered encrypted peer messages (`nex_purge_delivered_encrypted_messages`) | `nex-supabase/migrations/094_nex_purge_delivered_encrypted.sql:1` · "Migration 094 · Purge job · Bridge 78" | SEALED · DO NOT MODIFY |
| **Bridge 88** | Binary attachment encryption · sealed-deferred | `docs/doctrine/nex-option-2-architecture-review-draft-2026-11-03.md:143` · "design detail in Bridge 88 sealed-deferred" | SEALED · DO NOT MODIFY · NOT YET IMPLEMENTED |

### 2.2 · Unresolved

- **Bridge 1** · not found in this repository. Memory (global CLAUDE.md) references `Bridge 1 · 874e4d7d · product-context chat destination` as a sealed commit in `D:/trades` (preservation repo), not nexapp. **Treatment**: Bridge 1 lives in the historical preservation repo and is not a Bridge in the nexapp sense. **Owner should confirm** whether this blueprint should also respect `D:/trades` Bridge 1 identifiers, or whether nexapp's Bridge sequence is independent. **This is an unresolved blocker on documentation terminology**, not implementation.

### 2.3 · Other sealed holds (not Bridges but doctrine-sealed)

- Chat Master Layout Rule · 2026-10-14 · `ChatIdentityHeader` + `ChatComposerPill` primitives
- Keypad universal rule · 2026-10-24 · every text field uses sealed NEX keypad
- Pending-invite privacy · 2026-10-23 · invitee identity not shown pre-accept
- Avatar presence RIM · 2026-10-29 · never dots
- Community Notice location-privacy copy · 2026-10-23 · no "2km"/"nearby"
- Vault entitlements policy · 2026-10-20 · LOCKED
- Pricing baseline · 2026-10-20
- Package Contract DRAFT · 2026-10-20
- Service Principle DRAFT · 2026-10-20
- NEX never handles payments · sealed
- Phase A1 Accommodation · HOLD
- Three unimplemented claims (verified badge · 20 boosted · cancel-any-time) · DEFER
- A-strict scope · sealed

---

## § 3 · Required sub-audits

### 3.1 · Presence truth

**Question**: when the sealed avatar RIM renders green/orange/dark-red + heartbeat, is any backend actually writing presence state?

**Findings**:

| Component | Evidence | Status |
|---|---|---|
| `nex_account_presence` table | **NOT FOUND** in migration scan | NOT IMPLEMENTED |
| `nex_live_session.last_heartbeat_at` | Migration 219 live session · heartbeat column exists | VERIFIED WORKING (for Live only) |
| `live-session-service` heartbeat writes | `src/lib/nex-native/live-broadcast/live-session-service.ts` | VERIFIED WORKING (for Live only) |
| Account-level presence tick | **NOT FOUND** · no service writes a generic account `last_seen_at` | NOT IMPLEMENTED |
| Presence read in `_contact-row.tsx` | Reads from `ContactRowDisplay.presence` prop · never populated from DB in the current `page.tsx` wiring | NOT WIRED |

**Verdict**: The sealed presence RIM is **cosmetic in production**. It animates based on prop values, but no backend writes those values for 1:1 contacts. The only live heartbeat is for Live broadcast sessions, not general chat presence.

**Implications**:
- Mock contacts in dev display presence (via `PROTOTYPE_MOCK_ROWS`) — honest for dev.
- Real contacts in production never show presence state — honest-absence (null rim).
- **Claim risk**: if marketing or UI copy ever implies "online now", the claim is unsupported.

**Decisions required**:
- Owner decision: is 1:1 chat presence a Stage-2 or Stage-3 feature? (Recommendation: Stage 3 — requires push + WebSocket/SSE channel.)
- Owner decision: what's the authoritative definition of "online"? (candidates: active WebSocket within 30s · active service-worker heartbeat within 60s · last message interaction within 5m)
- Legal decision: presence tracking may be a GDPR-relevant data processing activity. Needs lawful basis.

### 3.2 · Offline-first (outbound send queue)

**Question**: can a NEX user compose a message in a subway tunnel and see it send when they're back online?

**Findings**:

| Component | Evidence | Status |
|---|---|---|
| Service worker | `src/app/nex-native/_sw-cache-register.tsx` + service-worker file | PARTIAL — cache register exists but outbound queue behaviour not verified |
| IndexedDB usage | `src/lib/nex-native/status-storage/store.ts` · `src/lib/nex-native/crypto/message-store.ts` · `src/lib/nex-native/crypto/device-key.ts` | VERIFIED FOR KEYS · UNVERIFIED FOR OUTBOUND |
| Outbound send queue abstraction | **NOT FOUND** as a named module (no `offline-queue.ts` / `send-queue.ts` / `outbox.ts`) | NOT IMPLEMENTED |
| UI state for queued-send | **NOT FOUND** · composer does not render "queued" / "pending" / "will send when online" states in the surveyed files | NOT IMPLEMENTED |
| Welcome outbox worker | `src/lib/nex-native/first-conversation/welcome-outbox-worker.ts` | PARTIAL — scoped to first-conversation only, not general chat |

**Verdict**: The crypto layer uses IndexedDB for keys (good). The chat composer does **not** have a general offline outbound queue. A user with no connectivity who hits "Send" will see the send fail; the message is not persisted and re-tried on reconnect.

**Implications**:
- "Reliable instant delivery" claim is unsupported without this.
- Real-device acceptance test "Lose connection · Chat recovers without duplicate or lost messages" currently fails.

**Decisions required**:
- Build order: should the outbound queue land in Stage 2a (delivery semantics) or Stage 3 (real-time)? **Recommendation**: 2a — delivery semantics must include failure recovery.
- Behaviour on duplicate retry: idempotency key per send attempt (not per message). **Recommendation**: client-generated UUID stored in `nex_peer_message.client_send_id` with unique index; server dedups on insert.
- Max queue depth: 100 messages? 1000? **Recommendation**: start with 500 per conversation, surface a visible warning at 100.

### 3.3 · Observability

**Question**: can we see when messages, invitations, or calls fail?

**Findings**:

| Component | Evidence | Status |
|---|---|---|
| Global APM (Sentry / Datadog / OTel) | **NOT FOUND** · no `@sentry/*` or `@opentelemetry/*` imports in surveyed files | NOT IMPLEMENTED |
| Surface-health boundaries | `src/components/nex-native/surface-health/*` (telemetry-client, VisualThemeBoundary, ChatCoreBoundary) | VERIFIED — error-boundary pattern exists |
| Structured logging | Ad-hoc `console.warn("... failed:", err)` across services | PARTIAL — not uniform |
| Safechat classification logger | `src/lib/nex-native/safechat/classification-logger.ts` | VERIFIED — content safety only |
| Push delivery dead-letter queue | **NOT FOUND** | NOT IMPLEMENTED |
| Invite-state-transition log | **NOT FOUND** (migration 215 state transitions are not auditable without reading the row) | NOT IMPLEMENTED |
| Scheduled sweep health check | **NOT FOUND** — no cron for `sweepExpired()` means no sweep-health signal | NOT IMPLEMENTED |
| HQ action log | migration 254 `nex_hq_action_log` | VERIFIED — but for HQ admin only |

**Verdict**: Observability is **surface-level only**. Error boundaries catch React errors; safechat logs classification outcomes; HQ admin actions are logged. There is no uniform structured logger, no metrics collector, no alert routing, no dead-letter queue, and no sweep-health signal.

**Implications**:
- If invitations stop expiring at 03:00 UTC, we would not know until users complain.
- If push notifications fail to deliver, we have no retry/dead-letter observability.
- If messages fail to decrypt on recipient device, no backend-visible metric exists.

**Decisions required**:
- Which structured logger: Pino (recommended, zero-dep JSON logs) · Winston · console-only?
- Which APM: self-hosted OTel collector → Signoz? Vercel's built-in log drain? Owner budget decision.
- Alert routing: email · Slack · PagerDuty · webhook to NEX owner-managed endpoint?
- **This is a Stage-0 workstream** — must land before Stage 1 fixes so we can see the fixes work.

### 3.4 · Rate limits + abuse controls

**Question**: can one bad actor spam 500 invitations on launch day?

**Findings**:

| Capability | Rate-limit module | Status |
|---|---|---|
| Vault PIN attempts | `vault/pin-rate-limit.ts` | VERIFIED |
| Watch listing creation | `watches/watch-listing-rate-limit-service.ts` | VERIFIED |
| Follow/unfollow | `follow/follow-rate-limit.ts` | VERIFIED |
| Music publishing | `music/music-rate-limit.ts` | VERIFIED |
| **Invitation sends** | **NOT FOUND** as a dedicated rate-limiter · the 72h cooldown is per-pair not per-sender | PARTIAL — pair cooldown only |
| **Message sends** | **NOT FOUND** | NOT IMPLEMENTED |
| **Call initiations** | **NOT FOUND** | NOT IMPLEMENTED |
| **Report/flag submissions** | `report-service.ts` found · rate-limiter not inspected | NOT VERIFIED |
| **Block / mute / report ledger** | `report-service.ts` exists · consolidated moderation ledger NOT FOUND | PARTIAL |

**Verdict**: Rate-limit pattern is well-established in this codebase (vault / follow / watch / music all demonstrate it). It is **not yet applied** to the three abuse-primary surfaces of a comms app: invites, messages, calls.

**Decisions required**:
- Invite rate limit: proposed **10 pending-outbound per account**, **50 pending-outbound per day**, **200 pending-outbound per 7 days**. All PROPOSED, require validation on real usage.
- Message rate limit per conversation per minute: proposed **30 messages**. PROPOSED.
- Message rate limit per account per hour (across all conversations): proposed **600 messages**. PROPOSED.
- Call rate limit: proposed **20 dial-outs per hour per account**. PROPOSED.
- Moderation ledger: a single `nex_moderation_event` table combining report / block / mute actions, with reason codes · reviewed daily by HQ.

### 3.5 · Compliance exposure (engineering view only · NOT legal advice)

**Engineering obligations that intersect each capability**:

| Capability | Likely applicable regime | Engineering obligation (programmer's reading, needs legal review) |
|---|---|---|
| Chat storage | GDPR Art. 5, 17, 20 | Right to erasure for recipient-held plaintext is architecturally hard · right to data portability requires export tooling · lawful basis for processing (likely contract performance) must be documented |
| E2E encryption | ePrivacy Directive · GDPR Art. 32 | Encryption at rest + in transit — covered IF Option 2 blockers resolved · must document crypto choice for Art. 30 record |
| Presence tracking (when wired) | GDPR Art. 6 | Lawful basis needed — likely legitimate interests or consent · ePrivacy may require consent for persistent identifiers |
| Invitation flow | GDPR Art. 6, 7 | Lawful basis for processing recipient contact info · intro-note content may be user-generated personal data |
| 24h expiry sweep | GDPR Art. 5(1)(e) storage limitation | Must actually delete, not just hide · right-to-erasure complements |
| Push notifications | ePrivacy Directive · GDPR | Prior consent for cookies/identifiers tied to push subscription token |
| Illegal content reports | DSA Art. 16-22 | Statement-of-reasons for moderation decisions · internal complaint-handling · transparency reporting · trusted flaggers |
| Illegal content hosting | DSA Art. 6-9 | Notice-and-action · stay-down obligations · exemption for mere conduits does NOT cover user-generated content hosting |
| Children's data | GDPR Art. 8 · Irish Data Protection Act 2018 Section 31 | Age of digital consent in Ireland = 16 · parental consent mechanism required below · age verification method |
| Commerce / seller tax | DAC7 | Platform operator reporting obligation if commerce goes live · thresholds and taxpayer identification |
| VoIP calls | ePrivacy Directive · Irish telecom regs | Interception may NOT be lawful · emergency-call carve-outs vary · recording consent rules |
| Verified business badge | Consumer Protection Act 2007 (Ireland) · Unfair Commercial Practices Directive | Misleading claims about verification status are unlawful · verified-filter conflict is a priority fix |
| Account recovery (D4) | GDPR Art. 32 | Secure authentication required · recovery mechanism must not weaken security · documented recovery policy |
| Attachment deletion | GDPR Art. 17 | Deletion in private bucket may lag behind UI · must document propagation guarantee |

**Verdict**: this is a non-trivial list for an Ireland EU launch. **Not actionable without qualified legal counsel.** Engineering can prepare the technical capability (export tooling, moderation ledger, delete pipelines, consent-collection flows) but the policies, retention windows, consent language, and lawful-basis declarations must be drafted by a solicitor familiar with Irish and EU regimes.

**Decisions required**:
- Owner retains a solicitor for Irish/EU chat-platform compliance BEFORE public launch.
- Engineering produces compliance-ready capability (export · delete · consent · moderation ledger) in parallel with legal review.
- Owner decides: launch Ireland as closed beta first (limited lawful-basis exposure) · public launch waits for legal sign-off.

### 3.6 · Device trust lifecycle

**Question**: what are the policies for new-device approval · lost-device recovery · dormant-device expiry · historical-message access on new device?

**Findings**:

| Lifecycle event | Current implementation | Status |
|---|---|---|
| New device registration | `nex_account_device_key` row INSERT via unspecified endpoint | PARTIAL — proof-of-possession undefined (Option 2 BLOCKER A.4) |
| Trusted-device approval of new device | **NOT FOUND** · no mutual-trust challenge-response flow verified | NOT IMPLEMENTED (per Option 2 D3 founder direction) |
| Device-key revocation | `nex_account_device_key.revoked_at` column exists · how/when it's set is not uniformly documented | PARTIAL |
| Dormant-device expiry | **NOT FOUND** · no auto-untrust after N days of inactivity | NOT IMPLEMENTED |
| New-device historical sync | Per Option 2 D6 founder position: NO automatic sync · new device starts empty | APPROVED DIRECTION · implementation pending |
| Device inventory + UI | `src/app/nex-native/settings/security/devices/page.tsx` exists | PARTIAL — surface exists, backend lifecycle unverified |
| User-visible notification on new-device registration | **NOT FOUND** | NOT IMPLEMENTED |
| Lost-device recovery | Option 2 D4 founder position: pre-provisioned recovery credential preferred · implementation pending | APPROVED DIRECTION · implementation pending |

**Verdict**: Device-trust surface exists but **lifecycle policy is not implemented end-to-end**. Owner has approved direction on D3/D4/D5/D6 but none has been built.

**Decisions required**:
- Dormancy threshold: proposed **90 days of no activity → auto-untrust, require re-approval**. PROPOSED.
- Audit log retention for device registration events: proposed **13 months** (statutory limitation period in some EU regimes). PROPOSED, needs legal confirmation.
- Pre-provisioned recovery credential form: mnemonic phrase · hardware security key · trusted peer co-signing · owner selects.

### 3.7 · Operational readiness

**Question**: when a production system degrades at 03:00 UTC, who finds out, who responds, with what runbook?

**Findings**:

| Operational concern | Current state | Status |
|---|---|---|
| SLO definitions | **NOT FOUND** | NOT IMPLEMENTED |
| Runbooks per incident class | **NOT FOUND** | NOT IMPLEMENTED |
| On-call rotation + escalation | **NOT FOUND** | NOT IMPLEMENTED |
| Internal status page | **NOT FOUND** | NOT IMPLEMENTED |
| Postmortem template + cadence | **NOT FOUND** | NOT IMPLEMENTED |
| Alerting (any channel) | **NOT FOUND** | NOT IMPLEMENTED |
| Vercel cron health checks | `vercel.json` has 2 crons (harvest-tick · billing/reconcile) · no self-health endpoint checking they ran | PARTIAL |

**Verdict**: operational readiness is at the **"we hope it works"** stage. World-class comms systems have on-call rotations, SLOs, runbooks, status pages, and postmortems. This is a Stage-6 workstream and must land before claiming production readiness.

**Decisions required**:
- Who is on-call? (Minimum: one person · must be reachable within 30 minutes of an alert.)
- SLO proposals (PROPOSED, require owner approval and reality-check after measurement baseline):
  - **Message delivery p99**: sender tap-send to recipient device decrypt-and-display, 1500ms on 4G, 5000ms on 3G. **PROPOSED**.
  - **Invite accept availability**: 99.9% in-month success rate for accept-button → accepted-row-written. **PROPOSED**.
  - **Call setup p95**: dial to ring-visible on recipient device, 3000ms on good network. **PROPOSED**.
  - **Push notification delivery p95**: send-side request to visible notification on recipient device, 10 seconds. **PROPOSED**.
  - **Sweep job freshness**: last successful run <= 2 hours ago. **PROPOSED**.
- Status page tooling: Vercel-hosted static page updated by cron · Statuspage.io · internal-only Grafana. Owner selects.

### 3.8 · Performance measurement baseline

**Question**: what numbers must we hit before claiming world-class?

**Findings**:

| Metric | Current measurement | Status |
|---|---|---|
| LCP (Largest Contentful Paint) on Contacts page | **NOT MEASURED** | NOT IMPLEMENTED |
| INP (Interaction to Next Paint) | **NOT MEASURED** | NOT IMPLEMENTED |
| CLS (Cumulative Layout Shift) | **NOT MEASURED** (avatar `width/height` just added fixes CLS; verify empirically) | NOT IMPLEMENTED |
| First-send to recipient-decrypt latency | **NOT MEASURED** | NOT IMPLEMENTED |
| Call setup latency | **NOT MEASURED** | NOT IMPLEMENTED |

**Baseline proposal** (PROPOSED, needs owner approval before becoming binding):

- Test devices: iPhone 12 (2020 baseline) · Pixel 6a (mid-range Android, 2022) · a 2020 low-end Android (Samsung A12 or equivalent)
- Network conditions: WiFi · 4G throttled to 25 Mbps · 3G throttled to 1.6 Mbps · offline-then-online
- Pass thresholds (world-class range, PROPOSED):
  - LCP p75 < 1800ms on 4G, < 3000ms on 3G
  - INP p75 < 200ms
  - CLS < 0.1
  - First-send to decrypt p99 < 1500ms on 4G

**No measurement has been taken yet.** Any claim of "world-class performance" is unsupported.

**Decisions required**:
- Measurement tooling: `web-vitals` npm package (adds dev dependency) · Lighthouse CI (adds CI complexity) · Chrome DevTools on-device (manual).
- Measurement discipline: numbers captured before and after every performance-sensitive change · stored in a baselines doc · tracked over time.

---

## § 4 · Chat engine · split into independently decidable work packages

### 4a · Delivery semantics

**Scope**: what guarantees does NEX offer about message delivery, ordering, idempotency, reconciliation?

**Current state** (verified from repo):
- Server stores one ciphertext row per recipient device (Bridge 76 fan-out).
- Realtime nudge via Supabase Realtime `nex:messages:{conversationId}` broadcasts "arrival" event (nudge-not-message).
- Client-side `_e2e-decryptor` ACKs on successful decrypt → server marks `delivered_at`.
- Delivered rows are purged after retention window (Bridge 78, default 7 days).
- IndexedDB holds canonical plaintext (Bridge 77).

**Gaps**:
- At-least-once vs exactly-once vs at-most-once: not explicitly chosen.
- Deduplication key: no `client_send_id` on send; dedup basis is server-generated row ID.
- Reconnect reconciliation: how does a client that was offline for 3 days catch up?
- Outbound send queue: not implemented (per § 3.2).
- Ordering: Supabase row-order approximates send-order but is not guaranteed across devices.
- Retry/backoff policy: not specified.
- Reconnection replay: on realtime channel reconnect, does the client fetch missed messages from DB? Not verified.

**Work package 4a sub-items**:

| ID | Item | Dependency |
|---|---|---|
| 4a.1 | Choose semantics (recommend **at-least-once with idempotency via `client_send_id`**) | Owner decision |
| 4a.2 | Add `client_send_id uuid` to `nex_peer_message` with unique index per sender | Requires migration · requires 4a.1 |
| 4a.3 | Implement outbound send queue in IndexedDB · retry with exponential backoff | Requires 4a.2 |
| 4a.4 | Reconnection replay: on channel reconnect, fetch rows `WHERE created_at > last_seen_tombstone` | 4a.1 |
| 4a.5 | Ordering: per-conversation `logical_sequence` monotonic counter in composite index · stable UI ordering | Requires migration · PROPOSED |
| 4a.6 | Delivery-state UI: queued · sending · sent · delivered · failed · retrying | 4a.3 |

**Status**: WORK PACKAGE — not implementation-authorised.

### 4b · Cryptographic protocol · Option 2 blocker classification

**Reference**: all BLOCKER findings preserved from `docs/doctrine/nex-option-2-architecture-challenge-2026-11-03.md` (2026-11-03), reconciled with `docs/doctrine/nex-option-2-founder-decisions-consolidated-2026-11-03.md` (2026-11-03).

**Honest counting note**: the owner's authorisation referenced "all **eight** blocker findings". The challenge document's §11 enumerates **six** BLOCKERS (A.1 · A.2 · A.3 · A.4 · A.5 · C.1); two further findings (D.1 · D.2) are tagged BLOCKER inline in §4D of the challenge but are catalogued under a separate heading. This blueprint lists **all eight inline-tagged BLOCKER mentions** so no finding is lost, and flags this count discrepancy for owner reconciliation.

#### 4b.1 · Blocker classifications

| ID | Finding | Classification | Downstream work blocked |
|---|---|---|---|
| **A.1** | Content-key provenance and scope unspecified · `K_msg` freshness, nonce freshness, per-message vs per-conversation key scope | (b) **independent cryptographic review required** — Founder D2 Conditional (depends on D1+D20); must be governed by chosen vetted protocol, not independently invented | 4a.2 message schema · 4c attachment envelope · all chat-security claims |
| **A.2** | Key-wrapping algorithm unnamed · which asymmetric primitive wraps `K_msg` to recipient device public key | (b) **independent cryptographic review required** — Founder D1 Approved direction (separate identity/encryption keys subject to vetted protocol) | 4a (delivery can't commit a schema without this) · 4b.3 trust-states · device registration |
| **A.3** | Signing versus encryption keys conflated · `nex_account_device_key.public_key` is one column serving unknown purpose | (b) **independent cryptographic review required** — Founder D1 Approved direction splits identity/encryption keys; needs reviewer sign-off on composition | Schema migration · trust-state semantics · QR-linking signature (A.5) |
| **A.4** | Device registration proof-of-possession undefined · no challenge-response at registration | (a) **owner decision + (c) implementation + verification** — Founder D3 Approved direction endorses challenge-response + trusted-device approval + audit + notification | Entire trust system · peer-side NEW DEVICE / CHANGED detection · any claim of device authenticity |
| **A.5** | QR linking HMAC key provenance undefined · "root_signing_key" referenced without origin | (b) **independent cryptographic review required** — Founder D5 Approved direction (trusted device authorises · payload short-lived · signature authority depends on D1) | QR-linking flow · multi-device onboarding |
| **C.1** | 403 handling must reclassify from dead-letter to pause+page · bucket-policy 403 is operational, not permanent | (a) **owner decision + (c) implementation** — straightforward error-handling fix in attachment pipeline | Attachment delivery resilience · operator trust in dead-letter queue |
| **D.1** | Transition windows unspecified (4 values: freeze date · export window · initial notification lead time · signed-URL expiry) | (a) **owner decision** — Founder D14/D15/D16 statuses: Deferred/Provisional/Approved direction (planning values pending legal) | Legacy transition execution · user-facing deadlines · GDPR notification compliance |
| **D.2** | User notification + consent plan unspecified for legacy transition | (a) **owner decision + legal review** — Founder D17 Approved direction (no assumed consent through silence) | Legacy transition execution · GDPR consent compliance |

#### 4b.2 · Dependency map

```
A.1 content-key scope  ─┐
A.2 wrap algorithm      │
                        ├──▶ needs cryptographer-reviewed protocol selection ──▶ 4a schema stable, 4c attachment stable
A.3 signing/encryption  │
A.5 QR HMAC origin     ─┘

A.4 proof-of-possession ──▶ trust system end-to-end ──▶ D3 device registration launches

C.1 403 handling        ──▶ attachment pipeline resilience

D.1 transition windows  ─┐
                        ├──▶ legacy transition execution (not blocking green-field Ireland launch)
D.2 notification/consent ┘
```

#### 4b.3 · 4b work package sub-items (contingent on classification outcomes)

| ID | Item | Classification dep | Status |
|---|---|---|---|
| 4b.1 | Owner approval of integrated D1+D2+D20 protocol direction | A.1/A.2/A.3 | PENDING |
| 4b.2 | Independent cryptographer engagement (contract + scope + SLA) | A.1/A.2/A.3/A.5 | PENDING |
| 4b.3 | Challenge-response proof-of-possession at registration | A.4 | PENDING |
| 4b.4 | Trusted-device co-approval UI + flow | A.4 | PENDING |
| 4b.5 | Device-key schema migration (split signing + encryption) | A.3 | PENDING crypto review |
| 4b.6 | QR-linking HMAC key provenance resolved | A.5 | PENDING crypto review |
| 4b.7 | 403 pause+page reclassification in cleanup worker | C.1 | PENDING owner approval |
| 4b.8 | Legacy transition windows chosen | D.1 | PENDING owner + legal |
| 4b.9 | Legacy user notification/consent copy drafted | D.2 | PENDING owner + legal |

**NO CRYPTOGRAPHY WILL BE INVENTED.** Any protocol selection must come from a vetted, maintained, audited specification (Signal · MLS · OpenPGP · etc.) and be reviewed by a qualified cryptographer before implementation starts.

### 4c · Media & attachments

**Current state** (verified from repo):
- Peer chat attachments bucket (migration 055) · product attachment (059) · menu-item (067) · cart-order (077) · sticker (119) · document (259).
- Attachment lifecycle: client → upload to private bucket → signed URL fetch.
- Bridge 88 (binary attachment encryption) is sealed-DEFERRED.
- Media surfaces: `_media-capture.tsx` · voice messages exist · video uploader exists.

**Gaps**:
- Chunked / resumable upload: not verified.
- Thumbnail generation: not verified.
- Voice waveform generation: not verified.
- Deletion propagation (private bucket after retention): not verified.
- Dependency on 4a delivery semantics (attachment references lose meaning if message delivery is reordered).
- Dependency on 4b crypto (binary attachment encryption is Bridge 88, deferred).

**Work package 4c sub-items**:

| ID | Item | Dependency |
|---|---|---|
| 4c.1 | Chunked/resumable upload with tus-protocol or similar | 4a.1 |
| 4c.2 | Thumbnail + video poster generation (server-side ffmpeg) | 4c.1 |
| 4c.3 | Voice-message waveform + duration metadata | 4c.1 |
| 4c.4 | Attachment deletion propagation + audit | 4a.1, GDPR Art. 17 (§ 3.5) |
| 4c.5 | Bridge 88 binary attachment encryption | 4b.1 crypto review complete |

---

## § 5 · Additional work packages

### 5.1 · Invitation lifecycle

**Current state** (from earlier audit): outgoing invitation to WhatsApp currently is **profile share**, not a tracked invite. Server-side 24h expiry exists but is query-time only (no cron). Duplicate prevention via unique index. Business/friends category modal on accept works. No notifications on invite receipt.

**Work package**:

| ID | Item | Owner decision |
|---|---|---|
| 5.1.1 | Choose WhatsApp semantic: (A) tracked invite via `createFriendRequestAction` + magic-link token · (B) rename to "Share my NEX profile" · (C) hybrid (profile share with optional pre-send tracking) | **BLOCKER** · owner decision required |
| 5.1.2 | If A or C: build `/invite/<token>` public landing route with correct edge-case handling (expired · already-accepted · not-signed-in · signed-in-as-wrong-account) | 5.1.1 |
| 5.1.3 | Preserve privacy asymmetry (sealed 2026-10-23): outbound card hides recipient; inbound card shows sender | — |
| 5.1.4 | Preserve no-decline-button doctrine (sealed): expiry IS the pass | — |

### 5.2 · Scheduled expiry sweep + reinvitation

**Current state**: `sweepExpired()` function exists at `friend-request-service.ts:405-421` but is **never called**. Expired rows stay `pending` in DB · blocks reinvitation via unique-pending index.

**Work package**:

| ID | Item | Dependency |
|---|---|---|
| 5.2.1 | Add Vercel cron: `/api/nex-native/friend-request/sweep` hourly · calls `sweepExpired()` | migration not required · pure API addition |
| 5.2.2 | Observability: emit log + metric on each sweep (count flipped) | Stage 0 observability |
| 5.2.3 | Alert if sweep hasn't run in 2 hours | Stage 0 observability |
| 5.2.4 | Verify reinvitation flow unblocks after sweep | — |

**Verified side-effect**: once `cooldown_ends_at` is set by the sweep, the sender can reinvite after 72h. Current blocker is the sweep not running.

### 5.3 · Persistent + cross-device notifications

**Current state**: push-subscription-service exists · notification-prefs 198 · notification-dispatch-service test exists. No FCM/APNs wiring verified. No in-app badge persistence verified.

**Work package**:

| ID | Item | Dependency |
|---|---|---|
| 5.3.1 | FCM endpoint for Android · APNs for iOS · verify delivery to real devices | External credentials · owner approval |
| 5.3.2 | Dead-letter queue for failed sends · retry policy · observability | Stage 0 |
| 5.3.3 | In-app badge persistence across sessions · sync via realtime channel | 4a.4 reconnect replay |
| 5.3.4 | Cross-device read receipt (mark-as-read propagates) · optional per Option 2 D7 (no read receipts initial release) | Owner decision |
| 5.3.5 | Email fallback for critical invites (optional, respects user prefs) | Legal review for email send |

### 5.4 · Business verification consistency

**Current state**: migration 083 doctrine says "Business tab of /nex-native/chat filters to verified_at IS NOT NULL" but new `/nex-native/contacts?tab=business` does **NOT** apply this filter. Verified-badge rendering not found on business rows.

**Work package**:

| ID | Item | Owner decision |
|---|---|---|
| 5.4.1 | Decide: (A) apply `verified_at IS NOT NULL` filter to new tab · (B) update migration 083 doctrine · (C) show both with verified badge differentiator | **BLOCKER** · owner decision |
| 5.4.2 | Apply chosen policy consistently across directory + contacts + chat | 5.4.1 |
| 5.4.3 | Verified-badge rendering on `ContactRow` for business rows | 5.4.1 |

**Consumer-protection note** (§ 3.5): mislabelling an unverified business as verified is unlawful under Irish Consumer Protection Act. Policy must be clear and consistently enforced.

### 5.5 · Real-time infrastructure (WebRTC)

**Current state**: call tables + routes + logs exist (131/132/133). WebRTC signalling layer **not found**. No ICE/STUN/TURN server configuration verified. No peer-connection code found.

**Work package**:

| ID | Item | Owner decision |
|---|---|---|
| 5.5.1 | Signalling transport: Supabase Realtime channel · OR a WebSocket server · OR third-party (Twilio · Agora · Daily.co) | **BLOCKER** · owner cost + control tradeoff |
| 5.5.2 | STUN/TURN: self-hosted coturn · OR commercial (Twilio Network Traversal) | 5.5.1 |
| 5.5.3 | Peer-connection code (`RTCPeerConnection` establishment, ICE candidate exchange, SDP offer/answer) | 5.5.1 |
| 5.5.4 | Call-state state machine: ringing · connected · ended · failed · reconnecting | 5.5.3 |
| 5.5.5 | Mic/camera permissions UI + fallback | 5.5.3 |
| 5.5.6 | Call recording policy: **NO recording** without explicit consent of all parties (ePrivacy) · defer by default | Legal + owner |
| 5.5.7 | Emergency-call carve-outs (varies by jurisdiction) | Legal |
| 5.5.8 | Real-device acceptance test on at least 2 real devices across 3 networks (WiFi · 4G · 3G) | 5.5.3 |

### 5.6 · Groups as a separate capability from group calls

**Current state**: `nex_group_call` (migration 133) exists for **calls**, not for group chat. There is no `nex_group` / `nex_group_member` / `nex_group_role` schema. UI tab shows honest "Soon" (correct).

**Work package**:

| ID | Item | Owner decision |
|---|---|---|
| 5.6.1 | Schema design: `nex_group` · `nex_group_member` · `nex_group_role` · `nex_group_message` (or reuse `nex_peer_message` with group semantics) | **BLOCKER** · schema review |
| 5.6.2 | Permissions model: owner · admin · member · guest · banned | Owner decision |
| 5.6.3 | Member lifecycle: invite · join · leave · kick · ban · appeal | 5.6.1 |
| 5.6.4 | Group message encryption: per-group key · fan-out to each member device · needs 4b resolution | 4b |
| 5.6.5 | Group notifications: mention · reply · reaction · join/leave events (configurable) | 5.3 |
| 5.6.6 | Group discoverability: public · private · invite-only · owner-decidable | Owner decision |
| 5.6.7 | Delete and leave policy: can a member delete their own messages after leaving? GDPR right-to-erasure interaction | Legal |

**No group UI will ship until 5.6.1-5.6.7 are owner-approved and 4b crypto resolves for group fan-out.**

### 5.7 · Irish identity: reactions · shamrock · stickers · Ireland feeds

**Current state**: Ireland country column (244) · RLS (245) · registry (252) · placement (253) all shipped. HQ selector + branding assets (`/nex-brand/hq/ireland-studio.png`) in place. No Irish reaction pack found. No shamrock character / sticker pack found.

**Work package**:

| ID | Item | Dependency |
|---|---|---|
| 5.7.1 | Design Irish reaction pack (laughing · love · crying · angry · surprised · clapping · cheeky · more) · asset format: WebP or Lottie | Owner creative direction |
| 5.7.2 | Reaction infrastructure: `nex_message_reaction` table (or similar) · one row per `(message_id, account_id, reaction_id)` | Schema design |
| 5.7.3 | Shamrock character + sticker pack (static + animated) · same asset pipeline as themes | 5.7.1 |
| 5.7.4 | Ireland Live Feed · Ireland World Feed · already partially infrastructure-ready via live-session surface | Content curation |
| 5.7.5 | Standard emoji remains available (owner directive · additions not replacements) | — |

**Boundary**: Irish identity is a Stage-4 workstream. It must not land before Stage 2a delivery semantics are stable, or reactions become unreliable.

---

## § 6 · Dependency-aware implementation roadmap

### 6.1 · Stage dependency graph

```
Compliance ──────────────────────────────────────── parallel · gates public launch not dev
    (external legal workstream)

Stage 0 · Instrumentation ──┬─▶ Stage 1 · Stabilise ─▶ Stage 2a · Delivery ─┬─▶ Stage 2c · Media
                            │   (invites · sweep ·   │                      │
                            │    notifications ·     │                      │
                            │    business verify)    │                      │
                            │                        │                      │
                            └─▶ Stage 2b · Crypto ───┤                      │
                                (external review)    │                      │
                                                     │                      │
                                                     └─▶ Stage 3 · Real-time (push · WebRTC · presence)
                                                              │
                                                              ├─▶ Stage 4 · Groups + Irish identity
                                                              │
                                                              └─▶ Stage 5 · Real-device acceptance ─▶ Stage 6 · Ops ready ─▶ LAUNCH
```

### 6.2 · Per-stage parallel capability

| Stage | Can run in parallel with | Must wait for |
|---|---|---|
| Compliance (legal) | All stages · gates public launch | Owner retains counsel |
| Stage 0 Instrumentation | Stage 1 | — |
| Stage 1 Stabilise | Stage 0 · Stage 2b crypto review | — |
| Stage 2a Delivery semantics | Stage 2b (parallel · they synchronise at schema) | Stage 0 observability baseline |
| Stage 2b Crypto review | Stage 2a (parallel) | Owner approval of integrated D1+D2+D20 · cryptographer engaged |
| Stage 2c Media | Stage 2a complete (schema stable) | 2a |
| Stage 3 Real-time | Stage 2a complete | 2a + 2b crypto decisions final |
| Stage 4 Groups + Irish | Stage 3 (parallel · groups needs crypto, Irish is content) | 2b for groups · creative direction for Irish |
| Stage 5 Real-device acceptance | — | All 2a + 2b + 2c + 3 + 4 |
| Stage 6 Operational readiness | Stage 5 | Stage 0 observability complete |

### 6.3 · Honest timeline qualification

**This blueprint deliberately does not provide a timeline in weeks or months.** Timeline estimates depend on:
- Cryptographer availability + review turnaround (external, uncontrollable)
- Legal review turnaround (external, uncontrollable)
- Owner decision cadence (owner-controllable but not blueprint-decidable)
- Engineering capacity (not specified)

Owner should commit to a timeline after Stage 0 + Stage 1 complete, when actual velocity is known. Promises before that point are speculation.

---

## § 7 · Required final deliverables · coverage map

Mapping to the owner's 12 required deliverables:

| # | Required deliverable | Where in this blueprint |
|---|---|---|
| 1 | Reconciled current-state audit | § 1 |
| 2 | Complete architecture + capability map | § 1 + § 2 + § 4 + § 5 |
| 3 | Evidence-backed compliance matrix | § 3.5 (engineering view only · legal review required) |
| 4 | Presence + offline-first reports | § 3.1 + § 3.2 |
| 5 | Option 2 blocker classification | § 4b.1 (all 8 blocker mentions classified) |
| 6 | Device-trust policy questions | § 3.6 |
| 7 | Abuse-control + moderation assessment | § 3.4 |
| 8 | Ireland/EU compliance exposure map | § 3.5 |
| 9 | Measurement + SLO proposal | § 3.7 (SLOs) + § 3.8 (performance baseline) |
| 10 | Dependency-aware implementation roadmap | § 6 |
| 11 | Prioritised risks + unresolved founder decisions | § 8 + § 9 + § 10 |
| 12 | Production acceptance checklist | § 11 |

---

## § 8 · Five highest-priority work packages

Prioritised for **foundational reliability and security**, not cosmetic features.

| # | Package | Why #N | Blocked by |
|---|---|---|---|
| **1** | **Stage 0 Instrumentation** (structured logging · metrics · alerts · delivery observability) | Without this we can't prove any fix works · also unblocks sweep-health alerting | Owner approval + tooling choice |
| **2** | **Stage 1 Scheduled expiry sweep + reinvitation unblock** | Trivial fix (one Vercel cron) · currently silently blocking all reinvitation · high user impact for low engineering cost | Owner approval of cron route |
| **3** | **Stage 1 WhatsApp invite semantic decision** | The primary user-facing CTA is semantically ambiguous · marketing claim risk · simple decision with large impact | Owner decision on A/B/C |
| **4** | **Stage 2b Cryptographic protocol direction** · owner approves integrated D1+D2+D20 · cryptographer engaged | Blocks delivery schema finalisation (4a) · blocks media encryption (4c) · blocks groups (5.6) | Owner approval · cryptographer engagement |
| **5** | **Stage 1 Business verification consistency** | Consumer-protection legal risk · straightforward engineering fix once policy chosen | Owner decision on A/B/C |

---

## § 9 · Dependencies preventing implementation

| ID | Dependency | Who resolves |
|---|---|---|
| D-COUNSEL | Qualified Irish/EU solicitor retained for chat-platform compliance | Owner |
| D-CRYPTO | Qualified cryptographer engaged for Option 2 protocol review | Owner |
| D-D1-D20 | Owner approves integrated D1+D2+D20 protocol direction | Owner (per founder decisions doc) |
| D-WHATSAPP | WhatsApp semantic chosen (A tracked / B share / C hybrid) | Owner |
| D-BUSINESS | Business verification policy chosen (A filter / B update doctrine / C differentiator) | Owner |
| D-WEBRTC | WebRTC transport choice (self-hosted / commercial) | Owner |
| D-SLO | SLO targets ratified | Owner |
| D-OBSERVABILITY | Observability tooling chosen (Pino / APM / alert routing) | Owner |
| D-GROUPS-SCHEMA | Groups data model approved | Owner |
| D-RECOVERY | Lost-device recovery model chosen (D4) | Owner |
| D-BRIDGE-1 | Bridge 1 terminology clarified (nexapp sequence vs D:/trades sequence) | Owner |
| D-COUNT | 6-vs-8 BLOCKER count reconciliation | Owner |

---

## § 10 · Unresolved founder decisions

(Beyond those catalogued in Option 2 D1-D20)

| Decision | Options | Blueprint recommendation |
|---|---|---|
| **WhatsApp invite semantic** | A tracked · B profile-share · C hybrid | **A** · magic-link invite token |
| **Business verification policy** | A filter new tab · B update doctrine · C badge differentiator | **A** · consistent with sealed doctrine |
| **Presence definition** | WebSocket within 30s / SW heartbeat 60s / message interaction 5m | **WebSocket within 30s · SW heartbeat 60s fallback** |
| **Dormancy threshold** | 30d / 60d / 90d / 180d | **90 days** · PROPOSED |
| **Observability tooling** | Pino + Vercel log drain / Pino + Signoz / APM commercial | **Pino + Vercel log drain** to start · migrate if volume demands |
| **WebRTC transport** | Supabase Realtime signalling / self-hosted WS / commercial | **Supabase Realtime** for signalling · **commercial TURN** (coturn self-host later) |
| **Groups discoverability default** | Private only / allow public / invite-only | **Private + invite-only** at launch |
| **Launch mode** | Public from day 1 / closed beta first | **Closed beta first** · 100 users · 2 week observation · public after legal sign-off |

All recommendations are PROPOSED, require owner decision.

---

## § 11 · Production acceptance checklist

Real-device tests · minimum 2 real accounts across minimum 3 devices (iOS high · iOS low · Android low) · across 3 networks (WiFi · 4G · 3G).

### 11.1 · Messaging

- [ ] Send a message · recipient receives it reliably (p99 < 1500ms on 4G)
- [ ] Recipient offline · message delivered on reconnection within relay TTL
- [ ] Lose connection mid-send · message queued and retries without duplicate
- [ ] Lose connection mid-receive · reconnection replay fetches missed messages
- [ ] Edit message · recipient sees edited version with edit indicator
- [ ] Delete message · recipient sees deletion within 2s
- [ ] Reply to message · reply correctly references original
- [ ] Forward message · forwarded with correct attribution

### 11.2 · Attachments

- [ ] Send photo · recipient opens full-resolution
- [ ] Send voice message · recipient plays with waveform
- [ ] Send document · recipient downloads
- [ ] Send video · recipient streams · poster visible before load
- [ ] Lose connection mid-upload · resume on reconnection
- [ ] Attachment Bridge 88 encryption roundtrip (post-implementation)

### 11.3 · Invitations

- [ ] Enter NEX ID · invite created · recipient sees inbound card
- [ ] WhatsApp invite · recipient opens link · lands on correct state (post-5.1.2)
- [ ] Accept invitation · both accounts see accepted relationship
- [ ] Ignore invitation · expires after 24h · sender can reinvite after cooldown
- [ ] Simultaneous accept-and-expire race · atomic resolution · no inconsistent state
- [ ] Duplicate invite attempt · rejected cleanly with cooldown feedback

### 11.4 · Calls

- [ ] Start voice call · two real devices connect within p95 < 3000ms
- [ ] Start video call · both devices receive live video
- [ ] Mic/camera permissions denied · graceful fallback
- [ ] Network degrades mid-call · reconnect without new call setup
- [ ] Call declined · caller sees decline state
- [ ] Call missed · recipient sees missed-call log

### 11.5 · Device trust

- [ ] Register new device · trusted-device approval prompt fires on other device
- [ ] Approve new device · device key registered · peer-side NEW DEVICE visible to contacts
- [ ] Revoke device · revoked device cannot continue participating · changes appear on other devices within 10s
- [ ] Dormant device · auto-untrust after threshold · re-approval required
- [ ] Lost-device recovery · pre-provisioned credential successfully re-establishes identity

### 11.6 · Notifications

- [ ] Message notification · correct account + device receive · correct deeplink
- [ ] Invitation notification · correct deeplink to Contacts
- [ ] Call notification · ringing audio + action buttons work
- [ ] Mute notifications for conversation · no notification · badge still updates
- [ ] Cross-device · notification cleared on one device clears on all

### 11.7 · Security + privacy

- [ ] E2E encryption verified · server cannot read plaintext body
- [ ] E2E encryption verified · server cannot read plaintext attachments (post-Bridge 88)
- [ ] Right-to-erasure · account deletion propagates to recipient devices (via re-key or re-sign-in)
- [ ] Right-to-portability · export tooling produces readable JSON of user's own history
- [ ] Block user · blocked user cannot send to blocker
- [ ] Report content · report routed to moderation ledger

### 11.8 · Operations

- [ ] Sweep job runs hourly · observable in metrics · alerts if silent
- [ ] Push dispatch delivery rate measurable · alerts if below SLO
- [ ] Status page reflects actual service state
- [ ] Runbook for push-dispatch-down exists · reviewed · tested
- [ ] Runbook for sweep-hung exists · reviewed · tested
- [ ] On-call reachable within 30 minutes of alert

### 11.9 · Performance baseline

- [ ] LCP p75 < 1800ms on 4G across 3 test devices
- [ ] INP p75 < 200ms
- [ ] CLS < 0.1
- [ ] Baseline captured and stored in `docs/doctrine/nex-performance-baselines-<date>.md`

### 11.10 · Compliance (post qualified-counsel review)

- [ ] Lawful basis documented per GDPR Art. 6 for each processing activity
- [ ] Right-to-erasure flow tested end-to-end
- [ ] Right-to-portability export tested
- [ ] DSA Art. 16 notice-and-action pipeline implemented
- [ ] Children's data flow handles age-of-digital-consent (16 in Ireland)
- [ ] Call recording consent (if applicable) implemented · default off
- [ ] Verified-business claim backed by actual verification · no misleading state

---

## § 12 · Clear separation · verified vs planned

### 12.1 · VERIFIED existing functionality (evidence-backed)

- Account identity + profile · migrations 001, 042, 046
- WebAuthn credentials · migration 043
- Chat theme marketplace · migrations 048, 051, 085, 191-196
- Vault Phase A · migrations 128, 129, 140-143
- Country column + RLS + registry · migrations 244, 245, 252, 253
- Social intents + follow graph · migrations 145, 208, 216, 237, 238
- Ciphertext fan-out storage (Bridge 76) · `nex_account_device_key` · migration 092
- IndexedDB plaintext canonical (Bridge 77)
- ACK-based purge (Bridge 78) · migration 094
- 24h expiry **column + computation + accept-guard + query-filter** · migration 215
- Business tab customer-side conversation filter · `conversation-service.listConversationsForAccount`
- Avatar presence RIM primitives (visual only · see § 3.1)
- Sealed phone-frame + mobile-first layout
- Community Notice doctrine with location-privacy enforcement

### 12.2 · PLANNED (not yet implemented · needs authorisation)

- Scheduled 24h expiry sweep cron
- WhatsApp tracked invitation flow (contingent on 5.1.1 decision)
- Push dispatch + FCM/APNs delivery
- WebRTC signalling + ICE/STUN/TURN
- Presence tick service + account `last_seen_at`
- Outbound send queue (offline-first)
- Group chat schema + service + UI (Groups is still Soon)
- Irish reaction pack + shamrock stickers
- Observability tooling (structured logs · metrics · alerts)
- Rate-limit coverage for invites · messages · calls
- Moderation ledger consolidation
- Operational runbooks + on-call + status page
- Performance measurement baseline capture
- Qualified cryptographer protocol review (Option 2 blockers)
- Qualified Irish/EU solicitor compliance review

### 12.3 · UNVERIFIED (exists in some form but not end-to-end tested)

- Call routing + call logs (persistence confirmed, signalling + real-device call not)
- Notification dispatch tests exist (unit level) · real delivery not confirmed
- Family Safety hub + flows (UI confirmed, child_profile schema not found)
- Billing surface + Stripe wiring (adapter confirmed, "not linked from navigation yet")

### 12.4 · DECIDED but unspecified in detail

- Option 2 D1 Approved direction (separate identity/encryption keys · protocol TBD)
- Option 2 D3 Approved direction (challenge-response + trusted-device approval · implementation pending)
- Option 2 D4 Approved direction (no email-only recovery · credential form TBD)
- Option 2 D6 Approved direction (no automatic historical sync)
- Option 2 D7 Approved direction (no read receipts initial release)
- Option 2 D20 Approved direction (proven forward-secret protocol in initial design · no launch with current static wrap)

---

## § 13 · Final notes

**Nothing in this blueprint is implementation authorisation.** Each work package must be individually approved before engineering begins. Each owner decision must be recorded before the dependent work package can start.

**No cryptography has been invented in this document.** Where crypto is referenced, it defers to a vetted protocol selected via owner-approved integrated D1+D2+D20 direction and reviewed by a qualified cryptographer.

**No legal conclusions are drawn.** The compliance matrix is a programmer's reading of likely obligations and must be verified by a qualified Irish/EU-licensed solicitor before relying on it.

**No performance claims are made.** All SLO numbers in this document are PROPOSED and require owner approval + measurement baseline capture before becoming binding.

**All existing sealed doctrine remains in force.** This blueprint explicitly honours: Bridges 2 · 2b · 76 · 77 · 78 · 88 · chat master layout rule · keypad universal · pending-invite privacy · avatar presence RIM · community notice copy · vault entitlements · pricing baseline · Package Contract DRAFT · Service Principle DRAFT · NEX never handles payments · Phase A1 hold · three unimplemented claims · A-strict scope.

**No implementation. No commits. No pushes. No deploys.**

End of blueprint.
