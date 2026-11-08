# NEX Incident Metadata Leak Review · 2026-11-08

Owner directive · verify that secrets, PII, plaintext chat, and encryption
keys cannot leak into incident reports (summary / notes / metadata).

Repository · `C:/Users/Victus/nexapp` · branch `nex-ireland-build-2026-11-06`
· HEAD at time of writing `451f780b`.

Services under review:
- `src/lib/nex-native/incident/incident-service.ts` · the incident writer,
  defines `redactSummary` and holds the `nex_incident` + `nex_incident_event`
  write surface.
- `src/lib/nex-native/security-monitor/security-monitor.ts` · the
  signal-to-incident adaptor.
- `src/lib/nex-native/security-audit-service.ts` · the parallel audit log
  writer with its own allow-list of metadata keys.
- `src/app/api/nex-native/incident/section-error/route.ts` · the client-
  facing boundary report endpoint.
- `src/app/nex-native/hq/security-recovery/[incidentId]/_actions.ts` · the
  HQ incident lifecycle actions.

---

## 1 · Call-site inventory · who writes incident text?

Field reference · `nex_incident` has `summary text` (`createIncident`
sets it with `redactSummary`), `recovery_action_taken text` (clipped
to 400 chars by `transitionIncident`), `resolution_notes text` (set by
`saveResolutionNotesAction`, which also calls `redactSummary`). `nex_incident_event`
has `note text` (set by `transitionIncident` + `recordRecoveryAttempt`,
both run `redactSummary` on it).

| Call site | File:line | Field | Source of text | Redaction? |
|---|---|---|---|---|
| `reportRateLimitEscalation` | `security-monitor.ts:95-103` | `summary` | Template literal · action name + ints | Yes (via `createIncident` → `redactSummary`) |
| `reportAuthAnomaly` | `security-monitor.ts:125-133` | `summary` | Fixed enum string `"auth anomaly · ${signal.kind}"` | Yes |
| `reportDependencyDegradation` | `security-monitor.ts:151-160` | `summary` | Template · dependency name + reason + int | Yes |
| `reportAuditPersistenceFailure` | `security-monitor.ts:175-182` | `summary` | Template · event name + stage enum | Yes |
| `reportRecoveryAttempt` | `security-monitor.ts:203-210` | `summary` | Passes `signal.summary` through · caller-authored | Yes |
| `section-error` POST route | `route.ts:191-199` | `summary` | Client-supplied `message_short` (clipped 120 chars · newlines flattened · stack-trace rejected) | Yes |
| `transitionIncidentAction` | `_actions.ts:154-159` | `note` on event row | `FormData "note"` (HQ-operator typed) | Yes · service applies `redactSummary` |
| `escalateIncidentAction` | `_actions.ts:278-283` | `note` on event row | HQ-operator typed `reason` | Yes |
| `saveResolutionNotesAction` | `_actions.ts:204-210` | `resolution_notes` on nex_incident | HQ-operator typed | Yes · explicit `redactSummary` call at `_actions.ts:202` |
| `transitionIncident` | `incident-service.ts:244-269` | `recovery_action_taken` | Caller-supplied | **No · only `.slice(0, 400)`** |
| `acknowledgeIncidentAction` | `_actions.ts:106` | no free text | — | n/a |

**Gap found** · `recovery_action_taken` is clipped to 400 chars at
`incident-service.ts:249` but NEVER passed through `redactSummary`. If
a future HQ form (or an automated recovery hook) writes a JWT / Bearer /
raw IP into that field, it lands in the DB verbatim. No current caller
exercises this path with user-controlled data, but the gap is real.

---

## 2 · Redaction coverage · what `redactSummary` catches today

From `incident-service.ts:94-110`:

```
const REDACTION_PATTERNS: readonly RegExp[] = [
  /sk_live_[a-zA-Z0-9]+/g,
  /sk_test_[a-zA-Z0-9]+/g,
  /eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g,   // JWT
  /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,                       // raw IPs
  /password[=:][^\s&]+/gi,
  /token[=:][^\s&]+/gi,
  /authorization:\s*bearer\s+[^\s]+/gi,
];
```

