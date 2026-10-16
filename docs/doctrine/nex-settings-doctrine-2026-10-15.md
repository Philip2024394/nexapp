# NEX Settings Doctrine · SEALED 2026-10-15 (consolidated owner approval)

**Status**: SEALED by consolidated owner directive 2026-10-15. R8
Notifications doctrine was approved per Stage 3 and migration 198 has
been applied to the sealed Supabase project. R9 Chat preferences,
R10 Privacy, R14 Data usage are approved for implementation (migrations
to be prepared but NOT applied without separate authorisation). R14b
Data export remains blocked on infrastructure authorisation (email
delivery + background-job runner). R15 Wallet remains honestly
unavailable.

**Approved decisions in this document**:
- §1 Notifications: 5 categories (message/call/reaction/mention/marketing)
  · ON×4/OFF for marketing · quiet-hours deferred · migration 198
  applied 2026-10-15.
- §2 Chat preferences: reciprocal read receipts, 3-level last-seen +
  online, 1:1 typing only (defer group), new-account default = nobody
  for presence · migration 199 (unapplied).
- §3 Privacy: 3-level profile_visibility (public/contacts/private),
  2-level who_can_message (everyone/contacts), is_discoverable stays
  separate axis, new-account defaults = public/everyone (match existing
  product behaviour · do NOT silently change existing users), message-
  request flow and `contacts_or_request` dropped from this stage,
  who_can_call deferred · migration 200 (unapplied).
- §4 Data usage: 3-axis auto-download (images/videos/audio ×
  always/wifi_only/never), 2-tier upload quality (standard/HD),
  Wi-Fi detection best-effort via `navigator.connection` · migration
  201 (unapplied).
- §5 Data export: scope = account data + conversation metadata +
  Vault file list only (NO Vault bodies), 30-day cooldown + 7-day
  URL expiry, infrastructure NOT authorised (email delivery +
  background-job runner require separate approval) · export remains
  honestly unavailable until infrastructure lands.
- §6 Wallet: honestly unavailable · null-href · no payment-provider
  integration until a dedicated wallet project is authorised.
- §7 Cross-cutting: language-as-you-touch i18n (not a broad refactor),
  no bulk migration-history reconciliation, Stage 3b push event-source
  wiring remains deferred.

**Legacy header retained for historical reference**:

> DRAFT · prepared in parallel with Stage 1/2 implementation
> authorised 2026-10-15. Every "Recommendation" subsection was a proposal
> requiring explicit owner approval before any schema migration or service
> enforcement is written.

**Scope**: NEX Settings features whose Stage 3-6 build depends on
product rules that are currently UNDOCUMENTED (per the 2026-10-15
doctrine inventory). These are: **Notifications**, **Chat preferences**,
**Privacy & contact permissions**, **Data usage & export**.

**Out of scope** (sealed elsewhere):
- Vault entitlement · `nex-vault-business-entitlement-policy-2026-10-15.md`
- Theme / thumbnail merchandising · `business-thumbnail-entitlement.md`
- Safe Trust System · `nex-safe-trust-system.md`
- Payment-provider integration · sealed REFUSED pending explicit auth
- Power tokens / wallet · remains honestly unavailable (Stage 7 deferred)

**How to read this document**: each section lists what the backend
already supports (SEALED), the proposed defaults + enforcement model
(RECOMMENDATION), and the acceptance tests that would prove the
recommendation is honoured. The owner may approve, amend, or reject
each recommendation independently before the corresponding Stage
starts.

---

## 1 · Notifications

### 1.1 · What is already SEALED

- Push subscription table · migration `098_nex_account_push_subscription.sql`
  - per-device Web Push subscription · endpoint + p256dh + auth keys
  - fanout to all account devices on urgent events (e.g. incoming call)
  - automatic pruning on 410/404 responses
- `src/lib/nex-native/push-subscription-service.ts` ·
  `upsertSubscription`, `listSubscriptions`, `prunePushSubscription`,
  `removePushSubscription` · all production-ready
- `src/app/api/nex-native/push/subscribe/route.ts` · POST endpoint
  wired for service-worker rotation
- `src/app/nex-native/_push-subscribe-hub.tsx` · client component
  surfacing the browser permission prompt

### 1.2 · What is MISSING

- No per-user preference table (`nex_account_notification_prefs` or
  similar) · the send-path currently fans out to every subscription
  regardless of user preference
- No per-category concept (message / call / reaction / group / mention)
- No quiet-hours concept
- No Settings UI

