# NEX Call Rooms · Country-Isolation Architecture Proposal
## 2026-11-08 (round 24) · OWNER DECISION REQUIRED · no code change

Owner directive · "Call-room country isolation: this needs an
explicit architecture decision documented before implementation.
Define whether rooms are country-restricted, globally accessible,
or support controlled cross-country participation."

## Current state · observed, not assumed

Branch `nex-ireland-build-2026-11-06`. The call-room surface uses:

- **`nex_group_call_session`** · migration 133. Columns: `id`,
  `host_account_id`, `state`, `media_type`, `started_at`, `ended_at`,
  `from_call_link_id`. **No `country` column.**
- **`nex_group_call_participant`** · migration 133. Columns:
  `session_id`, `account_id`, `invited_at`, `joined_at`, `left_at`,
  `removed_by`. 4-cap DB trigger enforces max participants per
  session. **No `country` column.**
- **RLS** · service_role INSERT + SELECT + UPDATE only. Participants
  READ their own + host's rows; no anon access.

Country attribution across NEX:
- **`NEX_APP_COUNTRY`** env var per Vercel deployment
  (`nex-ireland-preview` / `nex-indonesia-preview` / `nexapp`).
- **`nex_account_profile.country_code`** · ISO2 self-declared by the
  viewer at onboarding.
- **`nex_incident.country`** CHECK enum (`'ireland' | 'indonesia' |
  'worldwide' | 'hq' | 'global'`) via migration 300 + 304 Safety
  Programme.
- Call rooms have **NO country gate** today · an Ireland host can
  invite an Indonesia member and the session accepts both.

Audit gap already noted in `docs/doctrine/safety-audit-C-hq-security-
2026-11-08.md` § Part 3 · "NOT PRESENT: no country-isolation
enforced on call rooms."

## Options

### Option A · Global call rooms (status quo)

**Policy** · a call room has NO country attribution. Any signed-in
NEX account can host / be invited to / join any session regardless
of country.

**Privacy implications**
- Call participants' countries are only inferable via their
  `nex_account_profile.country_code` (self-declared, optional) ·
  the room itself contains no country signal.
- Zero jurisdictional separation at the call-room layer.

**Safety implications**
- A compromised credential from any country can start a session with
  any member globally. The 4-cap trigger limits blast radius per
  session · the attack surface across all countries is uniform.
- No geographic correlation on abuse reports · "this call bothered
  me" is scoped to accounts, not countries.

**Discovery implications**
- Not applicable · call rooms are invitation-only. There is no
  discovery surface for sessions.

**Operational implications**
- Zero code change. HQ operators see all sessions in one dashboard.
- Country-specific moderation + legal policies (DAC7, DSA, Indonesia
  consumer-protection law) cannot differentiate at the call layer ·
  every policy applies globally OR nowhere.

### Option B · Country-restricted rooms

**Policy** · a new `nex_group_call_session.country` column CHECK-
constrained to the sealed enum. A session's country must match the
host's country at creation time. Participants must share the same
country as the session's country. Cross-country invites rejected at
the service-layer before the row is inserted.

