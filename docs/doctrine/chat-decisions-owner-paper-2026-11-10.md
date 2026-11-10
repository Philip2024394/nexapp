# NEX device-key chat — owner decision paper for D1-D6
## 2026-11-10 · supersedes `device-key-chat-decisions-2026-11-10.md`

**Status.** Owner decision paper. Replaces the prior recommended-defaults
draft. No code change, no migration apply, no bucket creation, no RLS
change, no `.env` change, no commit, no push, no deploy is authorised by
this document.

**Companion plan.** `device-key-chat-architecture-plan-2026-11-10.md`
sections §2.4, §2.5, §5.3, §6.1, §9.1, §10.4.

**Anchoring sealed memories.** `project_nex_priority_1_architecture_correction_sealed_2026_11_09`
(I-1 through I-6) · `project_nex_chat_device_only_e2e_sealed_2026_11_09`
(device-only E2E supersedes conflicting persisted-messaging doctrine) ·
`project_nex_phase_2_remediation_priorities_sealed_2026_11_09` (chat
privacy P0 · engineering ceiling = Verified).

---

## Hard rules (apply to every decision below)

1. **NEX must not become a storage provider for readable chat content.**
2. **NEX must not silently delete or migrate legacy plaintext data** (I-4).
3. **Any option that requires NEX to hold plaintext is IMMEDIATELY
   DISQUALIFIED** (I-1, I-3). Such options appear below ONLY as explicit
   non-starters, never as viable choices.
4. **Lost-every-device is stated honestly** as a scenario in which NEX
   cannot recover prior encrypted conversations — not as a "support
   ticket" path. The server never holds the recipient's secret key.

---

## D1 · §2.4 Rotation visibility: bare rotation vs revoked-at surfacing

### 1. The decision being made
Bare rotation vs revoked-at surfacing. Add `rotated_from_id uuid null`
for internal correlation, and separately decide whether a
`revoked_at timestamptz null` column is populated AND surfaced to peer
recipient UIs so peers see "a device of this user was retired".

### 2. Options
- **A · bare rotation.** `rotated_from_id` only · no peer-facing
  `revoked_at` surface.
- **B · surface `revoked_at`.** Peer UI renders a system banner on
  rotation events ("Philip retired a device").
- **C · hybrid opt-in.** `revoked_at` stored, peer-facing surface is a
  per-user privacy toggle (default off).

### 3. Recommended default
**A · bare rotation.** `rotated_from_id` server-side only, no peer surface.

### 4. Security consequences of each option
- **A.** Senders fan out to current device list; stale rows silently fail
  decryption. No cross-peer signal is emitted, so an attacker observing
  one peer's UI learns nothing about the other peer's device turnover.
  Trade-off: a peer cannot detect a surreptitious key change (phone seizure,
  stealth compromise) through the UI — they can only detect it via
  out-of-band channels.
- **B.** Peer UI can display rotation events, which gives recipients a
  WhatsApp-style "safety number changed" signal — valuable for detecting
  suspicious key changes mid-conversation. Cost: every rotation is a
  broadcast fact about the owner's device lifecycle. Device changes often
  correlate with safety events (phone loss, relationship changes,
  domestic-abuse scenarios); surfacing them widens the attack surface
  for a motivated adversary who is also a chat peer.
- **C.** Default-off preserves A's safety posture; opt-in gives
  safety-conscious users the B signal. Cost: introduces a user setting
  that must be correctly scoped, documented, and migrated; a buggy
  default or UI bug can flip the whole user base's privacy posture.

### 5. User-experience consequences of each option
- **A.** The user never sees a message about the other person's devices.
  Rotation is invisible. If Philip replaces his phone, Anna sees no
  change — new messages just arrive on the new device. Simple.
- **B.** Anna sees "Philip retired a device" the next time a sender fans
  out after Philip's rotation. Reassuring for some users. Confusing or
  frightening for others ("why am I being told this?"). Risk of alarm
  fatigue — users dismiss the banner without reading it.
- **C.** Most users see A. Privacy-forward users opt in and see B. Adds
  a settings toggle to explain.

### 6. Multi-device implications
- **A.** Scales invisibly to 2-5 devices. Adding, replacing, or losing a
  device is a silent event on the peer side.