### 1.3 · RECOMMENDATION · categories, defaults, enforcement

**Categories** (five · aligned with existing peer-chat capabilities):
| Key | Covers | Default |
|---|---|---|
| `message` | Direct peer-chat messages | ON |
| `call` | Incoming voice/video calls | ON (urgent) |
| `reaction` | Someone reacted to your message | ON |
| `mention` | Someone @mentioned you (future) | ON |
| `marketing` | NEX product announcements, promos | OFF |

Rationale: four high-signal categories default ON because the user
installed NEX to communicate; marketing defaults OFF because users
should opt INTO promotional content, not opt out.

**Quiet hours**: **DO NOT ship in Stage 3.** Reason: NEX has no
timezone column on `nex_account` today. Shipping quiet hours would
require either (a) a new column + user-visible time picker, (b)
server-side timezone inference (unreliable), or (c) UTC-only (useless).
Defer to Stage 3b when timezone capture is designed.

**Persistence model**:
```sql
-- MIGRATION PROPOSAL · NOT YET AUTHORISED
create table nex_account_notification_prefs (
  account_id uuid primary key references nex_account(id) on delete cascade,
  message_enabled boolean not null default true,
  call_enabled boolean not null default true,
  reaction_enabled boolean not null default true,
  mention_enabled boolean not null default true,
  marketing_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
```

**Server-side enforcement**: the push send-path (sealed service to be
written in Stage 3 or extend the existing `push-subscription-service`)
MUST read prefs before fanout. A disabled category never results in a
push send · the subscription itself remains active so it can be
toggled back on without re-prompting the browser.

**Failure behaviour**:
- Missing prefs row → treat as all-defaults (ON for 4, OFF for marketing)
- Prefs read fails → fallback to all-ON (fail-open for high-signal · an
  outage must not silence incoming calls)
- Permission denied in browser → UI shows "allow in browser" CTA with
  honest explanation · no fake success state

**Security implications**: notification previews MUST NOT leak Vault
conversation content (sealed in
`nex-vault-business-entitlement-policy-2026-10-15:58-66`). The
Stage 3 push send-path must gate preview text behind
"is this conversation vaulted?" check.

### 1.4 · Acceptance tests

1. Migration applies idempotently · default row shape matches spec
2. UI toggles persist · a round-trip (toggle off → reload → observe
   OFF) succeeds
3. Push send-path respects prefs: toggle message=OFF, send a peer
   message → zero push dispatched to that account's subscriptions
4. Permission grant flow: deny → UI shows CTA · grant → row appears
   in `nex_account_push_subscription`
5. Marketing default: new account registration → row created with
   `marketing_enabled=false`
6. Vault leak guard: Vault conversation outbound push → preview text
   does not include ciphertext body

### 1.5 · Owner decisions needed before Stage 3 starts

1. Approve the 5-category list OR amend
2. Approve defaults (ON ×4, OFF for marketing) OR amend
3. Confirm quiet-hours deferred to Stage 3b
4. Approve the proposed migration shape OR direct a different schema

---

## 2 · Chat preferences

### 2.1 · What is already SEALED

- Realtime typing module · `src/lib/nex-native/realtime/typing.ts` ·
  `openTypingChannel` broadcasts with 3-second expiry
- `delivered_at` tracking · migration 093 on `nex_peer_message_encrypted`
  + sealed `peer-message/delivered` route (Bridge 76/78) · marks a
  message as successfully decrypted by the recipient (NOT human-read)

### 2.2 · What is MISSING

- No `read_receipts_enabled` column
- No `typing_indicator_enabled` column
- No `last_seen_visibility` column (and no `last_seen_at` either)
- No `online_status_visibility` column
- No gating logic in `peer-message-service` or `typing.ts`

### 2.3 · RECOMMENDATION · semantics, defaults, enforcement

**Read-receipt reciprocity** (WhatsApp semantics):
- Toggle "Send read receipts" ON → OTHER party sees when I've read their
  messages AND I can see when OTHERS have read mine