Plus a hard `input.slice(0, 400)` cap. Coverage:

| Pattern | Covered? | Notes |
|---|---|---|
| Stripe live key `sk_live_…` | Yes | |
| Stripe test key `sk_test_…` | Yes | |
| JWT (3-segment base64url) | Yes | Catches Supabase service-role JWTs and user JWTs identically |
| Raw IPv4 | Yes | |
| `password=` / `password:` | Yes (case-insensitive) | |
| `token=` / `token:` | Yes | |
| `Authorization: Bearer …` | Yes | |

**Gaps** · the following SHOULD be redacted and currently are NOT:

| Pattern | Risk | Example of how it could enter summary today |
|---|---|---|
| Email addresses `\b[\w.+-]+@[\w-]+\.[\w.-]+\b` | PII leak into `nex_incident.summary` for HQ operators + any future export | HQ note typed into `transitionIncidentAction` or `saveResolutionNotesAction` · "user foo@bar.com complained" |
| E.164-style phone numbers `\+?[0-9]{7,15}` | PII leak | Same as above · HQ operator pastes a reporter's number |
| UUIDs `[0-9a-f]{8}-…` (user IDs) | De-pseudonymises when the audit erasure (§7) has not yet run | `security-monitor.reportAuthAnomaly` currently emits via `correlationId` field (not summary) · safe. But HQ-operator notes can paste a UUID freely |
| OpenAI keys `sk-proj…` / `sk-live…` / `sk-prod…` | Secret leak | The `redactSummary` regex matches `sk_live_` (underscore), NOT `sk-proj` / `sk-live` / `sk-prod` (hyphen). This is a divergence from `scripts/security-ci/secret-scan.mjs` which DOES catch hyphenated OpenAI keys. Any operator typo in a note that inadvertently included an OpenAI key would NOT be redacted. |
| Stripe restricted key `rk_live_…` | Secret leak | Not in redaction list. Secret-scan catches it, but `redactSummary` does not. |
| AWS access keys `AKIA[0-9A-Z]{16}` | Secret leak | Not in redaction list. |
| GitHub tokens `ghp_` / `gho_` | Secret leak | Not in redaction list. |
| Private key PEM `-----BEGIN … PRIVATE KEY-----` | Secret leak | 400-char clip would truncate but the header alone would remain |
| NaCl nonces (hex 48 chars) | Minor · nonces alone are not secret but their presence in a summary is a smell | Not covered |
| IPv6 | PII leak | Regex only matches IPv4. An IPv6 address lands unredacted |
| `api_key=` / `apikey=` | Secret leak | Only `password=` and `token=` are caught |
| Credit card numbers (Luhn-shape) | PCI concern (NEX does not handle cards today but F5 token purchase is on the roadmap) | Not covered |

---

## 3 · Recommended additions to `redactSummary`

Specific regex additions, matching the sealed `secret-scan.mjs`
patterns where possible to keep NEX's two defense layers consistent:

```ts
const REDACTION_PATTERNS: readonly RegExp[] = [
  // existing
  /sk_live_[a-zA-Z0-9]+/g,
  /sk_test_[a-zA-Z0-9]+/g,
  /eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g,
  /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
  /password[=:][^\s&]+/gi,
  /token[=:][^\s&]+/gi,
  /authorization:\s*bearer\s+[^\s]+/gi,

  // additions matching secret-scan.mjs patterns
  /\bAKIA[0-9A-Z]{16}\b/g,                                   // AWS key id
  /\brk_live_[a-zA-Z0-9]{24,}\b/g,                           // Stripe restricted
  /\bghp_[a-zA-Z0-9]{36}\b/g,                                // GitHub PAT
  /\bgho_[a-zA-Z0-9]{36}\b/g,                                // GitHub OAuth
  /\bsk-(proj|live|prod)[a-zA-Z0-9_\-]{32,}\b/g,             // OpenAI
  /-----BEGIN (RSA |EC |DSA |ENCRYPTED |OPENSSH |)PRIVATE KEY-----/g,

  // additions for PII
  /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,   // email
  /\b\+?[0-9][0-9\- ]{6,14}[0-9]\b/g,                        // phone (loose · risks false positives on timestamps · tune)
  /\bapi[_-]?key\s*[:=]\s*[^\s&]+/gi,                        // api_key=
  /\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b/g,          // IPv6 (loose)
];
```