- **B.** 2-5 devices means 2-5 opportunities to generate a "retired a
  device" banner over the device's lifetime. Users with high device
  churn (upgrading phones, work vs personal) generate frequent banners.
- **C.** Same as A unless the owner opts in.

### 7. Recovery implications
- **A.** Neutral. The flag restores nothing; it is informational only.
- **B.** Neutral. Same.
- **C.** Neutral. Same.

### 8. What happens if the user loses EVERY device
- **A.** Peer sees no "John lost everything" signal. Messages sent after
  the loss simply never decrypt on any device John owns. Honest truth:
  NEX cannot recover prior encrypted conversations.
- **B.** If John registers a fresh device on a new install, peers see
  "John retired <all old> devices" banners. Peers can infer total loss.
  Prior conversations are still unrecoverable by NEX.
- **C.** Same as A unless John had opted in before losing devices.

### 9. Reversibility
- **A → B** is reversible without data loss: add the column later,
  start populating it, surface the UI. Backfill `revoked_at` from
  `retired_at` if the owner wants historical rotation banners.
- **B → A** is reversible by hiding the UI; column remains for audit.
- **A → C** is a superset of A → B plus a per-user setting migration.
  No private content destroyed in either direction.

---

## D2 · §2.5 Retired-device filter: server-side vs client-side

### 1. The decision being made
When `retired_at IS NOT NULL` on a `nex_account_device_key` row, is the
device hidden by `listAccountDeviceKeysAction` (server-side filter) or
only skipped at the client fan-out loop (client-side filter)?

### 2. Options
- **A · server-side filter.** `listAccountDeviceKeysAction` returns only
  rows where `retired_at IS NULL`. A separate service-role function
  returns the full list for admin/debug tooling.
- **B · client-side filter.** Server returns all rows; client skips
  retired ones in the fan-out planner.
- **C · hybrid (dual list).** Server returns `{active, retired}` as
  separate arrays. Client defaults to active; can opt into retired for
  history re-decryption paths.

### 3. Recommended default
**A · server-side filter.** Dedicated admin function for retired-list
access.

### 4. Security consequences of each option
- **A.** Least-privilege: the correct, smaller list is on the wire. A
  buggy or malicious client cannot accidentally fan out to retired
  devices, so no new sends land on a device that cannot or should not
  consume them. A stranger caller cannot enumerate a target account's
  historical device count through the public list endpoint. Reduces a
  side-channel for inferring "this account has had turnover".
- **B.** Thin protection. One buggy client (or any attacker with a
  valid session) can bypass the filter by ignoring the field, fan out to
  retired devices, and produce undecryptable noise. The full retired
  device list is also visible to any authenticated caller — a device-
  count leakage channel.
- **C.** Same protection posture as A for the default call site, but the
  retired-list endpoint still needs its own RLS gate; adds an attack
  surface that must be audited.

### 5. User-experience consequences of each option
- **A.** Invisible. Users never see retired devices listed as send
  targets; senders never send to devices that cannot decrypt.
- **B.** Same end UX if clients behave correctly. If a client bugs out,
  users can see a "message not delivered to all devices" indicator for
  rows fanned out to dead keys — confusing.
- **C.** Default UX matches A. Debug/history views can show retired
  devices by opting in.

### 6. Multi-device implications
- **A.** With 2-5 devices, the user replacing any one device sees the
  old entry disappear from every other device's send list after
  cache invalidation (60s TTL per `device-key-cache-v2.ts`).
- **B.** Same surface, but the server exposes every device the user
  ever registered to every authenticated caller — turnover visible.
- **C.** Same as A by default.

### 7. Recovery implications
- **A.** Neutral. Retired devices cannot decrypt new sends regardless of
  where filtering happens.
- **B.** Same.
- **C.** Same.

### 8. What happens if the user loses EVERY device
- **A.** All device rows become retired on the owner's command (or via
  a future lost-access flow). The list endpoint returns zero. Peers who
  try to send see "the other side has no active devices" — the message
  is not accepted. Honest truth: NEX cannot recover prior encrypted
  conversations.