- Toggle OFF → neither direction visible for me (I don't broadcast · I
  also don't receive · symmetric privacy)
- Rationale: WhatsApp's reciprocal model is the dominant mobile-chat
  convention and preserves privacy symmetry

**Typing indicator**:
- Toggle "Show typing indicator" ON (default) → broadcast + see
- Toggle OFF → neither direction
- Scope: 1:1 peer chat only in Stage 4 · group typing deferred

**Last-seen privacy** (4 levels, WhatsApp-aligned):
| Level | Meaning |
|---|---|
| `everyone` | Any NEX user who views my profile sees last-seen |
| `contacts` | Only accepted friend edges |
| `nobody` | Nobody; broadcast suppressed · my `last_seen_at` always NULL in payloads |
| `nobody_default` | Default on account creation |

**Online-status privacy** (3 levels):
| Level | Meaning |
|---|---|
| `everyone` | Any viewer sees "online now" when I'm connected |
| `contacts` | Only accepted friends |
| `nobody` | Default; status broadcast suppressed |

Rationale for defaults: new NEX accounts default to **nobody** for both
last-seen AND online-status. Users opt INTO visibility; they do not opt
out. This matches NEX's privacy-by-default doctrine in Vault.

**Persistence model**:
```sql
-- MIGRATION PROPOSAL · NOT YET AUTHORISED
alter table nex_account
  add column read_receipts_enabled boolean not null default true,
  add column typing_indicator_enabled boolean not null default true,
  add column last_seen_visibility text not null default 'nobody'
    check (last_seen_visibility in ('everyone', 'contacts', 'nobody')),
  add column online_status_visibility text not null default 'nobody'
    check (online_status_visibility in ('everyone', 'contacts', 'nobody')),
  add column last_seen_at timestamptz;
```

**Server-side enforcement**:
- `peer-message-service` consults sender + recipient flags before
  marking `delivered_at` (both-sides must have receipts ON for the
  timestamp to be revealed)
- `realtime/typing.ts` reads sender flag before broadcasting
- Presence service (to be written) reads viewer-is-contact relationship
  BEFORE returning `last_seen_at` or online status

**Failure behaviour**:
- Service-layer read fails → fallback to privacy-maximum (treat as
  "nobody") · fail-closed because this is privacy enforcement
- UI toggle write fails → preserve the old state visibly · never
  silently drop the user's intent

**Security implications**:
- Receipts enforcement must happen SERVER-SIDE. A compromised client
  cannot override the recipient's "receipts OFF" setting
- Last-seen gating must happen in the API response, not the client
- Reciprocity rule: a user with receipts OFF reading my message must
  NOT update `delivered_at` in a way that leaks the read to me

### 2.4 · Acceptance tests

1. Toggle receipts OFF → send message to that user → `delivered_at`
   stays NULL on recipient's reply timeline
2. Toggle typing OFF → open composer → network tab shows ZERO typing
   broadcast
3. Last-seen=`nobody` → GET profile → payload has no `last_seen_at`
   field (not just empty · absent)
4. Last-seen=`contacts` + viewer-is-not-friend → payload has no
   `last_seen_at`
5. Reciprocity: user A receipts=OFF reads user B's message → user B
   does not see "read" indicator
6. Service failure path: force a timeout on prefs read → request falls
   through to privacy-maximum (no leak)
7. Default on new account: freshly-registered account has
   `last_seen_visibility='nobody'` and `online_status_visibility='nobody'`

### 2.5 · Owner decisions needed before Stage 4 starts

1. Approve reciprocal receipt semantics OR specify alternative
2. Approve 4-level last-seen OR specify different levels
3. Approve privacy-by-default (nobody) OR specify different default
4. Approve the proposed migration shape OR direct a different schema
5. Confirm group typing is deferred (1:1 only in Stage 4)

---

## 3 · Privacy & contact permissions

### 3.1 · What is already SEALED

- Report table · migration `070_nex_report.sql` · reasons enum, status
  machine, snapshot capture
- `src/lib/nex-native/report-service.ts` · abuse/scam reports (sealed
  2026-09-28, Bridge 16d)
- Discoverability flag `nex_account.is_discoverable` (exists in Socials
  surface) · currently controls Socials appearance only
- `nex_friend_edge.status='blocked'` + sealed `friend-service` block
  path (used in Stage 1 Blocked contacts UI)
- Vault conversations never surface in autocomplete, mentions, invite
  flows, or group pickers (sealed in Vault policy)

### 3.2 · What is MISSING

- No profile visibility level
- No `who_can_message` enforcement in `peer-conversation-service`
- No `who_can_call` enforcement in the call signalling path
- No per-category privacy enum (profile / status / about / avatar)

### 3.3 · RECOMMENDATION · levels, enforcement model

**Profile visibility · 3 levels** (simplest coherent model):
| Level | Who can see my profile card |
|---|---|
| `public` | Anyone on NEX (via Socials, directory, mention autocomplete) |
| `contacts` | Only accepted friend edges |
| `private` | Only accounts I've explicitly messaged (one-way reveal) |

**Who can message me · 3 levels** (parallel to profile visibility):
| Level | Who can initiate a peer conversation |
|---|---|
| `everyone` | Anyone can message me (current implicit behaviour) |
| `contacts` | Only accepted friends |
| `contacts_or_request` | Non-friends can send ONE message-request which I accept or reject before further messages are delivered |

**Who can call me · same shape**:
| Level | Who can call |
|---|---|
| `everyone` | Any messaging-allowed account |
| `contacts` | Only accepted friends |
| `nobody` | Calls are universally silenced; still reachable via messages |

**Discoverability** (reuses existing `nex_account.is_discoverable`):
- ON (default) → appears in Socials canvas + global directory
- OFF → account exists but is not surfaced in discovery flows

**Persistence model**:
```sql
-- MIGRATION PROPOSAL · NOT YET AUTHORISED
alter table nex_account
  add column profile_visibility text not null default 'public'
    check (profile_visibility in ('public', 'contacts', 'private')),
  add column who_can_message text not null default 'everyone'
    check (who_can_message in ('everyone', 'contacts', 'contacts_or_request')),
  add column who_can_call text not null default 'everyone'
    check (who_can_call in ('everyone', 'contacts', 'nobody'));

-- Companion table for the 'contacts_or_request' mode
create table nex_message_request (
  id uuid primary key default gen_random_uuid(),
  from_account_id uuid not null references nex_account(id) on delete cascade,
  to_account_id uuid not null references nex_account(id) on delete cascade,
  first_message_body text not null,
  state text not null default 'pending'
    check (state in ('pending', 'accepted', 'rejected', 'expired')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (from_account_id, to_account_id, state) deferrable initially deferred
);
```

**Server-side enforcement**:
- `peer-conversation-service.getOrCreatePeerConversation` MUST check
  recipient's `who_can_message` + friend-edge status BEFORE insert
- Call signalling path MUST check recipient's `who_can_call` BEFORE
  routing the invitation
- Profile-reader endpoint MUST gate by `profile_visibility` + viewer
  friend-edge status

**Failure behaviour**:
- Prefs read fails → fallback to RESTRICTIVE (profile=`contacts`,
  messages=`contacts`, calls=`contacts`) · fail-closed for privacy
- Rejected message-request → sender sees generic "message queued"
  response · recipient's rejection is not revealed back to sender
  (prevents enumeration attacks)
- Expired request (after 30 days) → silently dropped

**Security implications**:
- A compromised client cannot bypass server-side `who_can_message`
  check; the service rejects the conversation-create outright
- `profile_visibility='private'` is NOT equivalent to deleted; the
  account still exists but is not readable to non-correspondents
- Message-request first-message body is stored unencrypted ONLY for
  the recipient's accept-decision preview · once accepted it moves
  into the normal peer-message pipeline (encrypted path)

### 3.4 · Acceptance tests

1. `who_can_message='contacts'` + non-friend tries to send → service
   returns error, zero rows inserted into `nex_peer_conversation`
2. `who_can_message='contacts_or_request'` + non-friend sends → row
   created in `nex_message_request`, state='pending'
3. Message-request accept → promoted to `nex_peer_conversation` normal
   row, subsequent messages flow through encrypted path
4. Message-request reject → sender gets no leak of the rejection
5. `who_can_call='nobody'` + any caller → signalling returns 403, no
   push dispatched
6. `profile_visibility='private'` + non-correspondent fetch → profile
   endpoint returns 404 (not 403) to prevent enumeration
7. Default on new account: `profile_visibility='public'`,
   `who_can_message='everyone'`, `who_can_call='everyone'`
8. Service failure path: force a timeout on prefs read → request falls
   through to RESTRICTIVE defaults

### 3.5 · Owner decisions needed before Stage 5 starts

1. Approve 3-level privacy model (public/contacts/private) OR amend
2. Approve 3-level message gating OR amend
3. Approve message-request flow for `contacts_or_request` mode OR
   remove this mode
4. Approve default="everyone" for message/call OR specify stricter
   default
5. Approve or specify the companion `nex_message_request` table design
6. Confirm 30-day expiry for pending requests OR specify different TTL

---

## 4 · Data usage & export

### 4.1 · What is already SEALED

- Vault file storage · `nex_vault_file` table + `nex-vault-files`
  bucket (migrations 128+)
- Peer-chat attachment uploads · `src/app/api/nex-native/attachment/
  encrypted/route.ts`
- Terms of Use + Privacy Policy at `/nex-native/about/terms` + privacy
- Privacy Policy §15 describes account-closure/export rights (intent;
  implementation deferred)

### 4.2 · What is MISSING

- No `media_auto_download` columns
- No upload-quality tiers
- No storage-breakdown query service
- No data-export job infrastructure
- No background-job runner suitable for async GDPR exports

### 4.3 · RECOMMENDATION · controls, defaults, export model

**Media auto-download** (3 axes, WhatsApp-aligned):
| Axis | Values |
|---|---|
| `images` | always / wifi_only / never |
| `videos` | wifi_only / never (never "always" by default · bandwidth) |
| `audio` | always / wifi_only / never |

**Caveat**: NEX cannot reliably detect Wi-Fi vs cellular on web (the
Network Information API has limited browser support and is being
removed from some browsers). We propose:
- Document "Wi-Fi only" as **best-effort** · honestly tell the user we
  rely on `navigator.connection.type` where available and fall through
  to "always" where not
- Prefer explicit user intent: a "download" button on each attachment
  rather than silent auto-download for cellular users

**Upload quality** (2 tiers):
| Tier | Images | Videos |
|---|---|---|
| `standard` (default) | compressed ~1600px long edge, 80% JPEG | H.264 720p |
| `hd` | original dimensions, 95% JPEG | H.264 1080p |

**Storage breakdown**: a read-only aggregation query over
`nex_vault_file` + `nex_peer_message_encrypted.attachment_size` to
show "N GB used across X files, broken down by type". No deletion from
this surface in Stage 6 (deletion UX is a separate design).

**Data export** (GDPR):
- Async job: user requests → job row created → background worker
  materialises JSON+media archive → signed URL emailed on completion
- Scope: chats (metadata + decryptable envelope keys · NOT plaintext
  message bodies for Vault conversations · see §4.5 security below),
  profile, friend edges, Vault file list (not Vault file bodies by
  default · owner-authorised full-vault export is a separate request)
- Rate limit: 1 export per account per 30 days
- Delivery: signed URL expires after 7 days

**Persistence model**:
```sql
-- MIGRATION PROPOSAL · NOT YET AUTHORISED
alter table nex_account
  add column media_auto_download_images text not null default 'wifi_only'
    check (media_auto_download_images in ('always', 'wifi_only', 'never')),
  add column media_auto_download_videos text not null default 'wifi_only'
    check (media_auto_download_videos in ('always', 'wifi_only', 'never')),
  add column media_auto_download_audio text not null default 'wifi_only'
    check (media_auto_download_audio in ('always', 'wifi_only', 'never')),
  add column upload_quality text not null default 'standard'
    check (upload_quality in ('standard', 'hd'));

create table nex_data_export_request (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references nex_account(id) on delete cascade,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  signed_url_expires_at timestamptz,
  state text not null default 'queued'
    check (state in ('queued', 'running', 'ready', 'expired', 'failed')),
  include_vault_bodies boolean not null default false
);
create unique index on nex_data_export_request (account_id)
  where state in ('queued', 'running', 'ready');
```

**Server-side enforcement**:
- Attachment upload endpoint reads sender's `upload_quality` and
  processes accordingly
- Chat-client receive-attachment path reads viewer's auto-download
  settings before auto-fetching
- Export job runs under a service worker (NOT a request-bound Node
  task · GDPR exports are minutes-long)

**Failure behaviour**:
- Settings read fails → fallback to standard quality (not HD) and
  all-wifi_only auto-download (conservative)
- Export job failure → state='failed' + email to user with retry CTA
- Signed URL expiry → user can re-request (counts against the 30-day
  rate limit)

**Security implications**:
- Vault conversation bodies MUST NOT be included in default export.
  Only the Vault file metadata (titles, sizes, created_at) can be
  exported without a separate "export my Vault bodies" authorisation
  flow · otherwise session-token theft would exfiltrate the user's
  encrypted vault
- Export archive is encrypted at rest in S3-compatible storage with a
  one-time symmetric key included in the download URL fragment (never
  server-side)
- `include_vault_bodies=true` requires a step-up (recent PIN) to
  authorise

### 4.4 · Acceptance tests

1. Toggle images=`never` → send me an image → chat shows "tap to
   download" placeholder, no network fetch
2. Toggle upload=`hd` → upload a 4000px image → recipient sees
   original dimensions (not compressed)
3. Storage breakdown reports correct totals · integration test with
   a seed account having known fixtures
4. Export request → row created with state='queued'
5. Rate limit: second export within 30d returns the existing in-flight
   row, does not queue a duplicate
6. Export job completion → signed URL emailed + state='ready' +
   `signed_url_expires_at` set
7. Vault bodies default: `include_vault_bodies=false` → archive JSON
   has `vault.bodies_excluded_by_default: true` and NO ciphertext
8. Service failure: force a timeout on prefs read → upload goes through
   as `standard`, no HD leak

### 4.5 · Owner decisions needed before Stage 6 + 7 (export) starts

1. Approve 3-axis auto-download (images/videos/audio × always/wifi/never)
   OR amend
2. Approve `wifi_only` best-effort honesty note
3. Approve 2-tier upload quality (standard/HD) OR amend
4. Approve export scope (default: no Vault bodies) + step-up for
   Vault-body inclusion
5. Approve 30-day rate limit + 7-day URL expiry OR specify alternatives
6. Approve background-job runner model (introduces new infrastructure
   dependency · must be chosen explicitly)
7. Approve the proposed two migrations OR direct a different schema

---

## 5 · Cross-cutting rules (if above sections are approved)

### 5.1 · Honest defaults

Every new column must default to a value the user would be reasonably
comfortable with on day-one if they never visit Settings. Where the
honest default is debatable, prefer PRIVATE for privacy-adjacent
decisions and OPEN for communication-adjacent decisions (chat is for
chatting · privacy is for privacy).

### 5.2 · Fail-closed privacy, fail-open high-signal

- Privacy enforcement: service-layer read fails → fallback to
  RESTRICTIVE (treat the user as having opted into maximum privacy)
- Delivery enforcement (notifications, incoming calls): service-layer
  read fails → fallback to OPEN (never silence an incoming call because
  a prefs query timed out)

### 5.3 · Server-side authority

Every preference listed in this doctrine MUST be enforced on the server.
A client toggle only reflects server state; it never grants itself
authority. UI changes are reads-with-write that round-trip through a
sealed server action.

### 5.4 · No silent regressions

Any user who already has settings written to today's columns MUST have
those preserved after any migration. New columns default rows should
NOT reset existing values · migrations add columns with defaults only
for NEW rows (NULL for existing where applicable, or an explicit
backfill job documented and executed separately).

### 5.5 · Localisation

Every new user-visible string MUST live in `src/lib/nex/i18n/keys.ts` +
both EN + ID packs. No hard-coded English anywhere in the Settings
tree. The existing `_landing-i18n.test.ts` parity + no-raw-key tests
should be extended (not replaced) to cover each new namespace as it
lands.

---

## 6 · Decision matrix for the owner

Before Stage 3-6 implementation begins, the owner must sign off on:

| Section | Decisions | Default we'd ship if silently approved |
|---|---|---|
| 1 Notifications | 1.5 (4 items) | 5 categories, 4-ON 1-OFF, no quiet hours |
| 2 Chat prefs | 2.5 (5 items) | Reciprocal receipts, nobody-default last-seen/online |
| 3 Privacy | 3.5 (6 items) | 3-level enum, everyone-default message/call, request mode optional |
| 4 Data usage | 4.5 (7 items) | wifi_only default, 2-tier upload, 30-day export rate limit |

**Nothing happens on these recommendations until owner reply.** The
Stage 1 + Stage 2 implementations (About, Blocked, Help) do not
depend on any of these decisions and were sealed on 2026-10-15.

---

## 7 · What this doctrine does NOT propose

- No wallet / Power tokens model (owner directive 2026-10-15:
  honestly unavailable until wallet product is formally designed)
- No change to Vault entitlement enforcement (deferred to Phase 2 of
  the sealed Vault policy)
- No payment-provider integration (sealed REFUSED)
- No change to the sealed theme/thumbnail/Safe Trust/Vault doctrines

---

## 8 · Version + traceability

| Field | Value |
|---|---|
| Document version | DRAFT 1 · 2026-10-15 |
| Author | Prepared for owner review by Claude under 2026-10-15 Settings-build authorisation |
| Related sealed docs | `nex-vault-business-entitlement-policy-2026-10-15.md`, `nex-safe-trust-system.md`, `nex-package-feature-entitlement-map-2026-10-14.md` |
| Dependent batches | Stage 3 (Notifications), Stage 4 (Chat prefs), Stage 5 (Privacy), Stage 6 (Data usage), Stage 8 (Export) |
| Status | Awaiting owner approval · nothing in Stages 3-6 starts until each §x.5 decision block is signed off |