Notes on the phone regex · tuning required to avoid redacting
`thresholdCrossed=15000` as if it were a phone. The current rate-limit
summary in `security-monitor.ts:100` contains integer thresholds in
the 10,000-range · needs a stricter anchor (e.g. require leading `+`
or at least one dash / space grouping). Suggested stricter form ·
`/\+[0-9]{6,15}\b/g` catches only E.164-style numbers that lead with
`+`. False negatives on US-style `555-1234` are acceptable · the audit
service `PROHIBITED_METADATA_KEYS` already blocks the structured phone
field.

---

## 4 · Signal-to-incident trace · what fields flow through each monitor

### `reportRateLimitEscalation` (`security-monitor.ts:90`)
Summary template · `"rate-limit escalation · action=${signal.action} ·
threshold=${signal.thresholdCrossed} crossed in ${signal.windowSeconds}s
· affected=${signal.affectedCount}"`.
Inputs · `action` is a sealed enum of 8 strings (see
`security-rate-limit.ts:63-71` · `password_change`, `session_revoke`,
`session_revoke_all`, `chat_message`, `account_create`, `webauthn_assert`,
`webauthn_enroll`, `visitor_bootstrap`). `thresholdCrossed`,
`windowSeconds`, `affectedCount` are ints.
**Verdict** · GREEN. No user-controlled content.

### `reportAuthAnomaly` (`security-monitor.ts:118`)
Summary template · `"auth anomaly · ${signal.kind}"`.
Inputs · `kind` is a 4-value enum. `correlationId` goes into a
separate column, not the summary.
**Verdict** · GREEN.

### `reportDependencyDegradation` (`security-monitor.ts:145`)
Summary template · `"dependency ${signal.dependency} · ${signal.reason}
· latency=${signal.latency_ms}ms"`.
Inputs · `dependency` is a 5-value enum · `reason` is a 4-value enum ·
`latency_ms` is an int.
**Verdict** · GREEN.

### `reportAuditPersistenceFailure` (`security-monitor.ts:170`)
Summary template · `"audit persistence failure · ${signal.event}
${signal.stage}"`.
Inputs · `event` is the audit event name (which is drawn from the
sealed catalog at `security-audit-service.ts:79-304`, all sealed
strings) · `stage` is 2-value enum.
**Verdict** · GREEN · as long as callers don't pass a dynamic string
as `event`. Grep for callers · only
`src/lib/nex-native/security-audit-service.ts:L??` emits this · and it
passes the event name that is already in the catalog. Safe.

### `reportRecoveryAttempt` (`security-monitor.ts:198`)
Summary template · `signal.summary` (passed through verbatim before
`redactSummary` applies).
Inputs · `signal.summary` is caller-authored. Caller sites must be
audited individually. Grep for in-source callers · no production
callers found in `src/` today (tests only, in
`src/lib/nex-native/recovery/__tests__/`). **Pre-emptive risk** · the
recovery primitives documented in the README of `security-monitor` are
expected to call this in a future phase. The contract should require
the caller to pre-redact OR use a sealed template.
**Verdict** · AMBER · no live production caller, but the shape allows
free-form text. Owner may want to tighten the type to a template
with sealed fillers.

### `/api/nex-native/incident/section-error` POST (`route.ts:127`)
Summary template · `"section render error · ${messageClipped}${actorTag}"`
where `messageClipped` comes from the client body and `actorTag` is
`" · actor=<uuid>"`.
Inputs · `message_short` is user-controlled (client-side sends
`error.message` clipped to 120 chars via the sealed `SectionBoundary`
component · route re-clips and rejects stack-trace shapes). Actor UUID
is server-derived.
**Chain of defences:**
1. Client `SectionBoundary.tsx:62-72` strips `error.stack` and
   `componentStack` · only `error.message` is forwarded, clipped to
   120 chars.
