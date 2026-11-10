# NEX device-key chat — recommended defaults for the six open decisions
## 2026-11-10 · doctrine companion to device-key-chat-architecture-plan-2026-11-10.md

**Status.** Recommendation draft. No code, DB change, bucket, or
prod touch is authorised here. Each recommendation is a default
owner may seal, amend, or reject. Owner override wins.

**Anchors.** Sealed invariants I-1 (no server retention) · I-2 (no
queue/stash/forward) · I-3 (no plaintext exception) · I-4 (no
historical deletion without separate auth) · I-5 (no rollback
restores private content) · I-6 (no public privacy claim until
State C). Sealed memories `project_nex_chat_device_only_e2e_sealed_2026_11_09`
and `project_nex_priority_1_architecture_correction_sealed_2026_11_09`
govern conflicts.

---

## Decision 1 · §2.4 Rotation visibility

**Plan statement.** Bare rotation vs surfacing `revoked_at` to the
recipient UI.

**Recommended default · bare rotation (no `revoked_at` surfaced).**

Add `rotated_from_id uuid null` for internal correlation. Do NOT
add a recipient-facing `revoked_at` surface. Keep `retired_at`
server-side only.

**Why.** Rotation visibility is a leakage channel (device changes
often correlate with safety events, phone loss, relationship
changes). Sealed Emergency Help memory 2026-11-09 records owner
preference against leaking device-count / group-membership signals
without justification. Server should carry the minimum metadata
needed to deliver ciphertext.

**Security consequences.**
- *Bare rotation (recommended).* Senders fan out to current device
  list; stale rows silently fail decryption. No cross-peer signal.
  Peer cannot distinguish "added a laptop" from "laptop stolen."
- *Surface `revoked_at`.* Peer UI can display rotation events,
  helping notice suspicious key changes. Leaks timing of every
  rotation.

**Recovery implications.** Neutral · surfaced flag is informational
only, restores nothing.

**What this makes impossible.** No in-UI "John's phone was retired"
indicator. A future WhatsApp-style "safety number changed" screen
would need a separate seal to introduce `revoked_at` surfacing.

---

## Decision 2 · §2.5 Server-side vs client-side filtering of retired devices

**Plan statement.** When `retired_at IS NOT NULL`, is the device
hidden by `listAccountDeviceKeysAction` or only skipped at the
client fan-out loop?

**Recommended default · server-side filter.**

`listAccountDeviceKeysAction` returns only rows where `retired_at
IS NULL`. Admin tooling that needs retired rows uses a separate
service-role function.

**Why.** Least-privilege. Clients cannot accidentally fan out to
retired devices even if out of date. Aligns with I-2 spirit (reduce
chance a send lands on a device that will never consume it).

**Security consequences.**
- *Server-side (recommended).* Smaller correct list on the wire;
  clients cannot bypass. Breaks debugging paths that assumed the
  list was complete.
- *Client-side only.* Thin layer; one buggy client bypasses the
  filter.

**Recovery implications.** Neutral · retired devices cannot decrypt
anyway.

**What this makes impossible.** A stranger-caller cannot enumerate
historical devices of another account via the list endpoint.

---

## Decision 3 · §5.3 Undelivered ciphertext retention cap

**Plan statement.** A indefinite / B hard cap / C two-stage.

**Recommended default · Option B · hard cap at 30 days.**

Companion function `nex_purge_undelivered_encrypted_messages(30)`
purges rows where `encrypted=true AND delivered_at IS NULL` older
than 30 days.

**Why.** I-2 forbids a durable server-side queue; indefinite
retention of undelivered ciphertext is functionally that queue.
A 30-day ceiling preserves the legitimate offline-recipient case
(vacation, device swap) while rejecting "server holds this forever."
Option C adds a new signalling mechanism (extra auditable surface)
that does not justify its complexity at recommendation stage.

**Security consequences.**
- *A indefinite.* Storage grows with lost/abandoned devices. Messages
  never silently discarded. Violates I-2 spirit.
- *B 30 days (recommended).* Known bounded window. Senders implicitly
  accept "best-effort to all devices, 30-day ceiling."
- *C two-stage.* Honest and informative. Adds server-side tracking
  surface for the soft-signal emission.

**Recovery implications.**
- A: device returning after months still gets history.
- B/C: device offline >30 days loses undelivered window. Sender's
  self-echo row preserves sender's own history. Loss is strictly on
  the offline recipient path — matches §2.6 "we cannot restore your
  encryption key" copy.

**What this makes impossible.** A user who signs out of all devices
for >30 days cannot retrieve messages sent to them during dormancy.
Direct cost of I-2.

---

## Decision 4 · §6.1 Freeze trigger

**Plan statement.** When does the client stop writing
`encrypted=false` rows? Wording + timing.

**Recommended default · code-level flag flip, triggered by sealed
owner word-trigger, after device-key adoption telemetry crosses a
threshold.**

Ship `NEX_PRIVATE_CHAT_CIPHERTEXT_ONLY` off by default. Before
flipping, require ≥95% of active nex_account rows in the last 7
days have ≥1 `nex_account_device_key` row. Flip triggered by owner
word-trigger `freeze plaintext sends`, documented in a sealed memory
on the flip date. DB-level CHECK (mig 326) applies ≥14 days AFTER
the flag flip (see Decision 6).