**Privacy implications**
- Country attribution at the session layer. Simplifies erasure (a
  country's DPO can scope a deletion sweep).
- Explicit per-country audit log · "Ireland's host had 42 sessions
  in Q4" is a tractable question.

**Safety implications**
- A compromised Ireland credential can only host sessions with
  Ireland participants · caps cross-country lateral movement.
- Country mismatch at invite time surfaces a honest error · an
  attacker enumerating Indonesia accounts from an Ireland credential
  gets REJECTED and the attempt is audit-logged.

**Discovery implications**
- Not applicable · still invitation-only.

**Operational implications**
- Migration 307 (hypothetical) · ADD `country` NOT NULL default (based
  on host's country at insert time) + CHECK enum + update the
  invite-dispatch service to validate caller + invitee countries
  match.
- HQ operators need a country filter on their session dashboard.
- **Hard constraint** · users who legitimately travel (Ireland
  resident in Indonesia on business) cannot invite friends back home
  from a Dublin IP. Either · (i) they must be pre-granted a second
  country credential · OR (ii) country is derived from
  `nex_account_profile` not deployment, which weakens the model.
- Legal · per-country call-room scoping satisfies DSA Article 16
  more cleanly (notice-and-action per jurisdiction).

### Option C · Controlled cross-country participation (hybrid)

**Policy** · a session has a country · the HOST's country at
creation. Participants from OTHER countries can be invited but the
invite requires an explicit "cross-country · acknowledge" step by
both the host and the receiver. The acknowledgement is persisted on
the session (new column `cross_country_consent_at timestamptz`) so
the lineage is auditable.

**Privacy implications**
- Session carries its host-country of record. Cross-country joiners
  are flagged on the row (new participant column `joined_from_country`)
  so cross-jurisdiction traffic is visible but not blocked.
- Host-country operator sees "Indonesia participant joined an
  Ireland room" · Indonesia operator sees the same session from the
  other side.

**Safety implications**
- Compromise blast radius · same-country invites proceed normally;
  cross-country invites require TWO acknowledgements (sender UI +
  receiver UI) · the attacker can't spam cross-country invites.
- Audit trail · every cross-country join carries a
  `cross_country_consent_at` for both sides. A regulator or operator
  can reconstruct who-consented-to-what.

**Discovery implications**
- Not applicable.

**Operational implications**
- Migration · same column as Option B + participant-side
  `joined_from_country` and session-side `cross_country_consent_at`.
- UI · the invite composer surfaces a "This is a cross-country
  invite" chip on the SENDER side; the Accept button on the RECEIVER
  side carries an extra "you are joining from <indonesia>" disclosure.
- Decline flow · identical to today's flow.
- Legal · the clearest fit · each country's legal framework retains
  jurisdiction over its own residents; cross-country traffic is
  explicitly consented to and logged. DAC7 (tax info sharing) is
  satisfied because the host-country-of-record is unambiguous.

## Recommendation

**Option C · Controlled cross-country participation** · recommended
AS a programme deliverable, but **not implemented now** · owner
authorisation gate.

Rationale:
- Preserves the "NEX ships globally" product promise: a user in
  Ireland can still call a friend in Indonesia · the flow has one
  extra tap, not a hard block.
- Honest audit trail per jurisdiction · aligns with the sealed
  World-Class Safety Programme + per-country HQ admin considerations
  (`hq-country-administration-proposal-2026-11-08.md` · Option 3
  Hybrid is the parallel recommendation there).
- Minimal schema cost · 2 new columns on existing tables + a
  service-layer gate · no cross-table joins needed.
- Avoids Option B's "traveler cannot call home" problem.

If the owner prefers Option A (global status quo), the explicit
acceptance should be recorded · "cross-country call-room traffic
accepted without jurisdictional gate · global NEX product shape".
That is a legitimate choice; recording it is the audit trail.

If the owner prefers Option B (strict per-country), the service-
layer + migration + traveler-exception policy must be designed
together. Half-measure (migration without exception) harms real
users.

## Preconditions for implementing Option C

1. Add `nex_group_call_session.host_country` NOT NULL on insert
   (service derives from host's `nex_account_profile.country_code`
   OR `NEX_APP_COUNTRY` at creation time · pick one as authoritative
   · recommend `nex_account_profile.country_code` so a traveler's
   session stays in their home country).
2. Add `nex_group_call_participant.joined_from_country text` (nullable
   until the participant actually joins; set at `joined_at` time).
3. Add `nex_group_call_participant.cross_country_consent_at timestamptz`
   (nullable; set when a cross-country invite is accepted via the
   consent step).
4. Service-layer gate in `inviteToCall` · when inviter's country !=
   invitee's country, set a `requires_cross_country_consent` flag on
   the call_invite peer_message `attachment_meta`. The chat bubble
   renders the consent chip.
5. HQ dashboard filter · country of session + country of each
   participant row.
6. Audit event · new `security.calls.cross_country_consent` catalog
   entry.

Each item is a separate authorisation gate in the sealed
Build-Commit-Push doctrine.

## What is NOT changing by this document

- `nex_group_call_session` + `nex_group_call_participant` schema ·
  unchanged.
- Invite flow · unchanged.
- Service-layer gates · unchanged.
- HQ admin surface · unchanged.
- RLS · unchanged.

This document is the architecture decision gate. Owner picks A / B
/ C. Implementation does not start until the owner signs off on an
option.

## Companion proposals

- `docs/doctrine/hq-country-administration-proposal-2026-11-08.md` ·
  the parallel HQ-operator question. The owner should ideally
  decide call-room policy + HQ-admin policy TOGETHER · a Hybrid HQ
  model with Global call rooms is coherent; Strict HQ with Global
  call rooms is defensible but less aligned.