2. Route `route.ts:154-167` re-clips, flattens newlines + tabs,
   rejects strings that match `looksLikeStackTrace` (newlines, "at
   function" shapes).
3. Route rate-limits via the `webauthn_assert` quota (10 / 15 min
   per-IP).
4. Incident service `redactSummary` applies the 7 patterns.
**Risk surfaces:**
- A `throw new Error(\`bad token=\${jwt}\`)` inside a section would
  flow into `message_short`. Pattern 2 (`token=`) catches it at the
  incident service. OK.
- A `throw new Error(user.email)` would flow in unredacted today (no
  email pattern). AMBER · covered by the §3 additions.
- A `throw new Error('IP ' + req.ip)` would flow as IPv4 and be
  redacted. OK.
**Verdict** · AMBER before §3 additions · GREEN after.

### HQ actions · `transitionIncidentAction`, `escalateIncidentAction`, `saveResolutionNotesAction`
HQ operators type notes. `transitionIncident` applies `redactSummary`
to the note at `incident-service.ts:268`. `saveResolutionNotesAction`
applies `redactSummary` explicitly at `_actions.ts:202`.
**Verdict** · AMBER before §3 additions. An operator who pastes an
email address or a stripped-of-prefix key lands that content in the DB
today. The §3 additions close this.

### HQ action · `assignIncidentAction` and `escalateIncidentAction`'s admin-flag write
These write structured UUIDs and booleans only · no free-form text
reaches the DB.
**Verdict** · GREEN.

### `recordRecoveryAttempt` (`incident-service.ts:281`)
Writes `note` to `nex_incident_event`. Redacted if present
(`incident-service.ts:290`).
**Verdict** · same as HQ actions · AMBER before §3 additions.

### `recovery_action_taken` field write path
`transitionIncident` at `incident-service.ts:248-250` writes
`input.recoveryActionTaken` with ONLY a 400-char slice · no redactor.
No production caller sets this field today (grep for `recoveryActionTaken`
across `src/` returns only the interface definition and tests). But
the field IS writable via the service contract. **If a future caller
passes operator-typed text here it will land unredacted.**
**Verdict** · AMBER. Fix is a single-line addition at `incident-service.ts:249`:
`patch.recovery_action_taken = redactSummary(input.recoveryActionTaken);`
(which also handles the 400 cap since `redactSummary` slices first).

---

## 5 · Audit-service metadata allowlists · are the keys scoped enough?

`security-audit-service.ts` applies TWO layers:
1. A per-event `allowedMetadataKeys` allow-list
   (`SECURITY_AUDIT_EVENTS` catalog, `security-audit-service.ts:79-304`).
   Unknown keys are stripped at `sanitiseMetadata:367-377`.
2. A `PROHIBITED_METADATA_KEYS` deny-list
   (`security-audit-service.ts:306-336`) that overrides the allow-list.
   Keys include `password`, `access_token`, `attachment_bytes`,
   `message_body`, `chat_body`, `raw_ip`, `private_key`, `nacl_key`.

Audit of catalog keys for leak risk:

| Event | Allowed keys | Risk |
|---|---|---|
| `security.account.sign_up.attempted` | `email_domain_hash, has_claim_account_id, country_code_hint` | GREEN · email is hashed, not raw |
| `security.account.sign_up.completed` | `email_domain_hash` | GREEN |
| `security.account.sign_up.failed` | `error_code, error_class` | GREEN · assumes callers don't put PII in `error_code` |
| `security.account.sign_in.completed` | `session_id, method` | AMBER · `session_id` is sensitive; if leaked via an export it could enable session replay. OK for an internal HQ log but future HQ-to-partner export must strip it. |
| `security.webauthn.enroll.completed` | `credential_id, transports, aaguid` | GREEN · aaguid is public authenticator ID |
| `security.webauthn.assert.completed` | `credential_id, counter_delta, method` | GREEN |
| `security.hq.direct_message.completed` | `target_account_id, body_length` | AMBER · `target_account_id` is a UUID that identifies a user. Current audit erasure (`nex_security_audit_erase_actor`) only pseudonymises `actor_account_id`, NOT values embedded in metadata. If a HQ operator sends a DM to an account that is later deleted, this row still names them by UUID. |
| `security.hq.incident.assigned` | `incident_id, assigned_to_id` | Same AMBER as above · `assigned_to_id` is a UUID that survives erasure |
| `security.account.delete.attempted` | `initiator, reason_code, stage` | GREEN |
| `security.hq.pages.delete_queue.completed` | `page_path, queue_size_after` | AMBER · `page_path` can embed a userland identifier if a page is user-scoped. Low risk, grep shows HQ pages are static routes. |
| `security.hq.incident.escalated` | `incident_id, reason` | AMBER · `reason` is caller-supplied free text. The HQ action `escalateIncidentAction` passes `reason.slice(0, 300)` without redacting. If an operator types an email or token here it lands in metadata JSON unredacted. The sanitiser DOES NOT scan string values · only key names. |

**Cross-cutting gap** · `sanitiseMetadata` scans KEY NAMES only, not
VALUES. Comment at `security-audit-service.ts:377-382` says explicitly
"Shallow-only · nested objects are passed through as-is. The
prohibition check does not recurse. Callers must not pass sensitive
values under permitted keys." This is a known contract, but it means
a caller that passes `{ reason: "please contact alice@example.com" }`
under a permitted key leaks PII into metadata JSON.

---

## 6 · Can chat body / attachment bytes / encryption keys reach incident summary?

Searched every call site that reaches `createIncident`,
`transitionIncident`, `recordRecoveryAttempt`, `acknowledgeIncident`,
and `recordAuditEvent`. Findings:

- **Chat body** · no call site passes `nex_peer_message.body` or
  `nex_message.body` to any incident or audit write. The chat path's
  rate-limit denials go through `recordAuditEvent` with the
  `security.chat.message.denied` event, which allows only
  `reason, retry_after_seconds` in metadata. No chat body enters.
  **GREEN.**
- **Attachment bytes** · no call site passes raw bytes or blob
  contents. Attachment-related audit events live in
  `src/lib/nex-native/attachment/` but write metadata like
  `attachment_id`, `mime_type`, `size_bytes` · all structured.
  Prohibition list also includes `attachment_bytes` as a keyword
  trap. **GREEN.**
- **Encryption keys / NaCl secretbox nonces** · no call site. Key
  material lives in `nex_vault_envelope_*` tables and never surfaces
  as monitor signal metadata. `PROHIBITED_METADATA_KEYS` includes
  `private_key, secret_key, nacl_key`. **GREEN.**
- **WebAuthn challenges** · `security.webauthn.enroll.attempted`
  allows `credential_type, rp_id` only · no challenge field. **GREEN.**
- **Session tokens / Supabase cookies** · never flow into incident or
  audit paths. The `acknowledgeIncidentAction` etc. read the actor
  from the server session, pass only the UUID. **GREEN.**

---

## 7 · Final verdict

**AMBER.**

- **No clear leak path** from chat body / attachment bytes / encryption
  keys / session tokens to incident writes today. (GREEN on those.)
- **Pre-existing PII gaps** · email, IPv6, non-E.164 phone, several
  non-Stripe secret shapes (OpenAI, AWS, GitHub, PEM) are not
  redacted. Any operator-typed note that contained them would land in
  the DB verbatim.
- **Bypass risk at `recovery_action_taken`** · field is writable via
  service contract without redaction. No production caller today,
  but the gap exists.
- **Metadata values are not scanned** · a sensitive value placed under
  an allowed key leaks into audit JSON.

### Minimum close-out to GREEN

1. Extend `redactSummary` with the §3 additions (one-line change to
   `incident-service.ts:94-102`).
2. Route `recovery_action_taken` through `redactSummary` at
   `incident-service.ts:249`.
3. Owner decision · do we also scan metadata VALUES for the prohibited
   patterns (defence-in-depth, cost = one new sanitiser pass in
   `sanitiseMetadata`)? Reasonable yes.
4. Re-run the Security Programme vitest suite (owner authorisation
   gated · see security-ci.yml).

None of the above is authorised to land in this session · this
document is the read-only audit requested.