**Wording shown when flag is on and either side has zero device keys.**

> To keep this conversation private, open NEX on your signed-in
> device at least once. We can't finish sending until the other
> person's device is registered too.

**Why.** I-3 (no plaintext exception) is absolute — the freeze is
required to honour it eventually. Automatic flips are rejected
because the 5-state readiness model draws a hard line between
Verified and Live-verified; a flag flip affecting user-facing chat
behaviour is an owner infra call. Threshold is a floor, not a
ceiling.

**Security consequences.**
- *Flip immediately on authored flag.* Users without device keys see
  hard failures. Honest but disruptive.
- *Flip after telemetry threshold (recommended).* Most users
  unaffected.
- *Never flip.* I-3 cannot be honoured; public privacy claim stays
  blocked forever (I-6).

**Recovery implications.** Neutral · freeze does not touch history.
Legacy `encrypted=false` rows remain for §6.3 user-driven re-encrypt
or §6.4 user-driven deletion.

**What this makes impossible.** Flag flip is not triggered by
telemetry alone — even at 99.9% adoption the server does not flip
without owner word-trigger. After flip, users whose only device
never comes back cannot send plaintext as fallback.

---

## Decision 5 · §9.1 Orphan-object sweep frequency

**Plan statement.** How often does the sweep delete ciphertext
objects with no referencing `nex_peer_message` row older than 24h?

**Recommended default · daily at 03:00 UTC, sweep objects older than
48 hours with no referencing row.**

Widen the "older than" window from 24h to 48h (conservative on false
positives). Run once per day.

**Why.** The sweep closes the upload-succeeds / DB-insert-fails
window (§9.1); it is NOT a retention sweep (only touches rows with
no reference, which cannot be decrypted by any user). Daily is
sufficient — more frequent adds Supabase cost without value. 48h
floor preserves legitimate uploads that take 47h to get their DB
row (via retry loops).

**Security consequences.**
- *Hourly, 24h window.* Fastest cleanup. Risk of racing legitimate
  slow inserts.
- *Daily, 48h (recommended).* Bounded lag, conservative.
- *Weekly.* Orphan objects linger up to a week. Storage cost only
  (nothing can decrypt them).

**Recovery implications.** None · orphan objects have no referencing
row; no user can decrypt them.

**What this makes impossible.** An upload that fails its DB insert
and is retried via a different mechanism >48h later cannot reuse
the original object. Retries happen in-session; non-issue in
practice.

---

## Decision 6 · §10.4 Ciphertext-only CHECK apply window

**Plan statement.** How long between §6.1 freeze flip and migration
326 applying the DB-level CHECK?

**Recommended default · 14 days of burn-in in sandbox, plus 7 days
in production after each state proves clean, before mig 326
applies.**

Timeline template:
- Day 0: §6.1 flag flip in sandbox.
- Day 0 → Day 14: observe sandbox for any legitimate
  `encrypted=false` insert attempts.
- Day 14: if zero observed, owner word-trigger `apply 326 sandbox`.
- Day 14 → Day 21 (sandbox): verify CHECK trigger under integration
  tests (legacy untouched, new offending inserts rejected).
- Day 21: if sandbox clean, owner word-trigger `freeze plaintext
  sends production` flips §6.1 flag in production.
- Day 21 → Day 28 (production): observe production.
- Day 28: if zero observed, owner word-trigger `apply 326
  production`.

**Why.** I-3 requires eventual plaintext rejection; CHECK is the
mechanical enforcement. 5-state readiness demands evidence per
state transition. 14 days sandbox burn-in → Verified evidence; 7
days production flag-flip → Live-verified evidence before the
irreversible CHECK lands. I-6 atomicity — mig 326 rollback would
reopen the plaintext door, so prove clean first.

**Security consequences.**
- *0-day apply.* No burn-in signal. Lingering client-side plaintext
  path becomes a hard chat failure for affected users.
- *14 + 7 days (recommended).* Burn-in surfaces any remaining
  plaintext path before CHECK makes it a hard error.
- *30+ days.* Longer cushion; delays I-3 honouring for no additional
  safety signal.

**Recovery implications.** None · CHECK only affects new inserts.
Legacy `encrypted=false` rows remain readable for §6.3 and §6.4.

**What this makes impossible.** CHECK cannot be applied
simultaneously with the freeze flag flip. Owner can extend; owner
cannot shrink below the recommendation without a separate seal.

---

## Open items this document does NOT address

- §2.6 lost-device recovery wording is fixed by the plan.
- §4.4 signed-URL TTL cap (suggested 120s) is an implementation
  detail of the existing route, not a §10 gate.
- §6.3 bulk-encrypt storage multiplier is a UI cost disclosure, not
  a gate.
- Migrations 323-327 remain as authored. None is authorised for
  apply by this document.

## Authorisation statement

Nothing here authorises: migration apply (sandbox or production),
bucket creation, RLS change, env change, code merge to main, push
to GitHub, Vercel deploy, production Supabase operation, or public
privacy claim. Each recommendation is a default the owner may seal
with a separate word-trigger.