- **B.** Same end state; peers also see the full retired list, which
  may reveal timing of the loss event.
- **C.** Same as A by default.

### 9. Reversibility
- **A → B** reversible: stop filtering server-side; clients get the full
  list again. No data destroyed.
- **B → A** reversible: start filtering. No data destroyed. Debug paths
  that relied on the full list must be moved to the admin function.
- **A → C** is additive: introduce the second endpoint.

---

## D3 · §5.3 Undelivered ciphertext retention cap

### 1. The decision being made
`nex_purge_delivered_encrypted_messages(7)` currently touches only rows
where `delivered_at IS NOT NULL`. A separate rule is needed for the
ceiling on `delivered_at IS NULL` row age.

### 2. Options
- **A · indefinite.** No cap. Rows sit forever if a device never comes
  online.
- **B · hard cap · 30 days default.** `nex_purge_undelivered_encrypted_messages(30)`
  purges `encrypted=true AND delivered_at IS NULL` rows older than N
  days. N chosen by owner, default 30.
- **C · two-stage.** Soft-signal to sender at N=7 days ("1 of 2 devices
  hasn't synced"); hard-purge at M=30 days.

> Note: an implied option — "server keeps a plaintext copy for retry" —
> is IMMEDIATELY DISQUALIFIED by Hard Rule 3 / I-1 / I-3 and is not
> listed as viable.

### 3. Recommended default
**B · hard cap at 30 days.** Companion function
`nex_purge_undelivered_encrypted_messages(30)` (schema-level number via
migration 327 when authorised).

### 4. Security consequences of each option
- **A.** Durable server-side ciphertext accumulation for lost or
  abandoned devices. While the content is encrypted and not decryptable
  by the server, indefinite retention functionally resembles the
  "queue/stash" I-2 prohibits. A compromised future key, or a future
  cryptographic break, would expose a much larger historical blob
  surface. Honest reading of I-2 spirit treats this as a violation.
- **B.** Known bounded window. Senders implicitly accept
  "best-effort-to-all-devices with a 30-day ceiling". The ciphertext
  surface stops growing in the lost/abandoned-device case. I-2 and I-1
  both honoured without new signalling surfaces.
- **C.** Honest and informative to the sender. Adds a soft-signal
  emission mechanism (sender-side notification path) that needs its own
  rate limit, delivery semantics, and test coverage. More code surface
  = more chance of a privacy regression during future edits.

### 5. User-experience consequences of each option
- **A.** A device that comes back online after 6 months sees every
  message sent during that gap. Great for the returning user; bad for
  the sender who thought the chat was quiet and discovers a 6-month-old
  message was just delivered.
- **B.** A device that comes back online after 30+ days sees no
  undelivered messages from that gap. The sender does not get an
  explicit "undelivered" notice unless the client surfaces per-device
  delivered_at state. UX message when opening an old inactive device:
  "You may have missed messages sent while this device was offline for
  more than 30 days."
- **C.** Senders get a "1 of 2 devices hasn't synced" badge after 7
  days, same hard-cap behaviour as B at 30. Clearer, but another thing
  to localise and explain.

### 6. Multi-device implications
- **A.** A user who keeps a dormant tablet in a drawer for a year and
  then opens it will download a year of ciphertext on first sync —
  storage and bandwidth cost.
- **B.** Dormant device gets the last 30 days of undelivered rows, no
  more. Active devices in the same account are unaffected because their
  rows are delivered promptly.
- **C.** Same as B for dormant devices; active-device users may see the
  "some devices haven't synced" badge during travel or OS updates.

### 7. Recovery implications
- **A.** Device returning after months still receives history. No loss.
- **B.** Device offline >30 days loses the undelivered window. The
  sender's own self-echo row preserves the sender's history (self-echo
  rows typically deliver within seconds). Loss is strictly on the
  offline recipient path.
- **C.** Same loss profile as B at 30d; the 7d soft signal gives the
  sender a chance to re-send manually.

### 8. What happens if the user loses EVERY device
- **A.** Ciphertext rows addressed to the lost devices sit on the
  server forever, still undecryptable. New device registered later
  cannot decrypt them (wrong recipient key). No recovery.
- **B.** Ciphertext rows addressed to lost devices disappear after 30
  days. No recovery — NEX never held the plaintext or the recipient
  secret key. The `encrypted=false` legacy rows (if any exist) are
  untouched by this function (I-4).
- **C.** Same as B; the sender received a soft-signal at day 7 and may
  have acted on it in-band.

### 9. Reversibility
- **A → B** reversible by scheduling the purge function. Once rows are
  purged they are gone, but no plaintext is destroyed (the rows were
  ciphertext the recipient never could have decrypted anyway if they
  never held the key — but a returning device IS the key-holder and
  loses its window).
- **B → A** reversible by stopping the cron, but rows already purged
  are gone.
- **C → B/A** reversible on the policy side; already-emitted soft
  signals cannot be unsent.
- Crucially, no option restores plaintext — I-5 is satisfied by all
  three.

---

## D4 · §6.1 Freeze trigger wording + timing

### 1. The decision being made
When does NEX stop writing `encrypted=false` rows on new private chat
sends? This is the §6.1 freeze. Wording for the user-facing failure
message, plus the trigger mechanism and its timing.

### 2. Options
- **A · immediate flip.** Flag `NEX_PRIVATE_CHAT_CIPHERTEXT_ONLY` on at
  deploy time. Any send where either party has zero device keys hard-
  fails.
- **B · adoption-gated flip.** Flag off by default; flip only after ≥95%
  of active accounts (last-7-day active) have ≥1 device key row, AND an
  explicit owner word-trigger `freeze plaintext sends`.
- **C · never flip.** Continue dual-mode indefinitely.

> Note: an implied option — "fall back to plaintext silently so the
> message always goes through" — is IMMEDIATELY DISQUALIFIED by Hard
> Rule 3 / I-3 (no plaintext exception).

### 3. Recommended default
**B · adoption-gated flip, owner word-trigger required.**

Wording shown when the flag is on and either side lacks a device key:

> **To keep this chat private, open NEX on your signed-in device at
> least once. We can't finish sending until the other person's device
> is registered too.**

### 4. Security consequences of each option
- **A.** I-3 is honoured immediately. Any account that has not yet
  opened NEX on a modern browser cannot receive or send. The dual-mode
  path closes on day 1, which minimises the plaintext surface going
  forward. Sharp transition risks support load.
- **B.** I-3 is honoured once adoption is proven. During the adoption
  window the plaintext fallback path remains, which is a documented
  I-3 exception the plan calls out — this is why the flip has a trigger
  rather than being perpetual. 95% threshold is a floor; the owner can
  demand 99% or 100%.
- **C.** I-3 is never honoured for private peer chat. The I-6 public
  privacy claim remains blocked forever. Unacceptable long-term.

### 5. User-experience consequences of each option
- **A.** Users who haven't opened NEX recently see a hard failure when a
  friend tries to message them. Many complaints, many "my app is
  broken" tickets. Broad disruption on day 1.
- **B.** Most users unaffected because adoption is proven first. The
  5% laggards see the failure message on first contact, which guides
  them to open NEX (a one-time "wake up your account" step). Small,
  bounded disruption.
- **C.** No new failures. Users keep sending messages as plaintext when
  the fallback fires; the privacy claim NEX makes is more limited.

### 6. Multi-device implications
- **A.** Users with 2-5 devices who haven't opened any of them
  recently still fail. Every device must register once.
- **B.** Same, but the 95% threshold likely covers users who have
  opened at least ONE of their 2-5 devices. The dormant-tablet-in-drawer
  case can still miss a device's row but the user's account overall is
  active.
- **C.** Dormant devices continue to receive plaintext sends until they
  come online. Lowest-friction. Highest privacy debt.

### 7. Recovery implications
- **All three.** Neutral. The freeze does not touch history. Legacy
  `encrypted=false` rows remain for §6.3 user-driven re-encrypt or §6.4
  user-driven deletion. I-4 honoured by all three.

### 8. What happens if the user loses EVERY device
- **A.** User cannot send or receive anything until they sign in on a
  fresh device and register a new device key. Prior encrypted content
  remains unrecoverable (NEX never held the key).
- **B.** Same end state: after flip, a user with zero device keys on a
  new install cannot send until they register. Recovery to live-chat
  capability is possible after re-registration; recovery of prior
  encrypted conversations is not.
- **C.** User can send/receive plaintext immediately on a new device
  with no key registered — at the cost of continued plaintext surface.
  Prior encrypted conversations remain unrecoverable.

### 9. Reversibility
- **A → B / A → C** reversible by flipping the flag off (clients fall
  back to plaintext on zero-device-key sides again). No data destroyed.
- **B → A** reversible: tighten threshold or flip immediately.
- **C → A / C → B** reversible as above.
- The DB-level CHECK (migration 326) is a separate irreversible gate —
  see D6.

---

## D5 · §9.1 Orphan-object sweep frequency

### 1. The decision being made
How often does a maintenance task delete ciphertext storage objects in
`nex-peer-chat-ciphertext` that have no referencing `nex_peer_message`
row? This closes the §9.1 upload-succeeds / DB-insert-fails window.

### 2. Options
- **A · hourly, 24h window.** Sweep every hour, delete objects >24h old
  with no referencing row.
- **B · daily at 03:00 UTC, 48h window.** Sweep once a day, delete
  objects >48h old with no referencing row.
- **C · weekly, 7-day window.** Sweep once a week, delete objects >7d
  old with no referencing row.

### 3. Recommended default
**B · daily at 03:00 UTC, 48-hour age floor.**

### 4. Security consequences of each option
- **A.** Fastest cleanup. The 24h floor is tight — a legitimate upload
  whose DB insert retries at 23.5h is safe, but a 25h retry is not.
  Risk of racing legitimate slow inserts. Nothing user-decryptable is
  deleted (orphan = no referencing row = no `wrapped_keys` on any
  envelope anywhere = no key path for any user).
- **B.** Bounded lag, conservative age floor. Orphan objects that
  linger for up to ~48 hours are still only ciphertext with no key
  path. Daily cadence keeps Supabase scheduled-function cost low.
- **C.** Orphans may linger up to a week. Storage cost only; no
  decryptability for any party.

### 5. User-experience consequences of each option
- **All three.** Invisible. Orphan objects have no UI representation —
  no user is waiting for them to go away. The only visible effect would
  be if a legitimate retry races the sweep and the client reuses an
  original storage_path after the sweep nuked it; the client sees a
  404 and fails loudly instead of silently succeeding with stale bytes.

### 6. Multi-device implications
None material. A user with 2-5 devices can have any device perform the
original upload; the sweep operates server-side on storage objects
independent of device identity.

### 7. Recovery implications
None. Orphan objects by definition have no referencing row, so no user
could have decrypted them anyway (the wrapped keys live in the row's
`attachment_meta.envelope`). Deleting them reclaims storage without
affecting any user's history.

### 8. What happens if the user loses EVERY device
No interaction with D5. The sweep operates on orphans (no referencing
row). Rows a lost device was supposed to receive still exist until the
D3 retention policy acts on them; those rows reference their ciphertext
objects and are not touched by the orphan sweep.

### 9. Reversibility
- **A → B → C** fully reversible on schedule adjustments. Objects
  already deleted cannot be recovered, but by definition they were
  orphans that no user could decrypt — no privacy or UX regression.

---

## D6 · §10.4 Ciphertext-only CHECK apply window

### 1. The decision being made
How long between the §6.1 client-side freeze (D4) and the application
of migration 326 — the DB-level CHECK/trigger that rejects
`encrypted=false` inserts when both sender and recipient have ≥1
non-retired device key row.

### 2. Options
- **A · 0-day apply.** Apply mig 326 at the same deploy that flips the
  §6.1 flag.
- **B · 14d sandbox + 7d production burn-in.** 14 days observing the
  sandbox for any legitimate `encrypted=false` insert attempts, then
  owner word-trigger `apply 326 sandbox`; 7 further days of production
  flag-on observation before owner word-trigger `apply 326 production`.
- **C · 30+ days.** Longer burn-in cushion; same gating.

### 3. Recommended default
**B · 14 days sandbox burn-in + 7 days production burn-in before
migration 326 applies in production.**

### 4. Security consequences of each option
- **A.** No burn-in signal. If any client-side code path still inserts
  `encrypted=false` (legacy vector the §6.1 flag missed), that path
  becomes a hard chat failure the instant 326 applies. I-3 honoured
  immediately at the cost of operational risk.
- **B.** Burn-in surfaces residual plaintext-insert paths before the
  CHECK makes them hard errors. I-3 is honoured mechanically with
  evidence per 5-state readiness (sandbox pass → Verified; production
  flag-flip survives 7 days → Live-verified gate reached).
- **C.** Longer cushion; delays I-3 mechanical enforcement for no
  additional safety signal that the 14+7 window hasn't already
  provided. Extends the plaintext-still-possible window.

### 5. User-experience consequences of each option
- **A.** If a plaintext path survived the freeze flag, users on that
  path see hard-failing sends on day 1 with no prior warning. Support
  burden.
- **B.** Users on surviving plaintext paths are detected during
  sandbox burn-in (by test traffic + integration suites) and during
  production flag-on observation (by metrics on fallback attempts).
  Patched before CHECK lands; users never see the CHECK's hard reject.
- **C.** Same as B with longer lag; identical user outcome.

### 6. Multi-device implications
Users with 2-5 devices benefit from B's observation window: a quirky
device (an old browser, a webview wrapper) can be caught during the
burn-in and its code path fixed before CHECK rejects it.

### 7. Recovery implications
None. CHECK only rejects new inserts; legacy `encrypted=false` rows
remain readable in all options. I-4 and I-5 honoured.

### 8. What happens if the user loses EVERY device
No interaction with D6. The CHECK is about which new rows the DB will
accept, not about retention or decryptability of existing rows. A
user who lost every device still cannot decrypt prior encrypted
conversations regardless of which option is chosen.

### 9. Reversibility
- **A/B/C → drop trigger.** Fully reversible: the migration ships with
  a rollback that drops the CHECK trigger. Legacy inserts become
  possible again. **No plaintext is restored by rollback** — I-5
  honoured.
- **B → A** reversible: shrink the burn-in window on the next apply
  (requires a fresh owner word-trigger).
- **B → C** reversible: extend the window; no code or schema change
  required.

---

## Owner decision checklist

> Each item below is a **RECOMMENDATION · NOT APPROVED**. The owner
> seals each decision with a separate explicit word-trigger before
> the related implementation, migration apply, or config change is
> permitted. This checklist is a scaffold, not an authorisation.

- [ ] **D1 · Rotation visibility.** RECOMMENDATION · NOT APPROVED ·
      **A · bare rotation** · `rotated_from_id` server-side only, no
      peer-facing `revoked_at` UI banner.

- [ ] **D2 · Retired-device filter.** RECOMMENDATION · NOT APPROVED ·
      **A · server-side filter** · `listAccountDeviceKeysAction` returns
      only `retired_at IS NULL` rows; dedicated service-role function
      for retired-list access.

- [ ] **D3 · Undelivered ciphertext retention cap.** RECOMMENDATION ·
      NOT APPROVED · **B · hard cap at 30 days** ·
      `nex_purge_undelivered_encrypted_messages(30)` via migration 327
      when authorised.

- [ ] **D4 · Freeze trigger wording + timing.** RECOMMENDATION · NOT
      APPROVED · **B · adoption-gated flip, owner word-trigger
      required** · ≥95% device-key adoption floor + explicit
      `freeze plaintext sends` word-trigger; wording as drafted above.

- [ ] **D5 · Orphan-object sweep frequency.** RECOMMENDATION · NOT
      APPROVED · **B · daily at 03:00 UTC, 48-hour age floor** ·
      migration 328 when authorised.

- [ ] **D6 · Ciphertext-only CHECK apply window.** RECOMMENDATION ·
      NOT APPROVED · **B · 14-day sandbox burn-in + 7-day production
      burn-in** before migration 326 applies in production.

**Authorisation statement.** Nothing in this document authorises: a
migration apply (sandbox or production), bucket creation, RLS change,
env change, code merge to `main`, push to `Philip2024394/nexapp`,
Vercel deploy, production Supabase operation, or public privacy claim.
Each recommendation above becomes actionable only after a separate
owner word-trigger naming the specific decision.
